# DSH Taskify

[简体中文](./README.md) | **English**

## Turn rough requests into agent-ready tasks

A lightweight **Task Compiler** for DeepSeek Harness Web. It does not make prompts prettier—it makes tasks easier for coding agents to execute correctly.

[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek_Harness-0.1.0--rc.6-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)
[![Release](https://img.shields.io/github/v/release/GearVoid/dsh-taskify)](https://github.com/GearVoid/dsh-taskify/releases/latest)
[![License](https://img.shields.io/github/license/GearVoid/dsh-taskify)](./LICENSE)
![Web Profile](https://img.shields.io/badge/Profile-Web-10b981)

![DSH Taskify demo: refine and undo a task](./assets/demo.gif)

## One-line installation

```sh
dsh plugin --profile web add github:GearVoid/dsh-taskify#v0.1.0
```

Then start or restart DeepSeek Harness Web:

```sh
dsh web
```

The “Refine Task” action appears on the right side of the composer, before the model selector and send button.

| ✨ One click | 🔒 Literal Lock | ↶ Undo anytime | 🧠 Limited context |
| --- | --- | --- | --- |
| Refine the draft | Protect code and paths | Restore the original | Understand recent turns |

## Before → After

### Before

> This dashboard feels messy. Clean it up, but don't touch the backend or remove any features.

### After

```text
Objective
Improve the Dashboard's frontend information hierarchy and visual organization.

Work to perform
- Adjust layout, spacing, alignment, typography, and color hierarchy
- Reuse existing components and design tokens where possible
- Keep current interaction entry points clearly visible

Constraints
- Do not modify backend APIs, business logic, or data structures
- Do not remove or change existing functionality
- Avoid unrelated changes to other pages

Acceptance criteria
- Primary information hierarchy is clear and key actions are easy to identify
- The page renders correctly at existing breakpoints
- Existing functionality and interactions remain operational
```

## Why Taskify?

### Not a generic prompt beautifier

Taskify structures objectives, scope, constraints, and acceptance criteria for coding-agent execution, with detail adjusted to the clarity of the draft.

### Literal Lock

Before the model call, code blocks, inline code, file paths, URLs, IP addresses and ports, environment variables, versions, CLI flags, and common identifiers are temporarily locked. Only results that pass count and order validation are restored and written back.

### Safe by default

The refined task is written back to the composer and never submitted automatically. If the draft changes during a request, the stale result cannot overwrite it; an applied result can be undone with one click.

## More capabilities

- **Limited context**: Uses a small number of recent completed messages to understand references such as “this page” or “the previous change”, without reading the workspace or searching the repository.
- **Slash command preservation**: Keeps prefixes such as `/plan` unchanged and refines only the task body.
- **Current model reuse**: Prefers the model selected by the current session, with no additional API key required.
- **Cancel and retry**: In-progress requests can be cancelled and failures can be retried with visible error feedback.
- **Session isolation**: Requests, undo checkpoints, and errors are isolated by session.

## Usage

1. Enter a rough task in the composer.
2. Click “✨ Refine Task”.
3. Review the task specification written back to the composer.
4. Submit it manually, or click “↶ Undo” to restore the original draft.

## Button states

| State | Behavior |
| --- | --- |
| Empty input | The refine action is disabled |
| Ready | Click to refine the current draft |
| Refining | Shows a static `✨` and can be clicked to cancel |
| Applied | Click “Undo” to restore the original draft |
| Edited after apply | The task can be refined again |
| Failed | Shows an error message and allows retrying |

## How it works

```text
Current draft
   ↓
Parse Slash command
   ↓
Protect code, paths, and other literals
   ↓
Add limited recent conversation context
   ↓
Call the current session model
   ↓
Validate and restore protected literals
   ↓
Verify that the draft has not changed
   ↓
Write back to the composer without submitting
```

## Security and privacy

- Does not read workspace files or search the repository
- Does not read `.env`, SSH keys, or local credential files
- Does not contact additional third-party services
- Does not automatically submit refined tasks
- Keeps only limited recent conversation text and filters common credential patterns
- Drafts containing reference chips are not refined in the current version

## Compatibility

- Tested with DeepSeek Harness `0.1.0-rc.6`
- Web Profile
- Does not modify DeepSeek Harness itself or its Agent Presets

DeepSeek Harness is evolving quickly, so future releases may require compatibility updates.

## Development

```sh
pnpm install
pnpm test
pnpm build
```

The test suite covers Literal Lock, paths and URLs, Slash commands, cancellation, draft races, provider failures, truncated output, undo behavior, session isolation, reference handling, and safe result application.

## License

[MIT](./LICENSE)
