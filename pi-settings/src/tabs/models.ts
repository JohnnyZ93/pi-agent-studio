import { vscode } from "../globals";
import { t } from "../i18n";

interface ModelEntry {
  id?: string;
  name?: string;
  api?: string;
  baseUrl?: string;
  contextWindow?: number;
  maxTokens?: number;
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    tiers?: unknown;
  };
  reasoning?: boolean;
  thinkingLevelMap?: Record<string, string | null>;
  input?: string[];
  headers?: Record<string, string>;
  compat?: Record<string, unknown>;
}

interface ProviderEntry {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  api?: string;
  headers?: Record<string, string>;
  authHeader?: boolean;
  compat?: Record<string, unknown>;
  models?: ModelEntry[];
}

interface ProviderInfo {
  id: string;
  name: string;
  type: string;
  modelCount: number;
}

interface ModelsData {
  providers: ProviderInfo[];
  modelsJson: { providers?: Record<string, ProviderEntry> };
  oauthStatuses: Array<{ id: string; name: string; connected: boolean }>;
  apikeyStatuses: Array<{ id: string; name: string; configured: boolean; modelCount: number }>;
}

export interface OAuthProgressEvent {
  type:
    | "auth_url"
    | "device_code"
    | "prompt"
    | "select"
    | "progress"
    | "success"
    | "error"
    | "cancelled";
  url?: string;
  instructions?: string;
  userCode?: string;
  verificationUri?: string;
  message?: string;
  placeholder?: string;
  options?: { id: string; label: string }[];
  token?: string;
}

let oauthState: OAuthProgressEvent | null = null;
let modelsTabActive = false;

export function setModelsTabActive(v: boolean) {
  modelsTabActive = v;
}

const APIS = [
  ["", t("(default)")],
  ["openai-completions", t("OpenAI Completions")],
  ["openai-responses", t("OpenAI Responses")],
  ["anthropic-messages", t("Anthropic Messages")],
  ["google-generative-ai", t("Google Generative AI")],
] as const;

interface CompatFieldDef {
  name: string;
  type: "bool" | "select" | "json";
  options?: readonly string[];
  group: "openai" | "anthropic";
}

const COMPAT_FIELDS: readonly CompatFieldDef[] = [
  { name: "supportsStore", type: "bool", group: "openai" },
  { name: "supportsDeveloperRole", type: "bool", group: "openai" },
  { name: "supportsReasoningEffort", type: "bool", group: "openai" },
  { name: "supportsUsageInStreaming", type: "bool", group: "openai" },
  { name: "supportsStrictMode", type: "bool", group: "openai" },
  { name: "supportsOpenAIGrammarTools", type: "bool", group: "openai" },
  { name: "requiresToolResultName", type: "bool", group: "openai" },
  { name: "requiresAssistantAfterToolResult", type: "bool", group: "openai" },
  { name: "requiresThinkingAsText", type: "bool", group: "openai" },
  { name: "requiresReasoningContentOnAssistantMessages", type: "bool", group: "openai" },
  { name: "sendSessionAffinityHeaders", type: "bool", group: "openai" },
  { name: "supportsLongCacheRetention", type: "bool", group: "openai" },
  {
    name: "maxTokensField",
    type: "select",
    group: "openai",
    options: ["", "max_completion_tokens", "max_tokens"],
  },
  {
    name: "thinkingFormat",
    type: "select",
    group: "openai",
    options: [
      "",
      "openai",
      "openrouter",
      "deepseek",
      "together",
      "zai",
      "qwen",
      "chat-template",
      "qwen-chat-template",
      "string-thinking",
      "ant-ling",
    ],
  },
  { name: "cacheControlFormat", type: "select", group: "openai", options: ["", "anthropic"] },
  {
    name: "sessionAffinityFormat",
    type: "select",
    group: "openai",
    options: ["", "openai", "openai-nosession", "openrouter"],
  },
  { name: "deferredToolsMode", type: "select", group: "openai", options: ["", "kimi"] },
  { name: "chatTemplateKwargs", type: "json", group: "openai" },
  { name: "openRouterRouting", type: "json", group: "openai" },
  { name: "vercelGatewayRouting", type: "json", group: "openai" },
  { name: "supportsEagerToolInputStreaming", type: "bool", group: "anthropic" },
  { name: "supportsCacheControlOnTools", type: "bool", group: "anthropic" },
  { name: "forceAdaptiveThinking", type: "bool", group: "anthropic" },
  { name: "allowEmptySignature", type: "bool", group: "anthropic" },
  { name: "supportsStrictTools", type: "bool", group: "anthropic" },
];

function renderHeadersField(id: string, headers?: Record<string, string>): string {
  const text = headers
    ? Object.entries(headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    : "";
  return `<label class="field-label">${t("Headers (KEY: VALUE, one per line; values support $ENV / !cmd)")}</label><textarea id="${id}" class="ta" style="height:70px" placeholder="X-Custom-Header: value&#10;Authorization: Bearer $TOKEN">${escHtml(text)}</textarea>`;
}

function readHeadersField(id: string): Record<string, string> | null {
  const el = document.getElementById(id) as HTMLTextAreaElement | null;
  const text = el?.value ?? "";
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx < 0) continue;
    const k = trimmed.slice(0, idx).trim();
    const v = trimmed.slice(idx + 1).trim();
    if (k) result[k] = v;
  }
  return Object.keys(result).length === 0 ? null : result;
}

function renderCompatSection(prefix: string, compat?: Record<string, unknown>): string {
  const hint = `<p class="compat-hint">${t(
    "Choose per-field override: default clears the field so pi uses API defaults.",
  )}</p>`;
  return `<div class="compat-wrap">${hint}${renderCompatGroup(
    prefix,
    "openai",
    t("OpenAI Compatibility"),
    false,
    compat,
  )}${renderCompatGroup(prefix, "anthropic", t("Anthropic Compatibility"), false, compat)}</div>`;
}

