import { existsSync } from "node:fs";
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
      const valid: ChatSessionMap = {};
      for (const [panelId, sessionFile] of Object.entries(map)) {
        if (existsSync(sessionFile)) valid[panelId] = sessionFile;
      }
      if (Object.keys(valid).length !== Object.keys(map).length) {
        await write(valid);
      }
      for (const [panelId, sessionFile] of Object.entries(valid)) {
        try {
          await openFn(sessionFile, panelId);
        } catch (err) {
          console.error("[pi-agent-studio] Failed to restore chat session", sessionFile, err);
        }
      }
    },
  };
}
