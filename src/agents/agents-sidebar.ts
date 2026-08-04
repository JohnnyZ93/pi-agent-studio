import * as vscode from "vscode";
import { join } from "node:path";
import {
  listAgents,
  writeAgent,
  deleteAgent,
  resetBuiltin,
  isBuiltinName,
  isValidAgentName,
  type AgentFormData,
} from "./agents-config.ts";
import { getAgentsHtml } from "./agents-sidebar-html.ts";
import { getModelRuntime, refreshModelRegistry } from "../models/auth-config.ts";

async function getAvailableAgentModels(): Promise<string[]> {
  try {
    // Reload models.json into the cached runtime so models added via the
    // Models view (custom providers) show up here without a restart.
    await refreshModelRegistry();
    const runtime = await getModelRuntime();
    const all = await runtime.getAvailable();
    const seen = new Set<string>();
    const list: string[] = [];
    for (const m of all) {
      const key = `${m.provider}/${m.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(key);
    }
    list.sort((a, b) => a.localeCompare(b));
    return list;
  } catch (err) {
    console.error("[pi-agent-studio] Agents view: failed to list models:", err);
    return [];
  }
}

export function createAgentsViewProvider(extensionUri: vscode.Uri): vscode.WebviewViewProvider {
  return {
    resolveWebviewView(webviewView: vscode.WebviewView) {
      webviewView.webview.options = { enableScripts: true };
      const builtinDir = join(extensionUri.fsPath, "bridge", "agents");
      const projectDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      webviewView.webview.html = getAgentsHtml(!!projectDir);

      const postData = async () => {
        try {
          const agents = listAgents(builtinDir, projectDir);
          const models = await getAvailableAgentModels();
          webviewView.webview.postMessage({
            type: "data",
            data: { agents, hasWorkspace: !!projectDir, models },
          });
        } catch (err) {
          console.error("[pi-agent-studio] Agents view: error building data:", err);
        }
      };

      postData();

      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) postData();
      });

      const resolveScope = (raw: unknown): "user" | "project" =>
        raw === "project" ? "project" : "user";

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
            case "createAgent": {
              const scope = resolveScope(msg.scope);
              if (scope === "project" && !projectDir) {
                throw new Error("No workspace folder for project scope");
              }
              if (!isValidAgentName(msg.data.name)) {
                throw new Error(`Invalid agent name: ${msg.data.name}`);
              }
              if (isBuiltinName(builtinDir, msg.data.name)) {
                throw new Error(`"${msg.data.name}" is a built-in agent. Edit its model instead.`);
              }
              writeAgent(builtinDir, msg.data.name, msg.data as AgentFormData, scope, projectDir);
              postData();
              break;
            }
            case "updateAgent": {
              const scope = resolveScope(msg.scope);
              if (scope === "project" && !projectDir) {
                throw new Error("No workspace folder for project scope");
              }
              if (!isValidAgentName(msg.data.name)) {
                throw new Error(`Invalid agent name: ${msg.data.name}`);
              }
              writeAgent(builtinDir, msg.data.name, msg.data as AgentFormData, scope, projectDir);
              postData();
              break;
            }
            case "deleteAgent": {
              const scope = resolveScope(msg.scope);
              deleteAgent(builtinDir, msg.name, scope, projectDir);
              postData();
              break;
            }
            case "resetBuiltin": {
              const scope = resolveScope(msg.scope);
              resetBuiltin(builtinDir, msg.name, scope, projectDir);
              postData();
              break;
            }
            case "openAgentFile": {
              const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(msg.filePath));
              await vscode.window.showTextDocument(doc, { preview: false });
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
