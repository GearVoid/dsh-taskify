/** Strict Typert wire schemas for Host-authoritative Taskify state. */

import { MAX_ANCHORS, MAX_ANCHOR_TEXT_CHARS, MAX_EVIDENCE_CHARS } from './compiler.js'
import { MAX_PERSISTENT_ANCHORS } from './lifecycle.js'
import { TASKIFY_STATE_SCHEMA_VERSION } from './state.js'

function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function requireRecord(value, name) { if (!isRecord(value)) throw new TypeError(`${name} must be an object`); return value }
function requireOnlyKeys(value, allowed, name) {
  const unexpected = Object.keys(value).find(key => !allowed.includes(key))
  if (unexpected !== undefined) throw new TypeError(`${name} contains unknown field ${unexpected}`)
}
function requireString(value, name) { if (typeof value !== 'string') throw new TypeError(`${name} must be a string`); return value }
function requireNonEmptyString(value, name) {
  const result = requireString(value, name)
  if (result.trim() === '') throw new TypeError(`${name} must not be empty`)
  return result
}
function requireRevision(value, name = 'revision') {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative safe integer`)
  return value
}

function parseExtractedAnchor(value, name) {
  requireRecord(value, name)
  requireOnlyKeys(value, ['text', 'evidence'], name)
  const text = requireNonEmptyString(value.text, `${name}.text`)
  const evidence = requireNonEmptyString(value.evidence, `${name}.evidence`)
  if (text.length > MAX_ANCHOR_TEXT_CHARS) throw new TypeError(`${name}.text is too long`)
  if (evidence.length > MAX_EVIDENCE_CHARS) throw new TypeError(`${name}.evidence is too long`)
  return { text, evidence }
}

function parseExtractedAnchors(value, name) {
  if (!Array.isArray(value) || value.length > MAX_ANCHORS) throw new TypeError(`${name} is invalid`)
  return value.map((anchor, index) => parseExtractedAnchor(anchor, `${name}[${index}]`))
}

function parsePersistentAnchors(value, sessionId) {
  if (!Array.isArray(value) || value.length > MAX_PERSISTENT_ANCHORS) throw new TypeError('state.anchors is invalid')
  const ids = new Set()
  return value.map((anchor, index) => {
    const name = `state.anchors[${index}]`
    requireRecord(anchor, name)
    requireOnlyKeys(anchor, ['id', 'text', 'evidence', 'status', 'scope', 'activatedRevision'], name)
    const id = requireNonEmptyString(anchor.id, `${name}.id`)
    if (ids.has(id)) throw new TypeError('state anchor identities must be unique')
    ids.add(id)
    const text = requireNonEmptyString(anchor.text, `${name}.text`)
    const evidence = requireNonEmptyString(anchor.evidence, `${name}.evidence`)
    if (text.length > MAX_ANCHOR_TEXT_CHARS) throw new TypeError(`${name}.text is too long`)
    if (evidence.length > MAX_EVIDENCE_CHARS) throw new TypeError(`${name}.evidence is too long`)
    if (anchor.status !== 'active' && anchor.status !== 'paused') throw new TypeError(`${name}.status is invalid`)
    requireRecord(anchor.scope, `${name}.scope`)
    requireOnlyKeys(anchor.scope, ['kind', 'sessionId'], `${name}.scope`)
    if (anchor.scope.kind !== 'session' || anchor.scope.sessionId !== sessionId) throw new TypeError(`${name}.scope must match the exact session`)
    return {
      id,
      text,
      evidence,
      status: anchor.status,
      scope: { kind: 'session', sessionId },
      activatedRevision: requireRevision(anchor.activatedRevision, `${name}.activatedRevision`),
    }
  })
}

function parseCarrier(value) {
  if (value === null || value === undefined) return null
  requireRecord(value, 'state.request.bundle.carrier')
  requireOnlyKeys(value, ['messageId', 'bundleId', 'requestId'], 'state.request.bundle.carrier')
  return {
    messageId: requireNonEmptyString(value.messageId, 'state.request.bundle.carrier.messageId'),
    bundleId: requireNonEmptyString(value.bundleId, 'state.request.bundle.carrier.bundleId'),
    requestId: requireNonEmptyString(value.requestId, 'state.request.bundle.carrier.requestId'),
  }
}

function parseRequest(value) {
  requireRecord(value, 'state.request')
  if (value.phase === 'idle') {
    requireOnlyKeys(value, ['phase'], 'state.request')
    return { phase: 'idle' }
  }
  if (value.phase === 'pending') {
    requireOnlyKeys(value, ['phase', 'pending'], 'state.request')
    requireRecord(value.pending, 'state.request.pending')
    requireOnlyKeys(value.pending, ['requestId', 'boundDraft', 'sourceDraft'], 'state.request.pending')
    return {
      phase: 'pending',
      pending: {
        requestId: requireNonEmptyString(value.pending.requestId, 'state.request.pending.requestId'),
        boundDraft: requireNonEmptyString(value.pending.boundDraft, 'state.request.pending.boundDraft'),
        sourceDraft: requireNonEmptyString(value.pending.sourceDraft, 'state.request.pending.sourceDraft'),
      },
    }
  }
  if (value.phase === 'armed') {
    requireOnlyKeys(value, ['phase', 'bundle'], 'state.request')
    requireRecord(value.bundle, 'state.request.bundle')
    requireOnlyKeys(value.bundle, ['requestId', 'boundDraft', 'sourceDraft', 'anchors', 'carrier'], 'state.request.bundle')
    return {
      phase: 'armed',
      bundle: {
        requestId: requireNonEmptyString(value.bundle.requestId, 'state.request.bundle.requestId'),
        boundDraft: requireNonEmptyString(value.bundle.boundDraft, 'state.request.bundle.boundDraft'),
        sourceDraft: requireNonEmptyString(value.bundle.sourceDraft, 'state.request.bundle.sourceDraft'),
        anchors: parseExtractedAnchors(value.bundle.anchors, 'state.request.bundle.anchors'),
        carrier: parseCarrier(value.bundle.carrier),
      },
    }
  }
  throw new TypeError('state.request.phase is invalid')
}

function parseError(value) {
  requireRecord(value, 'error')
  requireOnlyKeys(value, ['code', 'message'], 'error')
  return { code: requireNonEmptyString(value.code, 'error.code'), message: requireString(value.message, 'error.message') }
}

export const taskifyStateSnapshotSchema = {
  parse(value) {
    requireRecord(value, 'state')
    requireOnlyKeys(value, [
      'schemaVersion', 'sessionId', 'revision', 'durability', 'runtimeContext',
      'goalIntegration', 'request', 'anchors', 'scope',
    ], 'state')
    if (value.schemaVersion !== TASKIFY_STATE_SCHEMA_VERSION) throw new TypeError('state.schemaVersion is unsupported')
    const sessionId = requireNonEmptyString(value.sessionId, 'state.sessionId')
    const revision = requireRevision(value.revision, 'state.revision')
    requireRecord(value.durability, 'state.durability')
    requireOnlyKeys(value.durability, ['status'], 'state.durability')
    if (!['unavailable', 'confirmed', 'failed'].includes(value.durability.status)) throw new TypeError('state.durability.status is invalid')
    requireRecord(value.runtimeContext, 'state.runtimeContext')
    requireOnlyKeys(value.runtimeContext, ['available'], 'state.runtimeContext')
    if (typeof value.runtimeContext.available !== 'boolean') throw new TypeError('state.runtimeContext.available must be boolean')
    requireRecord(value.goalIntegration, 'state.goalIntegration')
    requireOnlyKeys(value.goalIntegration, ['available'], 'state.goalIntegration')
    if (value.goalIntegration.available !== false) throw new TypeError('state.goalIntegration.available must be false')
    requireRecord(value.scope, 'state.scope')
    requireOnlyKeys(value.scope, ['kind', 'sessionId'], 'state.scope')
    if (value.scope.kind !== 'session' || value.scope.sessionId !== sessionId) throw new TypeError('state.scope must match the exact session')
    return {
      schemaVersion: TASKIFY_STATE_SCHEMA_VERSION,
      sessionId,
      revision,
      durability: { status: value.durability.status },
      runtimeContext: { available: value.runtimeContext.available },
      goalIntegration: { available: false },
      request: parseRequest(value.request),
      anchors: parsePersistentAnchors(value.anchors, sessionId),
      scope: { kind: 'session', sessionId },
    }
  },
}

export const getStateRequestSchema = {
  parse(value) {
    requireRecord(value, 'request'); requireOnlyKeys(value, ['sessionId'], 'request')
    return { sessionId: requireNonEmptyString(value.sessionId, 'sessionId') }
  },
}

export const compileRequestSchema = {
  parse(value) {
    requireRecord(value, 'request')
    requireOnlyKeys(value, ['requestId', 'sessionId', 'expectedRevision', 'rawDraft', 'sourceDraft', 'draft', 'nonce', 'literals'], 'request')
    const result = {
      requestId: requireNonEmptyString(value.requestId, 'requestId'),
      sessionId: requireNonEmptyString(value.sessionId, 'sessionId'),
      expectedRevision: requireRevision(value.expectedRevision, 'expectedRevision'),
      rawDraft: requireNonEmptyString(value.rawDraft, 'rawDraft'),
      sourceDraft: requireNonEmptyString(value.sourceDraft, 'sourceDraft'),
      draft: requireNonEmptyString(value.draft, 'draft'),
      nonce: requireNonEmptyString(value.nonce, 'nonce'),
    }
    if (!/^[A-F0-9]{8}$/.test(result.nonce)) throw new TypeError('nonce is invalid')
    if (!Array.isArray(value.literals) || value.literals.some(item => typeof item !== 'string')) throw new TypeError('literals must be a string array')
    return { ...result, literals: [...value.literals] }
  },
}

function parseMutationResult(value, requestId) {
  requireRecord(value, 'result')
  if (typeof value.ok !== 'boolean') throw new TypeError('result.ok must be a boolean')
  const allowed = requestId ? ['ok', 'requestId', 'error', 'state'] : ['ok', 'error', 'state']
  requireOnlyKeys(value, value.ok ? allowed.filter(key => key !== 'error') : allowed, 'result')
  const result = { ok: value.ok }
  if (requestId) result.requestId = requireNonEmptyString(value.requestId, 'requestId')
  if (!value.ok) result.error = parseError(value.error)
  result.state = taskifyStateSnapshotSchema.parse(value.state)
  return result
}

export const compileResultSchema = { parse(value) { return parseMutationResult(value, true) } }

export const invalidateRequestSchema = {
  parse(value) {
    requireRecord(value, 'request'); requireOnlyKeys(value, ['sessionId', 'expectedRevision'], 'request')
    return { sessionId: requireNonEmptyString(value.sessionId, 'sessionId'), expectedRevision: requireRevision(value.expectedRevision, 'expectedRevision') }
  },
}
export const invalidateResultSchema = { parse(value) { return parseMutationResult(value, false) } }

export const anchorMutationRequestSchema = {
  parse(value) {
    requireRecord(value, 'request'); requireOnlyKeys(value, ['sessionId', 'expectedRevision', 'anchorId'], 'request')
    return {
      sessionId: requireNonEmptyString(value.sessionId, 'sessionId'),
      expectedRevision: requireRevision(value.expectedRevision, 'expectedRevision'),
      anchorId: requireNonEmptyString(value.anchorId, 'anchorId'),
    }
  },
}
export const clearAnchorsRequestSchema = invalidateRequestSchema
export const lifecycleMutationResultSchema = invalidateResultSchema

const directRequest = (name, typeSymbol, schema) => ({ name, wire: name, source: 'json', codec: { mode: 'strict', typeSymbol, schema } })
const result = (typeSymbol, schema) => ({ mode: 'strict', typeSymbol: `dsh-taskify#${typeSymbol}`, schema })
const descriptor = (method, requestType, requestSchema, resultType = 'LifecycleMutationResult', resultSchema = lifecycleMutationResultSchema) => ({
  id: `dsh-taskify#taskify/${method}`,
  service: 'taskify', namespace: 'taskify', method, invocation: { kind: 'direct' },
  parameters: [directRequest('request', `dsh-taskify#${requestType}`, requestSchema)],
  result: result(resultType, resultSchema),
})

const getStateDescriptor = descriptor('getState', 'GetStateRequest', getStateRequestSchema, 'TaskifyStateSnapshot', taskifyStateSnapshotSchema)
const compileDescriptor = {
  ...descriptor('compile', 'CompileRequest', compileRequestSchema, 'CompileResult', compileResultSchema),
  cancellation: { parameter: 'signal' },
}
const invalidateDescriptor = descriptor('invalidate', 'InvalidateRequest', invalidateRequestSchema, 'LifecycleMutationResult', invalidateResultSchema)
const pauseDescriptor = descriptor('pauseAnchor', 'AnchorMutationRequest', anchorMutationRequestSchema)
const resumeDescriptor = descriptor('resumeAnchor', 'AnchorMutationRequest', anchorMutationRequestSchema)
const removeDescriptor = descriptor('removeAnchor', 'AnchorMutationRequest', anchorMutationRequestSchema)
const clearDescriptor = descriptor('clearAnchors', 'ClearAnchorsRequest', clearAnchorsRequestSchema)

export const TYPERT_DESCRIPTORS = [
  getStateDescriptor, compileDescriptor, invalidateDescriptor,
  pauseDescriptor, resumeDescriptor, removeDescriptor, clearDescriptor,
]
export const TYPERT_REMOTE_CONTRIBUTION = { package: 'dsh-taskify', descriptors: TYPERT_DESCRIPTORS }

const anchorDeclaration = 'export interface Anchor { readonly text: string; readonly evidence: string }'
const persistentDeclaration = 'export interface PersistentAnchor extends Anchor { readonly id: string; readonly status: "active" | "paused"; readonly scope: { readonly kind: "session"; readonly sessionId: string }; readonly activatedRevision: number }'
const snapshotDeclaration = 'export interface TaskifyStateSnapshot { readonly schemaVersion: 2; readonly sessionId: string; readonly revision: number; readonly durability: { readonly status: "unavailable" | "confirmed" | "failed" }; readonly runtimeContext: { readonly available: boolean }; readonly goalIntegration: { readonly available: false }; readonly request: { readonly phase: "idle" } | { readonly phase: "pending"; readonly pending: { readonly requestId: string; readonly boundDraft: string; readonly sourceDraft: string } } | { readonly phase: "armed"; readonly bundle: { readonly requestId: string; readonly boundDraft: string; readonly sourceDraft: string; readonly anchors: readonly Anchor[]; readonly carrier: { readonly messageId: string; readonly bundleId: string; readonly requestId: string } | null } }; readonly anchors: readonly PersistentAnchor[]; readonly scope: { readonly kind: "session"; readonly sessionId: string } }'

export const TYPERT_CONTRIBUTION = {
  package: 'dsh-taskify', face: 'host', schemas: [],
  model: { services: [{
    key: 'taskify', exportName: 'TaskifyService', summary: 'Taskify persistent session-constraint service.',
    description: 'Owns revisioned session-scoped request and persistent-anchor state.', tags: [],
    jsDoc: '/** Host-authoritative persistent Taskify state. */',
    members: [
      { kind: 'method', name: 'getState', signature: 'async getState(request: GetStateRequest): Promise<TaskifyStateSnapshot>', summary: 'Read exact-session Taskify state.', jsDoc: '/** Read exact-session Taskify state. */' },
      { kind: 'method', name: 'compile', signature: 'async compile(request: CompileRequest, signal?: AbortSignal): Promise<CompileResult>', summary: 'Extract and arm a constraint bundle.', jsDoc: '/** Extract and arm a constraint bundle. */' },
      { kind: 'method', name: 'invalidate', signature: 'async invalidate(request: InvalidateRequest): Promise<LifecycleMutationResult>', summary: 'Invalidate only the pending request bundle.', jsDoc: '/** Invalidate the pending request bundle. */' },
      ...['pauseAnchor', 'resumeAnchor', 'removeAnchor', 'clearAnchors'].map(name => ({ kind: 'method', name, signature: `async ${name}(request: ${name === 'clearAnchors' ? 'ClearAnchorsRequest' : 'AnchorMutationRequest'}): Promise<LifecycleMutationResult>`, summary: `${name} through an explicit user Remote mutation.`, jsDoc: `/** Explicit user lifecycle mutation: ${name}. */` })),
    ],
    types: [
      { name: 'Anchor', declaration: anchorDeclaration },
      { name: 'PersistentAnchor', declaration: persistentDeclaration },
      { name: 'TaskifyStateSnapshot', declaration: snapshotDeclaration },
      { name: 'GetStateRequest', declaration: 'export interface GetStateRequest { readonly sessionId: string }' },
      { name: 'TaskifyError', declaration: 'export interface TaskifyError { readonly code: string; readonly message: string }' },
      { name: 'CompileRequest', declaration: 'export interface CompileRequest { readonly requestId: string; readonly sessionId: string; readonly expectedRevision: number; readonly rawDraft: string; readonly sourceDraft: string; readonly draft: string; readonly nonce: string; readonly literals: readonly string[] }' },
      { name: 'CompileResult', declaration: 'export type CompileResult = { readonly ok: true; readonly requestId: string; readonly state: TaskifyStateSnapshot } | { readonly ok: false; readonly requestId: string; readonly error: TaskifyError; readonly state: TaskifyStateSnapshot }' },
      { name: 'InvalidateRequest', declaration: 'export interface InvalidateRequest { readonly sessionId: string; readonly expectedRevision: number }' },
      { name: 'AnchorMutationRequest', declaration: 'export interface AnchorMutationRequest extends InvalidateRequest { readonly anchorId: string }' },
      { name: 'ClearAnchorsRequest', declaration: 'export interface ClearAnchorsRequest extends InvalidateRequest {}' },
      { name: 'LifecycleMutationResult', declaration: 'export type LifecycleMutationResult = { readonly ok: true; readonly state: TaskifyStateSnapshot } | { readonly ok: false; readonly error: TaskifyError; readonly state: TaskifyStateSnapshot }' },
    ],
  }] },
  invocations: TYPERT_DESCRIPTORS,
}
