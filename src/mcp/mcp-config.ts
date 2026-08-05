import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

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

export interface ServerInfo {
  name: string;
  entry: ServerEntry;
}

export interface MergedServerInfo {
  name: string;
  entry: ServerEntry;
  source: "user" | "project";
}

export function getMcpUserPath(): string {
  return join(getAgentDir(), "mcp.json");
}

export function getMcpProjectPath(folder: string): string {
  return join(folder, ".pi", "mcp.json");
}

export function ensureMcpJson(path: string): string {
  if (!existsSync(path)) {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify({ mcpServers: {} }, null, 2) + "\n", "utf8");
  }
  return path;
}

export function readMcpConfig(path: string): McpConfig {
  if (!existsSync(path)) return { mcpServers: {} };
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    if (!data || typeof data !== "object") return { mcpServers: {} };
    return data as McpConfig;
  } catch {
    return { mcpServers: {} };
  }
}

export function writeMcpConfig(path: string, config: McpConfig): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf8");
}

function serversOf(config: McpConfig): ServerInfo[] {
  return Object.entries(config.mcpServers ?? {}).map(([name, entry]) => ({ name, entry }));
}

export function listServers(
  userPath: string,
  projectPath: string,
): {
  userServers: ServerInfo[];
  projectServers: ServerInfo[];
} {
  return {
    userServers: serversOf(readMcpConfig(userPath)),
    projectServers: projectPath ? serversOf(readMcpConfig(projectPath)) : [],
  };
}

/**
 * Merge user + project servers into a single list (project overrides user on
 * name collision), tagging each with its source scope.
 */
export function listMergedServers(userPath: string, projectPath: string): MergedServerInfo[] {
  const map = new Map<string, MergedServerInfo>();
  for (const { name, entry } of serversOf(readMcpConfig(userPath))) {
    map.set(name, { name, entry, source: "user" });
  }
  if (projectPath) {
    for (const { name, entry } of serversOf(readMcpConfig(projectPath))) {
      map.set(name, { name, entry, source: "project" });
    }
  }
  return [...map.values()];
}

export function addServer(path: string, name: string, entry: ServerEntry): void {
  const config = readMcpConfig(path);
  config.mcpServers ??= {};
  config.mcpServers[name] = entry;
  writeMcpConfig(path, config);
}

export function updateServer(path: string, name: string, entry: ServerEntry): void {
  const config = readMcpConfig(path);
  if (!config.mcpServers?.[name]) throw new Error(`Server "${name}" not found`);
  config.mcpServers[name] = entry;
  writeMcpConfig(path, config);
}

export function deleteServer(path: string, name: string): void {
  const config = readMcpConfig(path);
  delete config.mcpServers?.[name];
  writeMcpConfig(path, config);
}

export function toggleDisabled(path: string, name: string): void {
  const config = readMcpConfig(path);
  const entry = config.mcpServers?.[name];
  if (!entry) throw new Error(`Server "${name}" not found`);
  entry.disabled = !entry.disabled;
  writeMcpConfig(path, config);
}

/**
 * Parse webview form fields into a ServerEntry.
 * - args: one per line
 * - env: KEY=VALUE per line
 * - headers: KEY: VALUE per line
 * Empty arrays/objects are dropped so the JSON stays clean.
 */
export function parseServerEntry(form: {
  command?: string;
  args?: string;
  env?: string;
  cwd?: string;
  url?: string;
  headers?: string;
  bearerToken?: string;
  disabled?: boolean;
  directTools?: string;
  directToolsAll?: boolean;
  _transport?: string;
}): ServerEntry {
  const entry: ServerEntry = {};
  const transport = form._transport === "http" ? "http" : form._transport === "stdio" ? "stdio" : null;
  const command = form.command?.trim();
  const url = form.url?.trim();
  if (transport === "http" && url) {
    entry.url = url;
  } else if (transport === "stdio" && command) {
    entry.command = command;
    const args = (form.args ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (args.length > 0) entry.args = args;
  } else if (url) {
    entry.url = url;
  } else if (command) {
    entry.command = command;
    const args = (form.args ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (args.length > 0) entry.args = args;
  }
  const cwd = form.cwd?.trim();
  if (cwd) entry.cwd = cwd;
  const env = parseKV(form.env, "=");
  if (Object.keys(env).length > 0) entry.env = env;
  const headers = parseKV(form.headers, ":");
  if (Object.keys(headers).length > 0) entry.headers = headers;
  const bearer = form.bearerToken?.trim();
  if (bearer) entry.bearerToken = bearer;
  if (form.disabled) entry.disabled = true;
  if (form.directToolsAll) {
    entry.directTools = true;
  } else {
    const directTools = (form.directTools ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (directTools.length > 0) entry.directTools = directTools;
  }
  return entry;
}

function parseKV(text: string | undefined, sep: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of (text ?? "").split("\n")) {
    const idx = line.indexOf(sep);
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + sep.length).trim();
    if (key) out[key] = value;
  }
  return out;
}
