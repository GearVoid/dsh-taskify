/**
 * Literal Lock for dsh-taskify.
 *
 * Before a draft is sent to the Task Compiler, protected literal spans
 * (paths, identifiers, flags, versions, inline code, fenced code, ...) are
 * replaced with request-unique sentinels. The compiled result is only
 * accepted when every sentinel survives exactly once and in order, and is
 * then restored byte-for-byte.
 */

export const MAX_RESULT_CHARS = 8000
export const MAX_LITERALS = 900

const SENTINEL_PREFIX = '__DSH_TASKIFY_'
const SENTINEL_SUFFIX = '__'
const LOCK_SEGMENT = '_LOCK_'
const UNKNOWN_SENTINEL_RE = /__DSH_TASKIFY_[A-F0-9]{8}_LOCK_\d{3}__/g

const FENCED_CODE_RE = /```[^\n`]*\n?[\s\S]*?```/g
const INLINE_CODE_RE = /`[^`\n]+`/g

const URL_RE = /(?:https?|ftp):\/\/[^\s<>"'()[\]{}，。；：！？]+/giu
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{2,5})?\b/g
const HOST_PORT_RE = /\b(?:localhost|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+):\d{2,5}\b/g
const QUOTED_PATH_RE = /(?<=["'])(?:(?:[A-Za-z]:[\\/])|(?:\\\\[^\\/"']+[\\/])|\/)[^"'\r\n]+(?=["'])/gu
const WINDOWS_PATH_RE = /(?<![A-Za-z0-9_])(?:[A-Za-z]:[\\/]|\\\\[A-Za-z0-9._$-]+\\)[^\s<>"'|?*，。；：！？]+/gu
const POSIX_PATH_RE = /(?<![A-Za-z0-9_])(?:\/|\.{1,2}\/|[A-Za-z0-9_.@~-]+\/)[^\s<>"'()[\]{}，。；：！？]+/gu
const ENV_VAR_RE = /\b[A-Z][A-Z0-9_]{2,}\b/g
const VERSION_RE = /\bv?\d+(?:\.\d+)+(?:-[A-Za-z0-9][A-Za-z0-9.-]*)?\b/g
const NODE_VERSION_RE = /\bNode(?:\.js)?\s+\d+(?:\.\d+)*\b/gi
const LONG_FLAG_RE = /(?<![A-Za-z0-9])--[A-Za-z0-9][A-Za-z0-9-]*(?![A-Za-z0-9])/g
const SHORT_FLAG_RE = /(?<![A-Za-z0-9])-[A-Za-z](?![A-Za-z0-9])/g
const SLASH_TOKEN_RE = /(?<![A-Za-z0-9])\/[A-Za-z][\w-]*(?![A-Za-z0-9])/g
const LOWER_CAMEL_RE = /\b[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9_$]*\b/g
const UPPER_IDENTIFIER_RE = /\b[A-Z][A-Za-z0-9_$]*\b/g
const DOTTED_IDENTIFIER_RE = /\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+/g
const PORT_CONTEXT_RE = /(?:port|端口)\s{0,4}(\d{2,5})\b/gi

export function makeSentinel(nonce, index) {
  return `${SENTINEL_PREFIX}${nonce}${LOCK_SEGMENT}${String(index).padStart(3, '0')}${SENTINEL_SUFFIX}`
}

export function generateNonce(text = '') {
  const alphabet = '0123456789ABCDEF'
  for (;;) {
    let nonce = ''
    for (let i = 0; i < 8; i += 1) nonce += alphabet[Math.floor(Math.random() * 16)]
    if (!text.includes(`${SENTINEL_PREFIX}${nonce}`)) return nonce
  }
}

function trimTrailingPunctuation(value) {
  return value.replace(/[.,;:!?，。；：！？）)\]}]+$/u, '')
}

function matchItems(text, regex, transform = (match) => match[0]) {
  const items = []
  for (const match of text.matchAll(regex)) {
    const raw = transform(match)
    if (!raw) continue
    let start = match.index
    let end = start + raw.length
    // Group-targeted transforms may not start at match.index; recompute when possible.
    const groupIndex = regex.toString().includes('(') ? -1 : -1
    void groupIndex
    const value = raw
    if (value.trim() === '') continue
    // Sentence punctuation immediately after URL/path text is not part of it.
    if (regex === URL_RE || regex === WINDOWS_PATH_RE || regex === POSIX_PATH_RE) {
      const trimmed = trimTrailingPunctuation(value)
      if (trimmed === '') continue
      end = start + trimmed.length
      items.push({ start, end, text: trimmed })
    } else {
      items.push({ start, end, text: value })
    }
  }
  return items
}

function groupItems(text, regex) {
  const items = []
  for (const match of text.matchAll(regex)) {
    const group = match[1]
    if (!group) continue
    const start = match.index + match[0].indexOf(group)
    items.push({ start, end: start + group.length, text: group })
  }
  return items
}

function intersects(item, region) {
  return item.start < region.end && item.end > region.start
}

function uniqueSorted(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  const result = []
  let lastEnd = -1
  for (const item of sorted) {
    if (item.start < lastEnd) continue
    result.push(item)
    lastEnd = item.end
  }
  return result
}

/**
 * Replace protected literals with ordered sentinels.
 * @param draft raw draft text
 * @returns { text, nonce, locks, count } where locks are ordered original values.
 */
export function lockLiterals(draft) {
  const text = typeof draft === 'string' ? draft : ''
  const nonce = generateNonce(text)

  const codeRegions = []
  for (const match of text.matchAll(FENCED_CODE_RE)) {
    codeRegions.push({ start: match.index, end: match.index + match[0].length, text: match[0] })
  }
  for (const match of text.matchAll(INLINE_CODE_RE)) {
    codeRegions.push({ start: match.index, end: match.index + match[0].length, text: match[0] })
  }

  const patternItems = []
  for (const regex of [
    URL_RE,
    IPV4_RE,
    HOST_PORT_RE,
    QUOTED_PATH_RE,
    WINDOWS_PATH_RE,
    POSIX_PATH_RE,
    ENV_VAR_RE,
    VERSION_RE,
    NODE_VERSION_RE,
    LONG_FLAG_RE,
    SHORT_FLAG_RE,
    SLASH_TOKEN_RE,
    LOWER_CAMEL_RE,
    UPPER_IDENTIFIER_RE,
    DOTTED_IDENTIFIER_RE,
  ]) {
    for (const item of matchItems(text, regex)) {
      if (!codeRegions.some((region) => intersects(item, region))) patternItems.push(item)
    }
  }
  for (const item of groupItems(text, PORT_CONTEXT_RE)) {
    if (!codeRegions.some((region) => intersects(item, region))) patternItems.push(item)
  }

  const items = uniqueSorted([...codeRegions, ...patternItems])
  if (items.length > MAX_LITERALS) {
    throw new Error(`Literal Lock refused: too many protected literals (${items.length})`)
  }

  const locks = []
  let locked = text
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    const sentinel = makeSentinel(nonce, index)
    locks[index] = item.text
    locked = locked.slice(0, item.start) + sentinel + locked.slice(item.end)
  }

  return { text: locked, nonce, locks, count: locks.length }
}

function sentinelOccurrences(result, sentinel) {
  let count = 0
  let index = -1
  let cursor = result.indexOf(sentinel)
  while (cursor !== -1) {
    count += 1
    index = cursor
    cursor = result.indexOf(sentinel, cursor + sentinel.length)
  }
  return { count, index }
}

/**
 * Validate that every sentinel survived exactly once and in the original
 * order, that no unknown Taskify sentinel was invented, and that the result
 * is a sane bounded size.
 */
export function validateLockedResult(result, lock) {
  if (typeof result !== 'string' || result.trim() === '') {
    return { ok: false, error: 'EMPTY_RESULT' }
  }
  if (result.length > MAX_RESULT_CHARS) {
    return { ok: false, error: 'RESULT_TOO_LONG' }
  }

  const expected = new Set()
  const indexes = []
  for (let index = 0; index < lock.locks.length; index += 1) {
    const sentinel = makeSentinel(lock.nonce, index)
    expected.add(sentinel)
    const occurrence = sentinelOccurrences(result, sentinel)
    if (occurrence.count !== 1) {
      return {
        ok: false,
        error: occurrence.count === 0 ? 'SENTINEL_MISSING' : 'SENTINEL_DUPLICATED',
        detail: `literal ${index}`,
      }
    }
    indexes.push(occurrence.index)
  }
  for (let index = 1; index < indexes.length; index += 1) {
    if (indexes[index] < indexes[index - 1]) {
      return { ok: false, error: 'SENTINEL_ORDER_CHANGED', detail: `literal ${index}` }
    }
  }

  for (const match of result.matchAll(UNKNOWN_SENTINEL_RE)) {
    if (!expected.has(match[0])) {
      return { ok: false, error: 'UNKNOWN_SENTINEL', detail: match[0] }
    }
  }

  return { ok: true }
}

/**
 * Restore sentinels to their original literal values.
 */
export function unlockResult(result, lock) {
  let restored = result
  for (let index = 0; index < lock.locks.length; index += 1) {
    restored = restored.replaceAll(makeSentinel(lock.nonce, index), lock.locks[index])
  }
  return restored
}

/**
 * Validate and unlock in one step. Never returns a partially restored value.
 */
export function validateAndUnlock(result, lock) {
  const validation = validateLockedResult(result, lock)
  if (!validation.ok) return validation
  return { ok: true, text: unlockResult(result, lock) }
}

export { UNKNOWN_SENTINEL_RE }
