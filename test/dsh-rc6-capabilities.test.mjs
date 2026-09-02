import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { Inbox, agentEvents } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import {
  TASKIFY_SOURCE_KIND,
  classifyFlush,
  filterMismatchedTaskifyBindings,
  foldTaskifySourceEvents,
  isTaskifySourcedMessage,
  taskifyStructuredPayload,
} from './helpers/rc6-capability.mjs'

const projectRequire = createRequire(import.meta.url)
const agentPeerRequire = createRequire(import.meta.resolve('@deepseek-ai/dsh-agent/package.json'))

async function importAgentPeer(name) {
  return import(pathToFileURL(agentPeerRequire.resolve(name)).href)
}

const {
  KNOWN_SESSION_EVENT_TYPES,
  Session,
  SessionId,
  SessionStore,
} = await importAgentPeer('@deepseek-ai/dsh-session')
const { SystemPrompt, renderContextSnapshot } = await importAgentPeer('@deepseek-ai/dsh-system-prompt')
const { createScope } = await importAgentPeer('@deepseek-ai/dsh-scope')

async function resolvedVersion(name, resolver = projectRequire) {
  const manifest = JSON.parse(await readFile(resolver.resolve(`${name}/package.json`), 'utf8'))
  return manifest.version
}

function taskifyMessage(boundDraft, payload = {}) {
  return createUserMessage({
    content: [{ type: 'text', text: 'Taskify contract fixture' }],
    source: {
      kind: TASKIFY_SOURCE_KIND,
      schemaVersion: 1,
      payload: { boundDraft, ...payload },
    },
  })
}

function notifications() {
  const calls = { inserted: [], discarded: [], claimed: [] }
  return {
    calls,
    handlers: {
      inserted(message) { calls.inserted.push(message.id) },
      discarded(message) { calls.discarded.push(message.id) },
      claimed(message) { calls.claimed.push(message.id) },
    },
  }
}

function makeLiveStore(id) {
  const ctx = new Context()
  const store = new SessionStore(ctx)
  const session = store.prepare(SessionId(id))
  const detach = store.enter(session)
  store.announce(session)
  return { ctx, store, session, detach }
}

test('capability baseline resolves the audited DSH packages at rc.6', async () => {
  const direct = [
    '@deepseek-ai/dsh-agent',
    '@deepseek-ai/dsh-agent-default-model',
    '@deepseek-ai/dsh-llm',
    '@deepseek-ai/dsh-typert-protocol',
  ]
  const transitive = [
    '@deepseek-ai/dsh-invariants',
    '@deepseek-ai/dsh-scope',
    '@deepseek-ai/dsh-session',
    '@deepseek-ai/dsh-system-prompt',
  ]

  for (const name of direct) assert.equal(await resolvedVersion(name), '0.1.0-rc.6', name)
  for (const name of transitive) assert.equal(await resolvedVersion(name, agentPeerRequire), '0.1.0-rc.6', name)
  assert.equal(await resolvedVersion('@deepseek-ai/cordis'), '4.0.1')
})

test('Inbox preserves Taskify source JSON and has exact remove/replace identity semantics', () => {
  const session = Session.create(SessionId('inbox-contract'))
  const notice = notifications()
  const inbox = new Inbox(session, notice.handlers)
  const original = taskifyMessage('human draft', {
    constraints: [{ id: 'anchor-1', enabled: true, note: null }],
    revision: 7,
  })

  inbox.append('next-step', original)
  assert.equal(inbox.nextStep.length, 1)
  assert.equal(inbox.nextStep[0].id, original.id)
  assert.deepEqual(taskifyStructuredPayload(inbox.nextStep[0]), original.source.payload)
  assert.equal(Object.isFrozen(inbox.nextStep[0]), true)
  assert.deepEqual(session.events.map(event => event.type), ['agent/inbox/spliced'])
  assert.equal(session.events.every(event => KNOWN_SESSION_EVENT_TYPES.has(event.type)), true)

  const replacement = taskifyMessage('human draft', { revision: 8 })
  assert.equal(inbox.replace(original.id, replacement), true)
  assert.equal(inbox.nextStep[0].id, replacement.id)
  assert.equal(inbox.nextStep.some(message => message.id === original.id), false)
  assert.deepEqual(notice.calls.discarded, [original.id])
  assert.deepEqual(notice.calls.inserted, [original.id, replacement.id])
  assert.equal(inbox.replace(original.id, taskifyMessage('unused')), false)

  const replayedSession = Session.fromRestore(
    session.id,
    structuredClone(session.events),
    structuredClone(session.header),
  )
  const replayedInbox = new Inbox(replayedSession, notifications().handlers)
  assert.deepEqual(replayedInbox.nextStep.map(message => message.id), [replacement.id])
  assert.equal(replayedInbox.remove(replacement.id), true)
  assert.equal(replayedInbox.nextStep.length, 0)
  assert.equal(replayedInbox.remove(replacement.id), false)
  assert.equal(replayedSession.events.at(-1).type, 'agent/inbox/spliced')
  assert.equal(replayedSession.events.at(-1).data.outcome, 'canceled')
})

