import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { Inbox } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { bindTaskifyInboxMessages, TaskifyService } from '../src/host/index.js'
import { buildConstraintContract } from '../src/shared/compiler.js'
import { lockLiterals } from '../src/shared/literal-lock.js'
import { rebuildTaskifyState } from '../src/shared/projection.js'
import { TaskifyStateProjection, createInitialTaskifyState } from '../src/shared/state.js'

const agentPeerRequire = createRequire(import.meta.resolve('@deepseek-ai/dsh-agent/package.json'))
const { Session, SessionId } = await import(pathToFileURL(agentPeerRequire.resolve('@deepseek-ai/dsh-session')).href)

function notifications() {
  return { inserted() {}, discarded() {}, claimed() {} }
}

function fixture(chunks, { sessionId = 'session-1', flush = false, withAgent = true, inject } = {}) {
  let streams = 0
  let flushes = 0
  const session = Session.create(SessionId(sessionId))
  const inbox = new Inbox(session, notifications())
  const agent = {
    id: sessionId,
    session,
    inbox,
    options: { provider: 'agent-provider', model: 'agent-model' },
    inject(message) {
      if (inject) return inject({ message, inbox })
      inbox.append('next-step', message)
    },
  }
  const agents = new Map(withAgent ? [[sessionId, agent]] : [])
  const ctx = {
    agents: { get(id) { return agents.get(id) } },
    sessions: {
      get(id) { return id === sessionId ? session : undefined },
      async flush(value) {
        assert.equal(value, session)
        flushes += 1
        if (flush instanceof Error) throw flush
        return flush
      },
    },
    llm: { async *stream() { streams += 1; yield *chunks } },
  }
  const service = {
    ctx,
    stateProjection: new TaskifyStateProjection(),
    dirtySessions: new Set(),
    selectModel: () => ({ provider: 'test-provider', model: 'test-model' }),
    hydrateAgent: TaskifyService.prototype.hydrateAgent,
    hydrateSession: TaskifyService.prototype.hydrateSession,
    refreshState: TaskifyService.prototype.refreshState,
    mutatePersistentAnchors: TaskifyService.prototype.mutatePersistentAnchors,
  }
  return { service, agent, session, inbox, streams: () => streams, flushes: () => flushes }
}

function successfulChunks(anchors = [{ text: '不修改后端', evidence: '后端别动' }]) {
  return [
    { type: 'text-delta', text: JSON.stringify({ anchors }) },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

function requestFor(sourceDraft, requestId = 'request-1', sessionId = 'session-1', expectedRevision = 0) {
  const lock = lockLiterals(sourceDraft)
  return {
    requestId,
    sessionId,
    expectedRevision,
    rawDraft: sourceDraft,
    sourceDraft,
    draft: lock.text,
    nonce: lock.nonce,
    literals: lock.locks,
  }
}

async function compile(fx, draft = '后端别动') {
  return TaskifyService.prototype.compile.call(fx.service, requestFor(draft))
}

async function activate(fx, draft = '后端别动') {
  const armed = await compile(fx, draft)
  const message = fx.inbox.claim('next-step', 1)[0]
  const human = createUserMessage({ content: [{ type: 'text', text: draft }], source: { kind: 'user' } })
  await bindTaskifyInboxMessages(
    fx.service.stateProjection, fx.service.ctx, { agent: fx.agent },
    async () => ({ kind: 'enter', messages: [human, message] }),
  )
  fx.session.append('user/message', message, { surfaceOp: 'append' })
  return { armed, message, state: fx.service.stateProjection.getState('session-1') }
}

test('getState returns isolated initial Host snapshots', async () => {
  const service = { stateProjection: new TaskifyStateProjection() }
  const a = await TaskifyService.prototype.getState.call(service, { sessionId: 'a' })
  const b = await TaskifyService.prototype.getState.call(service, { sessionId: 'b' })
  assert.equal(a.request.phase, 'idle')
  assert.equal(a.revision, 0)
  assert.equal(a.scope.sessionId, 'a')
  assert.equal(a.goalIntegration.available, false)
  assert.equal(a.durability.status, 'unavailable')
  assert.equal(b.sessionId, 'b')
  assert.notEqual(a, b)
})

test('max-tokens failure clears ephemeral pending state with monotonic revisions', async () => {
  const fx = fixture([
    { type: 'text-delta', text: '{"anchors":[' },
    { type: 'finish', reason: { kind: 'max-tokens' } },
  ])
  const result = await compile(fx)
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'max-tokens')
  assert.equal(result.state.request.phase, 'idle')
  assert.equal(result.state.revision, 2)
  assert.equal(fx.inbox.nextStep.length, 0)
})

test('a stream without a finish marker still clears pending state', async () => {
  const fx = fixture([{ type: 'text-delta', text: '{"anchors":[]}' }])
  const result = await compile(fx, '普通任务')
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'incomplete-result')
  assert.equal(result.state.request.phase, 'idle')
  assert.equal(result.state.revision, 2)
})

