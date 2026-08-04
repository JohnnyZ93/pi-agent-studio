import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { Prompt, Resource, Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  CachedPrompt,
  CachedResource,
  CachedTool,
  DiscoveredServer,
  MetadataCache,
  RESOURCE_LIST_TOOL_NAME,
  RESOURCE_READ_TOOL_NAME,
  ServerCacheEntry,
  ServerEntry,
  ToolMetadata,
} from "./types.ts";

const CACHE_VERSION = 1;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getMetadataCacheDir(): string {
  return join(getAgentDir(), "mcp-cache");
}

function getServerCachePath(serverName: string): string {
  return join(getMetadataCacheDir(), `${sanitizeName(serverName)}.json`);
}

interface ServerCacheFile {
  version: number;
  serverName: string;
  entry: ServerCacheEntry;
}

export function loadMetadataCache(enabledNames?: Set<string>): MetadataCache | null {
  const dir = getMetadataCacheDir();
  if (!existsSync(dir)) return null;
  if (enabledNames && enabledNames.size === 0) return null;
  const servers: Record<string, ServerCacheEntry> = {};
  let found = false;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(readFileSync(join(dir, name), "utf-8")) as ServerCacheFile;
      if (raw && raw.version === CACHE_VERSION && raw.serverName && raw.entry) {
        if (enabledNames && !enabledNames.has(raw.serverName)) continue;
        servers[raw.serverName] = raw.entry;
        found = true;
      }
    } catch {
      // skip corrupt/unreadable file
    }
  }
  return found ? { version: CACHE_VERSION, servers } : null;
}

export function saveMetadataCache(serverName: string, entry: ServerCacheEntry): void {
  const dir = getMetadataCacheDir();
  mkdirSync(dir, { recursive: true });
  const cachePath = getServerCachePath(serverName);
  const tmpPath = `${cachePath}.${process.pid}.tmp`;
  writeFileSync(tmpPath, JSON.stringify({ version: CACHE_VERSION, serverName, entry }), "utf-8");
  renameSync(tmpPath, cachePath);
}

export function computeServerHash(entry: ServerEntry): string {
  const identity: Record<string, unknown> = {
    command: entry.command,
    args: entry.args,
    env: entry.env,
    cwd: entry.cwd,
    url: entry.url,
    headers: entry.headers,
    bearerToken: entry.bearerToken,
  };
  return createHash("sha256").update(stableStringify(identity)).digest("hex");
}

export function isServerCacheValid(
  entry: ServerCacheEntry | undefined,
  definition: ServerEntry,
  maxAgeMs: number = CACHE_MAX_AGE_MS,
): boolean {
  if (!entry) return false;
  let configHash: string;
  try {
    configHash = computeServerHash(definition);
  } catch {
    return false;
  }
  if (entry.configHash !== configHash) return false;
  if (!entry.cachedAt || typeof entry.cachedAt !== "number") return false;
  if (maxAgeMs > 0 && Date.now() - entry.cachedAt > maxAgeMs) return false;
  return true;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function makeHandle(serverName: string, originalName: string): string {
  return `${sanitizeName(serverName)}_${sanitizeName(originalName)}`;
}

export function serializeTools(tools: Tool[]): CachedTool[] {
  return tools
    .filter((t) => t?.name)
    .map((t) => ({
      name: t.name,
      ...(t.description !== undefined ? { description: t.description } : {}),
      ...(t.inputSchema !== undefined ? { inputSchema: t.inputSchema } : {}),
    }));
}

export function serializeResources(resources: Resource[]): CachedResource[] {
  return resources
    .filter((r) => r?.name && r?.uri)
    .map((r) => ({
      uri: r.uri,
      name: r.name,
      ...(r.description !== undefined ? { description: r.description } : {}),
    }));
}

export function serializePrompts(prompts: Prompt[]): CachedPrompt[] {
  return (prompts ?? [])
    .filter((p) => p?.name)
    .map((p) => ({
      name: p.name,
      ...(p.description !== undefined ? { description: p.description } : {}),
      ...(Array.isArray(p.arguments)
        ? {
            arguments: p.arguments
              .filter((a) => a?.name)
              .map((a) => ({
                name: a.name,
                ...(a.description !== undefined ? { description: a.description } : {}),
                ...(a.required !== undefined ? { required: a.required } : {}),
              })),
          }
        : {}),
    }));
}

export function buildCacheEntry(
  definition: ServerEntry,
  discovered: DiscoveredServer,
): ServerCacheEntry {
  return {
    configHash: computeServerHash(definition),
    cachedAt: Date.now(),
    tools: serializeTools(discovered.tools),
    resources: serializeResources(discovered.resources),
    prompts: serializePrompts(discovered.prompts),
    ...(discovered.instructions !== undefined ? { instructions: discovered.instructions } : {}),
  };
}

interface ToolLike {
  name: string;
  description?: string;
  inputSchema?: unknown;
}
interface ResourceLike {
  uri: string;
  name: string;
  description?: string;
}

function reconstructMetadata(
  serverName: string,
  tools: ReadonlyArray<ToolLike | undefined>,
  resources: ReadonlyArray<ResourceLike | undefined>,
): ToolMetadata[] {
  const metadata: ToolMetadata[] = [];
  const seen = new Set<string>();
  for (const tool of tools) {
    if (!tool?.name) continue;
    const handle = makeHandle(serverName, tool.name);
    if (seen.has(handle)) continue;
    seen.add(handle);
    metadata.push({
      name: handle,
      originalName: tool.name,
      ...(tool.description !== undefined ? { description: tool.description } : {}),
      ...(tool.inputSchema !== undefined ? { inputSchema: tool.inputSchema } : {}),
    });
  }
  if (resources.length > 0) {
    const listHandle = makeHandle(serverName, RESOURCE_LIST_TOOL_NAME);
    if (!seen.has(listHandle)) {
      seen.add(listHandle);
      metadata.push({
        name: listHandle,
        originalName: RESOURCE_LIST_TOOL_NAME,
        description: `List all available resources from MCP server "${serverName}"`,
      });
    }
    const readHandle = makeHandle(serverName, RESOURCE_READ_TOOL_NAME);
    if (!seen.has(readHandle)) {
      seen.add(readHandle);
      metadata.push({
        name: readHandle,
        originalName: RESOURCE_READ_TOOL_NAME,
        description: `Read a specific resource from MCP server "${serverName}" by URI`,
        inputSchema: {
          type: "object",
          properties: {
            uri: { type: "string", description: "Resource URI to read" },
          },
          required: ["uri"],
        },
      });
    }
  }
  return metadata;
}

export function reconstructFromDiscovered(
  serverName: string,
  discovered: DiscoveredServer,
): ToolMetadata[] {
  return reconstructMetadata(serverName, discovered.tools, discovered.resources);
}

export function reconstructFromCache(serverName: string, entry: ServerCacheEntry): ToolMetadata[] {
  return reconstructMetadata(serverName, entry.tools ?? [], entry.resources ?? []);
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined || typeof value !== "object") {
    const s = JSON.stringify(value);
    return s === undefined ? "undefined" : s;
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}
