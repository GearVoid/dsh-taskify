import React from 'react'
import { Button, Tooltip, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
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
.dsh-taskify-anchors {
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  width: 100%;
  max-width: var(--dsh-composer-card-max-width, 100%);
  margin-inline: auto;
  padding: 2px 0;
}
.dsh-taskify-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: min(100%, 440px);
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 6%, transparent);
  padding: 4px 9px;
  font-size: 12px;
  line-height: 1.25;
  cursor: default;
}
.dsh-taskify-chip[data-status="paused"] {
  opacity: 0.62;
  border-style: dashed;
}
.dsh-taskify-chip[data-status="pending"] {
  border-style: dotted;
}
.dsh-taskify-chip-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-taskify-chip-pending {
  color: color-mix(in srgb, currentColor 68%, transparent);
  font-size: 11px;
  white-space: nowrap;
}
.dsh-taskify-chip-action,
.dsh-taskify-clear {
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 9%, transparent);
  color: inherit;
  cursor: pointer;
  font: inherit;
  line-height: 1;
  padding: 3px 5px;
}
.dsh-taskify-chip-action:hover,
.dsh-taskify-chip-action:focus-visible,
.dsh-taskify-clear:hover,
.dsh-taskify-clear:focus-visible {
  background: color-mix(in srgb, currentColor 16%, transparent);
}
.dsh-taskify-context-warning {
  color: #b26a00;
  font-size: 12px;
}
.dsh-taskify-noop {
  color: color-mix(in srgb, currentColor 68%, transparent);
  font-size: 12px;
  line-height: 1.4;
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
    if (turnSettled && controller && taskifyRemote) void controller.hydrate(taskifyRemote, { quiet: true })
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

function TaskifyAnchors({ sessionId, input }) {
  const state = useTaskifySession(sessionId)
  const controller = taskifySessionFor(sessionId)
  const hostState = state?.hostState
  if (!state || !hostState) return null
  const { persistent, pending, noop } = taskifyAnchorDockModel(hostState, input?.draft)
  if (persistent.length === 0 && pending.length === 0 && !noop) return null

  const mutate = (method, anchorId) => {
    if (!controller || !taskifyRemote) return
    void controller[method](anchorId, taskifyRemote)
  }

  return (
    <div className="dsh-taskify-anchors" aria-label="Taskify Session 约束">
      {persistent.map(({ key, anchor }) => (
        <Tooltip
          key={key}
          label={`来源：“${anchor.evidence}” · Scope: Session · Status: ${anchor.status === 'active' ? 'Active' : 'Paused'}`}
          side="top"
        >
          <span className="dsh-taskify-chip" data-status={anchor.status} tabIndex={0} aria-label={`${anchor.text}；${anchor.status}`}>
            <span aria-hidden="true">🔒</span>
            <span className="dsh-taskify-chip-text">{anchor.text}</span>
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
        </Tooltip>
      ))}
      {pending.map(({ key, anchor }) => (
        <Tooltip
          key={key}
          label={`来源：“${anchor.evidence}” · Scope: Session · Status: Pending activation`}
          side="top"
        >
          <span className="dsh-taskify-chip" data-status="pending" tabIndex={0} aria-label={`${anchor.text}；待发送激活`}>
            <span aria-hidden="true">🔒</span>
            <span className="dsh-taskify-chip-text">{anchor.text}</span>
            <span className="dsh-taskify-chip-pending">待发送激活</span>
          </span>
        </Tooltip>
      ))}
      {persistent.length > 0 && (
        <button type="button" className="dsh-taskify-clear" onClick={() => void controller?.clearAnchors(taskifyRemote)}>
          清除全部
        </button>
      )}
      {persistent.length > 0 && hostState.runtimeContext.available === false && (
        <span className="dsh-taskify-context-warning">⚠ 当前跨轮指导不可用</span>
      )}
      {noop && <span className="dsh-taskify-noop">✓ 未发现需要额外锚定的约束</span>}
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
