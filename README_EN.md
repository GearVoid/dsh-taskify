# DSH Taskify

[简体中文（默认）](./README.md) | **English**

> **Stronger coding agents tend to do more. Taskify helps them remember what this task is allowed to do — and what must not change.**

Taskify does not rewrite the original prompt in the composer. It uses **🎯 Focus** to define the current task's execution scope and **🔒 Persistent Anchors** to preserve explicit hard constraints, keeping both available across turns in the current Session.

![DSH Taskify interaction demo](./assets/demo.gif)

Example input:

> Make the dashboard card layout tighter and cleaner. Don't touch the backend, don't add dependencies, and don't change anything else along the way.

```text
🎯 Focus
Make the dashboard card layout tighter and cleaner

🔒 Anchors
Do not modify the backend
Do not add dependencies
Do not change other functionality
```

**The original prompt stays unchanged.**

[![DeepSeek Harness Core](https://img.shields.io/badge/DSH_Core-0.1.2--rc.1-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)
[![Release](https://img.shields.io/github/v/release/GearVoid/dsh-taskify)](https://github.com/GearVoid/dsh-taskify/releases/latest)
[![License](https://img.shields.io/github/license/GearVoid/dsh-taskify)](./LICENSE)
![Web Profile](https://img.shields.io/badge/Profile-Web-10b981)

## Two things: Focus + Anchors

### 🎯 Focus

Answers: **“How far is this task allowed to go?”**

Each Session has at most one Focus. Users can write it directly or accept an AI suggestion. A suggestion is only an editable, dismissible draft. It becomes the authoritative Focus only after user confirmation and never applies automatically.

### 🔒 Persistent Anchors

Answers: **“What must not change?”**

Anchors are explicit hard constraints extracted from the current prompt. Every Anchor must include exact evidence from the user's words, and a Session can hold multiple Anchors.

## Install or update

```sh
dsh plugin --profile web add github:GearVoid/dsh-taskify#v0.4.1
dsh web
```

To upgrade an older installation, run `plugin add` again and restart DSH Web so it loads the new Host code and Client bundle.

## How it works

```text
Write the original task
   ↓
Click ✨ Taskify
   ↓
AI suggests a Focus + extracts Anchors
   ↓
Confirm / edit / ignore the Focus
   ↓
Send the original prompt
   ↓
Focus + active Anchors continue into later turns
```

- Taskify does not change the composer text or send anything for the user.
- A Focus suggestion never applies automatically; it becomes the Session Focus only after confirmation.
- Anchors come only from hard constraints the user explicitly stated in the current prompt.
- Once active, Focus and Anchors guide later turns without requiring the user to repeat those boundaries.

Users can Set, Edit, Pause, Resume, or Clear Focus. They can also Pause, Resume, or Remove individual Anchors, or Clear All.

## Why this exists

- Boundaries written at the start of a long task can drift as the conversation grows.
- Coding agents often refactor nearby code, add abstractions or fallbacks, or expand into adjacent features along the way.
- Stronger agents are often more proactive, but “able to do more” does not mean “authorized to do more.”
- Taskify is not meant to make the model less capable. It keeps the user's execution boundaries present.

**Extract, don’t invent.** Anchors preserve explicit constraints without upgrading preferences into hard rules or inventing paths, dependencies, or APIs.

**Persistence ≠ Enforcement.** Focus and Anchors are continuing model guidance, not a sandbox, policy engine, or mechanical interception layer.

## Focus versus Persistent Anchors

| | 🎯 Focus | 🔒 Persistent Anchors |
|---|---|---|
| Answers | What may this task do at most? | What must not change? |
| Quantity | At most one per Session | Multiple per Session |
| Source | Written by the user or confirmed from an AI suggestion | Explicit hard constraints in the current prompt |
| Lifecycle | Set / Edit / Pause / Resume / Clear | Pause / Resume / Remove / Clear All |

## Extraction and trust boundaries

```json
{
  "anchors": [
    {
      "text": "Do not modify the backend",
      "evidence": "don't touch the backend"
    }
  ]
}
```

Every Anchor must trace back to exact evidence in the current draft. Preferences and softened language such as “try to” or “ideally” are not promoted to hard constraints. `anchors: []` is a valid success.

- **Literal Lock** protects code blocks, inline code, paths, URLs, IP/ports, versions, CLI tokens, and common identifiers.
- **Provenance** requires evidence to be an exact substring of the current draft.
- **Concrete Claim Guard** rejects invented paths, URLs, CLI tokens, versions, and obvious code identifiers.

Taskify does not search the workspace, generate goals, plans, acceptance criteria, or engineering advice, and does not reimplement DSH `/goal`.

## State and persistence boundaries

- **Host authoritative state** means the Client is only a disposable snapshot cache; refreshes, remounts, and replay converge on the Host.
- **Revision / CAS** lets the Host reject stale writes and return the latest authoritative snapshot.
- **Draft invalidation** affects only a pending/armed request and never deletes an active Focus or active Anchors.
- **Durable replay** uses known DSH events when the persistence provider confirms its flush; failures and unavailable durability remain visible.
- **Runtime guidance** supplies the active Focus and active Anchors through the official `systemPrompt.context` seam; paused items are excluded.
- **Session isolation** binds state to the exact session id. New Sessions and forks do not inherit Focus or Anchors by default.

## Deliberate limits

Taskify is continuing model guidance, not mechanical enforcement. It currently does not include:

- file-write interception;
- dependency-installation interception;
- automatic rollback;
- Git baselines;
- semantic diff audits;
- native `/goal` replacement;
- watchState, polling, or WebSockets;
- multi-client realtime sync;
- automatic task-completion detection.

## Compatibility

- DeepSeek Harness launcher: `0.1.2-rc.1`
- DSH core plugin API: `0.1.2-rc.1`
- DSH Web Client API: `0.1.2-rc.1`
- Node.js: `^22.19.0 || >=24.0.0`
- pnpm: `11.x` (`11.19.0` in this repository)

DSH remains in Developer Preview and may introduce compatibility changes.

## Development and tests

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm pack:check
```

The suite covers Focus suggestions and lifecycle controls, Anchor extraction and deduplication, literal preservation, provenance, draft races, Host revisions, durable replay, Session isolation, combined runtime context, and turn-settled Client convergence.

## Project structure

```text
src/host/       Host authority, activation binding, persistence, and runtime context
src/client/     Taskify button, Focus/Anchor Dock, and Client snapshot convergence
src/shared/     Compiler, Schema, Projection, and Session Runner
scripts/        Client bundle build script
test/           Node.js tests
client.js       Generated browser bundle (do not edit by hand)
cordis.patch.yml
```

See [`docs/`](./docs/) for historical architecture and implementation records.

## License

[MIT](./LICENSE)
