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
  return hostState?.anchors?.length > 0 ? 'anchored' : 'ready'
}

function cloneState(state) {
  return {
    ...state,
    hostState: state.hostState === null ? null : structuredClone(state.hostState),
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
    this.state = {
      ...this.state,
      status: preserveRequest && this.isExtracting ? 'extracting' : statusForHostState(hostState),
      requestId: preserveRequest ? this.state.requestId : null,
      hostState,
      requestStartDraft: preserveRequest ? this.state.requestStartDraft : null,
      requestStartDraftRev: preserveRequest ? this.state.requestStartDraftRev : null,
      error: null,
    }
    return hostState
  }

  async hydrate(remote, { quiet = false } = {}) {
    if (this.disposed || !remote?.getState) return null
    this.remote = remote
    const hydration = ++this.hydration
    try {
      const value = remoteValue(await remote.getState({ sessionId: this.sessionId }))
      if (this.disposed || hydration !== this.hydration) return null
      const state = this.acceptHostState(value, { preserveRequest: this.isExtracting })
      this.emit()
      return state
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
    const abortController = new AbortController()
    this.abortController = abortController
    this.state = {
      ...this.state,
      status: 'extracting',
      requestId,
      requestStartDraft: draft,
      requestStartDraftRev: draftRev,
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
      })
    }
    void run()
    return requestId
  }

  async settle({ generation, requestId, rawDraft, sourceDraft, currentDraft, currentDraftRev, carrier, remote }) {
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

  async mutateAnchors(method, anchorId, remote = this.remote) {
    if (this.disposed || !remote?.[method]) return false
    this.remote = remote
    if (this.state.hostState === null) {
      await this.hydrate(remote)
      return false
    }
    const request = {
      sessionId: this.sessionId,
      expectedRevision: this.state.hostState.revision,
      ...(anchorId === undefined ? {} : { anchorId }),
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

  pauseAnchor(anchorId, remote) { return this.mutateAnchors('pauseAnchor', anchorId, remote) }
  resumeAnchor(anchorId, remote) { return this.mutateAnchors('resumeAnchor', anchorId, remote) }
  removeAnchor(anchorId, remote) { return this.mutateAnchors('removeAnchor', anchorId, remote) }
  clearAnchors(remote) { return this.mutateAnchors('clearAnchors', undefined, remote) }

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
    if (this.disposed || this.isExtracting) return false
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
