import React from 'react'
import { Button, Tooltip, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import { anchorProvenanceForDisplay } from './display.js'
import { lockLiterals } from '../shared/literal-lock.js'
import { parseSlashDraft } from '../shared/slash.js'
import { NOTICE, taskifyAnchorDockModel } from '../shared/task-runner.js'
import { isReferenceBlocked, REFERENCE_BLOCKED_NOTICE } from '../shared/reference.js'
import { TYPERT_REMOTE_CONTRIBUTION } from '../shared/schema.js'
import {
  getTaskifySnapshot,
  releaseTaskifySession,
  subscribeTaskifySession,
  taskifySessionFor,
} from '../shared/session-store.js'

const STYLE_ID = 'dsh-taskify/client.css'
const CSS = `
.dsh-taskify-button {
  max-width: 112px;
  min-width: max-content;
  white-space: nowrap;
}
.dsh-taskify-label-cancel { display: none; }
.dsh-taskify-button:hover .dsh-taskify-label-normal,
.dsh-taskify-button:focus-visible .dsh-taskify-label-normal { display: none; }
.dsh-taskify-button:hover .dsh-taskify-label-cancel,
.dsh-taskify-button:focus-visible .dsh-taskify-label-cancel { display: inline; }
.dsh-taskify-icon {
  display: inline-block;
  font-size: 14px;
  line-height: 1;
  flex: none;
}
.dsh-taskify-dock {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  max-width: var(--dsh-composer-card-max-width, 100%);
  margin-inline: auto;
  padding: 3px 1px;
}
.dsh-taskify-focus-layer,
.dsh-taskify-anchor-layer {
  box-sizing: border-box;
  width: 100%;
}
.dsh-taskify-focus-layer {
  min-height: 26px;
}
.dsh-taskify-focus-current {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 2px 4px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.4;
}
.dsh-taskify-focus-current[data-status="paused"] {
  color: color-mix(in srgb, currentColor 66%, transparent);
}
.dsh-taskify-focus-icon { flex: none; }
.dsh-taskify-focus-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-taskify-focus-status,
.dsh-taskify-pending-status {
  flex: none;
  color: color-mix(in srgb, currentColor 60%, transparent);
  font-size: 11px;
  white-space: nowrap;
}
.dsh-taskify-focus-actions {
  display: inline-flex;
  flex: none;
  gap: 2px;
  margin-inline-start: auto;
  opacity: 0;
  transition: opacity 120ms ease;
}
.dsh-taskify-focus-current:hover .dsh-taskify-focus-actions,
.dsh-taskify-focus-current:focus-within .dsh-taskify-focus-actions {
  opacity: 1;
}
.dsh-taskify-focus-set {
  border: 0;
  background: transparent;
  color: color-mix(in srgb, currentColor 70%, transparent);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  padding: 3px 4px;
}
.dsh-taskify-focus-set:hover,
.dsh-taskify-focus-set:focus-visible {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.dsh-taskify-anchor-layer {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.dsh-taskify-anchor-list {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.dsh-taskify-anchor-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: min(100%, 440px);
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, currentColor 4%, transparent);
  padding: 3px 7px;
  font-size: 12px;
  line-height: 1.25;
  cursor: default;
}
.dsh-taskify-anchor-chip[data-status="paused"] {
  opacity: 0.62;
  border-style: dashed;
}
.dsh-taskify-anchor-chip[data-status="pending"] {
  border-style: dotted;
}
.dsh-taskify-anchor-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-taskify-anchor-paused {
  color: color-mix(in srgb, currentColor 68%, transparent);
  font-size: 11px;
  white-space: nowrap;
}
.dsh-taskify-anchor-actions {
  display: inline-flex;
  gap: 2px;
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-width 140ms ease, opacity 120ms ease;
}
.dsh-taskify-anchor-chip:hover .dsh-taskify-anchor-actions,
.dsh-taskify-anchor-chip:focus-within .dsh-taskify-anchor-actions {
  max-width: 112px;
  opacity: 1;
}
.dsh-taskify-provenance {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 320px;
}
.dsh-taskify-provenance-evidence {
  white-space: pre-wrap;
}
.dsh-taskify-chip-action,
.dsh-taskify-clear {
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  line-height: 1;
  padding: 4px 5px;
}
.dsh-taskify-chip-action:hover,
.dsh-taskify-chip-action:focus-visible,
.dsh-taskify-clear:hover,
.dsh-taskify-clear:focus-visible {
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.dsh-taskify-clear {
  color: color-mix(in srgb, currentColor 64%, transparent);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.25;
  padding: 3px 4px;
}
.dsh-taskify-context-warning {
  color: #b26a00;
  font-size: 12px;
}
.dsh-taskify-focus-editor {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 1px 3px;
}
.dsh-taskify-focus-editor textarea {
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  min-height: 34px;
  resize: vertical;
  border: 1px solid color-mix(in srgb, currentColor 24%, transparent);
  border-radius: 8px;
  outline: none;
  background: color-mix(in srgb, currentColor 3%, transparent);
  color: inherit;
  font: inherit;
  padding: 7px 9px;
}
.dsh-taskify-focus-editor textarea:focus-visible {
  border-color: color-mix(in srgb, currentColor 38%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 7%, transparent);
}
.dsh-taskify-editor-action { flex: none; }
.dsh-taskify-focus-suggestion {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  min-width: 0;
  max-width: 100%;
  padding: 4px;
  font-size: 12px;
}
.dsh-taskify-focus-suggestion-text {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-taskify-focus-suggestion-actions {
  display: inline-flex;
  flex: none;
  flex-shrink: 0;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}
.dsh-taskify-focus-suggestion-actions > * { flex-shrink: 0; }
.dsh-taskify-noop {
  color: color-mix(in srgb, currentColor 68%, transparent);
  font-size: 12px;
  line-height: 1.4;
}
@media (hover: none) {
  .dsh-taskify-focus-actions { opacity: 1; }
  .dsh-taskify-anchor-actions { max-width: 112px; opacity: 1; }
}
`

let taskifyRemote

function installStyles() {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`) !== null) return
  const tag = document.createElement('style')
  tag.setAttribute('data-plugin-css', STYLE_ID)
  tag.textContent = CSS
  document.head.append(tag)
}

function useTaskifySession(sessionId) {
  const subscribe = React.useCallback(listener => {
    if (!sessionId) return () => {}
    return subscribeTaskifySession(sessionId, listener)
  }, [sessionId])
  const getSnapshot = React.useCallback(() => {
    if (!sessionId) return null
    return getTaskifySnapshot(sessionId)
  }, [sessionId])
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function TaskifyIcon() {
  return <span className="dsh-taskify-icon" aria-hidden="true">✨</span>
}

function labelFor(state, busy) {
  if (busy) return '提取中…'
  if (state.status === 'error') return '重试'
  return 'Taskify'
}

function tooltipFor({ busy, empty, unavailable, referenceBlocked, state, remoteReady }) {
  if (busy) return '点击取消本次约束提取'
  if (empty) return '先输入任务'
  if (unavailable) return '当前输入状态不可运行 Taskify'
  if (referenceBlocked) return REFERENCE_BLOCKED_NOTICE
  if (!remoteReady) return 'Taskify 服务尚未就绪'
  if (state.status === 'error' && state.error) return state.error.message
  return '从当前草稿提取明确、可追溯的硬约束'
}

function TaskifyButton({ sessionId, useSession, useInput, inputActions }) {
  const running = useSession(s => s.running)
  const input = useInput(s => s)
  const controller = taskifySessionFor(sessionId)
  const state = useTaskifySession(sessionId)
  const liveRef = React.useRef({ draft: '', draftRev: -1 })
  const draft = input?.draft ?? ''
  const draftRev = input?.draftRev ?? -1
  const phase = input?.phase ?? 'plain'
  const previousPhaseRef = React.useRef(phase)
  const previousRunningRef = React.useRef(running)
  const suppressDraftInvalidationRef = React.useRef(false)
  liveRef.current = { draft, draftRev }

  React.useEffect(() => {
    if (controller && taskifyRemote) void controller.hydrate(taskifyRemote)
  }, [controller, sessionId])

  React.useEffect(() => () => {
    if (sessionId) releaseTaskifySession(sessionId)
  }, [sessionId])

  React.useEffect(() => {
    const phaseChanged = previousPhaseRef.current !== phase
    previousPhaseRef.current = phase
    if (phaseChanged) {
      suppressDraftInvalidationRef.current = true
      queueMicrotask(() => { suppressDraftInvalidationRef.current = false })
    }
  }, [phase, sessionId])

  React.useEffect(() => {
    const turnSettled = previousRunningRef.current === true && running === false
    previousRunningRef.current = running
    if (turnSettled && controller && taskifyRemote) {
      void controller.hydrate(taskifyRemote, { quiet: true, applyPendingFocus: true })
    }
  }, [controller, running, sessionId])

  React.useEffect(() => {
    if (phase !== 'plain' || suppressDraftInvalidationRef.current) return
    if (controller?.onDraftChanged(draft) && taskifyRemote) void controller.invalidate(taskifyRemote)
  }, [controller, draft, phase, sessionId])

  const empty = draft.trim() === ''
  const unavailable = !input || phase === 'adjudicating' || phase === 'claimed' || phase === 'submitting'
  const referenceBlocked = isReferenceBlocked(input?.occurrences ?? [])
  const busy = state?.status === 'extracting' && !controller?.disposed
  const remoteReady = taskifyRemote !== undefined && state?.hostState !== null

  const handleClick = () => {
    if (!controller || !inputActions) return
    if (busy) {
      controller.cancel()
      return
    }
    if (empty || unavailable || referenceBlocked) return
    if (!remoteReady) {
      controller.showNotice('Taskify 服务尚未就绪，请稍后重试。')
      controller.emit()
      return
    }

    const parsed = parseSlashDraft(draft)
    if (parsed.kind === 'empty') return
    if (parsed.kind === 'command-only') {
      controller.showNotice(NOTICE.SLASH_ONLY)
      controller.emit()
      return
    }
    const sourceDraft = parsed.kind === 'command' ? parsed.body : draft.trim()
    let lock
    try {
      lock = lockLiterals(sourceDraft)
    } catch (error) {
      controller.showNotice(error instanceof Error ? error.message : '关键内容保护处理失败，请重试。')
      controller.emit()
      return
    }

    controller.start({
      draft,
      draftRev,
      sourceDraft,
      lock,
      remote: taskifyRemote,
      getLiveDraft: () => ({ ...liveRef.current }),
    })
  }

  if (state === null) return null
  const label = labelFor(state, busy)
  const labelContent = busy ? (
    <>
      <span className="dsh-taskify-label-normal">提取中…</span>
      <span className="dsh-taskify-label-cancel">× 取消</span>
    </>
  ) : label
  const tooltip = tooltipFor({ busy, empty, unavailable, referenceBlocked, state, remoteReady })
  const disabled = !busy && (empty || unavailable || referenceBlocked || !remoteReady)

  return (
    <>
      <Tooltip label={tooltip} side="top">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="dsh-taskify-button"
          icon={<TaskifyIcon />}
          onClick={handleClick}
          disabled={disabled}
          aria-label={label}
        >
          {labelContent}
        </Button>
      </Tooltip>
      {state.notice !== null && (
        <Toast key={state.notice.seq} text={state.notice.text} onDone={() => controller.clearNotice()} />
      )}
    </>
  )
}

function AnchorChip({ anchor, pending = false, mutate }) {
  const provenance = anchorProvenanceForDisplay(anchor)
  const status = pending ? 'pending' : anchor.status
  const chip = (
    <span
      className="dsh-taskify-anchor-chip"
      data-status={status}
      tabIndex={0}
      aria-label={`${anchor.text}；${pending ? '待发送' : anchor.status}`}
    >
      <span aria-hidden="true">🔒</span>
      <span className="dsh-taskify-anchor-text">{anchor.text}</span>
      {!pending && anchor.status === 'paused' && <span className="dsh-taskify-anchor-paused">已暂停</span>}
      {!pending && (
        <span className="dsh-taskify-anchor-actions">
          <button
            type="button"
            className="dsh-taskify-chip-action"
            onClick={() => mutate(anchor.status === 'active' ? 'pauseAnchor' : 'resumeAnchor', anchor.id)}
            aria-label={`${anchor.status === 'active' ? '暂停' : '恢复'} ${anchor.text}`}
          >
            {anchor.status === 'active' ? '暂停' : '恢复'}
          </button>
          <button
            type="button"
            className="dsh-taskify-chip-action"
            onClick={() => mutate('removeAnchor', anchor.id)}
            aria-label={`移除 ${anchor.text}`}
          >
            移除
          </button>
        </span>
      )}
    </span>
  )

  if (provenance === null) return chip
  return (
    <Tooltip
      label={(
        <span className="dsh-taskify-provenance">
          <span>{provenance.title}</span>
          <span className="dsh-taskify-provenance-evidence">“{provenance.evidence}”</span>
        </span>
      )}
      side="top"
    >
      {chip}
    </Tooltip>
  )
}

function TaskifyAnchors({ sessionId, input }) {
  const state = useTaskifySession(sessionId)
  const controller = taskifySessionFor(sessionId)
  const hostState = state?.hostState
  const [editingFocus, setEditingFocus] = React.useState(false)
  const [focusDraft, setFocusDraft] = React.useState('')
  const [editingSuggestion, setEditingSuggestion] = React.useState(false)
  const [suggestionDraft, setSuggestionDraft] = React.useState('')
  React.useEffect(() => {
    setEditingFocus(false)
    setFocusDraft('')
    setEditingSuggestion(false)
    setSuggestionDraft('')
  }, [sessionId])
  if (!state || !hostState) return null
  const { focus, persistent, pending, noop } = taskifyAnchorDockModel(hostState, input?.draft)
  const pendingAcceptance = focus === null ? state.pendingFocusAcceptance : null
  const suggestion = focus === null && pendingAcceptance === null ? state.focusSuggestion : null

  const mutate = (method, anchorId) => {
    if (!controller || !taskifyRemote) return
    void controller[method](anchorId, taskifyRemote)
  }

  const beginFocus = () => {
    setFocusDraft(focus?.text ?? '')
    setEditingFocus(true)
  }
  const saveFocus = async () => {
    if (!controller || !taskifyRemote || focusDraft.trim() === '') return
    const ok = focus === null
      ? await controller.setFocus(focusDraft, taskifyRemote)
      : await controller.editFocus(focusDraft, taskifyRemote)
    if (ok) setEditingFocus(false)
  }
  const acceptSuggestion = async () => {
    const text = editingSuggestion ? suggestionDraft : suggestion
    if (!controller || typeof text !== 'string' || text.trim() === '') return
    if (!taskifyRemote) {
      controller.showNotice('Taskify Focus 服务尚未就绪。')
      controller.emit()
      return
    }
    const ok = await controller.acceptFocusSuggestion(text, taskifyRemote)
    if (ok) setEditingSuggestion(false)
  }
  const editSuggestion = () => {
    setSuggestionDraft(suggestion ?? '')
    setEditingSuggestion(true)
  }
  const ignoreSuggestion = () => {
    setEditingSuggestion(false)
    controller?.ignoreFocusSuggestion()
  }

  return (
    <div className="dsh-taskify-dock" aria-label="Taskify Session 约束">
      <div className="dsh-taskify-focus-layer" aria-label="Focus">
        {pendingAcceptance !== null && (
          <div className="dsh-taskify-focus-suggestion" data-status={pendingAcceptance.status}>
            <span className="dsh-taskify-focus-suggestion-text">
              🎯 Focus: {pendingAcceptance.text} · {pendingAcceptance.status === 'applying'
                ? '正在启用…'
                : pendingAcceptance.status === 'error'
                  ? `启用失败：${pendingAcceptance.error}`
                  : '待发送后启用'}
            </span>
            <span className="dsh-taskify-focus-suggestion-actions">
              {pendingAcceptance.status === 'error' && (
                <button type="button" className="dsh-taskify-chip-action" onClick={() => void controller?.retryPendingFocusAcceptance(taskifyRemote)}>
                  重试
                </button>
              )}
              {pendingAcceptance.status !== 'applying' && (
                <button type="button" className="dsh-taskify-chip-action" onClick={() => controller?.clearPendingFocusAcceptance()}>
                  取消
                </button>
              )}
            </span>
          </div>
        )}
        {suggestion !== null && (editingSuggestion ? (
          <div className="dsh-taskify-focus-editor">
            <textarea
              value={suggestionDraft}
              maxLength={400}
              rows={1}
              autoFocus
              onChange={event => setSuggestionDraft(event.target.value)}
              aria-label="编辑建议 Focus"
            />
            <span className="dsh-taskify-focus-suggestion-actions">
              <Button type="button" variant="ghost" size="sm" className="dsh-taskify-editor-action" disabled={suggestionDraft.trim() === ''} onClick={() => void acceptSuggestion()}>
                设为 Focus
              </Button>
              <Button type="button" variant="ghost" size="sm" className="dsh-taskify-editor-action" onClick={() => setEditingSuggestion(false)}>取消</Button>
              <Button type="button" variant="ghost" size="sm" className="dsh-taskify-editor-action" onClick={ignoreSuggestion}>忽略</Button>
            </span>
          </div>
        ) : (
          <div className="dsh-taskify-focus-suggestion">
            <span className="dsh-taskify-focus-suggestion-text">🎯 建议 Focus: {suggestion}</span>
            <span className="dsh-taskify-focus-suggestion-actions">
              <button type="button" className="dsh-taskify-chip-action" onClick={() => void acceptSuggestion()}>设为 Focus</button>
              <button type="button" className="dsh-taskify-chip-action" onClick={editSuggestion}>编辑</button>
              <button type="button" className="dsh-taskify-chip-action" onClick={ignoreSuggestion}>忽略</button>
            </span>
          </div>
        ))}
        {editingFocus ? (
          <div className="dsh-taskify-focus-editor">
            <textarea
              value={focusDraft}
              maxLength={2000}
              rows={1}
              autoFocus
              onChange={event => setFocusDraft(event.target.value)}
              aria-label="Focus 内容"
            />
            <Button type="button" variant="ghost" size="sm" className="dsh-taskify-editor-action" disabled={focusDraft.trim() === ''} onClick={() => void saveFocus()}>
              保存
            </Button>
            <Button type="button" variant="ghost" size="sm" className="dsh-taskify-editor-action" onClick={() => setEditingFocus(false)}>
              取消
            </Button>
          </div>
        ) : focus === null && suggestion === null && pendingAcceptance === null ? (
          <button type="button" className="dsh-taskify-focus-set" onClick={beginFocus}>🎯 设置 Focus</button>
        ) : focus !== null ? (
          <div className="dsh-taskify-focus-current" data-status={focus.status}>
            <span className="dsh-taskify-focus-icon" aria-hidden="true">🎯</span>
            <span className="dsh-taskify-focus-text">{focus.text}</span>
            {focus.status === 'paused' && <span className="dsh-taskify-focus-status">已暂停</span>}
            <span className="dsh-taskify-focus-actions">
              <button type="button" className="dsh-taskify-chip-action" onClick={beginFocus} aria-label="编辑 Focus">编辑</button>
              <button
                type="button"
                className="dsh-taskify-chip-action"
                onClick={() => void controller?.[focus.status === 'active' ? 'pauseFocus' : 'resumeFocus'](taskifyRemote)}
                aria-label={`${focus.status === 'active' ? '暂停' : '恢复'} Focus`}
              >
                {focus.status === 'active' ? '暂停' : '恢复'}
              </button>
              <button type="button" className="dsh-taskify-chip-action" onClick={() => void controller?.clearFocus(taskifyRemote)} aria-label="清除 Focus">
                清除
              </button>
            </span>
          </div>
        ) : null}
      </div>
      {(persistent.length > 0 || pending.length > 0 || noop) && (
        <div className="dsh-taskify-anchor-layer" aria-label="Anchors">
          <div className="dsh-taskify-anchor-list">
            {persistent.map(({ key, anchor }) => (
              <AnchorChip key={key} anchor={anchor} mutate={mutate} />
            ))}
            {pending.map(({ key, anchor }) => (
              <AnchorChip key={key} anchor={anchor} pending mutate={mutate} />
            ))}
            {pending.length > 0 && <span className="dsh-taskify-pending-status">· 待发送</span>}
            {persistent.length > 0 && (
              <button type="button" className="dsh-taskify-clear" onClick={() => void controller?.clearAnchors(taskifyRemote)}>
                清除全部
              </button>
            )}
            {noop && <span className="dsh-taskify-noop">✓ 未发现需要额外锚定的约束</span>}
          </div>
        </div>
      )}
      {(persistent.length > 0 || focus !== null) && hostState.runtimeContext.available === false && (
        <span className="dsh-taskify-context-warning">⚠ 当前跨轮指导不可用</span>
      )}
    </div>
  )
}

/** Browser services required before this plugin activates. */
export const inject = ['slots', 'remote']

/** Mount the Remote namespace, read-only chip dock, and composer action. */
export async function apply(ctx) {
  installStyles()
  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE_CONTRIBUTION)
  try {
    taskifyRemote = ctx.get('remote.taskify')
    if (taskifyRemote === undefined) throw new Error('taskify Remote namespace was not installed')

    const disposeDock = ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
      name: 'conversation.input.dock',
      id: 'dsh-taskify-anchors',
      order: 10,
      label: 'Taskify 约束',
    }, TaskifyAnchors))
    const disposeButton = ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
      name: 'conversation.input.right',
      id: 'dsh-taskify',
      order: 20,
      label: 'Taskify',
    }, TaskifyButton))

    return async () => {
      taskifyRemote = undefined
      if (disposeButton) disposeButton()
      if (disposeDock) disposeDock()
      await disposeRemote()
    }
  } catch (error) {
    taskifyRemote = undefined
    await disposeRemote()
    throw error
  }
}
