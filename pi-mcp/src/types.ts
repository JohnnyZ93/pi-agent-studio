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

export interface ServerEntry {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  bearerToken?: string;
  disabled?: boolean;
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

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

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
}

export interface McpToolDetails {
  server: string;
  tool: string;
  isError?: boolean;
  kind: "tool" | "list_resources" | "read_resource";
  resourceUri?: string;
}

export type { CallToolResult, ContentBlock, GetPromptResult, ReadResourceResult };