function renderCompatGroup(
  prefix: string,
  id: string,
  label: string,
  defaultOpen: boolean,
  compat?: Record<string, unknown>,
): string {
  const fields = COMPAT_FIELDS.filter((f) => f.group === id);
  let h = `<div class="cfg-group${defaultOpen ? " open" : ""}" data-compat-group="${id}">`;
  h += `<div class="cfg-group-header"><span class="codicon codicon-chevron-down"></span> ${label}</div>`;
  h += '<div class="cfg-group-body">';
  const bools = fields.filter((f) => f.type === "bool");
  if (bools.length) {
    h += '<div class="compat-bools">';
    for (const f of bools) {
      const cur = compat?.[f.name];
      const val = cur === true ? "True" : cur === false ? "False" : "Default";
      const opts = ["Default", "True", "False"]
        .map((o) => {
          const sel = o === val ? " selected" : "";
          return `<option value="${escAttr(o)}"${sel}>${escHtml(t(o))}</option>`;
        })
        .join("");
      h += `<div class="compat-bool"><span class="compat-bool-label" title="${escAttr(f.name)}">${escHtml(f.name)}</span><select id="${prefix}-${f.name}">${opts}</select></div>`;
    }
    h += "</div>";
  }
  for (const f of fields.filter((x) => x.type === "select")) {
    const cur = compat?.[f.name];
    h += `<label class="field-label">${f.name}</label><select id="${prefix}-${f.name}">`;
    for (const opt of f.options!) {
      const sel = cur === opt ? " selected" : "";
      h += `<option value="${escAttr(opt)}"${sel}>${escHtml(opt === "" ? t("(default)") : opt)}</option>`;
    }
    h += "</select>";
  }
  for (const f of fields.filter((x) => x.type === "json")) {
    const val = compat?.[f.name];
    const text = val != null ? safeJsonStringify(val) : "";
    h += `<label class="field-label">${f.name} (JSON)</label><textarea id="${prefix}-${f.name}" class="ta" style="height:70px" placeholder="{}">${escHtml(text)}</textarea>`;
  }
  h += "</div></div>";
  return h;
}

function safeJsonStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "";
  }
}

interface CompatReadResult {
  value: Record<string, unknown> | null;
  errors: string[];
}

function compatGroupVisible(fieldId: string): boolean {
  const el = document.getElementById(fieldId);
  if (!el) return true;
  const group = el.closest<HTMLElement>(".cfg-group");
  return group ? group.style.display !== "none" : true;
}

function applyCompatVisibility(apiValue: string, scope: Element): void {
  const openai =
    apiValue === "" || apiValue === "openai-completions" || apiValue === "openai-responses";
  const anthropic = apiValue === "" || apiValue === "anthropic-messages";
  scope.querySelectorAll<HTMLElement>("[data-compat-group]").forEach((g) => {
    const grp = g.getAttribute("data-compat-group");
    const show = grp === "openai" ? openai : anthropic;
    g.style.display = show ? "" : "none";
  });
}

function initCompatVisibility(scope: Element): void {
  const pd = scope.querySelector<HTMLSelectElement>("#pd-api");
  const pf = scope.querySelector<HTMLSelectElement>("#pf-api");
  const mf = scope.querySelector<HTMLSelectElement>("#mf-api");
  if (pd) applyCompatVisibility(pd.value, pd.closest(".editor-card") ?? scope);
  if (pf) applyCompatVisibility(pf.value, pf.closest(".editor-card") ?? scope);
  if (mf) {
    const apiVal = mf.value || (pd?.value ?? "");
    applyCompatVisibility(apiVal, mf.closest(".editor-card") ?? scope);
  }
}

function readCompatSection(prefix: string, existing?: Record<string, unknown>): CompatReadResult {
  const result: Record<string, unknown> = {};
  if (existing) Object.assign(result, existing);
  const errors: string[] = [];
  for (const f of COMPAT_FIELDS) {
    const id = `${prefix}-${f.name}`;
    if (!compatGroupVisible(id)) continue;
    if (f.type === "bool") {
      const el = document.getElementById(id) as HTMLSelectElement | null;
      const v = el?.value ?? "";
      if (v === "True") result[f.name] = true;
      else if (v === "False") result[f.name] = false;
      else delete result[f.name];
    } else if (f.type === "select") {
      const el = document.getElementById(id) as HTMLSelectElement | null;
      const v = el?.value ?? "";
      if (v) result[f.name] = v;
      else delete result[f.name];
    } else {
      const el = document.getElementById(id) as HTMLTextAreaElement | null;
      const txt = el?.value.trim() ?? "";
      if (txt) {
        try {
          result[f.name] = JSON.parse(txt);
        } catch {
          errors.push(t("Invalid JSON in {0}", f.name));
        }
      } else delete result[f.name];
    }
  }
  return { value: Object.keys(result).length === 0 ? null : result, errors };
}

export function handleOAuthProgress(ev: OAuthProgressEvent) {
  oauthState = ev;
  if (modelsTabActive && modelsEl && modelsEl.tab === "oauth")
    renderOAuth(modelsEl.el, modelsEl.data);
}

let modelsEl: { el: HTMLElement; data: ModelsData; tab: string } | null = null;
let currentData: ModelsData | null = null;
let boundParent: HTMLElement | null = null;

