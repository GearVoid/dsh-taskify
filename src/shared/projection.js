/** Durable checkpoint semantics and deterministic persistent-state replay. */

import { mergePersistentAnchors } from './lifecycle.js'
import { createInitialTaskifyState } from './state.js'
import { inspectTaskifyUserMessage } from './source.js'

export async function checkpointDurability(ctx, session) {
  if (!ctx?.sessions || typeof ctx.sessions.flush !== 'function' || session === undefined) return { status: 'unavailable' }
  try {
    return { status: await ctx.sessions.flush(session) === true ? 'confirmed' : 'unavailable' }
  } catch (error) {
    return { status: 'failed', error }
  }
}

function eventInbox(events) {
  const pending = { 'next-turn': [], 'next-step': [] }
  for (const event of events) {
    if (event?.type !== 'agent/inbox/spliced') continue
    const splice = event.data
    if ((splice?.target !== 'next-turn' && splice?.target !== 'next-step')
      || !Number.isSafeInteger(splice.start) || splice.start < 0
      || !Number.isSafeInteger(splice.removedCount ?? 0) || (splice.removedCount ?? 0) < 0
      || !Array.isArray(splice.inserted)) continue
    const queue = pending[splice.target]
    const removedCount = splice.removedCount ?? 0
    if (splice.start > queue.length || splice.start + removedCount > queue.length) continue
    queue.splice(splice.start, removedCount, ...splice.inserted)
  }
  return pending
}

function inboxMessages(inbox, fallback) {
  if (!inbox) return [...fallback['next-turn'], ...fallback['next-step']]
  return [...(Array.isArray(inbox.nextTurn) ? inbox.nextTurn : []), ...(Array.isArray(inbox.nextStep) ? inbox.nextStep : [])]
}

function frozenSnapshot(snapshot) {
  const copy = structuredClone(snapshot)
  for (const anchor of copy.anchors) {
    Object.freeze(anchor.scope)
    Object.freeze(anchor)
  }
  Object.freeze(copy.anchors)
  if (copy.focus) {
    Object.freeze(copy.focus.scope)
    Object.freeze(copy.focus)
  }
  if (copy.request.bundle) {
    for (const anchor of copy.request.bundle.anchors) Object.freeze(anchor)
    Object.freeze(copy.request.bundle.anchors)
    if (copy.request.bundle.carrier) Object.freeze(copy.request.bundle.carrier)
    Object.freeze(copy.request.bundle)
  }
  Object.freeze(copy.request)
  Object.freeze(copy.durability)
  Object.freeze(copy.runtimeContext)
  return Object.freeze(copy)
}

