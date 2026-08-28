// Sidebar chat: hosts the pi-chat webview UI in a WebviewView (own `pi-chat`
// activity bar container, separate from the Pi sessions/settings container)
// instead of an editor-tab WebviewPanel. A single session runs in the
// background; closing/hiding the view keeps the RPC subprocess alive, and
// re-resolving the view re-attaches the same session. No RPC process is
// spawned until the user explicitly starts the chat (the view shows a
// starter screen with a button, or `pi-agent-studio.openInSidebar` is run),
// so merely opening the container costs nothing.

import { homedir } from "node:os";
import { sep } from "node:path";
import * as vscode from "vscode";
import type { BridgeConfig } from "../bridge/types.ts";
import { getLocale, t } from "../i18n.ts";
import { getChatWebviewHtml, resolveChatBackground } from "./chat-webview.ts";
import { createChatSession, type ChatHost, type ChatSession } from "./chat-session.ts";

export const SIDEBAR_VIEW_ID = "pi-agent-studio.chatSidebar";
const CHAT_CONTAINER_COMMAND = "workbench.view.extension.pi-chat";

interface SidebarState {
  view?: vscode.WebviewView;
  session?: ChatSession;
}

interface SidebarChatOptions {
  extensionUri: vscode.Uri;
  bridgeConfig?: BridgeConfig;
  sessionFile?: string;
  newSession?: boolean;
}

let sidebarState: SidebarState | undefined;
let currentHost: ChatHost | undefined;
let pendingSession: Promise<ChatSession | undefined> | undefined;
let viewWaiters: Array<(view: vscode.WebviewView) => void> = [];

function waitForView(): Promise<vscode.WebviewView | undefined> {
  if (sidebarState?.view) return Promise.resolve(sidebarState.view);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const i = viewWaiters.indexOf(settle);
      if (i >= 0) viewWaiters.splice(i, 1);
      resolve(undefined);
    }, 5000);
    const settle = (view: vscode.WebviewView) => {
      clearTimeout(timer);
      const i = viewWaiters.indexOf(settle);
      if (i >= 0) viewWaiters.splice(i, 1);
      resolve(view);
    };
    viewWaiters.push(settle);
  });
}

function getChatHtml(webview: vscode.Webview): string {
  const cfg = vscode.workspace.getConfiguration("pi-agent-studio");
  return getChatWebviewHtml(
    homedir(),
    sep,
    cfg.get<number>("chatFontSize"),
    getLocale(),
    cfg.get<string>("chatMermaidTheme"),
    resolveChatBackground(webview, cfg.get<string>("chatBackgroundImage")),
    cfg.get<number>("chatBackgroundOpacity"),
  );
}

function getStarterHtml(): string {
  const zh = getLocale() === "zh-cn";
  const nonce = "starter" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `<!DOCTYPE html>
<html lang="${zh ? "zh-cn" : "en"}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
<style>
html, body { height: 100%; }
body {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; margin: 0; padding: 24px; box-sizing: border-box;
  background: var(--vscode-sideBar-background);
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family); font-size: var(--vscode-font-size);
}
.title { font-size: 15px; font-weight: 600; }
.hint { font-size: 12px; color: var(--vscode-descriptionForeground); text-align: center; line-height: 1.6; }
button {
  padding: 6px 16px; margin-top: 4px;
  background: var(--vscode-button-background); color: var(--vscode-button-foreground);
  border: none; border-radius: 2px; cursor: pointer; font-family: inherit; font-size: 13px;
}
button:hover { background: var(--vscode-button-hoverBackground); }
</style>
</head>
<body>
<div class="title">Pi Chat</div>
<div class="hint">${zh ? "点击开始，Pi 将在后台启动一个会话。" : "Start a session to chat with Pi."}</div>
<button id="start">${zh ? "开始聊天" : "Start Chat"}</button>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
document.getElementById("start").addEventListener("click", () => vscode.postMessage({ type: "startSession" }));
</script>
</body>
</html>`;
}

function makeHost(webviewView: vscode.WebviewView): ChatHost {
  let viewDisposed = false;
  const host: ChatHost = {
    postMessage: (msg) => {
      if (viewDisposed) return;
      void webviewView.webview.postMessage(msg);
    },
    onDidReceiveMessage: (listener) => webviewView.webview.onDidReceiveMessage(listener),
    onDidDispose: (listener) => webviewView.onDidDispose(listener),
  };
  webviewView.onDidDispose(() => {
    viewDisposed = true;
  });
  return host;
}