export function renderModelsTab(parent: HTMLElement, data: ModelsData) {
  currentData = data;
  modelsEl = { el: parent, data, tab: modelsEl?.tab ?? "providers" };
  ensureShell(parent);
  if (oauthState && modelsEl.tab === "oauth") renderOAuth(parent, data);
  else if (modelsEl.tab === "apikeys") renderApiKeys(parent, data);
  else renderProv(parent, data);
  if (boundParent !== parent) {
    boundParent = parent;
    parent.addEventListener("click", (e) => {
      const header = (e.target as HTMLElement).closest<HTMLElement>(".cfg-group-header");
      if (header) {
        header.parentElement?.classList.toggle("open");
        return;
      }
      const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (!btn) return;
      if (currentData) handleAction(btn, parent, currentData);
    });
    parent.addEventListener("change", (e) => {
      const target = e.target as HTMLElement;
      if (!target.matches("select")) return;
      const id = target.id;
      if (id !== "pd-api" && id !== "pf-api" && id !== "mf-api") return;
      const sel = target as HTMLSelectElement;
      if (id === "pd-api") {
        const card = sel.closest(".editor-card");
        if (card) applyCompatVisibility(sel.value, card);
        parent.querySelectorAll<HTMLSelectElement>("#mf-api").forEach((ms) => {
          if (!ms.value) {
            const mcard = ms.closest(".editor-card");
            if (mcard) applyCompatVisibility(sel.value, mcard);
          }
        });
      } else {
        const card = sel.closest(".editor-card");
        if (!card) return;
        const apiVal =
          sel.value || (parent.querySelector<HTMLSelectElement>("#pd-api")?.value ?? "");
        applyCompatVisibility(apiVal, card);
      }
    });
  }
}

function renderShell(parent: HTMLElement) {
  const tab = modelsEl?.tab ?? "providers";
  parent.innerHTML = /* html */ `
<div class="models-tabs">
  <div class="models-tab${tab === "providers" ? " active" : ""}" data-mtab="providers">${t("Providers")}</div>
  <div class="models-tab${tab === "oauth" ? " active" : ""}" data-mtab="oauth">${t("OAuth")}</div>
  <div class="models-tab${tab === "apikeys" ? " active" : ""}" data-mtab="apikeys">${t("API Keys")}</div>
</div>
<div id="models-body"></div>`;
}

function switchTab(parent: HTMLElement, tab: string) {
  parent.querySelectorAll(".models-tab").forEach((t) => {
    t.classList.toggle("active", t.getAttribute("data-mtab") === tab);
  });
  if (modelsEl) modelsEl.tab = tab;
  if (tab === "oauth") renderOAuth(parent, modelsEl!.data);
  else if (tab === "apikeys") renderApiKeys(parent, modelsEl!.data);
  else renderProv(parent, modelsEl!.data);
}

function ensureShell(parent: HTMLElement) {
  if (parent.querySelector(".models-tabs")) return;
  renderShell(parent);
  parent.querySelectorAll(".models-tab").forEach((t) => {
    t.addEventListener("click", () => switchTab(parent, t.getAttribute("data-mtab")!));
  });
}

function renderProv(parent: HTMLElement, data: ModelsData) {
  ensureShell(parent);
  const body = parent.querySelector("#models-body") as HTMLElement;
  const provs = data.providers || [];
  const state = provState;

  let h = `<div class="section-header"><h3>${t("Custom Providers")}</h3><div class="header-actions"><button class="btn-primary" data-action="start-add-prov"><span class="codicon codicon-add"></span> ${t("Add")}</button><button class="btn-secondary" data-action="open-file" title="${t("Open models.json")}"><span class="codicon codicon-go-to-file"></span> models.json</button></div></div>`;
  h += '<div class="item-list">';
  if (!provs.length) h += `<span class="dim">${t("No custom providers")}</span>`;
  for (const p of provs) {
    if (state.deleteTarget === p.id) {
      h += `<div class="confirm-bar">${escHtml(t('Delete "{0}"?', p.name))} <span><button class="btn-sm btn-danger" data-action="prov-delete-confirm" data-id="${escAttr(p.id)}">${t("Delete")}</button> <button class="btn-icon" data-action="prov-delete-cancel" title="${t("Cancel")}"><span class="codicon codicon-close"></span></button></span></div>`;
      continue;
    }
    const isExpanded = state.expanded === p.id;
    h += `<div class="item-row${isExpanded ? " selected" : ""}" data-action="prov-expand" data-id="${escAttr(p.id)}" style="cursor:pointer">`;
    h += `<div class="item-main"><div class="item-title"><span class="item-name">${escHtml(p.name)}</span><span class="badge badge-package">${t("custom")}</span></div><div class="item-desc">${t("{0} models", p.modelCount)}</div></div>`;
    h += `<div class="item-actions"><button class="btn-icon" data-action="prov-edit" data-id="${escAttr(p.id)}" title="${t("Edit")}"><span class="codicon codicon-edit"></span></button><button class="btn-icon btn-danger" data-action="prov-delete" data-id="${escAttr(p.id)}" title="${t("Delete")}"><span class="codicon codicon-trash"></span></button></div>`;
    h += "</div>";
    if (isExpanded) h += renderProvDetail(p.id, data);
  }
  if (state.editNew) h += renderProvAddForm();
  h += "</div>";
  body.innerHTML = h;
  initCompatVisibility(body);
}

