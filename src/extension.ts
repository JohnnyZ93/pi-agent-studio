import { randomUUID } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import * as vscode from "vscode";
import { createBridge } from "./bridge/server.ts";
import { TERMINAL_TITLE } from "./constants.ts";
import { upgradePiBinary, invalidatePiBinaryCache } from "./pi.ts";
import { createSessionTracker } from "./sessions.ts";
import { createNewTerminal, lockPiEditorGroup } from "./terminal.ts";
import { createChatTracker } from "./chat/chat-tracker.ts";
import { disposeRpcTrace } from "./chat/rpc-trace.ts";

let extensionUri: vscode.Uri;
let bridgeConfig: { url: string; token: string } | undefined;
let bridgeDispose: (() => Promise<void>) | undefined;

/** Wrap a lazy WebviewViewProvider factory so the implementing module (and its
 *  dependency tree, e.g. the pi SDK) is only imported when the user first opens
 *  the corresponding sidebar view, not at activation time. */
function lazyViewProvider(
  factory: () => Promise<vscode.WebviewViewProvider>,
): vscode.WebviewViewProvider {
  let pending: Promise<vscode.WebviewViewProvider> | undefined;
  const resolve = () => (pending ??= factory());
  return {
    async resolveWebviewView(
      webviewView: vscode.WebviewView,
      context: vscode.WebviewViewResolveContext,
      token: vscode.CancellationToken,
    ) {
      const provider = await resolve();
      return provider.resolveWebviewView(webviewView, context, token);
    },
  };
}

