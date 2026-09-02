import test from 'node:test'
import assert from 'node:assert/strict'
import { TaskifySession, NOTICE, taskifyAnchorDockModel } from '../src/shared/task-runner.js'
import { lockLiterals } from '../src/shared/literal-lock.js'
import { createInitialTaskifyState } from '../src/shared/state.js'

const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const carrier = value => ({ ok: true, value })

function idleState(sessionId, revision = 0) {
  return { ...createInitialTaskifyState(sessionId), revision }
}

function pendingState(sessionId, revision, requestId, draft) {
  return {
    ...idleState(sessionId, revision),
    request: { phase: 'pending', pending: { requestId, boundDraft: draft, sourceDraft: draft.trim() } },
  }
}

function armedState(sessionId, revision, draft, anchors, sourceDraft = draft.trim()) {
  return {
    ...idleState(sessionId, revision),
    request: {
      phase: 'armed',
      bundle: { requestId: 'fixture-request', boundDraft: draft, sourceDraft, anchors, carrier: null },
    },
  }
}

function persistentState(sessionId, revision, anchors) {
  return {
    ...idleState(sessionId, revision),
    request: { phase: 'idle' },
    anchors: anchors.map((anchor, index) => ({
      id: anchor.id ?? `anchor-${index + 1}`,
      text: anchor.text,
      evidence: anchor.evidence,
      status: anchor.status ?? 'active',
      scope: { kind: 'session', sessionId },
      activatedRevision: anchor.activatedRevision ?? 3,
    })),
  }
}

test('dock exposes same-draft armed anchors as pending without promoting them', () => {
  const draft = '整理页面，后端别动'
  const hostState = armedState('dock-pending', 2, draft, [
    { text: '不修改后端', evidence: '后端别动' },
  ], draft)
  hostState.anchors = persistentState('dock-pending', 1, [
    { id: 'existing', text: '保留现有接口', evidence: '现有接口' },
  ]).anchors

  const model = taskifyAnchorDockModel(hostState, draft)

  assert.equal(model.persistent.length, 1)
  assert.equal(model.persistent[0].kind, 'persistent')
  assert.equal(model.persistent[0].anchor.id, 'existing')
  assert.equal(model.pending.length, 1)
  assert.equal(model.pending[0].kind, 'pending')
  assert.deepEqual(model.pending[0].anchor, { text: '不修改后端', evidence: '后端别动' })
  assert.equal(model.noop, false)
})

test('dock hides stale armed results while preserving persistent anchors', () => {
  const hostState = armedState('dock-stale', 2, '旧草稿', [
    { text: '保留旧约束', evidence: '旧草稿' },
  ])
  hostState.anchors = persistentState('dock-stale', 1, [
    { id: 'persistent', text: '跨轮约束', evidence: '跨轮' },
  ]).anchors

  const model = taskifyAnchorDockModel(hostState, '新草稿')

  assert.equal(model.persistent.length, 1)
  assert.deepEqual(model.pending, [])
  assert.equal(model.noop, false)
})

test('dock keeps an empty same-draft armed result visible as a no-op', () => {
  const hostState = armedState('dock-noop', 2, '无需额外约束', [])
  const model = taskifyAnchorDockModel(hostState, '无需额外约束')

  assert.deepEqual(model.pending, [])
  assert.equal(model.noop, true)
})

function createRemote(sessionId, options = {}) {
  const remote = {
    state: options.state ?? idleState(sessionId),
    getStateCalls: 0,
    compileCalls: [],
    invalidateCalls: [],
    lifecycleCalls: [],
    async getState() {
      remote.getStateCalls += 1
      return carrier(remote.state)
    },
    async compile(request, signal) {
      remote.compileCalls.push({ request, signal })
      if (options.compile) return options.compile(request, signal, remote)
      remote.state = armedState(sessionId, request.expectedRevision + 2, request.rawDraft, [
        { text: '默认 Anchor', evidence: request.sourceDraft },
      ], request.sourceDraft)
      return carrier({ ok: true, requestId: request.requestId, state: remote.state })
    },
    async invalidate(request) {
      remote.invalidateCalls.push(request)
      if (options.invalidate) return options.invalidate(request, remote)
      if (request.expectedRevision !== remote.state.revision) {
        return carrier({
          ok: false,
          error: { code: 'revision-conflict', message: 'stale' },
          state: remote.state,
        })
      }
      remote.state = idleState(sessionId, remote.state.revision + 1)
      return carrier({ ok: true, state: remote.state })
    },
  }
  for (const method of ['pauseAnchor', 'resumeAnchor', 'removeAnchor', 'clearAnchors']) {
    remote[method] = async request => {
      remote.lifecycleCalls.push({ method, request })
      if (options[method]) return options[method](request, remote)
      if (request.expectedRevision !== remote.state.revision) {
        return carrier({
          ok: false,
          error: { code: 'revision-conflict', message: 'stale' },
          state: remote.state,
        })
      }
      let anchors = remote.state.anchors.map(anchor => structuredClone(anchor))
      if (method === 'clearAnchors') anchors = []
      else {
        const index = anchors.findIndex(anchor => anchor.id === request.anchorId)
        if (method === 'removeAnchor') anchors.splice(index, 1)
        else anchors[index].status = method === 'pauseAnchor' ? 'paused' : 'active'
      }
      remote.state = persistentState(sessionId, remote.state.revision + 1, anchors)
      return carrier({ ok: true, state: remote.state })
    }
  }
  return remote
}