function renderProvDetail(provId: string, data: ModelsData) {
  const prov = data.modelsJson.providers?.[provId];
  if (!prov) return "";
  const state = provState;
  let h = `<div class="editor-card"><h3>${t("Provider")}</h3>`;
  h += `<label class="field-label">${t("Name")}</label><input id="pd-name" value="${escAttr(provId)}" placeholder="provider-name" />`;
  h += `<label class="field-label">${t("Base URL")}</label><input id="pd-baseUrl" value="${escAttr(prov.baseUrl ?? "")}" placeholder="https://api.example.com/v1" />`;
  h += `<label class="field-label">${t("API Key")}</label><input id="pd-apiKey" type="password" value="${escAttr(prov.apiKey ?? "")}" placeholder="sk-... or $ENV_VAR or !cmd" />`;
  h += `<label class="field-label">${t("API Protocol")}</label><select id="pd-api">`;
  for (const [val, label] of APIS) {
    h += `<option value="${escAttr(val)}"${prov.api === val ? " selected" : ""}>${escHtml(label)}</option>`;
  }
  h += "</select>";
  h += `<label class="check-label"><input type="checkbox" id="pd-authHeader" ${prov.authHeader ? "checked" : ""} /> ${t("authHeader (add Authorization: Bearer header)")}</label>`;
  h += renderHeadersField("pd-headers", prov.headers);
  h += `<label class="field-label">${t("Compatibility")}</label>`;
  h += renderCompatSection("pd-cx", prov.compat);
  h += `<div class="btn-row"><button class="btn-primary" data-action="prov-save-detail" data-id="${escAttr(provId)}"><span class="codicon codicon-save"></span> ${t("Save")}</button><button class="btn-icon btn-danger" data-action="prov-delete" data-id="${escAttr(provId)}" title="${t("Delete")}"><span class="codicon codicon-trash"></span></button></div></div>`;

  const models = prov.models || [];
  h += `<div class="editor-card"><div class="section-header"><h3>${t("Models")}</h3><button class="btn-primary" data-action="model-add" data-pid="${escAttr(provId)}"><span class="codicon codicon-add"></span> ${t("Add")}</button></div>`;
  h += '<div class="item-list">';
  if (!models.length) h += `<span class="dim">${t("No models")}</span>`;
  for (const m of models) {
    const mid = m.id ?? "";
    if (
      state.deleteModel &&
      state.deleteModel.provider === provId &&
      state.deleteModel.modelId === mid
    ) {
      h += `<div class="confirm-bar">${escHtml(t('Delete model "{0}"?', m.name || mid))} <span><button class="btn-sm btn-danger" data-action="model-delete-confirm" data-pid="${escAttr(provId)}" data-mid="${escAttr(mid)}">${t("Delete")}</button> <button class="btn-icon" data-action="model-delete-cancel" title="${t("Cancel")}"><span class="codicon codicon-close"></span></button></span></div>`;
      continue;
    }
    if (state.editModel && state.editModel.provider === provId && state.editModel.modelId === mid) {
      h += renderModelFields(provId, m, false);
      continue;
    }
    h += `<div class="item-row"><div class="item-main"><div class="item-title">`;
    h += `<span class="item-name">${escHtml(m.name || mid)}</span><span class="badge badge-stdio">${escHtml(mid)}</span></div>`;
    h += `<div class="item-desc">${modelMeta(m)}</div></div>`;
    h += `<div class="item-actions"><button class="btn-icon" data-action="model-edit" data-pid="${escAttr(provId)}" data-mid="${escAttr(mid)}" title="${t("Edit")}"><span class="codicon codicon-edit"></span></button><button class="btn-icon btn-danger" data-action="model-delete" data-pid="${escAttr(provId)}" data-mid="${escAttr(mid)}" title="${t("Delete")}"><span class="codicon codicon-trash"></span></button></div>`;
    h += "</div>";
  }
  if (state.editModel && state.editModel.provider === provId && state.editModel.modelId === "new") {
    h += renderModelFields(provId, null, true);
  }
  h += "</div></div>";
  return h;
}

function modelMeta(m: ModelEntry): string {
  const parts: string[] = [];
  if (m.reasoning) parts.push(t("reasoning"));
  if (m.input?.includes("image")) parts.push(t("image"));
  parts.push(t("ctx:{0}", m.contextWindow ?? "?"));
  const ci = m.cost?.input ?? 0;
  const co = m.cost?.output ?? 0;
  parts.push(`$${ci}/$${co}`);
  return parts.join(" · ");
}

function renderProvAddForm() {
  return `<div class="editor-card"><h3>${t("Add Provider")}</h3>
    <label class="field-label">${t("Name")}</label><input id="pf-name" placeholder="my-provider" />
    <label class="field-label">${t("Base URL")}</label><input id="pf-baseUrl" placeholder="https://api.example.com/v1" />
    <label class="field-label">${t("API Key")}</label><input id="pf-apiKey" type="password" placeholder="sk-... or $ENV_VAR or !cmd" />
    <label class="field-label">${t("API Protocol")}</label><select id="pf-api">${APIS.map(([v, l]) => `<option value="${escAttr(v)}">${escHtml(l)}</option>`).join("")}</select>
    <label class="check-label"><input type="checkbox" id="pf-authHeader" /> ${t("authHeader (add Authorization: Bearer header)")}</label>
    ${renderHeadersField("pf-headers")}
    <label class="field-label">${t("Compatibility")}</label>
    ${renderCompatSection("pf-cx")}
    <div class="btn-row"><button class="btn-primary" data-action="prov-save-new"><span class="codicon codicon-save"></span> ${t("Save")}</button><button class="btn-secondary" data-action="prov-cancel-edit" title="${t("Cancel")}"><span class="codicon codicon-close"></span></button></div></div>`;
}

