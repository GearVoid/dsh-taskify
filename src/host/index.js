/**
 * DSH Taskify Host: current-model extraction, validation, cancellation, and
 * user-level constraint injection at the official agent/pre-step seam.
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
import { TYPERT_CONTRIBUTION } from '../shared/schema.js'

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

function textOfUserMessage(message) {
  if (!message || message.role !== 'user' || message.source?.kind !== 'user' || !Array.isArray(message.content)) return ''
  return message.content
    .filter(block => block?.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n')
}

export async function injectActiveConstraints(activeAnchors, payload, next) {
  const decision = await next()
  if (decision?.kind !== 'enter' || payload?.signal?.aborted === true) return decision
  const sessionId = payload?.agent?.id
  const active = activeAnchors.get(sessionId)
  if (!active) return decision

  const matched = decision.messages.some(message => active.acceptedDrafts.has(textOfUserMessage(message)))
  if (!matched) return decision

  const contract = buildConstraintContract(active.anchors)
  activeAnchors.delete(sessionId)
  if (!contract) return decision
  const constraintMessage = createUserMessage({
    content: [{ type: 'text', text: contract }],
    source: { kind: 'plugin', plugin: PLUGIN_NAME, form: 'notice', summary: 'Taskify constraints' },
  })
  return { kind: 'enter', messages: [...decision.messages, constraintMessage] }
}

export class TaskifyService extends Service {
  static inject = ['llm', 'agentDefaultModel', 'agents', 'typert']

  constructor(ctx) {
    super(ctx, 'taskify')
    this.activeAnchors = new Map()
    this.typertRemote = bindTypertRemote(this, 'taskify')
    ctx.typert.register(TYPERT_CONTRIBUTION)

    ctx.on('agent/pre-step', (payload, next) => injectActiveConstraints(this.activeAnchors, payload, next))
  }

  selectModel(sessionId) {
    try {
      const agent = typeof sessionId === 'string' && sessionId !== '' ? this.ctx.agents.get(sessionId) : undefined
      if (agent?.options?.provider && agent.options.model) {
        return { provider: agent.options.provider, model: agent.options.model }
      }
    } catch {
      // Fall through to the deployment default.
    }
    const selection = this.ctx.agentDefaultModel.currentSelection()
    if (!selection.provider || !selection.model) return undefined
    return { provider: selection.provider, model: selection.model }
  }

  async compile(request, signal) {
    const requestId = request.requestId
    this.activeAnchors.delete(request.sessionId)
    const selection = this.selectModel(request.sessionId)
    if (!selection) {
      return { ok: false, requestId, error: { code: 'no-model', message: '当前没有可用的模型配置。' } }
    }

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

    if (signal?.aborted === true) return { ok: false, requestId, error: { code: 'aborted', message: 'Taskify 已取消。' } }
    if (timedOut) return { ok: false, requestId, error: { code: 'timeout', message: 'Taskify 超时，请重试。' } }
    if (failure) return { ok: false, requestId, error: { code: failureCode, message: failure } }
    if (!text.trim()) return { ok: false, requestId, error: { code: 'empty-result', message: '模型未返回可用内容。' } }
    if (text.length > MAX_RESULT_CHARS) return { ok: false, requestId, error: { code: 'too-long', message: 'Anchor 结果超过长度上限。' } }

    const parsed = parseCompilerOutput(text, {
      lockedDraft: request.draft,
      sourceDraft: request.sourceDraft,
      lock: { nonce: request.nonce, locks: request.literals },
    })
    if (!parsed.ok) return { ok: false, requestId, error: parsed.error }

    if (parsed.anchors.length > 0) {
      this.activeAnchors.set(request.sessionId, {
        anchors: parsed.anchors,
        acceptedDrafts: new Set([request.rawDraft, request.sourceDraft]),
      })
    }
    return { ok: true, requestId, anchors: parsed.anchors }
  }

  async invalidate(request) {
    this.activeAnchors.delete(request.sessionId)
    return { ok: true }
  }
}

export default TaskifyService
