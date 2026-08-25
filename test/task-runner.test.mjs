import test from 'node:test'
import assert from 'node:assert/strict'
import { TaskifySession, NOTICE } from '../src/shared/task-runner.js'
import { lockLiterals } from '../src/shared/literal-lock.js'

const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const immediateRemote = handler => ({ compile: async request => handler(request) })
const successCarrier = (request, anchors) => ({ ok: true, value: { ok: true, requestId: request.requestId, anchors } })

function start(controller, {
  draft = 'abc',
  draftRev = 1,
  sourceDraft = draft.trim(),
  remote,
  getLiveDraft = () => ({ draft, draftRev }),
  onInvalidate = () => {},
} = {}) {
  return controller.start({
    draft,
    draftRev,
    sourceDraft,
    lock: lockLiterals(sourceDraft),
    remote,
    getLiveDraft,
    onInvalidate,
  })
}

test('empty draft is rejected before any request', () => {
  const controller = new TaskifySession('empty')
  let calls = 0
  const result = start(controller, {
    draft: '   ',
    sourceDraft: '',
    remote: immediateRemote(() => { calls += 1 }),
  })
  assert.equal(result, null)
  assert.equal(calls, 0)
  controller.destroy()
})

test('successful extraction attaches anchors without rewriting the raw draft', async () => {
  const draft = '整理页面，后端别动'
  const controller = new TaskifySession('anchored')
  let request
  start(controller, {
    draft,
    remote: immediateRemote(value => {
      request = value
      return successCarrier(value, [{ text: '不修改后端', evidence: '后端别动' }])
    }),
  })
  await tick()
  assert.equal(request.rawDraft, draft)
  assert.equal(request.sourceDraft, draft)
  assert.equal(controller.state.status, 'anchored')
  assert.equal(controller.state.anchoredDraft, draft)
  assert.deepEqual(controller.state.anchors, [{ text: '不修改后端', evidence: '后端别动' }])
  controller.destroy()
})

test('empty anchors are a visible no-op success', async () => {
  const draft = '把 README 中的 foo 改成 bar。'
  const controller = new TaskifySession('noop')
  start(controller, { draft, remote: immediateRemote(request => successCarrier(request, [])) })
  await tick()
  assert.equal(controller.state.status, 'noop')
  assert.deepEqual(controller.state.anchors, [])
  controller.destroy()
})

test('draft edits during extraction discard the stale result and invalidate Host state', async () => {
  const draft = '后端别动'
  const controller = new TaskifySession('stale')
  let invalidations = 0
  start(controller, {
    draft,
    remote: immediateRemote(request => successCarrier(request, [{ text: '不修改后端', evidence: '后端别动' }])),
    getLiveDraft: () => ({ draft: '后端可以改', draftRev: 2 }),
    onInvalidate: () => { invalidations += 1 },
  })
  await tick()
  assert.equal(controller.state.status, 'error')
  assert.equal(controller.state.error.code, 'draft-changed')
  assert.equal(controller.state.notice.text, NOTICE.DRAFT_CHANGED)
  assert.equal(invalidations, 1)
  controller.destroy()
})

test('cancel aborts the request, keeps no anchors, and invalidates Host state', async () => {
  let rejectPending
  const pending = new Promise((resolve, reject) => { rejectPending = reject })
  const controller = new TaskifySession('cancel')
  let invalidations = 0
  start(controller, {
    remote: { compile: () => pending },
    onInvalidate: () => { invalidations += 1 },
  })
  controller.cancel()
  rejectPending(new Error('aborted'))
  await tick()
  assert.equal(controller.state.status, 'ready')
  assert.deepEqual(controller.state.anchors, [])
  assert.equal(invalidations, 1)
  controller.destroy()
})

test('provider and transport errors remain visible and retryable', async () => {
  const provider = new TaskifySession('provider-error')
  start(provider, { remote: immediateRemote(request => ({
    ok: true,
    value: { ok: false, requestId: request.requestId, error: { code: 'llm-failed', message: 'boom' } },
  })) })
  await tick()
  assert.equal(provider.state.status, 'error')
  assert.equal(provider.state.error.code, 'llm-failed')
  assert.equal(provider.state.notice.text, 'boom')
  provider.destroy()

  const transport = new TaskifySession('transport-error')
  start(transport, { remote: immediateRemote(() => ({
    ok: false, error: { code: 'transport-failed', message: 'offline' },
  })) })
  await tick()
  assert.equal(transport.state.status, 'error')
  assert.equal(transport.state.error.code, 'transport-failed')
  transport.destroy()
})

test('editing an anchored draft clears read-only anchors and requests Host invalidation', async () => {
  const draft = '功能别删'
  const controller = new TaskifySession('edit')
  start(controller, {
    draft,
    remote: immediateRemote(request => successCarrier(request, [{ text: '保留现有功能', evidence: '功能别删' }])),
  })
  await tick()
  assert.equal(controller.state.status, 'anchored')
  assert.equal(controller.onDraftChanged('功能可以删'), true)
  assert.equal(controller.state.status, 'ready')
  assert.deepEqual(controller.state.anchors, [])
  controller.destroy()
})

test('invalid response provenance is rejected defensively', async () => {
  const controller = new TaskifySession('bad-provenance')
  start(controller, {
    draft: '整理页面',
    remote: immediateRemote(request => successCarrier(request, [{ text: '不修改后端', evidence: '后端别动' }])),
  })
  await tick()
  assert.equal(controller.state.status, 'error')
  assert.equal(controller.state.error.code, 'bad-response')
  controller.destroy()
})

test('sessions stay isolated and a destroyed session ignores late results', async () => {
  let resolveA
  const pendingA = new Promise(resolve => { resolveA = resolve })
  const a = new TaskifySession('a')
  const b = new TaskifySession('b')
  start(a, { draft: 'A 后端别动', remote: { compile: () => pendingA } })
  start(b, {
    draft: 'B 功能别删',
    remote: immediateRemote(request => successCarrier(request, [{ text: '保留功能', evidence: '功能别删' }])),
  })
  await tick()
  assert.equal(b.state.status, 'anchored')
  a.destroy()
  resolveA({ ok: true, value: { ok: true, requestId: 'stale', anchors: [{ text: 'x', evidence: 'A' }] } })
  await tick()
  assert.equal(a.disposed, true)
  assert.equal(b.state.anchors[0].text, '保留功能')
  b.destroy()
})
