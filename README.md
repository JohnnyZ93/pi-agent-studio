<div align="center">

<img src="https://github.com/user-attachments/assets/7cb43959-bb66-4dda-a0ab-f6706412ba72" alt="Pi VSCode Logo" width="120" height="120">

# Pi Agent Studio

**A feature-rich VS Code extension for the [pi coding agent](https://pi.dev/) - native terminal TUI or webview chat panel, full editor bridge, and bundled pi extensions (todo, subagent...) out of the box, plus a sessions sidebar and a full settings panel for models, agents, and more** 🔥

English | [简体中文](README.zh-CN.md)

</div>

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/johnny-zhao.pi-agent-studio?label=VS%20Code%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=johnny-zhao.pi-agent-studio)
[![Open VSX](https://img.shields.io/open-vsx/v/johnny-zhao/pi-agent-studio?label=Open%20VSX&color=purple)](https://open-vsx.org/extension/johnny-zhao/pi-agent-studio)
[![License](https://img.shields.io/github/license/JohnnyZ93/pi-agent-studio?color=orange&label=License)](https://github.com/JohnnyZ93/pi-agent-studio/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/JohnnyZ93/pi-agent-studio?style=social)](https://github.com/JohnnyZ93/pi-agent-studio)

## Features

- **Native terminal TUI** - Pi runs in a real VS Code integrated terminal (PTY). No shell layer, no quoting hacks - pi is spawned directly (default mode)
- **Webview chat panel** - Optional `webview` UI mode opens a streaming chat panel backed by a per-panel `pi --mode rpc` subprocess, with prompt queuing (Enter steer / Alt+Enter follow-up), input history, fork/revert, built-in commands, and retry
- **Model brand icons** — The chat panel shows circular vendor brand avatars (OpenAI, Claude, Gemini, DeepSeek, Qwen, Grok, …) next to the model dropdown in the composer and beside model names in message timestamps, matched by model id prefix (30+ vendors)
- **Mermaid & math rendering** — The webview chat panel renders `mermaid` code fences as interactive diagrams and math expressions (`$...$`, `$$...$$`) with KaTeX; diagram theme is configurable via `pi-agent-studio.chatMermaidTheme` (`default` / `neutral` / `dark` / `forest` / `base`)
- **Rewind code** - Rewind a historical message in `/tree` and optionally restore the file changes too, via the bundled `rewind-code` extension (file-level snapshots, Accept / Revert controls; `/fork` rewind is message-only)
- **MCP support** - Talk to Model Context Protocol servers (stdio or HTTP) configured in user/project scope: discover and call their tools/resources via `mcp_tool_search` / `mcp_tool_call`, expose prompts as `/mcp__<server>__<prompt>` slash commands, and manage connections live from the chat toolbar drawer or the `/mcp` command (start / stop / reconnect, idle disconnect)
- **Skills management** - Visual panel to create, edit, and delete pi skills (SKILL.md with YAML frontmatter) in user and project scopes
- **VS Code bridge** — Bundles a pi extension and local HTTP bridge for live editor data
- **Live VS Code footer status** — pi's terminal UI shows the active VS Code file, cursor/selection, language, dirty marker, and diagnostic counts in its bottom status area
- **Diagnostics tool** — The agent can read VS Code diagnostics (LSP / lint / type errors) on demand via `vscode_get_diagnostics`
- **Slash commands** — `/vscode-selection` and `/vscode-diagnostics` inject the current editor selection or diagnostics into the conversation, with the rest of the editor surface intentionally kept off-limits to the model
- **AI-powered Git commit messages** — Generate semantic commit messages from staged changes using pi, with support for 14 languages and custom prompt templates
- **Session restoration** — Per-workspace pi sessions are persisted and relaunched with `--session` after IDE reload
- **Full Settings panel** — One unified webview editor for everything: Models (Providers / OAuth / API Keys), Agents, Prompt Templates, Skills, MCP Servers (stdio/http with a transport selector), **Commit Message** (model / language / custom prompt), and Settings (inline `settings.json` editor + System Prompt Append/Override) — all backed by direct `~/.pi/agent/*.json` I/O. The Models tab exposes **advanced provider/model compatibility options**: per-model API protocol and base URL overrides, custom headers with env/command placeholders, OpenAI/Anthropic compatibility fields, cost tiers, and thinking levels
- **Localization** — The extension ships in **English and Simplified Chinese**: `pi-agent-studio.language` (`auto` follows the VS Code display language, or force `en` / `zh-cn`) localizes the manifest, sidebars, chat panel, settings panel, and commit message generator
- **Sidebar views** — `Sessions` (new/restore/switch) and a compact `Settings` sidebar (env info, upgrade, jump to the full panel)
- **Status bar / title bar buttons** — Pi button on the editor title bar for quick access
- **Auto-detection** — Finds the pi binary automatically from common paths (`~/.bun/bin`, `~/.local/bin`, `~/.npm-global/bin`; on Windows `%APPDATA%/npm`, `%LOCALAPPDATA%/pnpm`)

## Requirements

- **VS Code ≥ 1.100.0** (the extension engine requirement is `^1.100.0`)
- `pi` CLI installed:

  ```bash
  npm install -g --ignore-scripts @earendil-works/pi-coding-agent
  # or
  bun add -g --ignore-scripts @earendil-works/pi-coding-agent
  # or
  pnpm add -g --ignore-scripts @earendil-works/pi-coding-agent
  # or
  yarn global add --ignore-scripts @earendil-works/pi-coding-agent
  ```

- An API key (or OAuth credential) configured for at least one provider — manage them from the **Models** tab of the Settings panel

## Install

Available on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=johnny-zhao.pi-agent-studio) and [Open VSX](https://open-vsx.org/extension/johnny-zhao/pi-agent-studio):

```bash
# VS Code / Cursor
code --install-extension johnny-zhao.pi-agent-studio

# Open VSX (VSCodium, etc.)
ovsx get johnny-zhao/pi-agent-studio
```

## Commands

| Command                              | Keybinding    | Description                                                                                    |
| ------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------- |
| `Pi: Open`                           | `Alt+Shift+P` | Open or focus the pi terminal beside the editor                                                |
| `Pi: Open in New Window`             | —             | Open pi then move it to a new VS Code window                                                   |
| `Pi: Open Here`                      | —             | Open a pi terminal in the selected folder (via explorer context menu)                          |
| `Pi: Upgrade Pi`                     | —             | Upgrade pi via `pi update` (falls back to the inferred package manager when offline)           |
| `Pi: Open settings.json`             | —             | Open `~/.pi/agent/settings.json` in the editor (creates an empty `{}` if missing)              |
| `Pi: Open models.json`               | —             | Open `~/.pi/agent/models.json` in the editor (creates an empty `{ providers: {} }` if missing) |
| `Pi: Open Settings`                  | `Alt+Shift+,` | Open the full Settings panel (chat panel gear button and status bar item do the same)          |
| `Pi: Generate Commit Message`        | —             | Generate an AI-powered Git commit message from staged changes using pi                         |
| `Pi: Generate Commit Message - Stop` | —             | Abort an ongoing commit message generation                                                     |

The **Pi: Open** command is also wired to the editor title bar for one-click access.

## Sidebar

The **Pi** activity bar icon opens a sidebar with two webviews:

- **Sessions** - Per-workspace session list with live running/idle status icons; dropdown when multiple workspace folders exist
- **Settings** - Environment info, quick links, `Upgrade Pi` button, and a `Full Settings` jump button; when pi is missing it shows a first-run **onboarding card** with Node ≥ 22.19.0 / npm / pi checks, link-only install steps, and a restart hint (PATH changes apply on VS Code restart)

### Full Settings panel

The **Settings** sidebar's jump button (or the `Pi: Open Settings` command) opens a single-instance editor panel with seven tabs, each loading its data lazily:

- **Models** — three subtabs:
  - **Providers** — Add / rename / edit / delete custom providers in `~/.pi/agent/models.json`; per-provider `authHeader` toggle and custom headers (env/command placeholders), per-model API protocol / base URL overrides, OpenAI / Anthropic compatibility fields, **sampling parameters**, cost tiers and thinking-level maps
  - **OAuth** — Sign in to providers that support OAuth, managed through the bundled `AuthStorage`
  - **API Keys** — Manage stored API keys in `~/.pi/agent/auth.json`
- **Agents** - Manage user/project-level subagent definitions used by the bundled `subagent` tool
- **Prompt Templates** - Create / edit / delete / open pi prompt templates (markdown with YAML frontmatter) in user and project scopes
- **Skills** - Create / edit / delete pi skills (SKILL.md) in user and project scopes; external skills are shown read-only with an option to open the file
- **MCP Servers** - Add / edit / delete MCP server configs in user (`~/.pi/agent/mcp.json`) and project (`.pi/mcp.json`) scopes, merged into a single deduplicated list with source badges; an explicit **transport selector** (stdio / http) shows only the relevant fields — command/args/env/cwd for stdio, url/headers/bearerToken for http — plus per-server `directTools` configuration
- **Commit Message** — Configure the AI-generated commit message feature: model (`provider/model`), output language, and a custom prompt template, written straight to VS Code settings
- **Settings** — Two sections:
  - **System Prompt** — **Append** → `~/.pi/agent/APPEND_SYSTEM.md` (appended to pi's system prompt), **Override** → `~/.pi/agent/SYSTEM.md` (replaces pi's system prompt entirely)
  - **settings.json** — Inline editor for `pi-agent-studio.*` configuration, saved directly to VS Code settings
  - **pi settings** — including TUI mode (`regular` / experimental `fullscreen`), fullscreen scrollbar, and Mermaid rendering mode (`off` / `final` / `streaming`)

## Bridge: tools, slash commands, and footer status

Each pi terminal launched by the extension loads a bundled pi extension that opens a local HTTP bridge to VS Code. The bridge powers three things:

1. **Live footer status** - Refreshed every ~1.5s in pi's TUI status area: active file, cursor / selection, language id, dirty marker, and diagnostic counts. Disable with `pi-agent-studio.statusBar`.
2. **One LLM tool** - The agent can autonomously read VS Code diagnostics. Other actions are intentionally **not** exposed to the model. Disable individual tools via `pi-agent-studio.disabledTools`.
3. **Slash commands** — User-triggered commands that pull live editor context and inject it into the conversation as a user message.

> **Design note.** Earlier versions exposed 25 tools to the model. They were cut down to one: tool-spam pollutes context and tempts the model into making file edits behind the editor's back. The remaining live-editor surface is now driven by **explicit slash commands** so the human stays in control of when context flows in.

### Bundled bridge extensions

Beyond the editor bridge, the extension bundles a few pi extensions that add agent-facing tools and commands (disable any via `pi-agent-studio.disabledTools`):

- **todo** - a `todo` LLM tool with a live list widget above the composer, plus `/todos` and `/todo-clear` commands
- **questionnaire** - lets the agent ask structured questions (rendered as a native web form in webview mode)
- **subagent** - delegate tasks to specialized agents (`explore`, `general`, plus your own); managed from the **Agents** tab of the Settings panel
- **permission-gate** - intercepts dangerous bash commands (matching `pi-agent-studio.permission.dangerousPatterns`, e.g. `rm -rf`, `sudo`) and requires approval before execution; switch per session via `/permission`
- **rewind-code** - file-level content snapshots that let you rewind a historical message via `/tree` and optionally restore its code changes (message-only on `/fork`); in the webview panel it drives a live changed-files widget with Accept / Revert
- **btw** - `/btw` asks a question without altering the main conversation context
- **mcp** - connects configured MCP servers (stdio or StreamableHTTP→SSE) at session start, registers their tools/prompts into pi, and powers the MCP server drawer in the chat toolbar (managed from the **MCP Servers** tab of the Settings panel; enable/disable via `pi-agent-studio.mcp.enabled`)

### LLM tool (1)

| Tool                     | What it returns                                                                  |
| ------------------------ | -------------------------------------------------------------------------------- |
| `vscode_get_diagnostics` | VS Code diagnostics (LSP / lint / type errors) for a file or the whole workspace |

Accepts an optional `filePath` (absolute or workspace-relative). With no argument it returns diagnostics for the whole workspace.

### Slash commands (2)

Type these inside the pi terminal. Each command resolves arguments from the **current VS Code state** when omitted, calls the bridge, and injects the JSON result back into the conversation as a user message (so the model sees it and can react).

| Command                                     | Arguments                           | Behavior                                                                                                                                                  |
| ------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/vscode-selection [intent?]`               | optional free-text intent           | Returns the current editor selection (text, file path, coordinates). Trailing text is treated as the user's intent and prepended to the injected message. |
| `/vscode-diagnostics [filePath?] [intent?]` | optional file path, optional intent | Returns diagnostics for `filePath`, or for the active editor when omitted. Non-path tokens are treated as intent.                                         |

Example:

```text
/vscode-selection explain this regex
/vscode-diagnostics src/extension.ts why is this failing?
/vscode-diagnostics                 # → diagnostics for the currently active editor
```

### Notes

- Slash command arguments use a simple heuristic: a token containing `/`, `\`, or `.` is treated as a file path; everything else is treated as free-text intent.
- File paths can be absolute or workspace-relative.
- The bridge RPC layer (`src/bridge/handlers.ts`) still implements the full set of editor operations (selection, symbols, definitions, references, hover, code actions, formatting, workspace edits, save, notifications, …). They are reachable from the bundled bridge but **not** registered as LLM tools or slash commands today — reserved for future explicit commands.
- Oversized bridge results are capped; when a response exceeds the limit, the tool returns a valid JSON wrapper with `truncated: true`, original size metadata, and a `resultJsonPrefix` preview.

## Configuration

| Setting                                        | Type      | Default            | Description                                                                                                   |
| ---------------------------------------------- | --------- | ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `pi-agent-studio.path`                         | `string`  | `""`               | Absolute path to the pi binary (auto-detected if empty)                                                       |
| `pi-agent-studio.bridgeSocket`                 | `string`  | `""`               | Bridge endpoint: empty = random port; number = fixed port; else socket path (Windows: named pipe), {windowId} |
| `pi-agent-studio.language`                     | `string`  | `"auto"`           | UI language: `auto` (follows the VS Code display language), `en`, or `zh-cn`                                  |
| `pi-agent-studio.env`                          | `object`  | `{}`               | Environment variables merged into the pi terminal (bridge vars win on key collision)                          |
| `pi-agent-studio.args`                         | `array`   | `[]`               | Extra CLI args appended after `--extension` and before any caller-supplied extra args                         |
| `pi-agent-studio.commitLanguage`               | `string`  | `"English"`        | Language for generated Git commit messages (14 languages supported)                                           |
| `pi-agent-studio.commitMessagePrompt`          | `string`  | `""`               | Custom system prompt for commit message generation                                                            |
| `pi-agent-studio.commitModel`                  | `string`  | `""`               | Model used for commit message generation, in `provider/model` format (e.g. `Zai/glm-5.2`)                     |
| `pi-agent-studio.statusBar`                    | `boolean` | `true`             | Show live VS Code context (editor, selection, diagnostics) in the pi TUI footer                               |
| `pi-agent-studio.ui`                           | `string`  | `"terminal"`       | UI for `Pi: Open`: `terminal` (TUI) or `webview` (chat panel)                                                 |
| `pi-agent-studio.disabledTools`                | `array`   | `[]`               | Bundled LLM tools to disable: `vscode_get_diagnostics`, `todo`, `questionnaire`, `subagent`                   |
| `pi-agent-studio.rpcTrace`                     | `boolean` | `false`            | Log RPC traffic and pi stderr to the "Pi Chat RPC" output channel                                             |
| `pi-agent-studio.permission.mode`              | `string`  | `"AskForApproval"` | Gate dangerous bash commands: `AskForApproval` (prompt before execution) or `FullAccess`                      |
| `pi-agent-studio.permission.dangerousPatterns` | `array`   | see "package.json" | Regexes matching dangerous bash commands that require approval (case-insensitive; replaces defaults entirely) |
| `pi-agent-studio.chatFontSize`                 | `number`  | `13`               | Font size of the webview chat panel (range 8–32)                                                              |
| `pi-agent-studio.chatMermaidTheme`             | `string`  | `"default"`        | Mermaid diagram theme for the webview chat panel (`default` / `neutral` / `dark` / `forest` / `base`)         |
| `pi-agent-studio.mcp.enabled`                  | `boolean` | `true`             | Load the bundled MCP bridge extension (exposes configured MCP servers' tools/resources/prompts to pi)         |
| `pi-agent-studio.mcp.idleTimeout`              | `number`  | `10`               | Minutes before idle MCP servers disconnect (cached metadata keeps `mcp_tool_search` working); `0` disables    |

## Building from source

```bash
pnpm install
pnpm build         # rolldown bundle → dist/extension.cjs
pnpm package       # builds + vsce package --no-dependencies
pnpm install-local # package + install into local VS Code
```

Useful dev commands:

- `pnpm dev` — rolldown watch mode
- `pnpm fmt` — `oxlint --fix` + `oxfmt`
- `pnpm lint` — `oxlint . && oxfmt --check .`
- `pnpm typecheck` — `tsgo --noEmit --skipLibCheck`
- `pnpm vitest run` — run the test suite

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

## License

[MIT](./LICENSE)
