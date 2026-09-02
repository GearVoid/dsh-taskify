/** Dependency-free Host-authoritative Taskify request and anchor state. */

import { MAX_PERSISTENT_ANCHORS, mergePersistentAnchors } from './lifecycle.js'

export const TASKIFY_STATE_SCHEMA_VERSION = 2

const DURABILITY_STATUSES = new Set(['unavailable', 'confirmed', 'failed'])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireSessionId(value) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError('sessionId must not be empty')
  return value
}

function requireRevision(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('revision must be a non-negative safe integer')
  return value
}

function cloneExtractedAnchors(anchors) {
  if (!Array.isArray(anchors)) throw new TypeError('anchors must be an array')
  return anchors.map((anchor, index) => {
    if (!isRecord(anchor) || typeof anchor.text !== 'string' || anchor.text.trim() === ''
      || typeof anchor.evidence !== 'string' || anchor.evidence.trim() === '') {
      throw new TypeError(`anchors[${index}] is invalid`)
    }
    return { text: anchor.text, evidence: anchor.evidence }
  })
}

function clonePersistentAnchors(anchors, sessionId) {
  if (!Array.isArray(anchors) || anchors.length > MAX_PERSISTENT_ANCHORS) {
    throw new TypeError('persistent anchors are invalid')
  }
  const ids = new Set()
  return anchors.map((anchor, index) => {
    if (!isRecord(anchor)
      || typeof anchor.id !== 'string' || anchor.id.trim() === '' || ids.has(anchor.id)
      || typeof anchor.text !== 'string' || anchor.text.trim() === ''
      || typeof anchor.evidence !== 'string' || anchor.evidence.trim() === ''
      || (anchor.status !== 'active' && anchor.status !== 'paused')
      || !isRecord(anchor.scope) || anchor.scope.kind !== 'session' || anchor.scope.sessionId !== sessionId) {
      throw new TypeError(`persistent anchors[${index}] is invalid`)
    }
    ids.add(anchor.id)
    return {
      id: anchor.id,
      text: anchor.text,
      evidence: anchor.evidence,
      status: anchor.status,
      scope: { kind: 'session', sessionId },
      activatedRevision: requireRevision(anchor.activatedRevision),
    }
  })
}

function cloneCarrier(carrier) {
  if (carrier === null || carrier === undefined) return null
  if (!isRecord(carrier)
    || typeof carrier.messageId !== 'string' || carrier.messageId.trim() === ''
    || typeof carrier.bundleId !== 'string' || carrier.bundleId.trim() === ''
    || typeof carrier.requestId !== 'string' || carrier.requestId.trim() === '') {
    throw new TypeError('request.bundle.carrier is invalid')
  }
  return { messageId: carrier.messageId, bundleId: carrier.bundleId, requestId: carrier.requestId }
}

function freezeSnapshot(snapshot) {
  const copy = structuredClone(snapshot)
  for (const anchor of copy.anchors) {
    Object.freeze(anchor.scope)
    Object.freeze(anchor)
  }
  Object.freeze(copy.anchors)
  if (copy.request.pending) Object.freeze(copy.request.pending)
  if (copy.request.bundle) {
    for (const anchor of copy.request.bundle.anchors) Object.freeze(anchor)
    Object.freeze(copy.request.bundle.anchors)
    if (copy.request.bundle.carrier) Object.freeze(copy.request.bundle.carrier)
    Object.freeze(copy.request.bundle)
  }
  Object.freeze(copy.request)
  Object.freeze(copy.durability)
  Object.freeze(copy.runtimeContext)
  Object.freeze(copy.goalIntegration)
  Object.freeze(copy.scope)
  return Object.freeze(copy)
}

export function createInitialTaskifyState(sessionId) {
  const exactSessionId = requireSessionId(sessionId)
  return freezeSnapshot({
    schemaVersion: TASKIFY_STATE_SCHEMA_VERSION,
    sessionId: exactSessionId,
    revision: 0,
    durability: { status: 'unavailable' },
    runtimeContext: { available: false },
    goalIntegration: { available: false },
    request: { phase: 'idle' },
    anchors: [],
    scope: { kind: 'session', sessionId: exactSessionId },
  })
}

