import { access } from "node:fs/promises";
import * as vscode from "vscode";

const SESSIONS_KEY = "pi-agent-studio.chatSessions";

type ChatSessionMap = Record<string, string>;

export interface ChatTracker {
  update(panelId: string, sessionFile: string): void;
  removePanel(panelId: string): void;
  restore(openFn: (sessionFile: string, panelId: string) => Promise<void>): Promise<void>;
}

export function createChatTracker(context: vscode.ExtensionContext): ChatTracker {
  const read = () => context.workspaceState.get<ChatSessionMap>(SESSIONS_KEY) ?? {};
  const write = (map: ChatSessionMap) => context.workspaceState.update(SESSIONS_KEY, map);

  return {
    update(panelId, sessionFile) {
      const map = read();
      if (map[panelId] === sessionFile) return;
      map[panelId] = sessionFile;
      void write(map);
    },
    removePanel(panelId) {
      const map = read();
      if (!(panelId in map)) return;
      delete map[panelId];
      void write(map);
    },
    async restore(openFn) {
      const map = read();
      const entries = Object.entries(map);
      const checks = await Promise.all(
        entries.map(async ([panelId, sessionFile]) => {
          try {
            await access(sessionFile);
            return [panelId, sessionFile] as const;
          } catch {
            return null;
          }
        }),
      );
      const valid = Object.fromEntries(
        checks.filter((e): e is readonly [string, string] => e !== null),
      );
      if (Object.keys(valid).length !== Object.keys(map).length) {
        await write(valid);
      }
      await Promise.all(
        Object.entries(valid).map(async ([panelId, sessionFile]) => {
          try {
            await openFn(sessionFile, panelId);
          } catch (err) {
            console.error("[pi-agent-studio] Failed to restore chat session", sessionFile, err);
          }
        }),
      );
    },
  };
}
