/**
 * Wire schemas for the single dsh-taskify Remote method.
 *
 * These are intentionally dependency-free: Typert requires a strict codec
 * with a `parse()` function, not a Zod instance.
 */

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

export const compileRequestSchema = {
  parse(value) {
    if (!isRecord(value)) throw new TypeError('request must be an object')
    const requestId = requireNonEmptyString(value.requestId, 'requestId')
    const sessionId = requireNonEmptyString(value.sessionId, 'sessionId')
    const draft = requireString(value.draft, 'draft')
    const context = requireString(value.context ?? '', 'context')
    return { requestId, sessionId, draft, context }
  },
}

export const compileResultSchema = {
  parse(value) {
    if (!isRecord(value)) throw new TypeError('result must be an object')
    const ok = value.ok
    if (typeof ok !== 'boolean') throw new TypeError('result.ok must be a boolean')
    const requestId = requireNonEmptyString(value.requestId, 'requestId')
    if (ok) {
      return { ok: true, requestId, text: requireString(value.text, 'text') }
    }
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

export const TYPERT_DESCRIPTOR = {
  id: 'dsh-taskify#taskify/compile',
  service: 'taskify',
  namespace: 'taskify',
  method: 'compile',
  invocation: { kind: 'direct' },
  parameters: [
    {
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: {
        mode: 'strict',
        typeSymbol: 'dsh-taskify#CompileRequest',
        schema: compileRequestSchema,
      },
    },
  ],
  cancellation: { parameter: 'signal' },
  result: {
    mode: 'strict',
    typeSymbol: 'dsh-taskify#CompileResult',
    schema: compileResultSchema,
  },
}

/** Mounted by the browser half through `ctx.remote.$mount()`. */
export const TYPERT_REMOTE_CONTRIBUTION = {
  package: 'dsh-taskify',
  descriptors: [TYPERT_DESCRIPTOR],
}

/** Registered by the Host half through `ctx.typert.register()`. */
export const TYPERT_CONTRIBUTION = {
  package: 'dsh-taskify',
  face: 'host',
  schemas: [],
  model: {
    services: [
      {
        key: 'taskify',
        exportName: 'TaskifyService',
        summary: 'Task Compiler host service.',
        description: 'Compiles a composer draft into a minimum necessary executable task specification.',
        tags: [],
        jsDoc: '/** Task Compiler Host service. */',
        members: [
          {
            kind: 'method',
            name: 'compile',
            signature: 'async compile(request: CompileRequest, signal?: AbortSignal): Promise<CompileResult>',
            summary: 'Compile one locked user draft.',
            jsDoc: '/** Compile one locked user draft. */',
          },
        ],
        types: [
          {
            name: 'CompileRequest',
            declaration: 'export interface CompileRequest { readonly requestId: string; readonly sessionId: string; readonly draft: string; readonly context: string }',
          },
          {
            name: 'CompileResult',
            declaration: 'export type CompileResult = { readonly ok: true; readonly requestId: string; readonly text: string } | { readonly ok: false; readonly requestId: string; readonly error: { readonly code: string; readonly message: string } }',
          },
        ],
      },
    ],
    events: [],
    objects: [],
  },
  invocations: [TYPERT_DESCRIPTOR],
}
