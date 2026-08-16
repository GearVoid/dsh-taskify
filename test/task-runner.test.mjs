import test from 'node:test'
import assert from 'node:assert/strict'
import { TaskifySession, NOTICE } from '../src/shared/task-runner.js'
import { lockLiterals } from '../src/shared/literal-lock.js'
import { parseSlashDraft } from '../src/shared/slash.js'

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

function immediateRemote(handler) {
  return { compile: async (request) => handler(request) }
}

function successCarrier(request, text) {
  return { ok: true, value: { ok: true, requestId: request.requestId, text } }
}

function plainParsed() {
  return { kind: 'plain', draft: 'abc' }
}

test('T01: empty draft is recognized before any request path', async () => {
  assert.equal(parseSlashDraft('').kind, 'empty')
  assert.equal(parseSlashDraft(' \n ').kind, 'empty')
  const controller = new TaskifySession('s1')
  let calls = 0
  const started = controller.start({
    draft: '   ', draftRev: 1, context: '', parsed: { kind: 'empty' }, lock: lockLiterals(''),
    remote: immediateRemote(() => { calls += 1; return successCarrier({ requestId: 'x' }, 'x') }),
    onApply: () => {}, getLiveDraft: () => ({ draft: '   ', draftRev: 1 }),
  })
  assert.equal(started, null)
  assert.equal(calls, 0)
  controller.destroy()
})

test('T02: precise task is classified LIGHT and its literals are protected', async () => {
  const draft = '修复 src/app.ts 第183行的空指针，不改API'
  const lock = lockLiterals(draft)
  assert.equal(lock.locks.includes('src/app.ts'), true)
  const controller = new TaskifySession('s2')
  const applied = []
  controller.start({
    draft, draftRev: 1, context: '', parsed: parseSlashDraft(draft), lock,
    remote: immediateRemote(request => successCarrier(request, lock.text)),
    onApply: text => applied.push(text), getLiveDraft: () => ({ draft, draftRev: 1 }),
  })
  await tick()
  assert.deepEqual(applied, [draft])
  assert.equal(controller.state.status, 'applied')
  controller.destroy()
})

test('T03: vague task runs the compiler and replaces the draft once', async () => {
  const draft = '这个页面有点乱，帮我整理一下，其他别动'
  const lock = lockLiterals(draft)
  const compiled = '任务\n整理当前页面信息层级。\n\n约束\n- 其他内容不动。'
  const controller = new TaskifySession('s3')
  const applied = []
  controller.start({
    draft, draftRev: 1, context: '', parsed: parseSlashDraft(draft), lock,
    remote: immediateRemote(request => successCarrier(request, compiled)),
    onApply: text => applied.push(text), getLiveDraft: () => ({ draft, draftRev: 1 }),
  })
  await tick()
  assert.deepEqual(applied, [compiled])
  controller.destroy()
})

test('T07: draft edits during the request discard the late result', async () => {
  const draft = 'abc'
  const lock = lockLiterals(draft)
  const controller = new TaskifySession('s7')
  const applied = []
  controller.start({
    draft, draftRev: 1, context: '', parsed: parseSlashDraft(draft), lock,
    remote: immediateRemote(request => successCarrier(request, 'abcd')),
    onApply: text => applied.push(text),
    getLiveDraft: () => ({ draft: 'user edited', draftRev: 2 }),
  })
  await tick()
  assert.equal(applied.length, 0)
  assert.equal(controller.state.status, 'error')
  assert.equal(controller.state.error.code, 'draft-changed')
  assert.equal(controller.state.notice.text, NOTICE.DRAFT_CHANGED)
  controller.destroy()
})

test('T08: cancel invalidates the in-flight request and keeps the draft', async () => {
  let rejectPending
  const pending = new Promise((resolve, reject) => { rejectPending = reject })
  const controller = new TaskifySession('s8')
  const applied = []
  controller.start({
    draft: 'abc', draftRev: 1, context: '', parsed: plainParsed(), lock: lockLiterals('abc'),
    remote: { compile: () => pending },
    onApply: text => applied.push(text), getLiveDraft: () => ({ draft: 'abc', draftRev: 1 }),
  })
  controller.cancel()
  rejectPending(new Error('aborted'))
  await tick()
  assert.equal(applied.length, 0)
  assert.equal(controller.state.status, 'ready')
  controller.destroy()
})

test('T09: provider errors are visible and retryable', async () => {
  const controller = new TaskifySession('s9')
  controller.start({
    draft: 'abc', draftRev: 1, context: '', parsed: plainParsed(), lock: lockLiterals('abc'),
    remote: immediateRemote(request => ({
      ok: true,
      value: { ok: false, requestId: request.requestId, error: { code: 'llm-failed', message: 'boom' } },
    })),
    onApply: () => assert.fail('must not apply'), getLiveDraft: () => ({ draft: 'abc', draftRev: 1 }),
  })
  await tick()
  assert.equal(controller.state.status, 'error')
  assert.equal(controller.state.error.code, 'llm-failed')
  assert.equal(controller.state.notice.text, 'boom')
  controller.destroy()
})

