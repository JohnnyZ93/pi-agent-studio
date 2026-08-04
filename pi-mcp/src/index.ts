import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { McpSession } from "./connection.ts";
import type { McpConnection } from "./types.ts";
import { registerMcpCommand } from "./commands.ts";
import { registerServerPrompts } from "./prompts.ts";
import { registerDirectToolsFromCache, registerServerTools } from "./tools.ts";
import { registerProxyTools } from "./proxy-tools.ts";
import { startIdleManager, stopIdleManager } from "./idle.ts";

/** pi 0.83+ runtime API (not yet in type defs). */
type UnregisterApi = { unregisterTool?: (name: string) => void };

let currentSession: McpSession | null = null;
const registeredServers = new Set<string>();
let commandRegistered = false;

export default function (pi: ExtensionAPI) {
  const getSession = () => currentSession;

  function ensureServerRegistered(conn: McpConnection): void {
    // Hot-update pinned direct tools from the live discovery (unregisters the
    // cache-registered set first). Servers without directTools register none.
    registerServerTools(pi, getSession, conn);
    if (!registeredServers.has(conn.name)) {
      registerServerPrompts(pi, getSession, conn);
      registeredServers.add(conn.name);
    }
  }

  if (!commandRegistered) {
    registerMcpCommand(pi, getSession, ensureServerRegistered);
    commandRegistered = true;
  }

  pi.on("session_start", async (_event, ctx) => {
    await cleanupSession(pi);
    const session = new McpSession(ctx.cwd);
    currentSession = session;

    // Register the two proxy tools once (module-level dedup inside).
    registerProxyTools(pi, getSession);

    // Register pinned direct tools from disk cache, before any connection.
    registerDirectToolsFromCache(pi, getSession, session);

    if (session.serverNames().length > 0) {
      session.init(
        (name, conn) => {
          ensureServerRegistered(conn);
          const tools = conn.discovered?.tools.length ?? 0;
          ctx.ui.notify(`MCP ${name}: connected (${tools} tools)`, "info");
        },
        (name, error) => {
          ctx.ui.notify(`MCP ${name}: failed to connect - ${error}`, "warning");
        },
      );
    }
    startIdleManager(session);
  });

  pi.on("session_shutdown", async () => {
    stopIdleManager();
    await cleanupSession(pi);
    currentSession = null;
  });
}

/** Unregister a session's direct tools (avoid orphans across session switches) and disconnect. */
function cleanupSession(pi: ExtensionAPI): Promise<void> {
  const session = currentSession;
  if (!session) return Promise.resolve();
  const api = pi as ExtensionAPI & UnregisterApi;
  for (const conn of session.allConnections()) {
    for (const name of conn.registeredToolNames ?? []) {
      api.unregisterTool?.(name);
    }
  }
  return session.disconnectAll();
}
