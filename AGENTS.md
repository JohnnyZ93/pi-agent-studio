# AGENTS.md

This file provides guidance to Code Agent when working with code in this repository.

**Always keep AGENTS.md updated with project status.**

## Build & Run

- pnpm workspace: root `pnpm-workspace.yaml` declares `pi-chat` as the only member; **single root `pnpm-lock.yaml`** (no lockfile/workspace file inside `pi-chat/`). Builds use `pnpm --filter pi-chat ...` (e.g. `build`), not `--dir`. `onlyBuiltDependencies: [esbuild]` lives in the root `pnpm-workspace.yaml`.
- `pnpm build` — `pnpm --filter pi-chat build` (vite + model-icons extract) **then** `rolldown -c rolldown.config.ts`. `pnpm dev` watches **only** the rolldown bundle; pi-chat source changes are NOT picked up — run `pnpm --filter pi-chat build` separately.
- `pnpm fmt` (auto-fix) / `pnpm lint` / `pnpm typecheck` — oxlint + oxfmt, oxfmt --check, and `tsgo` (TypeScript Native Preview, NOT `tsc`).
- `pnpm test` — runs `lint && typecheck` only. **`vitest` is not wired in**; run directly: `pnpm vitest run` or a single file: `pnpm vitest run test/resolve.test.ts`.
- Bridge extensions (`bridge/**/*.ts`) are **not** covered by `pnpm typecheck`. Use `./typecheck.sh [bridge/foo.ts]` — it generates a throwaway tsconfig against the **globally installed** `@earendil-works/pi-coding-agent` (`npm root -g`); there is no local package.json/tsconfig for bridge/. See `pi-extension-typecheck.md`.
- `pnpm package` (builds + `vsce package --no-dependencies`), `pnpm install-local` (package + install `.vsix` into local VS Code).
- `pnpm release [major|minor|patch]` — bumps `package.json`, packages, commits, tags, pushes (CI publishes). Add `--local` to publish via `vsce`/`ovsx` from the dev machine.
- Always run `pnpm fmt` **and** `pnpm typecheck` before finalizing changes.

## Architecture Overview

Three cooperating pieces, no framework:

1. **VS Code extension host** (`src/extension.ts` → `dist/extension.cjs`) — Activates `onStartupFinished`, registers commands/views/status bar, owns the local bridge lifecycle.
2. **Local HTTP bridge** (`src/bridge/*`) — `createBridge` boots a localhost server with a per-session auth token. URL+token are injected as `PI_VSCODE_BRIDGE_URL` / `PI_VSCODE_BRIDGE_TOKEN` env vars into every pi launch, alongside a per-terminal `PI_VSCODE_TERMINAL_ID`. Handlers serve RPC calls for editor state, diagnostics, symbols, definitions, hovers, references, code actions, formatting, and workspace edits.
3. **Bundled pi extensions** — **seven**, loaded via repeated `--extension` (paths in `src/constants.ts`): `pi-vscode-bridge.js` (vscode_* tools + TUI footer status), `todo.ts`, `questionnaire.ts`, `subagent/index.ts` (spawns separate `pi` processes per invocation, JSON mode; max 8 parallel/4 concurrent), `btw.ts` (`/btw` quick-question command, not an LLM tool), `permission-gate.ts`, `rewind-code.ts`.

Terminal launch flow (`src/terminal.ts` + `src/pi.ts`):

- Pi is spawned **directly** by VS Code's terminal: `shellPath = piPath`, `shellArgs = piArgs`. `pi-agent-studio.path` must point at whatever pi shim works in your environment (on Windows nvm4w/npm, `pi.cmd` via cmd, `pi.ps1` via PowerShell — both fine).
- For short-lived child processes (`pi --version` in `settings-env.ts`, package-manager probes in `upgrade.ts`), use plain `execFile(piPath, args, ...)` — on Windows it runs `.cmd`/`.bat` via cmd internally, no manual shell wrapping.
- User extra args (`pi-agent-studio.args`) and user env (`pi-agent-studio.env`) are merged in; bridge env wins on key collision.
- `PI_VSCODE_DISABLED_TOOLS` (JSON list) gates the `vscode_*` tools **and** `todo`/`questionnaire`/`subagent` — each extension reads the env var and checks its own name itself (env absent ⇒ enabled, keeping the files reusable in plain pi). `btw` is NOT gateable (command, not tool).

Session restoration (`src/sessions.ts` + `session-status-registry.ts`):

- On `session_start`, the bundled bridge RPCs `reportTerminalSession({terminalId, sessionFile})`. The tracker persists `{terminalId → sessionFile}` to `workspaceState["pi-agent-studio.terminalSessions"]`.
- On activation, stored entries whose `sessionFile` still exists are relaunched with `--session <sessionFile>`. Terminals closed by the user (non-`Shutdown` exit reason) and missing-on-disk entries are pruned. `session-status-registry.ts` keeps a shared running/idle status map that both terminal and chat sources upsert into (powers sidebar indicators; `onClose` removes entries).
- The tracker keeps an in-memory `terminalsById` so the Sessions sidebar can **reuse** an already-open terminal instead of spawning a duplicate. Sidebar `+` button delegates to `pi-agent-studio.open` for blank-session creation.

