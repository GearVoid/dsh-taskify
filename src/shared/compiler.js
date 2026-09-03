/**
 * Frozen v0.2 constraint-extraction contract and result validation.
 */

import { lockLiterals, makeSentinel, unlockResult, UNKNOWN_SENTINEL_RE } from './literal-lock.js'

export const COMPILER_SYSTEM_PROMPT = `You are Taskify, a constraint extractor for an AI coding agent.

Analyze ONLY <current_user_draft> and <already_represented_constraints>. Ignore all conversation history. The already represented constraints are exclusion context from the current authoritative persistent Anchors.

Extract only hard boundaries the user explicitly states in this draft. A hard boundary is a clear prohibition, mandatory preservation rule, or explicit restriction such as "do not modify the backend", "keep the API unchanged", "only analyze; do not edit code", or "do not add dependencies".

Return only constraints that are new and not already expressed by <already_represented_constraints>. Do not return an existing constraint again, and do not paraphrase or reword an existing constraint into a new Anchor. If every hard constraint is already represented, return an empty anchors array.

Do not extract preferences, wishes, style requests, vague guidance, or softened language such as "try to", "prefer", "ideally", "if possible", "尽量", "最好", "尽可能", "感觉", or "别搞太复杂". Never strengthen modality. If the user says "最好别碰后端", do not turn it into a prohibition.

Every anchor MUST include a minimal, exact evidence substring copied from <current_user_draft>. If there is no exact evidence, omit the anchor. Do not infer best practices, safety advice, technical facts, filenames, APIs, commands, versions, identifiers, acceptance criteria, or implementation steps.

Protected tokens such as __DSH_TASKIFY_AB12CD34_LOCK_000__ are immutable literals. Copy them exactly when they occur in an anchor or its evidence. Never invent, alter, split, or partially copy a protected token.

Return strict JSON only, with exactly this schema:
{"anchors":[{"text":"short normalized constraint","evidence":"exact source substring"}]}

The anchors array may be empty and must contain at most 8 items. Keep the user's primary language. Normalization may shorten or clarify, but must never make the source stronger. Do not wrap the JSON in Markdown and do not add commentary.`

export const COMPILER_MAX_TOKENS = 800
export const COMPILER_TIMEOUT_MS = 45_000
export const COMPILER_TEMPERATURE = 0
export const MAX_ANCHORS = 8
export const MAX_ANCHOR_TEXT_CHARS = 240
export const MAX_EVIDENCE_CHARS = 320

const SOFT_MODAL_RE = /(?:尽量|最好|尽可能|如果可以|可以的话|希望|感觉|倾向于|try\s+to|prefer(?:ably)?|ideally|if\s+possible|would\s+like|maybe|perhaps)/iu
const CLAUSE_BOUNDARY_RE = /[，,。！？!?；;\r\n]/u

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function jsonText(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed)
  return fenced ? fenced[1].trim() : trimmed
}

function fail(code, message) {
  return { ok: false, error: { code, message } }
}

function validateSentinelSubset(value, lock) {
  const expected = new Map(lock.locks.map((_, index) => [makeSentinel(lock.nonce, index), index]))
  let previousIndex = -1
  for (const match of value.matchAll(UNKNOWN_SENTINEL_RE)) {
    const literalIndex = expected.get(match[0])
    if (literalIndex === undefined) return false
    if (value.indexOf(match[0]) !== value.lastIndexOf(match[0])) return false
    if (literalIndex < previousIndex) return false
    previousIndex = literalIndex
  }
  const withoutKnown = [...expected.keys()].reduce((text, sentinel) => text.replaceAll(sentinel, ''), value)
  return !withoutKnown.includes('__DSH_TASKIFY_')
}

function hasInventedConcreteClaim(text, evidence, sourceDraft) {
  const concrete = lockLiterals(text).locks
  return concrete.some(literal => !sourceDraft.includes(literal) || !evidence.includes(literal))
}

