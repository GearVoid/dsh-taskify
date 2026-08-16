# DSH Taskify

[简体中文](./README.md) | **English**

A task refinement plugin for DeepSeek Harness Web.

DSH Taskify turns rough, ambiguous, or unstructured input into a task specification that a Coding Agent can execute more reliably, while preserving the original intent, technical terms, paths, code, and constraints whenever possible.

The refined task is written back to the composer and is **never submitted automatically**.

![DSH Taskify demo: refine and undo a task](./assets/demo.gif)

## One-line installation

```sh
dsh plugin --profile web add github:GearVoid/dsh-taskify#v0.1.0
```

Then start or restart DeepSeek Harness Web:

```sh
dsh web
```

The “Refine Task” button appears on the right side of the composer, before the model selector and send button. The `v0.1.0` tag pins the installed source so future repository changes cannot silently replace it.

## Features

- **One-click task refinement**
  Adds a “Refine Task” button to the DeepSeek Harness composer.

- **Structured task specifications**
  Clarifies the objective, scope, constraints, and acceptance criteria.

- **Protected technical literals**
  Literal Lock protects code blocks, inline code, file paths, URLs, IP addresses, ports, environment variables, versions, CLI flags, and common code identifiers from accidental rewriting.

- **Limited conversation context**
  Uses a small number of recent completed messages when helpful, without reading the workspace or searching the repository.

- **Safe draft updates**
  If the user edits the draft while a request is running, the stale result will not overwrite the new content.

- **Cancel, retry, and undo**
  In-progress requests can be cancelled, failed requests can be retried, and an applied result can be reverted to the original draft.

- **Slash command support**
  Command prefixes such as `/plan` are preserved while only the task body is refined.

- **Current model reuse**
  Uses the model selected by the current session whenever possible. No additional API key is required.

## Usage

1. Enter a rough task, for example:

   ```text
   The login button still looks wrong. Improve it without changing anything else.
   ```

2. Click “Refine Task”.

3. Wait for the refined task to be written back to the composer.

4. Review and submit it manually. Use “Undo” if you want to restore the original draft.

## Button states

| State | Behavior |
| --- | --- |
| Empty input | The refine action is disabled |
| Ready | Click to refine the current draft |
| Refining | Shows a static status icon and can be clicked to cancel |
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

- Does not read workspace files
- Does not search the repository
- Does not read `.env`, SSH keys, or local credential files
- Does not contact additional third-party services
- Does not automatically submit refined tasks
- Keeps only limited recent conversation text and filters common credential patterns
- Drafts containing reference chips are not refined in the current version

## Compatibility

- DeepSeek Harness `0.1.0-rc.6`
- Web Profile
- Does not modify DeepSeek Harness itself or its Agent Presets

DeepSeek Harness is evolving quickly, so future releases may require compatibility updates.

## Development

```sh
pnpm install
pnpm test
pnpm build
```

The test suite covers literal protection, paths, Slash commands, cancellation, draft races, provider failures, truncated output, undo behavior, session isolation, reference handling, and safe result application.

## License

[MIT](./LICENSE)