test('compile creates one identified Taskify carrier with exact contract and structured source', async () => {
  const fx = fixture(successfulChunks())
  const result = await compile(fx)
  assert.equal(result.ok, true)
  assert.equal(result.state.request.phase, 'armed')
  assert.equal(result.state.revision, 2)
  assert.equal(result.state.durability.status, 'unavailable')
  assert.equal(fx.inbox.nextStep.length, 1)
  const message = fx.inbox.nextStep[0]
  assert.equal(message.id, result.state.request.bundle.carrier.messageId)
  assert.equal(message.content[0].text, buildConstraintContract(result.state.request.bundle.anchors))
  assert.equal(message.source.kind, 'dsh-taskify')
  assert.equal(message.source.schemaVersion, 2)
  assert.equal(message.source.recordType, 'activation')
  assert.equal(message.source.sessionId, 'session-1')
  assert.equal(message.source.armedRevision, 2)
  assert.deepEqual(message.source.anchors, result.state.request.bundle.anchors)
  assert.deepEqual(fx.session.events.map(event => event.type), ['agent/inbox/spliced'])
})

test('empty anchors preserve the STEP 1 no-op without pretending to be replayable', async () => {
  const fx = fixture(successfulChunks([]), { withAgent: false })
  const result = await compile(fx, '把 README 中的 foo 改成 bar。')
  assert.equal(result.ok, true)
  assert.equal(result.state.request.phase, 'armed')
  assert.deepEqual(result.state.request.bundle.anchors, [])
  assert.equal(result.state.request.bundle.carrier, null)
  assert.equal(result.state.durability.status, 'unavailable')
})

test('missing live Agent is fail-visible and does not claim replayability', async () => {
  const fx = fixture(successfulChunks(), { withAgent: false })
  const result = await compile(fx)
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'injection-unavailable')
  assert.equal(result.state.request.phase, 'idle')
  assert.equal(result.state.revision, 2)
  assert.equal(result.state.durability.status, 'unavailable')
})

for (const [label, flush, expected] of [
  ['true', true, 'confirmed'],
  ['false', false, 'unavailable'],
  ['reject', new Error('checkpoint failed'), 'failed'],
]) {
  test(`flush ${label} maps the committed carrier to ${expected}`, async () => {
    const fx = fixture(successfulChunks(), { flush })
    const result = await compile(fx)
    assert.equal(result.ok, true)
    assert.equal(result.state.durability.status, expected)
    assert.equal(fx.inbox.nextStep.length, 1)
    assert.equal(fx.session.events.length, 1)
    assert.equal(fx.flushes(), 1)
  })
}

test('injection throw after commit does not roll back the carrier', async () => {
  const fx = fixture(successfulChunks(), {
    inject({ message, inbox }) {
      inbox.append('next-step', message)
      throw new Error('notification failed after append')
    },
  })
  const result = await compile(fx)
  assert.equal(result.ok, true)
  assert.equal(result.state.request.phase, 'armed')
  assert.equal(fx.inbox.nextStep.length, 1)
})