function renderModelFields(provId: string, existing: ModelEntry | null, isNew: boolean) {
  const e = existing;
  const costIn = e?.cost?.input != null ? e.cost.input : "";
  const costOut = e?.cost?.output != null ? e.cost.output : "";
  const costCacheRead = e?.cost?.cacheRead != null ? e.cost.cacheRead : "";
  const costCacheWrite = e?.cost?.cacheWrite != null ? e.cost.cacheWrite : "";
  const costTiers = e?.cost?.tiers != null ? safeJsonStringify(e.cost.tiers) : "";
  const hasImage = !!e?.input?.includes("image");
  const tlm = e?.thinkingLevelMap != null ? safeJsonStringify(e.thinkingLevelMap) : "";
  return `<div class="editor-card" style="border:1px solid var(--vscode-focusBorder);border-radius:4px;margin:4px 0"><h3>${isNew ? t("Add Model") : t("Edit Model")}</h3>
    <div class="form-row"><div class="form-group"><label class="field-label">${t("Model ID")}</label><input id="mf-id" value="${escAttr(e?.id ?? "")}" placeholder="model-id" ${isNew ? "" : "readonly"} /></div>
    <div class="form-group"><label class="field-label">${t("Display Name")}</label><input id="mf-name" value="${escAttr(e?.name ?? "")}" placeholder="${t("Optional")}" /></div></div>
    <div class="form-row"><div class="form-group"><label class="field-label">${t("Context Window")}</label><input id="mf-ctx" type="number" value="${e?.contextWindow ?? ""}" placeholder="200000" /></div>
    <div class="form-group"><label class="field-label">${t("Max Tokens")}</label><input id="mf-maxTok" type="number" value="${e?.maxTokens ?? ""}" placeholder="16384" /></div></div>
    <div class="form-row"><div class="form-group"><label class="field-label">${t("API Protocol (override)")}</label><select id="mf-api">${APIS.map(([v, l]) => `<option value="${escAttr(v)}"${e?.api === v ? " selected" : ""}>${escHtml(l)}</option>`).join("")}</select></div>
    <div class="form-group"><label class="field-label">${t("Base URL (override)")}</label><input id="mf-baseUrl" value="${escAttr(e?.baseUrl ?? "")}" placeholder="${t("Optional")}" /></div></div>
    <h4 style="margin:6px 0 2px;font-size:var(--fs-11);opacity:.7">${t("Cost (per million tokens)")}</h4>
    <div class="form-row"><div class="form-group"><label class="field-label">${t("Input")}</label><input id="mf-costIn" type="number" step="any" value="${costIn}" placeholder="0" /></div>
    <div class="form-group"><label class="field-label">${t("Output")}</label><input id="mf-costOut" type="number" step="any" value="${costOut}" placeholder="0" /></div></div>
    <div class="form-row"><div class="form-group"><label class="field-label">${t("Cache Read")}</label><input id="mf-costCacheRead" type="number" step="any" value="${costCacheRead}" placeholder="0" /></div>
    <div class="form-group"><label class="field-label">${t("Cache Write")}</label><input id="mf-costCacheWrite" type="number" step="any" value="${costCacheWrite}" placeholder="0" /></div></div>
    <label class="field-label">${t("Cost Tiers (JSON array)")}</label><textarea id="mf-costTiers" class="ta" style="height:80px" placeholder='[{ "inputTokensAbove": 272000, "input": 10, "output": 45, "cacheRead": 1, "cacheWrite": 12.5 }]'>${escHtml(costTiers)}</textarea>
    <div class="form-row" style="gap:14px;margin:4px 0">
      <label class="check-label"><input type="checkbox" id="mf-reasoning" ${e?.reasoning ? "checked" : ""} /> ${t("Reasoning")}</label>
      <label class="check-label"><input type="checkbox" id="mf-image" ${hasImage ? "checked" : ""} /> ${t("Image input")}</label>
    </div>
    <label class="field-label">${t("Thinking Level Map (JSON)")}</label><textarea id="mf-thinkingLevelMap" class="ta" style="height:90px" placeholder='{ "high": "high", "max": "max", "low": null }'>${escHtml(tlm)}</textarea>
    ${renderHeadersField("mf-headers", e?.headers)}
    <label class="field-label">${t("Compatibility")}</label>
    ${renderCompatSection("mf-cx", e?.compat)}
    <div class="btn-row"><button class="btn-primary" data-action="model-save" data-pid="${escAttr(provId)}" data-new="${isNew ? "1" : "0"}"><span class="codicon codicon-save"></span> ${t("Save")}</button><button class="btn-secondary" data-action="model-cancel" title="${t("Cancel")}"><span class="codicon codicon-close"></span></button></div></div>`;
}

// ====== OAuth tab ======
function renderOAuth(parent: HTMLElement, data: ModelsData) {
  const body = parent.querySelector("#models-body") as HTMLElement;
  if (!body) return;
  const items = data.oauthStatuses || [];
  if (oauthState) {
    body.innerHTML = renderOAuthProgress(oauthState);
    return;
  }
  if (!items.length) {
    body.innerHTML = `<span class="dim">${t("No OAuth providers available")}</span>`;
    return;
  }
  let h = "";
  for (const p of items) {
    h += `<div class="item-row"><div class="item-main"><div class="item-title"><span class="status-dot ${p.connected ? "on" : "off"}"></span><span class="item-name">${escHtml(p.name)}</span><span class="badge ${p.connected ? "badge-cli" : "badge-other"}">${p.connected ? t("connected") : t("not connected")}</span></div><div class="item-desc">${escHtml(p.id)}</div></div>`;
    h += `<div class="item-actions">`;
    if (p.connected)
      h += `<button class="btn-icon" data-action="oauth-logout" data-id="${escAttr(p.id)}" title="${t("Logout")}"><span class="codicon codicon-sign-out"></span></button>`;
    else
      h += `<button class="btn-icon" data-action="oauth-login" data-id="${escAttr(p.id)}" title="${t("Login")}"><span class="codicon codicon-sign-in"></span></button>`;
    h += "</div></div>";
  }
  body.innerHTML = h;
}

