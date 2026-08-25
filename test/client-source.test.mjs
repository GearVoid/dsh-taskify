import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/client/index.jsx', import.meta.url), 'utf8')

test('client never rewrites or auto-submits the composer draft', () => {
  assert.equal(source.includes('inputActions.setDraft'), false)
  assert.equal(source.includes('inputActions.submit'), false)
  assert.equal(source.includes('onApply:'), false)
})

test('client mounts read-only anchors in the official input dock', () => {
  assert.equal(source.includes("conversation.input.dock"), true)
  assert.equal(source.includes('TaskifyAnchors'), true)
  assert.equal(source.includes('来源：'), true)
  assert.equal(source.includes('未发现需要额外锚定的约束'), true)
})
