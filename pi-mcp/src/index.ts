import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { McpSession } from "./connection.ts";
import { registerMcpCommand } from "./commands.ts";
import { registerServerPrompts } from "./prompts.ts";
import { registerServerTools } from "./tools.ts";

function isDisabled(): boolean {
  try {
    const parsed = JSON.parse(process.env.PI_VSCODE_DISABLED_TOOLS ?? "[]");
    return Array.isArray(parsed) && (parsed as string[]).includes("mcp");
  } catch {
    return false;
  }
}

let currentSession: McpSession | null = null;
const registeredServers = new Set<string>();
let commandRegistered = false;

export default function (pi: ExtensionAPI) {
  const getSession = () => currentSession;

  if (!commandRegistered) {
    registerMcpCommand(pi, getSession);
    commandRegistered = true;
  }

  if (isDisabled()) return;

  pi.on("session_start", async (_event, ctx) => {
    await currentSession?.disconnectAll();
    const session = new McpSession(ctx.cwd);
    currentSession = session;
    if (session.serverNames().length === 0) return;

    session.init(
      (name, conn) => {
        // Tools/prompts are registered once per server name (they read the live
        // session via getSession, so they keep working across session switches).
        if (!registeredServers.has(name)) {
          registerServerTools(pi, getSession, conn);
          registerServerPrompts(pi, getSession, conn);
          registeredServers.add(name);
        }
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