async function hydrate(controller, remote) {
  const state = await controller.hydrate(remote)
  assert.notEqual(state, null)
  return state
}

function start(controller, {
  draft = 'abc',
  draftRev = 1,
  sourceDraft = draft.trim(),
  remote,
  getLiveDraft = () => ({ draft, draftRev }),
} = {}) {
  return controller.start({
    draft,
    draftRev,
    sourceDraft,
    lock: lockLiterals(sourceDraft),
    remote,
    getLiveDraft,
  })
}

test('empty draft is rejected after hydration before compile', async () => {
  const controller = new TaskifySession('empty')
  const remote = createRemote('empty')
  await hydrate(controller, remote)
  const result = start(controller, { draft: '   ', sourceDraft: '', remote })
  assert.equal(result, null)
  assert.equal(remote.compileCalls.length, 0)
  controller.destroy()
})

test('compile sends expectedRevision and renders only the Host-returned snapshot', async () => {
  const draft = '整理页面，后端别动'
  const controller = new TaskifySession('anchored')
  const remote = createRemote('anchored', {
    compile(request, _signal, target) {
      target.state = armedState('anchored', 2, draft, [{ text: '不修改后端', evidence: '后端别动' }], draft)
      return carrier({ ok: true, requestId: request.requestId, state: target.state })
    },
  })
  await hydrate(controller, remote)
  start(controller, { draft, remote })
  await tick()
  assert.equal(remote.compileCalls[0].request.rawDraft, draft)
  assert.equal(remote.compileCalls[0].request.expectedRevision, 0)
  assert.equal(controller.state.status, 'anchored')
  assert.equal(controller.state.hostState.revision, 2)
  assert.deepEqual(controller.state.hostState.request.bundle.anchors, [{ text: '不修改后端', evidence: '后端别动' }])
  controller.destroy()
})

test('empty Host anchors are a visible authoritative no-op success', async () => {
  const draft = '把 README 中的 foo 改成 bar。'
  const controller = new TaskifySession('noop')
  const remote = createRemote('noop', {
    compile(request, _signal, target) {
      target.state = armedState('noop', 2, draft, [], draft)
      return carrier({ ok: true, requestId: request.requestId, state: target.state })
    },
  })
  await hydrate(controller, remote)
  start(controller, { draft, remote })
  await tick()
  assert.equal(controller.state.status, 'noop')
  assert.deepEqual(controller.state.hostState.request.bundle.anchors, [])
  controller.destroy()
})

test('draft changes during extraction invalidate the returned Host revision', async () => {
  const draft = '后端别动'
  const controller = new TaskifySession('stale')
  const remote = createRemote('stale', {
    compile(request, _signal, target) {
      target.state = armedState('stale', 2, draft, [{ text: '不修改后端', evidence: draft }], draft)
      return carrier({ ok: true, requestId: request.requestId, state: target.state })
    },
  })
  await hydrate(controller, remote)
  start(controller, {
    draft,
    remote,
    getLiveDraft: () => ({ draft: '后端可以改', draftRev: 2 }),
  })
  await tick()
  assert.equal(remote.invalidateCalls.length, 1)
  assert.equal(remote.invalidateCalls[0].expectedRevision, 2)
  assert.equal(controller.state.hostState.request.phase, 'idle')
  assert.equal(controller.state.hostState.revision, 3)
  assert.equal(controller.state.status, 'error')
  assert.equal(controller.state.error.code, 'draft-changed')
  assert.equal(controller.state.notice.text, NOTICE.DRAFT_CHANGED)
  controller.destroy()
})

test('cancel aborts local work and later rehydrates Host-cleared pending state', async () => {
  const controller = new TaskifySession('cancel')
  const remote = createRemote('cancel', {
    compile(request, signal, target) {
      target.state = pendingState('cancel', 1, request.requestId, request.rawDraft)
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          target.state = idleState('cancel', 2)
          reject(new Error('aborted'))
        }, { once: true })
      })
    },
  })
  await hydrate(controller, remote)
  start(controller, { remote })
  controller.cancel()
  await tick()
  await tick()
  assert.equal(controller.state.status, 'ready')
  assert.equal(controller.state.hostState.request.phase, 'idle')
  assert.equal(controller.state.hostState.revision, 2)
  assert.equal(remote.invalidateCalls.length, 0)
  controller.destroy()
})

