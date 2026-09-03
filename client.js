window.__ModuleLoader__.load({
  id: "dsh-taskify",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = __toESM(require("react"), 1);
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/display.js
function normalizeDisplayWhitespace(value) {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}
function anchorProvenanceForDisplay(anchor) {
  const evidence = typeof anchor?.evidence === "string" ? anchor.evidence : "";
  if (normalizeDisplayWhitespace(evidence) === "" || normalizeDisplayWhitespace(anchor?.text) === normalizeDisplayWhitespace(evidence)) return null;
  return {
    title: "\u6765\u81EA\u4F60\u7684\u539F\u8BDD",
    evidence
  };
}

// src/shared/literal-lock.js
var MAX_LITERALS = 900;
var SENTINEL_PREFIX = "__DSH_TASKIFY_";
var SENTINEL_SUFFIX = "__";
var LOCK_SEGMENT = "_LOCK_";
var FENCED_CODE_RE = /```[^\n`]*\n?[\s\S]*?```/g;
var INLINE_CODE_RE = /`[^`\n]+`/g;
var URL_RE = /(?:https?|ftp):\/\/[^\s<>"'()[\]{}，。；：！？]+/giu;
var IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{2,5})?\b/g;
var HOST_PORT_RE = /\b(?:localhost|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+):\d{2,5}\b/g;
var QUOTED_PATH_RE = /(?<=["'])(?:(?:[A-Za-z]:[\\/])|(?:\\\\[^\\/"']+[\\/])|\/)[^"'\r\n]+(?=["'])/gu;
var WINDOWS_PATH_RE = /(?<![A-Za-z0-9_])(?:[A-Za-z]:[\\/]|\\\\[A-Za-z0-9._$-]+\\)[^\s<>"'|?*，。；：！？]+/gu;
var POSIX_PATH_RE = /(?<![A-Za-z0-9_])(?:\/|\.{1,2}\/|[A-Za-z0-9_.@~-]+\/)[^\s<>"'()[\]{}，。；：！？]+/gu;
var ENV_VAR_RE = /\b[A-Z][A-Z0-9_]{2,}\b/g;
var VERSION_RE = /\bv?\d+(?:\.\d+)+(?:-[A-Za-z0-9][A-Za-z0-9.-]*)?\b/g;
var NODE_VERSION_RE = /\bNode(?:\.js)?\s+\d+(?:\.\d+)*\b/gi;
var LONG_FLAG_RE = /(?<![A-Za-z0-9])--[A-Za-z0-9][A-Za-z0-9-]*(?![A-Za-z0-9])/g;
var SHORT_FLAG_RE = /(?<![A-Za-z0-9])-[A-Za-z](?![A-Za-z0-9])/g;
var SLASH_TOKEN_RE = /(?<![A-Za-z0-9])\/[A-Za-z][\w-]*(?![A-Za-z0-9])/g;
var LOWER_CAMEL_RE = /\b[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9_$]*\b/g;
var UPPER_IDENTIFIER_RE = /\b[A-Z][A-Za-z0-9_$]*\b/g;
var DOTTED_IDENTIFIER_RE = /\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+/g;
var PORT_CONTEXT_RE = /(?:port|端口)\s{0,4}(\d{2,5})\b/gi;
function makeSentinel(nonce, index) {
  return `${SENTINEL_PREFIX}${nonce}${LOCK_SEGMENT}${String(index).padStart(3, "0")}${SENTINEL_SUFFIX}`;
}
function generateNonce(text = "") {
  const alphabet = "0123456789ABCDEF";
  for (; ; ) {
    let nonce = "";
    for (let i = 0; i < 8; i += 1) nonce += alphabet[Math.floor(Math.random() * 16)];
    if (!text.includes(`${SENTINEL_PREFIX}${nonce}`)) return nonce;
  }
}
function trimTrailingPunctuation(value) {
  return value.replace(/[.,;:!?，。；：！？）)\]}]+$/u, "");
}
function matchItems(text, regex, transform = (match) => match[0]) {
  const items = [];
  for (const match of text.matchAll(regex)) {
    const raw = transform(match);
    if (!raw) continue;
    let start = match.index;
    let end = start + raw.length;
    const groupIndex = regex.toString().includes("(") ? -1 : -1;
    void groupIndex;
    const value = raw;
    if (value.trim() === "") continue;
    if (regex === URL_RE || regex === WINDOWS_PATH_RE || regex === POSIX_PATH_RE) {
      const trimmed = trimTrailingPunctuation(value);
      if (trimmed === "") continue;
      end = start + trimmed.length;
      items.push({ start, end, text: trimmed });
    } else {
      items.push({ start, end, text: value });
    }
  }
  return items;
}
function groupItems(text, regex) {
  const items = [];
  for (const match of text.matchAll(regex)) {
    const group = match[1];
    if (!group) continue;
    const start = match.index + match[0].indexOf(group);
    items.push({ start, end: start + group.length, text: group });
  }
  return items;
}
function intersects(item, region) {
  return item.start < region.end && item.end > region.start;
}
function uniqueSorted(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const result2 = [];
  let lastEnd = -1;
  for (const item of sorted) {
    if (item.start < lastEnd) continue;
    result2.push(item);
    lastEnd = item.end;
  }
  return result2;
}
function lockLiterals(draft) {
  const text = typeof draft === "string" ? draft : "";
  const nonce = generateNonce(text);
  const codeRegions = [];
  for (const match of text.matchAll(FENCED_CODE_RE)) {
    codeRegions.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  }
  for (const match of text.matchAll(INLINE_CODE_RE)) {
    codeRegions.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  }
  const patternItems = [];
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
    DOTTED_IDENTIFIER_RE
  ]) {
    for (const item of matchItems(text, regex)) {
      if (!codeRegions.some((region) => intersects(item, region))) patternItems.push(item);
    }
  }
  for (const item of groupItems(text, PORT_CONTEXT_RE)) {
    if (!codeRegions.some((region) => intersects(item, region))) patternItems.push(item);
  }
  const items = uniqueSorted([...codeRegions, ...patternItems]);
  if (items.length > MAX_LITERALS) {
    throw new Error(`Literal Lock refused: too many protected literals (${items.length})`);
  }
  const locks = [];
  let locked = text;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    const sentinel = makeSentinel(nonce, index);
    locks[index] = item.text;
    locked = locked.slice(0, item.start) + sentinel + locked.slice(item.end);
  }
  return { text: locked, nonce, locks, count: locks.length };
}

// src/shared/slash.js
var COMMAND_DRAFT_RE = /^(\/[A-Za-z][\w-]*)(?:[\s\u00A0]+([\s\S]*))?$/;
function parseSlashDraft(rawDraft) {
  const draft = typeof rawDraft === "string" ? rawDraft : "";
  const trimmed = draft.trim();
  if (trimmed === "") return { kind: "empty" };
  const match = COMMAND_DRAFT_RE.exec(trimmed);
  if (match === null) return { kind: "plain", draft };
  const command = match[1];
  const body = (match[2] ?? "").trim();
  if (body === "") return { kind: "command-only", command };
  return { kind: "command", command, body };
}

// src/shared/compiler.js
var MAX_ANCHORS = 8;
var MAX_ANCHOR_TEXT_CHARS = 240;
var MAX_EVIDENCE_CHARS = 320;

// src/shared/focus-suggestion.js
var MAX_FOCUS_SUGGESTION_CHARS = 400;

// src/shared/lifecycle.js
var MAX_PERSISTENT_ANCHORS = 16;
var MAX_FOCUS_TEXT_CHARS = 2e3;

// src/shared/state.js
var TASKIFY_STATE_SCHEMA_VERSION = 3;

// src/shared/schema.js
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requireRecord(value, name) {
  if (!isRecord(value)) throw new TypeError(`${name} must be an object`);
  return value;
}
function requireOnlyKeys(value, allowed, name) {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected !== void 0) throw new TypeError(`${name} contains unknown field ${unexpected}`);
}
function requireString(value, name) {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  return value;
}
function requireNonEmptyString(value, name) {
  const result2 = requireString(value, name);
  if (result2.trim() === "") throw new TypeError(`${name} must not be empty`);
  return result2;
}
function requireRevision(value, name = "revision") {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative safe integer`);
  return value;
}
function parseExtractedAnchor(value, name) {
  requireRecord(value, name);
  requireOnlyKeys(value, ["text", "evidence"], name);
  const text = requireNonEmptyString(value.text, `${name}.text`);
  const evidence = requireNonEmptyString(value.evidence, `${name}.evidence`);
  if (text.length > MAX_ANCHOR_TEXT_CHARS) throw new TypeError(`${name}.text is too long`);
  if (evidence.length > MAX_EVIDENCE_CHARS) throw new TypeError(`${name}.evidence is too long`);
  return { text, evidence };
}
function parseExtractedAnchors(value, name) {
  if (!Array.isArray(value) || value.length > MAX_ANCHORS) throw new TypeError(`${name} is invalid`);
  return value.map((anchor, index) => parseExtractedAnchor(anchor, `${name}[${index}]`));
}
function parsePersistentAnchors(value, sessionId) {
  if (!Array.isArray(value) || value.length > MAX_PERSISTENT_ANCHORS) throw new TypeError("state.anchors is invalid");
  const ids = /* @__PURE__ */ new Set();
  return value.map((anchor, index) => {
    const name = `state.anchors[${index}]`;
    requireRecord(anchor, name);
    requireOnlyKeys(anchor, ["id", "text", "evidence", "status", "scope", "activatedRevision"], name);
    const id = requireNonEmptyString(anchor.id, `${name}.id`);
    if (ids.has(id)) throw new TypeError("state anchor identities must be unique");
    ids.add(id);
    const text = requireNonEmptyString(anchor.text, `${name}.text`);
    const evidence = requireNonEmptyString(anchor.evidence, `${name}.evidence`);
    if (text.length > MAX_ANCHOR_TEXT_CHARS) throw new TypeError(`${name}.text is too long`);
    if (evidence.length > MAX_EVIDENCE_CHARS) throw new TypeError(`${name}.evidence is too long`);
    if (anchor.status !== "active" && anchor.status !== "paused") throw new TypeError(`${name}.status is invalid`);
    requireRecord(anchor.scope, `${name}.scope`);
    requireOnlyKeys(anchor.scope, ["kind", "sessionId"], `${name}.scope`);
    if (anchor.scope.kind !== "session" || anchor.scope.sessionId !== sessionId) throw new TypeError(`${name}.scope must match the exact session`);
    return {
      id,
      text,
      evidence,
      status: anchor.status,
      scope: { kind: "session", sessionId },
      activatedRevision: requireRevision(anchor.activatedRevision, `${name}.activatedRevision`)
    };
  });
}
function parseFocus(value, sessionId) {
  if (value === null) return null;
  requireRecord(value, "state.focus");
  requireOnlyKeys(value, ["text", "status", "scope"], "state.focus");
  const text = requireNonEmptyString(value.text, "state.focus.text");
  if (text.length > MAX_FOCUS_TEXT_CHARS) throw new TypeError("state.focus.text is too long");
  if (value.status !== "active" && value.status !== "paused") throw new TypeError("state.focus.status is invalid");
  requireRecord(value.scope, "state.focus.scope");
  requireOnlyKeys(value.scope, ["kind", "sessionId"], "state.focus.scope");
  if (value.scope.kind !== "session" || value.scope.sessionId !== sessionId) {
    throw new TypeError("state.focus.scope must match the exact session");
  }
  return { text, status: value.status, scope: { kind: "session", sessionId } };
}
function parseCarrier(value) {
  if (value === null || value === void 0) return null;
  requireRecord(value, "state.request.bundle.carrier");
  requireOnlyKeys(value, ["messageId", "bundleId", "requestId"], "state.request.bundle.carrier");
  return {
    messageId: requireNonEmptyString(value.messageId, "state.request.bundle.carrier.messageId"),
    bundleId: requireNonEmptyString(value.bundleId, "state.request.bundle.carrier.bundleId"),
    requestId: requireNonEmptyString(value.requestId, "state.request.bundle.carrier.requestId")
  };
}
function parseRequest(value) {
  requireRecord(value, "state.request");
  if (value.phase === "idle") {
    requireOnlyKeys(value, ["phase"], "state.request");
    return { phase: "idle" };
  }
  if (value.phase === "pending") {
    requireOnlyKeys(value, ["phase", "pending"], "state.request");
    requireRecord(value.pending, "state.request.pending");
    requireOnlyKeys(value.pending, ["requestId", "boundDraft", "sourceDraft"], "state.request.pending");
    return {
      phase: "pending",
      pending: {
        requestId: requireNonEmptyString(value.pending.requestId, "state.request.pending.requestId"),
        boundDraft: requireNonEmptyString(value.pending.boundDraft, "state.request.pending.boundDraft"),
        sourceDraft: requireNonEmptyString(value.pending.sourceDraft, "state.request.pending.sourceDraft")
      }
    };
  }
  if (value.phase === "armed") {
    requireOnlyKeys(value, ["phase", "bundle"], "state.request");
    requireRecord(value.bundle, "state.request.bundle");
    requireOnlyKeys(value.bundle, ["requestId", "boundDraft", "sourceDraft", "anchors", "carrier"], "state.request.bundle");
    return {
      phase: "armed",
      bundle: {
        requestId: requireNonEmptyString(value.bundle.requestId, "state.request.bundle.requestId"),
        boundDraft: requireNonEmptyString(value.bundle.boundDraft, "state.request.bundle.boundDraft"),
        sourceDraft: requireNonEmptyString(value.bundle.sourceDraft, "state.request.bundle.sourceDraft"),
        anchors: parseExtractedAnchors(value.bundle.anchors, "state.request.bundle.anchors"),
        carrier: parseCarrier(value.bundle.carrier)
      }
    };
  }
  throw new TypeError("state.request.phase is invalid");
}
function parseError(value) {
  requireRecord(value, "error");
  requireOnlyKeys(value, ["code", "message"], "error");
  return { code: requireNonEmptyString(value.code, "error.code"), message: requireString(value.message, "error.message") };
}
var taskifyStateSnapshotSchema = {
  parse(value) {
    requireRecord(value, "state");
    requireOnlyKeys(value, [
      "schemaVersion",
      "sessionId",
      "revision",
      "durability",
      "runtimeContext",
      "goalIntegration",
      "request",
      "anchors",
      "focus",
      "scope"
    ], "state");
    if (value.schemaVersion !== TASKIFY_STATE_SCHEMA_VERSION) throw new TypeError("state.schemaVersion is unsupported");
    const sessionId = requireNonEmptyString(value.sessionId, "state.sessionId");
    const revision = requireRevision(value.revision, "state.revision");
    requireRecord(value.durability, "state.durability");
    requireOnlyKeys(value.durability, ["status"], "state.durability");
    if (!["unavailable", "confirmed", "failed"].includes(value.durability.status)) throw new TypeError("state.durability.status is invalid");
    requireRecord(value.runtimeContext, "state.runtimeContext");
    requireOnlyKeys(value.runtimeContext, ["available"], "state.runtimeContext");
    if (typeof value.runtimeContext.available !== "boolean") throw new TypeError("state.runtimeContext.available must be boolean");
    requireRecord(value.goalIntegration, "state.goalIntegration");
    requireOnlyKeys(value.goalIntegration, ["available"], "state.goalIntegration");
    if (value.goalIntegration.available !== false) throw new TypeError("state.goalIntegration.available must be false");
    requireRecord(value.scope, "state.scope");
    requireOnlyKeys(value.scope, ["kind", "sessionId"], "state.scope");
    if (value.scope.kind !== "session" || value.scope.sessionId !== sessionId) throw new TypeError("state.scope must match the exact session");
    return {
      schemaVersion: TASKIFY_STATE_SCHEMA_VERSION,
      sessionId,
      revision,
      durability: { status: value.durability.status },
      runtimeContext: { available: value.runtimeContext.available },
      goalIntegration: { available: false },
      request: parseRequest(value.request),
      anchors: parsePersistentAnchors(value.anchors, sessionId),
      focus: parseFocus(value.focus, sessionId),
      scope: { kind: "session", sessionId }
    };
  }
};
var getStateRequestSchema = {
  parse(value) {
    requireRecord(value, "request");
    requireOnlyKeys(value, ["sessionId"], "request");
    return { sessionId: requireNonEmptyString(value.sessionId, "sessionId") };
  }
};
var compileRequestSchema = {
  parse(value) {
    requireRecord(value, "request");
    requireOnlyKeys(value, ["requestId", "sessionId", "expectedRevision", "rawDraft", "sourceDraft", "draft", "nonce", "literals"], "request");
    const result2 = {
      requestId: requireNonEmptyString(value.requestId, "requestId"),
      sessionId: requireNonEmptyString(value.sessionId, "sessionId"),
      expectedRevision: requireRevision(value.expectedRevision, "expectedRevision"),
      rawDraft: requireNonEmptyString(value.rawDraft, "rawDraft"),
      sourceDraft: requireNonEmptyString(value.sourceDraft, "sourceDraft"),
      draft: requireNonEmptyString(value.draft, "draft"),
      nonce: requireNonEmptyString(value.nonce, "nonce")
    };
    if (!/^[A-F0-9]{8}$/.test(result2.nonce)) throw new TypeError("nonce is invalid");
    if (!Array.isArray(value.literals) || value.literals.some((item) => typeof item !== "string")) throw new TypeError("literals must be a string array");
    return { ...result2, literals: [...value.literals] };
  }
};
function parseMutationResult(value, requestId) {
  requireRecord(value, "result");
  if (typeof value.ok !== "boolean") throw new TypeError("result.ok must be a boolean");
  const allowed = requestId ? ["ok", "requestId", "error", "state"] : ["ok", "error", "state"];
  requireOnlyKeys(value, value.ok ? allowed.filter((key) => key !== "error") : allowed, "result");
  const result2 = { ok: value.ok };
  if (requestId) result2.requestId = requireNonEmptyString(value.requestId, "requestId");
  if (!value.ok) result2.error = parseError(value.error);
  result2.state = taskifyStateSnapshotSchema.parse(value.state);
  return result2;
}
var compileResultSchema = { parse(value) {
  return parseMutationResult(value, true);
} };
var focusSuggestionRequestSchema = {
  parse(value) {
    requireRecord(value, "request");
    requireOnlyKeys(value, ["requestId", "sessionId", "sourceDraft"], "request");
    const sourceDraft = requireNonEmptyString(value.sourceDraft, "sourceDraft");
    if (sourceDraft.length > 32768) throw new TypeError("sourceDraft is too long");
    return {
      requestId: requireNonEmptyString(value.requestId, "requestId"),
      sessionId: requireNonEmptyString(value.sessionId, "sessionId"),
      sourceDraft
    };
  }
};
var focusSuggestionResultSchema = {
  parse(value) {
    requireRecord(value, "result");
    if (typeof value.ok !== "boolean") throw new TypeError("result.ok must be a boolean");
    requireOnlyKeys(value, value.ok ? ["ok", "requestId", "suggestion"] : ["ok", "requestId", "error"], "result");
    const result2 = { ok: value.ok, requestId: requireNonEmptyString(value.requestId, "requestId") };
    if (!value.ok) {
      result2.error = parseError(value.error);
      return result2;
    }
    if (value.suggestion !== null) {
      const suggestion = requireNonEmptyString(value.suggestion, "suggestion");
      if (suggestion.length > MAX_FOCUS_SUGGESTION_CHARS) throw new TypeError("suggestion is too long");
      result2.suggestion = suggestion;
    } else {
      result2.suggestion = null;
    }
    return result2;
  }
};
var invalidateRequestSchema = {
  parse(value) {
    requireRecord(value, "request");
    requireOnlyKeys(value, ["sessionId", "expectedRevision"], "request");
    return { sessionId: requireNonEmptyString(value.sessionId, "sessionId"), expectedRevision: requireRevision(value.expectedRevision, "expectedRevision") };
  }
};
var invalidateResultSchema = { parse(value) {
  return parseMutationResult(value, false);
} };
var anchorMutationRequestSchema = {
  parse(value) {
    requireRecord(value, "request");
    requireOnlyKeys(value, ["sessionId", "expectedRevision", "anchorId"], "request");
    return {
      sessionId: requireNonEmptyString(value.sessionId, "sessionId"),
      expectedRevision: requireRevision(value.expectedRevision, "expectedRevision"),
      anchorId: requireNonEmptyString(value.anchorId, "anchorId")
    };
  }
};
var clearAnchorsRequestSchema = invalidateRequestSchema;
var lifecycleMutationResultSchema = invalidateResultSchema;
var focusTextMutationRequestSchema = {
  parse(value) {
    requireRecord(value, "request");
    requireOnlyKeys(value, ["sessionId", "expectedRevision", "text"], "request");
    const text = requireNonEmptyString(value.text, "text");
    if (text.length > MAX_FOCUS_TEXT_CHARS) throw new TypeError("text is too long");
    return {
      sessionId: requireNonEmptyString(value.sessionId, "sessionId"),
      expectedRevision: requireRevision(value.expectedRevision, "expectedRevision"),
      text
    };
  }
};
var focusMutationRequestSchema = invalidateRequestSchema;
var directRequest = (name, typeSymbol, schema) => ({ name, wire: name, source: "json", codec: { mode: "strict", typeSymbol, schema } });
var result = (typeSymbol, schema) => ({ mode: "strict", typeSymbol: `dsh-taskify#${typeSymbol}`, schema });
var descriptor = (method, requestType, requestSchema, resultType = "LifecycleMutationResult", resultSchema = lifecycleMutationResultSchema) => ({
  id: `dsh-taskify#taskify/${method}`,
  service: "taskify",
  namespace: "taskify",
  method,
  invocation: { kind: "direct" },
  parameters: [directRequest("request", `dsh-taskify#${requestType}`, requestSchema)],
  result: result(resultType, resultSchema)
});
var getStateDescriptor = descriptor("getState", "GetStateRequest", getStateRequestSchema, "TaskifyStateSnapshot", taskifyStateSnapshotSchema);
var compileDescriptor = {
  ...descriptor("compile", "CompileRequest", compileRequestSchema, "CompileResult", compileResultSchema),
  cancellation: { parameter: "signal" }
};
var suggestFocusDescriptor = {
  ...descriptor("suggestFocus", "FocusSuggestionRequest", focusSuggestionRequestSchema, "FocusSuggestionResult", focusSuggestionResultSchema),
  cancellation: { parameter: "signal" }
};
var invalidateDescriptor = descriptor("invalidate", "InvalidateRequest", invalidateRequestSchema, "LifecycleMutationResult", invalidateResultSchema);
var pauseDescriptor = descriptor("pauseAnchor", "AnchorMutationRequest", anchorMutationRequestSchema);
var resumeDescriptor = descriptor("resumeAnchor", "AnchorMutationRequest", anchorMutationRequestSchema);
var removeDescriptor = descriptor("removeAnchor", "AnchorMutationRequest", anchorMutationRequestSchema);
var clearDescriptor = descriptor("clearAnchors", "ClearAnchorsRequest", clearAnchorsRequestSchema);
var setFocusDescriptor = descriptor("setFocus", "FocusTextMutationRequest", focusTextMutationRequestSchema);
var editFocusDescriptor = descriptor("editFocus", "FocusTextMutationRequest", focusTextMutationRequestSchema);
var pauseFocusDescriptor = descriptor("pauseFocus", "FocusMutationRequest", focusMutationRequestSchema);
var resumeFocusDescriptor = descriptor("resumeFocus", "FocusMutationRequest", focusMutationRequestSchema);
var clearFocusDescriptor = descriptor("clearFocus", "FocusMutationRequest", focusMutationRequestSchema);
var TYPERT_DESCRIPTORS = [
  getStateDescriptor,
  compileDescriptor,
  suggestFocusDescriptor,
  invalidateDescriptor,
  pauseDescriptor,
  resumeDescriptor,
  removeDescriptor,
  clearDescriptor,
  setFocusDescriptor,
  editFocusDescriptor,
  pauseFocusDescriptor,
  resumeFocusDescriptor,
  clearFocusDescriptor
];
var TYPERT_REMOTE_CONTRIBUTION = { package: "dsh-taskify", descriptors: TYPERT_DESCRIPTORS };
var anchorDeclaration = "export interface Anchor { readonly text: string; readonly evidence: string }";
var persistentDeclaration = 'export interface PersistentAnchor extends Anchor { readonly id: string; readonly status: "active" | "paused"; readonly scope: { readonly kind: "session"; readonly sessionId: string }; readonly activatedRevision: number }';
var focusDeclaration = 'export interface Focus { readonly text: string; readonly status: "active" | "paused"; readonly scope: { readonly kind: "session"; readonly sessionId: string } }';
var snapshotDeclaration = 'export interface TaskifyStateSnapshot { readonly schemaVersion: 3; readonly sessionId: string; readonly revision: number; readonly durability: { readonly status: "unavailable" | "confirmed" | "failed" }; readonly runtimeContext: { readonly available: boolean }; readonly goalIntegration: { readonly available: false }; readonly request: { readonly phase: "idle" } | { readonly phase: "pending"; readonly pending: { readonly requestId: string; readonly boundDraft: string; readonly sourceDraft: string } } | { readonly phase: "armed"; readonly bundle: { readonly requestId: string; readonly boundDraft: string; readonly sourceDraft: string; readonly anchors: readonly Anchor[]; readonly carrier: { readonly messageId: string; readonly bundleId: string; readonly requestId: string } | null } }; readonly anchors: readonly PersistentAnchor[]; readonly focus: Focus | null; readonly scope: { readonly kind: "session"; readonly sessionId: string } }';
var TYPERT_CONTRIBUTION = {
  package: "dsh-taskify",
  face: "host",
  schemas: [],
  model: { services: [{
    key: "taskify",
    exportName: "TaskifyService",
    summary: "Taskify persistent session-constraint service.",
    description: "Owns revisioned session-scoped request, Focus, and persistent-anchor state.",
    tags: [],
    jsDoc: "/** Host-authoritative persistent Taskify state. */",
    members: [
      { kind: "method", name: "getState", signature: "async getState(request: GetStateRequest): Promise<TaskifyStateSnapshot>", summary: "Read exact-session Taskify state.", jsDoc: "/** Read exact-session Taskify state. */" },
      { kind: "method", name: "compile", signature: "async compile(request: CompileRequest, signal?: AbortSignal): Promise<CompileResult>", summary: "Extract and arm a constraint bundle.", jsDoc: "/** Extract and arm a constraint bundle. */" },
      { kind: "method", name: "suggestFocus", signature: "async suggestFocus(request: FocusSuggestionRequest, signal?: AbortSignal): Promise<FocusSuggestionResult>", summary: "Generate a disposable Focus draft without mutating Host state.", jsDoc: "/** Suggest a non-authoritative Focus draft. */" },
      { kind: "method", name: "invalidate", signature: "async invalidate(request: InvalidateRequest): Promise<LifecycleMutationResult>", summary: "Invalidate only the pending request bundle.", jsDoc: "/** Invalidate the pending request bundle. */" },
      ...["pauseAnchor", "resumeAnchor", "removeAnchor", "clearAnchors"].map((name) => ({ kind: "method", name, signature: `async ${name}(request: ${name === "clearAnchors" ? "ClearAnchorsRequest" : "AnchorMutationRequest"}): Promise<LifecycleMutationResult>`, summary: `${name} through an explicit user Remote mutation.`, jsDoc: `/** Explicit user lifecycle mutation: ${name}. */` })),
      ...["setFocus", "editFocus"].map((name) => ({ kind: "method", name, signature: `async ${name}(request: FocusTextMutationRequest): Promise<LifecycleMutationResult>`, summary: `${name} through an explicit user Remote mutation.`, jsDoc: `/** Explicit user lifecycle mutation: ${name}. */` })),
      ...["pauseFocus", "resumeFocus", "clearFocus"].map((name) => ({ kind: "method", name, signature: `async ${name}(request: FocusMutationRequest): Promise<LifecycleMutationResult>`, summary: `${name} through an explicit user Remote mutation.`, jsDoc: `/** Explicit user lifecycle mutation: ${name}. */` }))
    ],
    types: [
      { name: "Anchor", declaration: anchorDeclaration },
      { name: "PersistentAnchor", declaration: persistentDeclaration },
      { name: "Focus", declaration: focusDeclaration },
      { name: "TaskifyStateSnapshot", declaration: snapshotDeclaration },
      { name: "GetStateRequest", declaration: "export interface GetStateRequest { readonly sessionId: string }" },
      { name: "TaskifyError", declaration: "export interface TaskifyError { readonly code: string; readonly message: string }" },
      { name: "CompileRequest", declaration: "export interface CompileRequest { readonly requestId: string; readonly sessionId: string; readonly expectedRevision: number; readonly rawDraft: string; readonly sourceDraft: string; readonly draft: string; readonly nonce: string; readonly literals: readonly string[] }" },
      { name: "CompileResult", declaration: "export type CompileResult = { readonly ok: true; readonly requestId: string; readonly state: TaskifyStateSnapshot } | { readonly ok: false; readonly requestId: string; readonly error: TaskifyError; readonly state: TaskifyStateSnapshot }" },
      { name: "FocusSuggestionRequest", declaration: "export interface FocusSuggestionRequest { readonly requestId: string; readonly sessionId: string; readonly sourceDraft: string }" },
      { name: "FocusSuggestionResult", declaration: "export type FocusSuggestionResult = { readonly ok: true; readonly requestId: string; readonly suggestion: string | null } | { readonly ok: false; readonly requestId: string; readonly error: TaskifyError }" },
      { name: "InvalidateRequest", declaration: "export interface InvalidateRequest { readonly sessionId: string; readonly expectedRevision: number }" },
      { name: "AnchorMutationRequest", declaration: "export interface AnchorMutationRequest extends InvalidateRequest { readonly anchorId: string }" },
      { name: "ClearAnchorsRequest", declaration: "export interface ClearAnchorsRequest extends InvalidateRequest {}" },
      { name: "FocusTextMutationRequest", declaration: "export interface FocusTextMutationRequest extends InvalidateRequest { readonly text: string }" },
      { name: "FocusMutationRequest", declaration: "export interface FocusMutationRequest extends InvalidateRequest {}" },
      { name: "LifecycleMutationResult", declaration: "export type LifecycleMutationResult = { readonly ok: true; readonly state: TaskifyStateSnapshot } | { readonly ok: false; readonly error: TaskifyError; readonly state: TaskifyStateSnapshot }" }
    ]
  }] },
  invocations: TYPERT_DESCRIPTORS
};

// src/shared/task-runner.js
var NOTICE = Object.freeze({
  SLASH_ONLY: "\u547D\u4EE4\u672C\u8EAB\u6CA1\u6709\u53EF\u63D0\u53D6\u7684\u4EFB\u52A1\u7EA6\u675F",
  DRAFT_CHANGED: "\u8349\u7A3F\u5DF2\u53D1\u751F\u53D8\u5316\uFF0C\u672C\u6B21 Anchor \u7ED3\u679C\u5DF2\u4E22\u5F03\u3002",
  TIMEOUT: "Taskify \u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  EMPTY_RESULT: "\u6A21\u578B\u672A\u8FD4\u56DE\u53EF\u7528\u5185\u5BB9\u3002",
  BUSY: "Taskify \u6B63\u5728\u63D0\u53D6\u7EA6\u675F\uFF0C\u8BF7\u5148\u53D6\u6D88\u6216\u7B49\u5F85\u5B8C\u6210\u3002",
  STATE_CHANGED: "Taskify \u72B6\u6001\u5DF2\u5728 Host \u66F4\u65B0\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  NOT_HYDRATED: "Taskify \u72B6\u6001\u5C1A\u672A\u4ECE Host \u52A0\u8F7D\u5B8C\u6210\u3002"
});
function statusForHostState(hostState) {
  if (hostState?.request?.phase === "armed") {
    return hostState.request.bundle.anchors.length === 0 ? "noop" : "anchored";
  }
  return hostState?.anchors?.length > 0 || hostState?.focus != null ? "anchored" : "ready";
}
function taskifyAnchorDockModel(hostState, currentDraft) {
  const persistent = Array.isArray(hostState?.anchors) ? hostState.anchors.map((anchor) => ({
    kind: "persistent",
    key: anchor.id,
    anchor
  })) : [];
  const bundle = hostState?.request?.phase === "armed" ? hostState.request.bundle : null;
  const matchesDraft = bundle !== null && bundle.boundDraft === currentDraft;
  const persistentTexts = new Set(persistent.map(({ anchor }) => anchor.text));
  const pending = matchesDraft ? bundle.anchors.filter((anchor) => !persistentTexts.has(anchor.text)).map((anchor, index) => ({
    kind: "pending",
    key: `pending:${bundle.requestId}:${index}`,
    anchor
  })) : [];
  return {
    focus: hostState?.focus ?? null,
    persistent,
    pending,
    noop: matchesDraft && bundle.anchors.length === 0
  };
}
function cloneState(state) {
  return {
    ...state,
    hostState: state.hostState === null ? null : structuredClone(state.hostState),
    pendingFocusAcceptance: state.pendingFocusAcceptance === null ? null : { ...state.pendingFocusAcceptance },
    error: state.error === null ? null : { ...state.error },
    notice: state.notice === null ? null : { ...state.notice }
  };
}
function readyState(noticeSeq, hostState = null) {
  return {
    status: statusForHostState(hostState),
    requestId: null,
    hostState,
    requestStartDraft: null,
    requestStartDraftRev: null,
    focusSuggestion: null,
    focusSuggestionSourceDraft: null,
    pendingFocusAcceptance: null,
    error: null,
    notice: null,
    noticeSeq
  };
}
function requestIdOf(sessionId, generation, seq) {
  return `dsh-taskify:${sessionId}:${generation}:${seq}`;
}
function validAnchors(value, sourceDraft) {
  if (!Array.isArray(value)) return false;
  return value.every((anchor) => anchor && typeof anchor.text === "string" && anchor.text.trim() !== "" && typeof anchor.evidence === "string" && anchor.evidence.trim() !== "" && sourceDraft.includes(anchor.evidence));
}
function remoteValue(carrier) {
  if (!carrier || carrier.ok === false) {
    const error = carrier?.error;
    throw Object.assign(new Error(error?.message || "Taskify \u8FDC\u7A0B\u8C03\u7528\u5931\u8D25\u3002"), {
      code: error?.code || "remote-error"
    });
  }
  return carrier.value;
}
var TaskifySession = class {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.listeners = /* @__PURE__ */ new Set();
    this.generation = 0;
    this.hydration = 0;
    this.seq = 0;
    this.disposed = false;
    this.abortController = null;
    this.remote = null;
    this.state = readyState(0);
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  getSnapshot() {
    return this.state;
  }
  emit() {
    this.state = cloneState(this.state);
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
      }
    }
    return this.state;
  }
  showNotice(text) {
    this.state.noticeSeq += 1;
    this.state.notice = { seq: this.state.noticeSeq, text };
  }
  clearNotice() {
    if (this.state.notice === null) return;
    this.state.notice = null;
    this.emit();
  }
  get isExtracting() {
    return this.state.status === "extracting" && !this.disposed;
  }
  parseHostState(value) {
    const state = taskifyStateSnapshotSchema.parse(value);
    if (state.sessionId !== this.sessionId) throw new TypeError("Taskify state belongs to another session");
    return state;
  }
  acceptHostState(value, { preserveRequest = false } = {}) {
    const hostState = this.parseHostState(value);
    const hasAuthoritativeFocus = hostState.focus !== null;
    this.state = {
      ...this.state,
      status: preserveRequest && this.isExtracting ? "extracting" : statusForHostState(hostState),
      requestId: preserveRequest ? this.state.requestId : null,
      hostState,
      requestStartDraft: preserveRequest ? this.state.requestStartDraft : null,
      requestStartDraftRev: preserveRequest ? this.state.requestStartDraftRev : null,
      focusSuggestion: hasAuthoritativeFocus ? null : this.state.focusSuggestion,
      focusSuggestionSourceDraft: hasAuthoritativeFocus ? null : this.state.focusSuggestionSourceDraft,
      pendingFocusAcceptance: hasAuthoritativeFocus ? null : this.state.pendingFocusAcceptance,
      error: null
    };
    return hostState;
  }
  async hydrate(remote, { quiet = false, applyPendingFocus = false } = {}) {
    if (this.disposed || !remote?.getState) return null;
    this.remote = remote;
    const hydration = ++this.hydration;
    try {
      const value = remoteValue(await remote.getState({ sessionId: this.sessionId }));
      if (this.disposed || hydration !== this.hydration) return null;
      const state = this.acceptHostState(value, { preserveRequest: this.isExtracting });
      const applied = applyPendingFocus && await this.applyPendingFocusAcceptance(remote);
      if (!applied) this.emit();
      return this.state.hostState ?? state;
    } catch (error) {
      if (this.disposed || hydration !== this.hydration || quiet) return null;
      this.failLocal({
        code: error?.code || "remote-error",
        message: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
  start({ draft, draftRev, sourceDraft, lock, remote, getLiveDraft }) {
    if (this.disposed || typeof draft !== "string" || draft.trim() === "" || !sourceDraft) return null;
    if (this.isExtracting) {
      this.showNotice(NOTICE.BUSY);
      this.emit();
      return null;
    }
    if (this.state.hostState === null) {
      this.showNotice(NOTICE.NOT_HYDRATED);
      this.emit();
      return null;
    }
    this.remote = remote;
    this.generation += 1;
    this.seq += 1;
    const generation = this.generation;
    const requestId = requestIdOf(this.sessionId, generation, this.seq);
    const expectedRevision = this.state.hostState.revision;
    const shouldSuggestFocus = this.state.hostState.focus === null && Boolean(remote?.suggestFocus);
    const abortController = new AbortController();
    this.abortController = abortController;
    this.state = {
      ...this.state,
      status: "extracting",
      requestId,
      requestStartDraft: draft,
      requestStartDraftRev: draftRev,
      focusSuggestion: null,
      focusSuggestionSourceDraft: null,
      pendingFocusAcceptance: null,
      error: null,
      notice: null
    };
    this.emit();
    const run = async () => {
      let carrier;
      try {
        carrier = await remote.compile({
          requestId,
          sessionId: this.sessionId,
          expectedRevision,
          rawDraft: draft,
          sourceDraft,
          draft: lock.text,
          nonce: lock.nonce,
          literals: lock.locks
        }, abortController.signal);
      } catch (error) {
        if (generation !== this.generation) {
          if (!this.disposed) await this.hydrate(remote, { quiet: true });
          return;
        }
        if (this.disposed) return;
        await this.hydrate(remote, { quiet: true });
        this.failLocal({ code: "remote-error", message: error instanceof Error ? error.message : String(error) });
        return;
      }
      if (generation !== this.generation) {
        if (!this.disposed) await this.hydrate(remote, { quiet: true });
        return;
      }
      const live = typeof getLiveDraft === "function" ? getLiveDraft() : { draft, draftRev };
      await this.settle({
        generation,
        requestId,
        rawDraft: draft,
        sourceDraft,
        currentDraft: live.draft,
        currentDraftRev: live.draftRev,
        carrier,
        remote,
        getLiveDraft,
        suggestionSignal: abortController.signal,
        shouldSuggestFocus
      });
    };
    void run();
    return requestId;
  }
  async requestFocusSuggestion({ generation, requestId, rawDraft, draftRev, sourceDraft, remote, getLiveDraft, signal }) {
    let value;
    try {
      value = remoteValue(await remote.suggestFocus({
        requestId,
        sessionId: this.sessionId,
        sourceDraft
      }, signal));
    } catch {
      return;
    }
    if (this.disposed || generation !== this.generation || !value || value.requestId !== requestId || value.ok !== true || value.suggestion !== null && (typeof value.suggestion !== "string" || value.suggestion.trim() === "")) return;
    const live = typeof getLiveDraft === "function" ? getLiveDraft() : { draft: rawDraft, draftRev };
    if (live.draft !== rawDraft || live.draftRev !== draftRev || this.state.hostState?.focus !== null || value.suggestion === null) return;
    this.state = {
      ...this.state,
      focusSuggestion: value.suggestion,
      focusSuggestionSourceDraft: rawDraft
    };
    this.emit();
  }
  async settle({
    generation,
    requestId,
    rawDraft,
    sourceDraft,
    currentDraft,
    currentDraftRev,
    carrier,
    remote,
    getLiveDraft,
    suggestionSignal,
    shouldSuggestFocus
  }) {
    if (this.disposed || generation !== this.generation || this.state.requestId !== requestId || !this.isExtracting) return;
    let value;
    let hostState;
    try {
      value = remoteValue(carrier);
      if (!value || value.requestId !== requestId || typeof value.ok !== "boolean") throw new TypeError("invalid compile result");
      hostState = this.parseHostState(value.state);
    } catch (error) {
      await this.hydrate(remote, { quiet: true });
      this.failLocal({
        code: error?.code || "bad-response",
        message: error?.code ? error.message : "Taskify \u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6548\u54CD\u5E94\u3002"
      });
      return;
    }
    const requestStartDraftRev = this.state.requestStartDraftRev;
    this.acceptHostState(hostState);
    this.abortController = null;
    if (currentDraft !== rawDraft || currentDraftRev !== requestStartDraftRev) {
      await this.invalidate(remote, { quiet: true });
      this.failLocal({ code: "draft-changed", message: NOTICE.DRAFT_CHANGED });
      return;
    }
    if (value.ok === false) {
      if (value.error?.code === "revision-conflict") {
        await this.hydrate(remote, { quiet: true });
        this.showNotice(value.error.message || NOTICE.STATE_CHANGED);
        this.state.error = { code: "revision-conflict", message: value.error.message || NOTICE.STATE_CHANGED };
        this.emit();
        return;
      }
      this.failLocal({
        code: value.error?.code ?? "remote-error",
        message: value.error?.message || "Taskify \u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002"
      });
      return;
    }
    if (hostState.request.phase !== "armed" || hostState.request.bundle.boundDraft !== rawDraft || hostState.request.bundle.sourceDraft !== sourceDraft || !validAnchors(hostState.request.bundle.anchors, sourceDraft)) {
      await this.hydrate(remote, { quiet: true });
      this.failLocal({ code: "bad-response", message: "Taskify \u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6548 Anchor\u3002" });
      return;
    }
    this.state = {
      ...this.state,
      status: statusForHostState(hostState),
      requestId: null,
      requestStartDraft: null,
      requestStartDraftRev: null,
      error: null,
      notice: null
    };
    this.emit();
    if (shouldSuggestFocus && hostState.focus === null && remote?.suggestFocus) {
      void this.requestFocusSuggestion({
        generation,
        requestId,
        rawDraft,
        draftRev: requestStartDraftRev,
        sourceDraft,
        remote,
        getLiveDraft,
        signal: suggestionSignal
      });
    }
  }
  failLocal(error) {
    if (this.disposed) return;
    this.showNotice(error.message || "Taskify \u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    this.state = {
      ...this.state,
      status: "error",
      requestId: null,
      requestStartDraft: null,
      requestStartDraftRev: null,
      error: { code: error.code || "unknown", message: error.message || "Taskify \u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002" }
    };
    this.abortController = null;
    this.emit();
  }
  async invalidate(remote = this.remote, { quiet = false } = {}) {
    if (this.disposed || !remote?.invalidate) return false;
    this.remote = remote;
    if (this.state.hostState === null) {
      await this.hydrate(remote, { quiet });
      return false;
    }
    try {
      const value = remoteValue(await remote.invalidate({
        sessionId: this.sessionId,
        expectedRevision: this.state.hostState.revision
      }));
      if (!value || typeof value.ok !== "boolean") throw new TypeError("invalid invalidate result");
      this.acceptHostState(value.state);
      this.emit();
      if (value.ok) return true;
      if (value.error?.code === "revision-conflict") {
        await this.hydrate(remote, { quiet: true });
        if (!quiet) {
          this.showNotice(value.error.message || NOTICE.STATE_CHANGED);
          this.emit();
        }
      }
      return false;
    } catch (error) {
      await this.hydrate(remote, { quiet: true });
      if (!quiet) {
        this.showNotice(error instanceof Error ? error.message : "Taskify \u72B6\u6001\u6E05\u7406\u5931\u8D25\u3002");
        this.emit();
      }
      return false;
    }
  }
  async acceptFocusSuggestion(text, remote = this.remote) {
    if (this.disposed) return false;
    if (!remote?.setFocus || this.state.hostState === null) {
      this.showNotice("Taskify Focus \u670D\u52A1\u5C1A\u672A\u5C31\u7EEA\u3002");
      this.emit();
      return false;
    }
    if (typeof text !== "string" || text.trim() === "") {
      this.showNotice("Focus \u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A\u3002");
      this.emit();
      return false;
    }
    if (this.state.hostState.focus !== null) {
      this.state.focusSuggestion = null;
      this.state.focusSuggestionSourceDraft = null;
      this.state.pendingFocusAcceptance = null;
      this.showNotice("\u5F53\u524D Session \u5DF2\u5B58\u5728 authoritative Focus\uFF0C\u672A\u8986\u76D6\u3002");
      this.emit();
      return false;
    }
    this.remote = remote;
    const suggestionSourceDraft = this.state.focusSuggestionSourceDraft;
    this.state = {
      ...this.state,
      focusSuggestion: null,
      focusSuggestionSourceDraft: null,
      pendingFocusAcceptance: {
        text,
        sourceDraft: suggestionSourceDraft,
        status: "waiting",
        error: null
      }
    };
    this.emit();
    if (this.state.hostState.request.phase === "idle") await this.applyPendingFocusAcceptance(remote);
    return true;
  }
  async applyPendingFocusAcceptance(remote = this.remote) {
    const pending = this.state.pendingFocusAcceptance;
    if (this.disposed || pending === null || pending.status !== "waiting") return false;
    if (!remote?.setFocus || this.state.hostState === null) {
      this.state.pendingFocusAcceptance = { ...pending, status: "error", error: "Taskify Focus \u670D\u52A1\u5C1A\u672A\u5C31\u7EEA\u3002" };
      this.showNotice(this.state.pendingFocusAcceptance.error);
      this.emit();
      return true;
    }
    if (this.state.hostState.focus !== null) {
      this.state.pendingFocusAcceptance = null;
      this.emit();
      return true;
    }
    if (this.state.hostState.request.phase !== "idle") return false;
    this.state.pendingFocusAcceptance = { ...pending, status: "applying", error: null };
    this.emit();
    try {
      const value = remoteValue(await remote.setFocus({
        sessionId: this.sessionId,
        expectedRevision: this.state.hostState.revision,
        text: pending.text
      }));
      if (!value || typeof value.ok !== "boolean" || !value.state) throw new TypeError("invalid Focus mutation result");
      this.acceptHostState(value.state);
      if (this.state.hostState.focus !== null) {
        this.state.pendingFocusAcceptance = null;
        this.emit();
        return true;
      }
      const message = value.ok ? "Host \u672A\u8FD4\u56DE authoritative Focus\uFF1B\u53EF\u91CD\u8BD5\u542F\u7528\u3002" : value.error?.message || NOTICE.STATE_CHANGED;
      this.state.pendingFocusAcceptance = { ...pending, status: "error", error: message };
      this.showNotice(message);
      this.emit();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Focus \u542F\u7528\u5931\u8D25\uFF0C\u53EF\u91CD\u8BD5\u3002";
      this.state.pendingFocusAcceptance = { ...pending, status: "error", error: message };
      this.showNotice(message);
      this.emit();
      return true;
    }
  }
  async retryPendingFocusAcceptance(remote = this.remote) {
    const pending = this.state.pendingFocusAcceptance;
    if (pending === null) {
      this.showNotice("\u6CA1\u6709\u5F85\u542F\u7528\u7684 Focus\u3002");
      this.emit();
      return false;
    }
    this.state.pendingFocusAcceptance = { ...pending, status: "waiting", error: null };
    this.emit();
    if (this.state.hostState?.request.phase !== "idle") {
      this.showNotice("Focus \u5DF2\u786E\u8BA4\uFF0C\u5C06\u5728\u5F53\u524D Taskify request \u53D1\u9001\u5E76\u6FC0\u6D3B\u540E\u542F\u7528\u3002");
      this.emit();
      return true;
    }
    await this.applyPendingFocusAcceptance(remote);
    return this.state.hostState?.focus != null;
  }
  clearPendingFocusAcceptance() {
    if (this.state.pendingFocusAcceptance === null) {
      this.showNotice("\u6CA1\u6709\u5F85\u53D6\u6D88\u7684 Focus\u3002");
      this.emit();
      return false;
    }
    this.state.pendingFocusAcceptance = null;
    this.emit();
    return true;
  }
  async mutateState(method, fields, remote = this.remote) {
    if (this.disposed || !remote?.[method]) return false;
    this.remote = remote;
    if (this.state.hostState === null) {
      await this.hydrate(remote);
      return false;
    }
    const request = {
      sessionId: this.sessionId,
      expectedRevision: this.state.hostState.revision,
      ...fields
    };
    try {
      const value = remoteValue(await remote[method](request));
      if (!value || typeof value.ok !== "boolean") throw new TypeError("invalid lifecycle mutation result");
      this.acceptHostState(value.state);
      this.emit();
      if (value.ok) return true;
      if (value.error?.code === "revision-conflict") await this.hydrate(remote, { quiet: true });
      this.showNotice(value.error?.message || NOTICE.STATE_CHANGED);
      this.emit();
      return false;
    } catch (error) {
      await this.hydrate(remote, { quiet: true });
      this.showNotice(error instanceof Error ? error.message : "Taskify lifecycle \u66F4\u65B0\u5931\u8D25\u3002");
      this.emit();
      return false;
    }
  }
  mutateAnchors(method, anchorId, remote = this.remote) {
    return this.mutateState(method, anchorId === void 0 ? {} : { anchorId }, remote);
  }
  pauseAnchor(anchorId, remote) {
    return this.mutateAnchors("pauseAnchor", anchorId, remote);
  }
  resumeAnchor(anchorId, remote) {
    return this.mutateAnchors("resumeAnchor", anchorId, remote);
  }
  removeAnchor(anchorId, remote) {
    return this.mutateAnchors("removeAnchor", anchorId, remote);
  }
  clearAnchors(remote) {
    return this.mutateAnchors("clearAnchors", void 0, remote);
  }
  setFocus(text, remote) {
    return this.mutateState("setFocus", { text }, remote);
  }
  editFocus(text, remote) {
    return this.mutateState("editFocus", { text }, remote);
  }
  pauseFocus(remote) {
    return this.mutateState("pauseFocus", {}, remote);
  }
  resumeFocus(remote) {
    return this.mutateState("resumeFocus", {}, remote);
  }
  clearFocus(remote) {
    return this.mutateState("clearFocus", {}, remote);
  }
  ignoreFocusSuggestion() {
    if (this.state.focusSuggestion === null) return;
    this.state.focusSuggestion = null;
    this.state.focusSuggestionSourceDraft = null;
    this.emit();
  }
  cancel() {
    if (this.disposed || !this.isExtracting) return;
    this.generation += 1;
    if (this.abortController) this.abortController.abort();
    this.abortController = null;
    this.state = readyState(this.state.noticeSeq, this.state.hostState);
    this.emit();
  }
  /** Returns true when the current Host-owned pending/armed result needs explicit invalidation. */
  onDraftChanged(currentDraft) {
    if (this.disposed) return false;
    if (this.state.focusSuggestion !== null && currentDraft !== this.state.focusSuggestionSourceDraft) {
      this.state.focusSuggestion = null;
      this.state.focusSuggestionSourceDraft = null;
      this.emit();
    }
    if (this.state.pendingFocusAcceptance !== null && this.state.pendingFocusAcceptance.sourceDraft !== null && currentDraft !== this.state.pendingFocusAcceptance.sourceDraft) {
      this.state.pendingFocusAcceptance = null;
      this.showNotice("\u8349\u7A3F\u5DF2\u53D8\u5316\uFF0C\u5F85\u542F\u7528\u7684 Focus \u5DF2\u53D6\u6D88\u3002");
      this.emit();
    }
    if (this.isExtracting) return false;
    const boundDraft = this.state.hostState?.request.phase === "armed" ? this.state.hostState.request.bundle.boundDraft : this.state.hostState?.request.phase === "pending" ? this.state.hostState.request.pending.boundDraft : null;
    if (boundDraft !== null && currentDraft !== boundDraft) return true;
    if (this.state.status === "error" && currentDraft !== this.state.requestStartDraft) {
      this.state = readyState(this.state.noticeSeq, this.state.hostState);
      this.emit();
    }
    return false;
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.hydration += 1;
    if (this.abortController) this.abortController.abort();
    this.abortController = null;
    this.listeners.clear();
  }
};

// src/shared/reference.js
function isReferenceBlocked(occurrences) {
  return Array.isArray(occurrences) && occurrences.length > 0;
}
var REFERENCE_BLOCKED_NOTICE = "\u5F53\u524D\u8349\u7A3F\u5305\u542B\u5F15\u7528\u5185\u5BB9\uFF0C\u4E3A\u907F\u514D\u9519\u8BEF\u5173\u8054\u6765\u6E90\uFF0C\u672C\u7248\u672C\u6682\u4E0D\u63D0\u53D6\u7EA6\u675F\u3002";

// src/shared/session-store.js
var sessions = /* @__PURE__ */ new Map();
function taskifySessionFor(sessionId) {
  if (typeof sessionId !== "string" || sessionId === "") return null;
  let session = sessions.get(sessionId);
  if (!session) {
    session = new TaskifySession(sessionId);
    sessions.set(sessionId, session);
  }
  return session;
}
function releaseTaskifySession(sessionId) {
  if (typeof sessionId !== "string") return;
  const session = sessions.get(sessionId);
  if (!session) return;
  session.destroy();
  sessions.delete(sessionId);
}
function subscribeTaskifySession(sessionId, listener) {
  const session = taskifySessionFor(sessionId);
  if (!session) return () => {
  };
  return session.subscribe(listener);
}
function getTaskifySnapshot(sessionId) {
  return taskifySessionFor(sessionId)?.getSnapshot() ?? null;
}

// src/client/index.jsx
var STYLE_ID = "dsh-taskify/client.css";
var CSS = `
.dsh-taskify-button {
  max-width: 112px;
  min-width: max-content;
  white-space: nowrap;
}
.dsh-taskify-label-cancel { display: none; }
.dsh-taskify-button:hover .dsh-taskify-label-normal,
.dsh-taskify-button:focus-visible .dsh-taskify-label-normal { display: none; }
.dsh-taskify-button:hover .dsh-taskify-label-cancel,
.dsh-taskify-button:focus-visible .dsh-taskify-label-cancel { display: inline; }
.dsh-taskify-icon {
  display: inline-block;
  font-size: 14px;
  line-height: 1;
  flex: none;
}
.dsh-taskify-dock {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  max-width: var(--dsh-composer-card-max-width, 100%);
  margin-inline: auto;
  padding: 3px 1px;
}
.dsh-taskify-focus-layer,
.dsh-taskify-anchor-layer {
  box-sizing: border-box;
  width: 100%;
}
.dsh-taskify-focus-layer {
  min-height: 26px;
}
.dsh-taskify-focus-current {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 2px 4px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.4;
}
.dsh-taskify-focus-current[data-status="paused"] {
  color: color-mix(in srgb, currentColor 66%, transparent);
}
.dsh-taskify-focus-icon { flex: none; }
.dsh-taskify-focus-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-taskify-focus-status,
.dsh-taskify-pending-status {
  flex: none;
  color: color-mix(in srgb, currentColor 60%, transparent);
  font-size: 11px;
  white-space: nowrap;
}
.dsh-taskify-focus-actions {
  display: inline-flex;
  flex: none;
  gap: 2px;
  margin-inline-start: auto;
  opacity: 0;
  transition: opacity 120ms ease;
}
.dsh-taskify-focus-current:hover .dsh-taskify-focus-actions,
.dsh-taskify-focus-current:focus-within .dsh-taskify-focus-actions {
  opacity: 1;
}
.dsh-taskify-focus-set {
  border: 0;
  background: transparent;
  color: color-mix(in srgb, currentColor 70%, transparent);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  padding: 3px 4px;
}
.dsh-taskify-focus-set:hover,
.dsh-taskify-focus-set:focus-visible {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.dsh-taskify-anchor-layer {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.dsh-taskify-anchor-list {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.dsh-taskify-anchor-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: min(100%, 440px);
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, currentColor 4%, transparent);
  padding: 3px 7px;
  font-size: 12px;
  line-height: 1.25;
  cursor: default;
}
.dsh-taskify-anchor-chip[data-status="paused"] {
  opacity: 0.62;
  border-style: dashed;
}
.dsh-taskify-anchor-chip[data-status="pending"] {
  border-style: dotted;
}
.dsh-taskify-anchor-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-taskify-anchor-paused {
  color: color-mix(in srgb, currentColor 68%, transparent);
  font-size: 11px;
  white-space: nowrap;
}
.dsh-taskify-anchor-actions {
  display: inline-flex;
  gap: 2px;
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-width 140ms ease, opacity 120ms ease;
}
.dsh-taskify-anchor-chip:hover .dsh-taskify-anchor-actions,
.dsh-taskify-anchor-chip:focus-within .dsh-taskify-anchor-actions {
  max-width: 112px;
  opacity: 1;
}
.dsh-taskify-provenance {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 320px;
}
.dsh-taskify-provenance-evidence {
  white-space: pre-wrap;
}
.dsh-taskify-chip-action,
.dsh-taskify-clear {
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  line-height: 1;
  padding: 4px 5px;
}
.dsh-taskify-chip-action:hover,
.dsh-taskify-chip-action:focus-visible,
.dsh-taskify-clear:hover,
.dsh-taskify-clear:focus-visible {
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.dsh-taskify-clear {
  color: color-mix(in srgb, currentColor 64%, transparent);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.25;
  padding: 3px 4px;
}
.dsh-taskify-context-warning {
  color: #b26a00;
  font-size: 12px;
}
.dsh-taskify-focus-editor {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 1px 3px;
}
.dsh-taskify-focus-editor textarea {
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  min-height: 34px;
  resize: vertical;
  border: 1px solid color-mix(in srgb, currentColor 24%, transparent);
  border-radius: 8px;
  outline: none;
  background: color-mix(in srgb, currentColor 3%, transparent);
  color: inherit;
  font: inherit;
  padding: 7px 9px;
}
.dsh-taskify-focus-editor textarea:focus-visible {
  border-color: color-mix(in srgb, currentColor 38%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 7%, transparent);
}
.dsh-taskify-editor-action { flex: none; }
.dsh-taskify-focus-suggestion {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  min-width: 0;
  max-width: 100%;
  padding: 4px;
  font-size: 12px;
}
.dsh-taskify-focus-suggestion-text {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-taskify-focus-suggestion-actions {
  display: inline-flex;
  flex: none;
  flex-shrink: 0;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}
.dsh-taskify-focus-suggestion-actions > * { flex-shrink: 0; }
.dsh-taskify-noop {
  color: color-mix(in srgb, currentColor 68%, transparent);
  font-size: 12px;
  line-height: 1.4;
}
@media (hover: none) {
  .dsh-taskify-focus-actions { opacity: 1; }
  .dsh-taskify-anchor-actions { max-width: 112px; opacity: 1; }
}
`;
var taskifyRemote;
function installStyles() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`) !== null) return;
  const tag = document.createElement("style");
  tag.setAttribute("data-plugin-css", STYLE_ID);
  tag.textContent = CSS;
  document.head.append(tag);
}
function useTaskifySession(sessionId) {
  const subscribe = import_react.default.useCallback((listener) => {
    if (!sessionId) return () => {
    };
    return subscribeTaskifySession(sessionId, listener);
  }, [sessionId]);
  const getSnapshot = import_react.default.useCallback(() => {
    if (!sessionId) return null;
    return getTaskifySnapshot(sessionId);
  }, [sessionId]);
  return import_react.default.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
function TaskifyIcon() {
  return /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-icon", "aria-hidden": "true" }, "\u2728");
}
function labelFor(state, busy) {
  if (busy) return "\u63D0\u53D6\u4E2D\u2026";
  if (state.status === "error") return "\u91CD\u8BD5";
  return "Taskify";
}
function tooltipFor({ busy, empty, unavailable, referenceBlocked, state, remoteReady }) {
  if (busy) return "\u70B9\u51FB\u53D6\u6D88\u672C\u6B21\u7EA6\u675F\u63D0\u53D6";
  if (empty) return "\u5148\u8F93\u5165\u4EFB\u52A1";
  if (unavailable) return "\u5F53\u524D\u8F93\u5165\u72B6\u6001\u4E0D\u53EF\u8FD0\u884C Taskify";
  if (referenceBlocked) return REFERENCE_BLOCKED_NOTICE;
  if (!remoteReady) return "Taskify \u670D\u52A1\u5C1A\u672A\u5C31\u7EEA";
  if (state.status === "error" && state.error) return state.error.message;
  return "\u4ECE\u5F53\u524D\u8349\u7A3F\u63D0\u53D6\u660E\u786E\u3001\u53EF\u8FFD\u6EAF\u7684\u786C\u7EA6\u675F";
}
function TaskifyButton({ sessionId, useSession, useInput, inputActions }) {
  const running = useSession((s) => s.running);
  const input = useInput((s) => s);
  const controller = taskifySessionFor(sessionId);
  const state = useTaskifySession(sessionId);
  const liveRef = import_react.default.useRef({ draft: "", draftRev: -1 });
  const draft = input?.draft ?? "";
  const draftRev = input?.draftRev ?? -1;
  const phase = input?.phase ?? "plain";
  const previousPhaseRef = import_react.default.useRef(phase);
  const previousRunningRef = import_react.default.useRef(running);
  const suppressDraftInvalidationRef = import_react.default.useRef(false);
  liveRef.current = { draft, draftRev };
  import_react.default.useEffect(() => {
    if (controller && taskifyRemote) void controller.hydrate(taskifyRemote);
  }, [controller, sessionId]);
  import_react.default.useEffect(() => () => {
    if (sessionId) releaseTaskifySession(sessionId);
  }, [sessionId]);
  import_react.default.useEffect(() => {
    const phaseChanged = previousPhaseRef.current !== phase;
    previousPhaseRef.current = phase;
    if (phaseChanged) {
      suppressDraftInvalidationRef.current = true;
      queueMicrotask(() => {
        suppressDraftInvalidationRef.current = false;
      });
    }
  }, [phase, sessionId]);
  import_react.default.useEffect(() => {
    const turnSettled = previousRunningRef.current === true && running === false;
    previousRunningRef.current = running;
    if (turnSettled && controller && taskifyRemote) {
      void controller.hydrate(taskifyRemote, { quiet: true, applyPendingFocus: true });
    }
  }, [controller, running, sessionId]);
  import_react.default.useEffect(() => {
    if (phase !== "plain" || suppressDraftInvalidationRef.current) return;
    if (controller?.onDraftChanged(draft) && taskifyRemote) void controller.invalidate(taskifyRemote);
  }, [controller, draft, phase, sessionId]);
  const empty = draft.trim() === "";
  const unavailable = !input || phase === "adjudicating" || phase === "claimed" || phase === "submitting";
  const referenceBlocked = isReferenceBlocked(input?.occurrences ?? []);
  const busy = state?.status === "extracting" && !controller?.disposed;
  const remoteReady = taskifyRemote !== void 0 && state?.hostState !== null;
  const handleClick = () => {
    if (!controller || !inputActions) return;
    if (busy) {
      controller.cancel();
      return;
    }
    if (empty || unavailable || referenceBlocked) return;
    if (!remoteReady) {
      controller.showNotice("Taskify \u670D\u52A1\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
      controller.emit();
      return;
    }
    const parsed = parseSlashDraft(draft);
    if (parsed.kind === "empty") return;
    if (parsed.kind === "command-only") {
      controller.showNotice(NOTICE.SLASH_ONLY);
      controller.emit();
      return;
    }
    const sourceDraft = parsed.kind === "command" ? parsed.body : draft.trim();
    let lock;
    try {
      lock = lockLiterals(sourceDraft);
    } catch (error) {
      controller.showNotice(error instanceof Error ? error.message : "\u5173\u952E\u5185\u5BB9\u4FDD\u62A4\u5904\u7406\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
      controller.emit();
      return;
    }
    controller.start({
      draft,
      draftRev,
      sourceDraft,
      lock,
      remote: taskifyRemote,
      getLiveDraft: () => ({ ...liveRef.current })
    });
  };
  if (state === null) return null;
  const label = labelFor(state, busy);
  const labelContent = busy ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-label-normal" }, "\u63D0\u53D6\u4E2D\u2026"), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-label-cancel" }, "\xD7 \u53D6\u6D88")) : label;
  const tooltip = tooltipFor({ busy, empty, unavailable, referenceBlocked, state, remoteReady });
  const disabled = !busy && (empty || unavailable || referenceBlocked || !remoteReady);
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(import_dsh_client_ui_primitives.Tooltip, { label: tooltip, side: "top" }, /* @__PURE__ */ import_react.default.createElement(
    import_dsh_client_ui_primitives.Button,
    {
      type: "button",
      variant: "ghost",
      size: "sm",
      className: "dsh-taskify-button",
      icon: /* @__PURE__ */ import_react.default.createElement(TaskifyIcon, null),
      onClick: handleClick,
      disabled,
      "aria-label": label
    },
    labelContent
  )), state.notice !== null && /* @__PURE__ */ import_react.default.createElement(import_dsh_client_ui_primitives.Toast, { key: state.notice.seq, text: state.notice.text, onDone: () => controller.clearNotice() }));
}
function AnchorChip({ anchor, pending = false, mutate }) {
  const provenance = anchorProvenanceForDisplay(anchor);
  const status = pending ? "pending" : anchor.status;
  const chip = /* @__PURE__ */ import_react.default.createElement(
    "span",
    {
      className: "dsh-taskify-anchor-chip",
      "data-status": status,
      tabIndex: 0,
      "aria-label": `${anchor.text}\uFF1B${pending ? "\u5F85\u53D1\u9001" : anchor.status}`
    },
    /* @__PURE__ */ import_react.default.createElement("span", { "aria-hidden": "true" }, "\u{1F512}"),
    /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-anchor-text" }, anchor.text),
    !pending && anchor.status === "paused" && /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-anchor-paused" }, "\u5DF2\u6682\u505C"),
    !pending && /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-anchor-actions" }, /* @__PURE__ */ import_react.default.createElement(
      "button",
      {
        type: "button",
        className: "dsh-taskify-chip-action",
        onClick: () => mutate(anchor.status === "active" ? "pauseAnchor" : "resumeAnchor", anchor.id),
        "aria-label": `${anchor.status === "active" ? "\u6682\u505C" : "\u6062\u590D"} ${anchor.text}`
      },
      anchor.status === "active" ? "\u6682\u505C" : "\u6062\u590D"
    ), /* @__PURE__ */ import_react.default.createElement(
      "button",
      {
        type: "button",
        className: "dsh-taskify-chip-action",
        onClick: () => mutate("removeAnchor", anchor.id),
        "aria-label": `\u79FB\u9664 ${anchor.text}`
      },
      "\u79FB\u9664"
    ))
  );
  if (provenance === null) return chip;
  return /* @__PURE__ */ import_react.default.createElement(
    import_dsh_client_ui_primitives.Tooltip,
    {
      label: /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-provenance" }, /* @__PURE__ */ import_react.default.createElement("span", null, provenance.title), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-provenance-evidence" }, "\u201C", provenance.evidence, "\u201D")),
      side: "top"
    },
    chip
  );
}
function TaskifyAnchors({ sessionId, input }) {
  const state = useTaskifySession(sessionId);
  const controller = taskifySessionFor(sessionId);
  const hostState = state?.hostState;
  const [editingFocus, setEditingFocus] = import_react.default.useState(false);
  const [focusDraft, setFocusDraft] = import_react.default.useState("");
  const [editingSuggestion, setEditingSuggestion] = import_react.default.useState(false);
  const [suggestionDraft, setSuggestionDraft] = import_react.default.useState("");
  import_react.default.useEffect(() => {
    setEditingFocus(false);
    setFocusDraft("");
    setEditingSuggestion(false);
    setSuggestionDraft("");
  }, [sessionId]);
  if (!state || !hostState) return null;
  const { focus, persistent, pending, noop } = taskifyAnchorDockModel(hostState, input?.draft);
  const pendingAcceptance = focus === null ? state.pendingFocusAcceptance : null;
  const suggestion = focus === null && pendingAcceptance === null ? state.focusSuggestion : null;
  const mutate = (method, anchorId) => {
    if (!controller || !taskifyRemote) return;
    void controller[method](anchorId, taskifyRemote);
  };
  const beginFocus = () => {
    setFocusDraft(focus?.text ?? "");
    setEditingFocus(true);
  };
  const saveFocus = async () => {
    if (!controller || !taskifyRemote || focusDraft.trim() === "") return;
    const ok = focus === null ? await controller.setFocus(focusDraft, taskifyRemote) : await controller.editFocus(focusDraft, taskifyRemote);
    if (ok) setEditingFocus(false);
  };
  const acceptSuggestion = async () => {
    const text = editingSuggestion ? suggestionDraft : suggestion;
    if (!controller || typeof text !== "string" || text.trim() === "") return;
    if (!taskifyRemote) {
      controller.showNotice("Taskify Focus \u670D\u52A1\u5C1A\u672A\u5C31\u7EEA\u3002");
      controller.emit();
      return;
    }
    const ok = await controller.acceptFocusSuggestion(text, taskifyRemote);
    if (ok) setEditingSuggestion(false);
  };
  const editSuggestion = () => {
    setSuggestionDraft(suggestion ?? "");
    setEditingSuggestion(true);
  };
  const ignoreSuggestion = () => {
    setEditingSuggestion(false);
    controller?.ignoreFocusSuggestion();
  };
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "dsh-taskify-dock", "aria-label": "Taskify Session \u7EA6\u675F" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsh-taskify-focus-layer", "aria-label": "Focus" }, pendingAcceptance !== null && /* @__PURE__ */ import_react.default.createElement("div", { className: "dsh-taskify-focus-suggestion", "data-status": pendingAcceptance.status }, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-focus-suggestion-text" }, "\u{1F3AF} Focus: ", pendingAcceptance.text, " \xB7 ", pendingAcceptance.status === "applying" ? "\u6B63\u5728\u542F\u7528\u2026" : pendingAcceptance.status === "error" ? `\u542F\u7528\u5931\u8D25\uFF1A${pendingAcceptance.error}` : "\u5F85\u53D1\u9001\u540E\u542F\u7528"), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-focus-suggestion-actions" }, pendingAcceptance.status === "error" && /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: "dsh-taskify-chip-action", onClick: () => void controller?.retryPendingFocusAcceptance(taskifyRemote) }, "\u91CD\u8BD5"), pendingAcceptance.status !== "applying" && /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: "dsh-taskify-chip-action", onClick: () => controller?.clearPendingFocusAcceptance() }, "\u53D6\u6D88"))), suggestion !== null && (editingSuggestion ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsh-taskify-focus-editor" }, /* @__PURE__ */ import_react.default.createElement(
    "textarea",
    {
      value: suggestionDraft,
      maxLength: 400,
      rows: 1,
      autoFocus: true,
      onChange: (event) => setSuggestionDraft(event.target.value),
      "aria-label": "\u7F16\u8F91\u5EFA\u8BAE Focus"
    }
  ), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-focus-suggestion-actions" }, /* @__PURE__ */ import_react.default.createElement(import_dsh_client_ui_primitives.Button, { type: "button", variant: "ghost", size: "sm", className: "dsh-taskify-editor-action", disabled: suggestionDraft.trim() === "", onClick: () => void acceptSuggestion() }, "\u8BBE\u4E3A Focus"), /* @__PURE__ */ import_react.default.createElement(import_dsh_client_ui_primitives.Button, { type: "button", variant: "ghost", size: "sm", className: "dsh-taskify-editor-action", onClick: () => setEditingSuggestion(false) }, "\u53D6\u6D88"), /* @__PURE__ */ import_react.default.createElement(import_dsh_client_ui_primitives.Button, { type: "button", variant: "ghost", size: "sm", className: "dsh-taskify-editor-action", onClick: ignoreSuggestion }, "\u5FFD\u7565"))) : /* @__PURE__ */ import_react.default.createElement("div", { className: "dsh-taskify-focus-suggestion" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-focus-suggestion-text" }, "\u{1F3AF} \u5EFA\u8BAE Focus: ", suggestion), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-focus-suggestion-actions" }, /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: "dsh-taskify-chip-action", onClick: () => void acceptSuggestion() }, "\u8BBE\u4E3A Focus"), /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: "dsh-taskify-chip-action", onClick: editSuggestion }, "\u7F16\u8F91"), /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: "dsh-taskify-chip-action", onClick: ignoreSuggestion }, "\u5FFD\u7565")))), editingFocus ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsh-taskify-focus-editor" }, /* @__PURE__ */ import_react.default.createElement(
    "textarea",
    {
      value: focusDraft,
      maxLength: 2e3,
      rows: 1,
      autoFocus: true,
      onChange: (event) => setFocusDraft(event.target.value),
      "aria-label": "Focus \u5185\u5BB9"
    }
  ), /* @__PURE__ */ import_react.default.createElement(import_dsh_client_ui_primitives.Button, { type: "button", variant: "ghost", size: "sm", className: "dsh-taskify-editor-action", disabled: focusDraft.trim() === "", onClick: () => void saveFocus() }, "\u4FDD\u5B58"), /* @__PURE__ */ import_react.default.createElement(import_dsh_client_ui_primitives.Button, { type: "button", variant: "ghost", size: "sm", className: "dsh-taskify-editor-action", onClick: () => setEditingFocus(false) }, "\u53D6\u6D88")) : focus === null && suggestion === null && pendingAcceptance === null ? /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: "dsh-taskify-focus-set", onClick: beginFocus }, "\u{1F3AF} \u8BBE\u7F6E Focus") : focus !== null ? /* @__PURE__ */ import_react.default.createElement("div", { className: "dsh-taskify-focus-current", "data-status": focus.status }, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-focus-icon", "aria-hidden": "true" }, "\u{1F3AF}"), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-focus-text" }, focus.text), focus.status === "paused" && /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-focus-status" }, "\u5DF2\u6682\u505C"), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-focus-actions" }, /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: "dsh-taskify-chip-action", onClick: beginFocus, "aria-label": "\u7F16\u8F91 Focus" }, "\u7F16\u8F91"), /* @__PURE__ */ import_react.default.createElement(
    "button",
    {
      type: "button",
      className: "dsh-taskify-chip-action",
      onClick: () => void controller?.[focus.status === "active" ? "pauseFocus" : "resumeFocus"](taskifyRemote),
      "aria-label": `${focus.status === "active" ? "\u6682\u505C" : "\u6062\u590D"} Focus`
    },
    focus.status === "active" ? "\u6682\u505C" : "\u6062\u590D"
  ), /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: "dsh-taskify-chip-action", onClick: () => void controller?.clearFocus(taskifyRemote), "aria-label": "\u6E05\u9664 Focus" }, "\u6E05\u9664"))) : null), (persistent.length > 0 || pending.length > 0 || noop) && /* @__PURE__ */ import_react.default.createElement("div", { className: "dsh-taskify-anchor-layer", "aria-label": "Anchors" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "dsh-taskify-anchor-list" }, persistent.map(({ key, anchor }) => /* @__PURE__ */ import_react.default.createElement(AnchorChip, { key, anchor, mutate })), pending.map(({ key, anchor }) => /* @__PURE__ */ import_react.default.createElement(AnchorChip, { key, anchor, pending: true, mutate })), pending.length > 0 && /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-pending-status" }, "\xB7 \u5F85\u53D1\u9001"), persistent.length > 0 && /* @__PURE__ */ import_react.default.createElement("button", { type: "button", className: "dsh-taskify-clear", onClick: () => void controller?.clearAnchors(taskifyRemote) }, "\u6E05\u9664\u5168\u90E8"), noop && /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-noop" }, "\u2713 \u672A\u53D1\u73B0\u9700\u8981\u989D\u5916\u951A\u5B9A\u7684\u7EA6\u675F"))), (persistent.length > 0 || focus !== null) && hostState.runtimeContext.available === false && /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-context-warning" }, "\u26A0 \u5F53\u524D\u8DE8\u8F6E\u6307\u5BFC\u4E0D\u53EF\u7528"));
}
var inject = ["slots", "remote"];
async function apply(ctx) {
  installStyles();
  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE_CONTRIBUTION);
  try {
    taskifyRemote = ctx.get("remote.taskify");
    if (taskifyRemote === void 0) throw new Error("taskify Remote namespace was not installed");
    const disposeDock = ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
      name: "conversation.input.dock",
      id: "dsh-taskify-anchors",
      order: 10,
      label: "Taskify \u7EA6\u675F"
    }, TaskifyAnchors));
    const disposeButton = ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
      name: "conversation.input.right",
      id: "dsh-taskify",
      order: 20,
      label: "Taskify"
    }, TaskifyButton));
    return async () => {
      taskifyRemote = void 0;
      if (disposeButton) disposeButton();
      if (disposeDock) disposeDock();
      await disposeRemote();
    };
  } catch (error) {
    taskifyRemote = void 0;
    await disposeRemote();
    throw error;
  }
}

    return module.exports;
  }
});
