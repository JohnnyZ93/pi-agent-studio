import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { sep } from "node:path";
import * as vscode from "vscode";
import type { BridgeConfig } from "../bridge/types.ts";
import { ensurePiBinary } from "../pi.ts";
import { getChatWebviewHtml, resolveChatBackground } from "./chat-webview.ts";
import { getLocale, t } from "../i18n.ts";
import type { ChatTracker } from "./chat-tracker.ts";
import type { RpcClient } from "./chat-types.ts";
import {
  createChatSession,
  type ChatHost,
  type ChatSession,
  type ChatSessionUpdate,
} from "./chat-session.ts";
import { sessionStatusRegistry } from "../session-status-registry.ts";

export { type ChatSessionUpdate } from "./chat-session.ts";

export interface ChatPanelHandle {
  panel: vscode.WebviewPanel;
  rpc: RpcClient;
  panelId: string;
  sessionFile?: string;
  sync?: (opts: ChatSessionUpdate) => void;
}

export interface OpenChatPanelOptions {
  extensionUri: vscode.Uri;
  bridgeConfig?: BridgeConfig;
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
  const chatCfg = vscode.workspace.getConfiguration("pi-agent-studio");
  panel.webview.html = getChatWebviewHtml(
    homedir(),
    sep,
    chatCfg.get<number>("chatFontSize"),
    getLocale(),
    chatCfg.get<string>("chatMermaidTheme"),
    resolveChatBackground(panel.webview, chatCfg.get<string>("chatBackgroundImage")),
    chatCfg.get<number>("chatBackgroundOpacity"),
    chatCfg.get<string>("chatSendShortcut"),
  );

  let disposed = false;

  const langSub = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("pi-agent-studio.chatSendShortcut")) {
      const cfg = vscode.workspace.getConfiguration("pi-agent-studio");
      panel.webview.postMessage({
        type: "sendShortcut",
        value: cfg.get<string>("chatSendShortcut") ?? "enter",
      });
    }
    if (
      e.affectsConfiguration("pi-agent-studio.language") ||
      e.affectsConfiguration("pi-agent-studio.chatMermaidTheme")
    ) {
      const cfg = vscode.workspace.getConfiguration("pi-agent-studio");
      panel.webview.html = getChatWebviewHtml(
        homedir(),
        sep,
        cfg.get<number>("chatFontSize"),
        getLocale(),
        cfg.get<string>("chatMermaidTheme"),
        resolveChatBackground(panel.webview, cfg.get<string>("chatBackgroundImage")),
        cfg.get<number>("chatBackgroundOpacity"),
        cfg.get<string>("chatSendShortcut"),
      );
    }
  });

  const host: ChatHost = {
    postMessage: (msg) => {
      if (disposed) return;
      panel.webview.postMessage(msg);
    },
    onDidReceiveMessage: (listener) => panel.webview.onDidReceiveMessage(listener),
    onDidDispose: (listener) => panel.onDidDispose(listener),
    updateTitle: (running, sessionName) => {
      if (disposed) return;
      panel.title =
        (running ? "🔵 " : "🟢 ") + t("Pi Chat") + (sessionName ? ` \u2014 ${sessionName}` : "");
    },
  };

  let session: ChatSession | undefined;
  session = await createChatSession({
    extensionUri: opts.extensionUri,
    bridgeConfig: opts.bridgeConfig,
    sessionFile: opts.sessionFile,
    cwd: opts.cwd ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    traceTag: panelId.slice(0, 8),
    host,
    onSessionFile: (sessionFile, _name, previous) => {
      if (previous && previous !== sessionFile) {
        sessionToPanel.delete(previous);
        sessionStatusRegistry.remove(previous);
      }
      if (sessionFile) {
        sessionToPanel.set(sessionFile, panelId);
        opts.tracker.update(panelId, sessionFile);
        sessionStatusRegistry.upsert({
          sessionFile,
          status: session?.streaming ? "running" : "idle",
          source: "chat",
          panelId,
        });
      }
    },
    onStreamingChange: (running) => {
      if (session?.sessionFile) {
        sessionStatusRegistry.upsert({
          sessionFile: session.sessionFile,
          status: running ? "running" : "idle",
          source: "chat",
          panelId,
        });
      }
    },
    onExit: () => {
      if (session?.sessionFile) sessionStatusRegistry.remove(session.sessionFile);
    },
  });
  if (!session) {
    panel.dispose();
    return undefined;
  }

  const handle: ChatPanelHandle = {
    panel,
    rpc: session.rpc,
    panelId,
    get sessionFile() {
      return session.sessionFile;
    },
    sync: session.sync,
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

  panel.onDidDispose(() => {
    langSub.dispose();
    disposed = true;
    activePanels.delete(panelId);
    if (handle.sessionFile) {
      sessionToPanel.delete(handle.sessionFile);
      sessionStatusRegistry.remove(handle.sessionFile);
    }
    opts.tracker.removePanel(panelId);
    session.dispose();
  });

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
