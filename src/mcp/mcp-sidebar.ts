import * as vscode from "vscode";
import {
  addServer,
  deleteServer,
  ensureMcpJson,
  getMcpProjectPath,
  getMcpUserPath,
  listServers,
  parseServerEntry,
  readMcpConfig,
  toggleDisabled,
  updateServer,
  type ServerEntry,
} from "./mcp-config.ts";
import { getMcpHtml } from "./mcp-sidebar-html.ts";

export function createMcpViewProvider(): vscode.WebviewViewProvider {
  return {
    resolveWebviewView(webviewView: vscode.WebviewView) {
      webviewView.webview.options = { enableScripts: true };
      const projectFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      webviewView.webview.html = getMcpHtml(!!projectFolder);

      const postData = () => {
        const userPath = getMcpUserPath();
        const projectPath = projectFolder ? getMcpProjectPath(projectFolder) : "";
        const { userServers, projectServers } = listServers(userPath, projectPath);
        webviewView.webview.postMessage({
          type: "data",
          data: {
            userServers,
            projectServers,
            hasWorkspace: !!projectFolder,
            userPath,
            projectPath,
          },
        });
      };

      postData();
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) postData();
      });

      webviewView.webview.onDidReceiveMessage(async (msg) => {
        if (msg.type === "ready") {
          postData();
          return;
        }
        try {
          switch (msg.type) {
            case "refresh":
              postData();
              break;
            case "openFile": {
              const path = resolveScopePath(msg.scope, projectFolder);
              ensureMcpJson(path);
              const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path));
              await vscode.window.showTextDocument(doc, { preview: false });
              break;
            }
            case "addServer": {
              const path = resolveScopePath(msg.scope, projectFolder);
              addServer(path, msg.name, parseServerEntry(msg.entry));
              postData();
              break;
            }
            case "updateServer": {
              const path = resolveScopePath(msg.scope, projectFolder);
              updateServer(path, msg.name, parseServerEntry(msg.entry));
              postData();
              break;
            }
            case "deleteServer": {
              const path = resolveScopePath(msg.scope, projectFolder);
              deleteServer(path, msg.name);
              postData();
              break;
            }
            case "toggleDisabled": {
              const path = resolveScopePath(msg.scope, projectFolder);
              toggleDisabled(path, msg.name);
              postData();
              break;
            }
          }
        } catch (err) {
          webviewView.webview.postMessage({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });
    },
  };
}

function resolveScopePath(scope: string, projectFolder?: string): string {
  if (scope === "project") {
    if (!projectFolder) throw new Error("No workspace folder for project scope");
    return getMcpProjectPath(projectFolder);
  }
  return getMcpUserPath();
}

export type { ServerEntry, McpConfig } from "./mcp-config.ts";
export { readMcpConfig };
