import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { McpConnection } from "./types.ts";
import type { McpSession } from "./connection.ts";

/** Marker prefix the host side recognizes as a structured MCP status payload. */
export const MCP_STATUS_MARKER = "__mcp_status__";

/**
 * pi's active-tool whitelist API (in the type defs since 0.84; kept optional
 * here for runtime safety). setActiveTools rebuilds the system prompt and
 * takes effect on the next agent turn, so stopped servers' tool definitions
 * are no longer sent to the LLM (saving tokens).
 */
type ActiveToolsApi = {
  getActiveTools?: () => string[];
  setActiveTools?: (names: string[]) => void;
};

function emitStatus(
  session: McpSession,
  ctx: { ui: { notify: (m: string, t?: "info" | "warning" | "error") => void } },
): void {
  ctx.ui.notify(MCP_STATUS_MARKER + JSON.stringify(session.status()), "info");
}

/** Remove a list of tool names from the active whitelist (they stay registered). */
function deactivateTools(pi: ExtensionAPI, names: string[]): void {
  const api = pi as ExtensionAPI & ActiveToolsApi;
  if (names.length === 0) return;
  const remove = new Set(names);
  const active = api.getActiveTools?.() ?? [];
  const next = active.filter((n) => !remove.has(n));
  if (next.length !== active.length) api.setActiveTools?.(next);
}

/** Re-add a server's tools to the active whitelist. */
function activateServerTools(pi: ExtensionAPI, names: string[]): void {
  const api = pi as ExtensionAPI & ActiveToolsApi;
  if (names.length === 0) return;
  const active = api.getActiveTools?.() ?? [];
  const set = new Set(active);
  let changed = false;
  for (const n of names) {
    if (!set.has(n)) {
      set.add(n);
      changed = true;
    }
  }
  if (changed) api.setActiveTools?.([...set]);
}

/** Register the /mcp command: status | list | reconnect [server] | start <server> | stop <server>. */
export function registerMcpCommand(
  pi: ExtensionAPI,
  getSession: () => McpSession | null,
  ensureServerRegistered: (conn: McpConnection) => void,
): void {
  pi.registerCommand("mcp", {
    description: "MCP bridge: /mcp [status|list|reconnect [server]|start <server>|stop <server>]",
    handler: async (args, ctx) => {
      const session = getSession();
      if (!session) {
        ctx.ui.notify("MCP bridge is not active.", "warning");
        return;
      }
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const sub = parts[0] ?? "status";
      const serverArg = parts[1];

      if (sub === "reconnect") {
        const targets = serverArg ? [serverArg] : session.serverNames();
        if (targets.length === 0) return emitStatus(session, ctx);
        const results = await Promise.allSettled(targets.map((n) => session.reconnect(n)));
        for (const r of results) {
          if (r.status === "fulfilled") ensureServerRegistered(r.value);
        }
        return emitStatus(session, ctx);
      }

      if (sub === "start") {
        if (!serverArg) return emitStatus(session, ctx);
        const conn = await session.ensureConnected(serverArg).catch(() => undefined);
        if (conn) {
          ensureServerRegistered(conn);
          if (conn.registeredToolNames) activateServerTools(pi, conn.registeredToolNames);
        }
        return emitStatus(session, ctx);
      }

      if (sub === "stop") {
        if (!serverArg) return emitStatus(session, ctx);
        const conn = session.getConnection(serverArg);
        const names = conn?.registeredToolNames ?? [];
        await session.disconnect(serverArg);
        deactivateTools(pi, names);
        return emitStatus(session, ctx);
      }

      // default: status | list
      emitStatus(session, ctx);
    },
  });
}
