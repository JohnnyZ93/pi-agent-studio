export type SessionStatus = "running" | "idle";
export type SessionSource = "terminal" | "chat";

export interface SessionStatusEntry {
  sessionFile: string;
  status: SessionStatus;
  source: SessionSource;
  terminalId?: string;
  panelId?: string;
}

export interface SessionStatusRegistry {
  upsert(entry: SessionStatusEntry): void;
  remove(sessionFile: string): void;
  get(sessionFile: string): SessionStatusEntry | undefined;
  getAll(): SessionStatusEntry[];
  onChanged(cb: (entries: SessionStatusEntry[]) => void): () => void;
}

function createSessionStatusRegistry(): SessionStatusRegistry {
  const store = new Map<string, SessionStatusEntry>();
  const listeners = new Set<(entries: SessionStatusEntry[]) => void>();

  function notify() {
    const snapshot = Array.from(store.values());
    for (const cb of listeners) cb(snapshot);
  }

  return {
    upsert(entry) {
      store.set(entry.sessionFile, entry);
      notify();
    },
    remove(sessionFile) {
      if (store.delete(sessionFile)) {
        notify();
      }
    },
    get(sessionFile) {
      return store.get(sessionFile);
    },
    getAll() {
      return Array.from(store.values());
    },
    onChanged(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

export const sessionStatusRegistry: SessionStatusRegistry = createSessionStatusRegistry();
