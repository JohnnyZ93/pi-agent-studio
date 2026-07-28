import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { dirname } from "node:path";
import * as vscode from "vscode";
import { createBridge } from "./bridge/server.ts";
import { TERMINAL_TITLE } from "./constants.ts";
import { upgradePiBinary, invalidatePiBinaryCache } from "./pi.ts";
import { createSessionsViewProvider } from "./sessions/sessions-sidebar.ts";
import { createModelsViewProvider } from "./models/models-sidebar.ts";
import { ensureModelsJsonExists } from "./models/models-config.ts";
import { createAgentsViewProvider } from "./agents/agents-sidebar.ts";
import { createSettingsViewProvider } from "./settings/settings-sidebar.ts";
import { ensureSettingsJsonExists } from "./settings/settings-config.ts";
import { createSessionTracker } from "./sessions.ts";
import { createNewTerminal, lockPiEditorGroup } from "./terminal.ts";
import { abortCommitGeneration, generateCommitMsg } from "./gitCommit/commitMessageGenerator.ts";
import { createChatTracker } from "./chat/chat-tracker.ts";
import { disposeAllChatPanels, openChatPanel } from "./chat/chat-panel.ts";
import { disposeRpcTrace } from "./chat/rpc-trace.ts";

let extensionUri: vscode.Uri;
let bridgeConfig: { url: string; token: string } | undefined;
let bridgeDispose: (() => Promise<void>) | undefined;

export async function activate(context: vscode.ExtensionContext) {
  extensionUri = context.extensionUri;

  const sessions = createSessionTracker(context);
  const chatTracker = createChatTracker(context);
  const bridge = await createBridge(context, (terminalId, sessionFile) => {
    sessions.update(terminalId, sessionFile);
  });
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
        await openChatPanel({ extensionUri, bridgeConfig, tracker: chatTracker });
        return;
      }
      const terminal = await openTerminal();
      terminal?.show();
      lockPiEditorGroup();
    }),
    vscode.commands.registerCommand("pi-agent-studio.openInNewWindow", async () => {
      if (useWebviewUi()) {
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
        await openChatPanel({ extensionUri, bridgeConfig, tracker: chatTracker, cwd });
        return;
      }
      const terminal = await openTerminalInCwd(cwd);
      terminal?.show();
      lockPiEditorGroup();
    }),
    vscode.commands.registerCommand("pi-agent-studio.upgrade", upgradePiBinary),
    vscode.commands.registerCommand("pi-agent-studio.openSettingsJson", async () => {
      const path = ensureSettingsJsonExists();
      const doc = await vscode.workspace.openTextDocument(path);
      await vscode.window.showTextDocument(doc);
    }),
    vscode.commands.registerCommand("pi-agent-studio.openModelsJson", async () => {
      const path = ensureModelsJsonExists();
      const doc = await vscode.workspace.openTextDocument(path);
      await vscode.window.showTextDocument(doc);
    }),
    vscode.commands.registerCommand("pi-agent-studio.generateGitCommitMessage", async (scm) => {
      generateCommitMsg(scm);
    }),
    vscode.commands.registerCommand("pi-agent-studio.abortGitCommitMessage", () => {
      abortCommitGeneration();
    }),
    vscode.window.registerWebviewViewProvider(
      "pi-agent-studio.sessions",
      createSessionsViewProvider(extensionUri, bridgeConfig, sessions, chatTracker),
    ),
    vscode.window.registerWebviewViewProvider("pi-agent-studio.models", createModelsViewProvider()),
    vscode.window.registerWebviewViewProvider(
      "pi-agent-studio.agents",
      createAgentsViewProvider(extensionUri),
    ),
    vscode.window.registerWebviewViewProvider(
      "pi-agent-studio.settings",
      createSettingsViewProvider(),
    ),
  );

  if (bridgeConfig) void sessions.restore(extensionUri, bridgeConfig);
  if (useWebviewUi()) {
    void chatTracker.restore(async (sessionFile, panelId) => {
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
  disposeAllChatPanels();
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
 *  - File   → use its parent directory
 *  - Folder → use as-is
 *  - Missing on disk → return undefined
 *  - No uri (e.g. invoked from command palette) → fall back to first workspace folder
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