test('invalidate removes only the exact Taskify identity, flushes, and becomes idle', async () => {
  const fx = fixture(successfulChunks(), { flush: true })
  const unrelated = createUserMessage({ content: [{ type: 'text', text: 'other' }], source: { kind: 'plugin', plugin: 'other' } })
  fx.inbox.append('next-step', unrelated)
  const armed = await compile(fx)
  const messageId = armed.state.request.bundle.carrier.messageId
  const result = await TaskifyService.prototype.invalidate.call(fx.service, {
    sessionId: 'session-1', expectedRevision: armed.state.revision,
  })
  assert.equal(result.ok, true)
  assert.equal(result.state.request.phase, 'idle')
  assert.equal(result.state.revision, 3)
  assert.equal(result.state.durability.status, 'confirmed')
  assert.deepEqual(fx.inbox.nextStep.map(message => message.id), [unrelated.id])
  assert.equal(fx.inbox.nextStep.some(message => message.id === messageId), false)
  assert.equal(fx.session.events.at(-1).data.outcome, 'canceled')
})

test('wrong carrier identity cannot delete another pending message', async () => {
  const fx = fixture(successfulChunks())
  const armed = await compile(fx)
  const forged = structuredClone(armed.state)
  forged.request.bundle.carrier.messageId = 'wrong-message-id'
  fx.service.stateProjection.rebuild('session-1', forged)
  const result = await TaskifyService.prototype.invalidate.call(fx.service, {
    sessionId: 'session-1', expectedRevision: forged.revision,
  })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'message-not-pending')
  assert.equal(fx.inbox.nextStep.length, 1)
})

test('matching pre-step allows the existing carrier once without duplicate contract', async () => {
  const fx = fixture(successfulChunks())
  const armed = await compile(fx, '整理页面，后端别动')
  const carrier = fx.inbox.claim('next-step', 1)[0]
  const human = createUserMessage({
    content: [{ type: 'text', text: '整理页面，后端别动' }],
    source: { kind: 'user' },
  })
  const first = await bindTaskifyInboxMessages(
    fx.service.stateProjection,
    fx.service.ctx,
    { agent: fx.agent },
    async () => ({ kind: 'enter', messages: [human, carrier] }),
  )
  assert.deepEqual(first.messages.map(message => message.id), [human.id, carrier.id])
  assert.equal(first.messages.filter(message => message.source.kind === 'dsh-taskify').length, 1)
  assert.equal(first.messages[1].content[0].text, buildConstraintContract(armed.state.request.bundle.anchors))
  assert.equal(fx.service.stateProjection.getState('session-1').request.phase, 'idle')
  assert.equal(fx.service.stateProjection.getState('session-1').anchors.length, 1)
  assert.equal(fx.service.stateProjection.getState('session-1').durability.status, 'unavailable')

  const secondHuman = createUserMessage({ content: [{ type: 'text', text: '第二轮' }], source: { kind: 'user' } })
  const second = await bindTaskifyInboxMessages(
    fx.service.stateProjection,
    fx.service.ctx,
    { agent: fx.agent },
    async () => ({ kind: 'enter', messages: [secondHuman] }),
  )
  assert.deepEqual(second.messages, [secondHuman])
})

test('mismatched wake filters and requeues the same identity without consuming or bumping', async () => {
  const fx = fixture(successfulChunks(), { flush: true })
  const armed = await compile(fx, '后端别动')
  const carrier = fx.inbox.claim('next-step', 1)[0]
  const wrongHuman = createUserMessage({ content: [{ type: 'text', text: '先做别的事' }], source: { kind: 'user' } })
  const decision = await bindTaskifyInboxMessages(
    fx.service.stateProjection,
    fx.service.ctx,
    { agent: fx.agent },
    async () => ({ kind: 'enter', messages: [wrongHuman, carrier] }),
  )
  assert.deepEqual(decision.messages, [wrongHuman])
  assert.deepEqual(fx.inbox.nextStep.map(message => message.id), [carrier.id])
  assert.equal(fx.inbox.nextStep[0].source.bundleId, carrier.source.bundleId)
  const current = fx.service.stateProjection.getState('session-1')
  assert.equal(current.request.phase, 'armed')
  assert.equal(current.revision, armed.state.revision)
})

