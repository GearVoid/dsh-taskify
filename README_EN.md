# DSH Taskify

[简体中文](./README.md) | **English**

## Anchor explicit boundaries before the agent executes

DSH Taskify is a lightweight **Intent Anchor** plugin for DeepSeek Harness Web. It extracts a small set of explicit, reviewable hard constraints from the current draft while leaving the user's original text untouched.

> Raw Prompt is the source of truth. Extract, don't invent.

### Raw task → 🔒 Constraint Chips → Send

![DSH Taskify v0.2 extracts read-only constraints before send](./assets/demo.gif)

[![DeepSeek Harness Core](https://img.shields.io/badge/DSH_Core-0.1.0--rc.6-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)
[![Release](https://img.shields.io/github/v/release/GearVoid/dsh-taskify)](https://github.com/GearVoid/dsh-taskify/releases/latest)
[![License](https://img.shields.io/github/license/GearVoid/dsh-taskify)](./LICENSE)
![Web Profile](https://img.shields.io/badge/Profile-Web-10b981)

## Install

```sh
dsh plugin --profile web add github:GearVoid/dsh-taskify#v0.2.0
```

Then start or restart DeepSeek Harness Web:

```sh
dsh web
```

## What it does

Given:

> This dashboard is messy. Clean it up, but don't touch the backend or remove any features.

Clicking `✨ Taskify` leaves the composer unchanged and displays read-only chips nearby:

```text
🔒 Do not modify the backend
🔒 Preserve existing features
```

Hover or focus a chip to inspect its exact source evidence. A draft with no explicit hard boundary is a valid no-op:

```text
✓ No additional constraints found
```

## Flow

```text
Current user draft
   ↓
Parse the Slash command body
   ↓
Protect code, paths, and other literals
   ↓
Extract Anchor + Evidence with the current session model
   ↓
Validate provenance, modality, and concrete code claims
   ↓
Display read-only chips without rewriting the draft
   ↓
The user sends manually
   ↓
Raw Prompt + user-level Taskify Constraint Contract
```

Taskify does not recover constraints from conversation history, search the workspace, or generate goals, plans, acceptance criteria, and generic engineering advice.

## Anchor contract

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

Every anchor requires exact evidence from the current draft. Preferences and softened language such as “try to” or “ideally” are not promoted to hard constraints. `anchors: []` is a valid success.

## Agent delivery

The user still sends through DSH's normal button. When that human message exactly matches the anchored draft, Taskify uses the official `agent/pre-step` extension point to append a user-role, plugin-sourced message:

```xml
<taskify_constraints>
- Do not modify the backend
- Preserve existing features
</taskify_constraints>
```

The contract never enters the System Prompt and has no higher authority than the user's text. No empty template is sent for a no-op.

## Safety and state

- **Literal Lock** protects code, paths, URLs, IP/ports, versions, CLI tokens, and identifiers.
- **Provenance** requires evidence to be an exact substring of the current draft.
- **Concrete Claim Guard** rejects newly invented paths, URLs, CLI tokens, versions, and obvious identifiers.
- **Revision / race protection** discards stale responses and clears Host state after draft edits.
- **Read-only chips** cannot be edited or deleted; editing the raw draft invalidates them.
- **Cancel, retry, and session isolation** remain supported.
- Drafts containing Reference Chips are not extracted in this release.

## Compatibility

- DeepSeek Harness launcher: `0.1.1-rc.2`
- DSH core plugin API: `0.1.0-rc.6`
- DSH Web Client API: `0.0.1-rc.1`
- Node.js: `^22.19.0 || >=24.0.0`
- pnpm: `11.x` (this repository uses `11.19.0`)

DSH remains in Developer Preview and may introduce breaking changes.

## Development

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm pack:check
```

The suite covers extraction-result validation, invented-constraint rejection, modality protection, literal preservation, empty anchors, provenance, no prompt rewrite, draft races, cancellation, session isolation, and user-level contract injection.

## License

[MIT](./LICENSE)
