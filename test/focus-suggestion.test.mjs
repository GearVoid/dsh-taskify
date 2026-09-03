import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFocusSuggestionUserPayload,
  FOCUS_SUGGESTION_SYSTEM_PROMPT,
  parseFocusSuggestionOutput,
} from '../src/shared/focus-suggestion.js'

test('Focus suggestion has an independent scope-only model contract', () => {
  assert.match(FOCUS_SUGGESTION_SYSTEM_PROMPT, /handled separately as Anchors/)
  assert.match(FOCUS_SUGGESTION_SYSTEM_PROMPT, /Do not include, paraphrase, or summarize any constraint represented by an extracted Anchor/)
  assert.match(FOCUS_SUGGESTION_SYSTEM_PROMPT, /Do not invent paths, files, dependencies, APIs, tests/)
  assert.match(FOCUS_SUGGESTION_SYSTEM_PROMPT, /return null/)
  assert.doesNotMatch(FOCUS_SUGGESTION_SYSTEM_PROMPT, /"anchors"/)
  assert.equal(
    buildFocusSuggestionUserPayload('实现 Focus suggestion'),
    '<current_user_draft>\n实现 Focus suggestion\n</current_user_draft>\n\n<extracted_anchors>\n[]\n</extracted_anchors>\n\nSuggest one optional Focus draft, or null.',
  )
})

test('Focus suggestion prompt receives one or multiple extracted Anchors as exclusions', () => {
  const anchors = [
    { text: '后端不要动 stat', evidence: '后端别动 stat' },
    { text: '不要进入其他功能开发', evidence: '不要进入其他功能开发' },
  ]
  const payload = buildFocusSuggestionUserPayload('调整 dashboard，后端别动 stat。不要进入其他功能开发。', anchors)
  assert.match(payload, /<extracted_anchors>/)
  assert.match(payload, /"text":"后端不要动 stat","evidence":"后端别动 stat"/)
  assert.match(payload, /"text":"不要进入其他功能开发","evidence":"不要进入其他功能开发"/)
})

test('Focus suggestion parser accepts a bounded scope draft or null', () => {
  assert.deepEqual(
    parseFocusSuggestionOutput('{"focus":"实现 Focus suggestion 的生成与确认 UI"}', '实现 Focus suggestion 的生成与确认 UI'),
    { ok: true, suggestion: '实现 Focus suggestion 的生成与确认 UI' },
  )
  assert.deepEqual(parseFocusSuggestionOutput('{"focus":null}', '任务范围不明确'), { ok: true, suggestion: null })
})

test('Focus suggestion rejects invented concrete details and repeated hard constraints', () => {
  assert.equal(
    parseFocusSuggestionOutput('{"focus":"修改 src/auth.ts 的登录逻辑"}', '修复登录问题').error.code,
    'concrete-claim-invented',
  )
  assert.equal(
    parseFocusSuggestionOutput('{"focus":"实现页面调整，不修改后端"}', '实现页面调整，后端别动').error.code,
    'hard-constraint-in-focus',
  )
  assert.equal(
    parseFocusSuggestionOutput('{"focus":"完成登录修复及相关测试"}', '修复登录问题').error.code,
    'technical-scope-invented',
  )
})

test('Focus suggestion keeps the main task and rejects exact Anchor repetition without semantic dedupe', () => {
  const source = '调整 dashboard 的卡片布局，使其更紧凑。后端别动 stat。不要进入其他功能开发。'
  const anchors = [
    { text: '后端不要动 stat', evidence: '后端别动 stat' },
    { text: '不要进入其他功能开发', evidence: '不要进入其他功能开发' },
  ]
  assert.deepEqual(
    parseFocusSuggestionOutput('{"focus":"调整 dashboard 的卡片布局，使其更紧凑"}', source, anchors),
    { ok: true, suggestion: '调整 dashboard 的卡片布局，使其更紧凑' },
  )
  assert.equal(
    parseFocusSuggestionOutput('{"focus":"调整 dashboard，并且后端别动 stat"}', source, anchors).error.code,
    'anchor-repeated-in-focus',
  )
  assert.equal(
    parseFocusSuggestionOutput('{"focus":"调整 dashboard，不要进入其他功能开发"}', source, anchors).error.code,
    'anchor-repeated-in-focus',
  )
  assert.equal(
    parseFocusSuggestionOutput('{"focus":"调整 dashboard，后端和 stat 保持不动"}', source, anchors).error.code,
    'hard-constraint-in-focus',
  )
})
