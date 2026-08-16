/**
 * Session-scoped Taskify request orchestration. Pure of React and DOM; the
 * client slot owns rendering and `inputActions.setDraft`, this class owns
 * request identity, cancellation, race checks, undo checkpoints and errors.
 */

import { validateAndUnlock, MAX_RESULT_CHARS } from './literal-lock.js'
import { buildFinalDraft } from './slash.js'

export const NOTICE = Object.freeze({
  SLASH_ONLY: '命令本身无需完善',
  REFERENCE_UNSUPPORTED: '当前草稿包含引用内容，为避免破坏引用关系，本版本暂不支持完善。',
  DRAFT_CHANGED: '草稿已发生变化，本次增强结果未应用。',
  LITERAL_VALIDATION_FAILED: '增强结果未通过关键内容保护校验，原始草稿未修改。',
  TIMEOUT: '任务完善超时，请重试。',
  RESULT_TOO_LONG: '增强结果超过长度上限，原始草稿未修改。',
  EMPTY_RESULT: '模型未返回可用内容，原始草稿未修改。',
  BUSY: '当前任务正在完善中，请先取消或等待完成。',
})

function cloneState(state) {
  return {
    ...state,
    error: state.error === null ? null : { ...state.error },
    notice: state.notice === null ? null : { ...state.notice },
  }
}

function requestIdOf(sessionId, generation, seq) {
  return `dsh-taskify:${sessionId}:${generation}:${seq}`
}

