// Shared chat session controller: owns the `pi --mode rpc` subprocess and all
// webview<->extension message handling. The same session logic backs either a
// WebviewPanel (editor tab) or a WebviewView (sidebar).

import { statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";
import * as vscode from "vscode";
import type { BridgeConfig } from "../bridge/types.ts";
import { createRpcEnvironment, createRpcShellArgs, ensurePiBinary } from "../pi.ts";
import { getGitBranch } from "../gitCommit/gitUtils.ts";
import { readEnabledModelKeys, toggleFavoriteModel } from "../settings/settings-config.ts";
import type {
  ExtensionUiRequest,
  RpcClient,
  RpcEvent,
  RpcImage,
  RpcSessionStats,
} from "./chat-types.ts";
import { createRpcClient } from "./rpc-client.ts";
import { mergeBuiltinCommands, parseBuiltin } from "./builtin-commands.ts";
import { readPiChangelog } from "./pi-changelog.ts";

export interface ChatSessionUpdate {
  rename?: string;
}

/** Abstract webview host so the same session can back a panel or a view. */
export interface ChatHost {
  postMessage(msg: unknown): void;
  onDidReceiveMessage(listener: (message: unknown) => void): vscode.Disposable;
  onDidDispose(listener: () => void): vscode.Disposable;
  updateTitle?(running: boolean, sessionName?: string): void;
}

export interface ChatSessionOptions {
  extensionUri: vscode.Uri;
  bridgeConfig?: BridgeConfig;
  sessionFile?: string;
  cwd?: string;
  traceTag: string;
  host: ChatHost;
  /** Host-side bookkeeping when the session file becomes known (panels persist it). */
  onSessionFile?: (
    sessionFile: string | undefined,
    name: string | undefined,
    previous: string | undefined,
  ) => void;
  /** Streaming status changed (panels update the sidebar status registry). */
  onStreamingChange?: (running: boolean) => void;
  /** The pi subprocess exited. */
  onExit?: (code: number | null) => void;
}

export interface ChatSession {
  rpc: RpcClient;
  host: ChatHost;
  sessionFile?: string;
  streaming: boolean;
  attach(host: ChatHost): void;
  sync(opts: ChatSessionUpdate): void;
  switchTo(sessionFile: string): Promise<void>;
  newSession(): Promise<void>;
  dispose(): void;
}

const MCP_STATUS_MARKER = "__mcp_status__";
const RELOAD_MARKER = "__pi_reload__";
const BTW_ABORT_TITLE = "Pi Btw Abort";
const DIFF_PANEL_TITLE = "Pi Diff";

const allSessions = new Set<ChatSession>();

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

export async function createChatSession(
  opts: ChatSessionOptions,
): Promise<ChatSession | undefined> {
  const piPath = await ensurePiBinary();
  if (!piPath) return undefined;

  let host = opts.host;
  let msgSub: vscode.Disposable | undefined;
  let sessionDisposed = false;
  let needsSessionFile = !opts.sessionFile;
  let sessionName: string | undefined;
  let currentSessionFile = opts.sessionFile;
  let cachedBranch: string | undefined;
  let branchResolved = false;
  let streaming = false;
  let switchedSession = false;
  let rpc: RpcClient;

  const cwd = opts.cwd ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  function updateStreamingState(running: boolean): void {
    streaming = running;
    host.updateTitle?.(running, sessionName);
    opts.onStreamingChange?.(running);
  }

  function applySessionFile(sessionFile: string | undefined, name?: string): void {
    sessionName = name;
    if (!sessionFile) {
      needsSessionFile = true;
      void sendSessionInfo();
      return;
    }
    needsSessionFile = false;
    const previous = currentSessionFile;
    currentSessionFile = sessionFile;
    opts.onSessionFile?.(sessionFile, name, previous);
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
    if (sessionDisposed) return;
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
    if (!sessionDisposed)
      host.postMessage({ type: "sessionInfo", label, sessionFile: currentSessionFile ?? null });
  }

  async function sendContextUsage(): Promise<void> {
    if (sessionDisposed) return;
    try {
      const stats = await rpc.getSessionStatsFull();
      if (sessionDisposed) return;
      host.postMessage({
        type: "contextUsage",
        usage: stats.contextUsage ?? null,
        cost: stats.cost,
      });
    } catch {
      // ignore - stats are best-effort
    }
  }

  async function refreshContextAfterCompaction(event: RpcEvent): Promise<void> {
    if (sessionDisposed) return;
    const aborted = event.aborted as boolean | undefined;
    const errorMessage = event.errorMessage as string | undefined;
    if (!aborted && !errorMessage) {
      // rehydrate so the compactionSummary block renders in-stream
      try {
        const msgs = await rpc.getMessages();
        if (!sessionDisposed) host.postMessage({ type: "messages", messages: msgs });
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
        if (!sessionDisposed && cw != null && cw > 0) {
          host.postMessage({
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
    if (sessionDisposed) return;
    host.postMessage({ type: "toast", text, ...(kind ? { kind } : {}) });
  }

  function showInfoPanel(title: string, markdown: string): void {
    if (sessionDisposed) return;
    host.postMessage({ type: "infoPanel", title, markdown });
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
    host.postMessage({ type: "state", state: st });
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
          await refreshAfterSwitch();
          toast("Started new session.", "success");
          break;
        }
      }
    } catch (e) {
      if (!sessionDisposed) {
        host.postMessage({
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
        if (sessionDisposed) return;
        host.postMessage({ type: "commands", commands: mergeBuiltinCommands(cmds) });
      })
      .catch(() => {});
  }

  async function hydrate(): Promise<void> {
    try {
      if (opts.sessionFile && !switchedSession) {
        const st0 = await rpc.getState();
        if (st0.sessionFile !== opts.sessionFile) {
          await rpc.switchSession(opts.sessionFile);
        }
        switchedSession = true;
      }
      const [st, models, levels, cmds] = await Promise.all([
        rpc.getState(),
        rpc.getAvailableModels(),
        rpc.getAvailableThinkingLevels(),
        rpc.getCommands(),
      ]);
      sessionName = st.sessionName;
      host.postMessage({ type: "state", state: st });
      host.postMessage({
        type: "permissionMode",
        mode:
          vscode.workspace.getConfiguration("pi-agent-studio").get<string>("permission.mode") ??
          "AskForApproval",
      });
      host.postMessage({ type: "models", models });
      host.postMessage({ type: "enabledModels", keys: readEnabledModelKeys() });
      host.postMessage({ type: "thinkingLevels", levels });
      // MCP prompt commands are registered asynchronously after session_start;
      // refresh shortly to pick them up.
      setTimeout(refreshCommands, 3000);
      host.postMessage({ type: "commands", commands: mergeBuiltinCommands(cmds) });
      applySessionFile(st.sessionFile, st.sessionName);
      const messages = await rpc.getMessages();
      host.postMessage({ type: "messages", messages });
      if (st.isStreaming) {
        streaming = true;
        host.updateTitle?.(true, sessionName);
        opts.onStreamingChange?.(true);
        host.postMessage({ type: "event", event: { type: "agent_start" } });
      }
      void sendContextUsage();
    } catch (e) {
      host.postMessage({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function handleExtUiRequest(req: ExtensionUiRequest): void {
    if (req.method === "confirm" && req.title === BTW_ABORT_TITLE) {
      if (!sessionDisposed) host.postMessage({ type: "btwAbortReady", id: req.id });
      return;
    }
    if (
      req.method === "select" ||
      req.method === "confirm" ||
      req.method === "input" ||
      req.method === "editor"
    ) {
      host.postMessage({ type: "dialog", request: req });
    } else if (req.method === "setWidget") {
      if (!sessionDisposed)
        host.postMessage({
          type: "widget",
          widgetKey: req.widgetKey,
          widgetLines: req.widgetLines,
        });
    } else if (req.method === "notify") {
      if (!sessionDisposed) {
        const message = String(req.message ?? "");
        if (message.startsWith(MCP_STATUS_MARKER)) {
          try {
            const servers = JSON.parse(message.slice(MCP_STATUS_MARKER.length));
            host.postMessage({ type: "mcpStatus", servers });
          } catch {
            // ignore malformed status payload
          }
          return;
        }
        if (message === RELOAD_MARKER) {
          void reloadSession();
          return;
        }
        const t = req.notifyType as string | undefined;
        const kind: "info" | "success" | "error" =
          t === "error" ? "error" : t === "success" ? "success" : "info";
        host.postMessage({ type: "toast", text: message, kind });
      }
    }
    // Other fire-and-forget methods (setStatus, setTitle, ...) are ignored.
  }

  async function reloadSession(): Promise<void> {
    if (streaming || sessionDisposed) return;
    if (!currentSessionFile) {
      toast("This session has not been saved yet.", "error");
      return;
    }
    try {
      await rpc.dispose();
      rpc = await bootRpc(currentSessionFile);
      await hydrate();
      toast("Session reloaded", "success");
    } catch (e) {
      if (!sessionDisposed) {
        host.postMessage({
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  async function onMessage(msg: { type: string; [k: string]: unknown }): Promise<void> {
    switch (msg.type) {
      case "webviewReady":
        // The webview (re)loaded its document; re-post full state so late
        // attaches never leave a blank UI (idempotent re-hydration).
        void hydrate();
        break;
      case "prompt":
        try {
          if (await handleBuiltin(String(msg.message ?? ""))) break;
          await rpc.prompt(
            String(msg.message ?? ""),
            msg.streamingBehavior as "steer" | "followUp" | undefined,
            msg.images as RpcImage[] | undefined,
          );
        } catch (e) {
          host.postMessage({
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
      case "clearQueue":
        try {
          await rpc.clearQueue();
          host.postMessage({
            type: "event",
            event: { type: "queue_update", steering: [], followUp: [] },
          });
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
          await rpc.setModel(String(msg.provider ?? ""), String(msg.modelId ?? ""));
          const st = await rpc.getState();
          host.postMessage({ type: "state", state: st });
          const levels = await rpc.getAvailableThinkingLevels();
          host.postMessage({ type: "thinkingLevels", levels });
          void sendContextUsage();
        } catch (e) {
          host.postMessage({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
        break;
      case "toggleFavorite": {
        try {
          const keys = toggleFavoriteModel(String(msg.provider ?? ""), String(msg.modelId ?? ""));
          for (const s of allSessions) {
            s.host.postMessage({ type: "enabledModels", keys });
          }
        } catch (e) {
          host.postMessage({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
        break;
      }
      case "setThinking":
        try {
          await rpc.setThinkingLevel(String(msg.level ?? ""));
          const st = await rpc.getState();
          host.postMessage({ type: "state", state: st });
        } catch {
          // ignore
        }
        break;
      case "setSessionName":
        try {
          await applySessionName(String(msg.name ?? ""));
        } catch (e) {
          host.postMessage({
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
          if (!sessionDisposed) host.postMessage({ type: "pickedResources", paths });
        } catch {
          if (!sessionDisposed) host.postMessage({ type: "pickedResources", paths: [] });
        }
        break;
      }
      case "searchFiles": {
        const query: string = typeof msg.query === "string" ? msg.query : "";
        if (!cwd) {
          if (!sessionDisposed) host.postMessage({ type: "files", query, files: [] });
          break;
        }
        const q = query.trim();
        if (!q) {
          if (!sessionDisposed) host.postMessage({ type: "files", query, files: [] });
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
          if (!sessionDisposed) host.postMessage({ type: "files", query, files });
        } catch {
          if (!sessionDisposed) host.postMessage({ type: "files", query, files: [] });
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
          host.postMessage({ type: "state", state: rSt });
          const rMsgs = await rpc.getMessages();
          host.postMessage({ type: "messages", messages: rMsgs });
          void sendContextUsage();
          toast("Forked from selected message.", "success");
        } catch (e) {
          host.postMessage({
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
          host.postMessage({ type: "state", state: revSt });
          const revMsgs = await rpc.getMessages();
          host.postMessage({ type: "messages", messages: revMsgs });
          if (revText) host.postMessage({ type: "prefillInput", text: revText });
          void sendContextUsage();
          toast("Reverted to selected message.", "success");
        } catch (e) {
          host.postMessage({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
        break;
      case "dialogResponse":
        rpc.respondExtensionUi(String(msg.id ?? ""), {
          value: msg.value as string | undefined,
          confirmed: msg.confirmed as boolean | undefined,
          cancelled: msg.cancelled as boolean | undefined,
        });
        break;
      case "reload":
        void reloadSession();
        break;
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
        rpc.respondExtensionUi(String(msg.id ?? ""), { confirmed: true });
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
        openRewindDiff(
          msg as unknown as {
            absPath: string;
            baselineHash: string | null;
            sessionId: string;
            basename: string;
          },
        );
        break;
    }
  }

  function attachHost(h: ChatHost): void {
    host = h;
    msgSub?.dispose();
    msgSub = h.onDidReceiveMessage(
      (m) => void onMessage(m as { type: string; [k: string]: unknown }),
    );
    void hydrate();
  }

  function sync(opts: ChatSessionUpdate): void {
    if (opts.rename !== undefined) sessionName = opts.rename;
    host.updateTitle?.(streaming, sessionName);
    void sendSessionInfo();
  }

  async function refreshAfterSwitch(): Promise<void> {
    const st = await rpc.getState();
    if (sessionDisposed) return;
    applySessionFile(st.sessionFile, st.sessionName);
    host.postMessage({ type: "state", state: st });
    const messages = await rpc.getMessages();
    if (sessionDisposed) return;
    host.postMessage({ type: "messages", messages });
    void sendContextUsage();
  }

  async function switchTo(sessionFile: string): Promise<void> {
    if (streaming) {
      toast("Stop the agent before switching sessions.", "error");
      return;
    }
    try {
      await rpc.switchSession(sessionFile);
      await refreshAfterSwitch();
    } catch (e) {
      if (!sessionDisposed) {
        host.postMessage({
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  async function newSession(): Promise<void> {
    if (streaming) {
      toast("Stop the agent before starting a new session.", "error");
      return;
    }
    try {
      await rpc.newSession();
      await refreshAfterSwitch();
      toast("Started new session.", "success");
    } catch (e) {
      if (!sessionDisposed) {
        host.postMessage({
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  function dispose(): void {
    if (sessionDisposed) return;
    sessionDisposed = true;
    allSessions.delete(session);
    void rpc.dispose();
  }

  let rpcGeneration = 0;

  async function bootRpc(sessionFileForSpawn: string | undefined): Promise<RpcClient> {
    if (!piPath) throw new Error("pi is not available");
    const gen = ++rpcGeneration;
    return createRpcClient({
      piPath,
      args: createRpcShellArgs({
        extensionUri: opts.extensionUri,
        sessionFile: sessionFileForSpawn,
      }),
      env: createRpcEnvironment(opts.bridgeConfig, opts.extensionUri),
      cwd,
      traceTag: opts.traceTag,
      handlers: {
        onEvent: (event) => {
          if (gen !== rpcGeneration || sessionDisposed) return;
          if (event.type === "agent_start") {
            updateStreamingState(true);
          } else if (event.type === "agent_settled") {
            updateStreamingState(false);
          }
          host.postMessage({ type: "event", event });
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
        onExtensionUiRequest: (req) => {
          if (gen !== rpcGeneration || sessionDisposed) return;
          handleExtUiRequest(req);
        },
        onExit: (code) => {
          if (gen !== rpcGeneration || sessionDisposed) return;
          updateStreamingState(false);
          opts.onExit?.(code);
          sessionDisposed = true;
          allSessions.delete(session);
          host.postMessage({
            type: "error",
            message: "Pi process exited" + (code != null ? ` (code ${code})` : ""),
          });
        },
        onError: (err) => {
          if (gen !== rpcGeneration || sessionDisposed) return;
          host.postMessage({ type: "error", message: err.message });
        },
      },
    });
  }

  rpc = await bootRpc(opts.sessionFile);

  let session: ChatSession = {
    rpc,
    get host() {
      return host;
    },
    get sessionFile() {
      return currentSessionFile;
    },
    get streaming() {
      return streaming;
    },
    attach: attachHost,
    sync,
    switchTo,
    newSession,
    dispose,
  };
  allSessions.add(session);
  attachHost(opts.host);
  return session;
}