test('cache clear rebuilds the same armed snapshot from raw events plus Inbox', async () => {
  const fx = fixture(successfulChunks())
  const armed = await compile(fx)
  fx.service.stateProjection.drop('session-1')
  const rebuilt = await TaskifyService.prototype.getState.call(fx.service, { sessionId: 'session-1' })
  assert.equal(rebuilt.request.phase, 'armed')
  assert.equal(rebuilt.revision, armed.state.revision)
  assert.deepEqual(rebuilt.request.bundle, armed.state.request.bundle)
  assert.equal(rebuilt.goalIntegration.available, false)
})

test('stale compile is rejected before LLM work', async () => {
  const fx = fixture(successfulChunks([]))
  fx.service.stateProjection.update('session-1', 0, {
    type: 'begin-compile', requestId: 'fixture', boundDraft: 'old', sourceDraft: 'old',
  })
  const result = await TaskifyService.prototype.compile.call(fx.service, requestFor('new', 'stale', 'session-1', 0))
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'revision-conflict')
  assert.equal(fx.streams(), 0)
})

test('stale invalidate returns the current snapshot without mutation', async () => {
  const fx = fixture(successfulChunks())
  const armed = await compile(fx)
  const before = fx.service.stateProjection.getState('session-1')
  const result = await TaskifyService.prototype.invalidate.call(fx.service, {
    sessionId: 'session-1', expectedRevision: armed.state.revision - 1,
  })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'revision-conflict')
  assert.equal(result.state, before)
  assert.equal(fx.inbox.nextStep.length, 1)
})

test('a dirty cache is rebuilt before mutation CAS', async () => {
  const fx = fixture(successfulChunks())
  const armed = await compile(fx)
  assert.equal(fx.inbox.remove(armed.state.request.bundle.carrier.messageId), true)
  fx.service.dirtySessions.add('session-1')
  const result = await TaskifyService.prototype.invalidate.call(fx.service, {
    sessionId: 'session-1', expectedRevision: armed.state.revision,
  })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'revision-conflict')
  assert.equal(result.state.request.phase, 'idle')
  assert.equal(result.state.revision, 3)
})

test('process-local no-op state can still be invalidated with normal CAS', async () => {
  const fx = fixture(successfulChunks([]), { withAgent: false })
  const armed = await compile(fx, '普通任务')
  const result = await TaskifyService.prototype.invalidate.call(fx.service, {
    sessionId: 'session-1', expectedRevision: armed.state.revision,
  })
  assert.equal(result.ok, true)
  assert.equal(result.state.request.phase, 'idle')
  assert.equal(result.state.revision, 3)
})

