import type {
  CallToolResult,
  ContentBlock,
  GetPromptResult,
  Prompt,
  ReadResourceResult,
  Resource,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

/** Synthetic tool names for resource access. */
export const RESOURCE_LIST_TOOL_NAME = "mcp__list_resources";
export const RESOURCE_READ_TOOL_NAME = "mcp__read_resource";

export interface ServerEntry {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  bearerToken?: string;
  disabled?: boolean;
  /** Pin specific tools as direct tools (skipped by mcp_tool_search). true = all. */
  directTools?: string[] | boolean;
}

export interface McpConfig {
  mcpServers?: Record<string, ServerEntry>;
}

export interface DiscoveredServer {
  tools: Tool[];
  resources: Resource[];
  prompts: Prompt[];
  instructions?: string;
}

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error" | "idle";

export interface McpConnection {
  name: string;
  entry: ServerEntry;
  source: "user" | "project";
  client: Client | null;
  state: ConnectionState;
  error?: string;
  discovered?: DiscoveredServer;
  /** Full names of tools registered for this server (mcp__<server>__*). */
  registeredToolNames?: string[];
  /** Epoch ms of last tool/resource call; used by idle disconnect. */
  lastUsedAt?: number;
  /** Outstanding in-flight requests; idle disconnect skips when > 0. */
  inFlight?: number;
}

export interface McpToolDetails {
  server: string;
  tool: string;
  isError?: boolean;
  kind: "tool" | "list_resources" | "read_resource" | "search" | "proxy_call";
  resourceUri?: string;
  query?: string;
}

export interface ToolMetadata {
  name: string;
  originalName: string;
  description?: string;
  inputSchema?: unknown;
}

export interface CachedTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface CachedResource {
  uri: string;
  name: string;
  description?: string;
}

export interface CachedPrompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

export interface ServerCacheEntry {
  configHash: string;
  cachedAt: number;
  tools?: CachedTool[];
  resources?: CachedResource[];
  prompts?: CachedPrompt[];
  instructions?: string;
}

export interface MetadataCache {
  version: number;
  servers: Record<string, ServerCacheEntry>;
}

export type { CallToolResult, ContentBlock, GetPromptResult, ReadResourceResult };
