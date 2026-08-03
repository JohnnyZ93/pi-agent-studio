# AGENTS.md

This file provides guidance to Code Agent when working with code in this repository.

**Always keep AGENTS.md updated with project status.**

## Build & Run

- pnpm workspace: root `pnpm-workspace.yaml` declares `pi-chat` as the only member; **single root `pnpm-lock.yaml`** (no lockfile/workspace file inside `pi-chat/`). `pnpm install` at root installs both packages. Builds use `pnpm --filter pi-chat ...` (e.g. `build`), not `--dir`. `onlyBuiltDependencies: [esbuild]` lives in the root `pnpm-workspace.yaml`.
- `pnpm build` / `pnpm dev` (watch) / `pnpm package` (builds + `vsce package --no-dependencies`)
- `pnpm fmt` — auto-fix with `oxlint --fix` + `oxfmt`
- `pnpm lint` — `oxlint . && oxfmt --check .`
- `pnpm typecheck` — `tsgo --noEmit --skipLibCheck` (Microsoft TypeScript Native Preview, NOT `tsc`)
- `pnpm test` — runs `lint && typecheck` only. **`vitest` is installed but not wired into `pnpm test`**; run it directly: `pnpm vitest run`
- `pnpm install-local` — package and install the `.vsix` into local VS Code
- `pnpm release [major|minor|patch]` — bumps `package.json`, packages, commits, tags, pushes (CI publishes). Add `--local` to publish via `vsce`/`ovsx` from the dev machine
- Always run `pnpm fmt` **and** `pnpm typecheck` before finalizing changes

## Architecture Overview

Three cooperating pieces, no framework:

1. **VS Code extension host** (`src/extension.ts` → `dist/extension.cjs`) — Activates `onStartupFinished`, registers commands/views/status bar, owns the local bridge lifecycle.
2. **Local HTTP bridge** (`src/bridge/*`) — `createBridge` boots a localhost server with a per-session auth token. URL+token are injected as `PI_VSCODE_BRIDGE_URL` / `PI_VSCODE_BRIDGE_TOKEN` env vars into every pi terminal, alongside a per-terminal `PI_VSCODE_TERMINAL_ID`. Handlers serve RPC calls for editor state, diagnostics, symbols, definitions, hovers, references, code actions, formatting, and workspace edits.
3. **Bundled pi extension** (`bridge/pi-vscode-bridge.js`) — Loaded into every pi launch via `--extension <path>`. Registers `vscode_*` tools that call the bridge over HTTP. Also refreshes `ctx.ui.setStatus("pi-vscode", ...)` every ~1.5s so pi's TUI footer reflects live VS Code context.

Terminal launch flow (`src/terminal.ts` + `src/pi.ts`):

- Pi is spawned **directly** by VS Code's terminal: `shellPath = piPath`, `shellArgs = piArgs`.
- Implication for `pi-agent-studio.path`: point it at whatever pi shim works in your environment. On Windows nvm4w/npm setups, `pi.cmd` runs via cmd, `pi.ps1` via PowerShell — both fine.
- For short-lived child processes (`pi --version` in `settings-env.ts`, package-manager probes in `upgrade.ts`), use plain `execFile(piPath, args, ...)`. On Windows `child_process.execFile` runs `.cmd`/`.bat` via cmd internally when the path has that extension — no manual shell wrapping required for the current pi shims.
- Bridge extension is appended via `--extension bridge/pi-vscode-bridge.js`. User extra args (`pi-agent-studio.args`) and user env (`pi-agent-studio.env`) are merged in; bridge env wins on key collision.

Session restoration (`src/sessions.ts`):

