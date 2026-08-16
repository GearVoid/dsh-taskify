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
var MAX_RESULT_CHARS = 8e3;
var MAX_LITERALS = 900;
var SENTINEL_PREFIX = "__DSH_TASKIFY_";
var SENTINEL_SUFFIX = "__";
var LOCK_SEGMENT = "_LOCK_";
var UNKNOWN_SENTINEL_RE = /__DSH_TASKIFY_[A-F0-9]{8}_LOCK_\d{3}__/g;
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
function sentinelOccurrences(result, sentinel) {
  let count = 0;
  let index = -1;
  let cursor = result.indexOf(sentinel);
  while (cursor !== -1) {
    count += 1;
    index = cursor;
    cursor = result.indexOf(sentinel, cursor + sentinel.length);
  }
  return { count, index };
}
function validateLockedResult(result, lock) {
  if (typeof result !== "string" || result.trim() === "") {
    return { ok: false, error: "EMPTY_RESULT" };
  }
  if (result.length > MAX_RESULT_CHARS) {
    return { ok: false, error: "RESULT_TOO_LONG" };
  }
  const expected = /* @__PURE__ */ new Set();
  const indexes = [];
  for (let index = 0; index < lock.locks.length; index += 1) {
    const sentinel = makeSentinel(lock.nonce, index);
    expected.add(sentinel);
    const occurrence = sentinelOccurrences(result, sentinel);
    if (occurrence.count !== 1) {
      return {
        ok: false,
        error: occurrence.count === 0 ? "SENTINEL_MISSING" : "SENTINEL_DUPLICATED",
        detail: `literal ${index}`
      };
    }
    indexes.push(occurrence.index);
  }
  for (let index = 1; index < indexes.length; index += 1) {
    if (indexes[index] < indexes[index - 1]) {
      return { ok: false, error: "SENTINEL_ORDER_CHANGED", detail: `literal ${index}` };
    }
  }
  for (const match of result.matchAll(UNKNOWN_SENTINEL_RE)) {
    if (!expected.has(match[0])) {
      return { ok: false, error: "UNKNOWN_SENTINEL", detail: match[0] };
    }
  }
  return { ok: true };
}
function unlockResult(result, lock) {
  let restored = result;
  for (let index = 0; index < lock.locks.length; index += 1) {
    restored = restored.replaceAll(makeSentinel(lock.nonce, index), lock.locks[index]);
  }
  return restored;
}
function validateAndUnlock(result, lock) {
  const validation = validateLockedResult(result, lock);
  if (!validation.ok) return validation;
  return { ok: true, text: unlockResult(result, lock) };
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
function buildFinalDraft(parsed, compiledBody, rawDraft) {
  if (parsed.kind === "command") return `${parsed.command} ${compiledBody}`;
  if (parsed.kind === "plain") return compiledBody;
  return rawDraft;
}

// src/shared/depth.js
var LIGHT_HINTS = [
  /修复|fix|bug|error|null pointer|空指针|不改|不要改|保持|src[\/]/iu,
  /\b(?:src|packages|app)\b.*\b(?:ts|tsx|js|jsx|json)\b/iu,
  /第\s*\d+\s*行|line\s+\d+/iu
];
var DEEP_HINTS = [
  /整理|重构|优化|太乱|乱|dashboard|系统设计|架构|多步骤|页面.*(?:整理|重做|改版)/iu,
  /同时|并且|还有|以及/iu,
  /，.*，.*，/u
];
function estimateDepth(draft = "") {
  const text = String(draft);
  if (text.trim() === "") return "LIGHT";
  if (LIGHT_HINTS.some((re) => re.test(text))) return "LIGHT";
  if (DEEP_HINTS.some((re) => re.test(text))) return "DEEP";
  return "STANDARD";
}

// src/shared/context.js
var CONTEXT_MAX_CHARS = 3e3;
var CONTEXT_MAX_MESSAGES = 4;
var CONTEXT_MAX_PER_MESSAGE = 1200;
var DROP_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /authorization\s*[:=]/i,
  /bearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /\bsk-[A-Za-z0-9_-]{8,}\b/i,
  /(?:password|passwd|secret|api[_-]?key|access[_-]?key|token|credential)\s*[:=]\s*\S{4,}/i,
  /\.env/i
];
function textOfContent(content) {
  if (!Array.isArray(content)) return "";
  return content.filter((block) => block && block.type === "text" && typeof block.text === "string").map((block) => block.text).join("\n").trim();
}
function userText(node) {
  if (!node || node.kind !== "user") return "";
  return textOfContent(node.content);
}
function assistantText(node) {
  if (!node || node.kind !== "assistant" || node.interrupted === true) return "";
  if (!Array.isArray(node.blocks)) return "";
  return node.blocks.filter((block) => block && block.kind === "text" && typeof block.text === "string").map((block) => block.text).join("\n").trim();
}
function unsafe(text) {
  return DROP_PATTERNS.some((pattern) => pattern.test(text));
}
function clamp(text) {
  const normalized = text.replace(/\0/g, "");
  if (normalized.length <= CONTEXT_MAX_PER_MESSAGE) return normalized;
  return `${normalized.slice(0, CONTEXT_MAX_PER_MESSAGE)} \u2026`;
}
function extractRecentContext(session, options = {}) {
  const maxChars = options.maxChars ?? CONTEXT_MAX_CHARS;
  const maxMessages = options.maxMessages ?? CONTEXT_MAX_MESSAGES;
  const nodes = Array.isArray(session?.nodes) ? session.nodes : [];
  const recent = [];
  for (let index = nodes.length - 1; index >= 0 && recent.length < maxMessages; index -= 1) {
    const node = nodes[index];
    const text = node?.kind === "user" ? userText(node) : node?.kind === "assistant" ? assistantText(node) : "";
    if (text === "" || unsafe(text)) continue;
    recent.push({ role: node.kind, text: clamp(text) });
  }
  recent.reverse();
  const kept = [];
  let total = 0;
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const entry = recent[index];
    const remaining = maxChars - total;
    if (remaining <= 0) break;
    if (entry.text.length <= remaining) {
      kept.unshift(entry);
      total += entry.text.length;
    } else if (kept.length === 0) {
      kept.unshift({ ...entry, text: entry.text.slice(0, remaining) });
      total = maxChars;
      break;
    } else {
      break;
    }
  }
  return kept.map((entry) => `<${entry.role}>${entry.text}</${entry.role}>`).join("\n");
}

