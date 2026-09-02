/** Strict dependency-free codec for Taskify DSH UserMessage records. */

import { MAX_PERSISTENT_ANCHORS } from './lifecycle.js'

export const TASKIFY_MESSAGE_SOURCE_KIND = 'dsh-taskify'
export const TASKIFY_MESSAGE_SOURCE_VERSION = 2

const MAX_COMPILE_ANCHORS = 8
const MAX_ANCHOR_TEXT_CHARS = 240
const MAX_EVIDENCE_CHARS = 320
const MAX_ID_CHARS = 512
const MAX_DRAFT_CHARS = 32_768
const LIFECYCLE_KINDS = new Set(['pause', 'resume', 'remove', 'clear'])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function onlyKeys(value, allowed, name) {
  const unknown = Object.keys(value).find(key => !allowed.includes(key))
  if (unknown !== undefined) throw new TaskifySourceError('malformed-source', `${name} contains unknown field ${unknown}`)
}

function text(value, name, max = MAX_ID_CHARS) {
  if (typeof value !== 'string' || value.trim() === '') throw new TaskifySourceError('malformed-source', `${name} must not be empty`)
  if (value.length > max) throw new TaskifySourceError('source-too-large', `${name} is too large`)
  return value
}

function revision(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TaskifySourceError('malformed-source', `${name} is invalid`)
  return value
}

function extractedAnchors(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_COMPILE_ANCHORS) {
    throw new TaskifySourceError('malformed-source', 'source.anchors is invalid')
  }
  return value.map((anchor, index) => {
    if (!isRecord(anchor)) throw new TaskifySourceError('malformed-source', `source.anchors[${index}] is invalid`)
    onlyKeys(anchor, ['text', 'evidence'], `source.anchors[${index}]`)
    return {
      text: text(anchor.text, `source.anchors[${index}].text`, MAX_ANCHOR_TEXT_CHARS),
      evidence: text(anchor.evidence, `source.anchors[${index}].evidence`, MAX_EVIDENCE_CHARS),
    }
  })
}

function persistentAnchors(value, sessionId, recordRevision) {
  if (!Array.isArray(value) || value.length > MAX_PERSISTENT_ANCHORS) {
    throw new TaskifySourceError('malformed-source', 'source.anchors is invalid')
  }
  const ids = new Set()
  return value.map((anchor, index) => {
    if (!isRecord(anchor)) throw new TaskifySourceError('malformed-source', `source.anchors[${index}] is invalid`)
    onlyKeys(anchor, ['id', 'text', 'evidence', 'status', 'scope', 'activatedRevision'], `source.anchors[${index}]`)
    const id = text(anchor.id, `source.anchors[${index}].id`)
    if (ids.has(id)) throw new TaskifySourceError('malformed-source', 'source anchor identities must be unique')
    ids.add(id)
    if (anchor.status !== 'active' && anchor.status !== 'paused') {
      throw new TaskifySourceError('malformed-source', `source.anchors[${index}].status is invalid`)
    }
    if (!isRecord(anchor.scope)) throw new TaskifySourceError('malformed-source', `source.anchors[${index}].scope is invalid`)
    onlyKeys(anchor.scope, ['kind', 'sessionId'], `source.anchors[${index}].scope`)
    if (anchor.scope.kind !== 'session' || anchor.scope.sessionId !== sessionId) {
      throw new TaskifySourceError('wrong-session', 'persistent anchor scope belongs to another session')
    }
    const activatedRevision = revision(anchor.activatedRevision, `source.anchors[${index}].activatedRevision`)
    if (activatedRevision > recordRevision) throw new TaskifySourceError('malformed-source', 'anchor activation revision is in the future')
    return {
      id,
      text: text(anchor.text, `source.anchors[${index}].text`, MAX_ANCHOR_TEXT_CHARS),
      evidence: text(anchor.evidence, `source.anchors[${index}].evidence`, MAX_EVIDENCE_CHARS),
      status: anchor.status,
      scope: { kind: 'session', sessionId },
      activatedRevision,
    }
  })
}