test('raw known-event fold recovers Taskify payloads and distinguishes lifecycle operations', () => {
  const session = Session.create(SessionId('raw-fold-contract'))
  const inbox = new Inbox(session, notifications().handlers)

  const entered = taskifyMessage('enter me', { revision: 1, nested: { values: [1, true, null] } })
  inbox.append('next-step', entered)
  inbox.claim('next-step', 1)
  session.append('user/message', entered, { surfaceOp: 'append' })
  session.append('user/message', entered, { surfaceOp: 'append' })

  const replaced = taskifyMessage('replace me', { revision: 2 })
  const replacement = taskifyMessage('replace me', { revision: 3 })
  inbox.append('next-step', replaced)
  inbox.replace(replaced.id, replacement)
  inbox.remove(replacement.id)

  const unrelated = createUserMessage({
    content: [{ type: 'text', text: 'ordinary input' }],
    source: { kind: 'user' },
  })
  session.append('user/message', unrelated, { surfaceOp: 'append' })

  const shadowed = taskifyMessage('survive compaction', { revision: 4 })
  const shadowedEvent = session.append('user/message', shadowed, { surfaceOp: 'append' })
  const summary = createUserMessage({
    content: [{ type: 'text', text: 'surface replacement' }],
    source: { kind: 'plugin', plugin: 'compaction-fixture' },
  })
  session.append('user/message', summary, {
    surfaceOp: { op: 'replace', start: shadowedEvent.seq, end: shadowedEvent.seq },
    sourceEventSeqs: [shadowedEvent.seq],
  })

  assert.equal(session.events.every(event => KNOWN_SESSION_EVENT_TYPES.has(event.type)), true)
  assert.equal(session.deriveMessages().some(message => message.id === shadowed.id), false)

  const folded = foldTaskifySourceEvents(session.events)
  const byId = new Map(folded.records.map(record => [record.id, record]))
  assert.deepEqual(byId.get(entered.id).payload, entered.source.payload)
  assert.equal(byId.get(entered.id).status, 'entered')
  assert.equal(byId.get(entered.id).enteredSeqs.length, 1)
  assert.equal(byId.get(entered.id).duplicateSeqs.length, 1)
  assert.equal(byId.get(replaced.id).status, 'replaced')
  assert.equal(byId.get(replacement.id).status, 'canceled')
  assert.equal(byId.get(shadowed.id).status, 'entered')
  assert.deepEqual(byId.get(shadowed.id).payload, shadowed.source.payload)
  assert.deepEqual(folded.pending, { 'next-turn': [], 'next-step': [] })
  assert.equal(folded.transitions.some(transition => transition.kind === 'claim' && transition.id === entered.id), true)
  assert.equal(folded.transitions.some(transition => transition.kind === 'duplicate' && transition.id === entered.id), true)
  assert.equal(folded.transitions.some(transition => transition.kind === 'replace' && transition.from[0] === replaced.id), true)
  assert.equal(folded.transitions.some(transition => transition.kind === 'remove' && transition.id === replacement.id), true)
  assert.equal(folded.ignoredUserMessages, 2)
})

test('flush true maps to confirmed durability', async () => {
  const fixture = makeLiveStore('flush-confirmed')
  let observed
  const dispose = fixture.ctx.on('session/flush', async session => { observed = session })
  try {
    const result = await classifyFlush(() => fixture.store.flush(fixture.session))
    assert.deepEqual(result, { durability: 'confirmed' })
    assert.equal(observed, fixture.session)
  } finally {
    dispose()
    fixture.detach()
  }
})

test('flush false maps to unavailable durability without disabling process-local state', async () => {
  const fixture = makeLiveStore('flush-unavailable')
  try {
    const inbox = new Inbox(fixture.session, notifications().handlers)
    const message = taskifyMessage('process local')
    inbox.append('next-step', message)

    const result = await classifyFlush(() => fixture.store.flush(fixture.session))
    assert.deepEqual(result, { durability: 'unavailable' })
    assert.equal(inbox.nextStep[0].id, message.id)
    assert.equal(fixture.session.events.length, 1)
  } finally {
    fixture.detach()
  }
})

