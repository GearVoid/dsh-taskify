import test from 'node:test'
import assert from 'node:assert/strict'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import {
  createTaskifyActivationSource,
  createTaskifyStateUpdateSource,
  inspectTaskifyUserMessage,
  parseTaskifyMessageSource,
  TaskifySourceError,
} from '../src/shared/source.js'

function activation(overrides = {}) {
  return createTaskifyActivationSource({
    sessionId: 'session-1', baseRevision: 0, armedRevision: 2, requestId: 'request-1',
    boundDraft: '/taskify 后端别动', sourceDraft: '后端别动',
    anchors: [{ text: '不修改后端', evidence: '后端别动' }], ...overrides,
  })
}

function persistentAnchor(status = 'active') {
  return {
    id: 'anchor:taskify:2:request-1:1', text: '不修改后端', evidence: '后端别动', status,
    scope: { kind: 'session', sessionId: 'session-1' }, activatedRevision: 3,
  }
}

test('activation source is v2, deterministic, exact-session, and immutable', () => {
  const value = activation()
  assert.equal(value.kind, 'dsh-taskify')
  assert.equal(value.schemaVersion, 2)
  assert.equal(value.recordType, 'activation')
  assert.equal(value.bundleId, 'taskify:2:request-1')
  assert.equal(value.activationRevision, 3)
  assert.deepEqual(value.binding.acceptedDrafts, ['/taskify 后端别动', '后端别动'])
  assert.deepEqual(parseTaskifyMessageSource(value, { expectedSessionId: 'session-1' }), value)
  assert.equal(Object.isFrozen(value), true)
})

test('state-update source carries a complete authoritative anchor snapshot', () => {
  const value = createTaskifyStateUpdateSource({
    sessionId: 'session-1', revision: 4, anchors: [persistentAnchor('paused')],
    operation: { kind: 'pause', targetAnchorId: persistentAnchor().id },
  })
  assert.equal(value.recordType, 'state-update')
  assert.equal(value.recordId, `taskify-state:4:pause:${persistentAnchor().id}`)
  assert.equal(value.anchors[0].status, 'paused')
  assert.equal(Object.isFrozen(value.anchors[0].scope), true)
})

test('unsupported source version is rejected explicitly', () => {
  const value = structuredClone(activation())
  value.schemaVersion = 3
  assert.throws(() => parseTaskifyMessageSource(value), error => error instanceof TaskifySourceError && error.code === 'unsupported-version')
})

test('malformed revisions and unknown fields are rejected', () => {
  const value = structuredClone(activation())
  value.armedRevision = 9
  assert.throws(() => parseTaskifyMessageSource(value), /revisions are inconsistent/)
  assert.throws(() => parseTaskifyMessageSource({ ...structuredClone(activation()), invented: true }), /unknown field/)
})

test('wrong exact session and wrong persistent scope are rejected', () => {
  const message = createUserMessage({ content: [{ type: 'text', text: 'contract' }], source: activation() })
  assert.deepEqual(inspectTaskifyUserMessage(message, 'other-session'), { kind: 'invalid', code: 'wrong-session' })
  const anchor = persistentAnchor()
  anchor.scope.sessionId = 'other-session'
  assert.throws(() => createTaskifyStateUpdateSource({
    sessionId: 'session-1', revision: 4, anchors: [anchor], operation: { kind: 'clear' },
  }), error => error.code === 'wrong-session')
})

test('oversized activation payload fails strict bounds', () => {
  assert.throws(() => activation({ boundDraft: 'x'.repeat(32_769) }), error => error.code === 'source-too-large')
  assert.throws(() => activation({ anchors: Array.from({ length: 9 }, () => ({ text: 'x', evidence: 'x' })) }), /anchors is invalid/)
})

test('unrelated MessageSource is ignored', () => {
  const message = createUserMessage({ content: [{ type: 'text', text: 'ordinary' }], source: { kind: 'user' } })
  assert.deepEqual(inspectTaskifyUserMessage(message, 'session-1'), { kind: 'unrelated' })
})