test('provider and transport errors remain visible while Host snapshots converge', async () => {
  const provider = new TaskifySession('provider-error')
  const providerRemote = createRemote('provider-error', {
    compile(request, _signal, target) {
      target.state = idleState('provider-error', 2)
      return carrier({
        ok: false,
        requestId: request.requestId,
        error: { code: 'llm-failed', message: 'boom' },
        state: target.state,
      })
    },
  })
  await hydrate(provider, providerRemote)
  start(provider, { remote: providerRemote })
  await tick()
  assert.equal(provider.state.status, 'error')
  assert.equal(provider.state.error.code, 'llm-failed')
  assert.equal(provider.state.hostState.revision, 2)
  provider.destroy()

  const transport = new TaskifySession('transport-error')
  const transportRemote = createRemote('transport-error', {
    compile() {
      return { ok: false, error: { code: 'transport-failed', message: 'offline' } }
    },
  })
  await hydrate(transport, transportRemote)
  start(transport, { remote: transportRemote })
  await tick()
  assert.equal(transport.state.status, 'error')
  assert.equal(transport.state.error.code, 'transport-failed')
  transport.destroy()
})

test('draft edit does not clear Client authority; explicit invalidate applies Host snapshot', async () => {
  const draft = '功能别删'
  const controller = new TaskifySession('edit')
  const remote = createRemote('edit', {
    compile(request, _signal, target) {
      target.state = armedState('edit', 2, draft, [{ text: '保留现有功能', evidence: draft }], draft)
      return carrier({ ok: true, requestId: request.requestId, state: target.state })
    },
  })
  await hydrate(controller, remote)
  start(controller, { draft, remote })
  await tick()
  assert.equal(controller.onDraftChanged('功能可以删'), true)
  assert.equal(controller.state.hostState.request.phase, 'armed')
  assert.equal(controller.state.hostState.revision, 2)
  await controller.invalidate(remote)
  assert.equal(controller.state.hostState.request.phase, 'idle')
  assert.equal(controller.state.hostState.revision, 3)
  controller.destroy()
})

test('invalid Host response provenance is rejected defensively', async () => {
  const controller = new TaskifySession('bad-provenance')
  const remote = createRemote('bad-provenance', {
    compile(request, _signal, target) {
      target.state = armedState('bad-provenance', 2, '整理页面', [{ text: '不修改后端', evidence: '后端别动' }], '整理页面')
      return carrier({ ok: true, requestId: request.requestId, state: target.state })
    },
  })
  await hydrate(controller, remote)
  start(controller, { draft: '整理页面', remote })
  await tick()
  assert.equal(controller.state.status, 'error')
  assert.equal(controller.state.error.code, 'bad-response')
  controller.destroy()
})

test('compile revision conflict rehydrates current Host state without retrying mutation', async () => {
  const controller = new TaskifySession('compile-conflict')
  const remote = createRemote('compile-conflict', {
    compile(request, _signal, target) {
      target.state = armedState('compile-conflict', 4, '另一客户端草稿', [{ text: 'Host 状态', evidence: '另一客户端草稿' }])
      return carrier({
        ok: false,
        requestId: request.requestId,
        error: { code: 'revision-conflict', message: 'stale revision' },
        state: target.state,
      })
    },
  })
  await hydrate(controller, remote)
  start(controller, { draft: '本地草稿', remote })
  await tick()
  assert.equal(remote.compileCalls.length, 1)
  assert.equal(remote.getStateCalls, 2)
  assert.equal(controller.state.hostState.revision, 4)
  assert.equal(controller.state.hostState.request.bundle.boundDraft, '另一客户端草稿')
  assert.equal(controller.state.error.code, 'revision-conflict')
  controller.destroy()
})

test('invalidate revision conflict rehydrates Host state without silent retry', async () => {
  const cached = armedState('invalidate-conflict', 2, '旧草稿', [{ text: '旧', evidence: '旧草稿' }])
  const remote = createRemote('invalidate-conflict', { state: cached })
  const controller = new TaskifySession('invalidate-conflict')
  await hydrate(controller, remote)
  remote.state = armedState('invalidate-conflict', 3, '新草稿', [{ text: '新', evidence: '新草稿' }])
  const changed = controller.onDraftChanged('本地编辑')
  assert.equal(changed, true)
  assert.equal(await controller.invalidate(remote), false)
  assert.equal(remote.invalidateCalls.length, 1)
  assert.equal(remote.invalidateCalls[0].expectedRevision, 2)
  assert.equal(controller.state.hostState.revision, 3)
  assert.equal(controller.state.hostState.request.bundle.boundDraft, '新草稿')
  assert.equal(remote.getStateCalls, 2)
  controller.destroy()
})

