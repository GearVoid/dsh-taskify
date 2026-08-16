import React from 'react'
import { Button, Tooltip, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import { lockLiterals } from '../shared/literal-lock.js'
import { parseSlashDraft } from '../shared/slash.js'
import { estimateDepth } from '../shared/depth.js'
import { extractRecentContext } from '../shared/context.js'
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
  max-width: 132px;
  min-width: max-content;
  white-space: nowrap;
}
.dsh-taskify-label-cancel {
  display: none;
}
.dsh-taskify-button:hover .dsh-taskify-label-normal,
.dsh-taskify-button:focus-visible .dsh-taskify-label-normal {
  display: none;
}
.dsh-taskify-button:hover .dsh-taskify-label-cancel,
.dsh-taskify-button:focus-visible .dsh-taskify-label-cancel {
  display: inline;
}
.dsh-taskify-icon {
  display: inline-block;
  font-size: 14px;
  line-height: 1;
  flex: none;
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
  const subscribe = React.useCallback((listener) => {
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

function iconFor(state, busy) {
  if (busy) return <TaskifyIcon />
  if (state.status === 'applied') return <span aria-hidden="true">↶</span>
  return <TaskifyIcon />
}

function labelFor(state, busy, empty, referenceBlocked) {
  if (busy) return '完善中…'
  if (empty || referenceBlocked) return '完善任务'
  if (state.status === 'applied') return '撤回'
  if (state.status === 'edited') return '再完善'
  if (state.status === 'error') return '重试'
  return '完善任务'
}

function tooltipFor({ busy, empty, unavailable, referenceBlocked, applied, state, remoteReady }) {
  if (busy) return '点击取消本次完善'
  if (empty) return '先输入任务'
  if (unavailable) return '当前输入状态不可完善'
  if (referenceBlocked) return REFERENCE_BLOCKED_NOTICE
  if (!remoteReady) return '任务完善服务尚未就绪'
  if (applied) return '撤回到完善前的原文'
  if (state.status === 'error' && state.error) return state.error.message
  return '把当前任务整理成可执行的任务规格'
}

function TaskifyButton({ sessionId, useSession, useInput, inputActions }) {
  const input = useInput(s => s)
  const session = useSession(s => s)
  const controller = taskifySessionFor(sessionId)
  const state = useTaskifySession(sessionId)
  const liveRef = React.useRef({ draft: '', draftRev: -1 })
  const draft = input?.draft ?? ''
  const draftRev = input?.draftRev ?? -1
  liveRef.current = { draft, draftRev }

  React.useEffect(() => {
    return () => {
      if (sessionId) releaseTaskifySession(sessionId)
    }
  }, [sessionId])

  React.useEffect(() => {
    if (controller) controller.onDraftChanged(draft)
  }, [controller, draft])

  const trimmed = draft.trim()
  const empty = trimmed === ''
  const phase = input?.phase ?? 'plain'
  const unavailable = !input || phase === 'adjudicating' || phase === 'claimed' || phase === 'submitting'
  const occurrences = input?.occurrences ?? []
  const referenceBlocked = isReferenceBlocked(occurrences)
  const busy = state?.status === 'enhancing' && !controller?.disposed
  const applied = state?.status === 'applied' && state.appliedDraft === draft
  const remoteReady = taskifyRemote !== undefined

  const handleClick = () => {
    if (!controller || !inputActions) return
    if (busy) {
      controller.cancel()
      return
    }
    if (empty || unavailable || referenceBlocked) return
    if (!remoteReady) {
      controller.showNotice('任务完善服务尚未就绪，请稍后重试。')
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

    if (applied && controller.canUndo(draft)) {
      controller.undo(draft, text => inputActions.setDraft(text))
      return
    }

    const subject = parsed.kind === 'command' ? parsed.body : draft.trim()
    let lock
    try {
      lock = lockLiterals(subject)
    } catch (error) {
      controller.showNotice(error instanceof Error ? error.message : '任务内容保护处理失败，请重试。')
      controller.emit()
      return
    }

    const context = extractRecentContext(session)
    void estimateDepth(subject)
    controller.start({
      draft,
      draftRev,
      context,
      parsed,
      lock,
      remote: taskifyRemote,
      onApply: text => inputActions.setDraft(text),
      getLiveDraft: () => ({ draft: liveRef.current.draft, draftRev: liveRef.current.draftRev }),
    })
  }

  if (state === null) return null

  const icon = iconFor(state, busy)
  const label = labelFor(state, busy, empty, referenceBlocked)
  const labelContent = busy ? (
    <>
      <span className="dsh-taskify-label-normal">完善中…</span>
      <span className="dsh-taskify-label-cancel">× 取消</span>
    </>
  ) : label
  const tooltip = tooltipFor({ busy, empty, unavailable, referenceBlocked, applied, state, remoteReady })
  const disabled = !busy && (empty || unavailable || referenceBlocked || !remoteReady)

  return (
    <>
      <Tooltip label={tooltip} side="top">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="dsh-taskify-button"
          icon={icon}
          onClick={handleClick}
          disabled={disabled}
          aria-label={label}
        >
          {labelContent}
        </Button>
      </Tooltip>
      {state.notice !== null && (
        <Toast
          key={state.notice.seq}
          text={state.notice.text}
          onDone={() => controller.clearNotice()}
        />
      )}
    </>
  )
}

/** Browser services required before this plugin activates. */
export const inject = ['slots', 'remote']

/** Browser half: mount the Task Compiler Remote namespace and the composer button. */
export async function apply(ctx) {
  installStyles()
  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE_CONTRIBUTION)
  try {
    taskifyRemote = ctx.get('remote.taskify')
    if (taskifyRemote === undefined) {
      throw new Error('taskify Remote namespace was not installed')
    }
    const disposeSlot = ctx.slots.inject('conversation.input.right', () => ctx.slots.register(
      {
        name: 'conversation.input.right',
        id: 'dsh-taskify',
        order: 20,
        label: '完善任务',
      },
      TaskifyButton,
    ))
    return async () => {
      taskifyRemote = undefined
      if (disposeSlot) disposeSlot()
      await disposeRemote()
    }
  } catch (error) {
    taskifyRemote = undefined
    await disposeRemote()
    throw error
  }
}