CJS wrapper pattern: source is ESM (`"type": "module"`), bundled by rolldown → `dist/extension.cjs` (CJS, `external: vscode`, minified). VS Code's `require()` loader needs CJS output; `?raw` imports are inlined by `rawPlugin` in `rolldown.config.ts`.

Sidebar views (all webview, registered under `pi` activity container):

- **Sessions** (`src/sessions/`) — Per-workspace session list with client-side search (`session-search.ts`); dropdown when multiple workspace folders exist. Rows and the `+` button branch on `pi-agent-studio.ui`: `webview` -> `openChatPanel({ cwd })` / `openChatPanel({ sessionFile })`; `terminal` -> `createNewTerminal` with `--session <file>` / cwd.
- **Models** (`src/models/`) — Three tabs: Providers (CRUD), OAuth, API Keys. Reads/writes `~/.pi/agent/models.json` and `auth.json` through `models-config.ts` / `auth-config.ts` using **pure Node.js fs** to bypass pi SDK's shell-dependent APIs (`EINVAL` on Windows without bash).
- **Agents** (`src/agents/`) — CRUD over agent files from three sources: builtin `bridge/agents/*.md`, user `~/.pi/agent/agents`, project `.pi/agents` (frontmatter-parsed via `parseFrontmatter`, written as YAML). The `subagent` tool discovers the same three dirs, with the builtin dir injected as `PI_VSCODE_BUILTIN_AGENTS_DIR`.
- **Prompt Templates** (`src/prompts/`) — Lists prompts via `DefaultResourceLoader` (constructed with `noExtensions/noSkills/noThemes/noContextFiles`) and writes user `~/.pi/agent/prompts` / project `.pi/prompts` (`prompts-config.ts`).
- **Settings** (`src/settings/`) - Env info, links, `Upgrade Pi` button, and two textareas: **Append** (`~/.pi/agent/APPEND_SYSTEM.md`) and **Override** (`~/.pi/agent/SYSTEM.md`) — pi auto-loads these via its `DefaultResourceLoader`, so no CLI flags are injected. Default `visibility: collapsed`. The Node version shown is the Node that **actually runs pi**, not the extension host: `detectNodeVersion` (`settings-env.ts`) realpaths `piPath` and probes a sibling `node`/`node.exe` — do NOT replace with `process.version` (returns VS Code's bundled Node, e.g. v24, misleading nvm users).
- Packages sidebar (`src/packages.ts`) exists in source but is **not** registered in `package.json` views — dormant; verify before referencing.

Other extension-host features:

- **Git commit messages** (`src/gitCommit/`) — SCM title button "Generate Commit Message with Pi". Uses pi SDK `createAgentSession` + git CLI (`gitUtils.ts`); configurable via `commitModel` (`provider/model` pattern), `commitLanguage`, `commitMessagePrompt`; diff truncated at 64KB. Abort via `abortCommitGeneration` (sets `pi-agent-studio.isGeneratingCommit` context).

### Webview chat mode (`src/chat/` + `pi-chat/`)

When `pi-agent-studio.ui == "webview"`, `Pi: Open` / `Open Here` / `Open in New Window` each branch on `useWebviewUi()` to open a **WebviewPanel** (`openChatPanel`), spawning a `pi --mode rpc` subprocess **per panel** (`src/chat/rpc-client.ts`) over JSONL (strict LF framing, no `readline`). `openChatPanel` accepts an optional `cwd` (spawn working dir; toolbar shows `{shortened-cwd} ({git-branch}) • {sessionName}`, branch fetched once via `getGitBranch` in `gitUtils.ts`, detached HEAD omitted).

The chat UI is a **Vite subproject** (`pi-chat/`), not inline TS: `pnpm --filter pi-chat build` runs `extract-model-icons.mjs` (generates gitignored `pi-chat/src/model-icons-data.ts` from `@lobehub/icons`) then vite singlefile build; `copy-dist.mjs` copies the result to `src/chat/chat-dist.html` (gitignored), which the extension inlines via `import chatHtml from "./chat-dist.html?raw"` (`chat-webview.ts`). Both generated files are gitignored — a fresh clone must run `pnpm build` before chat code typechecks/works, and webview UI changes require the pi-chat build step (not just rolldown) to take effect.

RPC-mode UI wiring (`chat-panel.ts` `handleExtUiRequest`): `select`/`confirm`/`input`/`editor` extension UI requests are forwarded to the webview as `dialog` (questionnaire; `btw` abort confirm is special-cased via `BTW_ABORT_TITLE`), `setWidget` is forwarded with `widgetKey` + `widgetLines` (todo list, btw answer card, rewind accept/revert — rendered in `pi-chat/src/composer.ts` / `rewind.ts`), `notify` becomes a toast. Other fire-and-forget methods (`setStatus`, `setTitle`) are ignored. Clear-button and accept/revert interactions post `todoClear` / `rewindAccept` back, which call `rpc.prompt("/todo-clear", streaming ? "steer" : undefined)` etc. In TUI mode the same extensions use `ctx.ui.setWidget` with component factories; in RPC mode plain string lines only (component factories unsupported).

Session persistence: `ChatTracker` (`chat-tracker.ts`) writes `workspaceState["pi-agent-studio.chatSessions"]` = `{panelId -> sessionFile}`. Restore reopens panels with `--session <file>` (falling back to `switch_session` if `get_state` shows the wrong session) and re-hydrates via `get_messages`. `sessionFile` is captured from `get_state` right after spawn and re-checked on `agent_settled` (it may be null until the first turn). Panels are tracked in `activePanels` / `sessionToPanel` so reopening focuses the existing panel; `disposeAllChatPanels()` runs on `deactivate()`; each panel kills its RPC child (`taskkill /T /F` on Windows). `retainContextWhenHidden: true` preserves streaming/scroll state across tab switches.

## Critical Patterns

- **Pi binary resolution** (`src/_resolve.ts`): workspace `node_modules/.bin/pi` → known global dirs (`~/.bun/bin`, `~/.local/bin`, `~/.npm-global/bin`; on Windows `%APPDATA%/npm`, `%LOCALAPPDATA%/pnpm`) → PATH → fallback `"pi"`. On Windows, **explicit `customPath` is respected as-is when the file exists** (e.g. an extensionless nvm4w bash shim must NOT be silently upgraded to `.cmd` — the shell layer would flip from git-bash to cmd.exe); only when missing do we probe `.exe` → `.cmd` → `.ps1`. Use `F_OK` not `X_OK` on Windows. `piExistsCache` (in `src/pi.ts`) is invalidated via `invalidatePiBinaryCache()` — wired to `onDidChangeConfiguration("pi-agent-studio.path")` and the post-install prompt branch.
- **Models Providers tab** uses event delegation with `data-action`/`data-id` (no inline `onclick` string concatenation — broke on dashes/quotes in ids). Renames combine with field updates into a single `renameProviderAndUpdate` message so they apply atomically. Empty-string fields are sent as `null` and converted to `undefined` so `JSON.stringify` drops them.
- **OAuth flow** (`src/models/oauth-flow.ts`) mirrors pi-web's `app/api/auth/login/[provider]/route.ts`: drives `AuthStorage.login()` with a shared memoized "manual input" request so `onAuth` / `onPrompt` / `onManualCodeInput` resolve the same promise. **Let `AuthStorage.login()` persist credentials itself** — do NOT write a placeholder credential afterwards (corrupts the SDK-managed entry).
- **Permission gate** (`bridge/permission-gate.ts`): gates bash commands via `AskForApproval`/`FullAccess` modes; config `pi-agent-studio.permission.mode` + `permission.dangerousPatterns` (case-insensitive regexes; user config fully replaces defaults). **Default pattern convention: option flags must be whitespace-anchored (`\s+-xxx`), never bare `.*-xxx`** — in-word matches like `chat-panel` or `auto-delete` would false-positive.
- **rewind-code** (`bridge/rewind-code.ts`): file-level sha256 snapshots stored under `~/.pi/snapshots/{sessionId}/{hash}` (no git dependency; deduped and aggregated by the owning user-message entryId). `/tree` rewind offers "message only" vs "message + code"; `/fork` rewind is message-only. `bash` in-place file edits are out of scope (no path in tool input) — notify the user they aren't covered. Widget maintains a per-file baseline ("last accept point"); Accept moves it forward, Revert restores the baseline snapshot; state resets on session compact.
- **pi-chat codicons are a manual subset** (`pi-chat/src/style.css`): the webview does NOT import `@vscode/codicons/dist/codicon.css`; `pi-chat/src/main.ts` injects only the `@font-face` for `codicon.ttf`. Each `.codicon-xxx::before { content: "\eXXX" }` glyph mapping is hand-defined in `style.css` — any new `codicon-xxx` class used in `pi-chat/` (HTML or TS-generated markup) needs its `::before` rule added (codepoint from `@vscode/codicons/dist/codicon.css`) or the icon renders blank. Currently defined: `discard, check, add, send, debug-stop, checklist, info, refresh, edit, copy, repo-forked, chevron-right, chevron-down, shield, unlock, clear-all, star-full, star-empty`. (Extension-host sidebars are unaffected — they get codicons from the VS Code runtime.)
- **Icon font** (`assets/fonts/pi-icons.woff2`): generated from `assets/logo.svg` with fantasticon; `contributes.icons.pi-logo.fontCharacter` in `package.json` must match the emitted glyph code in `assets/fonts/pi-icons.json`. Full rebuild instructions (incl. the counter-clockwise inner-hole winding requirement) in `.agents/docs/icons.md`.
- **Vitest suite is stale** (not wired into CI — `ci.yml` runs lint/typecheck/package only): `test/resolve.test.ts` `createPiGlobalInstallCommand` expectations still expect the old `--global …@latest` format, and `test/work-block-title.test.ts` imports `src/chat/chat-html.ts`, renamed to `chat-webview.ts` when the chat UI moved to the pi-chat subproject. Refresh these when touching `upgrade.ts` or the chat UI.
