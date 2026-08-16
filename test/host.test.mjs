import test from 'node:test'
import assert from 'node:assert/strict'
import { TaskifyService } from '../src/host/index.js'

function serviceWithChunks(chunks) {
  return {
    selectModel: () => ({ provider: 'test-provider', model: 'test-model' }),
    ctx: {
      llm: {
        async *stream() {
          yield *chunks
        },
      },
    },
  }
}

test('max-tokens finish rejects a truncated model result', async () => {
  const service = serviceWithChunks([
    { type: 'text-delta', text: '半截结果' },
    { type: 'finish', reason: { kind: 'max-tokens' } },
  ])

  const result = await TaskifyService.prototype.compile.call(
    service,
    { requestId: 'request-1', sessionId: 'session-1', draft: 'draft', context: '' },
  )

  assert.equal(result.ok, false)
  assert.equal(result.requestId, 'request-1')
  assert.equal(result.error.code, 'max-tokens')
})

test('only a stop finish accepts a complete model result', async () => {
  const service = serviceWithChunks([
    { type: 'text-delta', text: '完整结果' },
    { type: 'finish', reason: { kind: 'stop' } },
  ])

  const result = await TaskifyService.prototype.compile.call(
    service,
    { requestId: 'request-2', sessionId: 'session-2', draft: 'draft', context: '' },
  )

  assert.deepEqual(result, { ok: true, requestId: 'request-2', text: '完整结果' })
})

test('a stream without a finish marker is rejected', async () => {
  const service = serviceWithChunks([
    { type: 'text-delta', text: '看似完整但没有结束标记' },
  ])

  const result = await TaskifyService.prototype.compile.call(
    service,
    { requestId: 'request-3', sessionId: 'session-3', draft: 'draft', context: '' },
  )

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'incomplete-result')
})
