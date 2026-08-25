import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSlashDraft } from '../src/shared/slash.js'
import { isReferenceBlocked, REFERENCE_BLOCKED_NOTICE } from '../src/shared/reference.js'

test('slash prefix is excluded while its current-user body remains the source', () => {
  const parsed = parseSlashDraft('/plan 帮我整理一下登录页，不改后端')
  assert.deepEqual(parsed, {
    kind: 'command',
    command: '/plan',
    body: '帮我整理一下登录页，不改后端',
  })
})

test('command-only and empty drafts never enter extraction', () => {
  assert.equal(parseSlashDraft('/plan').kind, 'command-only')
  assert.equal(parseSlashDraft('/plan   ').kind, 'command-only')
  assert.equal(parseSlashDraft('   ').kind, 'empty')
  assert.equal(parseSlashDraft('/plan\n').kind, 'command-only')
})

test('plain draft remains byte-for-byte available', () => {
  const draft = '修一下 src/app.ts  '
  const parsed = parseSlashDraft(draft)
  assert.equal(parsed.kind, 'plain')
  assert.equal(parsed.draft, draft)
})

test('reference chips block extraction with the current product copy', () => {
  assert.equal(isReferenceBlocked([]), false)
  assert.equal(isReferenceBlocked([{ occurrenceId: 1 }]), true)
  assert.equal(REFERENCE_BLOCKED_NOTICE.includes('引用'), true)
  assert.equal(REFERENCE_BLOCKED_NOTICE.includes('提取约束'), true)
})
