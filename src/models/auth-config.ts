import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ModelRuntime, ModelRegistry, getAgentDir } from "@earendil-works/pi-coding-agent";

// Providers that authenticate via OAuth - excluded from the API Keys tab.
// Mirrors pi-web's app/api/auth/all-providers/route.ts.
const OAUTH_PROVIDER_IDS = new Set(["anthropic", "github-copilot", "openai-codex"]);

// OAuth providers we deliberately hide from the OAuth tab. Mirrors pi-web's
// app/api/auth/providers/route.ts EXCLUDED set.
const OAUTH_HIDDEN: Set<string> = new Set(["anthropic"]);
// Display name overrides for the OAuth tab (mirrors pi-web).
const OAUTH_DISPLAY_NAMES: Record<string, string> = {
  "openai-codex": "ChatGPT Plus/Pro",
  "github-copilot": "GitHub Copilot",
};

interface AuthEntry {
  type: "oauth" | "api_key";
  // OAuth fields
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  // API key field
  key?: string;
}

interface AuthJson {
  version?: number;
  [providerId: string]: AuthEntry | number | undefined;
}

function getAuthPath(): string {
  // Must match the SDK's AuthStorage default: ~/.pi/agent/auth.json.
  // Writing elsewhere means pi never sees keys saved via this webview.
  return join(getAgentDir(), "auth.json");
}

function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function readAuthJson(): AuthJson {
  const path = getAuthPath();
  console.log("[pi-agent-studio] readAuthJson: path =", path, "exists =", existsSync(path));
  if (!existsSync(path)) return { version: 1 };
  try {
    const content = readFileSync(path, "utf8");
    const data = JSON.parse(content) as AuthJson;
    console.log(
      "[pi-agent-studio] readAuthJson: loaded keys =",
      Object.keys(data).filter((k) => k !== "version").length,
    );
    return data;
  } catch {
    return { version: 1 };
  }
}

