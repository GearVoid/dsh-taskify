/** Client request orchestration plus a disposable Host snapshot cache. */

import { taskifyStateSnapshotSchema } from './schema.js'

export const NOTICE = Object.freeze({
  SLASH_ONLY: '命令本身没有可提取的任务约束',
  DRAFT_CHANGED: '草稿已发生变化，本次 Anchor 结果已丢弃。',
  TIMEOUT: 'Taskify 超时，请重试。',
  EMPTY_RESULT: '模型未返回可用内容。',
  BUSY: 'Taskify 正在提取约束，请先取消或等待完成。',
  STATE_CHANGED: 'Taskify 状态已在 Host 更新，请重试。',
  NOT_HYDRATED: 'Taskify 状态尚未从 Host 加载完成。',
})

function statusForHostState(hostState) {
  if (hostState?.request?.phase === 'armed') {
    return hostState.request.bundle.anchors.length === 0 ? 'noop' : 'anchored'
  }
  return hostState?.anchors?.length > 0 || hostState?.focus != null ? 'anchored' : 'ready'
}

/** Derive the composer dock view without promoting armed anchors to persistence. */
export function taskifyAnchorDockModel(hostState, currentDraft) {
  const persistent = Array.isArray(hostState?.anchors)
    ? hostState.anchors.map(anchor => ({
        kind: 'persistent',
        key: anchor.id,
        anchor,
      }))
    : []
  const bundle = hostState?.request?.phase === 'armed' ? hostState.request.bundle : null
  const matchesDraft = bundle !== null && bundle.boundDraft === currentDraft
  const persistentTexts = new Set(persistent.map(({ anchor }) => anchor.text))
  const pending = matchesDraft
    ? bundle.anchors
      .filter(anchor => !persistentTexts.has(anchor.text))
      .map((anchor, index) => ({
          kind: 'pending',
          key: `pending:${bundle.requestId}:${index}`,
          anchor,
        }))
    : []

  return {
    focus: hostState?.focus ?? null,
    persistent,
    pending,
    noop: matchesDraft && bundle.anchors.length === 0,
  }
}

function cloneState(state) {
  return {
    ...state,
    hostState: state.hostState === null ? null : structuredClone(state.hostState),
    pendingFocusAcceptance: state.pendingFocusAcceptance === null
      ? null
      : { ...state.pendingFocusAcceptance },
    error: state.error === null ? null : { ...state.error },
    notice: state.notice === null ? null : { ...state.notice },
  }
}

function readyState(noticeSeq, hostState = null) {
  return {
    status: statusForHostState(hostState),
    requestId: null,
    hostState,
    requestStartDraft: null,
    requestStartDraftRev: null,
    focusSuggestion: null,
    focusSuggestionSourceDraft: null,
    pendingFocusAcceptance: null,
    error: null,
    notice: null,
    noticeSeq,
  }
}

function requestIdOf(sessionId, generation, seq) {
  return `dsh-taskify:${sessionId}:${generation}:${seq}`
}

function validAnchors(value, sourceDraft) {
  if (!Array.isArray(value)) return false
  return value.every(anchor => anchor && typeof anchor.text === 'string' && anchor.text.trim() !== ''
    && typeof anchor.evidence === 'string' && anchor.evidence.trim() !== ''
    && sourceDraft.includes(anchor.evidence))
}

function remoteValue(carrier) {
  if (!carrier || carrier.ok === false) {
    const error = carrier?.error
    throw Object.assign(new Error(error?.message || 'Taskify 远程调用失败。'), {
      code: error?.code || 'remote-error',
    })
  }
  return carrier.value
}