// src/shared/task-runner.js
var NOTICE = Object.freeze({
  SLASH_ONLY: "\u547D\u4EE4\u672C\u8EAB\u65E0\u9700\u5B8C\u5584",
  REFERENCE_UNSUPPORTED: "\u5F53\u524D\u8349\u7A3F\u5305\u542B\u5F15\u7528\u5185\u5BB9\uFF0C\u4E3A\u907F\u514D\u7834\u574F\u5F15\u7528\u5173\u7CFB\uFF0C\u672C\u7248\u672C\u6682\u4E0D\u652F\u6301\u5B8C\u5584\u3002",
  DRAFT_CHANGED: "\u8349\u7A3F\u5DF2\u53D1\u751F\u53D8\u5316\uFF0C\u672C\u6B21\u589E\u5F3A\u7ED3\u679C\u672A\u5E94\u7528\u3002",
  LITERAL_VALIDATION_FAILED: "\u589E\u5F3A\u7ED3\u679C\u672A\u901A\u8FC7\u5173\u952E\u5185\u5BB9\u4FDD\u62A4\u6821\u9A8C\uFF0C\u539F\u59CB\u8349\u7A3F\u672A\u4FEE\u6539\u3002",
  TIMEOUT: "\u4EFB\u52A1\u5B8C\u5584\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  RESULT_TOO_LONG: "\u589E\u5F3A\u7ED3\u679C\u8D85\u8FC7\u957F\u5EA6\u4E0A\u9650\uFF0C\u539F\u59CB\u8349\u7A3F\u672A\u4FEE\u6539\u3002",
  EMPTY_RESULT: "\u6A21\u578B\u672A\u8FD4\u56DE\u53EF\u7528\u5185\u5BB9\uFF0C\u539F\u59CB\u8349\u7A3F\u672A\u4FEE\u6539\u3002",
  BUSY: "\u5F53\u524D\u4EFB\u52A1\u6B63\u5728\u5B8C\u5584\u4E2D\uFF0C\u8BF7\u5148\u53D6\u6D88\u6216\u7B49\u5F85\u5B8C\u6210\u3002"
});
function cloneState(state) {
  return {
    ...state,
    error: state.error === null ? null : { ...state.error },
    notice: state.notice === null ? null : { ...state.notice }
  };
}
function requestIdOf(sessionId, generation, seq) {
  return `dsh-taskify:${sessionId}:${generation}:${seq}`;
}
var TaskifySession = class {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.listeners = /* @__PURE__ */ new Set();
    this.generation = 0;
    this.seq = 0;
    this.disposed = false;
    this.abortController = null;
    this.state = {
      status: "ready",
      requestId: null,
      originalDraft: null,
      appliedDraft: null,
      requestStartDraft: null,
      requestStartDraftRev: null,
      error: null,
      notice: null,
      noticeSeq: 0
    };
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
    const snapshot = cloneState(this.state);
    this.state = snapshot;
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
      }
    }
    return snapshot;
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
  get isEnhancing() {
    return this.state.status === "enhancing" && !this.disposed;
  }
  start({ draft, draftRev, context, parsed, lock, remote, onApply, getLiveDraft }) {
    if (this.disposed) return null;
    if (typeof draft !== "string" || draft.trim() === "" || parsed && parsed.kind === "empty") return null;
    if (this.isEnhancing) {
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
    this.state = {
      status: "enhancing",
      requestId,
      originalDraft: null,
      appliedDraft: null,
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
        carrier = await remote.compile(
          {
            requestId,
            sessionId: this.sessionId,
            draft: lock.text,
            context: context || ""
          },
          abortController.signal
        );
      } catch (error) {
        if (generation !== this.generation || this.disposed) return;
        this.fail({ code: "remote-error", message: error instanceof Error ? error.message : String(error) });
        return;
      }
      const live = typeof getLiveDraft === "function" ? getLiveDraft() : { draft, draftRev };
      this.settle({
        generation,
        requestId,
        parsed,
        rawDraft: draft,
        currentDraft: live.draft,
        currentDraftRev: live.draftRev,
        carrier,
        lock,
        onApply
      });
    };
    void run();
    return requestId;
  }
  settle({ generation, requestId, parsed, rawDraft, currentDraft, currentDraftRev, carrier, lock, onApply }) {
    if (this.disposed || generation !== this.generation || this.state.requestId !== requestId || this.state.status !== "enhancing") return;
    if (currentDraft !== this.state.requestStartDraft || currentDraftRev !== this.state.requestStartDraftRev) {
      this.fail({ code: "draft-changed", message: NOTICE.DRAFT_CHANGED });
      return;
    }
    if (!carrier || carrier.ok === false) {
      this.fail({
        code: carrier?.error?.code ?? "remote-error",
        message: carrier?.error?.message || "\u4EFB\u52A1\u5B8C\u5584\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002"
      });
      return;
    }
    const value = carrier.value;
    if (!value || value.requestId !== requestId) {
      this.fail({ code: "bad-response", message: "\u4EFB\u52A1\u5B8C\u5584\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6548\u54CD\u5E94\u3002" });
      return;
    }
    if (value.ok === false) {
      this.fail({
        code: value.error?.code ?? "remote-error",
        message: value.error?.message || "\u4EFB\u52A1\u5B8C\u5584\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002"
      });
      return;
    }
    if (value.ok !== true || typeof value.text !== "string") {
      this.fail({ code: "bad-response", message: "\u4EFB\u52A1\u5B8C\u5584\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6548\u54CD\u5E94\u3002" });
      return;
    }
    const restored = validateAndUnlock(value.text, lock);
    if (!restored.ok) {
      this.fail({ code: "literal-validation-failed", message: NOTICE.LITERAL_VALIDATION_FAILED });
      return;
    }
    const finalDraft = buildFinalDraft(parsed, restored.text, rawDraft);
    if (finalDraft.length > MAX_RESULT_CHARS) {
      this.fail({ code: "result-too-long", message: NOTICE.RESULT_TOO_LONG });
      return;
    }
    try {
      onApply(finalDraft);
    } catch (error) {
      this.fail({ code: "apply-failed", message: error instanceof Error ? error.message : String(error) });
      return;
    }
    this.state = {
      status: "applied",
      requestId: null,
      originalDraft: rawDraft,
      appliedDraft: finalDraft,
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
    this.showNotice(error.message || "\u4EFB\u52A1\u5B8C\u5584\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    this.state = {
      ...this.state,
      status: "error",
      requestId: null,
      originalDraft: null,
      appliedDraft: null,
      error: { code: error.code || "unknown", message: error.message || "\u4EFB\u52A1\u5B8C\u5584\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002" }
    };
    this.abortController = null;
    this.emit();
  }
  cancel() {
    if (this.disposed || !this.isEnhancing) return;
    this.generation += 1;
    if (this.abortController) this.abortController.abort();
    this.abortController = null;
    this.state = {
      status: "ready",
      requestId: null,
      originalDraft: null,
      appliedDraft: null,
      requestStartDraft: null,
      requestStartDraftRev: null,
      error: null,
      notice: null,
      noticeSeq: this.state.noticeSeq
    };
    this.emit();
  }
  canUndo(currentDraft) {
    return this.state.status === "applied" && typeof currentDraft === "string" && this.state.appliedDraft === currentDraft && this.state.originalDraft !== null;
  }
  undo(currentDraft, onApply) {
    if (!this.canUndo(currentDraft)) return false;
    const originalDraft = this.state.originalDraft;
    onApply(originalDraft);
    this.state = {
      status: "ready",
      requestId: null,
      originalDraft: null,
      appliedDraft: null,
      requestStartDraft: null,
      requestStartDraftRev: null,
      error: null,
      notice: null,
      noticeSeq: this.state.noticeSeq
    };
    this.emit();
    return true;
  }
  onDraftChanged(currentDraft) {
    if (this.disposed) return;
    if (this.state.status === "enhancing") return;
    if (this.state.status === "applied" && currentDraft !== this.state.appliedDraft) {
      this.state = {
        ...this.state,
        status: "edited",
        originalDraft: null,
        appliedDraft: null,
        requestStartDraft: null,
        requestStartDraftRev: null,
        error: null,
        notice: null
      };
      this.emit();
      return;
    }
    if (this.state.status === "error" && currentDraft !== this.state.requestStartDraft) {
      this.state = {
        ...this.state,
        status: "ready",
        originalDraft: null,
        appliedDraft: null,
        requestStartDraft: null,
        requestStartDraftRev: null,
        error: null,
        notice: null
      };
      this.emit();
    }
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    if (this.abortController) this.abortController.abort();
    this.abortController = null;
    this.listeners.clear();
  }
};

