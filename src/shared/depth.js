/**
 * Local, user-invisible estimate of the enhancement depth.
 *
 * The Task Compiler system prompt owns the real adaptive-depth decision; this
 * heuristic exists for diagnostics and future tests. It must never expose a
 * mode selector to the user.
 */

const LIGHT_HINTS = [
  /修复|fix|bug|error|null pointer|空指针|不改|不要改|保持|src[\/]/iu,
  /\b(?:src|packages|app)\b.*\b(?:ts|tsx|js|jsx|json)\b/iu,
  /第\s*\d+\s*行|line\s+\d+/iu,
]

const DEEP_HINTS = [
  /整理|重构|优化|太乱|乱|dashboard|系统设计|架构|多步骤|页面.*(?:整理|重做|改版)/iu,
  /同时|并且|还有|以及/iu,
  /，.*，.*，/u,
]

export function estimateDepth(draft = '') {
  const text = String(draft)
  if (text.trim() === '') return 'LIGHT'
  if (LIGHT_HINTS.some((re) => re.test(text))) return 'LIGHT'
  if (DEEP_HINTS.some((re) => re.test(text))) return 'DEEP'
  return 'STANDARD'
}
