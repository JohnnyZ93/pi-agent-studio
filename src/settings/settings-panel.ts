import * as vscode from "vscode";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { DefaultResourceLoader, getAgentDir } from "@earendil-works/pi-coding-agent";
import { getSettingsWebviewHtml } from "./settings-webview.ts";
import {
  getAppendSystemPromptPath,
  getSystemPromptPath,
  readTextFile,
  writeTextFile,
  ensurePromptFileExists,
} from "./settings-config.ts";
import {
  readModelsJson,
  writeModelsJson,
  addProvider,
  updateProvider,
  renameProvider,
  deleteProvider,
  addModel,
  updateModel,
  deleteModel,
  ensureModelsJsonExists,
} from "../models/models-config.ts";
import {
  getOAuthProviderStatuses,
  getApiKeyProviderStatuses,
  saveApiKey,
  removeApiKey,
  logout,
  invalidateModelRuntime,
  refreshModelRegistry,
  getModelRuntime,
} from "../models/auth-config.ts";
import {
  startOAuthFlow,
  type OAuthFlowController,
  type OAuthProgressEvent,
} from "../models/oauth-flow.ts";
import {
  listAgents,
  writeAgent,
  deleteAgent,
  resetBuiltin,
  isBuiltinName,
  isValidAgentName,
} from "../agents/agents-config.ts";
import {
  deletePrompt,
  getUserPromptsDir,
  getProjectPromptsDir,
  isValidPromptName,
  nameExistsInScope,
  writePrompt,
} from "../prompts/prompts-config.ts";
import {
  classifySkillScope,
  createSkill,
  deleteSkill,
  isValidSkillName,
  readSkillBody,
  updateSkill,
} from "../skills/skills-config.ts";
import {
  addServer,
  deleteServer,
  ensureMcpJson,
  getMcpProjectPath,
  getMcpUserPath,
  listMergedServers,
  parseServerEntry,
  toggleDisabled,
  updateServer,
} from "../mcp/mcp-config.ts";

const SETTINGS_VIEW_TYPE = "pi-agent-studio.settingsPanel";
const SETTINGS_PANEL_TITLE = "Pi Settings";

const COMMIT_LANGUAGES = [
  "English",
  "French",
  "Italian",
  "German",
  "Spanish",
  "Russian",
  "Chinese (Simplified)",
  "Chinese (Traditional)",
  "Japanese",
  "Korean",
  "Czech",
  "Portuguese (Brazil)",
  "Turkish",
  "Polish",
] as const;

let activePanel: vscode.WebviewPanel | undefined;

