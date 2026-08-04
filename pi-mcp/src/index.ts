import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { McpSession } from "./connection.ts";
import type { McpConnection } from "./types.ts";
import { registerMcpCommand } from "./commands.ts";
import { registerServerPrompts } from "./prompts.ts";
import { registerServerTools } from "./tools.ts";

let currentSession: McpSession | null = null;
const registeredServers = new Set<string>();
let commandRegistered = false;

export default function (pi: ExtensionAPI) {
  const getSession = () => currentSession;

  /** Register a server's tools/prompts once (deduped by name). */
  function ensureServerRegistered(conn: McpConnection): void {
    if (registeredServers.has(conn.name)) return;
    registerServerTools(pi, getSession, conn);
    registerServerPrompts(pi, getSession, conn);
    registeredServers.add(conn.name);
  }

  if (!commandRegistered) {
    registerMcpCommand(pi, getSession, ensureServerRegistered);
    commandRegistered = true;
  }

  pi.on("session_start", async (_event, ctx) => {
    await currentSession?.disconnectAll();
    const session = new McpSession(ctx.cwd);
    currentSession = session;
    if (session.serverNames().length === 0) return;

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
  });

  pi.on("session_shutdown", async () => {
    await currentSession?.disconnectAll();
    currentSession = null;
  });
}