- On `session_start`, the bundled bridge RPCs `reportTerminalSession({terminalId, sessionFile})`. The tracker persists `{terminalId → sessionFile}` to `workspaceState["pi-agent-studio.terminalSessions"]`.
- On activation, each stored entry (whose `sessionFile` still exists on disk) is relaunched with `--session <sessionFile>` so conversations survive IDE reload. Terminals closed by the user (non-`Shutdown` exit reason) are pruned from the map; missing-on-disk entries are also pruned on restore.
- The tracker also keeps an in-memory `terminalsById: Map<terminalId, vscode.Terminal>` so the Sessions sidebar can call `findTerminalBySessionFile(sessionFile)` and **reuse** an already-open terminal instead of spawning a duplicate. The Sessions sidebar header has a `+` button that delegates to `pi-agent-studio.open` for blank-session creation.

CJS wrapper pattern: source is ESM (`"type": "module"`), bundled by rolldown → `dist/extension.cjs` (CJS, `external: vscode`, minified). VS Code's `require()` loader works because the output is CJS.

Sidebar views (all webview, registered under `pi` activity container):

- **Sessions** (`src/sessions/`) - Per-workspace session list; dropdown when multiple workspace folders exist (lazy per-folder fetch). The Sessions sidebar header has a `+` button that opens a folder picker (or workspace root when single); clicking it or a session row calls `openNewSessionInDir` / `openSession` (`sessions-sidebar.ts`), both of which branch on `pi-agent-studio.ui`: `webview` -> `openChatPanel({ cwd })` / `openChatPanel({ sessionFile })`; `terminal` -> `createNewTerminal` with `--session <file>` / cwd.
- **Models** (`src/models/`) — Three tabs: Providers (CRUD), OAuth, API Keys. Reads/writes `~/.pi/agent/models.json` and `auth.json` through `models-config.ts` / `auth-config.ts` using **pure Node.js fs** to bypass pi SDK's shell-dependent APIs (`EINVAL` on Windows without bash).
- **Settings** (`src/settings/`) - Env info, links, `Upgrade Pi` button, `Open settings.json`, and two textareas: **Append** (`~/.pi/agent/APPEND_SYSTEM.md`) and **Override** (`~/.pi/agent/SYSTEM.md`). Pi auto-loads these via its `DefaultResourceLoader`, so no CLI flags are injected. Default `visibility: collapsed`. Node version shown in the env block is the Node that **actually runs pi**, not the extension host: `detectNodeVersion` (`settings-env.ts`) realpaths `piPath`, looks for `node`/`node.exe` in the same directory (matches nvm/nvm4w/bun/pnpm layouts), then `execFile`s `-p process.versions.node`. Falls back to `process.version + " (extension host)"` when no sibling node is found - do NOT replace this with `process.version`, that returns VS Code's bundled Node (e.g. v24) and misleads nvm users.
- Packages sidebar (`src/packages.ts`) exists in source but is **not** registered in `package.json` views - code is currently dormant; verify before referencing.

### Webview chat mode (`src/chat/`, RPC)

When `pi-agent-studio.ui == "webview"`, `Pi: Open` (`pi-agent-studio.open`), `Pi: Open Here` (`openInFolder`), and `Pi: Open in New Window` (`openInNewWindow`) each branch on `useWebviewUi()` to open a **WebviewPanel** (`openChatPanel`) instead of a terminal. A `pi --mode rpc` subprocess is spawned **per panel** (`src/chat/rpc-client.ts`) and spoken to over JSONL (strict LF framing, no `readline`). `openChatPanel` accepts an optional `cwd` (used as the spawn working dir and shown in the toolbar as `{shortened-cwd} ({git-branch}) • {sessionName}`; branch fetched once via `getGitBranch` in `gitUtils.ts`, detached HEAD omitted). The webview (`chat-html.ts`, inline HTML/JS) renders streamed `message_update` deltas (text/thinking/toolcall by `contentIndex`), `tool_execution_start/update/end`, and hydrates from `get_messages` on restore. Controls call `set_model` / `set_thinking_level` / `get_available_models` / `get_available_thinking_levels` / `get_commands` (slash autocomplete).

Key invariants:

