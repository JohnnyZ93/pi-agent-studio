import * as vscode from "vscode";
import { homedir } from "node:os";
import { DefaultResourceLoader, getAgentDir } from "@earendil-works/pi-coding-agent";
import {
  classifySkillScope,
  createSkill,
  deleteSkill,
  isValidSkillName,
  readSkillBody,
  updateSkill,
  type SkillFormData,
  type SkillScope,
} from "./skills-config.ts";
import { getSkillsHtml } from "./skills-sidebar-html.ts";

interface SkillViewItem {
  name: string;
  description: string;
  disableModelInvocation: boolean;
  body: string;
  filePath: string;
  baseDir: string;
  scope: string;
  sourceLabel: string;
  editable: boolean;
}

export function createSkillsViewProvider(): vscode.WebviewViewProvider {
  return {
    resolveWebviewView(webviewView: vscode.WebviewView) {
      webviewView.webview.options = { enableScripts: true };
      const projectDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const loader = new DefaultResourceLoader({
        cwd: projectDir ?? homedir(),
        agentDir: getAgentDir(),
        noExtensions: true,
        noPromptTemplates: true,
        noThemes: true,
        noContextFiles: true,
      });
      webviewView.webview.html = getSkillsHtml(!!projectDir);

      const fetchSkills = async (): Promise<SkillViewItem[]> => {
        await loader.reload({ resolveProjectTrust: async () => true });
        const { skills } = loader.getSkills();
        const items: SkillViewItem[] = skills.map((sk) => {
          const writableScope = classifySkillScope(sk.filePath, projectDir);
          const editable = writableScope !== null;
          return {
            name: sk.name,
            description: sk.description,
            disableModelInvocation: sk.disableModelInvocation,
            body: readSkillBody(sk.filePath),
            filePath: sk.filePath,
            baseDir: sk.baseDir,
            scope: writableScope ?? "other",
            sourceLabel: writableScope ?? "other",
            editable,
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
          const skills = await fetchSkills();
          webviewView.webview.postMessage({
            type: "data",
            data: { skills, hasWorkspace: !!projectDir },
          });
        } catch (err) {
          console.error("[pi-agent-studio] Skills view: error building data:", err);
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

      const resolveScope = (raw: unknown): SkillScope => (raw === "project" ? "project" : "user");

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
            case "createSkill": {
              const scope = resolveScope(msg.scope);
              if (scope === "project" && !projectDir) {
                throw new Error("No workspace folder for project scope");
              }
              if (!isValidSkillName(msg.data.name)) {
                throw new Error(`Invalid skill name: ${msg.data.name}`);
              }
              createSkill(msg.data as SkillFormData, scope, projectDir);
              postData();
              break;
            }
            case "updateSkill": {
              if (!isValidSkillName(msg.data.name)) {
                throw new Error(`Invalid skill name: ${msg.data.name}`);
              }
              updateSkill(msg.filePath, msg.data as SkillFormData, projectDir);
              postData();
              break;
            }
            case "deleteSkill": {
              deleteSkill(msg.baseDir, projectDir);
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
