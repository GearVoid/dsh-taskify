/**
 * DSH Taskify Host: replayable activation/control carriers plus persistent
 * exact-session runtime guidance owned by explicit user lifecycle actions.
 */

import { Service } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { bindTypertRemote } from '@deepseek-ai/dsh-typert-protocol'
import {
  buildCompilerUserPayload,
  buildConstraintContract,
  COMPILER_MAX_TOKENS,
  COMPILER_SYSTEM_PROMPT,
  COMPILER_TEMPERATURE,
  COMPILER_TIMEOUT_MS,
  parseCompilerOutput,
} from '../shared/compiler.js'
import { MAX_RESULT_CHARS } from '../shared/literal-lock.js'
import {
  buildLifecycleNotice,
  mergePersistentAnchors,
  renderTaskifyRuntimeContext,
} from '../shared/lifecycle.js'
import { checkpointDurability, rebuildTaskifyState } from '../shared/projection.js'
import { TYPERT_CONTRIBUTION } from '../shared/schema.js'
import {
  createTaskifyActivationSource,
  createTaskifyStateUpdateSource,
  inspectTaskifyUserMessage,
} from '../shared/source.js'
import { TaskifyStateProjection } from '../shared/state.js'

const PLUGIN_NAME = 'dsh-taskify'

function messageOf(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback
}

function combinedSignal(external, timeoutController) {
  if (!external) return timeoutController.signal
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([external, timeoutController.signal])
  const controller = new AbortController()
  const abort = () => controller.abort()
  external.addEventListener('abort', abort, { once: true })
  timeoutController.signal.addEventListener('abort', abort, { once: true })
  return controller.signal
}

