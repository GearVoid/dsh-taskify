/**
 * Slash-command handling for the composer draft.
 *
 * A leading `/name` token is never analyzed as task prose. When the draft is
 * exactly a command (or command plus whitespace), Taskify is not called.
 */

const COMMAND_DRAFT_RE = /^(\/[A-Za-z][\w-]*)(?:[\s\u00A0]+([\s\S]*))?$/

/**
 * @param rawDraft raw composer draft, including the slash token when present
 * @returns { kind:'command-only', command } | { kind:'command', command, body }
 *          | { kind:'plain', draft }
 */
export function parseSlashDraft(rawDraft) {
  const draft = typeof rawDraft === 'string' ? rawDraft : ''
  const trimmed = draft.trim()
  if (trimmed === '') return { kind: 'empty' }

  const match = COMMAND_DRAFT_RE.exec(trimmed)
  if (match === null) return { kind: 'plain', draft }

  const command = match[1]
  const body = (match[2] ?? '').trim()
  if (body === '') return { kind: 'command-only', command }
  return { kind: 'command', command, body }
}
