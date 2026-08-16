/**
 * Reference-chip policy for v0.1.
 *
 * The public `inputActions.setDraft` API performs occurrence math, but there
 * is no stable public contract that guarantees moving a reference placeholder
 * through a remote text round-trip preserves chip identity. v0.1 therefore
 * refuses enhancement when the draft owns any occurrence chip.
 */

export function isReferenceBlocked(occurrences) {
  return Array.isArray(occurrences) && occurrences.length > 0
}

export const REFERENCE_BLOCKED_NOTICE = '当前草稿包含引用内容，为避免破坏引用关系，本版本暂不支持完善。'
