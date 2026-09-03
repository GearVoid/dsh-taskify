/** Deterministic Focus and persistent-anchor lifecycle helpers. */

export const MAX_PERSISTENT_ANCHORS = 16
export const MAX_FOCUS_TEXT_CHARS = 2_000

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function keyOf(anchor) {
  return `${anchor.text}\u0000${anchor.evidence}`
}

export class PersistentAnchorLimitError extends Error {
  constructor() {
    super(`Persistent Taskify anchors cannot exceed ${MAX_PERSISTENT_ANCHORS}.`)
    this.name = 'PersistentAnchorLimitError'
    this.code = 'anchor-limit'
  }
}

export function persistentAnchorId(bundleId, index) {
  if (typeof bundleId !== 'string' || bundleId === '') throw new TypeError('bundleId must not be empty')
  if (!Number.isSafeInteger(index) || index < 0) throw new TypeError('anchor index is invalid')
  return `anchor:${bundleId}:${index + 1}`
}

/** Exact text+evidence dedupe; existing identity and status always win. */
export function mergePersistentAnchors(existing, incoming, {
  bundleId,
  activatedRevision,
  sessionId,
}) {
  const merged = existing.map(anchor => structuredClone(anchor))
  const seen = new Set(merged.map(keyOf))
  incoming.forEach((anchor, index) => {
    const key = keyOf(anchor)
    if (seen.has(key)) return
    seen.add(key)
    merged.push({
      id: persistentAnchorId(bundleId, index),
      text: anchor.text,
      evidence: anchor.evidence,
      status: 'active',
      scope: { kind: 'session', sessionId },
      activatedRevision,
    })
  })
  if (merged.length > MAX_PERSISTENT_ANCHORS) throw new PersistentAnchorLimitError()
  return merged
}

export function renderTaskifyRuntimeContext(state, { excludeAnchors = [] } = {}) {
  const revision = Number.isSafeInteger(state?.revision) ? state.revision : 0
  const excluded = new Set(excludeAnchors.map(keyOf))
  const active = Array.isArray(state?.anchors)
    ? state.anchors.filter(anchor => anchor.status === 'active' && !excluded.has(keyOf(anchor)))
    : []
  const focus = state?.focus?.status === 'active' ? state.focus : null
  if (excluded.size > 0 && active.length === 0 && focus === null) return ''

  const lines = focus === null
    ? [
        'No Taskify Focus is currently active.',
        'Earlier Taskify Focus notices are superseded.',
      ]
    : [
        'Current user-authorized Taskify Focus:',
        escapeXml(focus.text),
        '',
        'Focus policy:',
        '- Work only within the current Focus.',
        '- Make only changes necessary to complete it.',
        '- Report out-of-focus issues without fixing them; ask the user to edit or pause Focus before expanding scope.',
      ]

  lines.push('')
  if (active.length === 0) {
    lines.push(
      'No Taskify constraints are currently active.',
      'Earlier Taskify constraint notices are superseded.',
    )
  } else {
    lines.push(
      'These are the current user-authorized Taskify constraints and supersede earlier Taskify constraint notices.',
      '',
      ...active.map(anchor => `- ${escapeXml(anchor.text)}`),
    )
  }
  return `<taskify_current_constraints revision="${revision}">\n${lines.join('\n')}\n</taskify_current_constraints>`
}

export function buildLifecycleNotice(revision, anchors, focus = null) {
  const active = anchors.filter(anchor => anchor.status === 'active')
  const lines = focus?.status === 'active'
    ? ['Current active Taskify Focus:', escapeXml(focus.text)]
    : ['Current active Taskify Focus: none.', 'Earlier Taskify Focus is no longer active.']
  lines.push('')
  lines.push(...(active.length === 0
    ? [
        'Current active Taskify constraints: none.',
        'Earlier Taskify constraints are no longer active.',
      ]
    : [
        'Current active Taskify constraints:',
        ...active.map(anchor => `- ${escapeXml(anchor.text)}`),
      ]))
  return `<taskify_constraint_state revision="${revision}" supersedes="earlier">\n${lines.join('\n')}\n</taskify_constraint_state>`
}