// src/shared/reference.js
function isReferenceBlocked(occurrences) {
  return Array.isArray(occurrences) && occurrences.length > 0;
}
var REFERENCE_BLOCKED_NOTICE = "\u5F53\u524D\u8349\u7A3F\u5305\u542B\u5F15\u7528\u5185\u5BB9\uFF0C\u4E3A\u907F\u514D\u7834\u574F\u5F15\u7528\u5173\u7CFB\uFF0C\u672C\u7248\u672C\u6682\u4E0D\u652F\u6301\u5B8C\u5584\u3002";

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
var compileRequestSchema = {
  parse(value) {
    if (!isRecord(value)) throw new TypeError("request must be an object");
    const requestId = requireNonEmptyString(value.requestId, "requestId");
    const sessionId = requireNonEmptyString(value.sessionId, "sessionId");
    const draft = requireString(value.draft, "draft");
    const context = requireString(value.context ?? "", "context");
    return { requestId, sessionId, draft, context };
  }
};
var compileResultSchema = {
  parse(value) {
    if (!isRecord(value)) throw new TypeError("result must be an object");
    const ok = value.ok;
    if (typeof ok !== "boolean") throw new TypeError("result.ok must be a boolean");
    const requestId = requireNonEmptyString(value.requestId, "requestId");
    if (ok) {
      return { ok: true, requestId, text: requireString(value.text, "text") };
    }
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
var TYPERT_DESCRIPTOR = {
  id: "dsh-taskify#taskify/compile",
  service: "taskify",
  namespace: "taskify",
  method: "compile",
  invocation: { kind: "direct" },
  parameters: [
    {
      name: "request",
      wire: "request",
      source: "json",
      codec: {
        mode: "strict",
        typeSymbol: "dsh-taskify#CompileRequest",
        schema: compileRequestSchema
      }
    }
  ],
  cancellation: { parameter: "signal" },
  result: {
    mode: "strict",
    typeSymbol: "dsh-taskify#CompileResult",
    schema: compileResultSchema
  }
};
var TYPERT_REMOTE_CONTRIBUTION = {
  package: "dsh-taskify",
  descriptors: [TYPERT_DESCRIPTOR]
};

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
  max-width: 132px;
  min-width: max-content;
  white-space: nowrap;
}
.dsh-taskify-label-cancel {
  display: none;
}
.dsh-taskify-button:hover .dsh-taskify-label-normal,
.dsh-taskify-button:focus-visible .dsh-taskify-label-normal {
  display: none;
}
.dsh-taskify-button:hover .dsh-taskify-label-cancel,
.dsh-taskify-button:focus-visible .dsh-taskify-label-cancel {
  display: inline;
}
.dsh-taskify-icon {
  display: block;
  width: 14px;
  height: 14px;
  flex: none;
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
  return /* @__PURE__ */ import_react.default.createElement(
    "svg",
    {
      className: "dsh-taskify-icon",
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    /* @__PURE__ */ import_react.default.createElement("path", { d: "M8 1.75 8.75 4 11 4.75 8.75 5.5 8 7.75 7.25 5.5 5 4.75 7.25 4Z" }),
    /* @__PURE__ */ import_react.default.createElement("path", { d: "m5.25 7.25.95 2.55 2.55.95-2.55.95-.95 2.55-.95-2.55-2.55-.95 2.55-.95Z" }),
    /* @__PURE__ */ import_react.default.createElement("path", { d: "m12.25 8.5.45 1.05 1.05.45-1.05.45-.45 1.05-.45-1.05-1.05-.45 1.05-.45Z" })
  );
}
function iconFor(state, busy) {
  if (busy) return /* @__PURE__ */ import_react.default.createElement(TaskifyIcon, null);
  if (state.status === "applied") return /* @__PURE__ */ import_react.default.createElement("span", { "aria-hidden": "true" }, "\u21B6");
  return /* @__PURE__ */ import_react.default.createElement(TaskifyIcon, null);
}
function labelFor(state, busy, empty, referenceBlocked) {
  if (busy) return "\u5B8C\u5584\u4E2D\u2026";
  if (empty || referenceBlocked) return "\u5B8C\u5584\u4EFB\u52A1";
  if (state.status === "applied") return "\u64A4\u56DE";
  if (state.status === "edited") return "\u518D\u5B8C\u5584";
  if (state.status === "error") return "\u91CD\u8BD5";
  return "\u5B8C\u5584\u4EFB\u52A1";
}
function tooltipFor({ busy, empty, unavailable, referenceBlocked, applied, state, remoteReady }) {
  if (busy) return "\u70B9\u51FB\u53D6\u6D88\u672C\u6B21\u5B8C\u5584";
  if (empty) return "\u5148\u8F93\u5165\u4EFB\u52A1";
  if (unavailable) return "\u5F53\u524D\u8F93\u5165\u72B6\u6001\u4E0D\u53EF\u5B8C\u5584";
  if (referenceBlocked) return REFERENCE_BLOCKED_NOTICE;
  if (!remoteReady) return "\u4EFB\u52A1\u5B8C\u5584\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA";
  if (applied) return "\u64A4\u56DE\u5230\u5B8C\u5584\u524D\u7684\u539F\u6587";
  if (state.status === "error" && state.error) return state.error.message;
  return "\u628A\u5F53\u524D\u4EFB\u52A1\u6574\u7406\u6210\u53EF\u6267\u884C\u7684\u4EFB\u52A1\u89C4\u683C";
}
function TaskifyButton({ sessionId, useSession, useInput, inputActions }) {
  const input = useInput((s) => s);
  const session = useSession((s) => s);
  const controller = taskifySessionFor(sessionId);
  const state = useTaskifySession(sessionId);
  const liveRef = import_react.default.useRef({ draft: "", draftRev: -1 });
  const draft = input?.draft ?? "";
  const draftRev = input?.draftRev ?? -1;
  liveRef.current = { draft, draftRev };
  import_react.default.useEffect(() => {
    return () => {
      if (sessionId) releaseTaskifySession(sessionId);
    };
  }, [sessionId]);
  import_react.default.useEffect(() => {
    if (controller) controller.onDraftChanged(draft);
  }, [controller, draft]);
  const trimmed = draft.trim();
  const empty = trimmed === "";
  const phase = input?.phase ?? "plain";
  const unavailable = !input || phase === "adjudicating" || phase === "claimed" || phase === "submitting";
  const occurrences = input?.occurrences ?? [];
  const referenceBlocked = isReferenceBlocked(occurrences);
  const busy = state?.status === "enhancing" && !controller?.disposed;
  const applied = state?.status === "applied" && state.appliedDraft === draft;
  const remoteReady = taskifyRemote !== void 0;
  const handleClick = () => {
    if (!controller || !inputActions) return;
    if (busy) {
      controller.cancel();
      return;
    }
    if (empty || unavailable || referenceBlocked) return;
    if (!remoteReady) {
      controller.showNotice("\u4EFB\u52A1\u5B8C\u5584\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
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
    if (applied && controller.canUndo(draft)) {
      controller.undo(draft, (text) => inputActions.setDraft(text));
      return;
    }
    const subject = parsed.kind === "command" ? parsed.body : draft.trim();
    let lock;
    try {
      lock = lockLiterals(subject);
    } catch (error) {
      controller.showNotice(error instanceof Error ? error.message : "\u4EFB\u52A1\u5185\u5BB9\u4FDD\u62A4\u5904\u7406\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
      controller.emit();
      return;
    }
    const context = extractRecentContext(session);
    void estimateDepth(subject);
    controller.start({
      draft,
      draftRev,
      context,
      parsed,
      lock,
      remote: taskifyRemote,
      onApply: (text) => inputActions.setDraft(text),
      getLiveDraft: () => ({ draft: liveRef.current.draft, draftRev: liveRef.current.draftRev })
    });
  };
  if (state === null) return null;
  const icon = iconFor(state, busy);
  const label = labelFor(state, busy, empty, referenceBlocked);
  const labelContent = busy ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-label-normal" }, "\u5B8C\u5584\u4E2D\u2026"), /* @__PURE__ */ import_react.default.createElement("span", { className: "dsh-taskify-label-cancel" }, "\xD7 \u53D6\u6D88")) : label;
  const tooltip = tooltipFor({ busy, empty, unavailable, referenceBlocked, applied, state, remoteReady });
  const disabled = !busy && (empty || unavailable || referenceBlocked || !remoteReady);
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(import_dsh_client_ui_primitives.Tooltip, { label: tooltip, side: "top" }, /* @__PURE__ */ import_react.default.createElement(
    import_dsh_client_ui_primitives.Button,
    {
      type: "button",
      variant: "ghost",
      size: "sm",
      className: "dsh-taskify-button",
      icon,
      onClick: handleClick,
      disabled,
      "aria-label": label
    },
    labelContent
  )), state.notice !== null && /* @__PURE__ */ import_react.default.createElement(
    import_dsh_client_ui_primitives.Toast,
    {
      key: state.notice.seq,
      text: state.notice.text,
      onDone: () => controller.clearNotice()
    }
  ));
}
var inject = ["slots", "remote"];
async function apply(ctx) {
  installStyles();
  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE_CONTRIBUTION);
  try {
    taskifyRemote = ctx.get("remote.taskify");
    if (taskifyRemote === void 0) {
      throw new Error("taskify Remote namespace was not installed");
    }
    const disposeSlot = ctx.slots.inject("conversation.input.right", () => ctx.slots.register(
      {
        name: "conversation.input.right",
        id: "dsh-taskify",
        order: 20,
        label: "\u5B8C\u5584\u4EFB\u52A1"
      },
      TaskifyButton
    ));
    return async () => {
      taskifyRemote = void 0;
      if (disposeSlot) disposeSlot();
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
