import type {
  AgentToolResult,
  ExtensionAPI,
  Theme,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { McpConnection, McpToolDetails } from "./types.ts";
import type { McpSession } from "./connection.ts";
import { renderMcpCall, renderMcpResult } from "./render.ts";

type TextBlock = { type: "text"; text: string };

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

/**
 * Register direct tools for a connected server: one tool per discovered MCP tool
 * (named mcp__<server>__<tool>), plus resource list/read tool pair if the server
 * exposes resources.
 */
export function registerServerTools(
  pi: ExtensionAPI,
  getSession: () => McpSession | null,
  conn: McpConnection,
): void {
  const server = sanitizeName(conn.name);
  const discovered = conn.discovered;
  if (!discovered) return;

  for (const tool of discovered.tools) {
    const toolName = sanitizeName(tool.name);
    const fullName = `mcp__${server}__${toolName}`;
    pi.registerTool({
      name: fullName,
      label: `MCP: ${tool.name}`,
      description: tool.description ?? `MCP tool ${tool.name} from server ${conn.name}`,
      parameters: toParameters(tool.inputSchema),
      async execute(
        _id,
        params,
        _signal,
        _onUpdate,
        _ctx,
      ): Promise<AgentToolResult<McpToolDetails>> {
        const session = getSession();
        if (!session) throw new Error("MCP session not active");
        const result = await session.callTool(
          conn.name,
          tool.name,
          params as Record<string, unknown>,
        );
        return {
          content: (result.content ?? []).map((b) =>
            blockToText(b as { type: string; text?: string; mimeType?: string; data?: string }),
          ),
          details: {
            server: conn.name,
            tool: tool.name,
            isError: result.isError === true,
            kind: "tool",
          },
        };
      },
      renderCall(args, theme: Theme) {
        return renderMcpCall(conn.name, tool.name, args as Record<string, unknown>, theme);
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

  if (discovered.resources.length > 0) {
    registerResourceTools(pi, getSession, conn, server);
  }
}

function registerResourceTools(
  pi: ExtensionAPI,
  getSession: () => McpSession | null,
  conn: McpConnection,
  server: string,
): void {
  const listName = `mcp__${server}__list_resources`;
  pi.registerTool({
    name: listName,
    label: `MCP: list resources (${conn.name})`,
    description: `List resources exposed by MCP server "${conn.name}". No arguments.`,
    parameters: Type.Unsafe({ type: "object", properties: {} } as never),
    async execute(
      _id,
      _params,
      _signal,
      _onUpdate,
      _ctx,
    ): Promise<AgentToolResult<McpToolDetails>> {
      const session = getSession();
      if (!session) throw new Error("MCP session not active");
      const resources = await session.listResources(conn.name);
      const text =
        resources.length === 0
          ? "No resources"
          : resources
              .map(
                (r) =>
                  `- ${r.uri}${r.name ? ` (${r.name})` : ""}${r.mimeType ? ` [${r.mimeType}]` : ""}`,
              )
              .join("\n");
      return {
        content: [{ type: "text", text }],
        details: { server: conn.name, tool: "list_resources", kind: "list_resources" },
      };
    },
    renderCall(_args, theme: Theme) {
      return renderMcpCall(conn.name, "list_resources", {}, theme);
    },
    renderResult(
      result: AgentToolResult<McpToolDetails>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      return renderMcpResult(result, options, theme);
    },
  });

  const readName = `mcp__${server}__read_resource`;
  pi.registerTool({
    name: readName,
    label: `MCP: read resource (${conn.name})`,
    description: `Read a resource from MCP server "${conn.name}". Pass the resource "uri".`,
    parameters: Type.Unsafe({
      type: "object",
      properties: { uri: { type: "string", description: "Resource URI to read" } },
      required: ["uri"],
    } as never),
    async execute(_id, params, _signal, _onUpdate, _ctx): Promise<AgentToolResult<McpToolDetails>> {
      const uri = (params as { uri?: string }).uri;
      if (!uri) {
        return {
          content: [{ type: "text", text: "Error: uri is required" }],
          details: {
            server: conn.name,
            tool: "read_resource",
            isError: true,
            kind: "read_resource",
          },
        };
      }
      const session = getSession();
      if (!session) throw new Error("MCP session not active");
      const result = await session.readResource(conn.name, uri);
      const text = joinResourceText(
        result.contents as Array<{ uri?: string; text?: string; mimeType?: string; blob?: string }>,
      );
      return {
        content: [{ type: "text", text }],
        details: {
          server: conn.name,
          tool: "read_resource",
          resourceUri: uri,
          kind: "read_resource",
        },
      };
    },
    renderCall(args, theme: Theme) {
      return renderMcpCall(conn.name, "read_resource", args as Record<string, unknown>, theme);
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
