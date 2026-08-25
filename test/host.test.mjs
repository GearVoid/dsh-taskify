import test from 'node:test'
import assert from 'node:assert/strict'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { injectActiveConstraints, TaskifyService } from '../src/host/index.js'
import { lockLiterals } from '../src/shared/literal-lock.js'

function serviceWithChunks(chunks) {
  return {
    activeAnchors: new Map(),
    selectModel: () => ({ provider: 'test-provider', model: 'test-model' }),
    ctx: { llm: { async *stream() { yield *chunks } } },
  }
}

function requestFor(sourceDraft, requestId = 'request-1', sessionId = 'session-1') {
  const lock = lockLiterals(sourceDraft)
  return {
    requestId,
    sessionId,
    rawDraft: sourceDraft,
    sourceDraft,
    draft: lock.text,
    nonce: lock.nonce,
    literals: lock.locks,
  }
}

test('max-tokens finish rejects a truncated extraction', async () => {
  const service = serviceWithChunks([
    { type: 'text-delta', text: '{"anchors":[' },
    { type: 'finish', reason: { kind: 'max-tokens' } },
  ])
  const result = await TaskifyService.prototype.compile.call(service, requestFor('后端别动'))
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'max-tokens')
})

test('only a stopped, validated extraction activates anchors', async () => {
  const service = serviceWithChunks([
    { type: 'text-delta', text: '{"anchors":[{"text":"不修改后端","evidence":"后端别动"}]}' },
    { type: 'finish', reason: { kind: 'stop' } },
  ])
  const request = requestFor('后端别动')
  const result = await TaskifyService.prototype.compile.call(service, request)
  assert.deepEqual(result, {
    ok: true,
    requestId: request.requestId,
    anchors: [{ text: '不修改后端', evidence: '后端别动' }],
  })
  assert.equal(service.activeAnchors.has(request.sessionId), true)
})

test('empty anchors succeed without activating an empty contract', async () => {
  const service = serviceWithChunks([
    { type: 'text-delta', text: '{"anchors":[]}' },
    { type: 'finish', reason: { kind: 'stop' } },
  ])
  const request = requestFor('把 README 中的 foo 改成 bar。')
  const result = await TaskifyService.prototype.compile.call(service, request)
  assert.deepEqual(result.anchors, [])
  assert.equal(service.activeAnchors.has(request.sessionId), false)
})

test('a stream without a finish marker is rejected', async () => {
  const service = serviceWithChunks([{ type: 'text-delta', text: '{"anchors":[]}' }])
  const result = await TaskifyService.prototype.compile.call(service, requestFor('普通任务'))
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'incomplete-result')
})

test('pre-step appends the constraint contract as a user-role plugin message once', async () => {
  const human = createUserMessage({
    content: [{ type: 'text', text: '整理页面，后端别动' }],
    source: { kind: 'user' },
  })
  const active = new Map([['session-1', {
    anchors: [{ text: '不修改后端', evidence: '后端别动' }],
    acceptedDrafts: new Set(['整理页面，后端别动']),
  }]])
  const decision = await injectActiveConstraints(
    active,
    { agent: { id: 'session-1' } },
    async () => ({ kind: 'enter', messages: [human] }),
  )
  assert.equal(decision.messages.length, 2)
  assert.equal(decision.messages[0], human)
  assert.equal(decision.messages[1].role, 'user')
  assert.equal(decision.messages[1].source.kind, 'plugin')
  assert.equal(decision.messages[1].source.plugin, 'dsh-taskify')
  assert.equal(decision.messages[1].content[0].text, '<taskify_constraints>\n- 不修改后端\n</taskify_constraints>')
  assert.equal(active.has('session-1'), false)
})

test('pre-step does not inject into a different or non-human message', async () => {
  const pluginMessage = createUserMessage({
    content: [{ type: 'text', text: '后端别动' }],
    source: { kind: 'plugin', plugin: 'other' },
  })
  const active = new Map([['session-1', {
    anchors: [{ text: '不修改后端', evidence: '后端别动' }],
    acceptedDrafts: new Set(['后端别动']),
  }]])
  const decision = await injectActiveConstraints(
    active,
    { agent: { id: 'session-1' } },
    async () => ({ kind: 'enter', messages: [pluginMessage] }),
  )
  assert.deepEqual(decision.messages, [pluginMessage])
  assert.equal(active.has('session-1'), true)
})
