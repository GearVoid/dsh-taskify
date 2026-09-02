import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCompilerUserPayload,
  buildConstraintContract,
  COMPILER_SYSTEM_PROMPT,
  parseCompilerOutput,
} from '../src/shared/compiler.js'
import { lockLiterals } from '../src/shared/literal-lock.js'
import {
  compileRequestSchema,
  compileResultSchema,
  anchorMutationRequestSchema,
  clearAnchorsRequestSchema,
  getStateRequestSchema,
  invalidateRequestSchema,
  invalidateResultSchema,
  taskifyStateSnapshotSchema,
} from '../src/shared/schema.js'
import { createInitialTaskifyState } from '../src/shared/state.js'

function parseResult(sourceDraft, output) {
  const lock = lockLiterals(sourceDraft)
  return parseCompilerOutput(output, { lockedDraft: lock.text, sourceDraft, lock })
}

test('wire schemas expose revisioned Host state without conversation context', () => {
  const request = compileRequestSchema.parse({
    requestId: 'r1', sessionId: 's1', rawDraft: '后端别动', sourceDraft: '后端别动',
    draft: '后端别动', nonce: 'ABCDEF12', literals: [], expectedRevision: 0,
  })
  assert.equal('context' in request, false)
  assert.equal(request.sourceDraft, '后端别动')
  assert.equal(request.expectedRevision, 0)
  const state = {
    ...createInitialTaskifyState('s1'),
    revision: 2,
    request: {
      phase: 'armed',
      bundle: {
        requestId: 'r1', boundDraft: '后端别动', sourceDraft: '后端别动',
        anchors: [{ text: '不修改后端', evidence: '后端别动' }], carrier: null,
      },
    },
  }
  const ok = compileResultSchema.parse({
    ok: true, requestId: 'r1', state,
  })
  assert.deepEqual(ok.state.request.bundle.anchors, [{ text: '不修改后端', evidence: '后端别动' }])
  assert.deepEqual(getStateRequestSchema.parse({ sessionId: 's1' }), { sessionId: 's1' })
  assert.deepEqual(invalidateRequestSchema.parse({ sessionId: 's1', expectedRevision: 2 }), { sessionId: 's1', expectedRevision: 2 })
  assert.equal(invalidateResultSchema.parse({ ok: true, state: createInitialTaskifyState('s1') }).state.request.phase, 'idle')
  assert.deepEqual(anchorMutationRequestSchema.parse({ sessionId: 's1', expectedRevision: 2, anchorId: 'a1' }), {
    sessionId: 's1', expectedRevision: 2, anchorId: 'a1',
  })
  assert.deepEqual(clearAnchorsRequestSchema.parse({ sessionId: 's1', expectedRevision: 2 }), {
    sessionId: 's1', expectedRevision: 2,
  })
  assert.throws(() => compileRequestSchema.parse({ requestId: '', sessionId: 's1' }))
})

test('state and mutation schemas strictly reject unknown fields and invalid revisions', () => {
  const request = {
    requestId: 'r1', sessionId: 's1', expectedRevision: 0, rawDraft: '后端别动', sourceDraft: '后端别动',
    draft: '后端别动', nonce: 'ABCDEF12', literals: [],
  }
  assert.throws(() => compileRequestSchema.parse({ ...request, unexpected: true }), /unknown field/)
  assert.throws(() => compileRequestSchema.parse({ ...request, expectedRevision: -1 }), /expectedRevision/)
  assert.throws(() => compileRequestSchema.parse({ ...request, expectedRevision: 1.5 }), /expectedRevision/)
  assert.throws(() => invalidateRequestSchema.parse({ sessionId: 's1', expectedRevision: Number.MAX_SAFE_INTEGER + 1 }))
  assert.throws(() => getStateRequestSchema.parse({ sessionId: 's1', extra: 1 }), /unknown field/)
})

test('state schema rejects fake goal availability, invalid scope, and malformed phase data', () => {
  const idle = createInitialTaskifyState('s1')
  assert.throws(() => taskifyStateSnapshotSchema.parse({
    ...idle,
    goalIntegration: { available: true },
  }), /must be false/)
  assert.throws(() => taskifyStateSnapshotSchema.parse({
    ...idle,
    scope: { kind: 'goal', sessionId: 's1' },
  }), /exact session/)
  assert.throws(() => taskifyStateSnapshotSchema.parse({
    ...idle,
    request: { phase: 'armed' },
  }), /state.request.bundle/)
  assert.throws(() => taskifyStateSnapshotSchema.parse({
    ...idle,
    unknown: true,
  }), /unknown field/)
})

