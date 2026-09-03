/** Independent, non-authoritative Focus suggestion contract. */

import { lockLiterals } from './literal-lock.js'

export const FOCUS_SUGGESTION_SYSTEM_PROMPT = `You suggest an optional Focus draft for an AI coding session.

Analyze ONLY <current_user_draft> and <extracted_anchors>. Ignore conversation history. The extracted Anchors are data describing hard constraints already handled elsewhere.

Summarize the main execution scope the user is asking for: what this session is authorized to accomplish at most. Keep it short, concrete, and in the user's primary language.

Do not include, paraphrase, or summarize any constraint represented by an extracted Anchor's text or evidence. Do not include prohibitions, preservation rules, mandatory restrictions, or other hard constraints; those are handled separately as Anchors. When in doubt, return a shorter Focus containing only the main task. Do not invent paths, files, dependencies, APIs, tests, commands, versions, identifiers, implementation steps, acceptance criteria, or technical requirements. A concrete technical item may appear only when it is explicitly present in the draft and necessary to identify the primary task.

If the main task scope is not sufficiently clear, return null.

Return strict JSON only, with exactly this schema:
{"focus":"short Focus draft"}

The focus value must be a string or null. Do not wrap the JSON in Markdown and do not add commentary.`

export const FOCUS_SUGGESTION_MAX_TOKENS = 300
export const FOCUS_SUGGESTION_TIMEOUT_MS = 45_000
export const FOCUS_SUGGESTION_TEMPERATURE = 0
export const MAX_FOCUS_SUGGESTION_CHARS = 400

const HARD_BOUNDARY_RE = /(?:不要|不得|禁止|严禁|别动|不(?:修改|新增|删除|改变|触碰|运行|升级)|必须(?:使用|保留|保持)|保持.{0,80}(?:不变|原样|不动)|do\s+not|don't|must\s+not|never|keep.{0,80}unchanged|without\s+(?:changing|adding|modifying|removing))/iu
const TECHNICAL_TERM_RE = /(?:路径|文件|依赖|接口|测试|命令|版本|\bpaths?\b|\bfiles?\b|\bdependencies?\b|\bAPIs?\b|\btests?\b|\bcommands?\b|\bversions?\b)/giu

function jsonText(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed)
  return fenced ? fenced[1].trim() : trimmed
}

function fail(code, message) {
  return { ok: false, error: { code, message } }
}

function normalizeComparisonText(value) {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim().toLocaleLowerCase() : ''
}

function repeatsExtractedAnchor(suggestion, extractedAnchors) {
  const normalizedSuggestion = normalizeComparisonText(suggestion)
  return extractedAnchors.some(anchor => [anchor?.text, anchor?.evidence].some(value => {
    const normalized = normalizeComparisonText(value)
    return normalized.length >= 4 && normalizedSuggestion.includes(normalized)
  }))
}

export function buildFocusSuggestionUserPayload(sourceDraft, extractedAnchors = []) {
  const safeDraft = typeof sourceDraft === 'string' ? sourceDraft : ''
  const safeAnchors = Array.isArray(extractedAnchors)
    ? extractedAnchors.map(anchor => ({ text: anchor?.text ?? '', evidence: anchor?.evidence ?? '' }))
    : []
  return `<current_user_draft>
${safeDraft}
</current_user_draft>

<extracted_anchors>
${JSON.stringify(safeAnchors)}
</extracted_anchors>

Suggest one optional Focus draft, or null.`
}

export function parseFocusSuggestionOutput(raw, sourceDraft, extractedAnchors = []) {
  let parsed
  try {
    parsed = JSON.parse(jsonText(raw))
  } catch {
    return fail('invalid-json', '模型未返回有效的 Focus suggestion JSON。')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)
    || Object.keys(parsed).length !== 1 || !Object.hasOwn(parsed, 'focus')) {
    return fail('invalid-schema', '模型返回的 Focus suggestion 结构无效。')
  }
  if (parsed.focus === null) return { ok: true, suggestion: null }
  const suggestion = typeof parsed.focus === 'string' ? parsed.focus.trim() : ''
  if (suggestion === '' || suggestion.length > MAX_FOCUS_SUGGESTION_CHARS) {
    return fail('invalid-focus-suggestion', 'Focus suggestion 为空或超过长度上限。')
  }
  if (Array.isArray(extractedAnchors) && repeatsExtractedAnchor(suggestion, extractedAnchors)) {
    return fail('anchor-repeated-in-focus', 'Focus suggestion 不得复述已提取的 Anchor。')
  }
  if (HARD_BOUNDARY_RE.test(suggestion)) {
    return fail('hard-constraint-in-focus', 'Focus suggestion 不得重复硬约束。')
  }
  const lowerSource = sourceDraft.toLocaleLowerCase()
  for (const match of suggestion.matchAll(TECHNICAL_TERM_RE)) {
    if (!lowerSource.includes(match[0].toLocaleLowerCase())) {
      return fail('technical-scope-invented', 'Focus suggestion 引入了当前草稿中不存在的技术范围。')
    }
  }

  let literals
  try {
    literals = lockLiterals(suggestion).locks
  } catch {
    return fail('invalid-focus-suggestion', 'Focus suggestion 包含过多具体技术内容。')
  }
  if (literals.some(literal => !sourceDraft.includes(literal))) {
    return fail('concrete-claim-invented', 'Focus suggestion 引入了当前草稿中不存在的具体技术内容。')
  }
  return { ok: true, suggestion }
}