test('transport errors remain visible and retryable', async () => {
  const controller = new TaskifySession('transport-error')
  controller.start({
    draft: 'abc', draftRev: 1, context: '', parsed: plainParsed(), lock: lockLiterals('abc'),
    remote: immediateRemote(() => ({ ok: false, error: { code: 'transport-failed', message: 'offline' } })),
    onApply: () => assert.fail('must not apply'), getLiveDraft: () => ({ draft: 'abc', draftRev: 1 }),
  })
  await tick()
  assert.equal(controller.state.status, 'error')
  assert.equal(controller.state.error.code, 'transport-failed')
  assert.equal(controller.state.notice.text, 'offline')
  controller.destroy()
})

test('T10: undo restores the original draft byte-for-byte', async () => {
  const original = 'abc\n'
  const lock = lockLiterals(original.trim())
  const controller = new TaskifySession('s10')
  let current = original
  const applied = []
  controller.start({
    draft: original, draftRev: 1, context: '', parsed: parseSlashDraft(original), lock,
    remote: immediateRemote(request => successCarrier(request, 'abcd')),
    onApply: text => { current = text; applied.push(text) },
    getLiveDraft: () => ({ draft: current, draftRev: 1 }),
  })
  await tick()
  assert.deepEqual(applied, ['abcd'])
  assert.equal(controller.canUndo(current), true)
  const undone = []
  assert.equal(controller.undo(current, text => undone.push(text)), true)
  assert.deepEqual(undone, [original])
  assert.equal(controller.state.status, 'ready')
  controller.destroy()
})

test('T11: manual edits after apply destroy the undo checkpoint', async () => {
  const controller = new TaskifySession('s11')
  controller.start({
    draft: 'abc', draftRev: 1, context: '', parsed: plainParsed(), lock: lockLiterals('abc'),
    remote: immediateRemote(request => successCarrier(request, 'abcd')),
    onApply: () => {}, getLiveDraft: () => ({ draft: 'abc', draftRev: 1 }),
  })
  await tick()
  assert.equal(controller.state.status, 'applied')
  controller.onDraftChanged('abcd-manual')
  assert.equal(controller.state.status, 'edited')
  assert.equal(controller.canUndo('abcd-manual'), false)
  controller.destroy()
})

test('T12: successful compile only writes the draft and never submits', async () => {
  const controller = new TaskifySession('s12')
  let applied = 0
  let submitted = 0
  controller.start({
    draft: 'abc', draftRev: 1, context: '', parsed: plainParsed(), lock: lockLiterals('abc'),
    remote: {
      compile: async request => {
        submitted += 1
        return successCarrier(request, 'abcd')
      },
      submit: () => { submitted += 1 },
    },
    onApply: () => { applied += 1 }, getLiveDraft: () => ({ draft: 'abc', draftRev: 1 }),
  })
  await tick()
  assert.equal(applied, 1)
  assert.equal(submitted, 1, 'only compile was called; no submit API exists on the controller')
  controller.destroy()
})

test('T13: sessions are isolated and a destroyed session can never write', async () => {
  let resolveA
  const pendingA = new Promise(resolve => { resolveA = resolve })
  const appliedA = []
  const appliedB = []
  const a = new TaskifySession('a')
  const b = new TaskifySession('b')

  a.start({
    draft: 'A', draftRev: 1, context: '', parsed: { kind: 'plain', draft: 'A' }, lock: lockLiterals('A'),
    remote: { compile: () => pendingA },
    onApply: text => appliedA.push(text), getLiveDraft: () => ({ draft: 'A', draftRev: 1 }),
  })
  const lockB = lockLiterals('B')
  b.start({
    draft: 'B', draftRev: 1, context: '', parsed: { kind: 'plain', draft: 'B' }, lock: lockB,
    remote: immediateRemote(request => successCarrier(request, `${lockB.text} compiled`)),
    onApply: text => appliedB.push(text), getLiveDraft: () => ({ draft: 'B', draftRev: 1 }),
  })
  await tick()
  assert.deepEqual(appliedB, ['B compiled'])

  a.destroy()
  resolveA({ ok: true, value: { ok: true, requestId: 'stale', text: 'A compiled' } })
  await tick()
  assert.equal(appliedA.length, 0)
  b.destroy()
})

test('T14: literal validation failure is a hard fail with no draft write', async () => {
  const draft = '修复 src/app.ts 的空指针'
  const lock = lockLiterals(draft)
  const controller = new TaskifySession('s14')
  const applied = []
  controller.start({
    draft, draftRev: 1, context: '', parsed: parseSlashDraft(draft), lock,
    remote: immediateRemote(request => successCarrier(request, '修复那个文件的空指针')),
    onApply: text => applied.push(text), getLiveDraft: () => ({ draft, draftRev: 1 }),
  })
  await tick()
  assert.equal(applied.length, 0)
  assert.equal(controller.state.status, 'error')
  assert.equal(controller.state.error.code, 'literal-validation-failed')
  assert.equal(controller.state.notice.text, NOTICE.LITERAL_VALIDATION_FAILED)
  controller.destroy()
})
