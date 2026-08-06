import { readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { SessionManager, getAgentDir } from "@earendil-works/pi-coding-agent";
import type { SessionInfo } from "@earendil-works/pi-coding-agent";
import { createNewTerminal, lockPiEditorGroup } from "../terminal.ts";
import type { SessionTracker } from "../sessions.ts";
import { openChatPanel, syncOpenChatSession } from "../chat/chat-panel.ts";
import type { ChatTracker } from "../chat/chat-tracker.ts";
import { filterAndSortSessions } from "./session-search.ts";
import { getSessionsHtml } from "./sessions-sidebar-html.ts";
import { sessionStatusRegistry } from "../session-status-registry.ts";
import { t } from "../i18n.ts";

export interface SessionDir {
  /** Absolute path of the cwd. Used as cache key and as the cwd for new sessions. */
  path: string;
  /** Owning VS Code workspace folder name. */
  workspaceName: string;
  /** Path relative to the workspace folder root (POSIX-style). Empty string means it IS the root. */
  relativePath: string;
  /** Display label: workspaceName (root) or "workspaceName/relativePath". */
  label: string;
  /** Number of sessions whose cwd equals this path. */
  sessionCount: number;
  /** True when this entry represents the workspace folder root itself. */
  isRoot: boolean;
}

export function createSessionsViewProvider(
  extensionUri: vscode.Uri,
  bridgeConfig: { url: string; token: string } | undefined,
  sessionTracker: SessionTracker,
  chatTracker: ChatTracker,
): vscode.WebviewViewProvider {
  let sessionDirs: SessionDir[] = [];
  let selectedDirPath: string | undefined;

  const pickInitialDir = (dirs: SessionDir[]): string | undefined => {
    if (dirs.length === 0) return undefined;
    // Prefer the workspace containing the active editor.
    const active = vscode.window.activeTextEditor?.document.uri;
    if (active) {
      const owner = vscode.workspace.getWorkspaceFolder(active);
      if (owner) {
        const hit = dirs.find((d) => d.path === owner.uri.fsPath);
        if (hit) return hit.path;
      }
    }
    return dirs[0]!.path;
  };

  // Per-directory cache of the most recent SessionManager.list() result.
  // Search filtering happens against this in-memory cache so each keystroke
  // doesn't re-read JSONL files from disk.
  const sessionCache = new Map<string, SessionInfo[]>();
  // Last search query per webview lifetime; survives refresh/rename/delete so
  // mutations re-apply the active filter.
  let lastSearchQuery = "";

  return {
    resolveWebviewView(webviewView: vscode.WebviewView) {
      webviewView.webview.options = { enableScripts: true };

      webviewView.webview.html = getSessionsHtml();

      const langSub = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("pi-agent-studio.language")) {
          webviewView.webview.html = getSessionsHtml();
          void refreshAll();
        }
      });

      const postDirs = () => {
        webviewView.webview.postMessage({
          type: "dirs",
          dirs: sessionDirs.map((d) => ({
            path: d.path,
            workspaceName: d.workspaceName,
            relativePath: d.relativePath,
            label: d.label,
            sessionCount: d.sessionCount,
            isRoot: d.isRoot,
          })),
          selected: selectedDirPath,
        });
      };

      const sortByModifiedDesc = (sessions: SessionInfo[]): SessionInfo[] => {
        return [...sessions].sort((a, b) => {
          const am = a.modified instanceof Date ? a.modified.getTime() : 0;
          const bm = b.modified instanceof Date ? b.modified.getTime() : 0;
          return bm - am;
        });
      };

      const postFiltered = (query: string) => {
        const cwd = selectedDirPath;
        if (!cwd) {
          webviewView.webview.postMessage({ type: "sessions", sessions: [], query });
          return;
        }
        const cached = sessionCache.get(cwd) ?? [];
        const trimmed = query.trim();
        if (!trimmed) {
          webviewView.webview.postMessage({
            type: "sessions",
            sessions: sortByModifiedDesc(cached).map((s) => serializeSession(s)),
            query,
          });
          return;
        }
        // With a query, sort by relevance.
        const { sessions: filtered, error } = filterAndSortSessions(cached, query, "relevance");
        webviewView.webview.postMessage({
          type: "sessions",
          sessions: filtered.map((s) => serializeSession(s)),
          query,
          searchError: error,
        });
      };

      const reloadAndPost = async (query: string) => {
        if (!selectedDirPath) {
          webviewView.webview.postMessage({ type: "sessions", sessions: [], query });
          return;
        }
        try {
          const sessions = await SessionManager.list(selectedDirPath);
          sessionCache.set(selectedDirPath, sessions);
        } catch (err) {
          console.error("[pi-agent-studio] Sessions view: error fetching sessions:", err);
          sessionCache.set(selectedDirPath, []);
        }
        postFiltered(query);
      };

      const refreshAll = async () => {
        try {
          sessionDirs = await discoverSessionDirs();
        } catch (err) {
          console.error("[pi-agent-studio] Sessions view: error discovering dirs:", err);
          sessionDirs = fallbackDirsFromWorkspace();
        }
        if (!selectedDirPath || !sessionDirs.some((d) => d.path === selectedDirPath)) {
          selectedDirPath = pickInitialDir(sessionDirs);
        }
        postDirs();
        await reloadAndPost(lastSearchQuery);
      };

      void refreshAll();

      const folderSub = vscode.workspace.onDidChangeWorkspaceFolders(() => {
        void refreshAll();
      });

      const visSub = webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) void refreshAll();
      });

      const statusSub = sessionStatusRegistry.onChanged((entries) => {
        if (!webviewView.visible) return;
        webviewView.webview.postMessage({
          type: "statusUpdate",
          entries: entries.map((e) => ({ path: e.sessionFile, status: e.status })),
        });
      });

      const sessionsRoot = join(getAgentDir(), "sessions");
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(sessionsRoot), "**/*.jsonl"),
      );
      let refreshTimer: ReturnType<typeof setTimeout> | undefined;
      const scheduleRefresh = () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          refreshTimer = undefined;
          if (webviewView.visible) void refreshAll();
        }, 300);
      };
      const createSub = watcher.onDidCreate(scheduleRefresh);
      const deleteSub = watcher.onDidDelete(scheduleRefresh);
      const changeSub = watcher.onDidChange(scheduleRefresh);

      webviewView.onDidDispose(() => {
        folderSub.dispose();
        visSub.dispose();
        statusSub();
        createSub.dispose();
        deleteSub.dispose();
        changeSub.dispose();
        langSub.dispose();
        if (refreshTimer) clearTimeout(refreshTimer);
        watcher.dispose();
      });

      webviewView.webview.onDidReceiveMessage(async (msg) => {
        switch (msg.type) {
          case "refresh":
            await refreshAll();
            break;
          case "selectDir":
            if (typeof msg.path === "string" && sessionDirs.some((d) => d.path === msg.path)) {
              selectedDirPath = msg.path;
              await reloadAndPost(lastSearchQuery);
            }
            break;
          case "search":
            lastSearchQuery = typeof msg.query === "string" ? msg.query : "";
            postFiltered(lastSearchQuery);
            break;
          case "new":
            await openNewSessionInDir(
              selectedDirPath,
              extensionUri,
              bridgeConfig,
              sessionTracker,
              chatTracker,
            );
            break;
          case "open":
            await openSession(
              msg.sessionFile,
              extensionUri,
              bridgeConfig,
              sessionTracker,
              chatTracker,
            );
            break;
          case "rename":
            await renameSession(msg.sessionFile, msg.name);
            await reloadAndPost(lastSearchQuery);
            break;
          case "delete":
            await deleteSession(msg.sessionFile);
            // Full refresh so the header dropdown's session counts (and possibly
            // the set of visible subdirs) reflect the deletion.
            await refreshAll();
            break;
        }
      });
    },
  };
}

