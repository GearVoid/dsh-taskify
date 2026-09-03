# DSH Taskify

[简体中文（默认）](./README.md) | **English**

## Help DeepSeek Harness remember what this task should do and what it must not change

“Don't touch the backend.” “Keep every feature.” “Leave the API unchanged.” “Add no dependencies.” These boundaries are easy to lose over a long agent task.

DSH Taskify does not rewrite your prompt. It uses one **🎯 Focus** to state what the current session is authorized to accomplish at most, and presents explicit hard constraints as reviewable **Persistent Anchors**. The active Focus and Anchors continue guiding the model throughout the session until you change their lifecycle state.

> Make the dashboard look better. Don't touch the backend, don't remove any features, and don't add new dependencies.

```text
🎯 Focus: Improve the dashboard layout and visuals
🔒 Do not modify the backend　 🔒 Preserve existing features　 🔒 Add no dependencies
```

**Focus defines the execution scope. Anchors pin what must not change. Your original prompt stays untouched.**

![DSH Taskify interaction demo](./assets/demo.gif)

[![DeepSeek Harness Core](https://img.shields.io/badge/DSH_Core-0.1.0--rc.6-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)
[![Release](https://img.shields.io/github/v/release/GearVoid/dsh-taskify)](https://github.com/GearVoid/dsh-taskify/releases/latest)
[![License](https://img.shields.io/github/license/GearVoid/dsh-taskify)](./LICENSE)
![Web Profile](https://img.shields.io/badge/Profile-Web-10b981)

## What's new in v0.4

v0.4 adds a Session Focus alongside Host-owned Persistent Anchors and renders both as continuing model guidance.

```text
Current draft
   ↓ click Taskify
AI Focus suggestion (editable or dismissible) + pending Anchors
   ↓ user confirms the suggestion (it never applies automatically)
   ↓ send the matching raw message
Host activates Persistent Anchors and applies the confirmed Focus after turn settle
   ↓
Active Focus + Anchors guide later turns
   ↓
User controls each lifecycle
```

- Each Session has at most one Focus. Users can write it directly or confirm an AI suggestion.
- An AI Focus suggestion is only a Client-visible draft. It becomes authoritative only after the user clicks “Set Focus.”
- Focus supports Set, Edit, Pause, Resume, and Clear. Anchors support Pause, Resume, Remove, and Clear All.
- The active Focus and active Anchors share the runtime context used on later turns.
- Host state is authoritative; the Client is a disposable snapshot cache.
- Known DSH Session Events and UserMessages provide replayable state without upstream changes.
- Extraction excludes already represented constraints, with deterministic exact-text filtering for persistent/pending duplicates.
- New sessions and forks do not inherit Focus or Anchors.

## Install or update

```sh
dsh plugin --profile web add github:GearVoid/dsh-taskify#v0.4.0
```

Then restart DeepSeek Harness Web:

```sh
dsh web
```

If an older version is installed, run the same `plugin add` command again and restart DSH Web to load both the new Host code and Client bundle.

## Use

1. Enter the raw task in DSH Web.
2. Click `✨ Taskify`.
3. Review the suggested Focus and Anchor chips with their shared “Pending” state.
4. Accept, edit, or ignore the suggestion, or set Focus manually.
5. Send through DSH's normal send button.
6. When the matching message is accepted, Anchors become active; a confirmed Focus is applied after the Host request returns to idle.

AI suggestions never apply automatically. Hover or focus a summarized Anchor to inspect its exact evidence. Active Anchors can be paused, resumed, removed individually, or cleared together. A draft with no explicit hard boundary is a valid no-op.

## Extraction contract

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

Every Anchor requires exact evidence from the current draft. Preferences and softened language such as “try to” or “ideally” are not promoted to hard constraints. `anchors: []` is a valid success.

Taskify does not search the workspace, generate goals, plans, acceptance criteria, or engineering advice, and does not reimplement DSH `/goal`.

## Focus versus Persistent Anchors

| | 🎯 Focus | 🔒 Persistent Anchors |
|---|---|---|
| Answers | What may this session accomplish at most? | What must not change? |
| Quantity | At most one per Session | Multiple per Session |
| Source | Written by the user, or AI-suggested and user-confirmed | Extracted from the current prompt with exact evidence |
| Lifecycle | Set / Edit / Pause / Resume / Clear | Pause / Resume / Remove / Clear All |
| Authority | Only user actions can change Host Focus | Only user actions can change active Anchor state |

Focus is continuing model guidance, not mechanical enforcement. It guides the model to stay within the confirmed execution scope, but does not intercept file writes, dependency installation, or Git operations.

## State and safety boundaries

- **Literal Lock** protects code, paths, URLs, IP/ports, versions, CLI tokens, and identifiers.
- **Provenance** requires evidence to be an exact substring of the current draft.
- **Concrete Claim Guard** rejects invented paths, URLs, CLI tokens, versions, and obvious identifiers.
- **Revision / CAS** lets the Host reject stale mutations and return authoritative snapshots.
- **Draft invalidation** affects only the pending/armed request and never deletes active Anchors.
- **Durable replay** uses known DSH events when the persistence provider confirms its flush.
- **Runtime guidance** uses the official `systemPrompt.context` seam for the active Focus and active Anchors; paused items are excluded.
- **Session isolation** binds state to the exact session id.

## Deliberate limits

Focus and Persistent Anchors are model guidance, not filesystem or Git enforcement. v0.4 does not include dependency/file-write interception, automatic rollback, Git baselines, Minimal Diff Mode, semantic diff audits, native Goal integration, polling, watchState, WebSockets, multi-client realtime sync, or automatic completion expiry.

## Compatibility

- DeepSeek Harness launcher: `0.1.1-rc.2`
- DSH core plugin API: `0.1.0-rc.6`
- DSH Web Client API: `0.0.1-rc.1`
- Node.js: `^22.19.0 || >=24.0.0`
- pnpm: `11.x` (`11.19.0` in this repository)

DSH remains in Developer Preview and may introduce compatibility changes.

## Development

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm pack:check
```

The suite covers Focus suggestions and lifecycle controls, Anchor extraction and deduplication, literal preservation, provenance, draft races, Host revisions, durable replay, session isolation, combined runtime context, and turn-settled Client convergence.

See [`docs/`](./docs/) for historical architecture and implementation records.

## License

[MIT](./LICENSE)
