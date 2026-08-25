/** Session-scoped extraction orchestration, independent of React and DOM. */

export const NOTICE = Object.freeze({
  SLASH_ONLY: '命令本身没有可提取的任务约束',
  DRAFT_CHANGED: '草稿已发生变化，本次 Anchor 结果已丢弃。',
  TIMEOUT: 'Taskify 超时，请重试。',
  EMPTY_RESULT: '模型未返回可用内容。',
  BUSY: 'Taskify 正在提取约束，请先取消或等待完成。',
})

function cloneState(state) {
  return {
    ...state,
    anchors: state.anchors.map(anchor => ({ ...anchor })),
    error: state.error === null ? null : { ...state.error },
    notice: state.notice === null ? null : { ...state.notice },
  }
}

function readyState(noticeSeq) {
  return {
    status: 'ready',
    requestId: null,
    anchors: [],
    anchoredDraft: null,
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

export class TaskifySession {
  constructor(sessionId) {
    this.sessionId = sessionId
    this.listeners = new Set()
    this.generation = 0
    this.seq = 0
    this.disposed = false
    this.abortController = null
    this.invalidateActive = null
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

  start({ draft, draftRev, sourceDraft, lock, remote, getLiveDraft, onInvalidate }) {
    if (this.disposed || typeof draft !== 'string' || draft.trim() === '' || !sourceDraft) return null
    if (this.isExtracting) {
      this.showNotice(NOTICE.BUSY)
      this.emit()
      return null
    }

    this.generation += 1
    this.seq += 1
    const generation = this.generation
    const requestId = requestIdOf(this.sessionId, generation, this.seq)
    const abortController = new AbortController()
    this.abortController = abortController
    this.invalidateActive = typeof onInvalidate === 'function' ? onInvalidate : null
    this.state = {
      status: 'extracting',
      requestId,
      anchors: [],
      anchoredDraft: null,
      requestStartDraft: draft,
      requestStartDraftRev: draftRev,
      error: null,
      notice: null,
      noticeSeq: this.state.noticeSeq,
    }
    this.emit()

    const run = async () => {
      let carrier
      try {
        carrier = await remote.compile({
          requestId,
          sessionId: this.sessionId,
          rawDraft: draft,
          sourceDraft,
          draft: lock.text,
          nonce: lock.nonce,
          literals: lock.locks,
        }, abortController.signal)
      } catch (error) {
        if (generation !== this.generation || this.disposed) return
        this.fail({ code: 'remote-error', message: error instanceof Error ? error.message : String(error) })
        return
      }
      const live = typeof getLiveDraft === 'function' ? getLiveDraft() : { draft, draftRev }
      this.settle({ generation, requestId, rawDraft: draft, sourceDraft, currentDraft: live.draft, currentDraftRev: live.draftRev, carrier })
    }
    void run()
    return requestId
  }

  settle({ generation, requestId, rawDraft, sourceDraft, currentDraft, currentDraftRev, carrier }) {
    if (this.disposed || generation !== this.generation || this.state.requestId !== requestId || !this.isExtracting) return
    if (currentDraft !== this.state.requestStartDraft || currentDraftRev !== this.state.requestStartDraftRev) {
      this.fail({ code: 'draft-changed', message: NOTICE.DRAFT_CHANGED })
      return
    }
    if (!carrier || carrier.ok === false) {
      this.fail({ code: carrier?.error?.code ?? 'remote-error', message: carrier?.error?.message || 'Taskify 失败，请重试。' })
      return
    }
    const value = carrier.value
    if (!value || value.requestId !== requestId) {
      this.fail({ code: 'bad-response', message: 'Taskify 服务返回了无效响应。' })
      return
    }
    if (value.ok === false) {
      this.fail({ code: value.error?.code ?? 'remote-error', message: value.error?.message || 'Taskify 失败，请重试。' })
      return
    }
    if (value.ok !== true || !validAnchors(value.anchors, sourceDraft)) {
      this.fail({ code: 'bad-response', message: 'Taskify 服务返回了无效 Anchor。' })
      return
    }

    this.state = {
      status: value.anchors.length === 0 ? 'noop' : 'anchored',
      requestId: null,
      anchors: value.anchors,
      anchoredDraft: rawDraft,
      requestStartDraft: null,
      requestStartDraftRev: null,
      error: null,
      notice: null,
      noticeSeq: this.state.noticeSeq,
    }
    this.abortController = null
    this.emit()
  }

  fail(error) {
    if (this.disposed) return
    void this.invalidateActive?.()
    this.showNotice(error.message || 'Taskify 失败，请重试。')
    this.state = {
      ...this.state,
      status: 'error',
      requestId: null,
      anchors: [],
      anchoredDraft: null,
      error: { code: error.code || 'unknown', message: error.message || 'Taskify 失败，请重试。' },
    }
    this.abortController = null
    this.emit()
  }

  cancel() {
    if (this.disposed || !this.isExtracting) return
    this.generation += 1
    if (this.abortController) this.abortController.abort()
    void this.invalidateActive?.()
    this.abortController = null
    this.state = readyState(this.state.noticeSeq)
    this.emit()
  }

  /** @returns true when previously displayed anchors were invalidated. */
  onDraftChanged(currentDraft) {
    if (this.disposed || this.isExtracting) return false
    if ((this.state.status === 'anchored' || this.state.status === 'noop') && currentDraft !== this.state.anchoredDraft) {
      this.state = readyState(this.state.noticeSeq)
      this.emit()
      return true
    }
    if (this.state.status === 'error' && currentDraft !== this.state.requestStartDraft) {
      this.state = readyState(this.state.noticeSeq)
      this.emit()
    }
    return false
  }

  destroy() {
    if (this.disposed) return
    this.disposed = true
    this.generation += 1
    if (this.abortController) this.abortController.abort()
    void this.invalidateActive?.()
    this.abortController = null
    this.listeners.clear()
  }
}
