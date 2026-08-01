import * as vscode from "vscode";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import { DefaultResourceLoader, getAgentDir } from "@earendil-works/pi-coding-agent";
import {
  deletePrompt,
  getProjectPromptsDir,
  getUserPromptsDir,
  isValidPromptName,
  nameExistsInScope,
  writePrompt,
  type PromptFormData,
  type PromptScope,
} from "./prompts-config.ts";
import { getPromptsHtml } from "./prompts-sidebar-html.ts";

interface PromptViewItem {
  name: string;
  description: string;
  argumentHint: string | null;
  content: string;
  filePath: string;
  scope: string;
  origin: string;
  source: string;
  editable: boolean;
  sourceLabel: string;
}

function computeSourceLabel(si: { origin: string; source: string; scope: string }): string {
  if (si.origin === "package") return "package";
  if (si.source === "cli") return "cli";
  if (si.scope === "user") return "user";
  if (si.scope === "project") return "project";
  return si.source || "other";
}

export function createPromptsViewProvider(): vscode.WebviewViewProvider {
  return {
    resolveWebviewView(webviewView: vscode.WebviewView) {
      webviewView.webview.options = { enableScripts: true };
      const projectDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const loader = new DefaultResourceLoader({
        cwd: projectDir ?? homedir(),
        agentDir: getAgentDir(),
        noExtensions: true,
        noSkills: true,
        noThemes: true,
        noContextFiles: true,
      });
      webviewView.webview.html = getPromptsHtml(!!projectDir);

      const fetchPrompts = async (): Promise<PromptViewItem[]> => {
        await loader.reload({ resolveProjectTrust: async () => true });
        const { prompts } = loader.getPrompts();
        const userDirPrefix = resolve(getUserPromptsDir()) + sep;
        const projDirPrefix = projectDir ? resolve(getProjectPromptsDir(projectDir)) + sep : null;
        const items: PromptViewItem[] = prompts.map((pt) => {
          const si = pt.sourceInfo;
          const fp = resolve(pt.filePath);
          let writableScope: PromptScope | null = null;
          if (fp.startsWith(userDirPrefix)) writableScope = "user";
          else if (projDirPrefix && fp.startsWith(projDirPrefix)) writableScope = "project";
          const editable = writableScope !== null;
          return {
            name: pt.name,
            description: pt.description,
            argumentHint: pt.argumentHint ?? null,
            content: pt.content,
            filePath: pt.filePath,
            scope: writableScope ?? si.scope,
            origin: si.origin,
            source: si.source,
            editable,
            sourceLabel: computeSourceLabel(si),
          };
        });
        items.sort((a, b) => {
          if (a.editable !== b.editable) return a.editable ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        return items;
      };

      const postData = async () => {
        try {
          webviewView.webview.postMessage({ type: "loading" });
          const prompts = await fetchPrompts();
          webviewView.webview.postMessage({
            type: "data",
            data: { prompts, hasWorkspace: !!projectDir },
          });
        } catch (err) {
          console.error("[pi-agent-studio] Prompts view: error building data:", err);
          webviewView.webview.postMessage({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      };

      postData();

      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) postData();
      });

      const resolveScope = (raw: unknown): PromptScope => (raw === "project" ? "project" : "user");

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
            case "createPrompt": {
              const scope = resolveScope(msg.scope);
              if (scope === "project" && !projectDir) {
                throw new Error("No workspace folder for project scope");
              }
              if (!isValidPromptName(msg.data.name)) {
                throw new Error(`Invalid prompt name: ${msg.data.name}`);
              }
              if (nameExistsInScope(msg.data.name, scope, projectDir)) {
                throw new Error(`Prompt already exists: ${msg.data.name}`);
              }
              writePrompt(msg.data.name, msg.data as PromptFormData, scope, projectDir, true);
              postData();
              break;
            }
            case "updatePrompt": {
              const scope = resolveScope(msg.scope);
              if (scope === "project" && !projectDir) {
                throw new Error("No workspace folder for project scope");
              }
              if (!isValidPromptName(msg.data.name)) {
                throw new Error(`Invalid prompt name: ${msg.data.name}`);
              }
              writePrompt(msg.data.name, msg.data as PromptFormData, scope, projectDir);
              postData();
              break;
            }
            case "deletePrompt": {
              const scope = resolveScope(msg.scope);
              deletePrompt(msg.name, scope, projectDir);
              postData();
              break;
            }
            case "openFile": {
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