test('explicit pause, resume, remove, and clear create replayable superseding snapshots', async () => {
  const fx = fixture(successfulChunks(), { flush: true })
  const activated = await activate(fx)
  const anchorId = activated.state.anchors[0].id

  const paused = await TaskifyService.prototype.pauseAnchor.call(fx.service, {
    sessionId: 'session-1', expectedRevision: 3, anchorId,
  })
  assert.equal(paused.ok, true)
  assert.equal(paused.state.anchors[0].status, 'paused')
  const pauseMessage = fx.inbox.nextStep.at(-1)
  assert.equal(pauseMessage.source.recordType, 'state-update')
  assert.equal(pauseMessage.source.operation.kind, 'pause')
  assert.match(pauseMessage.content[0].text, /supersedes="earlier"/)
  assert.match(pauseMessage.content[0].text, /Current active Taskify constraints: none/)
  assert.equal(rebuildTaskifyState({ sessionId: 'session-1', events: [...fx.session.events], inbox: fx.inbox }).state.anchors[0].status, 'paused')

  const resumed = await TaskifyService.prototype.resumeAnchor.call(fx.service, {
    sessionId: 'session-1', expectedRevision: 4, anchorId,
  })
  assert.equal(resumed.state.anchors[0].status, 'active')
  assert.equal(resumed.state.anchors[0].id, anchorId)

  const removed = await TaskifyService.prototype.removeAnchor.call(fx.service, {
    sessionId: 'session-1', expectedRevision: 5, anchorId,
  })
  assert.deepEqual(removed.state.anchors, [])
  assert.equal(removed.state.revision, 6)

  const cleared = await TaskifyService.prototype.clearAnchors.call(fx.service, {
    sessionId: 'session-1', expectedRevision: 6,
  })
  assert.deepEqual(cleared.state.anchors, [])
  assert.equal(cleared.state.revision, 7)
  assert.equal(rebuildTaskifyState({ sessionId: 'session-1', events: [...fx.session.events], inbox: fx.inbox }).state.revision, 7)
})

for (const [label, flush, expected] of [
  ['true', true, 'confirmed'],
  ['false', false, 'unavailable'],
  ['reject', new Error('lifecycle checkpoint failed'), 'failed'],
]) {
  test(`lifecycle flush ${label} reports ${expected} without rollback`, async () => {
    const fx = fixture(successfulChunks(), { flush })
    const active = await activate(fx)
    const result = await TaskifyService.prototype.pauseAnchor.call(fx.service, {
      sessionId: 'session-1', expectedRevision: active.state.revision, anchorId: active.state.anchors[0].id,
    })
    assert.equal(result.ok, true)
    assert.equal(result.state.anchors[0].status, 'paused')
    assert.equal(result.state.durability.status, expected)
    assert.equal(fx.inbox.nextStep.at(-1).source.operation.kind, 'pause')
  })
}

test('lifecycle CAS conflict and armed-request gate do not inject or mutate', async () => {
  const fx = fixture(successfulChunks())
  const active = await activate(fx)
  const anchorId = active.state.anchors[0].id
  const beforeCount = fx.inbox.nextStep.length
  const stale = await TaskifyService.prototype.pauseAnchor.call(fx.service, {
    sessionId: 'session-1', expectedRevision: 2, anchorId,
  })
  assert.equal(stale.error.code, 'revision-conflict')
  assert.equal(fx.inbox.nextStep.length, beforeCount)

  const next = await TaskifyService.prototype.compile.call(
    fx.service,
    requestFor('后端别动', 'request-2', 'session-1', active.state.revision),
  )
  assert.equal(next.state.request.phase, 'armed')
  const busy = await TaskifyService.prototype.pauseAnchor.call(fx.service, {
    sessionId: 'session-1', expectedRevision: next.state.revision, anchorId,
  })
  assert.equal(busy.error.code, 'request-busy')
  assert.equal(fx.service.stateProjection.getState('session-1').anchors[0].status, 'active')
})

test('persistent anchor cap overflow is atomic and keeps all existing identities', async () => {
  const fx = fixture(successfulChunks())
  const existing = Array.from({ length: 16 }, (_, index) => ({
    id: `existing-${index}`, text: `Existing ${index}`, evidence: `Evidence ${index}`, status: 'active',
    scope: { kind: 'session', sessionId: 'session-1' }, activatedRevision: 1,
  }))
  fx.service.stateProjection.rebuild('session-1', {
    ...createInitialTaskifyState('session-1'), revision: 3, anchors: existing,
  })
  const result = await TaskifyService.prototype.compile.call(
    fx.service,
    requestFor('后端别动', 'overflow', 'session-1', 3),
  )
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'anchor-limit')
  assert.equal(result.state.request.phase, 'idle')
  assert.deepEqual(result.state.anchors.map(anchor => anchor.id), existing.map(anchor => anchor.id))
  assert.equal(fx.inbox.nextStep.length, 0)
})
