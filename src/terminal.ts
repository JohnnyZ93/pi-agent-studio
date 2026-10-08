import * as vscode from "vscode";
import type { BridgeConfig } from "./bridge/types.ts";
import { createPiEnvironment, createPiShellArgs, ensurePiBinary } from "./pi.ts";

/**
 * Terminals created by createNewTerminal(), tracked by identity so pi
 * terminals can be recognized without a static `name` (see below — a
 * static name would freeze the tab title and prevent it from tracking
 * pi's own live OSC-0 title updates).
 */
const piTerminals = new WeakSet<vscode.Terminal>();

export function isPiTerminal(terminal: vscode.Terminal): boolean {
  return piTerminals.has(terminal);
}

export async function createNewTerminal(options: {
  extensionUri: vscode.Uri;
  bridgeConfig?: BridgeConfig;
  extraArgs?: string[];
  terminalId?: string;
  sessionFile?: string;
  cwd?: string;
}): Promise<vscode.Terminal | undefined> {
  const piPath = await ensurePiBinary();
  if (!piPath) return undefined;

  const cwd = options.cwd ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const viewColumn = findPiColumn() ?? findUnusedColumn() ?? vscode.ViewColumn.Beside;

  const piArgs = createPiShellArgs({
    extensionUri: options.extensionUri,
    sessionFile: options.sessionFile,
    extraArgs: options.extraArgs,
  });

  const baseEnv = createPiEnvironment(options.bridgeConfig, options.extensionUri);
  const userEnv =
    vscode.workspace.getConfiguration("pi-agent-studio").get<Record<string, string>>("env") ?? {};
  const env = {
    ...userEnv,
    ...baseEnv,
    ...(options.terminalId ? { PI_VSCODE_TERMINAL_ID: options.terminalId } : {}),
  };

  // No `name`: an extension-supplied name is stored by VS Code as a static
  // title (`TitleEventSource.Api`), which makes `TerminalLabelComputer`
  // return it verbatim from `computeLabel()` and never expand the
  // `terminal.integrated.tabs.title` template — so the tab would never pick
  // up pi's own live OSC-0 title. Leaving `name` unset lets the tab title
  // track pi's title normally, same as a plain shell terminal.
  const terminal = vscode.window.createTerminal({
    shellPath: piPath,
    shellArgs: piArgs,
    location: { viewColumn },
    isTransient: true,
    cwd,
    env,
    iconPath: {
      light: vscode.Uri.joinPath(options.extensionUri, "assets", "logo-light.svg"),
      dark: vscode.Uri.joinPath(options.extensionUri, "assets", "logo.svg"),
    },
  });
  piTerminals.add(terminal);

  return terminal;
}

/**
 * Tabs don't expose the underlying `vscode.Terminal` object, so the only way
 * to correlate a tab with one of our terminals is by matching the tab's
 * current label against the current `name` of a tracked pi terminal (kept in
 * sync by VS Code as pi's live title changes).
 */
function findPiColumn(): vscode.ViewColumn | undefined {
  const ourNames = new Set(
    vscode.window.terminals.filter(isPiTerminal).map((terminal) => terminal.name),
  );
  if (ourNames.size === 0) return undefined;
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputTerminal && ourNames.has(tab.label)) {
        return group.viewColumn;
      }
    }
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