function binding(value) {
  if (!isRecord(value)) throw new TaskifySourceError('malformed-source', 'source.binding must be an object')
  onlyKeys(value, ['boundDraft', 'sourceDraft', 'acceptedDrafts'], 'source.binding')
  const boundDraft = text(value.boundDraft, 'source.binding.boundDraft', MAX_DRAFT_CHARS)
  const sourceDraft = text(value.sourceDraft, 'source.binding.sourceDraft', MAX_DRAFT_CHARS)
  if (!Array.isArray(value.acceptedDrafts) || value.acceptedDrafts.length < 1 || value.acceptedDrafts.length > 2) {
    throw new TaskifySourceError('malformed-source', 'source.binding.acceptedDrafts is invalid')
  }
  const acceptedDrafts = value.acceptedDrafts.map((draft, index) => text(
    draft, `source.binding.acceptedDrafts[${index}]`, MAX_DRAFT_CHARS,
  ))
  if (new Set(acceptedDrafts).size !== acceptedDrafts.length
    || !acceptedDrafts.includes(boundDraft) || !acceptedDrafts.includes(sourceDraft)) {
    throw new TaskifySourceError('malformed-source', 'source.binding accepted drafts are inconsistent')
  }
  return { boundDraft, sourceDraft, acceptedDrafts }
}

function operation(value) {
  if (!isRecord(value)) throw new TaskifySourceError('malformed-source', 'source.operation must be an object')
  onlyKeys(value, ['kind', 'targetAnchorId'], 'source.operation')
  if (!LIFECYCLE_KINDS.has(value.kind)) throw new TaskifySourceError('malformed-source', 'source.operation.kind is invalid')
  if (value.kind === 'clear') {
    if (value.targetAnchorId !== undefined) throw new TaskifySourceError('malformed-source', 'clear cannot have a targetAnchorId')
    return { kind: 'clear' }
  }
  return { kind: value.kind, targetAnchorId: text(value.targetAnchorId, 'source.operation.targetAnchorId') }
}

function freezeSource(source) {
  const copy = structuredClone(source)
  for (const anchor of copy.anchors) {
    if (anchor.scope) Object.freeze(anchor.scope)
    Object.freeze(anchor)
  }
  Object.freeze(copy.anchors)
  if (copy.binding) {
    Object.freeze(copy.binding.acceptedDrafts)
    Object.freeze(copy.binding)
  }
  if (copy.operation) Object.freeze(copy.operation)
  return Object.freeze(copy)
}

export class TaskifySourceError extends TypeError {
  constructor(code, message) {
    super(message)
    this.name = 'TaskifySourceError'
    this.code = code
  }
}

export function taskifyBundleId(requestId, armedRevision) {
  return `taskify:${armedRevision}:${text(requestId, 'requestId')}`
}

export function taskifyStateRecordId(recordRevision, kind, targetAnchorId) {
  const target = targetAnchorId ?? 'all'
  return `taskify-state:${revision(recordRevision, 'revision')}:${text(kind, 'operation.kind')}:${text(target, 'operation.target')}`
}

