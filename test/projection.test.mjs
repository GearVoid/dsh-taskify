import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { Inbox } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { rebuildTaskifyState } from '../src/shared/projection.js'
import { createTaskifyActivationSource, createTaskifyStateUpdateSource } from '../src/shared/source.js'

const agentPeerRequire = createRequire(import.meta.resolve('@deepseek-ai/dsh-agent/package.json'))
const { Session, SessionId } = await import(pathToFileURL(agentPeerRequire.resolve('@deepseek-ai/dsh-session')).href)
const notifications = () => ({ inserted() {}, discarded() {}, claimed() {} })

function activation(sessionId = 'session-1', { requestId = 'request-1', baseRevision = 0, text = '不修改后端' } = {}) {
  const source = createTaskifyActivationSource({
    sessionId, baseRevision, armedRevision: baseRevision + 2, requestId,
    boundDraft: '/taskify 后端别动', sourceDraft: '后端别动',
    anchors: [{ text, evidence: '后端别动' }],
  })
  return createUserMessage({ content: [{ type: 'text', text: '<content is not parsed>' }], source })
}

function control(sessionId, revision, anchors, operation, focus = null) {
  return createUserMessage({
    content: [{ type: 'text', text: '<superseding state>' }],
    source: createTaskifyStateUpdateSource({ sessionId, revision, anchors, focus, operation }),
  })
}

function fixture(sessionId = 'session-1') {
  const session = Session.create(SessionId(sessionId))
  return { session, inbox: new Inbox(session, notifications()) }
}

const rebuild = (fx, sessionId = 'session-1') => rebuildTaskifyState({
  sessionId, events: [...fx.session.snapshotEvents()], inbox: fx.inbox,
}).state

function consumeActivation(fx, message) {
  fx.inbox.append('next-step', message)
  fx.inbox.claim('next-step', 1)
  fx.session.append('user/message', message, { surfaceOp: 'append' })
  return rebuild(fx)
}

test('current activation carrier rebuilds armed request without persistent activation', () => {
  const fx = fixture()
  const message = activation()
  fx.inbox.append('next-step', message)
  const first = rebuild(fx)
  assert.deepEqual(rebuild(fx), first)
  assert.equal(first.request.phase, 'armed')
  assert.equal(first.revision, 2)
  assert.equal(first.request.bundle.carrier.messageId, message.id)
  assert.deepEqual(first.anchors, [])
})

test('historical activation user/message restores persistent active anchors', () => {
  const fx = fixture()
  const state = consumeActivation(fx, activation())
  assert.equal(state.request.phase, 'idle')
  assert.equal(state.revision, 3)
  assert.equal(state.anchors[0].status, 'active')
  assert.equal(state.anchors[0].id, 'anchor:taskify:2:request-1:1')
})

test('rc.2 claimed carrier followed by its bound human draft restores persistent anchors', () => {
  const fx = fixture()
  const message = activation()
  fx.inbox.append('next-step', message)
  fx.inbox.claim('next-step', 1)
  fx.session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: '/taskify 后端别动' }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })

  const state = rebuild(fx)
  assert.equal(state.request.phase, 'idle')
  assert.equal(state.revision, 3)
  assert.equal(state.anchors[0].status, 'active')
})

test('requeued carrier remains armed when the human draft does not match', () => {
  const fx = fixture()
  const message = activation()
  fx.inbox.append('next-step', message)
  fx.inbox.claim('next-step', 1)
  fx.inbox.append('next-step', message)
  fx.session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: '另一条消息' }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })

  const state = rebuild(fx)
  assert.equal(state.request.phase, 'armed')
  assert.equal(state.revision, 2)
  assert.deepEqual(state.anchors, [])
})

test('an unconsumed claim cannot bind to a matching draft after its turn ends', () => {
  const fx = fixture()
  const message = activation()
  fx.inbox.append('next-step', message)
  fx.inbox.claim('next-step', 1)
  const events = [
    ...fx.session.snapshotEvents(),
    { type: 'turn/start', data: {} },
    { type: 'turn/end', data: {} },
    {
      type: 'user/message',
      data: createUserMessage({ content: [{ type: 'text', text: '/taskify 后端别动' }], source: { kind: 'user' } }),
    },
  ]

  const state = rebuildTaskifyState({ sessionId: 'session-1', events }).state
  assert.equal(state.request.phase, 'idle')
  assert.equal(state.revision, 3)
  assert.deepEqual(state.anchors, [])
})

