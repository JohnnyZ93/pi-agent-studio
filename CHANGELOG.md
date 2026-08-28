# Changelog

All notable changes to **Pi Agent Studio** are documented in this file.

## [1.3.7] - 2026-08-28

- **Sidebar UI mode**: `pi-agent-studio.ui` gains a new `sidebar` value — `Pi: Open`, `Open Here`, and the Sessions view now open the sidebar chat instead of a terminal or panel, with session switching (`openSidebarChat` accepts `sessionFile` / `newSession`) reusing the single RPC subprocess; `Pi: Open in New Window` is hidden in this mode. UI-mode resolution is centralized in `src/ui-mode.ts`.
- **Rich input with token chips**: the chat composer replaces the plain textarea with a `contenteditable` input that renders `@file` mentions and `/commands` as styled chips, with caret-offset parsing/serialization handled by a new tokenizer module (also shared by the rewind widget).
- **"Add to Pi Chat" context-menu commands**: new `Add Selection to Pi Chat` / `Add File to Pi Chat` commands (editor/context + explorer/context menus + command palette) append the current selection as a fenced code block (with file path and line range) or a file/folder as an `@` mention to the most recently visible chat panel or the sidebar chat.
- **Configurable send shortcut**: new `pi-agent-studio.chatSendShortcut` setting (`enter` / `ctrlEnter`) — Ctrl+Enter (Cmd+Enter on macOS) sends while Enter inserts a newline; empty-state hints adapt accordingly.

## [1.3.6] - 2026-08-24

- **Sidebar chat view**: new `Pi: Open in Sidebar` command and a dedicated **Pi Chat** activity bar container host the same full chat UI as a WebviewView, sharing the existing session controller extracted from `chat-panel.ts` into `chat-session.ts` behind a `ChatHost` abstraction. A lightweight starter screen shows until you start a session; the single background session per window survives view hide / re-resolve and re-hydrates fully on re-attach.
- **Prompt timeline rail**: a vertical rail beside the chat shows each user prompt as a dot — click to scroll to it, hover for a prompt preview, with the current prompt highlighted by scroll position and separators marking compaction events.
- **Full session reload**: the chat toolbar refresh button now restarts the RPC session in place via a new `/reload` bridge command instead of re-fetching messages; stale events are dropped with a generation counter, hydration races are guarded, and the refresh button disables while streaming or when there is no session file.

## [1.3.5] - 2026-08-17

- **Chat background blur & scrollbar hiding**: when a background image is set via `pi-agent-studio.chatBackgroundImage`, the composer, widgets, and autocomplete panels now get a frosted-glass blur effect (`backdrop-filter`). Scrollbars are hidden globally in the chat panel for a cleaner look.
- **Snapshot retention improved**: max snapshot age reduced from 7 days to 1 day; empty snapshot directories and expired ones are now cleaned up automatically on session start, and the snapshot directory is created on demand when persisting.

## [1.3.4] - 2026-08-15

- **Chat background customization**: new `pi-agent-studio.chatBackgroundImage` (absolute path to a local image, validated for file type and ≤ 10 MB) and `pi-agent-studio.chatBackgroundOpacity` (0–1) settings let you set a custom background for the webview chat panel. The image is converted to a data URI and applied with frosted-glass styling to the composer, widgets, and autocomplete for readability.
- **Questionnaire tool support**: the bundled `questionnaire` extension now renders properly in the chat panel with safe DOM updates and localized pluralization (question/questions).
- **Permission gate fixed**: the "Allow" / "Block" buttons in the dangerous-command approval dialog no longer use misleading error/success theme colors.

## [1.3.3] - 2026-08-13

- **Broader VS Code compatibility**: the `vscode` engine requirement is lowered from `^1.110.0` to `^1.100.0` and `@types/vscode` is pinned to `1.100.0`, so the extension can be installed and type-checked against the widely deployed VS Code 1.100 LTS line.

## [1.3.2] - 2026-08-12

