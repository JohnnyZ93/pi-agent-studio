import type { McpSession } from "./connection.ts";

let timer: ReturnType<typeof setInterval> | undefined;

/**
 * Start a 60s sweep that idle-disconnects servers whose last activity is older
 * than PI_VSCODE_MCP_IDLE_TIMEOUT minutes. 0 / unset / invalid disables it.
 * Idle disconnect closes the transport but keeps `discovered` in memory so
 * mcp_tool_search keeps working; the next mcp_tool_call lazily reconnects.
 */
export function startIdleManager(session: McpSession): void {
  stopIdleManager();
  const timeoutMin = Number(process.env.PI_VSCODE_MCP_IDLE_TIMEOUT);
  if (!Number.isFinite(timeoutMin) || timeoutMin <= 0) return;
  const timeoutMs = timeoutMin * 60_000;

  timer = setInterval(() => {
    const now = Date.now();
    for (const conn of session.allConnections()) {
      if (conn.state !== "connected") continue;
      if ((conn.inFlight ?? 0) > 0) continue;
      const last = conn.lastUsedAt ?? 0;
      if (last > 0 && now - last > timeoutMs) {
        void session.idleDisconnect(conn.name).catch(() => {});
      }
    }
  }, 60_000);
  timer.unref?.();
}

export function stopIdleManager(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}