export class TaskifySession {
  constructor(sessionId) {
    this.sessionId = sessionId
    this.listeners = new Set()
    this.generation = 0
    this.seq = 0
    this.disposed = false
    this.abortController = null
    this.state = {
      status: 'ready',
      requestId: null,
      originalDraft: null,
      appliedDraft: null,
      requestStartDraft: null,
      requestStartDraftRev: null,
      error: null,
      notice: null,
      noticeSeq: 0,
    }
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getSnapshot() {
    return this.state
  }

  emit() {
    const snapshot = cloneState(this.state)
    this.state = snapshot
    for (const listener of [...this.listeners]) {
      try { listener() } catch { /* a broken UI observer must not break the request */ }
    }
    return snapshot
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

  get isEnhancing() {
    return this.state.status === 'enhancing' && !this.disposed
  }

  start({ draft, draftRev, context, parsed, lock, remote, onApply, getLiveDraft }) {
    if (this.disposed) return null
    if (typeof draft !== 'string' || draft.trim() === '' || (parsed && parsed.kind === 'empty')) return null
    if (this.isEnhancing) {
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
    this.state = {
      status: 'enhancing',
      requestId,
      originalDraft: null,
      appliedDraft: null,
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
        carrier = await remote.compile(
          {
            requestId,
            sessionId: this.sessionId,
            draft: lock.text,
            context: context || '',
          },
          abortController.signal,
        )
      } catch (error) {
        if (generation !== this.generation || this.disposed) return
        this.fail({ code: 'remote-error', message: error instanceof Error ? error.message : String(error) })
        return
      }
      const live = typeof getLiveDraft === 'function' ? getLiveDraft() : { draft, draftRev }
      this.settle({
        generation,
        requestId,
        parsed,
        rawDraft: draft,
        currentDraft: live.draft,
        currentDraftRev: live.draftRev,
        carrier,
        lock,
        onApply,
      })
    }
    void run()
    return requestId
  }

  settle({ generation, requestId, parsed, rawDraft, currentDraft, currentDraftRev, carrier, lock, onApply }) {
    if (this.disposed || generation !== this.generation || this.state.requestId !== requestId || this.state.status !== 'enhancing') return

    if (currentDraft !== this.state.requestStartDraft || currentDraftRev !== this.state.requestStartDraftRev) {
      this.fail({ code: 'draft-changed', message: NOTICE.DRAFT_CHANGED })
      return
    }

    if (!carrier || carrier.ok === false) {
      this.fail({
        code: carrier?.error?.code ?? 'remote-error',
        message: carrier?.error?.message || '任务完善失败，请重试。',
      })
      return
    }

    const value = carrier.value
    if (!value || value.requestId !== requestId) {
      this.fail({ code: 'bad-response', message: '任务完善服务返回了无效响应。' })
      return
    }
    if (value.ok === false) {
      this.fail({
        code: value.error?.code ?? 'remote-error',
        message: value.error?.message || '任务完善失败，请重试。',
      })
      return
    }
    if (value.ok !== true || typeof value.text !== 'string') {
      this.fail({ code: 'bad-response', message: '任务完善服务返回了无效响应。' })
      return
    }

    const restored = validateAndUnlock(value.text, lock)
    if (!restored.ok) {
      this.fail({ code: 'literal-validation-failed', message: NOTICE.LITERAL_VALIDATION_FAILED })
      return
    }

    const finalDraft = buildFinalDraft(parsed, restored.text, rawDraft)
    if (finalDraft.length > MAX_RESULT_CHARS) {
      this.fail({ code: 'result-too-long', message: NOTICE.RESULT_TOO_LONG })
      return
    }

    try {
      onApply(finalDraft)
    } catch (error) {
      this.fail({ code: 'apply-failed', message: error instanceof Error ? error.message : String(error) })
      return
    }

    this.state = {
      status: 'applied',
      requestId: null,
      originalDraft: rawDraft,
      appliedDraft: finalDraft,
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
    this.showNotice(error.message || '任务完善失败，请重试。')
    this.state = {
      ...this.state,
      status: 'error',
      requestId: null,
      originalDraft: null,
      appliedDraft: null,
      error: { code: error.code || 'unknown', message: error.message || '任务完善失败，请重试。' },
    }
    this.abortController = null
    this.emit()
  }

  cancel() {
    if (this.disposed || !this.isEnhancing) return
    this.generation += 1
    if (this.abortController) this.abortController.abort()
    this.abortController = null
    this.state = {
      status: 'ready',
      requestId: null,
      originalDraft: null,
      appliedDraft: null,
      requestStartDraft: null,
      requestStartDraftRev: null,
      error: null,
      notice: null,
      noticeSeq: this.state.noticeSeq,
    }
    this.emit()
  }

  canUndo(currentDraft) {
    return this.state.status === 'applied' && typeof currentDraft === 'string'
      && this.state.appliedDraft === currentDraft
      && this.state.originalDraft !== null
  }

  undo(currentDraft, onApply) {
    if (!this.canUndo(currentDraft)) return false
    const originalDraft = this.state.originalDraft
    onApply(originalDraft)
    this.state = {
      status: 'ready',
      requestId: null,
      originalDraft: null,
      appliedDraft: null,
      requestStartDraft: null,
      requestStartDraftRev: null,
      error: null,
      notice: null,
      noticeSeq: this.state.noticeSeq,
    }
    this.emit()
    return true
  }

  onDraftChanged(currentDraft) {
    if (this.disposed) return
    if (this.state.status === 'enhancing') return
    if (this.state.status === 'applied' && currentDraft !== this.state.appliedDraft) {
      this.state = {
        ...this.state,
        status: 'edited',
        originalDraft: null,
        appliedDraft: null,
        requestStartDraft: null,
        requestStartDraftRev: null,
        error: null,
        notice: null,
      }
      this.emit()
      return
    }
    if (this.state.status === 'error' && currentDraft !== this.state.requestStartDraft) {
      this.state = {
        ...this.state,
        status: 'ready',
        originalDraft: null,
        appliedDraft: null,
        requestStartDraft: null,
        requestStartDraftRev: null,
        error: null,
        notice: null,
      }
      this.emit()
    }
  }

  destroy() {
    if (this.disposed) return
    this.disposed = true
    this.generation += 1
    if (this.abortController) this.abortController.abort()
    this.abortController = null
    this.listeners.clear()
  }
}