function renderOAuthProgress(s: OAuthProgressEvent): string {
  let h = '<div class="editor-card oauth-progress">';
  if (s.type === "auth_url") {
    h += `<strong>${t("Authorize")}</strong>`;
    h += `<div class="url"><a href="${escAttr(s.url ?? "")}" target="_blank">${escHtml(s.url ?? "")}</a></div>`;
    if (s.instructions) h += `<p class="dim">${escHtml(s.instructions)}</p>`;
    h += `<label class="field-label">${t("Or paste authorization code:")}</label><input id="oauth-code" placeholder="${t("Authorization code")}" />`;
    h += `<div class="btn-row"><button class="btn-primary" data-action="oauth-submit-code"><span class="codicon codicon-check"></span> ${t("Submit")}</button><button class="btn-secondary" data-action="oauth-cancel" title="${t("Cancel")}"><span class="codicon codicon-close"></span></button></div>`;
  } else if (s.type === "device_code") {
    h += `<strong>${t("Device Code")}</strong>`;
    h += `<p style="font-size:var(--fs-16);font-weight:bold;letter-spacing:2px">${escHtml(s.userCode ?? "")}</p>`;
    if (s.verificationUri)
      h += `<p><a href="${escAttr(s.verificationUri)}" target="_blank">${escHtml(s.verificationUri)}</a></p>`;
    h += `<div class="btn-row"><button class="btn-secondary" data-action="oauth-cancel" title="${t("Cancel")}"><span class="codicon codicon-close"></span></button></div>`;
  } else if (s.type === "prompt") {
    h += `<strong>${escHtml(s.message || t("Input required"))}</strong>`;
    h += `<div><input id="oauth-input" placeholder="${escAttr(s.placeholder ?? "")}" /></div>`;
    h += `<div class="btn-row"><button class="btn-primary" data-action="oauth-submit-input" data-token="${escAttr(s.token ?? "")}"><span class="codicon codicon-check"></span> ${t("Submit")}</button><button class="btn-secondary" data-action="oauth-cancel" title="${t("Cancel")}"><span class="codicon codicon-close"></span></button></div>`;
  } else if (s.type === "select") {
    h += `<strong>${escHtml(s.message || t("Select"))}</strong>`;
    for (const o of s.options ?? []) {
      h += `<div class="btn-row"><button class="btn-primary" data-action="oauth-submit-select" data-token="${escAttr(s.token ?? "")}" data-id="${escAttr(o.id)}">${escHtml(o.label)}</button></div>`;
    }
    h += `<div class="btn-row"><button class="btn-secondary" data-action="oauth-cancel" title="${t("Cancel")}"><span class="codicon codicon-close"></span></button></div>`;
  } else if (s.type === "progress") {
    h += `<p>${escHtml(s.message || t("Working..."))}</p>`;
  } else if (s.type === "success") {
    h += `<p style="color:#4caf50">✓ ${t("Connected successfully!")}</p>`;
    h += `<div class="btn-row"><button class="btn-secondary" data-action="oauth-dismiss" title="${t("Dismiss")}"><span class="codicon codicon-close"></span></button></div>`;
  } else if (s.type === "error") {
    h += `<p style="color:#d32f2f">${escHtml(t("Error: {0}", s.message ?? ""))}</p>`;
    h += `<div class="btn-row"><button class="btn-secondary" data-action="oauth-dismiss" title="${t("Dismiss")}"><span class="codicon codicon-close"></span></button></div>`;
  } else if (s.type === "cancelled") {
    h += `<p>${t("Login cancelled.")}</p>`;
    h += `<div class="btn-row"><button class="btn-secondary" data-action="oauth-dismiss" title="${t("Dismiss")}"><span class="codicon codicon-close"></span></button></div>`;
  }
  h += "</div>";
  return h;
}

// ====== API Keys tab ======
function renderApiKeys(parent: HTMLElement, data: ModelsData) {
  const body = parent.querySelector("#models-body") as HTMLElement;
  if (!body) return;
  const items = data.apikeyStatuses || [];
  if (!items.length) {
    body.innerHTML = `<span class="dim">${t("No API key providers found")}</span>`;
    return;
  }
  const state = provState;
  let h = "";
  for (const p of items) {
    if (state.apiKeyDeleteTarget === p.id) {
      h += `<div class="confirm-bar">${escHtml(t('Remove API key for "{0}"?', p.name))} <span><button class="btn-sm btn-danger" data-action="apikey-remove-confirm" data-id="${escAttr(p.id)}">${t("Remove")}</button> <button class="btn-icon" data-action="apikey-remove-cancel" title="${t("Cancel")}"><span class="codicon codicon-close"></span></button></span></div>`;
      continue;
    }
    h += `<div class="item-row"><div class="item-main"><div class="item-title"><span class="status-dot ${p.configured ? "on" : "off"}"></span><span class="item-name">${escHtml(p.name)}</span><span class="badge ${p.configured ? "badge-cli" : "badge-other"}">${p.configured ? t("configured") : t("not set")}</span></div><div class="item-desc">${t("{0} models", p.modelCount)}</div></div>`;
    h += `<div class="item-actions">`;
    if (p.configured)
      h += `<button class="btn-icon btn-danger" data-action="apikey-remove" data-id="${escAttr(p.id)}" title="${t("Remove API key")}"><span class="codicon codicon-trash"></span></button>`;
    else
      h += `<button class="btn-icon" data-action="apikey-set" data-id="${escAttr(p.id)}" title="${t("Set API key")}"><span class="codicon codicon-key"></span></button>`;
    h += "</div></div>";
    if (state.apiKeyEditing === p.id) {
      h += `<div class="editor-card"><label class="field-label">${escHtml(t("API Key for {0}", p.name))}</label><input id="apikey-input" type="password" placeholder="sk-..." />`;
      h += `<div class="btn-row"><button class="btn-primary" data-action="apikey-save" data-id="${escAttr(p.id)}"><span class="codicon codicon-save"></span> ${t("Save")}</button><button class="btn-secondary" data-action="apikey-cancel" title="${t("Cancel")}"><span class="codicon codicon-close"></span></button></div></div>`;
    }
  }
  body.innerHTML = h;
}

// ====== actions ======
interface ProvState {
  expanded: string | null;
  editNew: boolean;
  editModel: { provider: string; modelId: string } | null;
  deleteTarget: string | null;
  deleteModel: { provider: string; modelId: string } | null;
  apiKeyEditing: string | null;
  apiKeyDeleteTarget: string | null;
}

