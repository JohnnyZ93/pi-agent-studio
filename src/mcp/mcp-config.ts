import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export type McpExposure = "codemode" | "deferred" | "direct" | "hidden";

/**
 * Matches pi's built-in `mcpServers` shape. Unknown keys are ignored by pi;
 * `disabled` / `directTools` / `bearerToken` from the old bridge are not read.
 */
export interface ServerEntry {
  type?: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  oauth?: Record<string, unknown>;
  auth?: { provider: string };
  enabled?: boolean;
  exposure?: McpExposure;
  toolExposure?: Record<string, McpExposure>;
  description?: string;
  timeout?: number;
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

export function toggleEnabled(path: string, name: string): void {
  const config = readMcpConfig(path);
  const entry = config.mcpServers?.[name];
  if (!entry) throw new Error(`Server "${name}" not found`);
  if (entry.enabled === false) delete entry.enabled;
  else entry.enabled = false;
  writeMcpConfig(path, config);
}

const EXPOSURES: McpExposure[] = ["codemode", "deferred", "direct", "hidden"];

function isExposure(value: string): value is McpExposure {
  return (EXPOSURES as string[]).includes(value);
}

/**
 * Parse webview form fields into a ServerEntry matching pi's built-in schema.
 * - args: one per line
 * - env / headers: KEY=VALUE / KEY: VALUE per line
 * - toolExposure: `pattern=exposure` per line (order preserved)
 * - oauth: raw JSON object
 * Defaults (enabled: true, exposure: codemode, timeout: 60) are omitted.
 */
export function parseServerEntry(form: {
  command?: string;
  args?: string;
  env?: string;
  cwd?: string;
  url?: string;
  headers?: string;
  enabled?: boolean;
  exposure?: string;
  toolExposure?: string;
  description?: string;
  timeout?: string;
  oauth?: string;
  authProvider?: string;
  _transport?: string;
}): ServerEntry {
  const entry: ServerEntry = {};
  const transport =
    form._transport === "http" ? "http" : form._transport === "stdio" ? "stdio" : null;
  const command = form.command?.trim();
  const url = form.url?.trim();
  if (transport === "http" && url) {
    entry.url = url;
  } else if (transport === "stdio" && command) {
    entry.command = command;
  } else if (url) {
    entry.url = url;
  } else if (command) {
    entry.command = command;
  }

  if (entry.command) {
    const args = (form.args ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (args.length > 0) entry.args = args;
    const env = parseKV(form.env, "=");
    if (Object.keys(env).length > 0) entry.env = env;
    const cwd = form.cwd?.trim();
    if (cwd) entry.cwd = cwd;
  }
  if (entry.url) {
    const headers = parseKV(form.headers, ":");
    if (Object.keys(headers).length > 0) entry.headers = headers;
    const oauth = parseJsonObject(form.oauth);
    if (oauth) entry.oauth = oauth;
    const provider = form.authProvider?.trim();
    if (provider) entry.auth = { provider };
  }

  if (form.enabled === false) entry.enabled = false;
  const exposure = (form.exposure ?? "").trim();
  if (exposure && exposure !== "codemode" && isExposure(exposure)) entry.exposure = exposure;
  const toolExposure = parseToolExposure(form.toolExposure);
  if (toolExposure) entry.toolExposure = toolExposure;
  const description = form.description?.trim();
  if (description) entry.description = description;
  const timeout = Number(form.timeout);
  if (form.timeout?.trim() && Number.isFinite(timeout) && timeout > 0) entry.timeout = timeout;
  return entry;
}

function parseToolExposure(text: string | undefined): Record<string, McpExposure> | undefined {
  const out: Record<string, McpExposure> = {};
  for (const line of (text ?? "").split("\n")) {
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const tool = line.slice(0, idx).trim();
    const exposure = line.slice(idx + 1).trim();
    if (tool && isExposure(exposure)) out[tool] = exposure;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseJsonObject(text: string | undefined): Record<string, unknown> | undefined {
  const raw = text?.trim();
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value).length > 0 ? (value as Record<string, unknown>) : undefined;
    }
  } catch {
    // ignore malformed JSON; the webview validates before sending
  }
  return undefined;
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
