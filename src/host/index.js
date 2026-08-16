/**
 * dsh-taskify Host half.
 *
 * Owns exactly one Typert Remote method (`taskify/compile`): model selection,
 * the frozen Task Compiler prompt, one LLM stream, timeout/cancellation and
 * error normalization. It never reads the workspace and never auto-sends the
 * compiled task.
 */

import { Service } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { bindTypertRemote } from '@deepseek-ai/dsh-typert-protocol'
import {
  COMPILER_MAX_TOKENS,
  COMPILER_SYSTEM_PROMPT,
  COMPILER_TEMPERATURE,
  COMPILER_TIMEOUT_MS,
  buildCompilerUserPayload,
} from '../shared/compiler.js'
import { MAX_RESULT_CHARS } from '../shared/literal-lock.js'
import { TYPERT_CONTRIBUTION } from '../shared/schema.js'

const PLUGIN_NAME = 'dsh-taskify'

function messageOf(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback
}

function combinedSignal(external, timeoutController) {
  if (!external) return timeoutController.signal
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([external, timeoutController.signal])
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  external.addEventListener('abort', abort, { once: true })
  timeoutController.signal.addEventListener('abort', abort, { once: true })
  return controller.signal
}

export class TaskifyService extends Service {
  static inject = ['llm', 'agentDefaultModel', 'agents', 'typert']

  constructor(ctx) {
    super(ctx, 'taskify')
    this.typertRemote = bindTypertRemote(this, 'taskify')
    ctx.typert.register(TYPERT_CONTRIBUTION)
  }

  selectModel(sessionId) {
    try {
      const agent = typeof sessionId === 'string' && sessionId !== '' ? this.ctx.agents.get(sessionId) : undefined
      if (agent?.options?.provider && agent.options.model) {
        return { provider: agent.options.provider, model: agent.options.model }
      }
    } catch {
      // Fall through to the deployment default below.
    }
    const selection = this.ctx.agentDefaultModel.currentSelection()
    if (!selection.provider || !selection.model) return undefined
    return { provider: selection.provider, model: selection.model }
  }

  async compile(request, signal) {
    const requestId = request.requestId
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
      messages: [
        createUserMessage({
          content: [{ type: 'text', text: buildCompilerUserPayload({ draft: request.draft, context: request.context }) }],
          source: { kind: 'plugin', plugin: PLUGIN_NAME },
        }),
      ],
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

    if (signal?.aborted === true) {
      return { ok: false, requestId, error: { code: 'aborted', message: '任务完善已取消。' } }
    }
    if (timedOut) {
      return { ok: false, requestId, error: { code: 'timeout', message: '任务完善超时，请重试。' } }
    }
    if (failure) {
      return { ok: false, requestId, error: { code: failureCode, message: failure } }
    }

    const compiled = text.trim()
    if (compiled === '') {
      return { ok: false, requestId, error: { code: 'empty-result', message: '模型未返回可用内容。' } }
    }
    if (compiled.length > MAX_RESULT_CHARS) {
      return { ok: false, requestId, error: { code: 'too-long', message: '增强结果超过长度上限。' } }
    }
    return { ok: true, requestId, text: compiled }
  }
}

export default TaskifyService
