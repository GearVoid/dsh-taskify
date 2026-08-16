/**
 * Lightweight session-context extraction for the Task Compiler client.
 *
 * Only finalized user/assistant text nodes already present in the public
 * ConversationSnapshot are used. No workspace search, no file reads, no
 * reasoning, no tool output, no attachments, no credentials.
 */

export const CONTEXT_MAX_CHARS = 3000
export const CONTEXT_MAX_MESSAGES = 4
export const CONTEXT_MAX_PER_MESSAGE = 1200

const DROP_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /authorization\s*[:=]/i,
  /bearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /\bsk-[A-Za-z0-9_-]{8,}\b/i,
  /(?:password|passwd|secret|api[_-]?key|access[_-]?key|token|credential)\s*[:=]\s*\S{4,}/i,
  /\.env/i,
]

function textOfContent(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

function userText(node) {
  if (!node || node.kind !== 'user') return ''
  return textOfContent(node.content)
}

function assistantText(node) {
  if (!node || node.kind !== 'assistant' || node.interrupted === true) return ''
  if (!Array.isArray(node.blocks)) return ''
  return node.blocks
    .filter((block) => block && block.kind === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

function unsafe(text) {
  return DROP_PATTERNS.some((pattern) => pattern.test(text))
}

function clamp(text) {
  const normalized = text.replace(/\0/g, '')
  if (normalized.length <= CONTEXT_MAX_PER_MESSAGE) return normalized
  return `${normalized.slice(0, CONTEXT_MAX_PER_MESSAGE)} …`
}

/**
 * Extract up to the last N user/assistant messages from a public DSH
 * ConversationSnapshot-like object (`session.nodes`).
 * @returns '' when no safe context is available.
 */
export function extractRecentContext(session, options = {}) {
  const maxChars = options.maxChars ?? CONTEXT_MAX_CHARS
  const maxMessages = options.maxMessages ?? CONTEXT_MAX_MESSAGES
  const nodes = Array.isArray(session?.nodes) ? session.nodes : []

  const recent = []
  for (let index = nodes.length - 1; index >= 0 && recent.length < maxMessages; index -= 1) {
    const node = nodes[index]
    const text = node?.kind === 'user' ? userText(node) : node?.kind === 'assistant' ? assistantText(node) : ''
    if (text === '' || unsafe(text)) continue
    recent.push({ role: node.kind, text: clamp(text) })
  }
  recent.reverse()

  const kept = []
  let total = 0
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const entry = recent[index]
    const remaining = maxChars - total
    if (remaining <= 0) break
    if (entry.text.length <= remaining) {
      kept.unshift(entry)
      total += entry.text.length
    } else if (kept.length === 0) {
      kept.unshift({ ...entry, text: entry.text.slice(0, remaining) })
      total = maxChars
      break
    } else {
      break
    }
  }
  return kept.map((entry) => `<${entry.role}>${entry.text}</${entry.role}>`).join('\n')
}

export function formatContext(context) {
  return typeof context === 'string' && context.trim() !== '' ? context : 'EMPTY'
}
