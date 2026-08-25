/** Dependency-free Typert wire schemas for Taskify's Host methods. */

import { MAX_ANCHORS, MAX_ANCHOR_TEXT_CHARS, MAX_EVIDENCE_CHARS } from './compiler.js'

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(value, name) {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`)
  return value
}

function requireNonEmptyString(value, name) {
  const result = requireString(value, name)
  if (result.trim() === '') throw new TypeError(`${name} must not be empty`)
  return result
}

function parseAnchor(value, name) {
  if (!isRecord(value)) throw new TypeError(`${name} must be an object`)
  const text = requireNonEmptyString(value.text, `${name}.text`)
  const evidence = requireNonEmptyString(value.evidence, `${name}.evidence`)
  if (text.length > MAX_ANCHOR_TEXT_CHARS) throw new TypeError(`${name}.text is too long`)
  if (evidence.length > MAX_EVIDENCE_CHARS) throw new TypeError(`${name}.evidence is too long`)
  return { text, evidence }
}

function parseAnchors(value) {
  if (!Array.isArray(value)) throw new TypeError('anchors must be an array')
  if (value.length > MAX_ANCHORS) throw new TypeError('anchors contains too many items')
  return value.map((anchor, index) => parseAnchor(anchor, `anchors[${index}]`))
}

export const compileRequestSchema = {
  parse(value) {
    if (!isRecord(value)) throw new TypeError('request must be an object')
    const requestId = requireNonEmptyString(value.requestId, 'requestId')
    const sessionId = requireNonEmptyString(value.sessionId, 'sessionId')
    const rawDraft = requireNonEmptyString(value.rawDraft, 'rawDraft')
    const sourceDraft = requireNonEmptyString(value.sourceDraft, 'sourceDraft')
    const draft = requireNonEmptyString(value.draft, 'draft')
    const nonce = requireNonEmptyString(value.nonce, 'nonce')
    if (!/^[A-F0-9]{8}$/.test(nonce)) throw new TypeError('nonce is invalid')
    if (!Array.isArray(value.literals) || value.literals.some(item => typeof item !== 'string')) {
      throw new TypeError('literals must be a string array')
    }
    return { requestId, sessionId, rawDraft, sourceDraft, draft, nonce, literals: [...value.literals] }
  },
}

export const compileResultSchema = {
  parse(value) {
    if (!isRecord(value)) throw new TypeError('result must be an object')
    if (typeof value.ok !== 'boolean') throw new TypeError('result.ok must be a boolean')
    const requestId = requireNonEmptyString(value.requestId, 'requestId')
    if (value.ok) return { ok: true, requestId, anchors: parseAnchors(value.anchors) }
    if (!isRecord(value.error)) throw new TypeError('result.error must be an object')
    return {
      ok: false,
      requestId,
      error: {
        code: requireString(value.error.code, 'error.code'),
        message: requireString(value.error.message, 'error.message'),
      },
    }
  },
}

export const invalidateRequestSchema = {
  parse(value) {
    if (!isRecord(value)) throw new TypeError('request must be an object')
    return { sessionId: requireNonEmptyString(value.sessionId, 'sessionId') }
  },
}

export const invalidateResultSchema = {
  parse(value) {
    if (!isRecord(value) || value.ok !== true) throw new TypeError('result.ok must be true')
    return { ok: true }
  },
}

const compileDescriptor = {
  id: 'dsh-taskify#taskify/compile',
  service: 'taskify',
  namespace: 'taskify',
  method: 'compile',
  invocation: { kind: 'direct' },
  parameters: [{
    name: 'request',
    wire: 'request',
    source: 'json',
    codec: { mode: 'strict', typeSymbol: 'dsh-taskify#CompileRequest', schema: compileRequestSchema },
  }],
  cancellation: { parameter: 'signal' },
  result: { mode: 'strict', typeSymbol: 'dsh-taskify#CompileResult', schema: compileResultSchema },
}

const invalidateDescriptor = {
  id: 'dsh-taskify#taskify/invalidate',
  service: 'taskify',
  namespace: 'taskify',
  method: 'invalidate',
  invocation: { kind: 'direct' },
  parameters: [{
    name: 'request',
    wire: 'request',
    source: 'json',
    codec: { mode: 'strict', typeSymbol: 'dsh-taskify#InvalidateRequest', schema: invalidateRequestSchema },
  }],
  result: { mode: 'strict', typeSymbol: 'dsh-taskify#InvalidateResult', schema: invalidateResultSchema },
}

export const TYPERT_DESCRIPTORS = [compileDescriptor, invalidateDescriptor]
export const TYPERT_REMOTE_CONTRIBUTION = { package: 'dsh-taskify', descriptors: TYPERT_DESCRIPTORS }

export const TYPERT_CONTRIBUTION = {
  package: 'dsh-taskify',
  face: 'host',
  schemas: [],
  model: {
    services: [{
      key: 'taskify',
      exportName: 'TaskifyService',
      summary: 'Taskify constraint-anchor host service.',
      description: 'Extracts reviewable hard constraints from the current composer draft.',
      tags: [],
      jsDoc: '/** Taskify constraint-anchor Host service. */',
      members: [
        {
          kind: 'method',
          name: 'compile',
          signature: 'async compile(request: CompileRequest, signal?: AbortSignal): Promise<CompileResult>',
          summary: 'Extract anchors from one protected current-user draft.',
          jsDoc: '/** Extract anchors from one protected current-user draft. */',
        },
        {
          kind: 'method',
          name: 'invalidate',
          signature: 'async invalidate(request: InvalidateRequest): Promise<InvalidateResult>',
          summary: 'Discard anchors when the raw draft changes.',
          jsDoc: '/** Discard anchors when the raw draft changes. */',
        },
      ],
      types: [
        { name: 'Anchor', declaration: 'export interface Anchor { readonly text: string; readonly evidence: string }' },
        { name: 'CompileRequest', declaration: 'export interface CompileRequest { readonly requestId: string; readonly sessionId: string; readonly rawDraft: string; readonly sourceDraft: string; readonly draft: string; readonly nonce: string; readonly literals: readonly string[] }' },
        { name: 'CompileResult', declaration: 'export type CompileResult = { readonly ok: true; readonly requestId: string; readonly anchors: readonly Anchor[] } | { readonly ok: false; readonly requestId: string; readonly error: { readonly code: string; readonly message: string } }' },
        { name: 'InvalidateRequest', declaration: 'export interface InvalidateRequest { readonly sessionId: string }' },
        { name: 'InvalidateResult', declaration: 'export interface InvalidateResult { readonly ok: true }' },
      ],
    }],
    events: [],
    objects: [],
  },
  invocations: TYPERT_DESCRIPTORS,
}
