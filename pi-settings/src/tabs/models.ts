import { vscode } from "../globals";

interface ModelEntry {
  id?: string;
  name?: string;
  contextWindow?: number;
  maxTokens?: number;
  cost?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
  reasoning?: boolean;
  input?: string[];
}

interface ProviderEntry {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  api?: string;
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
  ["", "(default)"],
  ["openai-completions", "OpenAI Completions"],
  ["openai-responses", "OpenAI Responses"],
  ["anthropic-messages", "Anthropic Messages"],
  ["google-generative-ai", "Google Generative AI"],
] as const;

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
      const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (!btn) return;
      if (currentData) handleAction(btn, parent, currentData);
    });
  }
}

function renderShell(parent: HTMLElement) {
  const t = modelsEl?.tab ?? "providers";
  parent.innerHTML = /* html */ `
<div class="models-tabs">
  <div class="models-tab${t === "providers" ? " active" : ""}" data-mtab="providers">Providers</div>
  <div class="models-tab${t === "oauth" ? " active" : ""}" data-mtab="oauth">OAuth</div>
  <div class="models-tab${t === "apikeys" ? " active" : ""}" data-mtab="apikeys">API Keys</div>
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

  let h =
    '<div class="section-header"><h3>Custom Providers</h3><button class="btn-primary" data-action="start-add-prov"><span class="codicon codicon-add"></span> Add</button></div>';
  h += '<div class="item-list">';
  if (!provs.length) h += '<span class="dim">No custom providers</span>';
  for (const p of provs) {
    if (state.deleteTarget === p.id) {
      h += `<div class="confirm-bar">Delete "${escHtml(p.name)}"? <span><button class="btn-sm btn-danger" data-action="prov-delete-confirm" data-id="${escAttr(p.id)}">Delete</button> <button class="btn-icon" data-action="prov-delete-cancel" title="Cancel"><span class="codicon codicon-close"></span></button></span></div>`;
      continue;
    }
    const isExpanded = state.expanded === p.id;
    h += `<div class="item-row${isExpanded ? " selected" : ""}" data-action="prov-expand" data-id="${escAttr(p.id)}" style="cursor:pointer">`;
    h += `<div class="item-main"><div class="item-title"><span class="item-name">${escHtml(p.name)}</span><span class="badge badge-package">custom</span></div><div class="item-desc">${p.modelCount} models</div></div>`;
    h += `<div class="item-actions"><button class="btn-icon" data-action="prov-edit" data-id="${escAttr(p.id)}" title="Edit"><span class="codicon codicon-edit"></span></button><button class="btn-icon btn-danger" data-action="prov-delete" data-id="${escAttr(p.id)}" title="Delete"><span class="codicon codicon-trash"></span></button></div>`;
    h += "</div>";
    if (isExpanded) h += renderProvDetail(p.id, data);
  }
  if (state.editNew) h += renderProvAddForm();
  h += "</div>";
  body.innerHTML = h;
}

function renderProvDetail(provId: string, data: ModelsData) {
  const prov = data.modelsJson.providers?.[provId];
  if (!prov) return "";
  const state = provState;
  let h = `<div class="editor-card"><h3>Provider</h3>`;
  h += `<label class="field-label">Name</label><input id="pd-name" value="${escAttr(provId)}" placeholder="provider-name" />`;
  h += `<label class="field-label">Base URL</label><input id="pd-baseUrl" value="${escAttr(prov.baseUrl ?? "")}" placeholder="https://api.example.com/v1" />`;
  h += `<label class="field-label">API Key</label><input id="pd-apiKey" type="password" value="${escAttr(prov.apiKey ?? "")}" placeholder="sk-... or $ENV_VAR" />`;
  h += `<label class="field-label">API Protocol</label><select id="pd-api">`;
  for (const [val, label] of APIS) {
    h += `<option value="${escAttr(val)}"${prov.api === val ? " selected" : ""}>${escHtml(label)}</option>`;
  }
  h += "</select>";
  h += `<div class="btn-row"><button class="btn-primary" data-action="prov-save-detail" data-id="${escAttr(provId)}"><span class="codicon codicon-save"></span> Save</button><button class="btn-icon btn-danger" data-action="prov-delete" data-id="${escAttr(provId)}" title="Delete"><span class="codicon codicon-trash"></span></button></div></div>`;

  const models = prov.models || [];
  h += `<div class="editor-card"><div class="section-header"><h3>Models</h3><button class="btn-primary" data-action="model-add" data-pid="${escAttr(provId)}"><span class="codicon codicon-add"></span> Add</button></div>`;
  h += '<div class="item-list">';
  if (!models.length) h += '<span class="dim">No models</span>';
  for (const m of models) {
    const mid = m.id ?? "";
    if (
      state.deleteModel &&
      state.deleteModel.provider === provId &&
      state.deleteModel.modelId === mid
    ) {
      h += `<div class="confirm-bar">Delete model "${escHtml(m.name || mid)}"? <span><button class="btn-sm btn-danger" data-action="model-delete-confirm" data-pid="${escAttr(provId)}" data-mid="${escAttr(mid)}">Delete</button> <button class="btn-icon" data-action="model-delete-cancel" title="Cancel"><span class="codicon codicon-close"></span></button></span></div>`;
      continue;
    }
    if (state.editModel && state.editModel.provider === provId && state.editModel.modelId === mid) {
      h += renderModelFields(provId, m, false);
      continue;
    }
    h += `<div class="item-row"><div class="item-main"><div class="item-title">`;
    h += `<span class="item-name">${escHtml(m.name || mid)}</span><span class="badge badge-stdio">${escHtml(mid)}</span></div>`;
    h += `<div class="item-desc">${modelMeta(m)}</div></div>`;
    h += `<div class="item-actions"><button class="btn-icon" data-action="model-edit" data-pid="${escAttr(provId)}" data-mid="${escAttr(mid)}" title="Edit"><span class="codicon codicon-edit"></span></button><button class="btn-icon btn-danger" data-action="model-delete" data-pid="${escAttr(provId)}" data-mid="${escAttr(mid)}" title="Delete"><span class="codicon codicon-trash"></span></button></div>`;
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
  if (m.reasoning) parts.push("reasoning");
  if (m.input?.includes("image")) parts.push("image");
  parts.push(`ctx:${m.contextWindow ?? "?"}`);
  const ci = m.cost?.input ?? 0;
  const co = m.cost?.output ?? 0;
  parts.push(`$${ci}/$${co}`);
  return parts.join(" · ");
}

function renderProvAddForm() {
  return `<div class="editor-card"><h3>Add Provider</h3>
    <label class="field-label">Name</label><input id="pf-name" placeholder="my-provider" />
    <label class="field-label">Base URL</label><input id="pf-baseUrl" placeholder="https://api.example.com/v1" />
    <label class="field-label">API Key</label><input id="pf-apiKey" type="password" placeholder="sk-... or $ENV_VAR" />
    <label class="field-label">API Protocol</label><select id="pf-api">${APIS.map(([v, l]) => `<option value="${escAttr(v)}">${escHtml(l)}</option>`).join("")}</select>
    <div class="btn-row"><button class="btn-primary" data-action="prov-save-new"><span class="codicon codicon-save"></span> Save</button><button class="btn-secondary" data-action="prov-cancel-edit" title="Cancel"><span class="codicon codicon-close"></span></button></div></div>`;
}

function renderModelFields(provId: string, existing: ModelEntry | null, isNew: boolean) {
  const e = existing;
  const costIn = e?.cost?.input != null ? e.cost.input : "";
  const costOut = e?.cost?.output != null ? e.cost.output : "";
  const costCacheRead = e?.cost?.cacheRead != null ? e.cost.cacheRead : "";
  const costCacheWrite = e?.cost?.cacheWrite != null ? e.cost.cacheWrite : "";
  const hasImage = !!e?.input?.includes("image");
  return `<div class="editor-card" style="border:1px solid var(--vscode-focusBorder);border-radius:4px;margin:4px 0"><h3>${isNew ? "Add Model" : "Edit Model"}</h3>
    <div class="form-row"><div class="form-group"><label class="field-label">Model ID</label><input id="mf-id" value="${escAttr(e?.id ?? "")}" placeholder="model-id" ${isNew ? "" : "readonly"} /></div>
    <div class="form-group"><label class="field-label">Display Name</label><input id="mf-name" value="${escAttr(e?.name ?? "")}" placeholder="Optional" /></div></div>
    <div class="form-row"><div class="form-group"><label class="field-label">Context Window</label><input id="mf-ctx" type="number" value="${e?.contextWindow ?? ""}" placeholder="200000" /></div>
    <div class="form-group"><label class="field-label">Max Tokens</label><input id="mf-maxTok" type="number" value="${e?.maxTokens ?? ""}" placeholder="16384" /></div></div>
    <h4 style="margin:6px 0 2px;font-size:11px;opacity:.7">Cost (per million tokens)</h4>
    <div class="form-row"><div class="form-group"><label class="field-label">Input</label><input id="mf-costIn" type="number" step="any" value="${costIn}" placeholder="0" /></div>
    <div class="form-group"><label class="field-label">Output</label><input id="mf-costOut" type="number" step="any" value="${costOut}" placeholder="0" /></div></div>
    <div class="form-row"><div class="form-group"><label class="field-label">Cache Read</label><input id="mf-costCacheRead" type="number" step="any" value="${costCacheRead}" placeholder="0" /></div>
    <div class="form-group"><label class="field-label">Cache Write</label><input id="mf-costCacheWrite" type="number" step="any" value="${costCacheWrite}" placeholder="0" /></div></div>
    <div class="form-row" style="gap:14px;margin:4px 0">
      <label class="check-label"><input type="checkbox" id="mf-reasoning" ${e?.reasoning ? "checked" : ""} /> Reasoning</label>
      <label class="check-label"><input type="checkbox" id="mf-image" ${hasImage ? "checked" : ""} /> Image input</label>
    </div>
    <div class="btn-row"><button class="btn-primary" data-action="model-save" data-pid="${escAttr(provId)}" data-new="${isNew ? "1" : "0"}"><span class="codicon codicon-save"></span> Save</button><button class="btn-secondary" data-action="model-cancel" title="Cancel"><span class="codicon codicon-close"></span></button></div></div>`;
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
    body.innerHTML = '<span class="dim">No OAuth providers available</span>';
    return;
  }
  let h = "";
  for (const p of items) {
    h += `<div class="item-row"><div class="item-main"><div class="item-title"><span class="status-dot ${p.connected ? "on" : "off"}"></span><span class="item-name">${escHtml(p.name)}</span><span class="badge ${p.connected ? "badge-cli" : "badge-other"}">${p.connected ? "connected" : "not connected"}</span></div><div class="item-desc">${escHtml(p.id)}</div></div>`;
    h += `<div class="item-actions">`;
    if (p.connected)
      h += `<button class="btn-icon" data-action="oauth-logout" data-id="${escAttr(p.id)}" title="Logout"><span class="codicon codicon-sign-out"></span></button>`;
    else
      h += `<button class="btn-icon" data-action="oauth-login" data-id="${escAttr(p.id)}" title="Login"><span class="codicon codicon-sign-in"></span></button>`;
    h += "</div></div>";
  }
  body.innerHTML = h;
}

function renderOAuthProgress(s: OAuthProgressEvent): string {
  let h = '<div class="editor-card oauth-progress">';
  if (s.type === "auth_url") {
    h += `<strong>Authorize</strong>`;
    h += `<div class="url"><a href="${escAttr(s.url ?? "")}" target="_blank">${escHtml(s.url ?? "")}</a></div>`;
    if (s.instructions) h += `<p class="dim">${escHtml(s.instructions)}</p>`;
    h += `<label class="field-label">Or paste authorization code:</label><input id="oauth-code" placeholder="Authorization code" />`;
    h += `<div class="btn-row"><button class="btn-primary" data-action="oauth-submit-code"><span class="codicon codicon-check"></span> Submit</button><button class="btn-secondary" data-action="oauth-cancel" title="Cancel"><span class="codicon codicon-close"></span></button></div>`;
  } else if (s.type === "device_code") {
    h += "<strong>Device Code</strong>";
    h += `<p style="font-size:16px;font-weight:bold;letter-spacing:2px">${escHtml(s.userCode ?? "")}</p>`;
    if (s.verificationUri)
      h += `<p><a href="${escAttr(s.verificationUri)}" target="_blank">${escHtml(s.verificationUri)}</a></p>`;
    h += `<div class="btn-row"><button class="btn-secondary" data-action="oauth-cancel" title="Cancel"><span class="codicon codicon-close"></span></button></div>`;
  } else if (s.type === "prompt") {
    h += `<strong>${escHtml(s.message || "Input required")}</strong>`;
    h += `<div><input id="oauth-input" placeholder="${escAttr(s.placeholder ?? "")}" /></div>`;
    h += `<div class="btn-row"><button class="btn-primary" data-action="oauth-submit-input" data-token="${escAttr(s.token ?? "")}"><span class="codicon codicon-check"></span> Submit</button><button class="btn-secondary" data-action="oauth-cancel" title="Cancel"><span class="codicon codicon-close"></span></button></div>`;
  } else if (s.type === "select") {
    h += `<strong>${escHtml(s.message || "Select")}</strong>`;
    for (const o of s.options ?? []) {
      h += `<div class="btn-row"><button class="btn-primary" data-action="oauth-submit-select" data-token="${escAttr(s.token ?? "")}" data-id="${escAttr(o.id)}">${escHtml(o.label)}</button></div>`;
    }
    h += `<div class="btn-row"><button class="btn-secondary" data-action="oauth-cancel" title="Cancel"><span class="codicon codicon-close"></span></button></div>`;
  } else if (s.type === "progress") {
    h += `<p>${escHtml(s.message || "Working...")}</p>`;
  } else if (s.type === "success") {
    h += '<p style="color:#4caf50">✓ Connected successfully!</p>';
    h += `<div class="btn-row"><button class="btn-secondary" data-action="oauth-dismiss" title="Dismiss"><span class="codicon codicon-close"></span></button></div>`;
  } else if (s.type === "error") {
    h += `<p style="color:#d32f2f">Error: ${escHtml(s.message ?? "")}</p>`;
    h += `<div class="btn-row"><button class="btn-secondary" data-action="oauth-dismiss" title="Dismiss"><span class="codicon codicon-close"></span></button></div>`;
  } else if (s.type === "cancelled") {
    h += "<p>Login cancelled.</p>";
    h += `<div class="btn-row"><button class="btn-secondary" data-action="oauth-dismiss" title="Dismiss"><span class="codicon codicon-close"></span></button></div>`;
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
    body.innerHTML = '<span class="dim">No API key providers found</span>';
    return;
  }
  const state = provState;
  let h = "";
  for (const p of items) {
    if (state.apiKeyDeleteTarget === p.id) {
      h += `<div class="confirm-bar">Remove API key for "${escHtml(p.name)}"? <span><button class="btn-sm btn-danger" data-action="apikey-remove-confirm" data-id="${escAttr(p.id)}">Remove</button> <button class="btn-icon" data-action="apikey-remove-cancel" title="Cancel"><span class="codicon codicon-close"></span></button></span></div>`;
      continue;
    }
    h += `<div class="item-row"><div class="item-main"><div class="item-title"><span class="status-dot ${p.configured ? "on" : "off"}"></span><span class="item-name">${escHtml(p.name)}</span><span class="badge ${p.configured ? "badge-cli" : "badge-other"}">${p.configured ? "configured" : "not set"}</span></div><div class="item-desc">${p.modelCount} models</div></div>`;
    h += `<div class="item-actions">`;
    if (p.configured)
      h += `<button class="btn-icon btn-danger" data-action="apikey-remove" data-id="${escAttr(p.id)}" title="Remove API key"><span class="codicon codicon-trash"></span></button>`;
    else
      h += `<button class="btn-icon" data-action="apikey-set" data-id="${escAttr(p.id)}" title="Set API key"><span class="codicon codicon-key"></span></button>`;
    h += "</div></div>";
    if (state.apiKeyEditing === p.id) {
      h += `<div class="editor-card"><label class="field-label">API Key for ${escHtml(p.name)}</label><input id="apikey-input" type="password" placeholder="sk-..." />`;
      h += `<div class="btn-row"><button class="btn-primary" data-action="apikey-save" data-id="${escAttr(p.id)}"><span class="codicon codicon-save"></span> Save</button><button class="btn-secondary" data-action="apikey-cancel" title="Cancel"><span class="codicon codicon-close"></span></button></div></div>`;
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
    showErr(parent, "Provider name is required");
    return;
  }
  const entry: Record<string, string> = {};
  const baseUrl = (document.getElementById("pf-baseUrl") as HTMLInputElement)?.value.trim() ?? "";
  if (baseUrl) entry.baseUrl = baseUrl;
  const apiKey = (document.getElementById("pf-apiKey") as HTMLInputElement)?.value.trim() ?? "";
  if (apiKey) entry.apiKey = apiKey;
  const api = (document.getElementById("pf-api") as HTMLSelectElement)?.value ?? "";
  if (api) entry.api = api;
  vscode.postMessage({ type: "addProvider", name, entry });
  provState.editNew = false;
}

function saveProvDetail(parent: HTMLElement, _data: ModelsData, provId: string) {
  const newName = (document.getElementById("pd-name") as HTMLInputElement)?.value.trim() ?? "";
  if (!newName) {
    showErr(parent, "Provider name is required");
    return;
  }
  const u: Record<string, string | null> = {};
  u.baseUrl = (document.getElementById("pd-baseUrl") as HTMLInputElement)?.value.trim() || null;
  u.apiKey = (document.getElementById("pd-apiKey") as HTMLInputElement)?.value.trim() || null;
  u.api = (document.getElementById("pd-api") as HTMLSelectElement)?.value || null;
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
    showErr(parent, "Model ID is required");
    return;
  }
  const m: Record<string, unknown> = { id };
  const name = (document.getElementById("mf-name") as HTMLInputElement)?.value.trim() ?? "";
  if (name) m.name = name;
  const ctx = parseInt((document.getElementById("mf-ctx") as HTMLInputElement)?.value ?? "");
  if (ctx > 0) m.contextWindow = ctx;
  const maxTok = parseInt((document.getElementById("mf-maxTok") as HTMLInputElement)?.value ?? "");
  if (maxTok > 0) m.maxTokens = maxTok;
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
  const anyCost =
    !isNaN(costIn) || !isNaN(costOut) || !isNaN(costCacheRead) || !isNaN(costCacheWrite);
  if (anyCost) {
    m.cost = {
      input: isNaN(costIn) ? 0 : costIn,
      output: isNaN(costOut) ? 0 : costOut,
      cacheRead: isNaN(costCacheRead) ? 0 : costCacheRead,
      cacheWrite: isNaN(costCacheWrite) ? 0 : costCacheWrite,
    };
  }
  m.reasoning = (document.getElementById("mf-reasoning") as HTMLInputElement)?.checked ?? false;
  const image = (document.getElementById("mf-image") as HTMLInputElement)?.checked ?? false;
  m.input = image ? ["text", "image"] : null;
  if (isNew) {
    if (m.input === null) delete m.input;
    vscode.postMessage({ type: "addModel", providerName: provId, model: m });
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
    showErr(parent, "API key is required");
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