export function parseTaskifyMessageSource(value, { expectedSessionId } = {}) {
  if (!isRecord(value)) throw new TaskifySourceError('malformed-source', 'source must be an object')
  if (value.kind !== TASKIFY_MESSAGE_SOURCE_KIND) throw new TaskifySourceError('unrelated-source', 'source is not Taskify')
  if (value.schemaVersion !== TASKIFY_MESSAGE_SOURCE_VERSION) {
    throw new TaskifySourceError('unsupported-version', 'Taskify source schemaVersion is unsupported')
  }
  const sessionId = text(value.sessionId, 'source.sessionId')
  if (expectedSessionId !== undefined && sessionId !== expectedSessionId) {
    throw new TaskifySourceError('wrong-session', 'Taskify source belongs to another session')
  }

  if (value.recordType === 'activation') {
    onlyKeys(value, [
      'kind', 'schemaVersion', 'recordType', 'sessionId', 'bundleId', 'baseRevision',
      'armedRevision', 'activationRevision', 'requestId', 'binding', 'anchors',
    ], 'source')
    const baseRevision = revision(value.baseRevision, 'source.baseRevision')
    const armedRevision = revision(value.armedRevision, 'source.armedRevision')
    const activationRevision = revision(value.activationRevision, 'source.activationRevision')
    if (armedRevision !== baseRevision + 2 || activationRevision !== armedRevision + 1) {
      throw new TaskifySourceError('malformed-source', 'activation revisions are inconsistent')
    }
    const source = {
      kind: TASKIFY_MESSAGE_SOURCE_KIND,
      schemaVersion: TASKIFY_MESSAGE_SOURCE_VERSION,
      recordType: 'activation',
      sessionId,
      bundleId: text(value.bundleId, 'source.bundleId'),
      baseRevision,
      armedRevision,
      activationRevision,
      requestId: text(value.requestId, 'source.requestId'),
      binding: binding(value.binding),
      anchors: extractedAnchors(value.anchors),
    }
    if (source.bundleId !== taskifyBundleId(source.requestId, source.armedRevision)) {
      throw new TaskifySourceError('malformed-source', 'source.bundleId is inconsistent')
    }
    return freezeSource(source)
  }

  if (value.recordType === 'state-update') {
    onlyKeys(value, [
      'kind', 'schemaVersion', 'recordType', 'sessionId', 'recordId',
      'revision', 'anchors', 'operation',
    ], 'source')
    const recordRevision = revision(value.revision, 'source.revision')
    if (recordRevision === 0) throw new TaskifySourceError('malformed-source', 'state update revision must be positive')
    const parsedOperation = operation(value.operation)
    const source = {
      kind: TASKIFY_MESSAGE_SOURCE_KIND,
      schemaVersion: TASKIFY_MESSAGE_SOURCE_VERSION,
      recordType: 'state-update',
      sessionId,
      recordId: text(value.recordId, 'source.recordId'),
      revision: recordRevision,
      anchors: persistentAnchors(value.anchors, sessionId, recordRevision),
      operation: parsedOperation,
    }
    if (source.recordId !== taskifyStateRecordId(recordRevision, parsedOperation.kind, parsedOperation.targetAnchorId)) {
      throw new TaskifySourceError('malformed-source', 'source.recordId is inconsistent')
    }
    return freezeSource(source)
  }

  throw new TaskifySourceError('malformed-source', 'source.recordType is invalid')
}

export function createTaskifyActivationSource({
  sessionId,
  baseRevision,
  armedRevision,
  activationRevision = armedRevision + 1,
  requestId,
  boundDraft,
  sourceDraft,
  anchors,
}) {
  return parseTaskifyMessageSource({
    kind: TASKIFY_MESSAGE_SOURCE_KIND,
    schemaVersion: TASKIFY_MESSAGE_SOURCE_VERSION,
    recordType: 'activation',
    sessionId,
    bundleId: taskifyBundleId(requestId, armedRevision),
    baseRevision,
    armedRevision,
    activationRevision,
    requestId,
    binding: { boundDraft, sourceDraft, acceptedDrafts: [...new Set([boundDraft, sourceDraft])] },
    anchors,
  }, { expectedSessionId: sessionId })
}

export const createTaskifyMessageSource = createTaskifyActivationSource

export function createTaskifyStateUpdateSource({ sessionId, revision: recordRevision, anchors, operation: change }) {
  return parseTaskifyMessageSource({
    kind: TASKIFY_MESSAGE_SOURCE_KIND,
    schemaVersion: TASKIFY_MESSAGE_SOURCE_VERSION,
    recordType: 'state-update',
    sessionId,
    recordId: taskifyStateRecordId(recordRevision, change.kind, change.targetAnchorId),
    revision: recordRevision,
    anchors,
    operation: change,
  }, { expectedSessionId: sessionId })
}

/** Classify without treating unrelated MessageSource kinds as malformed Taskify data. */
export function inspectTaskifyUserMessage(message, expectedSessionId) {
  if (message?.role !== 'user' || message?.source?.kind !== TASKIFY_MESSAGE_SOURCE_KIND) return { kind: 'unrelated' }
  if (typeof message.id !== 'string' || message.id === '') return { kind: 'invalid', code: 'malformed-message' }
  try {
    return { kind: 'valid', message, source: parseTaskifyMessageSource(message.source, { expectedSessionId }) }
  } catch (error) {
    return { kind: 'invalid', code: error instanceof TaskifySourceError ? error.code : 'malformed-source' }
  }
}