function ensureSidebarSession(opts: SidebarChatOptions): Promise<ChatSession | undefined> {
  if (sidebarState?.session) return Promise.resolve(sidebarState.session);
  pendingSession ??= (async () => {
    const host = currentHost;
    if (!host) return undefined;
    const session = await createChatSession({
      extensionUri: opts.extensionUri,
      bridgeConfig: opts.bridgeConfig,
      sessionFile: opts.sessionFile,
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
      traceTag: "sidebar",
      host,
    });
    if (session) sidebarState = { ...sidebarState, session };
    pendingSession = undefined;
    return session;
  })();
  return pendingSession;
}

async function startSidebarSession(
  webviewView: vscode.WebviewView,
  host: ChatHost,
  opts: SidebarChatOptions,
): Promise<void> {
  const session = await ensureSidebarSession(opts);
  if (!session || sidebarState?.view !== webviewView) return;
  webviewView.webview.html = getChatHtml(webviewView.webview);
  session.attach(host);
}

export function createChatSidebarViewProvider(
  opts: SidebarChatOptions,
): vscode.WebviewViewProvider {
  return {
    resolveWebviewView(webviewView: vscode.WebviewView) {
      webviewView.webview.options = {
        enableScripts: true,
        retainContextWhenHidden: true,
      } as vscode.WebviewOptions & { retainContextWhenHidden?: boolean };
      webviewView.webview.html = sidebarState?.session
        ? getChatHtml(webviewView.webview)
        : getStarterHtml();

      const host = makeHost(webviewView);
      currentHost = host;
      sidebarState = { ...sidebarState, view: webviewView };

      const startSub = webviewView.webview.onDidReceiveMessage((msg) => {
        if (msg && typeof msg === "object" && (msg as { type?: unknown }).type === "startSession") {
          void startSidebarSession(webviewView, host, opts);
        }
      });

      const langSub = vscode.workspace.onDidChangeConfiguration((e) => {
        if (
          e.affectsConfiguration("pi-agent-studio.language") ||
          e.affectsConfiguration("pi-agent-studio.chatMermaidTheme")
        ) {
          if (sidebarState?.session) {
            webviewView.webview.html = getChatHtml(webviewView.webview);
            sidebarState.session.attach(host);
          } else if (sidebarState?.view === webviewView) {
            webviewView.webview.html = getStarterHtml();
          }
        }
      });

      if (sidebarState.session) {
        sidebarState.session.attach(host);
      }

      webviewView.onDidDispose(() => {
        langSub.dispose();
        startSub.dispose();
        if (currentHost === host) currentHost = undefined;
        if (sidebarState?.view === webviewView) {
          // Keep the session running in the background; it re-attaches on re-resolve.
          sidebarState = { ...sidebarState, view: undefined };
        }
      });

      for (const w of viewWaiters) w(webviewView);
      viewWaiters = [];
    },
  };
}

export async function openSidebarChat(opts: SidebarChatOptions): Promise<void> {
  await vscode.commands.executeCommand(CHAT_CONTAINER_COMMAND);
  await vscode.commands.executeCommand(`${SIDEBAR_VIEW_ID}.focus`);
  const view = await waitForView();
  if (!view) return;

  if (!sidebarState?.session) {
    const host = currentHost;
    if (!host) return;
    await startSidebarSession(view, host, opts);
  }

  const session = sidebarState?.session;
  if (!session) return;

  if (opts.newSession) {
    if (session.sessionFile) {
      if (session.streaming) {
        void vscode.window.showWarningMessage(t("Stop the agent before starting a new session."));
        return;
      }
      await session.newSession();
    }
    void view.show(true);
    return;
  }

  if (opts.sessionFile && session.sessionFile !== opts.sessionFile) {
    if (session.streaming) {
      void vscode.window.showWarningMessage(t("Stop the agent before switching sessions."));
      return;
    }
    const choice = await vscode.window.showWarningMessage(
      t(
        "Switch the sidebar chat to the selected session? The current conversation stays open in the background.",
      ),
      { modal: true },
      t("Switch"),
    );
    if (choice !== t("Switch")) return;
    await session.switchTo(opts.sessionFile);
  }
  void view.show(true);
}

export function disposeSidebarChat(): void {
  if (sidebarState?.session) {
    sidebarState.session.dispose();
  }
  sidebarState = undefined;
  currentHost = undefined;
  pendingSession = undefined;
  viewWaiters = [];
}
