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
  const result = [];
  let lastEnd = -1;
  for (const item of sorted) {
    if (item.start < lastEnd) continue;
    result.push(item);
    lastEnd = item.end;
  }
  return result;
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

// src/shared/task-runner.js
var NOTICE = Object.freeze({
  SLASH_ONLY: "\u547D\u4EE4\u672C\u8EAB\u6CA1\u6709\u53EF\u63D0\u53D6\u7684\u4EFB\u52A1\u7EA6\u675F",
  DRAFT_CHANGED: "\u8349\u7A3F\u5DF2\u53D1\u751F\u53D8\u5316\uFF0C\u672C\u6B21 Anchor \u7ED3\u679C\u5DF2\u4E22\u5F03\u3002",
  TIMEOUT: "Taskify \u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  EMPTY_RESULT: "\u6A21\u578B\u672A\u8FD4\u56DE\u53EF\u7528\u5185\u5BB9\u3002",
  BUSY: "Taskify \u6B63\u5728\u63D0\u53D6\u7EA6\u675F\uFF0C\u8BF7\u5148\u53D6\u6D88\u6216\u7B49\u5F85\u5B8C\u6210\u3002"
});
function cloneState(state) {
  return {
    ...state,
    anchors: state.anchors.map((anchor) => ({ ...anchor })),
    error: state.error === null ? null : { ...state.error },
    notice: state.notice === null ? null : { ...state.notice }
  };
}
function readyState(noticeSeq) {
  return {
    status: "ready",
    requestId: null,
    anchors: [],
    anchoredDraft: null,
    requestStartDraft: null,
    requestStartDraftRev: null,
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
var TaskifySession = class {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.listeners = /* @__PURE__ */ new Set();
    this.generation = 0;
    this.seq = 0;
    this.disposed = false;
    this.abortController = null;
    this.invalidateActive = null;
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
  start({ draft, draftRev, sourceDraft, lock, remote, getLiveDraft, onInvalidate }) {
    if (this.disposed || typeof draft !== "string" || draft.trim() === "" || !sourceDraft) return null;
    if (this.isExtracting) {
      this.showNotice(NOTICE.BUSY);
      this.emit();
      return null;
    }
    this.generation += 1;
    this.seq += 1;
    const generation = this.generation;
    const requestId = requestIdOf(this.sessionId, generation, this.seq);
    const abortController = new AbortController();
    this.abortController = abortController;
    this.invalidateActive = typeof onInvalidate === "function" ? onInvalidate : null;
    this.state = {
      status: "extracting",
      requestId,
      anchors: [],
      anchoredDraft: null,
      requestStartDraft: draft,
      requestStartDraftRev: draftRev,
      error: null,
      notice: null,
      noticeSeq: this.state.noticeSeq
    };
    this.emit();
    const run = async () => {
      let carrier;
      try {
        carrier = await remote.compile({
          requestId,
          sessionId: this.sessionId,
          rawDraft: draft,
          sourceDraft,
          draft: lock.text,
          nonce: lock.nonce,
          literals: lock.locks
        }, abortController.signal);
      } catch (error) {
        if (generation !== this.generation || this.disposed) return;
        this.fail({ code: "remote-error", message: error instanceof Error ? error.message : String(error) });
        return;
      }
      const live = typeof getLiveDraft === "function" ? getLiveDraft() : { draft, draftRev };
      this.settle({ generation, requestId, rawDraft: draft, sourceDraft, currentDraft: live.draft, currentDraftRev: live.draftRev, carrier });
    };
    void run();
    return requestId;
  }
  settle({ generation, requestId, rawDraft, sourceDraft, currentDraft, currentDraftRev, carrier }) {
    if (this.disposed || generation !== this.generation || this.state.requestId !== requestId || !this.isExtracting) return;
    if (currentDraft !== this.state.requestStartDraft || currentDraftRev !== this.state.requestStartDraftRev) {
      this.fail({ code: "draft-changed", message: NOTICE.DRAFT_CHANGED });
      return;
    }
    if (!carrier || carrier.ok === false) {
      this.fail({ code: carrier?.error?.code ?? "remote-error", message: carrier?.error?.message || "Taskify \u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002" });
      return;
    }
    const value = carrier.value;
    if (!value || value.requestId !== requestId) {
      this.fail({ code: "bad-response", message: "Taskify \u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6548\u54CD\u5E94\u3002" });
      return;
    }
    if (value.ok === false) {
      this.fail({ code: value.error?.code ?? "remote-error", message: value.error?.message || "Taskify \u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002" });
      return;
    }
    if (value.ok !== true || !validAnchors(value.anchors, sourceDraft)) {
      this.fail({ code: "bad-response", message: "Taskify \u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6548 Anchor\u3002" });
      return;
    }
    this.state = {
      status: value.anchors.length === 0 ? "noop" : "anchored",
      requestId: null,
      anchors: value.anchors,
      anchoredDraft: rawDraft,
      requestStartDraft: null,
      requestStartDraftRev: null,
      error: null,
      notice: null,
      noticeSeq: this.state.noticeSeq
    };
    this.abortController = null;
    this.emit();
  }
  fail(error) {
    if (this.disposed) return;
    void this.invalidateActive?.();
    this.showNotice(error.message || "Taskify \u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    this.state = {
      ...this.state,
      status: "error",
      requestId: null,
      anchors: [],
      anchoredDraft: null,
      error: { code: error.code || "unknown", message: error.message || "Taskify \u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002" }
    };
    this.abortController = null;
    this.emit();
  }
  cancel() {
    if (this.disposed || !this.isExtracting) return;
    this.generation += 1;
    if (this.abortController) this.abortController.abort();
    void this.invalidateActive?.();
    this.abortController = null;
    this.state = readyState(this.state.noticeSeq);
    this.emit();
  }
  /** @returns true when previously displayed anchors were invalidated. */
  onDraftChanged(currentDraft) {
    if (this.disposed || this.isExtracting) return false;
    if ((this.state.status === "anchored" || this.state.status === "noop") && currentDraft !== this.state.anchoredDraft) {
      this.state = readyState(this.state.noticeSeq);
      this.emit();
      return true;
    }
    if (this.state.status === "error" && currentDraft !== this.state.requestStartDraft) {
      this.state = readyState(this.state.noticeSeq);
      this.emit();
    }
    return false;
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    if (this.abortController) this.abortController.abort();
    void this.invalidateActive?.();
    this.abortController = null;
    this.listeners.clear();
  }
};

// src/shared/reference.js
function isReferenceBlocked(occurrences) {
  return Array.isArray(occurrences) && occurrences.length > 0;
}
var REFERENCE_BLOCKED_NOTICE = "\u5F53\u524D\u8349\u7A3F\u5305\u542B\u5F15\u7528\u5185\u5BB9\uFF0C\u4E3A\u907F\u514D\u9519\u8BEF\u5173\u8054\u6765\u6E90\uFF0C\u672C\u7248\u672C\u6682\u4E0D\u63D0\u53D6\u7EA6\u675F\u3002";

// src/shared/compiler.js
var MAX_ANCHORS = 8;
var MAX_ANCHOR_TEXT_CHARS = 240;
var MAX_EVIDENCE_CHARS = 320;

// src/shared/schema.js
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requireString(value, name) {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  return value;
}
function requireNonEmptyString(value, name) {
  const result = requireString(value, name);
  if (result.trim() === "") throw new TypeError(`${name} must not be empty`);
  return result;
}
function parseAnchor(value, name) {
  if (!isRecord(value)) throw new TypeError(`${name} must be an object`);
  const text = requireNonEmptyString(value.text, `${name}.text`);
  const evidence = requireNonEmptyString(value.evidence, `${name}.evidence`);
  if (text.length > MAX_ANCHOR_TEXT_CHARS) throw new TypeError(`${name}.text is too long`);
  if (evidence.length > MAX_EVIDENCE_CHARS) throw new TypeError(`${name}.evidence is too long`);
  return { text, evidence };
}
function parseAnchors(value) {
  if (!Array.isArray(value)) throw new TypeError("anchors must be an array");
  if (value.length > MAX_ANCHORS) throw new TypeError("anchors contains too many items");
  return value.map((anchor, index) => parseAnchor(anchor, `anchors[${index}]`));
}
var compileRequestSchema = {
  parse(value) {
    if (!isRecord(value)) throw new TypeError("request must be an object");
    const requestId = requireNonEmptyString(value.requestId, "requestId");
    const sessionId = requireNonEmptyString(value.sessionId, "sessionId");
    const rawDraft = requireNonEmptyString(value.rawDraft, "rawDraft");
    const sourceDraft = requireNonEmptyString(value.sourceDraft, "sourceDraft");
    const draft = requireNonEmptyString(value.draft, "draft");
    const nonce = requireNonEmptyString(value.nonce, "nonce");
    if (!/^[A-F0-9]{8}$/.test(nonce)) throw new TypeError("nonce is invalid");
    if (!Array.isArray(value.literals) || value.literals.some((item) => typeof item !== "string")) {
      throw new TypeError("literals must be a string array");
    }
    return { requestId, sessionId, rawDraft, sourceDraft, draft, nonce, literals: [...value.literals] };
  }
};
var compileResultSchema = {
  parse(value) {
    if (!isRecord(value)) throw new TypeError("result must be an object");
    if (typeof value.ok !== "boolean") throw new TypeError("result.ok must be a boolean");
    const requestId = requireNonEmptyString(value.requestId, "requestId");
    if (value.ok) return { ok: true, requestId, anchors: parseAnchors(value.anchors) };
    if (!isRecord(value.error)) throw new TypeError("result.error must be an object");
    return {
      ok: false,
      requestId,
      error: {
        code: requireString(value.error.code, "error.code"),
        message: requireString(value.error.message, "error.message")
      }
    };
  }
};
var invalidateRequestSchema = {
  parse(value) {
    if (!isRecord(value)) throw new TypeError("request must be an object");
    return { sessionId: requireNonEmptyString(value.sessionId, "sessionId") };
  }
};
var invalidateResultSchema = {
  parse(value) {
    if (!isRecord(value) || value.ok !== true) throw new TypeError("result.ok must be true");
    return { ok: true };
  }
};
var compileDescriptor = {
  id: "dsh-taskify#taskify/compile",
  service: "taskify",
  namespace: "taskify",
  method: "compile",
  invocation: { kind: "direct" },
  parameters: [{
    name: "request",
    wire: "request",
    source: "json",
    codec: { mode: "strict", typeSymbol: "dsh-taskify#CompileRequest", schema: compileRequestSchema }
  }],
  cancellation: { parameter: "signal" },
  result: { mode: "strict", typeSymbol: "dsh-taskify#CompileResult", schema: compileResultSchema }
};
var invalidateDescriptor = {
  id: "dsh-taskify#taskify/invalidate",
  service: "taskify",
  namespace: "taskify",
  method: "invalidate",
  invocation: { kind: "direct" },
  parameters: [{
    name: "request",
    wire: "request",
    source: "json",
    codec: { mode: "strict", typeSymbol: "dsh-taskify#InvalidateRequest", schema: invalidateRequestSchema }
  }],
  result: { mode: "strict", typeSymbol: "dsh-taskify#InvalidateResult", schema: invalidateResultSchema }
};
var TYPERT_DESCRIPTORS = [compileDescriptor, invalidateDescriptor];
var TYPERT_REMOTE_CONTRIBUTION = { package: "dsh-taskify", descriptors: TYPERT_DESCRIPTORS };

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
.dsh-taskify-anchors {
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  width: 100%;
  max-width: var(--dsh-composer-card-max-width, 100%);
  margin-inline: auto;
  padding: 2px 0;
}
.dsh-taskify-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: min(100%, 440px);
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 6%, transparent);
  padding: 4px 9px;
  font-size: 12px;
  line-height: 1.25;
  cursor: default;
}
.dsh-taskify-chip-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-taskify-noop {
  color: color-mix(in srgb, currentColor 68%, transparent);
  font-size: 12px;
  line-height: 1.4;
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
function invalidateRemote(sessionId) {
  if (!taskifyRemote || !sessionId) return Promise.resolve();
  return taskifyRemote.invalidate({ sessionId }).catch(() => void 0);
}
function TaskifyButton({ sessionId, useInput, inputActions }) {
  const input = useInput((s) => s);
  const controller = taskifySessionFor(sessionId);
  const state = useTaskifySession(sessionId);
  const liveRef = import_react.default.useRef({ draft: "", draftRev: -1 });
  const draft = input?.draft ?? "";
  const draftRev = input?.draftRev ?? -1;
  liveRef.current = { draft, draftRev };
  import_react.default.useEffect(() => () => {
    if (sessionId) releaseTaskifySession(sessionId);
  }, [sessionId]);
  import_react.default.useEffect(() => {
    if (controller?.onDraftChanged(draft)) void invalidateRemote(sessionId);
  }, [controller, draft, sessionId]);
  const empty = draft.trim() === "";
  const phase = input?.phase ?? "plain";
  const unavailable = !input || phase === "adjudicating" || phase === "claimed" || phase === "submitting";
  const referenceBlocked = isReferenceBlocked(input?.occurrences ?? []);
  const busy = state?.status === "extracting" && !controller?.disposed;
  const remoteReady = taskifyRemote !== void 0;
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
      getLiveDraft: () => ({ ...liveRef.current }),
      onInvalidate: () => invalidateRemote(sessionId)
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
function TaskifyAnchors({ sessionId, input }) {
  const state = useTaskifySession(sessionId);
  if (!state || state.anchoredDraft !== input?.draft) return null;
  if (state.status === "noop") {
    return /* @__PURE__ */ import_react.default.createElement("div", { className: "dsh-taskify-anchors" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-noop" }, "\u2713 \u672A\u53D1\u73B0\u9700\u8981\u989D\u5916\u951A\u5B9A\u7684\u7EA6\u675F"));
  }
  if (state.status !== "anchored" || state.anchors.length === 0) return null;
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "dsh-taskify-anchors", "aria-label": "Taskify \u53EA\u8BFB\u7EA6\u675F" }, state.anchors.map((anchor, index) => /* @__PURE__ */ import_react.default.createElement(import_dsh_client_ui_primitives.Tooltip, { key: `${anchor.text}:${index}`, label: `\u6765\u6E90\uFF1A\u201C${anchor.evidence}\u201D`, side: "top" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-chip", tabIndex: 0, "aria-label": `${anchor.text}\uFF1B\u6765\u6E90\uFF1A${anchor.evidence}` }, /* @__PURE__ */ import_react.default.createElement("span", { "aria-hidden": "true" }, "\u{1F512}"), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-chip-text" }, anchor.text)))));
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
