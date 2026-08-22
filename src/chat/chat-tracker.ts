import * as vscode from "vscode";

const SESSIONS_KEY = "pi-agent-studio.chatSessions";

type ChatSessionMap = Record<string, string>;

export interface ChatTracker {
  update(panelId: string, sessionFile: string): void;
  /** Last session file stored for a panel/view id, or undefined. */
  get(panelId: string): string | undefined;
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
    get(panelId) {
      return read()[panelId];
    },
  };
}
