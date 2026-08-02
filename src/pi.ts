import { accessSync, constants, realpathSync } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import {
  BRIDGE_EXTENSION_PATH,
  BTW_EXTENSION_PATH,
  BUILTIN_AGENTS_DIR,
  PERMISSION_GATE_EXTENSION_PATH,
  QUESTIONNAIRE_EXTENSION_PATH,
  REWIND_CODE_EXTENSION_PATH,
  SUBAGENT_EXTENSION_PATH,
  TODO_EXTENSION_PATH,
} from "./constants.ts";
import { resolvePiBinary } from "./_resolve.ts";
import {
  createPiGlobalInstallCommand,
  createPiUpdateCommand,
  guessPiPackageManager,
  PI_PACKAGE_MANAGERS,
  type PiPackageManager,
} from "./upgrade.ts";

let piExistsCache: boolean | undefined;

/** Invalidate the cached existence check; call when `pi-agent-studio.path` changes. */
export function invalidatePiBinaryCache(): void {
  piExistsCache = undefined;
}

export function findPiBinary(): string {
  const config = vscode.workspace.getConfiguration("pi-agent-studio");
  return resolvePiBinary({
    customPath: config.get<string>("path") || undefined,
    workspaceDirs: (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
  });
}

export async function ensurePiBinary(): Promise<string | undefined> {
  const piPath = findPiBinary();

  if (piExistsCache === undefined) {
    try {
      accessSync(piPath, process.platform === "win32" ? constants.F_OK : constants.X_OK);
      piExistsCache = true;
    } catch {
      piExistsCache = false;
    }
  }

  if (piExistsCache) return piPath;

  const managers = PI_PACKAGE_MANAGERS.filter((manager) => manager !== "yarn");
  const action = await vscode.window.showErrorMessage(
    "Pi binary not found. Install it globally?",
    ...managers,
  );
  if (action) {
    invalidatePiBinaryCache();
    const terminal = vscode.window.createTerminal({ name: "Install Pi" });
    terminal.show();
    terminal.sendText(createPiGlobalInstallCommand(action));
  }
  return undefined;
}

export async function upgradePiBinary(): Promise<void> {
  const piPath = await ensurePiBinary();
  if (!piPath) return;

  const terminal = vscode.window.createTerminal({ name: "Upgrade Pi" });
  terminal.show();

  // PI_OFFLINE=1 或 PI_SKIP_VERSION_CHECK=1 会跳过版本更新网络请求
  const isOffline = process.env.PI_OFFLINE === "1" || process.env.PI_SKIP_VERSION_CHECK === "1";

  if (isOffline) {
    // 在 pi 子进程中，使用包管理器直接安装
    let manager: PiPackageManager | undefined = guessPiPackageManager(piPath);
    if (!manager) {
      try {
        manager = guessPiPackageManager(realpathSync(piPath));
      } catch {}
    }
    if (!manager) {
      manager = (await vscode.window.showQuickPick([...PI_PACKAGE_MANAGERS], {
        placeHolder: `Could not infer the package manager for ${piPath}. Choose one to upgrade Pi globally.`,
      })) as PiPackageManager | undefined;
    }
    if (!manager) return;
    terminal.sendText(createPiGlobalInstallCommand(manager));
    void vscode.window.showInformationMessage(
      `Upgrading Pi with ${manager} (PI_OFFLINE detected). Found pi at: ${piPath}`,
    );
  } else {
    // 正常环境，使用 pi update（更简洁）
    terminal.sendText(createPiUpdateCommand(piPath, process.platform));
    void vscode.window.showInformationMessage(`Upgrading Pi via "pi update".`);
  }
}

/**
 * Build the pi CLI argument list (without the binary itself).
 */
export function createPiShellArgs(options: {
  extensionUri: vscode.Uri;
  sessionFile?: string;
  extraArgs?: string[];
}): string[] {
  const userArgs = vscode.workspace.getConfiguration("pi-agent-studio").get<string[]>("args") ?? [];
  const extensionArgs = [
    "-e",
    join(options.extensionUri.fsPath, BRIDGE_EXTENSION_PATH),
    "-e",
    join(options.extensionUri.fsPath, TODO_EXTENSION_PATH),
    "-e",
    join(options.extensionUri.fsPath, QUESTIONNAIRE_EXTENSION_PATH),
    "-e",
    join(options.extensionUri.fsPath, SUBAGENT_EXTENSION_PATH),
    "-e",
    join(options.extensionUri.fsPath, BTW_EXTENSION_PATH),
    "-e",
    join(options.extensionUri.fsPath, PERMISSION_GATE_EXTENSION_PATH),
    "-e",
    join(options.extensionUri.fsPath, REWIND_CODE_EXTENSION_PATH),
  ];
  const args = options.sessionFile
    ? [
        "--session",
        options.sessionFile,
        ...extensionArgs,
        ...userArgs,
        ...(options.extraArgs ?? []),
      ]
    : [...extensionArgs, ...userArgs, ...(options.extraArgs ?? [])];
  return args;
}

export function createPiEnvironment(
  bridgeConfig: { url: string; token: string } | undefined,
  extensionUri?: vscode.Uri,
): Record<string, string> | undefined {
  if (!bridgeConfig && !extensionUri) return undefined;
  const config = vscode.workspace.getConfiguration("pi-agent-studio");
  const statusBar = config.get<boolean>("statusBar") ?? true;
  const disabledTools = config.get<string[]>("disabledTools") ?? [];
  const permissionMode = config.get<string>("permission.mode") ?? "AskForApproval";
  const dangerousPatterns = config.get<string[]>("permission.dangerousPatterns") ?? [];
  const env: Record<string, string> = {
    PI_VSCODE_STATUS_BAR: statusBar ? "1" : "0",
    PI_VSCODE_DISABLED_TOOLS: JSON.stringify(disabledTools),
    PI_VSCODE_PERMISSION: JSON.stringify({ mode: permissionMode, patterns: dangerousPatterns }),
  };
  if (bridgeConfig) {
    env.PI_VSCODE_BRIDGE_URL = bridgeConfig.url;
    env.PI_VSCODE_BRIDGE_TOKEN = bridgeConfig.token;
  }
  if (extensionUri) {
    env.PI_VSCODE_BUILTIN_AGENTS_DIR = join(extensionUri.fsPath, BUILTIN_AGENTS_DIR);
  }
  return env;
}

/** Build pi CLI args for a `pi --mode rpc` subprocess (chat webview). */
export function createRpcShellArgs(options: {
  extensionUri: vscode.Uri;
  sessionFile?: string;
  extraArgs?: string[];
}): string[] {
  const userArgs = vscode.workspace.getConfiguration("pi-agent-studio").get<string[]>("args") ?? [];
  const extensionArgs = [
    "-e",
    join(options.extensionUri.fsPath, BRIDGE_EXTENSION_PATH),
    "-e",
    join(options.extensionUri.fsPath, TODO_EXTENSION_PATH),
    "-e",
    join(options.extensionUri.fsPath, QUESTIONNAIRE_EXTENSION_PATH),
    "-e",
    join(options.extensionUri.fsPath, SUBAGENT_EXTENSION_PATH),
    "-e",
    join(options.extensionUri.fsPath, BTW_EXTENSION_PATH),
    "-e",
    join(options.extensionUri.fsPath, PERMISSION_GATE_EXTENSION_PATH),
    "-e",
    join(options.extensionUri.fsPath, REWIND_CODE_EXTENSION_PATH),
  ];
  const base = ["--mode", "rpc"];
  return options.sessionFile
    ? [
        "--session",
        options.sessionFile,
        ...extensionArgs,
        ...base,
        ...userArgs,
        ...(options.extraArgs ?? []),
      ]
    : [...extensionArgs, ...base, ...userArgs, ...(options.extraArgs ?? [])];
}

/** User-provided env overrides (merged over process.env by the spawner). */
export function createRpcEnvironment(
  bridgeConfig?: { url: string; token: string },
  extensionUri?: vscode.Uri,
): Record<string, string> {
  const userEnv =
    vscode.workspace.getConfiguration("pi-agent-studio").get<Record<string, string>>("env") ?? {};
  const bridgeEnv = createPiEnvironment(bridgeConfig, extensionUri) ?? {};
  return { ...userEnv, ...bridgeEnv };
}
