import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";
import * as vscode from "vscode";
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

export interface ChatSessionUpdate {
  rename?: string;
}

export interface ChatPanelHandle {
  panel: vscode.WebviewPanel;
  rpc: RpcClient;
  panelId: string;
  sessionFile?: string;
  sync?: (opts: ChatSessionUpdate) => void;
}

export interface OpenChatPanelOptions {
  extensionUri: vscode.Uri;
  bridgeConfig?: { url: string; token: string };
  tracker: ChatTracker;
  sessionFile?: string;
  panelId?: string;
  cwd?: string;
}

const activePanels = new Map<string, ChatPanelHandle>();
const sessionToPanel = new Map<string, string>();

/** Marker prefix the MCP bridge emits before a structured status JSON payload. */
const MCP_STATUS_MARKER = "__mcp_status__";

const CHAT_VIEW_TYPE = "pi-agent-studio.chat";
const CHAT_PANEL_TITLE = "Pi Chat";
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

export async function openChatPanel(
  opts: OpenChatPanelOptions,
): Promise<ChatPanelHandle | undefined> {
  // Reuse an already-open panel for the same session.
  if (opts.sessionFile) {
    const existingId = sessionToPanel.get(opts.sessionFile);
    if (existingId) {
      const handle = activePanels.get(existingId);
      if (handle) {
        handle.panel.reveal(handle.panel.viewColumn ?? vscode.ViewColumn.Active, false);
        lockChatEditorGroup();
        return handle;
      }
    }
  }

  const piPath = await ensurePiBinary();
  if (!piPath) return undefined;

  const panelId = opts.panelId ?? randomUUID();
  const panel = vscode.window.createWebviewPanel(
    CHAT_VIEW_TYPE,
    CHAT_PANEL_TITLE,
    findChatColumn() ?? findUnusedColumn() ?? vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      enableFindWidget: true,
    },
  );
  panel.iconPath = {
    light: vscode.Uri.joinPath(opts.extensionUri, "assets", "logo-light.svg"),
    dark: vscode.Uri.joinPath(opts.extensionUri, "assets", "logo.svg"),
  };
  panel.webview.html = getChatWebviewHtml(
    homedir(),
    sep,
    vscode.workspace.getConfiguration("pi-agent-studio").get<number>("chatFontSize"),
  );
  lockChatEditorGroup();

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
    if (e.affectsConfiguration("pi-agent-studio.language")) {
      panel.webview.html = getChatWebviewHtml(
        homedir(),
        sep,
        vscode.workspace.getConfiguration("pi-agent-studio").get<number>("chatFontSize"),
        getLocale(),
      );
    }
  });

  function updatePanelTitle(running: boolean): void {
    if (disposed) return;
    panel.title =
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
          updatePanelTitle(true);
          syncRegistryStatus(true);
        } else if (event.type === "agent_settled") {
          streaming = false;
          updatePanelTitle(false);
          syncRegistryStatus(false);
        }
        panel.webview.postMessage({ type: "event", event });
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
        updatePanelTitle(false);
        if (handle.sessionFile) sessionStatusRegistry.remove(handle.sessionFile);
        disposed = true;
        panel.webview.postMessage({
          type: "error",
          message: "Pi process exited" + (code != null ? ` (code ${code})` : ""),
        });
      },
      onError: (err) => {
        if (!disposed) panel.webview.postMessage({ type: "error", message: err.message });
      },
    },
  });

  const handle: ChatPanelHandle = {
    panel,
    rpc,
    panelId,
    sessionFile: opts.sessionFile,
  };
  handle.sync = (opts: ChatSessionUpdate): void => {
    if (opts.rename !== undefined) sessionName = opts.rename;
    updatePanelTitle(streaming);
    void sendSessionInfo();
  };
  activePanels.set(panelId, handle);
  if (opts.sessionFile) {
    sessionToPanel.set(opts.sessionFile, panelId);
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
      sessionToPanel.delete(handle.sessionFile);
      sessionStatusRegistry.remove(handle.sessionFile);
    }
    handle.sessionFile = sessionFile;
    sessionToPanel.set(sessionFile, panelId);
    opts.tracker.update(panelId, sessionFile);
    updatePanelTitle(streaming);
    syncRegistryStatus(streaming);
    void sendSessionInfo();
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
    if (!disposed) panel.webview.postMessage({ type: "sessionInfo", label });
  }

  async function sendContextUsage(): Promise<void> {
    if (disposed) return;
    try {
      const stats = await rpc.getSessionStatsFull();
      if (disposed) return;
      panel.webview.postMessage({
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
        if (!disposed) panel.webview.postMessage({ type: "messages", messages: msgs });
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
          panel.webview.postMessage({
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
    panel.webview.postMessage({ type: "toast", text, ...(kind ? { kind } : {}) });
  }

  function showInfoPanel(title: string, markdown: string): void {
    if (disposed) return;
    panel.webview.postMessage({ type: "infoPanel", title, markdown });
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
    panel.webview.postMessage({ type: "state", state: st });
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
          panel.webview.postMessage({ type: "state", state: st });
          const messages = await rpc.getMessages();
          panel.webview.postMessage({ type: "messages", messages });
          void sendContextUsage();
          toast("Started new session.", "success");
          break;
        }
      }
    } catch (e) {
      if (!disposed) {
        panel.webview.postMessage({
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
        panel.webview.postMessage({ type: "commands", commands: mergeBuiltinCommands(cmds) });
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
      panel.webview.postMessage({ type: "state", state: st });
      panel.webview.postMessage({
        type: "permissionMode",
        mode:
          vscode.workspace.getConfiguration("pi-agent-studio").get<string>("permission.mode") ??
          "AskForApproval",
      });
      panel.webview.postMessage({ type: "models", models });
      panel.webview.postMessage({ type: "enabledModels", keys: readEnabledModelKeys() });
      panel.webview.postMessage({ type: "thinkingLevels", levels });
      // MCP prompt commands are registered asynchronously after session_start;
      // refresh shortly to pick them up.
      setTimeout(refreshCommands, 3000);
      panel.webview.postMessage({ type: "commands", commands: mergeBuiltinCommands(cmds) });
      applySessionFile(st.sessionFile, st.sessionName);
      const messages = await rpc.getMessages();
      panel.webview.postMessage({ type: "messages", messages });
      if (st.isStreaming) {
        streaming = true;
        updatePanelTitle(true);
        syncRegistryStatus(true);
        panel.webview.postMessage({ type: "event", event: { type: "agent_start" } });
      }
      void sendContextUsage();
    } catch (e) {
      panel.webview.postMessage({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function handleExtUiRequest(req: ExtensionUiRequest): void {
    if (req.method === "confirm" && req.title === BTW_ABORT_TITLE) {
      if (!disposed) panel.webview.postMessage({ type: "btwAbortReady", id: req.id });
      return;
    }
    if (
      req.method === "select" ||
      req.method === "confirm" ||
      req.method === "input" ||
      req.method === "editor"
    ) {
      panel.webview.postMessage({ type: "dialog", request: req });
    } else if (req.method === "setWidget") {
      if (!disposed)
        panel.webview.postMessage({
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
            panel.webview.postMessage({ type: "mcpStatus", servers });
          } catch {
            // ignore malformed status payload
          }
          return;
        }
        const t = req.notifyType as string | undefined;
        const kind: "info" | "success" | "error" =
          t === "error" ? "error" : t === "success" ? "success" : "info";
        panel.webview.postMessage({ type: "toast", text: message, kind });
      }
    }
    // Other fire-and-forget methods (setStatus, setTitle, ...) are ignored.
  }

  panel.webview.onDidReceiveMessage(async (msg) => {
    switch (msg.type) {
      case "prompt":
        try {
          if (await handleBuiltin(msg.message)) break;
          await rpc.prompt(msg.message, msg.streamingBehavior, msg.images);
        } catch (e) {
          panel.webview.postMessage({
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
          panel.webview.postMessage({ type: "state", state: st });
          const levels = await rpc.getAvailableThinkingLevels();
          panel.webview.postMessage({ type: "thinkingLevels", levels });
          void sendContextUsage();
        } catch (e) {
          panel.webview.postMessage({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
        break;
      case "toggleFavorite": {
        try {
          const keys = toggleFavoriteModel(String(msg.provider ?? ""), String(msg.modelId ?? ""));
          for (const h of activePanels.values()) {
            h.panel.webview.postMessage({ type: "enabledModels", keys });
          }
        } catch (e) {
          panel.webview.postMessage({
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
          panel.webview.postMessage({ type: "state", state: st });
        } catch {
          // ignore
        }
        break;
      case "setSessionName":
        try {
          await applySessionName(String(msg.name ?? ""));
        } catch (e) {
          panel.webview.postMessage({
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
          if (!disposed) panel.webview.postMessage({ type: "pickedResources", paths });
        } catch {
          if (!disposed) panel.webview.postMessage({ type: "pickedResources", paths: [] });
        }
        break;
      }
      case "searchFiles": {
        const query: string = typeof msg.query === "string" ? msg.query : "";
        if (!cwd) {
          if (!disposed) panel.webview.postMessage({ type: "files", query, files: [] });
          break;
        }
        const q = query.trim();
        if (!q) {
          if (!disposed) panel.webview.postMessage({ type: "files", query, files: [] });
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
          if (!disposed) panel.webview.postMessage({ type: "files", query, files });
        } catch {
          if (!disposed) panel.webview.postMessage({ type: "files", query, files: [] });
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
          panel.webview.postMessage({ type: "state", state: rSt });
          const rMsgs = await rpc.getMessages();
          panel.webview.postMessage({ type: "messages", messages: rMsgs });
          void sendContextUsage();
          toast("Forked from selected message.", "success");
        } catch (e) {
          panel.webview.postMessage({
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
          panel.webview.postMessage({ type: "state", state: revSt });
          const revMsgs = await rpc.getMessages();
          panel.webview.postMessage({ type: "messages", messages: revMsgs });
          if (revText) panel.webview.postMessage({ type: "prefillInput", text: revText });
          void sendContextUsage();
          toast("Reverted to selected message.", "success");
        } catch (e) {
          panel.webview.postMessage({
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
          if (!disposed) panel.webview.postMessage({ type: "messages", messages: msgs });
          void sendContextUsage();
        } catch (e) {
          panel.webview.postMessage({
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

  panel.onDidDispose(() => {
    langSub.dispose();
    disposed = true;
    activePanels.delete(panelId);
    if (handle.sessionFile) {
      sessionToPanel.delete(handle.sessionFile);
      sessionStatusRegistry.remove(handle.sessionFile);
    }
    opts.tracker.removePanel(panelId);
    void rpc.dispose();
  });

  void hydrate();
  return handle;
}

export function disposeAllChatPanels(): void {
  for (const handle of activePanels.values()) {
    void handle.rpc.dispose();
    handle.panel.dispose();
  }
  activePanels.clear();
  sessionToPanel.clear();
}

export function syncOpenChatSession(sessionFile: string, opts: ChatSessionUpdate): boolean {
  const panelId = sessionToPanel.get(sessionFile);
  if (!panelId) return false;
  const handle = activePanels.get(panelId);
  if (!handle?.sync) return false;
  handle.sync(opts);
  return true;
}

function isChatTab(tab: vscode.Tab): boolean {
  return tab.input instanceof vscode.TabInputWebview && tab.input.viewType.includes(CHAT_VIEW_TYPE);
}

function findChatColumn(): vscode.ViewColumn | undefined {
  for (const group of vscode.window.tabGroups.all) {
    if (group.tabs.some(isChatTab)) return group.viewColumn;
  }
  return undefined;
}

function findUnusedColumn(): vscode.ViewColumn | undefined {
  const used = new Set<vscode.ViewColumn>();
  for (const group of vscode.window.tabGroups.all) {
    if (group.viewColumn !== undefined && group.tabs.length > 0) used.add(group.viewColumn);
  }
  for (let column = vscode.ViewColumn.One; column <= vscode.ViewColumn.Nine; column++) {
    if (!used.has(column)) return column;
  }
  return undefined;
}

function lockChatEditorGroup(): void {
  const isChatGroup = (group: vscode.TabGroup): boolean => group.tabs.some(isChatTab);

  const lock = (): boolean => {
    void vscode.commands.executeCommand("workbench.action.lockEditorGroup");
    return true;
  };

  if (vscode.window.tabGroups.activeTabGroup.tabs.length === 0 && lock()) return;

  const sub = vscode.window.tabGroups.onDidChangeTabGroups((e) => {
    const relevant = [...e.opened, ...e.changed];
    if (relevant.some(isChatGroup) && lock()) sub.dispose();
  });
  setTimeout(() => sub.dispose(), 5000);
}