function serializeSession(s: SessionInfo) {
  const entry = sessionStatusRegistry.get(s.path);
  return {
    path: s.path,
    name: s.name || "",
    firstMessage: s.firstMessage || "",
    messageCount: s.messageCount || 0,
    modified: s.modified instanceof Date ? s.modified.toISOString() : (s.modified ?? ""),
    ...(entry ? { isOpen: true, status: entry.status } : {}),
  };
}

/**
 * Discover all directories that should appear in the sidebar dropdown:
 *   - every VS Code workspace folder root (even if empty), so the user can always start fresh there
 *   - every distinct `session.cwd` that lives under one of those roots
 *
 * Sessions whose `cwd` falls outside any workspace are ignored — they can still be opened by
 * clicking the session row (that path goes through `openSession()` with `--session <file>`).
 */
async function discoverSessionDirs(): Promise<SessionDir[]> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) return [];

  let cwdCounts: Map<string, number>;
  try {
    const all = await SessionManager.listAll();
    cwdCounts = new Map<string, number>();
    for (const s of all) {
      if (!s.cwd) continue;
      cwdCounts.set(s.cwd, (cwdCounts.get(s.cwd) ?? 0) + 1);
    }
  } catch (err) {
    console.error("[pi-agent-studio] SessionManager.listAll failed:", err);
    cwdCounts = new Map();
  }

  const dirs: SessionDir[] = [];
  for (const folder of folders) {
    const rootPath = folder.uri.fsPath;
    let rootSeen = false;
    const collected: SessionDir[] = [];

    for (const [cwd, count] of cwdCounts) {
      if (!isInsideOrEqual(rootPath, cwd)) continue;
      const rel = relative(rootPath, cwd).split(sep).join("/");
      const isRoot = rel === "";
      if (isRoot) rootSeen = true;
      collected.push({
        path: cwd,
        workspaceName: folder.name,
        relativePath: rel,
        label: isRoot ? folder.name : `${folder.name}/${rel}`,
        sessionCount: count,
        isRoot,
      });
    }

    if (!rootSeen) {
      collected.push({
        path: rootPath,
        workspaceName: folder.name,
        relativePath: "",
        label: folder.name,
        sessionCount: 0,
        isRoot: true,
      });
    }

    // Within a workspace: root first, then subdirs sorted by relativePath.
    collected.sort((a, b) => {
      if (a.isRoot !== b.isRoot) return a.isRoot ? -1 : 1;
      return a.relativePath.localeCompare(b.relativePath);
    });

    dirs.push(...collected);
  }

  return dirs;
}