test('flush rejection maps to failed and does not pretend an append was rolled back', async () => {
  const fixture = makeLiveStore('flush-failed')
  const failure = new Error('persistence fixture failed')
  const dispose = fixture.ctx.on('session/flush', async () => { throw failure })
  try {
    const inbox = new Inbox(fixture.session, notifications().handlers)
    const message = taskifyMessage('already appended')
    inbox.append('next-step', message)
    const before = fixture.session.events

    const result = await classifyFlush(() => fixture.store.flush(fixture.session))
    assert.equal(result.durability, 'failed')
    assert.equal(result.error, failure)
    assert.equal(fixture.session.events.length, before.length)
    assert.equal(fixture.session.events[0].data.inserted[0].id, message.id)
    assert.equal(inbox.nextStep[0].id, message.id)
  } finally {
    dispose()
    fixture.detach()
  }
})

test('systemPrompt.context is agent-scoped, dynamic, empty-safe, and not a system section', async () => {
  const ctx = new Context()
  const systemPrompt = new SystemPrompt(ctx, {
    includeHarnessIdentity: false,
    includeRuntimeContext: true,
    persona: '',
  })
  const agentKey = { id: 'prompt-agent' }
  const scope = createScope(ctx, agentKey)
  let state = 'constraint revision 1'
  let reads = 0
  const dispose = scope.ctx.systemPrompt.context({
    name: 'dsh-taskify:constraints',
    order: 50,
    text: () => {
      reads += 1
      return state
    },
  })

  try {
    const first = await systemPrompt.assemble({ scope: agentKey })
    assert.deepEqual(first.contexts, [{ name: 'dsh-taskify:constraints', text: 'constraint revision 1' }])
    assert.equal(first.sections.some(section => section.name === 'dsh-taskify:constraints'), false)
    assert.match(renderContextSnapshot(first), /constraint revision 1/)

    const global = await systemPrompt.assemble()
    assert.equal(global.contexts.some(context => context.name === 'dsh-taskify:constraints'), false)

    state = 'constraint revision 2'
    const second = await systemPrompt.assemble({ scope: agentKey })
    assert.equal(second.contexts[0].text, 'constraint revision 2')

    state = ''
    const empty = await systemPrompt.assemble({ scope: agentKey })
    assert.equal(empty.contexts[0].text, '')
    assert.equal(renderContextSnapshot(empty), '')
    assert.equal(reads, 3)
  } finally {
    dispose()
    await scope.dispose()
  }
})

test('agent/pre-step can validate exact downstream human-to-Taskify binding without owning state', async () => {
  const ctx = new Context()
  const agentKey = { id: 'pre-step-agent' }
  const dispose = ctx.on('agent/pre-step', filterMismatchedTaskifyBindings)
  const human = createUserMessage({
    content: [{ type: 'text', text: 'keep backend unchanged' }],
    source: { kind: 'user' },
  })
  const matched = taskifyMessage('keep backend unchanged', { revision: 1 })
  const mismatched = taskifyMessage('different draft', { revision: 2 })
  const sameTextButNotHuman = createUserMessage({
    content: [{ type: 'text', text: 'plugin-only draft' }],
    source: { kind: 'plugin', plugin: 'other' },
  })
  const boundToPluginText = taskifyMessage('plugin-only draft', { revision: 3 })
  const downstream = [human, matched, mismatched, sameTextButNotHuman, boundToPluginText]
  let downstreamCalled = false

  try {
    const decision = await agentEvents(ctx, agentKey).waterfall(
      'agent/pre-step',
      { messages: [], turn: 1, step: 1, signal: new AbortController().signal },
      async () => {
        downstreamCalled = true
        return { kind: 'enter', messages: downstream }
      },
    )

    assert.equal(downstreamCalled, true)
    assert.deepEqual(decision.messages.map(message => message.id), [human.id, matched.id, sameTextButNotHuman.id])
    assert.equal(isTaskifySourcedMessage(matched), true)
    assert.equal(isTaskifySourcedMessage(human), false)
    assert.equal(decision.messages.some(message => message.id === mismatched.id), false)
    assert.equal(decision.messages.some(message => message.id === boundToPluginText.id), false)
  } finally {
    dispose()
  }
})

test('agent/turn-stopping serial dispatch awaits its handler; loop continuation remains unproven', async () => {
  const ctx = new Context()
  const agentKey = { id: 'turn-stopping-agent' }
  const order = []
  const dispose = ctx.on('agent/turn-stopping', async payload => {
    order.push(`handler:${payload.turn}:start`)
    await Promise.resolve()
    order.push(`handler:${payload.turn}:end`)
  })

  try {
    order.push('dispatch:start')
    await agentEvents(ctx, agentKey).serial('agent/turn-stopping', {
      turn: 9,
      signal: new AbortController().signal,
    })
    order.push('dispatch:end')
    assert.deepEqual(order, [
      'dispatch:start',
      'handler:9:start',
      'handler:9:end',
      'dispatch:end',
    ])
  } finally {
    dispose()
  }
})
