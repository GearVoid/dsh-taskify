import test from 'node:test'
import assert from 'node:assert/strict'
import { TaskifyStateProjection, createInitialTaskifyState, transitionTaskifyState } from '../src/shared/state.js'

function arm(initial, requestId = 'request-1', anchors = [{ text: '不修改后端', evidence: '后端别动' }]) {
  const pending = transitionTaskifyState(initial, {
    type: 'begin-compile', requestId, boundDraft: '/task 后端别动', sourceDraft: '后端别动',
  })
  return transitionTaskifyState(pending, {
    type: 'arm', requestId, anchors,
    carrier: { messageId: `message-${requestId}`, bundleId: `bundle-${requestId}`, requestId },
  })
}

test('initial domain state separates idle request from persistent anchors', () => {
  const state = createInitialTaskifyState('session-1')
  assert.deepEqual(state, {
    schemaVersion: 3, sessionId: 'session-1', revision: 0,
    durability: { status: 'unavailable' }, runtimeContext: { available: false },
    goalIntegration: { available: false }, request: { phase: 'idle' }, anchors: [],
    focus: null,
    scope: { kind: 'session', sessionId: 'session-1' },
  })
  assert.equal(Object.isFrozen(state), true)
  assert.equal(Object.isFrozen(state.anchors), true)
})

test('active Focus survives later Anchor compilation and activation intact', () => {
  const initial = createInitialTaskifyState('s')
  const focused = transitionTaskifyState(initial, {
    type: 'replace-focus',
    focus: { text: '只完成 Focus v0.4', status: 'active', scope: { kind: 'session', sessionId: 's' } },
  })
  const active = transitionTaskifyState(arm(focused), {
    type: 'activate', requestId: 'request-1', bundleId: 'bundle-request-1',
  })
  assert.deepEqual(active.focus, focused.focus)
  assert.equal(active.anchors.length, 1)
})

test('correct activation returns request to idle and retains persistent anchors', () => {
  const armed = arm(createInitialTaskifyState('session-1'))
  const active = transitionTaskifyState(armed, {
    type: 'activate', requestId: 'request-1', bundleId: 'bundle-request-1',
  })
  assert.equal(armed.request.phase, 'armed')
  assert.equal(active.request.phase, 'idle')
  assert.equal(active.revision, 3)
  assert.equal(active.anchors[0].id, 'anchor:bundle-request-1:1')
  assert.equal(active.anchors[0].status, 'active')
  assert.equal(active.anchors[0].activatedRevision, 3)
})

test('later activation exact-dedupes and preserves existing stable identity', () => {
  const first = transitionTaskifyState(arm(createInitialTaskifyState('s')), {
    type: 'activate', requestId: 'request-1', bundleId: 'bundle-request-1',
  })
  const second = transitionTaskifyState(arm(first, 'request-2'), {
    type: 'activate', requestId: 'request-2', bundleId: 'bundle-request-2',
  })
  assert.equal(second.anchors.length, 1)
  assert.equal(second.anchors[0].id, first.anchors[0].id)
})

test('persistent lifecycle snapshot changes status without changing anchor identity', () => {
  const active = transitionTaskifyState(arm(createInitialTaskifyState('s')), {
    type: 'activate', requestId: 'request-1', bundleId: 'bundle-request-1',
  })
  const paused = transitionTaskifyState(active, {
    type: 'replace-anchors', anchors: active.anchors.map(anchor => ({ ...anchor, status: 'paused' })),
  })
  assert.equal(paused.request.phase, 'idle')
  assert.equal(paused.anchors[0].id, active.anchors[0].id)
  assert.equal(paused.anchors[0].status, 'paused')
})

test('projection CAS rejects stale mutations without changing object identity', () => {
  const projection = new TaskifyStateProjection()
  const first = projection.update('session-1', 0, {
    type: 'begin-compile', requestId: 'request-1', boundDraft: '后端别动', sourceDraft: '后端别动',
  })
  assert.equal(first.ok, true)
  const before = projection.getState('session-1')
  const stale = projection.update('session-1', 0, { type: 'clear-request' })
  assert.equal(stale.ok, false)
  assert.equal(stale.state, before)
})

test('runtime availability metadata is revision-neutral', () => {
  const projection = new TaskifyStateProjection()
  const result = projection.observeRuntimeContext('session-1', 0, true)
  assert.equal(result.state.revision, 0)
  assert.equal(result.state.runtimeContext.available, true)
})

test('rebuild boundary rejects revision rollback and keeps sessions isolated', () => {
  const projection = new TaskifyStateProjection()
  const a1 = transitionTaskifyState(createInitialTaskifyState('a'), {
    type: 'begin-compile', requestId: 'r', boundDraft: 'A', sourceDraft: 'A',
  })
  projection.rebuild('a', a1)
  assert.throws(() => projection.rebuild('a', createInitialTaskifyState('a')), /cannot move backwards/)
  assert.equal(projection.getState('a').revision, 1)
  assert.equal(projection.getState('b').revision, 0)
})