function textOfHumanMessage(message) {
  if (!message || message.role !== 'user' || message.source?.kind !== 'user' || !Array.isArray(message.content)) return undefined
  return message.content
    .filter(block => block?.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n')
}

function revisionConflict(state) {
  return {
    code: 'revision-conflict',
    message: `Taskify 状态已更新（当前 revision ${state.revision}），请重新读取后再试。`,
  }
}

function compileConflict(requestId, state) {
  return { ok: false, requestId, error: revisionConflict(state), state }
}

function carrierMatches(current, inspected) {
  const carrier = current.request.bundle?.carrier
  return carrier !== null && carrier !== undefined
    && carrier.messageId === inspected.message.id
    && carrier.bundleId === inspected.source.bundleId
    && carrier.requestId === inspected.source.requestId
    && inspected.source.recordType === 'activation'
    && inspected.source.armedRevision === current.revision
}

function isPending(agent, messageId) {
  return [...(agent?.inbox?.nextTurn ?? []), ...(agent?.inbox?.nextStep ?? [])]
    .some(message => message?.id === messageId)
}

function liveAgentOf(ctx, sessionId) {
  try {
    return ctx?.agents?.get?.(sessionId)
  } catch {
    return undefined
  }
}

async function injectOrClassifyCommit(agent, message) {
  if (!agent || typeof agent.inject !== 'function') {
    return { committed: false, status: 'unavailable', error: new Error('当前 session 没有可用的 live Agent injection seam。') }
  }
  try {
    agent.inject(message)
    return { committed: true }
  } catch (error) {
    return isPending(agent, message.id)
      ? { committed: true, injectionError: error }
      : { committed: false, status: 'failed', error }
  }
}

/** Validate activation binding; lifecycle snapshots enter as superseding notices. */
export async function bindTaskifyInboxMessages(stateProjection, ctx, payload, next, hooks = {}) {
  const decision = await next()
  if (decision?.kind !== 'enter' || payload?.signal?.aborted === true) return decision
  const sessionId = payload?.agent?.id
  if (typeof sessionId !== 'string' || sessionId === '') return decision

  const current = stateProjection.getState(sessionId)
  const humanDrafts = new Set(decision.messages.map(textOfHumanMessage).filter(value => value !== undefined))
  let matchedMessage
  let requeue
  const messages = []

  for (const message of decision.messages) {
    const inspected = inspectTaskifyUserMessage(message, sessionId)
    if (inspected.kind === 'unrelated') {
      messages.push(message)
      continue
    }
    if (inspected.kind !== 'valid') continue
    if (inspected.source.recordType === 'state-update') {
      messages.push(message)
      continue
    }
    if (current.request.phase !== 'armed' || !carrierMatches(current, inspected)) continue

    const binds = inspected.source.binding.acceptedDrafts.some(draft => humanDrafts.has(draft))
    if (binds) {
      matchedMessage = message
      messages.push(message)
    } else {
      requeue = message
    }
  }

  if (matchedMessage !== undefined) {
    stateProjection.update(sessionId, current.revision, {
      type: 'activate',
      requestId: current.request.bundle.requestId,
      bundleId: current.request.bundle.carrier.bundleId,
      durabilityStatus: 'unavailable',
    })
    hooks.suppressNextContext?.(sessionId, current.request.bundle.anchors)
  }
  if (requeue !== undefined && matchedMessage === undefined) {
    const result = await injectOrClassifyCommit(payload.agent, requeue)
    let status = result.status
    if (result.committed) status = (await checkpointDurability(ctx, payload.agent.session)).status
    if (status !== undefined) stateProjection.observeDurability(sessionId, current.revision, status)
  }

  return messages.length === decision.messages.length ? decision : { kind: 'enter', messages }
}

// Keep the STEP 1 export signature for downstream compatibility.
export function injectActiveConstraints(stateProjection, payload, next) {
  return bindTaskifyInboxMessages(stateProjection, {}, payload, next)
}

export class TaskifyService extends Service {
  static inject = ['llm', 'agentDefaultModel', 'agents', 'sessions', 'typert']

  constructor(ctx) {
    super(ctx, 'taskify')
    this.stateProjection = new TaskifyStateProjection()
    this.dirtySessions = new Set()
    this.bindingSessions = new Set()
    this.contextRegistrations = new Map()
    this.contextSuppressions = new Map()
    this.typertRemote = bindTypertRemote(this, 'taskify')
    ctx.typert.register(TYPERT_CONTRIBUTION)

    ctx.on('agent/created', ({ agent }) => {
      this.hydrateAgent(agent)
      this.installRuntimeContext(agent)
    })
    ctx.on('agent/session-start', ({ agent }) => {
      this.hydrateAgent(agent)
      this.installRuntimeContext(agent)
    })
    ctx.on('agent/disposed', ({ agent }) => this.uninstallRuntimeContext(agent))
    ctx.on('session/event', (session, event) => {
      if (event?.type === 'agent/inbox/spliced' || event?.type === 'user/message') {
        this.dirtySessions.add(String(session.id))
      }
    })
    ctx.on('agent/pre-step', (payload, next) => this.bindPreStep(payload, next))

    for (const agent of ctx.agents.list?.() ?? []) {
      this.hydrateAgent(agent)
      this.installRuntimeContext(agent)
    }
  }

  liveAgent(sessionId) {
    return liveAgentOf(this.ctx, sessionId)
  }

  async bindPreStep(payload, next) {
    const sessionId = payload?.agent?.id
    if (typeof sessionId === 'string' && sessionId !== '') this.bindingSessions.add(sessionId)
    try {
      return await bindTaskifyInboxMessages(this.stateProjection, this.ctx, payload, next, {
        suppressNextContext: (exactSessionId, anchors) => {
          this.contextSuppressions.set(exactSessionId, anchors.map(anchor => ({ ...anchor })))
        },
      })
    } finally {
      if (typeof sessionId === 'string' && sessionId !== '') this.bindingSessions.delete(sessionId)
    }
  }

  installRuntimeContext(agent) {
    const sessionId = agent?.id
    if (typeof sessionId !== 'string' || sessionId === '') return false
    const existing = this.contextRegistrations.get(sessionId)
    if (existing?.agent === agent) {
      this.stateProjection.observeRuntimeContext(sessionId, this.stateProjection.getState(sessionId).revision, true)
      return true
    }
    if (existing) {
      try { existing.dispose() } catch { /* A stale Agent scope may already be disposed. */ }
      this.contextRegistrations.delete(sessionId)
    }
    try {
      if (typeof agent.ctx?.systemPrompt?.context !== 'function') throw new Error('runtime context service unavailable')
      const dispose = agent.ctx.systemPrompt.context({
        name: 'dsh-taskify:current-constraints',
        order: 50,
        text: () => {
          const state = this.refreshState(sessionId)
          const excludeAnchors = state.request.phase === 'armed'
            ? state.request.bundle.anchors
            : this.contextSuppressions.get(sessionId) ?? []
          this.contextSuppressions.delete(sessionId)
          return renderTaskifyRuntimeContext(state, { excludeAnchors })
        },
      })
      this.contextRegistrations.set(sessionId, { agent, dispose })
      this.stateProjection.observeRuntimeContext(sessionId, this.stateProjection.getState(sessionId).revision, true)
      return true
    } catch {
      this.stateProjection.observeRuntimeContext(sessionId, this.stateProjection.getState(sessionId).revision, false)
      return false
    }
  }

  uninstallRuntimeContext(agent) {
    const sessionId = agent?.id
    const existing = this.contextRegistrations.get(sessionId)
    if (!existing || existing.agent !== agent) return false
    this.contextRegistrations.delete(sessionId)
    this.contextSuppressions.delete(sessionId)
    try { existing.dispose() } catch { /* Agent teardown can own the same exact disposer. */ }
    const current = this.stateProjection.getState(sessionId)
    this.stateProjection.observeRuntimeContext(sessionId, current.revision, false)
    return true
  }

  hydrateSession(session, inbox) {
    const sessionId = String(session.id)
    const rebuilt = rebuildTaskifyState({
      sessionId,
      events: [...session.events],
      inbox,
      durabilityStatus: 'unavailable',
    }).state
    const current = this.stateProjection.getState(sessionId)
    if (this.stateProjection.has(sessionId) && rebuilt.revision < current.revision) {
      this.dirtySessions?.delete(sessionId)
      return current
    }
    const converged = this.stateProjection.has(sessionId)
      ? {
          ...rebuilt,
          durability: current.durability,
          runtimeContext: current.runtimeContext,
        }
      : rebuilt
    const state = this.stateProjection.rebuild(sessionId, converged)
    this.dirtySessions?.delete(sessionId)
    return state
  }

  hydrateAgent(agent) {
    if (!agent?.session) return undefined
    return this.hydrateSession(agent.session, agent.inbox)
  }

  refreshState(sessionId) {
    if (this.bindingSessions?.has(sessionId)) return this.stateProjection.getState(sessionId)
    if (!this.dirtySessions?.has(sessionId)) return this.stateProjection.getState(sessionId)
    const agent = liveAgentOf(this.ctx, sessionId)
    if (agent) return this.hydrateAgent(agent)
    const session = this.ctx?.sessions?.get?.(sessionId)
    return session ? this.hydrateSession(session) : this.stateProjection.getState(sessionId)
  }

  async getState(request) {
    if (!this.stateProjection.has(request.sessionId) || this.dirtySessions?.has(request.sessionId)) {
      const agent = liveAgentOf(this.ctx, request.sessionId)
      if (agent && typeof this.hydrateAgent === 'function') this.hydrateAgent(agent)
      else {
        const session = this.ctx?.sessions?.get?.(request.sessionId)
        if (session && typeof this.hydrateSession === 'function') this.hydrateSession(session)
      }
    }
    return this.stateProjection.getState(request.sessionId)
  }

  selectModel(sessionId) {
    try {
      const agent = typeof sessionId === 'string' && sessionId !== '' ? this.ctx.agents.get(sessionId) : undefined
      if (agent?.options?.provider && agent.options.model) return { provider: agent.options.provider, model: agent.options.model }
    } catch {
      // Fall through to the deployment default.
    }
    const selection = this.ctx.agentDefaultModel.currentSelection()
    if (!selection.provider || !selection.model) return undefined
    return { provider: selection.provider, model: selection.model }
  }

  async compile(request, signal) {
    const requestId = request.requestId
    if (typeof this.refreshState === 'function') this.refreshState(request.sessionId)
    const compared = this.stateProjection.compare(request.sessionId, request.expectedRevision)
    if (!compared.matches) return compileConflict(requestId, compared.state)

    const agent = liveAgentOf(this.ctx, request.sessionId)
    let replacementDurability = compared.state.durability.status
    if (compared.state.request.phase === 'armed' && compared.state.request.bundle.carrier !== null) {
      if (!agent?.inbox || typeof agent.inbox.remove !== 'function') {
        return { ok: false, requestId, error: { code: 'inbox-unavailable', message: '无法精确移除上一条 Taskify Inbox message。' }, state: compared.state }
      }
      if (!agent.inbox.remove(compared.state.request.bundle.carrier.messageId)) {
        return { ok: false, requestId, error: { code: 'message-not-pending', message: '上一条 Taskify Inbox message 已不在 pending Inbox；请重新读取状态。' }, state: compared.state }
      }
      replacementDurability = (await checkpointDurability(this.ctx, agent.session)).status
    }

    const begun = this.stateProjection.update(request.sessionId, request.expectedRevision, {
      type: 'begin-compile',
      requestId,
      boundDraft: request.rawDraft,
      sourceDraft: request.sourceDraft,
      durabilityStatus: replacementDurability,
    })
    if (!begun.ok) return compileConflict(requestId, begun.state)
    const pendingRevision = begun.state.revision
    const failPending = (code, message, durabilityStatus = begun.state.durability.status) => {
      const cleared = this.stateProjection.update(request.sessionId, pendingRevision, { type: 'clear-request', durabilityStatus })
      if (!cleared.ok) return compileConflict(requestId, cleared.state)
      return { ok: false, requestId, error: { code, message }, state: cleared.state }
    }

    const selection = this.selectModel(request.sessionId)
    if (!selection) return failPending('no-model', '当前没有可用的模型配置。')

    let timedOut = false
    const timeoutController = new AbortController()
    const timer = setTimeout(() => {
      timedOut = true
      timeoutController.abort()
    }, COMPILER_TIMEOUT_MS)
    const options = {
      provider: selection.provider,
      model: selection.model,
      system: COMPILER_SYSTEM_PROMPT,
      temperature: COMPILER_TEMPERATURE,
      maxTokens: COMPILER_MAX_TOKENS,
      messages: [createUserMessage({
        content: [{ type: 'text', text: buildCompilerUserPayload({ draft: request.draft }) }],
        source: { kind: 'plugin', plugin: PLUGIN_NAME },
      })],
      signal: combinedSignal(signal, timeoutController),
    }

    let text = ''
    let failure = ''
    let failureCode = 'llm-failed'
    let finished = false
    try {
      for await (const chunk of this.ctx.llm.stream(options)) {
        if (chunk.type === 'text-delta') text += chunk.text
        if (chunk.type === 'finish') {
          finished = chunk.reason.kind === 'stop'
          if (chunk.reason.kind === 'max-tokens') {
            failureCode = 'max-tokens'
            failure = '模型输出达到长度上限，结果可能不完整。'
          } else if (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted') {
            failure = chunk.reason.failure?.message || '模型调用未完成。'
          } else if (chunk.reason.kind !== 'stop') {
            failureCode = 'incomplete-result'
            failure = '模型未正常结束，结果可能不完整。'
          }
        }
      }
      if (!finished && !failure) {
        failureCode = 'incomplete-result'
        failure = '模型响应未包含完整结束标记。'
      }
    } catch (error) {
      failure = messageOf(error, '模型调用失败。')
    } finally {
      clearTimeout(timer)
    }

    if (signal?.aborted === true) return failPending('aborted', 'Taskify 已取消。')
    if (timedOut) return failPending('timeout', 'Taskify 超时，请重试。')
    if (failure) return failPending(failureCode, failure)
    if (!text.trim()) return failPending('empty-result', '模型未返回可用内容。')
    if (text.length > MAX_RESULT_CHARS) return failPending('too-long', 'Anchor 结果超过长度上限。')

    const parsed = parseCompilerOutput(text, {
      lockedDraft: request.draft,
      sourceDraft: request.sourceDraft,
      lock: { nonce: request.nonce, locks: request.literals },
    })
    if (!parsed.ok) return failPending(parsed.error.code, parsed.error.message)

    if (parsed.anchors.length === 0) {
      const armed = this.stateProjection.update(request.sessionId, pendingRevision, {
        type: 'arm', requestId, anchors: [], carrier: null, durabilityStatus: 'unavailable',
      })
      return armed.ok ? { ok: true, requestId, state: armed.state } : compileConflict(requestId, armed.state)
    }

    const source = createTaskifyActivationSource({
      sessionId: request.sessionId,
      baseRevision: request.expectedRevision,
      armedRevision: pendingRevision + 1,
      requestId,
      boundDraft: request.rawDraft,
      sourceDraft: request.sourceDraft,
      anchors: parsed.anchors,
    })
    try {
      mergePersistentAnchors(begun.state.anchors, parsed.anchors, {
        bundleId: source.bundleId,
        activatedRevision: source.activationRevision,
        sessionId: request.sessionId,
      })
    } catch (error) {
      return failPending(error?.code ?? 'anchor-limit', error instanceof Error ? error.message : 'Persistent Anchor 数量超过上限。')
    }
    const message = createUserMessage({
      content: [{ type: 'text', text: buildConstraintContract(parsed.anchors) }],
      source,
    })
    const injected = await injectOrClassifyCommit(agent, message)
    if (!injected.committed) {
      return failPending('injection-unavailable', messageOf(injected.error, 'Taskify 无法写入当前 Agent Inbox。'), injected.status)
    }

    const armed = this.stateProjection.update(request.sessionId, pendingRevision, {
      type: 'arm',
      requestId,
      anchors: parsed.anchors,
      carrier: { messageId: message.id, bundleId: source.bundleId, requestId },
      durabilityStatus: 'unavailable',
    })
    if (!armed.ok) return compileConflict(requestId, armed.state)

    const checkpoint = await checkpointDurability(this.ctx, agent.session)
    const observed = this.stateProjection.observeDurability(request.sessionId, armed.state.revision, checkpoint.status)
    return { ok: true, requestId, state: observed.state }
  }

  async invalidate(request) {
    if (typeof this.refreshState === 'function') this.refreshState(request.sessionId)
    const compared = this.stateProjection.compare(request.sessionId, request.expectedRevision)
    if (!compared.matches) return { ok: false, error: revisionConflict(compared.state), state: compared.state }

    let durabilityStatus = compared.state.durability.status
    if (compared.state.request.phase === 'armed' && compared.state.request.bundle.carrier !== null) {
      const agent = liveAgentOf(this.ctx, request.sessionId)
      const messageId = compared.state.request.bundle.carrier.messageId
      if (!agent?.inbox || typeof agent.inbox.remove !== 'function') {
        return { ok: false, error: { code: 'inbox-unavailable', message: '无法访问当前 Agent Inbox。' }, state: compared.state }
      }
      if (!agent.inbox.remove(messageId)) {
        return { ok: false, error: { code: 'message-not-pending', message: 'Taskify message 已不在 pending Inbox；未删除其他 message。' }, state: compared.state }
      }
      durabilityStatus = (await checkpointDurability(this.ctx, agent.session)).status
    }

    const cleared = this.stateProjection.update(request.sessionId, request.expectedRevision, { type: 'clear-request', durabilityStatus })
    if (!cleared.ok) return { ok: false, error: revisionConflict(cleared.state), state: cleared.state }
    return { ok: true, state: cleared.state }
  }

  async mutatePersistentAnchors(kind, request) {
    if (typeof this.refreshState === 'function') this.refreshState(request.sessionId)
    const compared = this.stateProjection.compare(request.sessionId, request.expectedRevision)
    if (!compared.matches) return { ok: false, error: revisionConflict(compared.state), state: compared.state }
    if (compared.state.request.phase !== 'idle') {
      return {
        ok: false,
        error: { code: 'request-busy', message: '请先完成或取消当前 Taskify 提取绑定，再修改持久约束。' },
        state: compared.state,
      }
    }

    let anchors = compared.state.anchors.map(anchor => structuredClone(anchor))
    if (kind !== 'clear') {
      const index = anchors.findIndex(anchor => anchor.id === request.anchorId)
      if (index < 0) {
        return { ok: false, error: { code: 'anchor-not-found', message: '该 Anchor 已不存在。' }, state: compared.state }
      }
      if (kind === 'pause' || kind === 'resume') {
        const status = kind === 'pause' ? 'paused' : 'active'
        if (anchors[index].status === status) {
          return { ok: false, error: { code: 'anchor-state', message: `该 Anchor 已经是 ${status} 状态。` }, state: compared.state }
        }
        anchors[index].status = status
      } else if (kind === 'remove') {
        anchors.splice(index, 1)
      }
    } else {
      anchors = []
    }

    const agent = liveAgentOf(this.ctx, request.sessionId)
    const nextRevision = compared.state.revision + 1
    const operation = kind === 'clear' ? { kind } : { kind, targetAnchorId: request.anchorId }
    const source = createTaskifyStateUpdateSource({
      sessionId: request.sessionId,
      revision: nextRevision,
      anchors,
      operation,
    })
    const message = createUserMessage({
      content: [{ type: 'text', text: buildLifecycleNotice(nextRevision, anchors) }],
      source,
    })
    const injected = await injectOrClassifyCommit(agent, message)
    if (!injected.committed) {
      return {
        ok: false,
        error: {
          code: 'lifecycle-injection-unavailable',
          message: messageOf(injected.error, 'Taskify 无法写入 lifecycle state record。'),
        },
        state: compared.state,
      }
    }

    const updated = this.stateProjection.update(request.sessionId, compared.state.revision, {
      type: 'replace-anchors', anchors, durabilityStatus: 'unavailable',
    })
    if (!updated.ok) return { ok: false, error: revisionConflict(updated.state), state: updated.state }
    const checkpoint = await checkpointDurability(this.ctx, agent.session)
    const observed = this.stateProjection.observeDurability(request.sessionId, updated.state.revision, checkpoint.status)
    return { ok: true, state: observed.state }
  }

  async pauseAnchor(request) { return this.mutatePersistentAnchors('pause', request) }
  async resumeAnchor(request) { return this.mutatePersistentAnchors('resume', request) }
  async removeAnchor(request) { return this.mutatePersistentAnchors('remove', request) }
  async clearAnchors(request) { return this.mutatePersistentAnchors('clear', request) }
}

export default TaskifyService
