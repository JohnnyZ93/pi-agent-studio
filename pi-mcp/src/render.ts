import type {
  AgentToolResult,
  Theme,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { McpToolDetails } from "./types.ts";

const MAX_COLLAPSED_LINES = 3;
const MAX_ARG_PREVIEW = 200;

function summarizeArgs(args: Record<string, unknown>): string {
  try {
    const s = JSON.stringify(args);
    if (s === undefined) return "";
    return s.length > MAX_ARG_PREVIEW ? `${s.slice(0, MAX_ARG_PREVIEW)}…` : s;
  } catch {
    return "";
  }
}

export function renderMcpCall(
  server: string,
  tool: string,
  args: Record<string, unknown>,
  theme: Theme,
): Text {
  const head = theme.fg("toolTitle", theme.bold("mcp ")) + theme.fg("accent", `${server}/${tool}`);
  const body = summarizeArgs(args);
  const text = body ? `${head} ${theme.fg("dim", body)}` : head;
  return new Text(text, 0, 0);
}

function blockToText(block: { type: string; text?: string; mimeType?: string }): string {
  if (block.type === "text") return block.text ?? "";
  if (block.type === "image" || block.type === "audio")
    return `[${block.type}: ${block.mimeType ?? "?"}]`;
  if (block.type === "resource") return `[resource: ${block.text ?? ""}]`;
  return `[${block.type}]`;
}

export function renderMcpResult(
  result: AgentToolResult<McpToolDetails>,
  options: ToolRenderResultOptions,
  theme: Theme,
): Text {
  if (options.isPartial) {
    return new Text(theme.fg("warning", "Running MCP tool..."), 0, 0);
  }

  const details = result.details;
  const expanded = options.expanded || Boolean(details?.isError);

  const identity = details
    ? details.kind === "read_resource"
      ? `MCP ${details.server} resource ${details.resourceUri ?? ""}`
      : `MCP ${details.server}/${details.tool}`
    : null;

  const blocks = (result.content ?? []) as Array<{
    type: string;
    text?: string;
    mimeType?: string;
  }>;
  const allLines = blocks.flatMap((b) => blockToText(b).split("\n"));
  const lines = allLines.length > 0 ? allLines : ["(empty result)"];
  const shown = expanded ? lines : lines.slice(0, MAX_COLLAPSED_LINES);
  const truncated = !expanded && lines.length > MAX_COLLAPSED_LINES;

  const parts: string[] = [];
  if (identity) parts.push(theme.fg("muted", identity));
  const color = details?.isError ? "error" : "toolOutput";
  for (const line of shown) parts.push(theme.fg(color, line));
  if (truncated) parts.push(theme.fg("muted", `… +${lines.length - MAX_COLLAPSED_LINES} lines`));

  return new Text(parts.join("\n"), 0, 0);
}

export function renderProxyCall(
  action: "search" | "call",
  args: Record<string, unknown>,
  theme: Theme,
): Text {
  const head = theme.fg("toolTitle", theme.bold("mcp ")) + theme.fg("accent", action);
  const body = summarizeArgs(args);
  const text = body ? `${head} ${theme.fg("dim", body)}` : head;
  return new Text(text, 0, 0);
}

export function renderSearchResult(
  result: AgentToolResult<McpToolDetails>,
  options: ToolRenderResultOptions,
  theme: Theme,
): Text {
  if (options.isPartial) {
    return new Text(theme.fg("warning", "Searching MCP tools..."), 0, 0);
  }
  const query = result.details?.query ?? "";
  const head = theme.fg("muted", `MCP search${query ? `: ${query}` : ""}`);
  const blocks = (result.content ?? []) as Array<{ type: string; text?: string }>;
  const lines = blocks.flatMap((b) => (b.type === "text" ? (b.text ?? "").split("\n") : []));
  const shown = options.expanded ? lines : lines.slice(0, MAX_COLLAPSED_LINES);
  const truncated = !options.expanded && lines.length > MAX_COLLAPSED_LINES;
  const parts: string[] = [head];
  for (const line of shown) parts.push(theme.fg("toolOutput", line));
  if (truncated) parts.push(theme.fg("muted", `… +${lines.length - MAX_COLLAPSED_LINES} lines`));
  return new Text(parts.join("\n"), 0, 0);
}
