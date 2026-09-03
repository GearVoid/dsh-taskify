import test from 'node:test'
import assert from 'node:assert/strict'

import { anchorProvenanceForDisplay, normalizeDisplayWhitespace } from '../src/client/display.js'

test('display whitespace normalization is comparison-only', () => {
  assert.equal(normalizeDisplayWhitespace('  不许\n写入\t文件  '), '不许 写入 文件')
})

test('matching Anchor text and evidence do not repeat provenance', () => {
  assert.equal(anchorProvenanceForDisplay({
    text: '不许 写入文件',
    evidence: '  不许\n写入文件  ',
  }), null)
})

test('summarized Anchor text exposes the exact evidence with a user-facing title', () => {
  const evidence = '后端\n别动'
  assert.deepEqual(anchorProvenanceForDisplay({ text: '不修改后端', evidence }), {
    title: '来自你的原话',
    evidence,
  })
})