const provState: ProvState = {
  expanded: null,
  editNew: false,
  editModel: null,
  deleteTarget: null,
  deleteModel: null,
  apiKeyEditing: null,
  apiKeyDeleteTarget: null,
};

function handleAction(btn: HTMLElement, parent: HTMLElement, data: ModelsData) {
  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id") ?? "";
  const pid = btn.getAttribute("data-pid") ?? "";
  const mid = btn.getAttribute("data-mid") ?? "";
  const token = btn.getAttribute("data-token") ?? "";
  const isNew = btn.getAttribute("data-new") === "1";

  switch (action) {
    case "open-file":
      vscode.postMessage({ type: "openModelsFile" });
      break;
    case "refresh":
      vscode.postMessage({ type: "refresh", tab: "models" });
      break;
    case "start-add-prov":
      provState.editNew = true;
      provState.expanded = null;
      provState.editModel = null;
      renderProv(parent, data);
      break;
    case "prov-expand":
    case "prov-edit":
      provState.expanded = provState.expanded === id ? null : id;
      provState.editNew = false;
      provState.editModel = null;
      renderProv(parent, data);
      break;
    case "prov-delete":
      provState.deleteTarget = id;
      renderProv(parent, data);
      break;
    case "prov-delete-confirm":
      vscode.postMessage({ type: "deleteProvider", name: id });
      provState.deleteTarget = null;
      break;
    case "prov-delete-cancel":
      provState.deleteTarget = null;
      renderProv(parent, data);
      break;
    case "prov-save-new":
      saveProvForm(parent, data, true);
      break;
    case "prov-save-detail":
      saveProvDetail(parent, data, id);
      break;
    case "prov-cancel-edit":
      provState.editNew = false;
      renderProv(parent, data);
      break;
    case "model-add":
      provState.editModel = { provider: pid, modelId: "new" };
      provState.expanded = pid;
      provState.editNew = false;
      renderProv(parent, data);
      break;
    case "model-edit":
      provState.editModel = { provider: pid, modelId: mid };
      provState.expanded = pid;
      renderProv(parent, data);
      break;
    case "model-delete":
      provState.deleteModel = { provider: pid, modelId: mid };
      renderProv(parent, data);
      break;
    case "model-delete-confirm":
      vscode.postMessage({ type: "deleteModel", providerName: pid, modelId: mid });
      provState.deleteModel = null;
      break;
    case "model-delete-cancel":
      provState.deleteModel = null;
      renderProv(parent, data);
      break;
    case "model-save":
      saveModelForm(parent, data, pid, isNew);
      break;
    case "model-cancel":
      provState.editModel = null;
      renderProv(parent, data);
      break;
    case "oauth-login":
      vscode.postMessage({ type: "oauthLogin", providerId: id });
      break;
    case "oauth-logout":
      vscode.postMessage({ type: "oauthLogout", providerId: id });
      break;
    case "oauth-submit-code":
      submitOAuthCode();
      break;
    case "oauth-submit-input":
      submitOAuthInput(token);
      break;
    case "oauth-submit-select":
      vscode.postMessage({ type: "oauthRespond", token, value: id });
      break;
    case "oauth-cancel":
      vscode.postMessage({ type: "oauthCancel" });
      oauthState = null;
      renderOAuth(parent, data);
      break;
    case "oauth-dismiss":
      oauthState = null;
      renderOAuth(parent, data);
      break;
    case "apikey-set":
      provState.apiKeyEditing = id;
      renderApiKeys(parent, data);
      break;
    case "apikey-save":
      saveApiKey(parent, data, id);
      break;
    case "apikey-remove":
      provState.apiKeyDeleteTarget = id;
      renderApiKeys(parent, data);
      break;
    case "apikey-remove-confirm":
      vscode.postMessage({ type: "removeApiKey", providerId: id });
      provState.apiKeyDeleteTarget = null;
      break;
    case "apikey-remove-cancel":
      provState.apiKeyDeleteTarget = null;
      renderApiKeys(parent, data);
      break;
    case "apikey-cancel":
      provState.apiKeyEditing = null;
      renderApiKeys(parent, data);
      break;
  }
}

function saveProvForm(parent: HTMLElement, _data: ModelsData, _isNew: boolean) {
  const name = (document.getElementById("pf-name") as HTMLInputElement)?.value.trim() ?? "";
  if (!name) {
    showErr(parent, t("Provider name is required"));
    return;
  }
  const entry: Record<string, unknown> = {};
  const baseUrl = (document.getElementById("pf-baseUrl") as HTMLInputElement)?.value.trim() ?? "";
  if (baseUrl) entry.baseUrl = baseUrl;
  const apiKey = (document.getElementById("pf-apiKey") as HTMLInputElement)?.value.trim() ?? "";
  if (apiKey) entry.apiKey = apiKey;
  const api = (document.getElementById("pf-api") as HTMLSelectElement)?.value ?? "";
  if (api) entry.api = api;
  const authHeader =
    (document.getElementById("pf-authHeader") as HTMLInputElement)?.checked ?? false;
  if (authHeader) entry.authHeader = true;
  const headers = readHeadersField("pf-headers");
  if (headers) entry.headers = headers;
  const compat = readCompatSection("pf-cx");
  if (compat.errors.length) {
    showErr(parent, compat.errors.join("; "));
    return;
  }
  if (compat.value) entry.compat = compat.value;
  vscode.postMessage({ type: "addProvider", name, entry });
  provState.editNew = false;
}