function writeAuthJson(data: AuthJson): void {
  const path = getAuthPath();
  ensureDir(path);
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

// ----------------------------------------------------------------------------
// ModelRuntime / ModelRegistry cache.
//
// 0.80.8 replaced the SDK's synchronous `ModelRegistry.create(authStorage)`
// with an async `ModelRuntime.create()` + `new ModelRuntime(runtime)` facade.
// `AuthStorage` is no longer exported, and its `read()/list()` cache auth.json
// in memory (only `reload()`/`modify()`/`delete()` refresh it). We therefore
// cache one ModelRuntime for view status reads and invalidate it after any
// direct auth.json write so the next read rebuilds with fresh credentials.
// ----------------------------------------------------------------------------

let runtimePromise: Promise<ModelRuntime> | undefined;
let registryCache: ModelRegistry | undefined;

async function createRuntime(): Promise<ModelRuntime> {
  const runtime = await ModelRuntime.create();
  registryCache = new ModelRegistry(runtime);
  return runtime;
}

export async function getModelRuntime(): Promise<ModelRuntime> {
  if (!runtimePromise) runtimePromise = createRuntime();
  return runtimePromise;
}

export async function getModelRegistry(): Promise<ModelRegistry> {
  await getModelRuntime();
  return registryCache!;
}

/** Drop the cached runtime/registry so the next read rebuilds from auth.json. */
export function invalidateModelRuntime(): void {
  runtimePromise = undefined;
  registryCache = undefined;
}

/** Reload models.json into the cached runtime (after models.json writes). */
export async function refreshModelRegistry(): Promise<void> {
  try {
    await (await getModelRegistry()).refresh();
  } catch (err) {
    console.error("[pi-agent-studio] refreshModelRegistry failed:", err);
  }
}

// Check if provider has auth
export function hasAuth(providerId: string): boolean {
  const auth = readAuthJson();
  const entry = auth[providerId];
  if (!entry || typeof entry !== "object") return false;
  if (entry.type === "oauth") {
    return !!entry.access_token;
  }
  if (entry.type === "api_key") {
    return !!entry.key;
  }
  return false;
}

// Logout (remove auth)
export function logout(providerId: string): void {
  const auth = readAuthJson();
  delete auth[providerId];
  writeAuthJson(auth);
  invalidateModelRuntime();
}

// Save OAuth credentials
export function saveOAuthCredentials(
  providerId: string,
  credentials: { access_token: string; refresh_token?: string; expires_at?: string },
): void {
  const auth = readAuthJson();
  auth[providerId] = {
    type: "oauth",
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token,
    expires_at: credentials.expires_at,
  };
  writeAuthJson(auth);
  invalidateModelRuntime();
}

// Get OAuth credentials
export function getOAuthCredentials(providerId: string):
  | {
      access_token?: string;
      refresh_token?: string;
      expires_at?: string;
    }
  | undefined {
  const auth = readAuthJson();
  const entry = auth[providerId];
  if (!entry || typeof entry !== "object" || entry.type !== "oauth") return undefined;
  return {
    access_token: entry.access_token,
    refresh_token: entry.refresh_token,
    expires_at: entry.expires_at,
  };
}

// Save API key
export function saveApiKey(providerId: string, key: string): void {
  const auth = readAuthJson();
  auth[providerId] = {
    type: "api_key",
    key: key.trim(),
  };
  writeAuthJson(auth);
  invalidateModelRuntime();
}

// Get API key
export function getApiKey(providerId: string): string | undefined {
  const auth = readAuthJson();
  const entry = auth[providerId];
  if (!entry || typeof entry !== "object" || entry.type !== "api_key") return undefined;
  return entry.key;
}

// Remove API key
export function removeApiKey(providerId: string): void {
  const auth = readAuthJson();
  delete auth[providerId];
  writeAuthJson(auth);
  invalidateModelRuntime();
}

/**
 * OAuth-capable providers, sourced from the cached ModelRuntime. A provider
 * supports OAuth when its `auth.oauth` handler is present. Mirrors pi-web's
 * /api/auth/providers list (same exclusions + display name overrides).
 */
export async function getOAuthProviders(): Promise<Array<{ id: string; name: string }>> {
  const runtime = await getModelRuntime();
  return runtime
    .getProviders()
    .filter((p) => p.auth?.oauth && !OAUTH_HIDDEN.has(p.id))
    .map((p) => ({ id: p.id, name: OAUTH_DISPLAY_NAMES[p.id] ?? p.name }));
}

// Get OAuth provider statuses
export async function getOAuthProviderStatuses(): Promise<
  Array<{
    id: string;
    name: string;
    connected: boolean;
  }>
> {
  const runtime = await getModelRuntime();
  return runtime
    .getProviders()
    .filter((p) => p.auth?.oauth && !OAUTH_HIDDEN.has(p.id))
    .map((p) => ({
      id: p.id,
      name: OAUTH_DISPLAY_NAMES[p.id] ?? p.name,
      connected: runtime.hasConfiguredAuth(p.id),
    }));
}

/**
 * API key providers, sourced from the SDK registry. Mirrors pi-web's
 * /api/auth/all-providers: iterate all models, dedupe by provider, skip
 * OAuth-only providers and custom (models.json_key) providers.
 */
export async function getApiKeyProviderStatuses(): Promise<
  Array<{
    id: string;
    name: string;
    configured: boolean;
    modelCount: number;
  }>
> {
  try {
    const registry = await getModelRegistry();
    const all = registry.getAll();
    const seen = new Set<string>();
    const result: Array<{
      id: string;
      name: string;
      configured: boolean;
      modelCount: number;
    }> = [];

    for (const m of all) {
      if (seen.has(m.provider)) continue;
      seen.add(m.provider);
      if (OAUTH_PROVIDER_IDS.has(m.provider)) continue;
      const status = registry.getProviderAuthStatus(m.provider);
      // Skip providers whose key comes from models.json (those are custom providers).
      if (status.source === "models_json_key") continue;
      const modelCount = all.filter((x) => x.provider === m.provider).length;
      result.push({
        id: m.provider,
        name: registry.getProviderDisplayName(m.provider),
        configured: status.configured,
        modelCount,
      });
    }

    return result;
  } catch (err) {
    console.error("[pi-agent-studio] getApiKeyProviderStatuses failed:", err);
    return [];
  }
}

// Get display name for a provider
export async function getProviderDisplayName(providerId: string): Promise<string> {
  const oauth = (await getOAuthProviders()).find((p) => p.id === providerId);
  if (oauth) return oauth.name;
  try {
    return (await getModelRegistry()).getProviderDisplayName(providerId);
  } catch {
    return providerId;
  }
}

// Check if provider is an OAuth provider
export async function isOAuthProvider(providerId: string): Promise<boolean> {
  return (await getOAuthProviders()).some((p) => p.id === providerId);
}

// Check if provider is an API key provider
export async function isApiKeyProvider(providerId: string): Promise<boolean> {
  return (await getApiKeyProviderStatuses()).some((p) => p.id === providerId);
}