- **Configurable bridge endpoint**: new `pi-agent-studio.bridgeSocket` setting controls how the VS Code bridge is exposed — empty = random port (default), a number = fixed TCP port (falls back to a random port with a warning when busy), anything else = a Unix socket path / Windows named pipe with `{windowId}` substitution. Socket binding retries after unlinking stale sockets and uses `0600` permissions; socket-mode bridges pass `PI_VSCODE_BRIDGE_SOCKET` to pi.
  > **Thanks**: Contributed by [koalajoe23](https://github.com/koalajoe23) via [PR #2](https://github.com/JohnnyZ93/pi-agent-studio/pull/2).
- **Windows fix**: pi command shims (`.cmd` / `.bat` / `.ps1`) are now handled correctly when spawning pi processes — shim normalization is centralized in `normalizePiSpawnTarget` and reused by the RPC chat client and settings env probe, and the spawned window is hidden on Windows.

## [1.3.1] - 2026-08-11

- **Chat UI — subagent result rendering**: subagent final output is now rendered with markdown and collapsible sections; interrupted subagents (exit code -1) skip the final output. Standalone text parts are removed from display items to avoid duplication.
- **Chat UI — scroll handling**: subagent result scroll position is preserved unless auto-scrolling or already near the bottom, and subagent result elements are included in the stick-to-bottom logic. Programmatic scroll events are ignored only when near the bottom, so user scrolls always update the auto-scroll state.
- **Chat UI — delayed tooltips**: composer tooltips now appear after a 500ms delay (pending timer is cancelled on hide) and the chevron caret was removed from the model trigger for a cleaner look.

## [1.3.0] - 2026-08-07

- **Chat UI — Mermaid & KaTeX rendering**: the webview chat panel now renders `mermaid` code fences as interactive diagrams and math expressions (`$...$`, `$$...$$`, `\[...\]`) with KaTeX (CSS injected on demand). Rendering is lazy-loaded so the chat stays snappy, and failed diagrams show an inline error state.
- **Chat UI — Mermaid theme setting**: new `pi-agent-studio.chatMermaidTheme` setting (`default` / `neutral` / `dark` / `forest` / `base`) picks the diagram theme instead of inferring it from the VS Code theme; the panel re-renders on change.
- **Settings panel — new pi settings**: TUI mode (`regular` / experimental `fullscreen`) and fullscreen scrollbar (`auto` / `always` / `hidden`) under the TUI group, plus a Mermaid rendering mode (`off` / `final` / `streaming`) under Markdown.
- **Model editor**: new **Sampling Parameters** JSON field, plus new compat options `supportsFinishReason` and `chatTemplateArgs`, and the `baseten` provider in the compatibility preset list.
- **Dependencies**: `pi-*` packages updated to v0.84.0 (root + `pi-mcp`). The chat RPC client, commit-message generator, and MCP bridge already consumed the delta-style `message_update` events and passed `getApiKeyAndHeaders()` headers through unchanged, so no code changes were required for the 0.84.0 breaking changes.

## [1.2.2] - 2026-08-06

- **Localization (en + zh-cn)**: new `pi-agent-studio.language` setting (`auto` follows the VS Code display language, or explicit `en` / `zh-cn`) localizes the extension manifest, extension-host UI (sidebars, chat panel, settings panel, git commit generator), and webview UIs. Changing the setting reloads open webviews in place.
- **Advanced model compatibility options** (Settings → Models → Providers): per-model API protocol and base URL overrides, custom headers with `env`/`command` placeholder syntax, an `authHeader` toggle, OpenAI / Anthropic compatibility fields (per-field default/true/false + JSON input), and cost-tier / thinking-level map editors.
- **OAuth fixes**: pi-ai OAuth flows are now registered explicitly (fixes bundled auth resolution) and the OAuth input value is always submitted, making provider sign-in reliable.
- **First-run onboarding card**: the Settings sidebar shows an environment checklist (Node ≥ 22.19.0, npm, pi) with link-only install steps and a restart hint when pi is missing; PATH-level Node detection replaces sibling-based probing (with cmd.exe shim handling on Windows).
- **Settings UX**: chat panel gains a gear button that opens the Settings panel, `Alt+Shift+,` opens Settings from anywhere, the status bar item now opens Settings, the Settings sidebar is collapsible, and the MCP tab gains an enable toggle and idle-timeout field with save feedback.

- **Unified Settings panel**: the separate Models / Agents / Prompt Templates / Skills / MCP Servers sidebar webviews are consolidated into a single **Full Settings** editor panel (`pi-agent-studio.openSettings`). Seven lazy-loaded tabs: Models (Providers / OAuth / API Keys), Agents, Prompt Templates, Skills, MCP Servers, **Commit Message** (model / language / custom prompt), and Settings (inline **`settings.json` editor** + System Prompt Append / Override).
- **MCP editor**: explicit **transport selector** (stdio / http) with dynamic field visibility; server names are locked when editing an existing server.
- **UI / build**: theme-relative font sizes, editor-state and dropdown-preservation fixes; `dist` is cleaned before each build to avoid stale chunks.

## [1.2.0] - 2026-08-05

- **MCP support**: new MCP bridge extension connects configured Model Context Protocol servers (user `~/.pi/agent/mcp.json` + project `.pi/mcp.json`, stdio or HTTP) at session start and registers their tools/resources/prompts into pi. Discover and call tools via `mcp_tool_search` / `mcp_tool_call`, expose prompts as `/mcp__<server>__<prompt>` commands, and manage connections live from the chat toolbar MCP drawer or the `/mcp` command (start / stop / reconnect). Idle servers auto-disconnect (`pi-agent-studio.mcp.idleTimeout`, default 10 min) while cached metadata stays searchable; new **MCP Servers** sidebar manages server configs and per-server `directTools` in both scopes.
- **Skills panel**: new **Skills** sidebar view to create / edit / delete pi skills (SKILL.md with YAML frontmatter) in user and project scopes; external skills are read-only with an open-file action.
- **Chat UI**: composer model selector replaced with a **searchable dropdown** with keyboard navigation and per-model **favorites** (persisted in `settings.json`); **Ctrl+U** (Cmd+U on macOS) clears the composer; toolbar gains a session info + refresh button; compaction status shows via an in-container toast.
- **Build**: chat frontend migrated to a **Vite subproject** (`pi-chat/`) with model brand icons and the codicon font inlined at build time; workspace consolidated under a single root `pnpm-workspace.yaml`.
- **Performance**: heavy modules (sidebar providers, chat panel, git commit, config) are now lazy-loaded on first use and session restores run in parallel — faster IDE startup.
- **Fixes**: session renames propagate to open chat panels; sidebar open state syncs without full re-render; `overflow-anchor: none` stops chat scroll jumping; dangerous-command patterns are whitespace-anchored (no more in-word false positives); rewind state resets on session compact; composer controls hide on small screens.
- **Dependencies**: `pi-*` packages updated to v0.83.0.

## [1.1.5] - 2026-08-02

- **Chat UI**: the composer model dropdown and message timestamps now show **vendor brand avatars** (OpenAI, Claude, Gemini, DeepSeek, Qwen, Grok, …). A new build-time script extracts SVG paths from `@lobehub/icons` into a generated icon table, and the webview renders a circular brand avatar per model via prefix matching on the model id (30+ vendors covered).
- **Chat UI**: replaced the composer control tooltips with **custom tooltip overlays** — smart positioning that flips below the target when there is no room above and clamps to the viewport edges.
- **Permission gate**: refined the default `dangerousPatterns` — added more destructive operations (`dd`, `Set-ItemProperty`/`Set-Acl`, `sed -e/-f` and `sed` in-place edits, `find -delete/-exec`, `sort -o`, `git branch -D/-m`, pipe-to-shell via `Invoke-WebRequest`/`irm`/`iwr`/`iex`, …) and fixed `taskkill`/`spps` detection, so more risky commands require approval out of the box.

## [1.1.4] - 2026-08-02

- **Chat UI**: the todo list widget above the composer is now **collapsible** — a chevron toggle remembers its expand/collapse state across renders, and the Clear action switched to a codicon glyph with tooltip and aria-label.
- **Chat UI**: added **inline session rename** to the chat panel toolbar — an edit icon opens a name field; Enter confirms, Escape cancels (the same handler now backs the `/name` command).
- **Chat UI**: cleaner icon-based presentation — thinking blocks and tool status (running/done/error) now use codicon glyphs instead of text labels, and tool blocks / widget cards dropped redundant borders and backgrounds.
- **Chat UI**: smarter tooltips — they flip below the target when there is no room above and clamp to the viewport edges; hover tooltips added to the toolbar buttons (rename, info, reload) and the todo toggle/clear controls.

## [1.1.3] - 2026-08-02

- **Rewind Code extension**: new bundled `rewind-code` extension lets you restore file changes together with a rewind. When rewinding to a historical message via `/tree`, you can now choose to rewind the message only or rewind the message **and** the code. File-level sha256 snapshots are captured around every `edit`/`write` tool call and stored under `~/.pi/snapshots` (no git dependency). In the webview chat panel this adds per-message **Accept / Revert** controls, a code toolbar action, and a live **changed-files widget** comparing current disk state to a baseline with line-level `+added` / `-removed` counts (`/fork` rewind is message-only — code restoration is triggered by `/tree`). Bash-only file changes are reported but not covered.
- **Chat UI**: replaced hand-drawn inline SVG icons with the bundled **codicon font** for crisp, consistent visuals across the chat panel.
- **Chat UI**: added **context-usage warning states** (subagent details auto-expand and warn near the context limit) and a **permission-mode indicator** in the composer.
- **Chat UI**: refined rewind / message interactions with cleaner codicon-based buttons and tooltips.
- **Permission gate**: significantly expanded the default `dangerousPatterns` to cover more destructive operations — whole-file/recursive deletes (`shred`, `rmdir /s`, `Remove-Item -Recurse`), disk/volume/registry terminal actions (`format`, `diskpart`, `vssadmin delete shadows`, `reg delete`), database resets (`drop table`, `truncate table`, `flushall`), shutdown/reboot, forced process kills (`taskkill /f`, `pkill`, `kill -9`), `git push --force`, pipe-to-shell patterns (`curl | sh`, `iex`), and more.

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