- Both terminal and RPC modes load **two** pi extensions via repeated `--extension`: `bridge/pi-vscode-bridge.js` (VS Code editor/diagnostics bridge + status footer) and `bridge/todo.ts` (the `todo` LLM tool, live widget, `/todos` + `/todo-clear` commands). `createRpcShellArgs`/`createRpcEnvironment` (`src/pi.ts`) are the RPC counterparts of the terminal `createPiShellArgs`/`createPiEnvironment`; both inject `PI_VSCODE_BRIDGE_*` env, including `PI_VSCODE_DISABLED_TOOLS`, which gates bridge tools (`vscode_*`) **and** the `todo` tool (env absent => todo enabled, so `bridge/todo.ts` stays reusable in plain pi). The `todo` tool is listed in the `pi-agent-studio.disabledTools` setting enum.
- `handleExtUiRequest` in `chat-panel.ts` forwards `extension_ui_request` `setWidget` (todo's live list above the composer) to the webview; the webview renders it (`chat-html.ts` `applyWidget`) and its Clear button posts `todoClear` back, which calls `rpc.prompt("/todo-clear", streaming ? "steer" : undefined)`. Other fire-and-forget methods (`notify`, `setStatus`, `setTitle`) are still ignored. In TUI mode the widget uses `ctx.ui.setWidget` with a component factory; in RPC mode `bridge/todo.ts` passes plain string lines (component factories are unsupported in RPC).
- Session persistence: `ChatTracker` (`chat-tracker.ts`) writes `workspaceState["pi-agent-studio.chatSessions"]` = `{panelId -> sessionFile}`. Restore reopens panels with `--session <file>` (falling back to `switch_session` if `get_state` shows the wrong session) and re-hydrates via `get_messages`. `sessionFile` is captured from `get_state` right after spawn and re-checked on `agent_settled` (it may be null until the first turn).
- Panels are tracked in an in-memory registry (`activePanels` / `sessionToPanel`) so reopening the same session focuses its existing panel. `disposeAllChatPanels()` is called from `deactivate()`. Each panel disposes its RPC child (taskkill `/T /F` on Windows).
- `retainContextWhenHidden: true` so streaming/scroll state survives tab switches.

## Critical Patterns

- **Pi binary resolution** (`src/_resolve.ts`): workspace `node_modules/.bin/pi` → known global dirs (`~/.bun/bin`, `~/.local/bin`, `~/.npm-global/bin`; on Windows `%APPDATA%/npm`, `%LOCALAPPDATA%/pnpm`) → PATH → fallback `"pi"`. On Windows, **explicit `customPath` is respected as-is when the file exists**. Only when the configured path is missing do we probe `.exe` → `.cmd` → `.ps1` (auto-detect on workspace/global/PATH lookups also uses that order, so the default lands on `.cmd` which VS Code spawns cleanly). Use `F_OK` not `X_OK` on Windows. `piExistsCache` (in `src/pi.ts`) is invalidated by `invalidatePiBinaryCache()` — wired to `onDidChangeConfiguration("pi-agent-studio.path")` and to the post-install prompt branch.
- **Models Providers tab** uses event delegation with `data-action`/`data-id` (no inline `onclick` string concatenation — broke on dashes/quotes in ids). Renames combine with field updates into a single `renameProviderAndUpdate` message so they apply atomically. Empty-string fields are sent as `null` and converted to `undefined` so `JSON.stringify` drops them.
- **OAuth flow** (`src/models/oauth-flow.ts`) mirrors pi-web's `app/api/auth/login/[provider]/route.ts`: drives `AuthStorage.login()` with a shared memoized "manual input" request so `onAuth` / `onPrompt` / `onManualCodeInput` resolve the same promise. **Let `AuthStorage.login()` persist credentials itself** — do NOT write a placeholder credential afterwards (corrupts the SDK-managed entry).
- **Permission gate** (`bridge/permission-gate.ts`): gates bash commands via `AskForApproval`/`FullAccess` modes. Config `pi-agent-studio.permission.mode` (default AskForApproval) + `permission.dangerousPatterns` (case-insensitive regexes; user config fully replaces defaults.
