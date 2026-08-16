import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFinalDraft, parseSlashDraft } from '../src/shared/slash.js'
import { estimateDepth } from '../src/shared/depth.js'
import { isReferenceBlocked, REFERENCE_BLOCKED_NOTICE } from '../src/shared/reference.js'

test('T06: /plan prefix is preserved while only the body is compiled', () => {
  const parsed = parseSlashDraft('/plan 帮我整理一下登录页，不改后端')
  assert.equal(parsed.kind, 'command')
  assert.equal(parsed.command, '/plan')
  assert.equal(parsed.body, '帮我整理一下登录页，不改后端')
  assert.equal(buildFinalDraft(parsed, '任务\n整理登录页', '/plan 帮我整理一下登录页，不改后端'), '/plan 任务\n整理登录页')
})

test('command-only draft is detected and never compiled', () => {
  assert.equal(parseSlashDraft('/plan').kind, 'command-only')
  assert.equal(parseSlashDraft('/plan   ').kind, 'command-only')
  assert.equal(parseSlashDraft('   ').kind, 'empty')
  assert.equal(parseSlashDraft('/plan\n').kind, 'command-only')
})

test('plain draft remains plain', () => {
  const parsed = parseSlashDraft('修一下 src/app.ts')
  assert.equal(parsed.kind, 'plain')
  assert.equal(parsed.draft, '修一下 src/app.ts')
})

test('depth heuristic keeps precise tasks light and vague UI work deeper', () => {
  assert.equal(estimateDepth('修复 src/app.ts 第183行的空指针，不改API'), 'LIGHT')
  assert.equal(estimateDepth('这个 dashboard 太乱了，表格和卡片都整理下，后端不要碰'), 'DEEP')
  assert.equal(estimateDepth('登录按钮不好看'), 'STANDARD')
})

test('T15: reference chips block enhancement and carry the frozen notice', () => {
  assert.equal(isReferenceBlocked([]), false)
  assert.equal(isReferenceBlocked([{ occurrenceId: 1 }]), true)
  assert.equal(REFERENCE_BLOCKED_NOTICE.includes('引用'), true)
})
