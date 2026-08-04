import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { McpConfig, ServerEntry } from "./types.ts";

export function getUserMcpPath(): string {
  return join(getAgentDir(), "mcp.json");
}

export function getProjectMcpPath(cwd: string): string {
  return join(cwd, ".pi", "mcp.json");
}

export function readMcpJson(path: string): McpConfig {
  if (!existsSync(path)) return {};
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    if (!data || typeof data !== "object") return {};
    return data as McpConfig;
  } catch {
    return {};
  }
}

/**
 * Load user + project mcp.json and merge.
 * Project overrides user per-server (whole-server replacement).
 */
export function loadMergedConfig(cwd: string): McpConfig {
  const user = readMcpJson(getUserMcpPath());
  const project = readMcpJson(getProjectMcpPath(cwd));
  const merged: Record<string, ServerEntry> = {
    ...user.mcpServers,
    ...project.mcpServers,
  };
  return { mcpServers: merged };
}

export function enabledServers(config: McpConfig): Array<[string, ServerEntry]> {
  return Object.entries(config.mcpServers ?? {}).filter(([, entry]) => !entry.disabled);
}
