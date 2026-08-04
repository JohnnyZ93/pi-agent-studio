import type {
  AgentToolResult,
  ExtensionAPI,
  Theme,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { McpConnection, McpToolDetails, ToolMetadata } from "./types.ts";
import type { McpSession } from "./connection.ts";
import {
  isServerCacheValid,
  reconstructFromCache,
  reconstructFromDiscovered,
} from "./metadata-cache.ts";
import { renderMcpCall, renderMcpResult } from "./render.ts";

type TextBlock = { type: "text"; text: string };

/** pi 0.83+ runtime API (not yet in type defs). */
type UnregisterApi = { unregisterTool?: (name: string) => void };

const DIRECT_TOOLS_ADVISORY_THRESHOLD = 75;

/** Wrap an arbitrary MCP inputSchema as a TypeBox schema (passed through to the LLM). */
function toParameters(schema: unknown) {
  const normalized =
    schema && typeof schema === "object" && !Array.isArray(schema)
      ? (schema as Record<string, unknown>)
      : { type: "object", properties: {} };
  const { $schema: _s, additionalProperties: _a, ...rest } = normalized;
  void _s;
  void _a;
  return Type.Unsafe(rest as never);
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function blockToText(block: {
  type: string;
  text?: string;
  mimeType?: string;
  data?: string;
}): TextBlock {
  if (block.type === "text") return { type: "text", text: block.text ?? "" };
  if (block.type === "image" || block.type === "audio") {
    return { type: "text", text: `[${block.type}: ${block.mimeType ?? "?"}]` };
  }
  if (block.type === "resource") {
    return { type: "text", text: `[resource: ${block.text ?? block.data ?? ""}]` };
  }
  return { type: "text", text: `[${block.type}]` };
}

/** Remove previously-registered pinned direct tools (hot update before re-registering). */
function unregisterPinned(pi: ExtensionAPI, conn: McpConnection): void {
  const api = pi as ExtensionAPI & UnregisterApi;
  for (const name of conn.registeredToolNames ?? []) {
    api.unregisterTool?.(name);
  }
  conn.registeredToolNames = [];
}

/** Register pinned direct tools (mcp__<server>__<tool>) from already-resolved metadata. */
function registerPinnedDirectTools(
  pi: ExtensionAPI,
  getSession: () => McpSession | null,
  conn: McpConnection,
  meta: ToolMetadata[],
  directTools: string[] | true,
): void {
  const server = sanitizeName(conn.name);
  const serverName = conn.name;
  const filter = directTools === true ? null : new Set(directTools);
  const names: string[] = [];

  for (const tool of meta) {
    if (filter && !filter.has(tool.originalName)) continue;
    const toolName = sanitizeName(tool.originalName);
    const fullName = `mcp__${server}__${toolName}`;
    if (names.includes(fullName)) continue;
    names.push(fullName);

    const originalName = tool.originalName;
    pi.registerTool({
      name: fullName,
      label: `MCP: ${originalName}`,
      description: tool.description ?? `MCP tool ${originalName} from server ${serverName}`,
      parameters: toParameters(tool.inputSchema),
      async execute(_id, params): Promise<AgentToolResult<McpToolDetails>> {
        const session = getSession();
        if (!session) throw new Error("MCP session not active");
        const result = await session.callTool(
          serverName,
          originalName,
          params as Record<string, unknown>,
        );
        return {
          content: (result.content ?? []).map((b) =>
            blockToText(b as { type: string; text?: string; mimeType?: string; data?: string }),
          ),
          details: {
            server: serverName,
            tool: originalName,
            isError: result.isError === true,
            kind: "tool",
          },
        };
      },
      renderCall(args, theme: Theme) {
        return renderMcpCall(serverName, originalName, args as Record<string, unknown>, theme);
      },
      renderResult(
        result: AgentToolResult<McpToolDetails>,
        options: ToolRenderResultOptions,
        theme: Theme,
      ) {
        return renderMcpResult(result, options, theme);
      },
    });
  }

  conn.registeredToolNames = names;
  if (names.length >= DIRECT_TOOLS_ADVISORY_THRESHOLD) {
    console.warn(
      `MCP: ${names.length} direct tools registered for "${serverName}". ` +
        `Consider using the proxy (mcp_tool_search/mcp_tool_call) for large catalogs.`,
    );
  }
}

/**
 * Register pinned direct tools from the disk cache, before any server connects.
 * Lets pinned tools be available immediately at session start. Connection success
 * later hot-swaps them with the freshly-discovered set via registerServerTools.
 */
export function registerDirectToolsFromCache(
  pi: ExtensionAPI,
  getSession: () => McpSession | null,
  session: McpSession,
): void {
  const cache = session.metadataCache;
  if (!cache) return;
  for (const conn of session.allConnections()) {
    if (conn.entry.disabled) continue;
    const dt = conn.entry.directTools;
    if (!dt) continue;
    const entry = cache.servers[conn.name];
    if (!entry || !isServerCacheValid(entry, conn.entry)) continue;
    const meta = reconstructFromCache(conn.name, entry);
    registerPinnedDirectTools(pi, getSession, conn, meta, dt);
  }
}

/**
 * Register/refresh a connected server's pinned direct tools from its live
 * discovery. Unregisters any previously-registered pinned tools first (hot
 * update). Servers without `directTools` register nothing (pure proxy).
 */
export function registerServerTools(
  pi: ExtensionAPI,
  getSession: () => McpSession | null,
  conn: McpConnection,
): void {
  unregisterPinned(pi, conn);
  const discovered = conn.discovered;
  if (!discovered) return;
  const dt = conn.entry.directTools;
  if (!dt) {
    conn.registeredToolNames = [];
    return;
  }
  const meta = reconstructFromDiscovered(conn.name, discovered);
  registerPinnedDirectTools(pi, getSession, conn, meta, dt);
}