test('system prompt is extraction-only and permits an empty result', () => {
  assert.equal(COMPILER_SYSTEM_PROMPT.includes('constraint extractor'), true)
  assert.equal(COMPILER_SYSTEM_PROMPT.includes('Analyze ONLY'), true)
  assert.equal(COMPILER_SYSTEM_PROMPT.includes('conversation history'), true)
  assert.equal(COMPILER_SYSTEM_PROMPT.includes('{"anchors"'), true)
  assert.equal(COMPILER_SYSTEM_PROMPT.includes('ADAPTIVE DEPTH'), false)
})

test('user payload contains only the current draft source', () => {
  const payload = buildCompilerUserPayload({ draft: '后端别动' })
  assert.equal(payload.includes('<current_user_draft>\n后端别动\n</current_user_draft>'), true)
  assert.equal(payload.includes('conversation_context'), false)
})

test('explicit hard constraint keeps exact provenance', () => {
  const result = parseResult('后端别动', '{"anchors":[{"text":"不修改后端","evidence":"后端别动"}]}')
  assert.deepEqual(result, { ok: true, anchors: [{ text: '不修改后端', evidence: '后端别动' }] })
})

test('no-op is a valid success state', () => {
  assert.deepEqual(parseResult('把 README 中的 foo 改成 bar。', '{"anchors":[]}'), { ok: true, anchors: [] })
})

test('soft preferences cannot be strengthened into hard anchors', () => {
  const simple = parseResult('尽量简单', '{"anchors":[{"text":"不新增依赖","evidence":"尽量简单"}]}')
  assert.equal(simple.ok, false)
  assert.equal(simple.error.code, 'modal-strengthening')

  const backend = parseResult('最好别碰后端', '{"anchors":[{"text":"不修改后端","evidence":"最好别碰后端"}]}')
  assert.equal(backend.ok, false)
  assert.equal(backend.error.code, 'modal-strengthening')

  const clipped = parseResult('最好别碰后端', '{"anchors":[{"text":"不修改后端","evidence":"别碰后端"}]}')
  assert.equal(clipped.ok, false)
  assert.equal(clipped.error.code, 'modal-strengthening')

  const separateHardConstraint = parseResult(
    '尽量简单，不要修改后端',
    '{"anchors":[{"text":"不修改后端","evidence":"不要修改后端"}]}',
  )
  assert.deepEqual(separateHardConstraint, {
    ok: true,
    anchors: [{ text: '不修改后端', evidence: '不要修改后端' }],
  })
})

test('every anchor evidence must be an exact current-draft substring', () => {
  const result = parseResult('整理 Dashboard', '{"anchors":[{"text":"不修改后端","evidence":"后端别动"}]}')
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'missing-provenance')
})

test('protected paths, CLI flags, versions, and identifiers survive byte-for-byte', () => {
  const sourceDraft = '不要修改 `src/auth/token.ts`，保持 API v2.1.0 不变，也不要运行 --force'
  const lock = lockLiterals(sourceDraft)
  const lockedClauses = lock.text.split('，')
  const output = JSON.stringify({
    anchors: lockedClauses.map(clause => ({ text: clause, evidence: clause })),
  })
  const result = parseCompilerOutput(output, { lockedDraft: lock.text, sourceDraft, lock })
  assert.equal(result.ok, true)
  assert.deepEqual(result.anchors.map(anchor => anchor.text), [
    '不要修改 `src/auth/token.ts`',
    '保持 API v2.1.0 不变',
    '也不要运行 --force',
  ])
})

test('concrete claim guard rejects a new path absent from evidence and source', () => {
  const result = parseResult('后端别动', '{"anchors":[{"text":"不修改 src/new.ts","evidence":"后端别动"}]}')
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'concrete-claim-invented')
})

test('constraint contract is omitted for no-op and escapes structural text', () => {
  assert.equal(buildConstraintContract([]), '')
  assert.equal(
    buildConstraintContract([{ text: '保留 <API> & 功能', evidence: 'x' }]),
    '<taskify_constraints>\n- 保留 &lt;API&gt; &amp; 功能\n</taskify_constraints>',
  )
})
