export const TASKIFY_SOURCE_KIND = 'dsh-taskify'

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isTaskifySourcedMessage(message) {
  if (message?.role !== 'user') return false
  const source = message.source
  return source?.kind === TASKIFY_SOURCE_KIND
    || (source?.kind === 'plugin' && source.plugin === 'dsh-taskify')
}

export function taskifyStructuredPayload(message) {
  if (message?.role !== 'user' || message.source?.kind !== TASKIFY_SOURCE_KIND) return undefined
  return isRecord(message.source.payload) ? message.source.payload : undefined
}

function humanDraftOf(message) {
  if (message?.role !== 'user' || message.source?.kind !== 'user' || !Array.isArray(message.content)) return undefined
  return message.content
    .filter(block => block?.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n')
}

function boundDraftOf(message) {
  if (!isTaskifySourcedMessage(message)) return undefined
  const source = message.source
  if (source.kind === TASKIFY_SOURCE_KIND) return source.payload?.boundDraft
  return source.binding?.boundDraft
}

/**
 * Test-only prototype for the future pre-step binding rule. It owns no state:
 * it validates only the downstream enter decision at the current boundary.
 */
export async function filterMismatchedTaskifyBindings(payload, next) {
  const decision = await next()
  if (decision?.kind !== 'enter' || payload?.signal?.aborted === true) return decision

  const humanDrafts = new Set(decision.messages.map(humanDraftOf).filter(value => value !== undefined))
  const messages = decision.messages.filter(message => {
    if (!isTaskifySourcedMessage(message)) return true
    const boundDraft = boundDraftOf(message)
    return typeof boundDraft === 'string' && humanDrafts.has(boundDraft)
  })

  return messages.length === decision.messages.length ? decision : { kind: 'enter', messages }
}

/** Map the public flush contract to the only durability claims v0.3 may make. */
export async function classifyFlush(runFlush) {
  try {
    const participated = await runFlush()
    return { durability: participated === true ? 'confirmed' : 'unavailable' }
  } catch (error) {
    return { durability: 'failed', error }
  }
}

function clonePayload(message) {
  const payload = taskifyStructuredPayload(message)
  return payload === undefined ? undefined : structuredClone(payload)
}

/**
 * Test-only deterministic fold over known DSH events. It demonstrates that a
 * structured Taskify source survives raw history independently of the surface.
 * It is deliberately not the v0.3 domain schema.
 */
export function foldTaskifySourceEvents(events) {
  const pending = { 'next-turn': [], 'next-step': [] }
  const records = new Map()
  const transitions = []
  let ignoredUserMessages = 0

  const recordFor = (message) => {
    let record = records.get(message.id)
    if (record === undefined) {
      record = {
        id: message.id,
        payload: clonePayload(message),
        status: 'observed',
        enteredSeqs: [],
        duplicateSeqs: [],
      }
      records.set(message.id, record)
    }
    return record
  }

  for (const event of events) {
    if (event?.type === 'agent/inbox/spliced') {
      const splice = event.data
      if (splice?.target !== 'next-turn' && splice?.target !== 'next-step') continue
      const inbox = pending[splice.target]
      const removed = inbox.splice(splice.start, splice.removedCount ?? 0, ...splice.inserted)
      const taskifyRemoved = removed.filter(isTaskifySourcedMessage)
      const taskifyInserted = splice.inserted.filter(isTaskifySourcedMessage)

      if (taskifyRemoved.length > 0 && taskifyInserted.length > 0) {
        for (const message of taskifyRemoved) recordFor(message).status = 'replaced'
        for (const message of taskifyInserted) recordFor(message).status = 'pending'
        transitions.push({
          kind: 'replace',
          seq: event.seq,
          from: taskifyRemoved.map(message => message.id),
          to: taskifyInserted.map(message => message.id),
        })
      } else {
        for (const message of taskifyRemoved) {
          const kind = splice.outcome === 'canceled' ? 'remove' : 'claim'
          recordFor(message).status = kind === 'remove' ? 'canceled' : 'claimed'
          transitions.push({ kind, seq: event.seq, id: message.id })
        }
        for (const message of taskifyInserted) {
          recordFor(message).status = 'pending'
          transitions.push({ kind: 'insert', seq: event.seq, id: message.id, target: splice.target })
        }
      }
      continue
    }

    if (event?.type !== 'user/message') continue
    if (!isTaskifySourcedMessage(event.data)) {
      ignoredUserMessages += 1
      continue
    }

    const record = recordFor(event.data)
    if (record.enteredSeqs.length === 0) {
      record.enteredSeqs.push(event.seq)
      record.status = 'entered'
      transitions.push({ kind: 'enter', seq: event.seq, id: event.data.id })
    } else {
      record.duplicateSeqs.push(event.seq)
      transitions.push({ kind: 'duplicate', seq: event.seq, id: event.data.id })
    }
  }

  return {
    records: [...records.values()].map(record => structuredClone(record)),
    transitions,
    pending: {
      'next-turn': pending['next-turn'].filter(isTaskifySourcedMessage).map(message => message.id),
      'next-step': pending['next-step'].filter(isTaskifySourcedMessage).map(message => message.id),
    },
    ignoredUserMessages,
  }
}
