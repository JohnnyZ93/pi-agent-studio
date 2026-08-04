import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { Prompt, Resource, Tool } from "@modelcontextprotocol/sdk/types.js";
import type {
  CachedPrompt,
  CachedResource,
  CachedTool,
  DiscoveredServer,
  MetadataCache,
  ServerCacheEntry,
  ServerEntry,
  ToolMetadata,
} from "./types.ts";

const CACHE_VERSION = 1;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function getMetadataCachePath(): string {
  return join(getAgentDir(), "mcp-cache.json");
}

export function loadMetadataCache(): MetadataCache | null {
  const cachePath = getMetadataCachePath();
  if (!existsSync(cachePath)) return null;
  try {
    const raw = JSON.parse(readFileSync(cachePath, "utf-8"));
    if (!raw || typeof raw !== "object") return null;
    if (raw.version !== CACHE_VERSION) return null;
    if (!raw.servers || typeof raw.servers !== "object") return null;
    return raw as MetadataCache;
  } catch {
    return null;
  }
}

export function saveMetadataCache(serverName: string, entry: ServerCacheEntry): void {
  const cachePath = getMetadataCachePath();
  const dir = dirname(cachePath);
  mkdirSync(dir, { recursive: true });

  let merged: MetadataCache = { version: CACHE_VERSION, servers: {} };
  try {
    if (existsSync(cachePath)) {
      const existing = JSON.parse(readFileSync(cachePath, "utf-8")) as MetadataCache;
      if (existing && existing.version === CACHE_VERSION && existing.servers) {
        merged.servers = { ...existing.servers };
      }
    }
  } catch {
    // ignore parse errors, start fresh
  }
  merged.version = CACHE_VERSION;
  merged.servers[serverName] = entry;

  const tmpPath = `${cachePath}.${process.pid}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(merged, null, 2), "utf-8");
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
  for (const resource of resources) {
    if (!resource?.name || !resource?.uri) continue;
    const baseName = `read_${sanitizeName(resource.name)}`;
    const handle = makeHandle(serverName, baseName);
    if (seen.has(handle)) continue;
    seen.add(handle);
    metadata.push({
      name: handle,
      originalName: baseName,
      description: resource.description ?? `Read resource: ${resource.uri}`,
      resourceUri: resource.uri,
    });
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
