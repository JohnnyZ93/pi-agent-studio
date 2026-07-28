import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, relative, sep } from "node:path";
import * as vscode from "vscode";
import { createRpcEnvironment, createRpcShellArgs, ensurePiBinary } from "../pi.ts";
import { getGitBranch } from "../gitCommit/gitUtils.ts";
import { getChatHtml } from "./chat-html.ts";
import type { ChatTracker } from "./chat-tracker.ts";
import type { ExtensionUiRequest, RpcClient, RpcEvent, RpcSessionStats } from "./chat-types.ts";
import { createRpcClient } from "./rpc-client.ts";
import { mergeBuiltinCommands, parseBuiltin } from "./builtin-commands.ts";
import { readPiChangelog } from "./pi-changelog.ts";

export interface ChatPanelHandle {
  panel: vscode.WebviewPanel;
  rpc: RpcClient;
  panelId: string;
  sessionFile?: string;
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

const CHAT_VIEW_TYPE = "pi-agent-studio.chat";
const CHAT_PANEL_TITLE = "Pi Chat";

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
  panel.webview.html = getChatHtml(homedir(), sep);
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

  const rpc = await createRpcClient({
    piPath,
    args,
    env,
    cwd,
    traceTag: panelId.slice(0, 8),
    handlers: {
      onEvent: (event) => {
        if (disposed) return;
        if (event.type === "agent_start") streaming = true;
        else if (event.type === "agent_settled") streaming = false;
        panel.webview.postMessage({ type: "event", event });
        if (event.type === "agent_settled") {
          if (needsSessionFile) {
            void rpc
              .getState()
              .then((s) => applySessionFile(s.sessionFile, s.sessionName))
              .catch(() => {});
          }
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
  activePanels.set(panelId, handle);
  if (opts.sessionFile) sessionToPanel.set(opts.sessionFile, panelId);

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
    }
    handle.sessionFile = sessionFile;
    sessionToPanel.set(sessionFile, panelId);
    opts.tracker.update(panelId, sessionFile);
    panel.title = CHAT_PANEL_TITLE + (sessionName ? ` \u2014 ${sessionName}` : "");
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
      const usage = await rpc.getSessionStats();
      if (!disposed) panel.webview.postMessage({ type: "contextUsage", usage });
    } catch {
      // ignore - stats are best-effort
    }
  }

  async function refreshContextAfterCompaction(event: RpcEvent): Promise<void> {
    if (disposed) return;
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

  function toast(text: string, kind?: "info" | "success" | "error"): void {
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

  async function handleBuiltin(message: string): Promise<boolean> {
    const parsed = parseBuiltin(message);
    if (!parsed) return false;
    const { name, args } = parsed;
    try {
      switch (name) {
        case "compact": {
          const result = await rpc.compact(args || undefined);
          const parts: string[] = [
            "**Compaction completed.**" + (args ? " _(custom instructions applied)_" : ""),
          ];
          if (result.tokensBefore != null) {
            parts.push(`Tokens before: **${result.tokensBefore}**`);
          }
          if (result.summary) parts.push("", result.summary);
          showInfoPanel("Compaction", parts.join("\n\n"));
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
          try {
            await rpc.setSessionName(args);
          } catch (e) {
            if (String(e instanceof Error ? e.message : e).includes("set_session_name")) {
              toast("Setting the session name requires a newer pi. Please upgrade.", "error");
              break;
            }
            throw e;
          }
          const st = await rpc.getState();
          applySessionFile(st.sessionFile, args);
          panel.webview.postMessage({ type: "state", state: st });
          toast(`Session name set: ${args}`, "success");
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
      panel.webview.postMessage({ type: "models", models });
      panel.webview.postMessage({ type: "thinkingLevels", levels });
      panel.webview.postMessage({ type: "commands", commands: mergeBuiltinCommands(cmds) });
      applySessionFile(st.sessionFile, st.sessionName);
      const messages = await rpc.getMessages();
      panel.webview.postMessage({ type: "messages", messages });
      if (st.isStreaming)
        panel.webview.postMessage({ type: "event", event: { type: "agent_start" } });
      void sendContextUsage();
    } catch (e) {
      panel.webview.postMessage({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function handleExtUiRequest(req: ExtensionUiRequest): void {
    if (
      req.method === "select" ||
      req.method === "confirm" ||
      req.method === "input" ||
      req.method === "editor"
    ) {
      panel.webview.postMessage({ type: "dialog", request: req });
    } else if (req.method === "setWidget") {
      if (req.widgetKey === "btw") {
        const lines = req.widgetLines as string[] | undefined;
        if (lines && lines.length >= 2) {
          if (!disposed) {
            panel.webview.postMessage({
              type: "infoPanel",
              title: String(lines[0]),
              markdown: lines.slice(1).join("\n"),
            });
            panel.webview.postMessage({ type: "btwLoading", text: null });
          }
        } else if (lines && lines.length === 1) {
          if (!disposed) panel.webview.postMessage({ type: "btwLoading", text: String(lines[0]) });
        } else if (!disposed) {
          panel.webview.postMessage({ type: "btwLoading", text: null });
        }
        return;
      }
      if (!disposed)
        panel.webview.postMessage({
          type: "widget",
          widgetKey: req.widgetKey,
          widgetLines: req.widgetLines,
        });
    } else if (req.method === "notify") {
      if (!disposed) {
        const t = req.notifyType as string | undefined;
        const kind: "info" | "success" | "error" =
          t === "error" ? "error" : t === "success" ? "success" : "info";
        panel.webview.postMessage({ type: "toast", text: String(req.message ?? ""), kind });
      }
    }
    // Other fire-and-forget methods (setStatus, setTitle, ...) are ignored.
  }

  panel.webview.onDidReceiveMessage(async (msg) => {
    switch (msg.type) {
      case "prompt":
        try {
          if (await handleBuiltin(msg.message)) break;
          await rpc.prompt(msg.message, msg.streamingBehavior);
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
      case "setThinking":
        try {
          await rpc.setThinkingLevel(msg.level);
          const st = await rpc.getState();
          panel.webview.postMessage({ type: "state", state: st });
        } catch {
          // ignore
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
      case "newSession":
        try {
          await rpc.newSession();
          const st = await rpc.getState();
          applySessionFile(st.sessionFile, st.sessionName);
          panel.webview.postMessage({ type: "state", state: st });
          const messages = await rpc.getMessages();
          panel.webview.postMessage({ type: "messages", messages });
          void sendContextUsage();
        } catch (e) {
          panel.webview.postMessage({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
        break;
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
          await rpc.prompt(`/pi-vscode-tree ${revEntry.id}`);
          const revSt = await rpc.getState();
          applySessionFile(revSt.sessionFile, revSt.sessionName);
          panel.webview.postMessage({ type: "state", state: revSt });
          const revMsgs = await rpc.getMessages();
          panel.webview.postMessage({ type: "messages", messages: revMsgs });
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
      case "todoClear":
        void rpc.prompt("/todo-clear", streaming ? "steer" : undefined).catch(() => {});
        break;
    }
  });

  panel.onDidDispose(() => {
    disposed = true;
    activePanels.delete(panelId);
    if (handle.sessionFile) sessionToPanel.delete(handle.sessionFile);
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
