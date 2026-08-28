// Editor/Explorer context-menu commands that append the current selection
// (as a fenced code block) or a file/folder (as an `@` mention) to the
// composer input of an already-open webview chat panel or sidebar chat.

import { relative } from "node:path";
import { homedir } from "node:os";
import * as vscode from "vscode";
import { t } from "../i18n.ts";

interface ChatTarget {
  post(msg: unknown): void;
  reveal(): void;
}

async function resolveTarget(): Promise<ChatTarget | undefined> {
  const { getSidebarChatTarget, focusSidebarChat } = await import("./chat-sidebar.ts");
  const sidebar = getSidebarChatTarget();
  if (sidebar) {
    return {
      post: (msg) => sidebar.session.host.postMessage(msg),
      reveal: () => focusSidebarChat(),
    };
  }
  const { getActivePanelHandle } = await import("./chat-panel.ts");
  const handle = getActivePanelHandle();
  if (handle) {
    return {
      post: (msg) => void handle.panel.webview.postMessage(msg),
      reveal: () => handle.panel.reveal(handle.panel.viewColumn ?? vscode.ViewColumn.Active),
    };
  }
  return undefined;
}

function displayPath(uri: vscode.Uri): string {
  // asRelativePath handles multi-root workspaces and remote schemes (SSH/WSL)
  // without dropping to a local-only fsPath; false => omit the workspace
  // folder prefix so the path stays relative to the containing folder.
  let p = vscode.workspace.asRelativePath(uri, false);
  if (uri.scheme === "file") {
    const home = homedir();
    const sep = process.platform === "win32" ? "\\" : "/";
    if (p === uri.fsPath && (p === home || p.startsWith(home + sep)) && p.length > home.length) {
      p = "~/" + relative(home, p).split("\\").join("/");
    }
  }
  return p.split("\\").join("/");
}

function toastNoChat(): void {
  void vscode.window.showInformationMessage(t("Pi: Open a Pi Chat first to use this command."));
}

function appendToChat(target: ChatTarget, text: string): void {
  target.post({ type: "appendInput", text });
  target.reveal();
}

export async function addSelectionToChat(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showInformationMessage(t("Pi: No active editor to add."));
    return;
  }
  if (editor.selection.isEmpty) {
    void vscode.window.showInformationMessage(t("Pi: Make a selection in the editor first."));
    return;
  }
  const target = await resolveTarget();
  if (!target) {
    toastNoChat();
    return;
  }
  const rel = displayPath(editor.document.uri);
  const start = editor.selection.start.line + 1;
  const end = editor.selection.end.line + 1;
  const text = editor.document.getText(editor.selection);
  const lang = extensionLanguage(editor.document.uri);
  const rangeLabel = start === end ? `${start}` : `${start}-${end}`;
  const fence = "`".repeat(Math.max(3, longestBacktickRun(text) + 1));
  const block = `**${rel}:${rangeLabel}**\n${fence}${lang}\n${text}\n${fence}\n`;
  appendToChat(target, block);
}

export async function addFileToChat(uri?: vscode.Uri): Promise<void> {
  let targetUri: vscode.Uri | undefined = uri?.scheme === "file" ? uri : undefined;
  if (!targetUri) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showInformationMessage(t("Pi: No active editor to add."));
      return;
    }
    targetUri = editor.document.uri;
  }
  const target = await resolveTarget();
  if (!target) {
    toastNoChat();
    return;
  }
  appendToChat(target, `@${displayPath(targetUri)} `);
}

function longestBacktickRun(s: string): number {
  let max = 0;
  let cur = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charAt(i) === "`") {
      cur++;
      if (cur > max) max = cur;
    } else cur = 0;
  }
  return max;
}

function extensionLanguage(uri: vscode.Uri): string {
  const ext = uri.path.slice(uri.path.lastIndexOf(".") + 1).toLowerCase();
  const map: Record<string, string> = {
    ts: "ts",
    tsx: "tsx",
    js: "js",
    mjs: "js",
    cjs: "js",
    jsx: "jsx",
    json: "json",
    jsonc: "json",
    css: "css",
    scss: "scss",
    less: "less",
    html: "html",
    htm: "html",
    xml: "xml",
    svg: "xml",
    md: "md",
    markdown: "md",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    fish: "bash",
    ps1: "powershell",
    bat: "bat",
    cmd: "bat",
    sql: "sql",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    ini: "ini",
    cfg: "ini",
    vue: "vue",
    svelte: "svelte",
  };
  return map[ext] ?? "";
}