function assertRequest(request) {
  if (!isRecord(request) || !['idle', 'pending', 'armed'].includes(request.phase)) {
    throw new TypeError('snapshot request is invalid')
  }
  if (request.phase === 'idle') {
    if (request.pending !== undefined || request.bundle !== undefined) throw new TypeError('idle request contains data')
    return
  }
  if (request.phase === 'pending') {
    if (!isRecord(request.pending) || request.bundle !== undefined) throw new TypeError('pending request is malformed')
    if (typeof request.pending.requestId !== 'string' || request.pending.requestId.trim() === ''
      || typeof request.pending.boundDraft !== 'string' || request.pending.boundDraft.trim() === ''
      || typeof request.pending.sourceDraft !== 'string' || request.pending.sourceDraft.trim() === '') {
      throw new TypeError('pending request binding is invalid')
    }
    return
  }
  if (!isRecord(request.bundle) || request.pending !== undefined) throw new TypeError('armed request is malformed')
  if (typeof request.bundle.requestId !== 'string' || request.bundle.requestId.trim() === ''
    || typeof request.bundle.boundDraft !== 'string' || request.bundle.boundDraft.trim() === ''
    || typeof request.bundle.sourceDraft !== 'string' || request.bundle.sourceDraft.trim() === '') {
    throw new TypeError('armed request binding is invalid')
  }
  cloneExtractedAnchors(request.bundle.anchors)
  cloneCarrier(request.bundle.carrier)
}

function assertSnapshotShape(snapshot, expectedSessionId) {
  if (!isRecord(snapshot)) throw new TypeError('snapshot must be an object')
  if (snapshot.schemaVersion !== TASKIFY_STATE_SCHEMA_VERSION) throw new TypeError('snapshot.schemaVersion is unsupported')
  const sessionId = requireSessionId(snapshot.sessionId)
  if (expectedSessionId !== undefined && sessionId !== expectedSessionId) throw new TypeError('snapshot sessionId does not match')
  requireRevision(snapshot.revision)
  if (!isRecord(snapshot.durability) || !DURABILITY_STATUSES.has(snapshot.durability.status)) {
    throw new TypeError('snapshot durability is invalid')
  }
  if (!isRecord(snapshot.runtimeContext) || typeof snapshot.runtimeContext.available !== 'boolean') {
    throw new TypeError('snapshot runtimeContext is invalid')
  }
  if (!isRecord(snapshot.goalIntegration) || snapshot.goalIntegration.available !== false) {
    throw new TypeError('native goal integration is unavailable')
  }
  if (!isRecord(snapshot.scope) || snapshot.scope.kind !== 'session' || snapshot.scope.sessionId !== sessionId) {
    throw new TypeError('snapshot scope must be the exact session')
  }
  assertRequest(snapshot.request)
  clonePersistentAnchors(snapshot.anchors, sessionId)
  return snapshot
}

function nextBase(current, durabilityStatus = current.durability.status) {
  if (!DURABILITY_STATUSES.has(durabilityStatus)) throw new TypeError('durabilityStatus is invalid')
  return {
    schemaVersion: TASKIFY_STATE_SCHEMA_VERSION,
    sessionId: current.sessionId,
    revision: current.revision + 1,
    durability: { status: durabilityStatus },
    runtimeContext: { available: current.runtimeContext.available },
    goalIntegration: { available: false },
    anchors: clonePersistentAnchors(current.anchors, current.sessionId),
    scope: { kind: 'session', sessionId: current.sessionId },
  }
}

