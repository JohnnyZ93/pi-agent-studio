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

export interface ResolvedServer {
  name: string;
  entry: ServerEntry;
  source: "user" | "project";
}

/**
 * Load user + project mcp.json, merge per-server (project overrides user on name
 * collision, whole-server replacement), and tag each resolved server with its
 * source scope.
 */
export function loadMergedServers(cwd: string): ResolvedServer[] {
  const user = readMcpJson(getUserMcpPath());
  const project = readMcpJson(getProjectMcpPath(cwd));
  const map = new Map<string, ResolvedServer>();
  for (const [name, entry] of Object.entries(user.mcpServers ?? {})) {
    map.set(name, { name, entry, source: "user" });
  }
  for (const [name, entry] of Object.entries(project.mcpServers ?? {})) {
    map.set(name, { name, entry, source: "project" });
  }
  return [...map.values()];
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