function isInsideOrEqual(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  if (rel === "") return true;
  if (rel.startsWith("..")) return false;
  // Different-drive paths on Windows return an absolute path from `path.relative`.
  return !isAbsolute(rel);
}

function fallbackDirsFromWorkspace(): SessionDir[] {
  const folders = vscode.workspace.workspaceFolders ?? [];
  return folders.map((f) => ({
    path: f.uri.fsPath,
    workspaceName: f.name,
    relativePath: "",
    label: f.name,
    sessionCount: 0,
    isRoot: true,
  }));
}

async function openNewSessionInDir(
  cwd: string | undefined,
  extensionUri: vscode.Uri,
  bridgeConfig: { url: string; token: string } | undefined,
  sessionTracker: SessionTracker,
  chatTracker: ChatTracker,
): Promise<void> {
  const effectiveCwd = cwd ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!effectiveCwd) {
    void vscode.window.showErrorMessage(t("No workspace folder available"));
    return;
  }
  if (useWebviewUi()) {
    await openChatPanel({ extensionUri, bridgeConfig, tracker: chatTracker, cwd: effectiveCwd });
    return;
  }
  const terminalId = randomUUID();
  const terminal = await createNewTerminal({
    extensionUri,
    bridgeConfig,
    terminalId,
    cwd: effectiveCwd,
  });
  if (terminal) {
    sessionTracker.track(terminal, terminalId);
    terminal.show();
    lockPiEditorGroup();
  }
}

async function openSession(
  sessionFile: string,
  extensionUri: vscode.Uri,
  bridgeConfig: { url: string; token: string } | undefined,
  sessionTracker: SessionTracker,
  chatTracker: ChatTracker,
): Promise<void> {
  if (useWebviewUi()) {
    await openChatPanel({ extensionUri, bridgeConfig, tracker: chatTracker, sessionFile });
    return;
  }
  const existing = sessionTracker.findTerminalBySessionFile(sessionFile);
  if (existing) {
    existing.show();
    return;
  }
  const terminalId = randomUUID();
  const terminal = await createNewTerminal({
    extensionUri,
    bridgeConfig,
    sessionFile,
    terminalId,
  });
  if (terminal) {
    sessionTracker.track(terminal, terminalId);
    sessionTracker.update(terminalId, sessionFile);
    terminal.show();
    lockPiEditorGroup();
  }
}

function useWebviewUi(): boolean {
  return vscode.workspace.getConfiguration("pi-agent-studio").get<string>("ui") === "webview";
}

async function renameSession(sessionFile: string, name: string): Promise<void> {
  const trimmed = name.trim();
  const sm = SessionManager.open(sessionFile);
  sm.appendSessionInfo(trimmed);
  syncOpenChatSession(sessionFile, { rename: trimmed });
}

async function deleteSession(sessionFile: string): Promise<void> {
  // Read header to get parentSession path for cascade re-parent
  let parentSessionPath: string | undefined;
  try {
    const firstLine = readFileSync(sessionFile, "utf8").split("\n")[0]!;
    const header = JSON.parse(firstLine) as { type?: string; parentSession?: string };
    if (header.type === "session") parentSessionPath = header.parentSession;
  } catch {
    // ignore malformed header
  }

  // Cascade re-parent: scan sibling .jsonl files and rewrite child headers
  const dir = sessionFile.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
  try {
    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".jsonl") && join(dir, f) !== sessionFile,
    );
    for (const file of files) {
      const childPath = join(dir, file);
      try {
        const content = readFileSync(childPath, "utf8");
        const lines = content.split("\n");
        const header = JSON.parse(lines[0]!) as { type?: string; parentSession?: string };
        if (header.type === "session" && header.parentSession === sessionFile) {
          header.parentSession = parentSessionPath;
          lines[0] = JSON.stringify(header);
          writeFileSync(childPath, lines.join("\n"));
        }
      } catch {
        // skip malformed files
      }
    }
  } catch {
    // skip if dir unreadable
  }

  unlinkSync(sessionFile);
}