/** Pure Host transition: request state and persistent anchors evolve orthogonally. */
export function transitionTaskifyState(current, action) {
  assertSnapshotShape(current, current?.sessionId)
  if (!isRecord(action) || typeof action.type !== 'string') throw new TypeError('action is invalid')
  const base = nextBase(current, action.durabilityStatus)

  if (action.type === 'begin-compile') {
    if (typeof action.requestId !== 'string' || action.requestId.trim() === '') throw new TypeError('requestId is invalid')
    if (typeof action.boundDraft !== 'string' || action.boundDraft.trim() === '') throw new TypeError('boundDraft is invalid')
    if (typeof action.sourceDraft !== 'string' || action.sourceDraft.trim() === '') throw new TypeError('sourceDraft is invalid')
    return freezeSnapshot({
      ...base,
      request: {
        phase: 'pending',
        pending: { requestId: action.requestId, boundDraft: action.boundDraft, sourceDraft: action.sourceDraft },
      },
    })
  }

  if (action.type === 'arm') {
    if (current.request.phase !== 'pending' || current.request.pending.requestId !== action.requestId) {
      throw new Error('compile completion does not match the pending request')
    }
    return freezeSnapshot({
      ...base,
      request: {
        phase: 'armed',
        bundle: {
          requestId: action.requestId,
          boundDraft: current.request.pending.boundDraft,
          sourceDraft: current.request.pending.sourceDraft,
          anchors: cloneExtractedAnchors(action.anchors),
          carrier: cloneCarrier(action.carrier),
        },
      },
    })
  }

  if (action.type === 'clear-request') return freezeSnapshot({ ...base, request: { phase: 'idle' } })

  if (action.type === 'activate') {
    if (current.request.phase !== 'armed'
      || current.request.bundle.requestId !== action.requestId
      || current.request.bundle.carrier?.bundleId !== action.bundleId) {
      throw new Error('activation does not match the armed request')
    }
    return freezeSnapshot({
      ...base,
      request: { phase: 'idle' },
      anchors: mergePersistentAnchors(current.anchors, current.request.bundle.anchors, {
        bundleId: action.bundleId,
        activatedRevision: base.revision,
        sessionId: current.sessionId,
      }),
    })
  }

  if (action.type === 'replace-anchors') {
    if (current.request.phase !== 'idle') throw new Error('persistent lifecycle mutation requires an idle request')
    return freezeSnapshot({
      ...base,
      request: { phase: 'idle' },
      anchors: clonePersistentAnchors(action.anchors, current.sessionId),
    })
  }

  throw new TypeError(`unknown Taskify action: ${action.type}`)
}

export class TaskifyStateProjection {
  constructor() {
    this.states = new Map()
  }

  getState(sessionId) {
    const exactSessionId = requireSessionId(sessionId)
    return this.states.get(exactSessionId) ?? createInitialTaskifyState(exactSessionId)
  }

  has(sessionId) {
    return this.states.has(requireSessionId(sessionId))
  }

  drop(sessionId) {
    return this.states.delete(requireSessionId(sessionId))
  }

  compare(sessionId, expectedRevision) {
    const current = this.getState(sessionId)
    return { matches: current.revision === requireRevision(expectedRevision), state: current }
  }

  compareAndSet(sessionId, expectedRevision, update) {
    const compared = this.compare(sessionId, expectedRevision)
    if (!compared.matches) return { ok: false, state: compared.state }
    const next = typeof update === 'function' ? update(compared.state) : update
    assertSnapshotShape(next, compared.state.sessionId)
    if (next.revision !== compared.state.revision + 1) throw new Error('Host transition must increment revision exactly once')
    this.states.set(compared.state.sessionId, freezeSnapshot(next))
    return { ok: true, state: this.states.get(compared.state.sessionId) }
  }

  update(sessionId, expectedRevision, action) {
    return this.compareAndSet(sessionId, expectedRevision, current => transitionTaskifyState(current, action))
  }

  observeDurability(sessionId, expectedRevision, status) {
    return this.observeMetadata(sessionId, expectedRevision, { durability: { status } })
  }

  observeRuntimeContext(sessionId, expectedRevision, available) {
    if (typeof available !== 'boolean') throw new TypeError('runtime context availability is invalid')
    return this.observeMetadata(sessionId, expectedRevision, { runtimeContext: { available } })
  }

  observeMetadata(sessionId, expectedRevision, patch) {
    const compared = this.compare(sessionId, expectedRevision)
    if (!compared.matches) return { ok: false, state: compared.state }
    if (patch.durability && !DURABILITY_STATUSES.has(patch.durability.status)) throw new TypeError('durability status is invalid')
    const next = freezeSnapshot({ ...structuredClone(compared.state), ...patch })
    this.states.set(compared.state.sessionId, next)
    return { ok: true, state: next }
  }

  rebuild(sessionId, snapshot) {
    const exactSessionId = requireSessionId(sessionId)
    assertSnapshotShape(snapshot, exactSessionId)
    const current = this.states.get(exactSessionId)
    if (current !== undefined && snapshot.revision < current.revision) throw new Error('Taskify revision cannot move backwards')
    this.states.set(exactSessionId, freezeSnapshot(snapshot))
    return this.states.get(exactSessionId)
  }
}
