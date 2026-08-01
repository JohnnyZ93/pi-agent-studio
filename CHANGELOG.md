# Changelog

All notable changes to **Pi Agent Studio** are documented in this file.

## [1.1.2] - 2026-08-01

- **Permission gate**: added a new `permission-gate` bridge extension that intercepts dangerous bash commands (`rm -rf`, `sudo`, `chmod/chown 777`, …) and requires explicit approval before execution. Configure via `pi-agent-studio.permission.mode` (`AskForApproval` / `FullAccess`) and `pi-agent-studio.permission.dangerousPatterns`; switch the mode per session with the `/permission` slash command. The webview chat panel shows the current mode in the composer and renders Allow/Block buttons on permission dialogs.
- **Prompt Templates sidebar**: new sidebar view to manage pi prompt templates in user and project scopes — create, edit, delete, and open template markdown files (with YAML frontmatter) directly from the IDE.
- **Session status tracking**: sessions sidebar and chat panel titles now show running/idle status icons, tracked live via the bridge across terminal and webview sessions.
- **Chat UI**: intermediate work segments between user turns are collapsed into a single collapsible block (turn count + total duration), keeping the final assistant message prominent.
- **Chat UI**: tool call results now show line counts for `write`, added/removed line stats for `edit`, and hide the `read` args after successful execution.
- **Chat UI**: added configurable font size via `pi-agent-studio.chatFontSize` (default 13, range 8–32); all interface text scales from a single CSS custom property.

## [1.1.1] - 2026-07-29

- **Chat UI**: added image attachment support — paste or drag-and-drop images into the composer with inline preview.
- **Chat UI**: added todo list widget — parsed from agent output, rendered above the composer with completion icons and progress stats.
- **Chat UI**: added toolbar buttons (info / reload) and Ctrl+Click to open files from tool result blocks.
- **Chat UI**: improved compaction UI — event-driven placeholder with error handling, and auto-prefill input when reverting to a message.
- **Subagent**: added `title` field to tasks and collapsible result details with section labels and usage model display.
- **Btw widget**: revamped with abort support and richer UI.
- **Chat UI**: fixed auto-scroll so only user scroll changes the stick-to-bottom state.

## [1.1.0] - 2026-07-29

- **Chat UI**: added message timestamps, compaction blocks (collapsible token-reduction summaries), git-style diff view for `edit` tool results (color-coded added/removed), and line-numbered code view for `write` tool content.
- **Chat UI**: added file autocomplete and image display for tool results.
- **Chat UI**: added keyboard shortcut hints in the empty state and limited streaming text block height with scroll.
- **Chat UI**: improved auto-scroll with a stick-to-bottom threshold and `_userToggled` flag that preserves manual expand/collapse; thinking blocks now limit height and auto-scroll.
- **Chat UI**: replaced the collapsible fade overlay with native scroll and added running spinners; removed default box styling on thinking blocks with a left border on the open body.
- **Agents sidebar**: added a model dropdown to agent create/edit forms, populated from available models.
- **Autocomplete**: scoring-based matching (prefix bonus + fuzzy subsequence) with highlighted matching characters; removed the redundant scroll-to-bottom button.
- **Git commit**: lowered the diff size limit (200k → 64k) and wrapped disposal calls in try-catch inside a `finally` block for robust cleanup.

## [1.0.7] - 2026-07-29

- Added `pi-agent-studio.ui` setting (`terminal` / `webview`): open pi in a VS Code WebviewPanel backed by a per-panel `pi --mode rpc` subprocess, with streaming, prompt queuing (Enter steer / Alt+Enter follow-up), input history, fork/revert, built-in commands (`/compact`, `/autocompact`, `/session`, `/name`, `/changelog`, `/clear`, `/new`), and retry UI.
- Added bundled bridge extensions: `todo` (LLM tool + live widget + `/todos` `/todo-clear`), `questionnaire` (structured questions, web form in RPC mode), `subagent` (delegation with `explore` / `general` built-ins), and `btw` (side questions without touching the main context).
- Added **Agents** sidebar view for managing user/project-level subagent definitions.
- Added `pi-agent-studio.rpcTrace` setting to log RPC traffic to an output channel.
- Upgraded `@earendil-works/pi-coding-agent` from 0.79.0 to 0.82.1.

## [1.0.6] - 2026-07-23

- Fix(bridge): avoid the terminal being killed while waiting for notification.

## [1.0.5] - 2026-07-23

- Added `pi-agent-studio.statusBar` setting to toggle live VS Code context in pi TUI footer.
- Added `pi-agent-studio.disabledTools` setting to blocklist LLM bridge tools (e.g., `vscode_get_diagnostics`).
- Bridge now shows a VS Code notification when pi completes a task.
- Updated English and Chinese README.

## [1.0.4] - 2026-07-16

- Enhance editor group locking for Pi terminals

## [1.0.3] - 2026-06-24

- Added `pi-agent-studio.commitModel` setting to pick the model used for AI commit message generation (`provider/model` format).
- `Pi: Upgrade Pi` now falls back to the inferred package manager (`npm` / `pnpm` / `bun` / `yarn`) when `PI_OFFLINE` or `PI_SKIP_VERSION_CHECK` is set, instead of always running `pi update`.
- Truncated long session names in the Sessions sidebar delete confirmation (full name available in tooltip).

## [1.0.2] - 2026-06-23

- Replaced package manager inference with `pi update` for binary upgrades.
- Added AI-powered Git commit message generation with 14 language support.
- Added "Pi: Open Here" context menu command for explorer folders.
- Fixed sidebar UI to use CSS variables for consistent error styling.

## [1.0.1] - 2026-06-22

- Added session search with fuzzy matching, quoted phrases, and `re:` regex.
- Improved Windows pi shim execution and version detection error handling.
- Fixed Sessions sidebar opening a session while renaming.

## [1.0.0] - 2026-06-18

First stable release under the new `johnny-zhao.pi-agent-studio` publisher. Major rework of the extension surface area, sidebar, and Windows shell handling.
