import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import * as vscode from "vscode";
import type { BridgeConfig } from "../bridge/types.ts";
import { createRpcEnvironment, createRpcShellArgs, ensurePiBinary } from "../pi.ts";
import { getGitBranch } from "../gitCommit/gitUtils.ts";
import { readEnabledModelKeys, toggleFavoriteModel } from "../settings/settings-config.ts";
import { getChatWebviewHtml } from "./chat-webview.ts";
import { getLocale, t } from "../i18n.ts";
import type { ChatTracker } from "./chat-tracker.ts";
import type { ExtensionUiRequest, RpcClient, RpcEvent, RpcSessionStats } from "./chat-types.ts";
import { createRpcClient } from "./rpc-client.ts";
import { mergeBuiltinCommands, parseBuiltin } from "./builtin-commands.ts";
import { readPiChangelog } from "./pi-changelog.ts";
import { sessionStatusRegistry } from "../session-status-registry.ts";

const BG_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
};
const MAX_BG_SIZE = 10 * 1024 * 1024;

function resolveChatBackground(_webview: vscode.Webview, path?: string): string {
  if (!path || !isAbsolute(path)) return "";
  let st;
  try {
    st = statSync(path);
  } catch {
    return "";
  }
  if (!st.isFile() || st.size === 0 || st.size > MAX_BG_SIZE) return "";
  const mime = BG_MIME[extname(path).toLowerCase()];
  if (!mime) return "";
  try {
    const buf = readFileSync(path);
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

export interface ChatSessionUpdate {
  rename?: string;
}

export interface ChatPanelHandle {
  view: vscode.WebviewView;
  rpc: RpcClient;
  panelId: string;
  sessionFile?: string;
  sync?: (opts: ChatSessionUpdate) => void;
  /** Switch the live RPC session to `sessionFile` and re-hydrate the view. */
  switchToSession?: (sessionFile: string) => Promise<void>;
}

export interface OpenChatPanelOptions {
  extensionUri: vscode.Uri;
  bridgeConfig?: BridgeConfig;
  tracker: ChatTracker;
  sessionFile?: string;
  panelId?: string;
  cwd?: string;
}

// The webview chat UI is a single sidebar view (`pi-agent-studio.chat`), so
// there is exactly one live handle at a time. `pendingOpen` carries an open
// request that arrives before the view has been resolved (e.g. a command that
// focuses the view); it is consumed by `resolveWebviewView`.
let activeHandle: ChatPanelHandle | undefined;
let pendingOpen: OpenChatPanelOptions | undefined;

/** Marker prefix the MCP bridge emits before a structured status JSON payload. */
const MCP_STATUS_MARKER = "__mcp_status__";

const CHAT_VIEW_TYPE = "pi-agent-studio.chat";
const BTW_ABORT_TITLE = "Pi Btw Abort";
const DIFF_PANEL_TITLE = "Pi Diff";

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  let t = "";
  for (const block of content) {
    if (typeof block === "string") t += block;
    else if (
      block &&
      typeof block === "object" &&
      block.type === "text" &&
      typeof block.text === "string"
    )
      t += (t ? "\n" : "") + block.text;
  }
  return t;
}

function openRewindDiff(msg: {
  absPath: string;
  baselineHash: string | null;
  sessionId: string;
  basename: string;
}): void {
  const left = msg.baselineHash
    ? vscode.Uri.parse(
        `pi-rewind:snapshot/${msg.sessionId}/${msg.baselineHash}/${encodeURIComponent(msg.basename)}`,
      )
    : vscode.Uri.parse(`pi-rewind:empty/${encodeURIComponent(msg.basename)}`);
  let right: vscode.Uri;
  try {
    statSync(msg.absPath);
    right = vscode.Uri.file(msg.absPath);
  } catch {
    right = vscode.Uri.parse(`pi-rewind:empty/${encodeURIComponent(msg.basename)}`);
  }
  void vscode.commands.executeCommand(
    "vscode.diff",
    left,
    right,
    DIFF_PANEL_TITLE + ": " + msg.basename,
  );
}

function escapeGlob(s: string): string {
  let out = "";
  for (const ch of s) {
    const lower = ch.toLowerCase();
    const upper = ch.toUpperCase();
    if (lower !== upper) {
      out += `[${lower}${upper}]`;
    } else if (/[*?[\]{}()!@\\]/.test(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Open (or focus) the sidebar chat view. The webview chat UI lives in a
 * single view (`pi-agent-studio.chat`); when it is already open this either
 * switches it to the requested session or simply brings it to the front.
 *
 * The view resolves asynchronously (via `resolveWebviewView`), so when it was
 * not open yet this only remembers the request and focuses the view before
 * returning undefined — the session then starts once the view resolves.
 * Returns undefined early when pi is missing, like the old panel code did.
 */
export async function openChatPanel(
  opts: OpenChatPanelOptions,
): Promise<ChatPanelHandle | undefined> {
  if (!(await ensurePiBinary())) return undefined;

  const existing = activeHandle;
  if (existing) {
    if (opts.sessionFile && opts.sessionFile !== existing.sessionFile && existing.switchToSession) {
      await existing.switchToSession(opts.sessionFile).catch(() => undefined);
    }
    existing.view.show(false);
    return existing;
  }

  pendingOpen = opts;
  try {
    // The `<viewId>.focus` command is auto-generated by VS Code for every
    // contributed view; executing it makes the view visible and triggers
    // resolveWebviewView, which consumes `pendingOpen` and starts the session.
    await vscode.commands.executeCommand(`${CHAT_VIEW_TYPE}.focus`);
  } catch {
    pendingOpen = undefined;
  }
  return undefined;
}

/** Start a chat session hosted in the sidebar chat view. */
async function startChatSession(
  view: vscode.WebviewView,
  opts: OpenChatPanelOptions,
): Promise<ChatPanelHandle | undefined> {
  view.webview.options = { enableScripts: true };

  const chatCfg = vscode.workspace.getConfiguration("pi-agent-studio");
  view.title = t("Pi Chat");
  view.webview.html = getChatWebviewHtml(
    homedir(),
    sep,
    chatCfg.get<number>("chatFontSize"),
    getLocale(),
    chatCfg.get<string>("chatMermaidTheme"),
    resolveChatBackground(view.webview, chatCfg.get<string>("chatBackgroundImage")),
    chatCfg.get<number>("chatBackgroundOpacity"),
  );

  const piPath = await ensurePiBinary();
  if (!piPath) {
    view.webview.postMessage({
      type: "error",
      message: t("Pi binary not found. Install it globally?"),
    });
    void vscode.window.showErrorMessage(t("Pi binary not found. Install it globally?"));
    return undefined;
  }

  const panelId = opts.panelId ?? CHAT_VIEW_TYPE;

  const args = createRpcShellArgs({
    extensionUri: opts.extensionUri,
    sessionFile: opts.sessionFile,
  });
  const env = createRpcEnvironment(opts.bridgeConfig, opts.extensionUri);
  const cwd = opts.cwd ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  let disposed = false;
  let needsSessionFile = !opts.sessionFile;
  let sessionName: string | undefined;
  let cachedBranch: string | undefined;
  let branchResolved = false;
  let streaming = false;

  const langSub = vscode.workspace.onDidChangeConfiguration((e) => {
    if (
      e.affectsConfiguration("pi-agent-studio.language") ||
      e.affectsConfiguration("pi-agent-studio.chatMermaidTheme")
    ) {
      const cfg = vscode.workspace.getConfiguration("pi-agent-studio");
      view.webview.html = getChatWebviewHtml(
        homedir(),
        sep,
        cfg.get<number>("chatFontSize"),
        getLocale(),
        cfg.get<string>("chatMermaidTheme"),
        resolveChatBackground(view.webview, cfg.get<string>("chatBackgroundImage")),
        cfg.get<number>("chatBackgroundOpacity"),
      );
    }
  });

  function updateViewTitle(running: boolean): void {
    if (disposed) return;
    view.title =
      (running ? "🔵 " : "🟢 ") + t("Pi Chat") + (sessionName ? ` \u2014 ${sessionName}` : "");
  }

  function syncRegistryStatus(running: boolean): void {
    if (disposed || !handle.sessionFile) return;
    sessionStatusRegistry.upsert({
      sessionFile: handle.sessionFile,
      status: running ? "running" : "idle",
      source: "chat",
      panelId,
    });
  }

  const rpc = await createRpcClient({
    piPath,
    args,
    env,
    cwd,
    traceTag: panelId.slice(0, 8),
    handlers: {
      onEvent: (event) => {
        if (disposed) return;
        if (event.type === "agent_start") {
          streaming = true;
          updateViewTitle(true);
          syncRegistryStatus(true);
        } else if (event.type === "agent_settled") {
          streaming = false;
          updateViewTitle(false);
          syncRegistryStatus(false);
        }
        view.webview.postMessage({ type: "event", event });
        if (event.type === "agent_settled") {
          if (needsSessionFile) {
            void rpc
              .getState()
              .then((s) => applySessionFile(s.sessionFile, s.sessionName))
              .catch(() => {});
          }
          refreshCommands();
          void sendContextUsage();
        } else if (event.type === "message_end") {
          void sendContextUsage();
        } else if (event.type === "compaction_end") {
          void refreshContextAfterCompaction(event);
        }
      },
      onExtensionUiRequest: (req) => handleExtUiRequest(req),
      onExit: (code) => {
        if (disposed) return;
        updateViewTitle(false);
        if (handle.sessionFile) sessionStatusRegistry.remove(handle.sessionFile);
        disposed = true;
        view.webview.postMessage({
          type: "error",
          message: "Pi process exited" + (code != null ? ` (code ${code})` : ""),
        });
      },
      onError: (err) => {
        if (!disposed) view.webview.postMessage({ type: "error", message: err.message });
      },
    },
  });

  const handle: ChatPanelHandle = {
    view,
    rpc,
    panelId,
    sessionFile: opts.sessionFile,
  };
  handle.sync = (opts: ChatSessionUpdate): void => {
    if (opts.rename !== undefined) sessionName = opts.rename;
    updateViewTitle(streaming);
    void sendSessionInfo();
  };
  handle.switchToSession = async (sessionFile: string): Promise<void> => {
    if (disposed) return;
    if (handle.sessionFile === sessionFile) return;
    if (streaming) {
      toast("Stop the agent before switching sessions.", "error");
      throw new Error("Stop the agent before switching sessions.");
    }
    await rpc.switchSession(sessionFile);
    await rehydrate();
  };
  activeHandle = handle;
  if (opts.sessionFile) {
    sessionStatusRegistry.upsert({
      sessionFile: opts.sessionFile,
      status: "idle",
      source: "chat",
      panelId,
    });
  }

  function applySessionFile(sessionFile: string | undefined, name?: string): void {
    sessionName = name;
    if (!sessionFile) {
      needsSessionFile = true;
      void sendSessionInfo();
      return;
    }
    needsSessionFile = false;
    if (handle.sessionFile && handle.sessionFile !== sessionFile) {
      sessionStatusRegistry.remove(handle.sessionFile);
    }
    handle.sessionFile = sessionFile;
    opts.tracker.update(panelId, sessionFile);
    updateViewTitle(streaming);
    syncRegistryStatus(streaming);
    void sendSessionInfo();
  }

  /** Re-hydrate the view after the RPC session switched (state + messages). */
  async function rehydrate(): Promise<void> {
    const st = await rpc.getState();
    applySessionFile(st.sessionFile, st.sessionName);
    if (!disposed) view.webview.postMessage({ type: "state", state: st });
    const messages = await rpc.getMessages();
    if (!disposed) view.webview.postMessage({ type: "messages", messages });
    updateViewTitle(streaming);
    syncRegistryStatus(streaming);
    void sendContextUsage();
  }

  function shortenHome(p: string): string {
    const home = homedir();
    if (home && (p === home || p.startsWith(home + sep))) return "~" + p.slice(home.length);
    return p;
  }

  function toDisplayPath(fsPath: string, base: string): string {
    const rel = relative(base, fsPath);
    if (rel === "") return ".";
    if (!rel.startsWith("..") && !isAbsolute(rel)) return rel;
    return shortenHome(fsPath);
  }

  async function sendSessionInfo(): Promise<void> {
    if (disposed) return;
    let label = "";
    if (cwd) {
      label = shortenHome(cwd);
      if (!branchResolved) {
        cachedBranch = await getGitBranch(cwd);
        branchResolved = true;
      }
      if (cachedBranch) label += ` (${cachedBranch})`;
      if (sessionName) label += ` \u2022 ${sessionName}`;
    } else if (sessionName) {
      label = sessionName;
    }
    if (!disposed) view.webview.postMessage({ type: "sessionInfo", label });
  }

  async function sendContextUsage(): Promise<void> {
    if (disposed) return;
    try {
      const stats = await rpc.getSessionStatsFull();
      if (disposed) return;
      view.webview.postMessage({
        type: "contextUsage",
        usage: stats.contextUsage ?? null,
        cost: stats.cost,
      });
    } catch {
      // ignore - stats are best-effort
    }
  }

  async function refreshContextAfterCompaction(event: RpcEvent): Promise<void> {
    if (disposed) return;
    const aborted = event.aborted as boolean | undefined;
    const errorMessage = event.errorMessage as string | undefined;
    if (!aborted && !errorMessage) {
      // rehydrate so the compactionSummary block renders in-stream
      try {
        const msgs = await rpc.getMessages();
        if (!disposed) view.webview.postMessage({ type: "messages", messages: msgs });
      } catch {
        // fall through to context refresh
      }
    }
    const result = event.result as { estimatedTokensAfter?: number } | undefined;
    const after = result?.estimatedTokensAfter;
    if (typeof after === "number") {
      try {
        const st = await rpc.getState();
        const cw = st.model?.contextWindow ?? null;
        if (!disposed && cw != null && cw > 0) {
          view.webview.postMessage({
            type: "contextUsage",
            usage: { tokens: after, contextWindow: cw, percent: (after / cw) * 100 },
          });
          return;
        }
      } catch {
        // fall through to best-effort refresh
      }
    }
    void sendContextUsage();
  }

  function toast(text: string, kind?: "info" | "success" | "error" | "warning"): void {
    if (disposed) return;
    view.webview.postMessage({ type: "toast", text, ...(kind ? { kind } : {}) });
  }

  function showInfoPanel(title: string, markdown: string): void {
    if (disposed) return;
    view.webview.postMessage({ type: "infoPanel", title, markdown });
  }

  function formatSessionStats(s: RpcSessionStats): string {
    const lines: string[] = ["| Field | Value |", "|---|---|"];
    if (s.sessionId) lines.push(`| Session ID | \`${s.sessionId}\` |`);
    if (s.sessionFile) lines.push(`| Session file | \`${s.sessionFile}\` |`);
    const um = s.userMessages ?? 0;
    const am = s.assistantMessages ?? 0;
    lines.push(`| Messages | ${s.totalMessages ?? 0} (user ${um}, assistant ${am}) |`);
    if (s.toolCalls != null || s.toolResults != null) {
      lines.push(`| Tool calls | ${s.toolCalls ?? 0} (${s.toolResults ?? 0} results) |`);
    }
    if (s.cost != null) lines.push(`| Cost | $${s.cost.toFixed(4)} |`);
    const t = s.tokens;
    if (t) {
      lines.push(
        `| Tokens | in ${t.input ?? 0}, out ${t.output ?? 0}, cache read ${t.cacheRead ?? 0}, cache write ${t.cacheWrite ?? 0}, **total ${t.total ?? 0}** |`,
      );
    }
    return lines.join("\n");
  }

  async function applySessionName(name: string): Promise<void> {
    try {
      await rpc.setSessionName(name);
    } catch (e) {
      if (String(e instanceof Error ? e.message : e).includes("set_session_name")) {
        toast("Setting the session name requires a newer pi. Please upgrade.", "error");
        return;
      }
      throw e;
    }
    const st = await rpc.getState();
    applySessionFile(st.sessionFile, name);
    view.webview.postMessage({ type: "state", state: st });
    toast(`Session name set: ${name}`, "success");
  }

  async function handleBuiltin(message: string): Promise<boolean> {
    const parsed = parseBuiltin(message);
    if (!parsed) return false;
    const { name, args } = parsed;
    try {
      switch (name) {
        case "compact": {
          try {
            await rpc.compact(args || undefined);
          } catch {
            // error UI is handled via the compaction_end event
          }
          break;
        }
        case "autocompact": {
          const a = (args || "toggle").toLowerCase();
          let enabled: boolean;
          if (a === "on") enabled = true;
          else if (a === "off") enabled = false;
          else {
            const st = await rpc.getState();
            enabled = !st.autoCompactionEnabled;
          }
          await rpc.setAutoCompaction(enabled);
          toast(enabled ? "Auto-compaction enabled." : "Auto-compaction disabled.");
          break;
        }
        case "session": {
          const stats = await rpc.getSessionStatsFull();
          showInfoPanel("Session stats", formatSessionStats(stats));
          break;
        }
        case "name": {
          if (!args) {
            toast("Usage: /name <name>");
            break;
          }
          await applySessionName(args);
          break;
        }
        case "changelog": {
          const md = await readPiChangelog(piPath);
          if (md == null) {
            toast("Changelog not found (couldn't locate pi installation).", "error");
            break;
          }
          showInfoPanel("Pi changelog", md);
          break;
        }
        case "clear":
        case "new": {
          await rpc.newSession();
          const st = await rpc.getState();
          applySessionFile(st.sessionFile, st.sessionName);
          view.webview.postMessage({ type: "state", state: st });
          const messages = await rpc.getMessages();
          view.webview.postMessage({ type: "messages", messages });
          void sendContextUsage();
          toast("Started new session.", "success");
          break;
        }
      }
    } catch (e) {
      if (!disposed) {
        view.webview.postMessage({
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return true;
  }

  function refreshCommands(): void {
    void rpc
      .getCommands()
      .then((cmds) => {
        if (disposed) return;
        view.webview.postMessage({ type: "commands", commands: mergeBuiltinCommands(cmds) });
      })
      .catch(() => {});
  }

  async function hydrate(): Promise<void> {
    try {
      if (opts.sessionFile) {
        const st0 = await rpc.getState();
        if (st0.sessionFile !== opts.sessionFile) {
          await rpc.switchSession(opts.sessionFile);
        }
      }
      const [st, models, levels, cmds] = await Promise.all([
        rpc.getState(),
        rpc.getAvailableModels(),
        rpc.getAvailableThinkingLevels(),
        rpc.getCommands(),
      ]);
      sessionName = st.sessionName;
      view.webview.postMessage({ type: "state", state: st });
      view.webview.postMessage({
        type: "permissionMode",
        mode:
          vscode.workspace.getConfiguration("pi-agent-studio").get<string>("permission.mode") ??
          "AskForApproval",
      });
      view.webview.postMessage({ type: "models", models });
      view.webview.postMessage({ type: "enabledModels", keys: readEnabledModelKeys() });
      view.webview.postMessage({ type: "thinkingLevels", levels });
      // MCP prompt commands are registered asynchronously after session_start;
      // refresh shortly to pick them up.
      setTimeout(refreshCommands, 3000);
      view.webview.postMessage({ type: "commands", commands: mergeBuiltinCommands(cmds) });
      applySessionFile(st.sessionFile, st.sessionName);
      const messages = await rpc.getMessages();
      view.webview.postMessage({ type: "messages", messages });
      if (st.isStreaming) {
        streaming = true;
        updateViewTitle(true);
        syncRegistryStatus(true);
        view.webview.postMessage({ type: "event", event: { type: "agent_start" } });
      }
      void sendContextUsage();
    } catch (e) {
      view.webview.postMessage({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function handleExtUiRequest(req: ExtensionUiRequest): void {
    if (req.method === "confirm" && req.title === BTW_ABORT_TITLE) {
      if (!disposed) view.webview.postMessage({ type: "btwAbortReady", id: req.id });
      return;
    }
    if (
      req.method === "select" ||
      req.method === "confirm" ||
      req.method === "input" ||
      req.method === "editor"
    ) {
      view.webview.postMessage({ type: "dialog", request: req });
    } else if (req.method === "setWidget") {
      if (!disposed)
        view.webview.postMessage({
          type: "widget",
          widgetKey: req.widgetKey,
          widgetLines: req.widgetLines,
        });
    } else if (req.method === "notify") {
      if (!disposed) {
        const message = String(req.message ?? "");
        if (message.startsWith(MCP_STATUS_MARKER)) {
          try {
            const servers = JSON.parse(message.slice(MCP_STATUS_MARKER.length));
            view.webview.postMessage({ type: "mcpStatus", servers });
          } catch {
            // ignore malformed status payload
          }
          return;
        }
        const t = req.notifyType as string | undefined;
        const kind: "info" | "success" | "error" =
          t === "error" ? "error" : t === "success" ? "success" : "info";
        view.webview.postMessage({ type: "toast", text: message, kind });
      }
    }
    // Other fire-and-forget methods (setStatus, setTitle, ...) are ignored.
  }

  view.webview.onDidReceiveMessage(async (msg) => {
    switch (msg.type) {
      case "prompt":
        try {
          if (await handleBuiltin(msg.message)) break;
          await rpc.prompt(msg.message, msg.streamingBehavior, msg.images);
        } catch (e) {
          view.webview.postMessage({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
        break;
      case "abort":
        try {
          await rpc.abort();
        } catch {
          // ignore
        }
        break;
      case "copy":
        try {
          await vscode.env.clipboard.writeText(String(msg.text ?? ""));
        } catch {
          // ignore
        }
        break;
      case "openFile": {
        try {
          let filePath = String(msg.filePath ?? "");
          if (!filePath) break;
          if (!isAbsolute(filePath)) {
            const base = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (base) filePath = resolve(base, filePath);
          }
          const uri = vscode.Uri.file(filePath);
          const document = await vscode.workspace.openTextDocument(uri);
          const editor = await vscode.window.showTextDocument(document, {
            preview: true,
            preserveFocus: false,
          });
          const line = Number(msg.line);
          if (Number.isFinite(line) && line > 0) {
            const pos = new vscode.Position(line - 1, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
          }
        } catch (e) {
          toast(e instanceof Error ? e.message : String(e), "error");
        }
        break;
      }
      case "setModel":
        try {
          await rpc.setModel(msg.provider, msg.modelId);
          const st = await rpc.getState();
          view.webview.postMessage({ type: "state", state: st });
          const levels = await rpc.getAvailableThinkingLevels();
          view.webview.postMessage({ type: "thinkingLevels", levels });
          void sendContextUsage();
        } catch (e) {
          view.webview.postMessage({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
        break;
      case "toggleFavorite": {
        try {
          const keys = toggleFavoriteModel(String(msg.provider ?? ""), String(msg.modelId ?? ""));
          if (activeHandle) activeHandle.view.webview.postMessage({ type: "enabledModels", keys });
        } catch (e) {
          view.webview.postMessage({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
        break;
      }
      case "setThinking":
        try {
          await rpc.setThinkingLevel(msg.level);
          const st = await rpc.getState();
          view.webview.postMessage({ type: "state", state: st });
        } catch {
          // ignore
        }
        break;
      case "setSessionName":
        try {
          await applySessionName(String(msg.name ?? ""));
        } catch (e) {
          view.webview.postMessage({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
        break;
      case "pickResource": {
        try {
          const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: true,
            canSelectMany: true,
            defaultUri: cwd ? vscode.Uri.file(cwd) : undefined,
            openLabel: "Add",
            title: "Add file or folder to prompt",
          });
          const paths: string[] = [];
          if (uris) {
            for (const u of uris) {
              paths.push(cwd ? toDisplayPath(u.fsPath, cwd) : shortenHome(u.fsPath));
            }
          }
          if (!disposed) view.webview.postMessage({ type: "pickedResources", paths });
        } catch {
          if (!disposed) view.webview.postMessage({ type: "pickedResources", paths: [] });
        }
        break;
      }
      case "searchFiles": {
        const query: string = typeof msg.query === "string" ? msg.query : "";
        if (!cwd) {
          if (!disposed) view.webview.postMessage({ type: "files", query, files: [] });
          break;
        }
        const q = query.trim();
        if (!q) {
          if (!disposed) view.webview.postMessage({ type: "files", query, files: [] });
          break;
        }
        try {
          const excludePatterns = new Set<string>();
          for (const scope of ["files", "search"] as const) {
            const cfg = vscode.workspace
              .getConfiguration(scope)
              .get<Record<string, boolean>>("exclude");
            if (cfg) {
              for (const [glob, on] of Object.entries(cfg)) {
                if (on) excludePatterns.add(glob);
                else excludePatterns.delete(glob);
              }
            }
          }
          const exclude = excludePatterns.size ? `{${[...excludePatterns].join(",")}}` : undefined;
          const include = new vscode.RelativePattern(cwd, `**/*${escapeGlob(q)}*`);
          const uris = await vscode.workspace.findFiles(include, exclude, 80);
          const files = uris.map((u) => toDisplayPath(u.fsPath, cwd));
          if (!disposed) view.webview.postMessage({ type: "files", query, files });
        } catch {
          if (!disposed) view.webview.postMessage({ type: "files", query, files: [] });
        }
        break;
      }
      case "fork":
        try {
          if (streaming) {
            toast("Stop the agent before forking.", "error");
            break;
          }
          const entriesData = await rpc.getEntries();
          const entry = entriesData.entries.find(
            (e) =>
              e.type === "message" && e.message?.role === "user" && e.message?.timestamp === msg.ts,
          );
          if (!entry) {
            toast("Could not locate that message to fork from.", "error");
            break;
          }
          const forkResult = await rpc.fork(entry.id);
          if (forkResult.cancelled) {
            toast("Fork cancelled.");
            break;
          }
          const rSt = await rpc.getState();
          applySessionFile(rSt.sessionFile, rSt.sessionName);
          view.webview.postMessage({ type: "state", state: rSt });
          const rMsgs = await rpc.getMessages();
          view.webview.postMessage({ type: "messages", messages: rMsgs });
          void sendContextUsage();
          toast("Forked from selected message.", "success");
        } catch (e) {
          view.webview.postMessage({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
        break;
      case "revert":
        try {
          if (streaming) {
            toast("Stop the agent before reverting.", "error");
            break;
          }
          const revEntriesData = await rpc.getEntries();
          const revEntry = revEntriesData.entries.find(
            (e) =>
              e.type === "message" && e.message?.role === "user" && e.message?.timestamp === msg.ts,
          );
          if (!revEntry) {
            toast("Could not locate that message to revert to.", "error");
            break;
          }
          const revText = messageText(revEntry.message?.content);
          const beforeLeaf = revEntriesData.leafId;
          await rpc.prompt(`/pi-vscode-tree ${revEntry.id}`);
          const afterEntries = await rpc.getEntries();
          if (afterEntries.leafId === beforeLeaf) break;
          const revSt = await rpc.getState();
          applySessionFile(revSt.sessionFile, revSt.sessionName);
          view.webview.postMessage({ type: "state", state: revSt });
          const revMsgs = await rpc.getMessages();
          view.webview.postMessage({ type: "messages", messages: revMsgs });
          if (revText) view.webview.postMessage({ type: "prefillInput", text: revText });
          void sendContextUsage();
          toast("Reverted to selected message.", "success");
        } catch (e) {
          view.webview.postMessage({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
        break;
      case "dialogResponse":
        rpc.respondExtensionUi(msg.id, {
          value: msg.value,
          confirmed: msg.confirmed,
          cancelled: msg.cancelled,
        });
        break;
      case "reload": {
        try {
          const msgs = await rpc.getMessages();
          if (!disposed) view.webview.postMessage({ type: "messages", messages: msgs });
          void sendContextUsage();
        } catch (e) {
          view.webview.postMessage({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
        break;
      }
      case "todoClear":
        void rpc.prompt("/todo-clear", streaming ? "steer" : undefined).catch(() => {});
        break;
      case "openSettings":
        void vscode.commands.executeCommand("pi-agent-studio.openSettings");
        break;
      case "mcpOpen": {
        const mcpEnabled = vscode.workspace
          .getConfiguration("pi-agent-studio.mcp")
          .get("enabled", true);
        if (!mcpEnabled) {
          toast('MCP is disabled. Enable it via setting "pi-agent-studio.mcp.enabled".', "warning");
          break;
        }
        void rpc.prompt("/mcp status", streaming ? "steer" : undefined).catch(() => {});
        break;
      }
      case "mcpAction": {
        const action = String(msg.action ?? "status");
        const server = String(msg.server ?? "");
        const arg = server ? ` ${server}` : "";
        void rpc.prompt(`/mcp ${action}${arg}`, streaming ? "steer" : undefined).catch(() => {});
        break;
      }
      case "setPermission":
        void rpc
          .prompt(`/permission ${String(msg.mode ?? "")}`, streaming ? "steer" : undefined)
          .catch(() => {});
        break;
      case "btwAbort":
        rpc.respondExtensionUi(msg.id, { confirmed: true });
        break;
      case "rewindAccept":
        if (streaming) {
          toast("Stop the agent before changing files.", "error");
          break;
        }
        void rpc.prompt("/rewind-accept", streaming ? "steer" : undefined).catch(() => {});
        break;
      case "rewindAcceptFile":
        if (streaming) {
          toast("Stop the agent before changing files.", "error");
          break;
        }
        void rpc
          .prompt(`/rewind-accept-file ${msg.id}`, streaming ? "steer" : undefined)
          .catch(() => {});
        break;
      case "rewindRevert":
        if (streaming) {
          toast("Stop the agent before reverting.", "error");
          break;
        }
        void rpc.prompt("/rewind-revert", streaming ? "steer" : undefined).catch(() => {});
        break;
      case "rewindRevertFile":
        if (streaming) {
          toast("Stop the agent before reverting.", "error");
          break;
        }
        void rpc
          .prompt(`/rewind-revert-file ${msg.id}`, streaming ? "steer" : undefined)
          .catch(() => {});
        break;
      case "rewindDiff":
        openRewindDiff(msg);
        break;
    }
  });

  view.onDidDispose(() => {
    langSub.dispose();
    disposed = true;
    if (activeHandle === handle) activeHandle = undefined;
    if (handle.sessionFile) {
      sessionStatusRegistry.remove(handle.sessionFile);
    }
    // Keep the tracker entry so the next time the view is opened it restores
    // the last session instead of starting from scratch.
    void rpc.dispose();
  });

  void hydrate();
  return handle;
}

export function disposeAllChatPanels(): void {
  const handle = activeHandle;
  activeHandle = undefined;
  if (handle) void handle.rpc.dispose();
}

export function syncOpenChatSession(sessionFile: string, opts: ChatSessionUpdate): boolean {
  if (!activeHandle || activeHandle.sessionFile !== sessionFile) return false;
  if (!activeHandle.sync) return false;
  activeHandle.sync(opts);
  return true;
}

/**
 * Provider for the sidebar chat view. `resolveWebviewView` is called by VS
 * Code whenever the view becomes visible (user opens it, the window restores
 * its sidebar layout, or a command focuses it). It starts a fresh chat session
 * for the pending open request, or restores the last session stored by the
 * tracker.
 */
export function createChatViewProvider(
  extensionUri: vscode.Uri,
  bridgeConfig: BridgeConfig | undefined,
  tracker: ChatTracker,
): vscode.WebviewViewProvider {
  return {
    resolveWebviewView(webviewView: vscode.WebviewView) {
      const opts: OpenChatPanelOptions = pendingOpen ?? {
        extensionUri,
        bridgeConfig,
        tracker,
        sessionFile: restorableSessionFile(tracker),
      };
      pendingOpen = undefined;
      void startChatSession(webviewView, opts);
    },
  };
}

function restorableSessionFile(tracker: ChatTracker): string | undefined {
  const stored = tracker.get(CHAT_VIEW_TYPE);
  if (stored && existsSync(stored)) return stored;
  return undefined;
}
