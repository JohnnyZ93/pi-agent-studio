import type {
  AgentToolResult,
  ExtensionAPI,
  Theme,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { McpSession } from "./connection.ts";
import {
  isServerCacheValid,
  reconstructFromCache,
  reconstructFromDiscovered,
} from "./metadata-cache.ts";
import {
  paginate,
  rankSuggestions,
  rankToolMatches,
  type RankedToolMatch,
} from "./search-ranking.ts";
import { renderMcpResult, renderProxyCall, renderSearchResult } from "./render.ts";
import type { McpConnection, McpToolDetails, ToolMetadata } from "./types.ts";

type TextBlock = { type: "text"; text: string };

let proxyRegistered = false;

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

function joinResourceText(
  contents: Array<{ uri?: string; text?: string; mimeType?: string; blob?: string }>,
): string {
  const lines: string[] = [];
  for (const c of contents) {
    if (c.text !== undefined) {
      lines.push(`${c.uri ?? "(resource)"}:\n${c.text}`);
    } else if (c.blob !== undefined) {
      lines.push(`${c.uri ?? "(resource)"}: [blob: ${c.mimeType ?? "?"}]`);
    } else {
      lines.push(`${c.uri ?? "(resource)"}`);
    }
  }
  return lines.join("\n\n");
}

/** Resolve a server's searchable metadata: live discovery first, else disk cache. */
function serverMetadata(session: McpSession, conn: McpConnection): ToolMetadata[] {
  if (conn.discovered) {
    return reconstructFromDiscovered(conn.name, conn.discovered);
  }
  const cache = session.metadataCache;
  const entry = cache?.servers[conn.name];
  if (entry && isServerCacheValid(entry, conn.entry)) {
    return reconstructFromCache(conn.name, entry);
  }
  return [];
}

/** All searchable (server, metadata) pairs across enabled servers. */
function collectSources(session: McpSession): Array<[string, ToolMetadata[]]> {
  const out: Array<[string, ToolMetadata[]]> = [];
  for (const conn of session.allConnections()) {
    if (conn.entry.disabled) continue;
    const meta = serverMetadata(session, conn);
    if (meta.length > 0) out.push([conn.name, meta]);
  }
  return out;
}

/** Search sources with pinned direct tools excluded (always_visible semantics). */
function collectSearchSources(session: McpSession): Array<[string, ToolMetadata[]]> {
  const out: Array<[string, ToolMetadata[]]> = [];
  for (const conn of session.allConnections()) {
    if (conn.entry.disabled) continue;
    const meta = serverMetadata(session, conn);
    if (meta.length === 0) continue;
    const dt = conn.entry.directTools;
    if (!dt) {
      out.push([conn.name, meta]);
      continue;
    }
    if (dt === true) continue;
    const pinned = new Set(dt);
    const filtered = meta.filter((t) => !pinned.has(t.originalName));
    if (filtered.length > 0) out.push([conn.name, filtered]);
  }
  return out;
}

interface ResolvedHandle {
  server: string;
  originalName: string;
  resourceUri?: string;
}

function resolveHandle(
  session: McpSession,
  handle: string,
  server?: string,
): ResolvedHandle | null {
  for (const [serverName, meta] of collectSources(session)) {
    if (server && serverName !== server) continue;
    for (const tool of meta) {
      if (tool.name === handle) {
        return {
          server: serverName,
          originalName: tool.originalName,
          resourceUri: tool.resourceUri,
        };
      }
    }
  }
  return null;
}

function schemaToShape(schema: unknown): string {
  if (!schema || typeof schema !== "object") return "{}";
  const s = schema as Record<string, unknown>;
  const props = s.properties;
  if (!props || typeof props !== "object") return "{}";
  const required = Array.isArray(s.required) ? new Set(s.required as string[]) : new Set<string>();
  const parts: string[] = [];
  for (const [key, val] of Object.entries(props)) {
    if (!val || typeof val !== "object") continue;
    const v = val as Record<string, unknown>;
    const type = typeof v.type === "string" ? v.type : "any";
    const opt = required.has(key) ? "" : "?";
    parts.push(`${key}${opt}: ${type}`);
  }
  return parts.length > 0 ? `{ ${parts.join(", ")} }` : "{}";
}

function renderMatch(idx: number, m: RankedToolMatch, includeSchemas: boolean): string {
  const lines: string[] = [];
  lines.push(`[${idx}] ${m.tool.name}`);
  lines.push(`    server: ${m.server}`);
  if (m.tool.resourceUri) {
    lines.push(`    [resource] uri: ${m.tool.resourceUri}`);
  }
  if (m.tool.description) {
    lines.push(`    description: ${m.tool.description}`);
  }
  if (includeSchemas && m.tool.inputSchema && !m.tool.resourceUri) {
    lines.push(`    params: ${schemaToShape(m.tool.inputSchema)}`);
  }
  return lines.join("\n");
}

function safeRegex(pattern: string): RegExp | null {
  if (pattern.length > 256) return null;
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

export function registerProxyTools(pi: ExtensionAPI, getSession: () => McpSession | null): void {
  if (proxyRegistered) return;
  proxyRegistered = true;

  pi.registerTool({
    name: "mcp_tool_search",
    label: "MCP: search tools",
    description:
      "Search MCP server tools/resources by keyword (weighted name/description match). " +
      "Returns matching tool handles to pass to mcp_tool_call. Set server to list one server's tools. " +
      "Pinned direct tools are excluded (call them directly). Set regex=true for regex matching.",
    parameters: Type.Object({
      query: Type.Optional(Type.String({ description: "Search query (keywords)." })),
      server: Type.Optional(
        Type.String({
          description: "Restrict to one server; with empty query lists its tools.",
        }),
      ),
      regex: Type.Optional(
        Type.Boolean({ description: "Treat query as a regex (case-insensitive)." }),
      ),
      limit: Type.Optional(Type.Number({ description: "Max results (default 10)." })),
      offset: Type.Optional(Type.Number({ description: "Pagination offset (default 0)." })),
      includeSchemas: Type.Optional(
        Type.Boolean({ description: "Include param shapes in results (default true)." }),
      ),
    }),
    async execute(_id, params): Promise<AgentToolResult<McpToolDetails>> {
      const session = getSession();
      if (!session) throw new Error("MCP session not active");
      const p = params as {
        query?: string;
        server?: string;
        regex?: boolean;
        limit?: number;
        offset?: number;
        includeSchemas?: boolean;
      };
      const query = (p.query ?? "").trim();
      const server = p.server?.trim() || undefined;
      const limit = p.limit ?? 10;
      const offset = p.offset ?? 0;
      const includeSchemas = p.includeSchemas !== false;

      const sources = collectSearchSources(session);

      if (!query && !server) {
        return {
          content: [
            {
              type: "text",
              text: 'Provide a non-empty "query", or set "server" to list a server\'s tools.',
            },
          ],
          details: {
            server: "",
            tool: "mcp_tool_search",
            kind: "search",
            isError: true,
          },
        };
      }

      let ranked: RankedToolMatch[];
      if (!query && server) {
        const src = sources.find(([s]) => s === server);
        if (!src) {
          return {
            content: [
              {
                type: "text",
                text: `No MCP server "${server}" (or it has no discoverable tools).`,
              },
            ],
            details: {
              server,
              tool: "mcp_tool_search",
              kind: "search",
              isError: true,
              query,
            },
          };
        }
        ranked = src[1].map((tool) => ({ server, tool, score: 0 }));
      } else if (p.regex) {
        const re = safeRegex(query);
        if (!re) {
          return {
            content: [{ type: "text", text: `Invalid regex: ${query}` }],
            details: {
              server: server ?? "",
              tool: "mcp_tool_search",
              kind: "search",
              isError: true,
              query,
            },
          };
        }
        ranked = [];
        for (const [serverName, meta] of sources) {
          if (server && serverName !== server) continue;
          for (const tool of meta) {
            const hay = `${tool.name} ${tool.originalName} ${tool.description ?? ""}`;
            if (re.test(hay)) ranked.push({ server: serverName, tool, score: 0 });
          }
        }
      } else {
        ranked = rankToolMatches(sources, query, server);
      }

      const page = paginate(ranked, offset, limit);
      if (page.items.length === 0) {
        return {
          content: [{ type: "text", text: `No MCP tools matched "${query}".` }],
          details: { server: server ?? "", tool: "mcp_tool_search", kind: "search", query },
        };
      }

      const lines: string[] = [];
      lines.push(
        `Found ${page.total} tool${page.total === 1 ? "" : "s"} (showing ${page.items.length}, offset ${offset}):`,
      );
      lines.push("");
      page.items.forEach((m, i) => {
        lines.push(renderMatch(offset + i + 1, m, includeSchemas));
        lines.push("");
      });
      if (page.hasMore && page.nextOffset !== null) {
        lines.push(`Next offset: ${page.nextOffset} (set offset=${page.nextOffset} to see more)`);
      }
      return {
        content: [{ type: "text", text: lines.join("\n").trimEnd() }],
        details: { server: server ?? "", tool: "mcp_tool_search", kind: "search", query },
      };
    },
    renderCall(args, theme: Theme) {
      return renderProxyCall("search", args as Record<string, unknown>, theme);
    },
    renderResult(
      result: AgentToolResult<McpToolDetails>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      return renderSearchResult(result, options, theme);
    },
  });

  pi.registerTool({
    name: "mcp_tool_call",
    label: "MCP: call tool",
    description:
      "Call an MCP tool or read a resource by its handle (the name returned by mcp_tool_search). " +
      "For resources (handles starting with read_), pass no args; the resource URI is resolved automatically.",
    parameters: Type.Object({
      tool: Type.String({
        description: "Tool handle from mcp_tool_search (e.g. server_tool_name).",
      }),
      args: Type.Optional(
        Type.Record(Type.String(), Type.Unknown(), {
          description: "Arguments object for the tool.",
        }),
      ),
      server: Type.Optional(
        Type.String({ description: "Restrict handle resolution to this server." }),
      ),
    }),
    async execute(_id, params): Promise<AgentToolResult<McpToolDetails>> {
      const session = getSession();
      if (!session) throw new Error("MCP session not active");
      const p = params as { tool?: string; args?: Record<string, unknown>; server?: string };
      const handle = (p.tool ?? "").trim();
      if (!handle) {
        return {
          content: [
            {
              type: "text",
              text: 'Error: "tool" is required (a handle from mcp_tool_search).',
            },
          ],
          details: { server: "", tool: "mcp_tool_call", kind: "proxy_call", isError: true },
        };
      }

      const resolved = resolveHandle(session, handle, p.server?.trim() || undefined);
      if (!resolved) {
        const suggestions = rankSuggestions(collectSources(session), handle, 5);
        const hint =
          suggestions.length > 0
            ? `\nDid you mean one of?\n${suggestions.map((s) => `  - ${s}`).join("\n")}`
            : "";
        return {
          content: [{ type: "text", text: `MCP tool "${handle}" not found.${hint}` }],
          details: { server: "", tool: handle, kind: "proxy_call", isError: true },
        };
      }

      if (resolved.resourceUri) {
        const result = await session.readResource(resolved.server, resolved.resourceUri);
        const text = joinResourceText(
          result.contents as Array<{
            uri?: string;
            text?: string;
            mimeType?: string;
            blob?: string;
          }>,
        );
        return {
          content: [{ type: "text", text }],
          details: {
            server: resolved.server,
            tool: "read_resource",
            kind: "read_resource",
            resourceUri: resolved.resourceUri,
          },
        };
      }

      const result = await session.callTool(resolved.server, resolved.originalName, p.args ?? {});
      return {
        content: (result.content ?? []).map((b) =>
          blockToText(b as { type: string; text?: string; mimeType?: string; data?: string }),
        ),
        details: {
          server: resolved.server,
          tool: resolved.originalName,
          isError: result.isError === true,
          kind: "proxy_call",
        },
      };
    },
    renderCall(args, theme: Theme) {
      return renderProxyCall("call", args as Record<string, unknown>, theme);
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