test('destroying disposable Client caches neither invalidates Host nor crosses sessions', async () => {
  const aRemote = createRemote('a', { state: armedState('a', 2, 'A 草稿', [{ text: 'A', evidence: 'A 草稿' }]) })
  const bRemote = createRemote('b', { state: armedState('b', 7, 'B 草稿', [{ text: 'B', evidence: 'B 草稿' }]) })
  const a = new TaskifySession('a')
  const b = new TaskifySession('b')
  await hydrate(a, aRemote)
  await hydrate(b, bRemote)
  assert.equal(a.state.hostState.request.bundle.anchors[0].text, 'A')
  assert.equal(b.state.hostState.request.bundle.anchors[0].text, 'B')
  a.destroy()
  assert.equal(aRemote.invalidateCalls.length, 0)
  assert.equal(aRemote.state.request.phase, 'armed')
  assert.equal(b.state.hostState.revision, 7)
  b.destroy()
})

test('persistent anchors survive draft edits, request consumption, and Client remount hydration', async () => {
  const active = persistentState('persistent-client', 3, [
    { id: 'stable-anchor', text: '后端保持不变', evidence: '后端别动' },
  ])
  const remote = createRemote('persistent-client', { state: active })
  const first = new TaskifySession('persistent-client')
  await hydrate(first, remote)
  assert.equal(first.state.hostState.request.phase, 'idle')
  assert.equal(first.state.hostState.anchors[0].id, 'stable-anchor')
  assert.equal(first.onDraftChanged('完全不同的新草稿'), false)
  assert.equal(first.state.hostState.anchors[0].id, 'stable-anchor')
  first.destroy()

  const remounted = new TaskifySession('persistent-client')
  await hydrate(remounted, remote)
  assert.equal(remote.getStateCalls, 2)
  assert.equal(remounted.state.status, 'anchored')
  assert.deepEqual(remounted.state.hostState.anchors, active.anchors)
  remounted.destroy()
})

test('Pause, Resume, Remove, and Clear accept only Host-returned authoritative snapshots', async () => {
  const remote = createRemote('lifecycle-client', {
    state: persistentState('lifecycle-client', 3, [
      { id: 'a', text: 'A', evidence: 'A' },
      { id: 'b', text: 'B', evidence: 'B' },
    ]),
  })
  const controller = new TaskifySession('lifecycle-client')
  await hydrate(controller, remote)

  assert.equal(await controller.pauseAnchor('a', remote), true)
  assert.equal(controller.state.hostState.anchors[0].status, 'paused')
  assert.equal(await controller.resumeAnchor('a', remote), true)
  assert.equal(controller.state.hostState.anchors[0].status, 'active')
  assert.equal(await controller.removeAnchor('a', remote), true)
  assert.deepEqual(controller.state.hostState.anchors.map(anchor => anchor.id), ['b'])
  assert.equal(await controller.clearAnchors(remote), true)
  assert.deepEqual(controller.state.hostState.anchors, [])
  assert.deepEqual(remote.lifecycleCalls.map(call => [call.method, call.request.expectedRevision]), [
    ['pauseAnchor', 3],
    ['resumeAnchor', 4],
    ['removeAnchor', 5],
    ['clearAnchors', 6],
  ])
  controller.destroy()
})

test('lifecycle Host errors do not fake local success and stale revisions rehydrate without retry', async () => {
  const initial = persistentState('lifecycle-errors', 3, [
    { id: 'a', text: 'A', evidence: 'A' },
  ])
  const remote = createRemote('lifecycle-errors', {
    state: initial,
    pauseAnchor(_request, target) {
      return carrier({
        ok: false,
        error: { code: 'lifecycle-rejected', message: 'Host rejected pause' },
        state: target.state,
      })
    },
    removeAnchor(_request, target) {
      target.state = persistentState('lifecycle-errors', 5, [
        { id: 'a', text: 'A', evidence: 'A', status: 'paused' },
      ])
      return carrier({
        ok: false,
        error: { code: 'revision-conflict', message: 'stale revision' },
        state: target.state,
      })
    },
  })
  const controller = new TaskifySession('lifecycle-errors')
  await hydrate(controller, remote)

  assert.equal(await controller.pauseAnchor('a', remote), false)
  assert.equal(controller.state.hostState.anchors[0].status, 'active')
  assert.equal(controller.state.notice.text, 'Host rejected pause')

  assert.equal(await controller.removeAnchor('a', remote), false)
  assert.equal(remote.lifecycleCalls.filter(call => call.method === 'removeAnchor').length, 1)
  assert.equal(remote.getStateCalls, 2)
  assert.equal(controller.state.hostState.revision, 5)
  assert.equal(controller.state.hostState.anchors[0].status, 'paused')
  controller.destroy()
})
