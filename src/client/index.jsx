import React from 'react'
import { Button, Tooltip, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import { lockLiterals } from '../shared/literal-lock.js'
import { parseSlashDraft } from '../shared/slash.js'
import { NOTICE } from '../shared/task-runner.js'
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
.dsh-taskify-chip-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

function invalidateRemote(sessionId) {
  if (!taskifyRemote || !sessionId) return Promise.resolve()
  return taskifyRemote.invalidate({ sessionId }).catch(() => undefined)
}

function TaskifyButton({ sessionId, useInput, inputActions }) {
  const input = useInput(s => s)
  const controller = taskifySessionFor(sessionId)
  const state = useTaskifySession(sessionId)
  const liveRef = React.useRef({ draft: '', draftRev: -1 })
  const draft = input?.draft ?? ''
  const draftRev = input?.draftRev ?? -1
  liveRef.current = { draft, draftRev }

  React.useEffect(() => () => {
    if (sessionId) releaseTaskifySession(sessionId)
  }, [sessionId])

  React.useEffect(() => {
    if (controller?.onDraftChanged(draft)) void invalidateRemote(sessionId)
  }, [controller, draft, sessionId])

  const empty = draft.trim() === ''
  const phase = input?.phase ?? 'plain'
  const unavailable = !input || phase === 'adjudicating' || phase === 'claimed' || phase === 'submitting'
  const referenceBlocked = isReferenceBlocked(input?.occurrences ?? [])
  const busy = state?.status === 'extracting' && !controller?.disposed
  const remoteReady = taskifyRemote !== undefined

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
      onInvalidate: () => invalidateRemote(sessionId),
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
  if (!state || state.anchoredDraft !== input?.draft) return null
  if (state.status === 'noop') {
    return <div className="dsh-taskify-anchors"><span className="dsh-taskify-noop">✓ 未发现需要额外锚定的约束</span></div>
  }
  if (state.status !== 'anchored' || state.anchors.length === 0) return null
  return (
    <div className="dsh-taskify-anchors" aria-label="Taskify 只读约束">
      {state.anchors.map((anchor, index) => (
        <Tooltip key={`${anchor.text}:${index}`} label={`来源：“${anchor.evidence}”`} side="top">
          <span className="dsh-taskify-chip" tabIndex={0} aria-label={`${anchor.text}；来源：${anchor.evidence}`}>
            <span aria-hidden="true">🔒</span>
            <span className="dsh-taskify-chip-text">{anchor.text}</span>
          </span>
        </Tooltip>
      ))}
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