function textOfHumanMessage(message) {
  if (!message || message.role !== 'user' || message.source?.kind !== 'user' || !Array.isArray(message.content)) return undefined
  return message.content
    .filter(block => block?.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n')
}

/** Fold raw known DSH events plus live/rebuilt Inbox without parsing content. */
export function rebuildTaskifyState({ sessionId, events, inbox, durabilityStatus = 'unavailable' }) {
  if (typeof sessionId !== 'string' || sessionId === '') throw new TypeError('sessionId must not be empty')
  if (!Array.isArray(events)) throw new TypeError('events must be an array')
  if (!['unavailable', 'confirmed', 'failed'].includes(durabilityStatus)) throw new TypeError('durabilityStatus is invalid')

  const activations = new Map()
  const updates = new Map()
  const diagnostics = { malformed: 0, unsupported: 0, wrongSession: 0, unrelated: 0 }

  const observe = (message, status) => {
    const inspected = inspectTaskifyUserMessage(message, sessionId)
    if (inspected.kind === 'unrelated') {
      diagnostics.unrelated += 1
      return undefined
    }
    if (inspected.kind === 'invalid') {
      if (inspected.code === 'unsupported-version') diagnostics.unsupported += 1
      else if (inspected.code === 'wrong-session') diagnostics.wrongSession += 1
      else diagnostics.malformed += 1
      return undefined
    }
    const { source } = inspected
    if (source.recordType === 'state-update') {
      updates.set(source.recordId, source)
      return { source, kind: 'state-update' }
    }
    const existing = activations.get(source.bundleId)
    const record = existing ?? { source, messageId: message.id, status }
    record.source = source
    record.messageId = message.id
    record.status = status
    activations.set(source.bundleId, record)
    return { ...record, kind: 'activation' }
  }

  const queues = { 'next-turn': [], 'next-step': [] }
  let turnOpen = false
  const closeUnconsumedClaims = () => {
    for (const record of activations.values()) {
      if (record.status === 'claimed') record.status = 'canceled'
    }
  }
  for (const event of events) {
    if (event?.type === 'agent/inbox/spliced') {
      const splice = event.data
      if ((splice?.target !== 'next-turn' && splice?.target !== 'next-step')
        || !Number.isSafeInteger(splice?.start) || !Number.isSafeInteger(splice?.removedCount ?? 0)
        || splice.start < 0 || (splice.removedCount ?? 0) < 0 || !Array.isArray(splice?.inserted)) continue
      const queue = queues[splice.target]
      const removedCount = splice.removedCount ?? 0
      if (splice.start > queue.length || splice.start + removedCount > queue.length) continue
      const removed = queue.splice(splice.start, removedCount, ...splice.inserted)
      for (const message of removed) observe(message, splice.outcome === 'canceled' ? 'canceled' : 'claimed')
      for (const message of splice.inserted) observe(message, 'pending')
      continue
    }
    if (event?.type === 'user/message') {
      const humanDraft = textOfHumanMessage(event.data)
      if (humanDraft === undefined) {
        observe(event.data, 'consumed')
      } else {
        for (const record of activations.values()) {
          if (record.status === 'claimed' && record.source.binding.acceptedDrafts.includes(humanDraft)) {
            record.status = 'consumed'
          }
        }
      }
      continue
    }
    if (event?.type === 'turn/start') {
      if (turnOpen) closeUnconsumedClaims()
      turnOpen = true
      diagnostics.unrelated += 1
      continue
    }
    if (event?.type === 'turn/end') {
      closeUnconsumedClaims()
      turnOpen = false
      diagnostics.unrelated += 1
      continue
    }
    if (event?.type !== undefined) diagnostics.unrelated += 1
  }

  const live = inboxMessages(inbox, eventInbox(events))
  const liveIds = new Set()
  for (const message of live) {
    const record = observe(message, 'pending')
    if (record?.kind === 'activation') liveIds.add(message.id)
  }
  if (inbox) {
    for (const record of activations.values()) {
      if (record.status === 'pending' && !liveIds.has(record.messageId)) record.status = 'claimed'
    }
  }

  const operations = []
  for (const source of updates.values()) {
    operations.push({ revision: source.revision, key: source.recordId, kind: 'snapshot', source })
  }
  for (const record of activations.values()) {
    if (record.status === 'pending') {
      operations.push({ revision: record.source.armedRevision, key: record.source.bundleId, kind: 'armed', record })
    } else if (record.status === 'consumed') {
      operations.push({ revision: record.source.activationRevision, key: record.source.bundleId, kind: 'activate', record })
    } else {
      operations.push({ revision: record.source.activationRevision, key: record.source.bundleId, kind: 'clear-request', record })
    }
  }
  operations.sort((a, b) => a.revision - b.revision || a.key.localeCompare(b.key) || a.kind.localeCompare(b.kind))

  let anchors = []
  let focus = null
  let request = { phase: 'idle' }
  let stateRevision = 0
  for (const operation of operations) {
    if (operation.revision < stateRevision) continue
    try {
      if (operation.kind === 'snapshot') {
        anchors = operation.source.anchors.map(anchor => structuredClone(anchor))
        if (operation.source.schemaVersion >= 3) {
          focus = operation.source.focus === null ? null : structuredClone(operation.source.focus)
        }
        request = { phase: 'idle' }
      } else if (operation.kind === 'armed') {
        const { source, messageId } = operation.record
        request = {
          phase: 'armed',
          bundle: {
            requestId: source.requestId,
            boundDraft: source.binding.boundDraft,
            sourceDraft: source.binding.sourceDraft,
            anchors: source.anchors.map(anchor => ({ ...anchor })),
            carrier: { messageId, bundleId: source.bundleId, requestId: source.requestId },
          },
        }
      } else if (operation.kind === 'activate') {
        const { source } = operation.record
        anchors = mergePersistentAnchors(anchors, source.anchors, {
          bundleId: source.bundleId,
          activatedRevision: source.activationRevision,
          sessionId,
        })
        request = { phase: 'idle' }
      } else {
        request = { phase: 'idle' }
      }
      stateRevision = operation.revision
    } catch {
      diagnostics.malformed += 1
    }
  }

  const initial = createInitialTaskifyState(sessionId)
  return {
    state: frozenSnapshot({
      ...initial,
      revision: stateRevision,
      durability: { status: durabilityStatus },
      runtimeContext: { available: false },
      request,
      anchors,
      focus,
    }),
    diagnostics: Object.freeze({ ...diagnostics }),
  }
}
