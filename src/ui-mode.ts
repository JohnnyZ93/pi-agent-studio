import * as vscode from "vscode";

export type UiMode = "terminal" | "webview" | "sidebar";

export function resolveUiMode(): UiMode {
  const value = vscode.workspace.getConfiguration("pi-agent-studio").get<string>("ui");
  return value === "webview" || value === "sidebar" ? value : "terminal";
}