export class TaskifySession {
  constructor(sessionId) {
    this.sessionId = sessionId
    this.listeners = new Set()
    this.generation = 0
    this.hydration = 0
    this.seq = 0
    this.disposed = false
    this.abortController = null
    this.remote = null
    this.state = readyState(0)
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getSnapshot() {
    return this.state
  }

  emit() {
    this.state = cloneState(this.state)
    for (const listener of [...this.listeners]) {
      try { listener() } catch { /* UI observers cannot break extraction. */ }
    }
    return this.state
  }

  showNotice(text) {
    this.state.noticeSeq += 1
    this.state.notice = { seq: this.state.noticeSeq, text }
  }

  clearNotice() {
    if (this.state.notice === null) return
    this.state.notice = null
    this.emit()
  }

  get isExtracting() {
    return this.state.status === 'extracting' && !this.disposed
  }

  parseHostState(value) {
    const state = taskifyStateSnapshotSchema.parse(value)
    if (state.sessionId !== this.sessionId) throw new TypeError('Taskify state belongs to another session')
    return state
  }

  acceptHostState(value, { preserveRequest = false } = {}) {
    const hostState = this.parseHostState(value)
    const hasAuthoritativeFocus = hostState.focus !== null
    this.state = {
      ...this.state,
      status: preserveRequest && this.isExtracting ? 'extracting' : statusForHostState(hostState),
      requestId: preserveRequest ? this.state.requestId : null,
      hostState,
      requestStartDraft: preserveRequest ? this.state.requestStartDraft : null,
      requestStartDraftRev: preserveRequest ? this.state.requestStartDraftRev : null,
      focusSuggestion: hasAuthoritativeFocus ? null : this.state.focusSuggestion,
      focusSuggestionSourceDraft: hasAuthoritativeFocus ? null : this.state.focusSuggestionSourceDraft,
      pendingFocusAcceptance: hasAuthoritativeFocus ? null : this.state.pendingFocusAcceptance,
      error: null,
    }
    return hostState
  }

  async hydrate(remote, { quiet = false, applyPendingFocus = false } = {}) {
    if (this.disposed || !remote?.getState) return null
    this.remote = remote
    const hydration = ++this.hydration
    try {
      const value = remoteValue(await remote.getState({ sessionId: this.sessionId }))
      if (this.disposed || hydration !== this.hydration) return null
      const state = this.acceptHostState(value, { preserveRequest: this.isExtracting })
      const applied = applyPendingFocus && await this.applyPendingFocusAcceptance(remote)
      if (!applied) this.emit()
      return this.state.hostState ?? state
    } catch (error) {
      if (this.disposed || hydration !== this.hydration || quiet) return null
      this.failLocal({
        code: error?.code || 'remote-error',
        message: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  start({ draft, draftRev, sourceDraft, lock, remote, getLiveDraft }) {
    if (this.disposed || typeof draft !== 'string' || draft.trim() === '' || !sourceDraft) return null
    if (this.isExtracting) {
      this.showNotice(NOTICE.BUSY)
      this.emit()
      return null
    }
    if (this.state.hostState === null) {
      this.showNotice(NOTICE.NOT_HYDRATED)
      this.emit()
      return null
    }

    this.remote = remote
    this.generation += 1
    this.seq += 1
    const generation = this.generation
    const requestId = requestIdOf(this.sessionId, generation, this.seq)
    const expectedRevision = this.state.hostState.revision
    const shouldSuggestFocus = this.state.hostState.focus === null && Boolean(remote?.suggestFocus)
    const abortController = new AbortController()
    this.abortController = abortController
    this.state = {
      ...this.state,
      status: 'extracting',
      requestId,
      requestStartDraft: draft,
      requestStartDraftRev: draftRev,
      focusSuggestion: null,
      focusSuggestionSourceDraft: null,
      pendingFocusAcceptance: null,
      error: null,
      notice: null,
    }
    this.emit()

    const run = async () => {
      let carrier
      try {
        carrier = await remote.compile({
          requestId,
          sessionId: this.sessionId,
          expectedRevision,
          rawDraft: draft,
          sourceDraft,
          draft: lock.text,
          nonce: lock.nonce,
          literals: lock.locks,
        }, abortController.signal)
      } catch (error) {
        if (generation !== this.generation) {
          if (!this.disposed) await this.hydrate(remote, { quiet: true })
          return
        }
        if (this.disposed) return
        await this.hydrate(remote, { quiet: true })
        this.failLocal({ code: 'remote-error', message: error instanceof Error ? error.message : String(error) })
        return
      }
      if (generation !== this.generation) {
        if (!this.disposed) await this.hydrate(remote, { quiet: true })
        return
      }
      const live = typeof getLiveDraft === 'function' ? getLiveDraft() : { draft, draftRev }
      await this.settle({
        generation,
        requestId,
        rawDraft: draft,
        sourceDraft,
        currentDraft: live.draft,
        currentDraftRev: live.draftRev,
        carrier,
        remote,
        getLiveDraft,
        suggestionSignal: abortController.signal,
        shouldSuggestFocus,
      })
    }
    void run()
    return requestId
  }

  async requestFocusSuggestion({ generation, requestId, rawDraft, draftRev, sourceDraft, remote, getLiveDraft, signal }) {
    let value
    try {
      value = remoteValue(await remote.suggestFocus({
        requestId,
        sessionId: this.sessionId,
        sourceDraft,
      }, signal))
    } catch {
      return
    }
    if (this.disposed || generation !== this.generation
      || !value || value.requestId !== requestId || value.ok !== true
      || (value.suggestion !== null && (typeof value.suggestion !== 'string' || value.suggestion.trim() === ''))) return
    const live = typeof getLiveDraft === 'function' ? getLiveDraft() : { draft: rawDraft, draftRev }
    if (live.draft !== rawDraft || live.draftRev !== draftRev
      || this.state.hostState?.focus !== null || value.suggestion === null) return
    this.state = {
      ...this.state,
      focusSuggestion: value.suggestion,
      focusSuggestionSourceDraft: rawDraft,
    }
    this.emit()
  }

  async settle({
    generation, requestId, rawDraft, sourceDraft, currentDraft, currentDraftRev,
    carrier, remote, getLiveDraft, suggestionSignal, shouldSuggestFocus,
  }) {
    if (this.disposed || generation !== this.generation || this.state.requestId !== requestId || !this.isExtracting) return

    let value
    let hostState
    try {
      value = remoteValue(carrier)
      if (!value || value.requestId !== requestId || typeof value.ok !== 'boolean') throw new TypeError('invalid compile result')
      hostState = this.parseHostState(value.state)
    } catch (error) {
      await this.hydrate(remote, { quiet: true })
      this.failLocal({
        code: error?.code || 'bad-response',
        message: error?.code ? error.message : 'Taskify 服务返回了无效响应。',
      })
      return
    }

    const requestStartDraftRev = this.state.requestStartDraftRev
    this.acceptHostState(hostState)
    this.abortController = null

    if (currentDraft !== rawDraft || currentDraftRev !== requestStartDraftRev) {
      await this.invalidate(remote, { quiet: true })
      this.failLocal({ code: 'draft-changed', message: NOTICE.DRAFT_CHANGED })
      return
    }

    if (value.ok === false) {
      if (value.error?.code === 'revision-conflict') {
        await this.hydrate(remote, { quiet: true })
        this.showNotice(value.error.message || NOTICE.STATE_CHANGED)
        this.state.error = { code: 'revision-conflict', message: value.error.message || NOTICE.STATE_CHANGED }
        this.emit()
        return
      }
      this.failLocal({
        code: value.error?.code ?? 'remote-error',
        message: value.error?.message || 'Taskify 失败，请重试。',
      })
      return
    }

    if (hostState.request.phase !== 'armed'
      || hostState.request.bundle.boundDraft !== rawDraft
      || hostState.request.bundle.sourceDraft !== sourceDraft
      || !validAnchors(hostState.request.bundle.anchors, sourceDraft)) {
      await this.hydrate(remote, { quiet: true })
      this.failLocal({ code: 'bad-response', message: 'Taskify 服务返回了无效 Anchor。' })
      return
    }

    this.state = {
      ...this.state,
      status: statusForHostState(hostState),
      requestId: null,
      requestStartDraft: null,
      requestStartDraftRev: null,
      error: null,
      notice: null,
    }
    this.emit()
    if (shouldSuggestFocus && hostState.focus === null && remote?.suggestFocus) {
      void this.requestFocusSuggestion({
        generation,
        requestId,
        rawDraft,
        draftRev: requestStartDraftRev,
        sourceDraft,
        remote,
        getLiveDraft,
        signal: suggestionSignal,
      })
    }
  }

  failLocal(error) {
    if (this.disposed) return
    this.showNotice(error.message || 'Taskify 失败，请重试。')
    this.state = {
      ...this.state,
      status: 'error',
      requestId: null,
      requestStartDraft: null,
      requestStartDraftRev: null,
      error: { code: error.code || 'unknown', message: error.message || 'Taskify 失败，请重试。' },
    }
    this.abortController = null
    this.emit()
  }

  async invalidate(remote = this.remote, { quiet = false } = {}) {
    if (this.disposed || !remote?.invalidate) return false
    this.remote = remote
    if (this.state.hostState === null) {
      await this.hydrate(remote, { quiet })
      return false
    }
    try {
      const value = remoteValue(await remote.invalidate({
        sessionId: this.sessionId,
        expectedRevision: this.state.hostState.revision,
      }))
      if (!value || typeof value.ok !== 'boolean') throw new TypeError('invalid invalidate result')
      this.acceptHostState(value.state)
      this.emit()
      if (value.ok) return true
      if (value.error?.code === 'revision-conflict') {
        await this.hydrate(remote, { quiet: true })
        if (!quiet) {
          this.showNotice(value.error.message || NOTICE.STATE_CHANGED)
          this.emit()
        }
      }
      return false
    } catch (error) {
      await this.hydrate(remote, { quiet: true })
      if (!quiet) {
        this.showNotice(error instanceof Error ? error.message : 'Taskify 状态清理失败。')
        this.emit()
      }
      return false
    }
  }

  async acceptFocusSuggestion(text, remote = this.remote) {
    if (this.disposed) return false
    if (!remote?.setFocus || this.state.hostState === null) {
      this.showNotice('Taskify Focus 服务尚未就绪。')
      this.emit()
      return false
    }
    if (typeof text !== 'string' || text.trim() === '') {
      this.showNotice('Focus 内容不能为空。')
      this.emit()
      return false
    }
    if (this.state.hostState.focus !== null) {
      this.state.focusSuggestion = null
      this.state.focusSuggestionSourceDraft = null
      this.state.pendingFocusAcceptance = null
      this.showNotice('当前 Session 已存在 authoritative Focus，未覆盖。')
      this.emit()
      return false
    }

    this.remote = remote
    const suggestionSourceDraft = this.state.focusSuggestionSourceDraft
    this.state = {
      ...this.state,
      focusSuggestion: null,
      focusSuggestionSourceDraft: null,
      pendingFocusAcceptance: {
        text,
        sourceDraft: suggestionSourceDraft,
        status: 'waiting',
        error: null,
      },
    }
    this.emit()
    if (this.state.hostState.request.phase === 'idle') await this.applyPendingFocusAcceptance(remote)
    return true
  }

  async applyPendingFocusAcceptance(remote = this.remote) {
    const pending = this.state.pendingFocusAcceptance
    if (this.disposed || pending === null || pending.status !== 'waiting') return false
    if (!remote?.setFocus || this.state.hostState === null) {
      this.state.pendingFocusAcceptance = { ...pending, status: 'error', error: 'Taskify Focus 服务尚未就绪。' }
      this.showNotice(this.state.pendingFocusAcceptance.error)
      this.emit()
      return true
    }
    if (this.state.hostState.focus !== null) {
      this.state.pendingFocusAcceptance = null
      this.emit()
      return true
    }
    if (this.state.hostState.request.phase !== 'idle') return false

    this.state.pendingFocusAcceptance = { ...pending, status: 'applying', error: null }
    this.emit()
    try {
      const value = remoteValue(await remote.setFocus({
        sessionId: this.sessionId,
        expectedRevision: this.state.hostState.revision,
        text: pending.text,
      }))
      if (!value || typeof value.ok !== 'boolean' || !value.state) throw new TypeError('invalid Focus mutation result')
      this.acceptHostState(value.state)
      if (this.state.hostState.focus !== null) {
        this.state.pendingFocusAcceptance = null
        this.emit()
        return true
      }
      const message = value.ok
        ? 'Host 未返回 authoritative Focus；可重试启用。'
        : value.error?.message || NOTICE.STATE_CHANGED
      this.state.pendingFocusAcceptance = { ...pending, status: 'error', error: message }
      this.showNotice(message)
      this.emit()
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Focus 启用失败，可重试。'
      this.state.pendingFocusAcceptance = { ...pending, status: 'error', error: message }
      this.showNotice(message)
      this.emit()
      return true
    }
  }

  async retryPendingFocusAcceptance(remote = this.remote) {
    const pending = this.state.pendingFocusAcceptance
    if (pending === null) {
      this.showNotice('没有待启用的 Focus。')
      this.emit()
      return false
    }
    this.state.pendingFocusAcceptance = { ...pending, status: 'waiting', error: null }
    this.emit()
    if (this.state.hostState?.request.phase !== 'idle') {
      this.showNotice('Focus 已确认，将在当前 Taskify request 发送并激活后启用。')
      this.emit()
      return true
    }
    await this.applyPendingFocusAcceptance(remote)
    return this.state.hostState?.focus != null
  }

  clearPendingFocusAcceptance() {
    if (this.state.pendingFocusAcceptance === null) {
      this.showNotice('没有待取消的 Focus。')
      this.emit()
      return false
    }
    this.state.pendingFocusAcceptance = null
    this.emit()
    return true
  }

  async mutateState(method, fields, remote = this.remote) {
    if (this.disposed || !remote?.[method]) return false
    this.remote = remote
    if (this.state.hostState === null) {
      await this.hydrate(remote)
      return false
    }
    const request = {
      sessionId: this.sessionId,
      expectedRevision: this.state.hostState.revision,
      ...fields,
    }
    try {
      const value = remoteValue(await remote[method](request))
      if (!value || typeof value.ok !== 'boolean') throw new TypeError('invalid lifecycle mutation result')
      this.acceptHostState(value.state)
      this.emit()
      if (value.ok) return true
      if (value.error?.code === 'revision-conflict') await this.hydrate(remote, { quiet: true })
      this.showNotice(value.error?.message || NOTICE.STATE_CHANGED)
      this.emit()
      return false
    } catch (error) {
      await this.hydrate(remote, { quiet: true })
      this.showNotice(error instanceof Error ? error.message : 'Taskify lifecycle 更新失败。')
      this.emit()
      return false
    }
  }

  mutateAnchors(method, anchorId, remote = this.remote) {
    return this.mutateState(method, anchorId === undefined ? {} : { anchorId }, remote)
  }

  pauseAnchor(anchorId, remote) { return this.mutateAnchors('pauseAnchor', anchorId, remote) }
  resumeAnchor(anchorId, remote) { return this.mutateAnchors('resumeAnchor', anchorId, remote) }
  removeAnchor(anchorId, remote) { return this.mutateAnchors('removeAnchor', anchorId, remote) }
  clearAnchors(remote) { return this.mutateAnchors('clearAnchors', undefined, remote) }
  setFocus(text, remote) { return this.mutateState('setFocus', { text }, remote) }
  editFocus(text, remote) { return this.mutateState('editFocus', { text }, remote) }
  pauseFocus(remote) { return this.mutateState('pauseFocus', {}, remote) }
  resumeFocus(remote) { return this.mutateState('resumeFocus', {}, remote) }
  clearFocus(remote) { return this.mutateState('clearFocus', {}, remote) }
  ignoreFocusSuggestion() {
    if (this.state.focusSuggestion === null) return
    this.state.focusSuggestion = null
    this.state.focusSuggestionSourceDraft = null
    this.emit()
  }

  cancel() {
    if (this.disposed || !this.isExtracting) return
    this.generation += 1
    if (this.abortController) this.abortController.abort()
    this.abortController = null
    this.state = readyState(this.state.noticeSeq, this.state.hostState)
    this.emit()
  }

  /** Returns true when the current Host-owned pending/armed result needs explicit invalidation. */
  onDraftChanged(currentDraft) {
    if (this.disposed) return false
    if (this.state.focusSuggestion !== null && currentDraft !== this.state.focusSuggestionSourceDraft) {
      this.state.focusSuggestion = null
      this.state.focusSuggestionSourceDraft = null
      this.emit()
    }
    if (this.state.pendingFocusAcceptance !== null
      && this.state.pendingFocusAcceptance.sourceDraft !== null
      && currentDraft !== this.state.pendingFocusAcceptance.sourceDraft) {
      this.state.pendingFocusAcceptance = null
      this.showNotice('草稿已变化，待启用的 Focus 已取消。')
      this.emit()
    }
    if (this.isExtracting) return false
    const boundDraft = this.state.hostState?.request.phase === 'armed'
      ? this.state.hostState.request.bundle.boundDraft
      : this.state.hostState?.request.phase === 'pending'
        ? this.state.hostState.request.pending.boundDraft
        : null
    if (boundDraft !== null && currentDraft !== boundDraft) return true
    if (this.state.status === 'error' && currentDraft !== this.state.requestStartDraft) {
      this.state = readyState(this.state.noticeSeq, this.state.hostState)
      this.emit()
    }
    return false
  }

  destroy() {
    if (this.disposed) return
    this.disposed = true
    this.generation += 1
    this.hydration += 1
    if (this.abortController) this.abortController.abort()
    this.abortController = null
    this.listeners.clear()
  }
}