function evidenceHasOnlySoftContexts(sourceDraft, evidence) {
  let offset = 0
  let found = false
  while (offset <= sourceDraft.length) {
    const index = sourceDraft.indexOf(evidence, offset)
    if (index === -1) break
    found = true
    let start = index
    while (start > 0 && !CLAUSE_BOUNDARY_RE.test(sourceDraft[start - 1])) start -= 1
    let end = index + evidence.length
    while (end < sourceDraft.length && !CLAUSE_BOUNDARY_RE.test(sourceDraft[end])) end += 1
    if (!SOFT_MODAL_RE.test(sourceDraft.slice(start, end))) return false
    offset = index + Math.max(evidence.length, 1)
  }
  return found
}

/** Build the model-visible locked draft plus authoritative exclusion texts. */
export function buildCompilerUserPayload({ draft, existingAnchorTexts = [] }) {
  const safeDraft = typeof draft === 'string' ? draft : ''
  const safeExistingAnchorTexts = Array.isArray(existingAnchorTexts)
    ? existingAnchorTexts.filter(text => typeof text === 'string')
    : []
  return `<current_user_draft>
${safeDraft}
</current_user_draft>

<already_represented_constraints>
${JSON.stringify(safeExistingAnchorTexts)}
</already_represented_constraints>

Extract explicit hard constraint anchors from current_user_draft.`
}

/**
 * Parse, provenance-check, unlock, and concrete-claim-check one model result.
 * Evidence must be an exact substring of the locked current draft; historical
 * conversation content is never accepted as a source.
 */
export function parseCompilerOutput(raw, { lockedDraft, sourceDraft, lock }) {
  let parsed
  try {
    parsed = JSON.parse(jsonText(raw))
  } catch {
    return fail('invalid-json', '模型未返回有效的 Anchor JSON。')
  }
  if (!isRecord(parsed) || Object.keys(parsed).some(key => key !== 'anchors') || !Array.isArray(parsed.anchors)) {
    return fail('invalid-schema', '模型返回的 Anchor 结构无效。')
  }
  if (parsed.anchors.length > MAX_ANCHORS) {
    return fail('too-many-anchors', `Anchor 数量超过上限（${MAX_ANCHORS}）。`)
  }

  const anchors = []
  const seen = new Set()
  for (const item of parsed.anchors) {
    if (!isRecord(item) || Object.keys(item).some(key => key !== 'text' && key !== 'evidence')) {
      return fail('invalid-schema', '模型返回了无效的 Anchor。')
    }
    const text = typeof item.text === 'string' ? item.text.trim() : ''
    const evidence = typeof item.evidence === 'string' ? item.evidence.trim() : ''
    if (!text || !evidence || text.length > MAX_ANCHOR_TEXT_CHARS || evidence.length > MAX_EVIDENCE_CHARS) {
      return fail('invalid-anchor', 'Anchor 或 evidence 为空或超过长度上限。')
    }
    if (!lockedDraft.includes(evidence)) {
      return fail('missing-provenance', 'Anchor 的 evidence 无法追溯到当前草稿。')
    }
    if (!validateSentinelSubset(text, lock) || !validateSentinelSubset(evidence, lock)) {
      return fail('literal-validation-failed', 'Anchor 未通过关键内容保护校验。')
    }

    const restoredText = unlockResult(text, lock).trim()
    const restoredEvidence = unlockResult(evidence, lock).trim()
    if (!sourceDraft.includes(restoredEvidence)) {
      return fail('missing-provenance', 'Anchor 的 evidence 无法追溯到当前草稿。')
    }
    if (evidenceHasOnlySoftContexts(sourceDraft, restoredEvidence)) {
      return fail('modal-strengthening', '偏好性表达不能升级为硬约束。')
    }
    if (hasInventedConcreteClaim(restoredText, restoredEvidence, sourceDraft)) {
      return fail('concrete-claim-invented', 'Anchor 引入了当前草稿中不存在的具体代码事实。')
    }

    const key = `${restoredText}\u0000${restoredEvidence}`
    if (seen.has(key)) continue
    seen.add(key)
    anchors.push({ text: restoredText, evidence: restoredEvidence })
  }
  return { ok: true, anchors }
}

export function buildConstraintContract(anchors) {
  if (!Array.isArray(anchors) || anchors.length === 0) return ''
  const escapeXml = value => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replace(/[\r\n]+/g, ' ')
  return `<taskify_constraints>\n${anchors.map(anchor => `- ${escapeXml(anchor.text)}`).join('\n')}\n</taskify_constraints>`
}