function saveProvDetail(parent: HTMLElement, _data: ModelsData, provId: string) {
  const newName = (document.getElementById("pd-name") as HTMLInputElement)?.value.trim() ?? "";
  if (!newName) {
    showErr(parent, t("Provider name is required"));
    return;
  }
  const u: Record<string, unknown> = {};
  u.baseUrl = (document.getElementById("pd-baseUrl") as HTMLInputElement)?.value.trim() || null;
  u.apiKey = (document.getElementById("pd-apiKey") as HTMLInputElement)?.value.trim() || null;
  u.api = (document.getElementById("pd-api") as HTMLSelectElement)?.value || null;
  u.authHeader = (document.getElementById("pd-authHeader") as HTMLInputElement)?.checked
    ? true
    : null;
  u.headers = readHeadersField("pd-headers");
  const compat = readCompatSection("pd-cx");
  if (compat.errors.length) {
    showErr(parent, compat.errors.join("; "));
    return;
  }
  u.compat = compat.value;
  if (newName !== provId) {
    provState.expanded = newName;
    vscode.postMessage({ type: "renameProviderAndUpdate", oldName: provId, newName, updates: u });
  } else {
    vscode.postMessage({ type: "updateProvider", name: provId, updates: u });
  }
}

function saveModelForm(parent: HTMLElement, _data: ModelsData, provId: string, isNew: boolean) {
  const id = (document.getElementById("mf-id") as HTMLInputElement)?.value.trim() ?? "";
  if (!id) {
    showErr(parent, t("Model ID is required"));
    return;
  }
  const errors: string[] = [];
  const m: Record<string, unknown> = { id };
  const name = (document.getElementById("mf-name") as HTMLInputElement)?.value.trim() ?? "";
  m.name = name || null;
  const ctx = parseInt((document.getElementById("mf-ctx") as HTMLInputElement)?.value ?? "");
  m.contextWindow = ctx > 0 ? ctx : null;
  const maxTok = parseInt((document.getElementById("mf-maxTok") as HTMLInputElement)?.value ?? "");
  m.maxTokens = maxTok > 0 ? maxTok : null;
  const api = (document.getElementById("mf-api") as HTMLSelectElement)?.value ?? "";
  m.api = api || null;
  const baseUrl = (document.getElementById("mf-baseUrl") as HTMLInputElement)?.value.trim() ?? "";
  m.baseUrl = baseUrl || null;
  const costIn = parseFloat(
    (document.getElementById("mf-costIn") as HTMLInputElement)?.value ?? "",
  );
  const costOut = parseFloat(
    (document.getElementById("mf-costOut") as HTMLInputElement)?.value ?? "",
  );
  const costCacheRead = parseFloat(
    (document.getElementById("mf-costCacheRead") as HTMLInputElement)?.value ?? "",
  );
  const costCacheWrite = parseFloat(
    (document.getElementById("mf-costCacheWrite") as HTMLInputElement)?.value ?? "",
  );
  const tiersTxt = (
    (document.getElementById("mf-costTiers") as HTMLTextAreaElement)?.value ?? ""
  ).trim();
  let tiers: unknown = null;
  if (tiersTxt) {
    try {
      tiers = JSON.parse(tiersTxt);
    } catch {
      errors.push(t("Invalid JSON in Cost Tiers"));
    }
  }
  const anyCost =
    !isNaN(costIn) ||
    !isNaN(costOut) ||
    !isNaN(costCacheRead) ||
    !isNaN(costCacheWrite) ||
    tiers != null;
  if (anyCost) {
    const cost: Record<string, unknown> = {
      input: isNaN(costIn) ? 0 : costIn,
      output: isNaN(costOut) ? 0 : costOut,
      cacheRead: isNaN(costCacheRead) ? 0 : costCacheRead,
      cacheWrite: isNaN(costCacheWrite) ? 0 : costCacheWrite,
    };
    if (tiers != null) cost.tiers = tiers;
    m.cost = cost;
  } else {
    m.cost = null;
  }
  m.reasoning = (document.getElementById("mf-reasoning") as HTMLInputElement)?.checked ?? false;
  const image = (document.getElementById("mf-image") as HTMLInputElement)?.checked ?? false;
  m.input = image ? ["text", "image"] : null;
  const tlmTxt = (
    (document.getElementById("mf-thinkingLevelMap") as HTMLTextAreaElement)?.value ?? ""
  ).trim();
  if (tlmTxt) {
    try {
      m.thinkingLevelMap = JSON.parse(tlmTxt);
    } catch {
      errors.push(t("Invalid JSON in Thinking Level Map"));
    }
  } else {
    m.thinkingLevelMap = null;
  }
  m.headers = readHeadersField("mf-headers");
  const compat = readCompatSection("mf-cx");
  errors.push(...compat.errors);
  m.compat = compat.value;
  if (errors.length) {
    showErr(parent, errors.join("; "));
    return;
  }
  if (isNew) {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(m)) if (v !== null) clean[k] = v;
    vscode.postMessage({ type: "addModel", providerName: provId, model: clean });
  } else {
    vscode.postMessage({ type: "updateModel", providerName: provId, modelId: id, updates: m });
  }
  provState.editModel = null;
}

function submitOAuthCode() {
  const code = (document.getElementById("oauth-code") as HTMLInputElement)?.value.trim() ?? "";
  if (code && oauthState?.token) {
    vscode.postMessage({ type: "oauthRespond", token: oauthState.token, value: code });
  }
}

function submitOAuthInput(token: string) {
  const val = (document.getElementById("oauth-input") as HTMLInputElement)?.value.trim() ?? "";
  if (val) vscode.postMessage({ type: "oauthRespond", token, value: val });
}

function saveApiKey(parent: HTMLElement, _data: ModelsData, id: string) {
  const key = (document.getElementById("apikey-input") as HTMLInputElement)?.value.trim() ?? "";
  if (!key) {
    showErr(parent, t("API key is required"));
    return;
  }
  vscode.postMessage({ type: "saveApiKey", providerId: id, apiKey: key });
  provState.apiKeyEditing = null;
}

function showErr(parent: HTMLElement, msg: string) {
  const div = document.createElement("div");
  div.className = "error";
  div.textContent = msg;
  parent.prepend(div);
  setTimeout(() => div.remove(), 4000);
}

function escHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function escAttr(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
