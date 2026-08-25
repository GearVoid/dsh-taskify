/**
 * Reference-chip policy for v0.2.
 *
 * DSH serializes Reference Chips through their owning source. Taskify has no
 * safe way to bind extracted evidence to that hidden serialization, so it
 * refuses extraction while the draft owns any occurrence chip.
 */

export function isReferenceBlocked(occurrences) {
  return Array.isArray(occurrences) && occurrences.length > 0
}

export const REFERENCE_BLOCKED_NOTICE = '当前草稿包含引用内容，为避免错误关联来源，本版本暂不提取约束。'
