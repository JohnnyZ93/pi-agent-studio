import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { McpSession } from "./connection.ts";

function formatStatus(session: McpSession): string {
  const rows = session.status();
  if (rows.length === 0) return "No MCP servers configured.";
  return rows
    .map((r) => {
      const counts = `${r.tools}t/${r.resources}r/${r.prompts}p`;
      const err = r.error ? ` — ${r.error}` : "";
      return `${r.state.padEnd(12)} ${r.name} (${counts})${err}`;
    })
    .join("\n");
}

/** Register the /mcp command: status | list | reconnect [server]. */
export function registerMcpCommand(pi: ExtensionAPI, getSession: () => McpSession | null): void {
  pi.registerCommand("mcp", {
    description: "MCP bridge: /mcp [status|list|reconnect [server]]",
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
        if (targets.length === 0) {
          ctx.ui.notify("No MCP servers to reconnect.", "info");
          return;
        }
        ctx.ui.notify(`Reconnecting ${targets.length} MCP server(s)...`, "info");
        const results = await Promise.allSettled(targets.map((n) => session.reconnect(n)));
        const ok = results.filter((r) => r.status === "fulfilled").length;
        const fail = results.length - ok;
        const msg =
          fail === 0
            ? `Reconnected ${ok}/${results.length} MCP server(s).`
            : `Reconnected ${ok}/${results.length}; ${fail} failed.\n${formatStatus(session)}`;
        ctx.ui.notify(msg, fail === 0 ? "info" : "warning");
        return;
      }

      if (sub === "list") {
        ctx.ui.notify(formatStatus(session), "info");
        return;
      }

      // default: status
      ctx.ui.notify(formatStatus(session), "info");
    },
  });
}