test('removed unactivated carrier rebuilds idle without anchors', () => {
  const fx = fixture()
  const message = activation()
  fx.inbox.append('next-step', message)
  fx.inbox.remove(message.id)
  const state = rebuild(fx)
  assert.equal(state.request.phase, 'idle')
  assert.equal(state.revision, 3)
  assert.deepEqual(state.anchors, [])
})

test('pause and resume snapshots replay with the same stable anchor ID', () => {
  const fx = fixture()
  const active = consumeActivation(fx, activation())
  const pausedAnchors = active.anchors.map(anchor => ({ ...anchor, status: 'paused' }))
  fx.inbox.append('next-step', control('session-1', 4, pausedAnchors, { kind: 'pause', targetAnchorId: active.anchors[0].id }))
  const paused = rebuild(fx)
  assert.equal(paused.anchors[0].status, 'paused')
  assert.equal(paused.anchors[0].id, active.anchors[0].id)
  fx.inbox.append('next-step', control('session-1', 5, active.anchors, { kind: 'resume', targetAnchorId: active.anchors[0].id }))
  const resumed = rebuild(fx)
  assert.equal(resumed.anchors[0].status, 'active')
  assert.equal(resumed.anchors[0].id, active.anchors[0].id)
  assert.equal(resumed.revision, 5)
})

test('later remove and clear snapshots prevent historical resurrection', () => {
  const fx = fixture()
  const active = consumeActivation(fx, activation())
  fx.inbox.append('next-step', control('session-1', 4, [], { kind: 'remove', targetAnchorId: active.anchors[0].id }))
  assert.deepEqual(rebuild(fx).anchors, [])
  fx.inbox.append('next-step', control('session-1', 5, [], { kind: 'clear' }))
  const cleared = rebuild(fx)
  assert.equal(cleared.revision, 5)
  assert.deepEqual(cleared.anchors, [])
  assert.deepEqual(rebuild(fx), cleared)
})

test('unrelated, malformed, unsupported, and wrong-session records are ignored', () => {
  const fx = fixture()
  fx.inbox.append('next-step', createUserMessage({ content: [{ type: 'text', text: 'ordinary' }], source: { kind: 'user' } }))
  fx.inbox.append('next-step', createUserMessage({ content: [{ type: 'text', text: 'bad' }], source: { kind: 'dsh-taskify', schemaVersion: 2 } }))
  const unsupported = structuredClone(activation().source)
  unsupported.schemaVersion = 99
  fx.inbox.append('next-step', createUserMessage({ content: [{ type: 'text', text: 'future' }], source: unsupported }))
  const rebuilt = rebuildTaskifyState({ sessionId: 'session-1', events: [...fx.session.snapshotEvents()], inbox: fx.inbox })
  assert.equal(rebuilt.state.revision, 0)
  assert.ok(rebuilt.diagnostics.malformed > 0)
  assert.ok(rebuilt.diagnostics.unsupported > 0)

  const parent = fixture('parent')
  parent.inbox.append('next-step', activation('parent'))
  const child = rebuildTaskifyState({ sessionId: 'child', events: [...parent.session.snapshotEvents()], inbox: parent.inbox })
  assert.equal(child.state.revision, 0)
  assert.deepEqual(child.state.anchors, [])
  assert.ok(child.diagnostics.wrongSession > 0)
})

test('later activation merges exact duplicates deterministically', () => {
  const fx = fixture()
  const first = consumeActivation(fx, activation())
  const firstId = first.anchors[0].id
  consumeActivation(fx, activation('session-1', { requestId: 'request-2', baseRevision: 3 }))
  const state = rebuild(fx)
  assert.equal(state.revision, 6)
  assert.equal(state.anchors.length, 1)
  assert.equal(state.anchors[0].id, firstId)
})

test('replay preserves an active Focus when later Anchors are activated', () => {
  const fx = fixture()
  const focus = { text: '只实现 Focus v0.4', status: 'active', scope: { kind: 'session', sessionId: 'session-1' } }
  const focusRecord = control('session-1', 1, [], { kind: 'focus-set' }, focus)
  fx.session.append('user/message', focusRecord, { surfaceOp: 'append' })
  consumeActivation(fx, activation('session-1', { baseRevision: 1 }))
  const state = rebuild(fx)
  assert.deepEqual(state.focus, focus)
  assert.equal(state.anchors.length, 1)
  assert.equal(state.revision, 4)
})
