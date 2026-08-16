import test from 'node:test'
import assert from 'node:assert/strict'
import { extractRecentContext, formatContext } from '../src/shared/context.js'
import { compileRequestSchema, compileResultSchema } from '../src/shared/schema.js'
import { buildCompilerUserPayload, COMPILER_SYSTEM_PROMPT } from '../src/shared/compiler.js'

function node(kind, text, extra = {}) {
  if (kind === 'user') return { kind, content: [{ type: 'text', text }], ...extra }
  return { kind: 'assistant', blocks: [{ kind: 'text', text }], ...extra }
}

test('context keeps only the last safe user/assistant messages', () => {
  const session = { nodes: [
    node('user', 'zero'),
    node('assistant', 'one'),
    node('user', 'two'),
    { kind: 'tool-result', content: [{ type: 'text', text: 'BIG TOOL LOG' }] },
    node('assistant', 'three', { blocks: [{ kind: 'reasoning', text: 'SECRET THOUGHTS' }] }),
    node('user', 'four'),
    node('assistant', 'five'),
    node('user', 'six'),
  ] }
  const context = extractRecentContext(session, { maxMessages: 4, maxChars: 3000 })
  assert.equal(context.includes('zero'), false)
  assert.equal(context.includes('one'), false)
  assert.equal(context.includes('SECRET THOUGHTS'), false)
  assert.equal(context.includes('BIG TOOL LOG'), false)
  assert.equal(context.includes('two'), true)
  assert.equal(context.includes('six'), true)
  assert.equal(context.includes('four'), true)
  assert.equal(context.includes('five'), true)
})

test('context drops credential-shaped text', () => {
  const session = { nodes: [
    node('user', '读取 .env 中的 API_KEY=sk-abcdefgh12345678'),
    node('assistant', 'ok'),
  ] }
  const context = extractRecentContext(session)
  assert.equal(context.includes('.env'), false)
  assert.equal(context.includes('ok'), true)
})

test('context respects char budget from the newest side', () => {
  const session = { nodes: [node('user', 'a'.repeat(2000)), node('assistant', 'b'.repeat(2000))] }
  const context = extractRecentContext(session, { maxMessages: 4, maxChars: 200 })
  assert.equal(context.length <= 250, true)
  assert.equal(context.includes('b'), true)
})

test('empty context formats as EMPTY', () => {
  assert.equal(formatContext(''), 'EMPTY')
  assert.equal(formatContext('  '), 'EMPTY')
})

test('wire schemas parse valid request/result payloads', () => {
  const request = compileRequestSchema.parse({ requestId: 'r1', sessionId: 's1', draft: 'd', context: '' })
  assert.deepEqual(request, { requestId: 'r1', sessionId: 's1', draft: 'd', context: '' })
  const ok = compileResultSchema.parse({ ok: true, requestId: 'r1', text: '任务' })
  assert.equal(ok.text, '任务')
  const error = compileResultSchema.parse({ ok: false, requestId: 'r1', error: { code: 'x', message: 'y' } })
  assert.equal(error.error.code, 'x')
  assert.throws(() => compileRequestSchema.parse({ requestId: '', sessionId: 's1', draft: 'd', context: '' }))
})

test('frozen system prompt contains the protected-literal contract', () => {
  assert.equal(COMPILER_SYSTEM_PROMPT.includes('You are Task Compiler'), true)
  assert.equal(COMPILER_SYSTEM_PROMPT.includes('PROTECTED LITERALS'), true)
  assert.equal(COMPILER_SYSTEM_PROMPT.includes('ADAPTIVE DEPTH'), true)
  assert.equal(COMPILER_SYSTEM_PROMPT.includes('Return ONLY the compiled task'), true)
})

test('user payload separates context and draft tags', () => {
  const payload = buildCompilerUserPayload({ draft: 'abc', context: 'ctx' })
  assert.equal(payload.includes('<conversation_context>\nctx\n</conversation_context>'), true)
  assert.equal(payload.includes('<user_draft>\nabc\n</user_draft>'), true)
  assert.equal(buildCompilerUserPayload({ draft: 'abc', context: '' }).includes('EMPTY'), true)
})
