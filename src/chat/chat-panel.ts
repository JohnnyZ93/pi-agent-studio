import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, relative, sep } from "node:path";
import * as vscode from "vscode";
import { createRpcEnvironment, createRpcShellArgs, ensurePiBinary } from "../pi.ts";
import { getGitBranch } from "../gitCommit/gitUtils.ts";
import { getChatHtml } from "./chat-html.ts";
import type { ChatTracker } from "./chat-tracker.ts";
import type { ExtensionUiRequest, RpcClient } from "./chat-types.ts";
import { createRpcClient } from "./rpc-client.ts";

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
  const autoApprove =
    vscode.workspace.getConfiguration("pi-agent-studio").get<boolean>("autoApproveTools") ?? false;

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
  const env = createRpcEnvironment(opts.bridgeConfig);
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
        } else if (event.type === "compaction_end") {
          void sendContextUsage();
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
    if (name) sessionName = name;
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
      panel.webview.postMessage({ type: "commands", commands: cmds });
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
      if (autoApprove) {
        if (req.method === "confirm") {
          rpc.respondExtensionUi(req.id, { confirmed: true });
        } else if (req.method === "select") {
          const options = (req.options as string[] | undefined) ?? [];
          const allow = options.find((o) => /allow/i.test(String(o))) ?? options[0] ?? undefined;
          rpc.respondExtensionUi(req.id, { value: allow != null ? String(allow) : undefined });
        } else {
          // input/editor cannot be auto-approved; surface to the user.
          panel.webview.postMessage({ type: "dialog", request: req });
        }
      } else {
        panel.webview.postMessage({ type: "dialog", request: req });
      }
    } else if (req.method === "setWidget") {
      if (!disposed)
        panel.webview.postMessage({
          type: "widget",
          widgetKey: req.widgetKey,
          widgetLines: req.widgetLines,
        });
    }
    // Other fire-and-forget methods (notify, setStatus, ...) are ignored.
  }

  panel.webview.onDidReceiveMessage(async (msg) => {
    switch (msg.type) {
      case "prompt":
        try {
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
