# DSH Taskify

[简体中文（默认）](./README.md) | **English**

## Persistent constraints for a DeepSeek Harness session

“Don't touch the backend.” “Keep every feature.” “Leave the API unchanged.” “Add no dependencies.” These boundaries are easy to lose over a long agent task.

DSH Taskify does not rewrite your prompt. It extracts only the hard constraints you explicitly stated, presents them as reviewable **Persistent Anchors**, and keeps active Anchors in the current DSH session until you pause, resume, remove, or clear them.

> Make the dashboard look better. Don't touch the backend, don't remove any features, and don't add new dependencies.

```text
🔒 Do not modify the backend　 🔒 Preserve existing features　 🔒 Add no dependencies
```

**Your original words stay untouched. Taskify pins the boundaries separately.**

![DSH Taskify interaction demo](./assets/demo.gif)

[![DeepSeek Harness Core](https://img.shields.io/badge/DSH_Core-0.1.0--rc.6-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)
[![Release](https://img.shields.io/github/v/release/GearVoid/dsh-taskify)](https://github.com/GearVoid/dsh-taskify/releases/latest)
[![License](https://img.shields.io/github/license/GearVoid/dsh-taskify)](./LICENSE)
![Web Profile](https://img.shields.io/badge/Profile-Web-10b981)

## What's new in v0.3

v0.2 Anchors were consumed by one send. v0.3 moves authority to the Host and makes Anchors persistent within the exact session.

```text
Current draft
   ↓ click Taskify
Pending Anchors with exact source evidence
   ↓ send the matching raw message
Host activates session-scoped Persistent Anchors
   ↓
Active Anchors guide later turns
   ↓
User can Pause / Resume / Remove / Clear All
```

- Active Anchors continue across turns.
- Host state is authoritative; the Client is a disposable snapshot cache.
- Known DSH Session Events and UserMessages provide replayable state without upstream changes.
- Only the user can mutate Anchor lifecycle state.
- The Client refreshes from the Host when a model turn settles, so the next composer immediately shows active Anchors.
- New sessions and forks do not inherit Anchors.

## Install or update

```sh
dsh plugin --profile web add github:GearVoid/dsh-taskify#v0.3.0
```

Then restart DeepSeek Harness Web:

```sh
dsh web
```

If an older version is installed, run the same `plugin add` command again and restart DSH Web to load both the new Host code and Client bundle.

## Use

1. Enter the raw task in DSH Web.
2. Click `✨ Taskify`.
3. Review the read-only chips marked “Pending activation.”
4. Send through DSH's normal send button.
5. When that matching message is accepted, the Anchors become active for the session.

Hover or focus a chip to inspect its exact evidence. Active Anchors can be paused, resumed, removed individually, or cleared together. A draft with no explicit hard boundary is a valid no-op.

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

## State and safety boundaries

- **Literal Lock** protects code, paths, URLs, IP/ports, versions, CLI tokens, and identifiers.
- **Provenance** requires evidence to be an exact substring of the current draft.
- **Concrete Claim Guard** rejects invented paths, URLs, CLI tokens, versions, and obvious identifiers.
- **Revision / CAS** lets the Host reject stale mutations and return authoritative snapshots.
- **Draft invalidation** affects only the pending/armed request and never deletes active Anchors.
- **Durable replay** uses known DSH events when the persistence provider confirms its flush.
- **Runtime guidance** uses the official `systemPrompt.context` seam for later turns; paused Anchors are excluded.
- **Session isolation** binds state to the exact session id.

## Deliberate limits

Persistent Anchors are model guidance, not filesystem or Git enforcement. v0.3 does not include dependency/file-write interception, automatic rollback, Git baselines, Minimal Diff Mode, semantic diff audits, native Goal integration, polling, watchState, WebSockets, multi-client realtime sync, or automatic completion expiry.

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

The suite covers extraction validation, literal preservation, provenance, draft races, Host revisions, durable replay, session isolation, Anchor lifecycle controls, runtime context, and turn-settled Client convergence.

See [`docs/`](./docs/) for the v0.3 architecture and implementation records.

## License

[MIT](./LICENSE)