export async function openSettingsPanel(extensionUri: vscode.Uri): Promise<void> {
  if (activePanel) {
    activePanel.reveal(activePanel.viewColumn ?? vscode.ViewColumn.Active, false);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    SETTINGS_VIEW_TYPE,
    SETTINGS_PANEL_TITLE,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );
  panel.iconPath = {
    light: vscode.Uri.joinPath(extensionUri, "assets", "logo-light.svg"),
    dark: vscode.Uri.joinPath(extensionUri, "assets", "logo.svg"),
  };
  panel.webview.html = getSettingsWebviewHtml(
    vscode.workspace.getConfiguration("pi-agent-studio").get<number>("chatFontSize"),
  );

  activePanel = panel;

  let activeOAuthFlow: OAuthFlowController | undefined;

  panel.onDidDispose(() => {
    activeOAuthFlow?.cancel();
    activeOAuthFlow = undefined;
    activePanel = undefined;
  });

  const projectDir = () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const hasWorkspace = () => !!projectDir();

  const postTabData = async (tab: string) => {
    try {
      const data = await buildTabData(tab, extensionUri);
      panel.webview.postMessage({ type: "tabData", tab, data });
    } catch (e) {
      panel.webview.postMessage({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  panel.webview.onDidReceiveMessage(async (msg) => {
    const cwd = projectDir();
    try {
      switch (msg.type) {
        case "ready":
          panel.webview.postMessage({
            type: "init",
            hasWorkspace: hasWorkspace(),
            tabs: ["models", "agents", "prompts", "skills", "mcp", "commit", "settings"],
          });
          break;

        case "tabLoad":
        case "refresh":
          if (msg.tab) await postTabData(msg.tab);
          break;

        // ---- Models ----
        case "openModelsFile": {
          const doc = await vscode.workspace.openTextDocument(
            vscode.Uri.file(ensureModelsJsonExists()),
          );
          await vscode.window.showTextDocument(doc, { preview: false });
          break;
        }
        case "addProvider":
          addProvider(msg.name, msg.entry);
          await postTabData("models");
          break;
        case "updateProvider":
          updateProvider(msg.name, sanitizeUpdates(msg.updates));
          await postTabData("models");
          break;
        case "renameProviderAndUpdate":
          updateProvider(msg.oldName, sanitizeUpdates(msg.updates));
          if (msg.oldName !== msg.newName) renameProvider(msg.oldName, msg.newName);
          await postTabData("models");
          break;
        case "deleteProvider":
          deleteProvider(msg.name);
          await postTabData("models");
          break;
        case "addModel":
          addModel(msg.providerName, msg.model);
          await postTabData("models");
          break;
        case "updateModel":
          updateModel(msg.providerName, msg.modelId, sanitizeModelUpdates(msg.updates));
          await postTabData("models");
          break;
        case "deleteModel":
          deleteModel(msg.providerName, msg.modelId);
          await postTabData("models");
          break;
        case "oauthLogin": {
          activeOAuthFlow?.cancel();
          const flow = startOAuthFlow(msg.providerId);
          activeOAuthFlow = flow;
          flow.onProgress((event: OAuthProgressEvent) => {
            panel.webview.postMessage({ type: "oauthProgress", event });
            if (event.type === "success" || event.type === "error" || event.type === "cancelled") {
              activeOAuthFlow = undefined;
              if (event.type === "success") invalidateModelRuntime();
              void postTabData("models");
            }
          });
          break;
        }
        case "oauthRespond":
          activeOAuthFlow?.respond(msg.token, msg.value);
          break;
        case "oauthCancel":
          activeOAuthFlow?.cancel();
          activeOAuthFlow = undefined;
          break;
        case "oauthLogout":
          logout(msg.providerId);
          await postTabData("models");
          break;
        case "saveApiKey":
          saveApiKey(msg.providerId, String(msg.apiKey ?? "").trim());
          await postTabData("models");
          break;
        case "removeApiKey":
          removeApiKey(msg.providerId);
          await postTabData("models");
          break;
        case "writeModelsJson":
          writeModelsJson(msg.data);
          await postTabData("models");
          break;

        // ---- Agents ----
        case "createAgent": {
          const builtinDir = getBuiltinAgentsDir(extensionUri);
          const scope = resolveScope(msg.scope);
          if (scope === "project" && !cwd) throw new Error("No workspace folder for project scope");
          if (!isValidAgentName(msg.data.name))
            throw new Error(`Invalid agent name: ${msg.data.name}`);
          if (isBuiltinName(builtinDir, msg.data.name))
            throw new Error(`"${msg.data.name}" is a built-in agent. Edit its model instead.`);
          writeAgent(builtinDir, msg.data.name, msg.data, scope, cwd);
          await postTabData("agents");
          break;
        }
        case "updateAgent": {
          const builtinDir = getBuiltinAgentsDir(extensionUri);
          const scope = resolveScope(msg.scope);
          if (scope === "project" && !cwd) throw new Error("No workspace folder for project scope");
          if (!isValidAgentName(msg.data.name))
            throw new Error(`Invalid agent name: ${msg.data.name}`);
          writeAgent(builtinDir, msg.data.name, msg.data, scope, cwd);
          await postTabData("agents");
          break;
        }
        case "deleteAgent":
          deleteAgent(getBuiltinAgentsDir(extensionUri), msg.name, resolveScope(msg.scope), cwd);
          await postTabData("agents");
          break;
        case "resetBuiltin":
          resetBuiltin(getBuiltinAgentsDir(extensionUri), msg.name, resolveScope(msg.scope), cwd);
          await postTabData("agents");
          break;
        case "openAgentFile": {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(msg.filePath));
          await vscode.window.showTextDocument(doc, { preview: false });
          break;
        }

        // ---- Prompts ----
        case "createPrompt": {
          const scope = resolveScope(msg.scope);
          if (scope === "project" && !cwd) throw new Error("No workspace folder for project scope");
          if (!isValidPromptName(msg.data.name))
            throw new Error(`Invalid prompt name: ${msg.data.name}`);
          if (nameExistsInScope(msg.data.name, scope, cwd))
            throw new Error(`Prompt already exists: ${msg.data.name}`);
          writePrompt(msg.data.name, msg.data, scope, cwd, true);
          await postTabData("prompts");
          break;
        }
        case "updatePrompt": {
          const scope = resolveScope(msg.scope);
          if (scope === "project" && !cwd) throw new Error("No workspace folder for project scope");
          if (!isValidPromptName(msg.data.name))
            throw new Error(`Invalid prompt name: ${msg.data.name}`);
          writePrompt(msg.data.name, msg.data, scope, cwd);
          await postTabData("prompts");
          break;
        }
        case "deletePrompt":
          deletePrompt(msg.name, resolveScope(msg.scope), cwd);
          await postTabData("prompts");
          break;
        case "openPromptFile": {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(msg.filePath));
          await vscode.window.showTextDocument(doc, { preview: false });
          break;
        }

        // ---- Skills ----
        case "createSkill": {
          const scope = resolveScope(msg.scope);
          if (scope === "project" && !cwd) throw new Error("No workspace folder for project scope");
          if (!isValidSkillName(msg.data.name))
            throw new Error(`Invalid skill name: ${msg.data.name}`);
          createSkill(msg.data, scope, cwd);
          await postTabData("skills");
          break;
        }
        case "updateSkill":
          if (!isValidSkillName(msg.data.name))
            throw new Error(`Invalid skill name: ${msg.data.name}`);
          updateSkill(msg.filePath, msg.data, cwd);
          await postTabData("skills");
          break;
        case "deleteSkill":
          deleteSkill(msg.baseDir, cwd);
          await postTabData("skills");
          break;
        case "openSkillFile": {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(msg.filePath));
          await vscode.window.showTextDocument(doc, { preview: false });
          break;
        }

        // ---- MCP ----
        case "openMcpFile": {
          const path = resolveMcpScopePath(msg.scope, cwd);
          ensureMcpJson(path);
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path));
          await vscode.window.showTextDocument(doc, { preview: false });
          break;
        }
        case "addServer":
          addServer(resolveMcpScopePath(msg.scope, cwd), msg.name, parseServerEntry(msg.entry));
          await postTabData("mcp");
          break;
        case "updateServer":
          updateServer(resolveMcpScopePath(msg.scope, cwd), msg.name, parseServerEntry(msg.entry));
          await postTabData("mcp");
          break;
        case "deleteServer":
          deleteServer(resolveMcpScopePath(msg.scope, cwd), msg.name);
          await postTabData("mcp");
          break;
        case "toggleDisabled":
          toggleDisabled(resolveMcpScopePath(msg.scope, cwd), msg.name);
          await postTabData("mcp");
          break;

        // ---- Settings (system prompt) ----
        case "saveSystemPrompt":
          writeTextFile(getSystemPromptPath(), msg.content ?? "");
          panel.webview.postMessage({ type: "saved", what: "system" });
          break;
        case "saveAppendSystemPrompt":
          writeTextFile(getAppendSystemPromptPath(), msg.content ?? "");
          panel.webview.postMessage({ type: "saved", what: "append" });
          break;
        case "saveCommitConfig": {
          const cfg = vscode.workspace.getConfiguration("pi-agent-studio");
          await cfg.update("commitModel", msg.commitModel ?? "", vscode.ConfigurationTarget.Global);
          await cfg.update(
            "commitLanguage",
            msg.commitLanguage ?? "English",
            vscode.ConfigurationTarget.Global,
          );
          await cfg.update(
            "commitMessagePrompt",
            msg.commitMessagePrompt ?? "",
            vscode.ConfigurationTarget.Global,
          );
          panel.webview.postMessage({ type: "saved", what: "commit" });
          break;
        }
        case "openSystemPromptFile": {
          const doc = await vscode.workspace.openTextDocument(
            ensurePromptFileExists(getSystemPromptPath()),
          );
          await vscode.window.showTextDocument(doc, { preview: false });
          break;
        }
        case "openAppendSystemPromptFile": {
          const doc = await vscode.workspace.openTextDocument(
            ensurePromptFileExists(getAppendSystemPromptPath()),
          );
          await vscode.window.showTextDocument(doc, { preview: false });
          break;
        }

        default:
          break;
      }
    } catch (e) {
      panel.webview.postMessage({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });
}

async function buildTabData(
  tab: string,
  extensionUri: vscode.Uri,
): Promise<Record<string, unknown>> {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  switch (tab) {
    case "models": {
      await refreshModelRegistry();
      const modelsJson = readModelsJson();
      const providers = Object.entries(modelsJson.providers ?? {}).map(([id, entry]) => ({
        id,
        name: entry.name ?? id,
        type: "custom" as const,
        modelCount: entry.models?.length ?? 0,
      }));
      const oauthStatuses = await getOAuthProviderStatuses();
      const apikeyStatuses = await getApiKeyProviderStatuses();
      return { providers, modelsJson, oauthStatuses, apikeyStatuses };
    }
    case "agents": {
      const agents = listAgents(getBuiltinAgentsDir(extensionUri), cwd);
      const models = await getAvailableAgentModels();
      return { agents, hasWorkspace: !!cwd, models };
    }
    case "prompts": {
      const loader = new DefaultResourceLoader({
        cwd: cwd ?? homedir(),
        agentDir: getAgentDir(),
        noExtensions: true,
        noSkills: true,
        noThemes: true,
        noContextFiles: true,
      });
      await loader.reload({ resolveProjectTrust: async () => true });
      const { prompts } = loader.getPrompts();
      const userDirPrefix = resolve(getUserPromptsDir()) + sep;
      const projDirPrefix = cwd ? resolve(getProjectPromptsDir(cwd)) + sep : null;
      const items = prompts.map((pt: any) => {
        const si = pt.sourceInfo;
        const fp = resolve(pt.filePath);
        let writableScope: "user" | "project" | null = null;
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
      items.sort((a: any, b: any) => {
        if (a.editable !== b.editable) return a.editable ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return { prompts: items, hasWorkspace: !!cwd };
    }
    case "skills": {
      const loader = new DefaultResourceLoader({
        cwd: cwd ?? homedir(),
        agentDir: getAgentDir(),
        noExtensions: true,
        noPromptTemplates: true,
        noThemes: true,
        noContextFiles: true,
      });
      await loader.reload({ resolveProjectTrust: async () => true });
      const { skills } = loader.getSkills();
      const items = skills.map((sk: any) => {
        const writableScope = classifySkillScope(sk.filePath, cwd);
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
      items.sort((a: any, b: any) => {
        if (a.editable !== b.editable) return a.editable ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return { skills: items, hasWorkspace: !!cwd };
    }
    case "mcp": {
      const userPath = getMcpUserPath();
      const projectPath = cwd ? getMcpProjectPath(cwd) : "";
      const servers = listMergedServers(userPath, projectPath);
      return { servers, hasWorkspace: !!cwd, userPath, projectPath };
    }
    case "settings": {
      const systemPath = getSystemPromptPath();
      const appendPath = getAppendSystemPromptPath();
      return {
        systemPrompt: { path: systemPath, content: readTextFile(systemPath) },
        appendSystemPrompt: { path: appendPath, content: readTextFile(appendPath) },
      };
    }
    case "commit": {
      const cfg = vscode.workspace.getConfiguration("pi-agent-studio");
      return {
        commitModel: cfg.get<string>("commitModel", ""),
        commitLanguage: cfg.get<string>("commitLanguage", "English"),
        commitMessagePrompt: cfg.get<string>("commitMessagePrompt", ""),
        languages: COMMIT_LANGUAGES,
        models: await getAvailableAgentModels(),
      };
    }
    default:
      return {};
  }
}

async function getAvailableAgentModels(): Promise<string[]> {
  try {
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
  } catch {
    return [];
  }
}

function computeSourceLabel(si: { origin: string; source: string; scope: string }): string {
  if (si.origin === "package") return "package";
  if (si.source === "cli") return "cli";
  if (si.scope === "user") return "user";
  if (si.scope === "project") return "project";
  return si.source || "other";
}

function getBuiltinAgentsDir(extensionUri: vscode.Uri): string {
  return join(extensionUri.fsPath, "bridge", "agents");
}

function resolveScope(raw: unknown): "user" | "project" {
  return raw === "project" ? "project" : "user";
}

function resolveMcpScopePath(scope: string, cwd?: string): string {
  if (scope === "project") {
    if (!cwd) throw new Error("No workspace folder for project scope");
    return getMcpProjectPath(cwd);
  }
  return getMcpUserPath();
}

function sanitizeUpdates(updates: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!updates) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    result[key] = value === null ? undefined : value;
  }
  return result;
}

function sanitizeModelUpdates(
  updates: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!updates) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    result[key] = value === null ? undefined : value;
  }
  return result;
}