export async function activate(context: vscode.ExtensionContext) {
  extensionUri = context.extensionUri;

  const sessions = createSessionTracker(context);
  const chatTracker = createChatTracker(context);
  const bridge = await createBridge(
    context,
    (terminalId, sessionFile) => {
      sessions.update(terminalId, sessionFile);
    },
    (terminalId) => sessions.findSessionFileByTerminalId(terminalId),
  );
  bridgeConfig = { url: bridge.url, token: bridge.token };
  bridgeDispose = () => bridge.dispose();
  context.subscriptions.push({
    dispose: () => {
      const dispose = bridgeDispose;
      bridgeDispose = undefined;
      bridgeConfig = undefined;
      void dispose?.();
    },
  });

  const rewindProvider: vscode.TextDocumentContentProvider = {
    provideTextDocumentContent(uri: vscode.Uri): string {
      const parts = String(uri.path || "")
        .replace(/^\/+/, "")
        .split("/");
      if (parts[0] === "empty") return "";
      if (parts[0] === "snapshot" && parts[1] && parts[2]) {
        try {
          return readFileSync(join(homedir(), ".pi", "snapshots", parts[1], parts[2]), "utf8");
        } catch {
          return "";
        }
      }
      return "";
    },
  };
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider("pi-rewind", rewindProvider),
  );

  const openTerminal = async (extraArgs?: string[]): Promise<vscode.Terminal | undefined> => {
    const terminalId = randomUUID();
    const terminal = await createNewTerminal({
      extensionUri,
      bridgeConfig,
      extraArgs,
      terminalId,
    });
    if (terminal) sessions.track(terminal, terminalId);
    return terminal;
  };

  const openTerminalInCwd = async (cwd: string): Promise<vscode.Terminal | undefined> => {
    const terminalId = randomUUID();
    const terminal = await createNewTerminal({
      extensionUri,
      bridgeConfig,
      terminalId,
      cwd,
    });
    if (terminal) sessions.track(terminal, terminalId);
    return terminal;
  };

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = "$(pi-logo) Pi";
  statusBarItem.tooltip = "Open Pi Terminal";
  statusBarItem.command = "pi-agent-studio.open";
  statusBarItem.show();

  context.subscriptions.push(
    statusBarItem,
    vscode.window.onDidCloseTerminal((terminal) => sessions.onClose(terminal)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("pi-agent-studio.path")) invalidatePiBinaryCache();
    }),
    vscode.commands.registerCommand("pi-agent-studio.open", async () => {
      if (useWebviewUi()) {
        const { openChatPanel } = await import("./chat/chat-panel.ts");
        await openChatPanel({ extensionUri, bridgeConfig, tracker: chatTracker });
        return;
      }
      const terminal = await openTerminal();
      terminal?.show();
      lockPiEditorGroup();
    }),
    vscode.commands.registerCommand("pi-agent-studio.openInNewWindow", async () => {
      if (useWebviewUi()) {
        const { openChatPanel } = await import("./chat/chat-panel.ts");
        await openChatPanel({ extensionUri, bridgeConfig, tracker: chatTracker });
        try {
          await vscode.commands.executeCommand("workbench.action.moveEditorToNewWindow");
        } catch {
          // ignore
        }
        return;
      }
      const terminal = await openTerminal();
      if (!terminal) return;
      terminal.show();
      await vscode.commands.executeCommand("workbench.action.moveEditorToNewWindow");
    }),
    vscode.commands.registerCommand("pi-agent-studio.openInFolder", async (uri?: vscode.Uri) => {
      const cwd = resolveExplorerCwd(uri);
      if (!cwd) {
        void vscode.window.showErrorMessage(
          "Pi: Unable to resolve a folder from the selected item.",
        );
        return;
      }
      if (useWebviewUi()) {
        const { openChatPanel } = await import("./chat/chat-panel.ts");
        await openChatPanel({ extensionUri, bridgeConfig, tracker: chatTracker, cwd });
        return;
      }
      const terminal = await openTerminalInCwd(cwd);
      terminal?.show();
      lockPiEditorGroup();
    }),
    vscode.commands.registerCommand("pi-agent-studio.upgrade", upgradePiBinary),
    vscode.commands.registerCommand("pi-agent-studio.openSettingsJson", async () => {
      const { ensureSettingsJsonExists } = await import("./settings/settings-config.ts");
      const path = ensureSettingsJsonExists();
      const doc = await vscode.workspace.openTextDocument(path);
      await vscode.window.showTextDocument(doc);
    }),
    vscode.commands.registerCommand("pi-agent-studio.openModelsJson", async () => {
      const { ensureModelsJsonExists } = await import("./models/models-config.ts");
      const path = ensureModelsJsonExists();
      const doc = await vscode.workspace.openTextDocument(path);
      await vscode.window.showTextDocument(doc);
    }),
    vscode.commands.registerCommand("pi-agent-studio.generateGitCommitMessage", async (scm) => {
      const { generateCommitMsg } = await import("./gitCommit/commitMessageGenerator.ts");
      generateCommitMsg(scm);
    }),
    vscode.commands.registerCommand("pi-agent-studio.abortGitCommitMessage", async () => {
      const { abortCommitGeneration } = await import("./gitCommit/commitMessageGenerator.ts");
      abortCommitGeneration();
    }),
    vscode.window.registerWebviewViewProvider(
      "pi-agent-studio.sessions",
      lazyViewProvider(async () => {
        const { createSessionsViewProvider } = await import("./sessions/sessions-sidebar.ts");
        return createSessionsViewProvider(extensionUri, bridgeConfig!, sessions, chatTracker);
      }),
    ),
    vscode.window.registerWebviewViewProvider(
      "pi-agent-studio.models",
      lazyViewProvider(async () => {
        const { createModelsViewProvider } = await import("./models/models-sidebar.ts");
        return createModelsViewProvider();
      }),
    ),
    vscode.window.registerWebviewViewProvider(
      "pi-agent-studio.agents",
      lazyViewProvider(async () => {
        const { createAgentsViewProvider } = await import("./agents/agents-sidebar.ts");
        return createAgentsViewProvider(extensionUri);
      }),
    ),
    vscode.window.registerWebviewViewProvider(
      "pi-agent-studio.prompts",
      lazyViewProvider(async () => {
        const { createPromptsViewProvider } = await import("./prompts/prompts-sidebar.ts");
        return createPromptsViewProvider();
      }),
    ),
    vscode.window.registerWebviewViewProvider(
      "pi-agent-studio.skills",
      lazyViewProvider(async () => {
        const { createSkillsViewProvider } = await import("./skills/skills-sidebar.ts");
        return createSkillsViewProvider();
      }),
    ),
    vscode.window.registerWebviewViewProvider(
      "pi-agent-studio.mcp",
      lazyViewProvider(async () => {
        const { createMcpViewProvider } = await import("./mcp/mcp-sidebar.ts");
        return createMcpViewProvider();
      }),
    ),
    vscode.window.registerWebviewViewProvider(
      "pi-agent-studio.settings",
      lazyViewProvider(async () => {
        const { createSettingsViewProvider } = await import("./settings/settings-sidebar.ts");
        return createSettingsViewProvider();
      }),
    ),
  );

  if (bridgeConfig) void sessions.restore(extensionUri, bridgeConfig);
  if (useWebviewUi()) {
    void chatTracker.restore(async (sessionFile, panelId) => {
      const { openChatPanel } = await import("./chat/chat-panel.ts");
      await openChatPanel({
        extensionUri,
        bridgeConfig,
        tracker: chatTracker,
        sessionFile,
        panelId,
      });
    });
  }
}

function useWebviewUi(): boolean {
  return vscode.workspace.getConfiguration("pi-agent-studio").get<string>("ui") === "webview";
}

export async function deactivate() {
  try {
    const { disposeAllChatPanels } = await import("./chat/chat-panel.ts");
    disposeAllChatPanels();
  } catch {
    // chat module never loaded — nothing to dispose
  }
  disposeRpcTrace();
  for (const terminal of vscode.window.terminals) {
    if (terminal.name === TERMINAL_TITLE) terminal.dispose();
  }
  const dispose = bridgeDispose;
  bridgeDispose = undefined;
  bridgeConfig = undefined;
  await dispose?.();
}

/**
 * Resolve a usable cwd from an Explorer-context command argument.
 *  - File   -> use its parent directory
 *  - Folder -> use as-is
 *  - Missing on disk -> return undefined
 *  - No uri (e.g. invoked from command palette) -> fall back to first workspace folder
 */
function resolveExplorerCwd(uri: vscode.Uri | undefined): string | undefined {
  if (!uri || uri.scheme !== "file") {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }
  const fsPath = uri.fsPath;
  try {
    const stat = statSync(fsPath);
    return stat.isDirectory() ? fsPath : dirname(fsPath);
  } catch {
    return undefined;
  }
}
