import { vscode } from "../globals";
import { t } from "../i18n";

interface AgentItem {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  systemPrompt: string;
  disableModelInvocation: boolean;
  isBuiltin: boolean;
  hasOverride: boolean;
  source: string;
  filePath: string;
}

interface AgentData {
  agents: AgentItem[];
  hasWorkspace: boolean;
  models: string[];
}

export function renderAgentsTab(parent: HTMLElement, data: AgentData) {
  const agents = data.agents || [];
  const hasWorkspace = data.hasWorkspace;
  const models = data.models || [];

  function scopeFor(agent: AgentItem): string {
    if (agent.source === "project") return "project";
    return "user";
  }

  let editing: AgentItem | undefined;

  function renderList() {
    const rows = agents
      .map(
        (a) => /* html */ `
    <div class="item-row" data-name="${escHtml(a.name)}">
      <div class="item-main">
        <div class="item-title">
          <span class="item-name">${escHtml(a.name)}</span>
          <span class="badge ${badgeClass(a.source, a.hasOverride)}">${a.source === "builtin" && a.hasOverride ? t("builtin+override") : t(a.source)}</span>
          ${a.model ? `<span class="badge badge-package">${escHtml(a.model)}</span>` : ""}
        </div>
        <div class="item-desc">${escHtml(a.description || "")}</div>
      </div>
      <div class="item-actions">
        <button class="btn-icon" data-action="edit-agent" data-name="${escHtml(a.name)}" title="${t("Edit")}"><span class="codicon codicon-edit"></span></button>
        <button class="btn-icon" data-action="open-agent" data-name="${escHtml(a.name)}" title="${t("Open file")}"><span class="codicon codicon-go-to-file"></span></button>
        ${a.isBuiltin && a.hasOverride ? `<button class="btn-icon" data-action="reset-agent" data-name="${escHtml(a.name)}" title="${t("Reset to builtin")}"><span class="codicon codicon-discard"></span></button>` : ""}
        ${!a.isBuiltin ? `<button class="btn-icon btn-danger" data-action="delete-agent" data-name="${escHtml(a.name)}" title="${t("Delete")}"><span class="codicon codicon-trash"></span></button>` : ""}
      </div>
    </div>`,
      )
      .join("");

    parent.innerHTML = /* html */ `
<div class="tab-section">
  <div class="section-header">
    <h3>${t("Agents")}</h3>
    <button class="btn-primary" data-action="add-agent"><span class="codicon codicon-add"></span> ${t("New Agent")}</button>
  </div>
  <div class="hint">${t("Agents are markdown files loaded by pi. User agents live in <code>~/.pi/agent/agents</code>{0}.", hasWorkspace ? t(", project agents in <code>.pi/agents</code>") : "")}</div>
  <div class="item-list">${rows || `<span class="dim">${t("No agents found.")}</span>`}</div>
</div>`;
  }

  function modelOptions(selected?: string): string {
    let found = false;
    const opts = models.map((m) => {
      const sel = m === selected;
      if (sel) found = true;
      return `<option value="${escHtml(m)}" ${sel ? "selected" : ""}>${escHtml(m)}</option>`;
    });
    let extra = "";
    if (selected && !found) {
      extra = `<option value="${escHtml(selected)}" selected>${escHtml(selected)}</option>`;
    }
    return `<option value="">${t("(default)")}</option>${opts.join("")}${extra}`;
  }

  function showEditor(agent?: AgentItem, scope: string = "user") {
    editing = agent;
    const a = agent;
    parent.innerHTML = /* html */ `
<div class="editor-card">
  <h3>${a ? t("Edit: {0}", escHtml(a.name)) : t("New Agent")}</h3>
  ${
    a
      ? ""
      : `
  <label class="field-label">${t("Scope")}</label>
  <select id="ag-scope">
    <option value="user" selected>user</option>
    ${hasWorkspace ? '<option value="project">project</option>' : ""}
  </select>`
  }
  <label class="field-label">${t("Name")}</label>
  <input id="ag-name" value="${escHtml(a?.name ?? "")}" placeholder="my-agent" ${a ? "disabled" : ""} />
  <label class="field-label">${t("Description")}</label>
  <input id="ag-desc" value="${escHtml(a?.description ?? "")}" placeholder="${t("What this agent does")}" />
  <label class="field-label">${t("Model")}</label>
  <select id="ag-model">${modelOptions(a?.model)}</select>
  <label class="field-label">${t("System prompt")}</label>
  <textarea id="ag-prompt" class="ta" style="height:180px" placeholder="${t("You are a helpful assistant…")}">${escHtml(a?.systemPrompt ?? "")}</textarea>
  <label class="field-label">${t("Tools (one per line)")}</label>
  <textarea id="ag-tools" class="ta" style="height:60px" placeholder="bash&#10;read">${escHtml((a?.tools ?? []).join("\n"))}</textarea>
  <label class="check-label"><input type="checkbox" id="ag-dmi" ${a?.disableModelInvocation ? "checked" : ""} /> ${t("Disable model invocation")}</label>
  <div class="btn-row">
    <button class="btn-primary" data-action="save-agent"><span class="codicon codicon-save"></span> ${t("Save")}</button>
    <button class="btn-secondary" data-action="cancel-agent" title="${t("Cancel")}"><span class="codicon codicon-close"></span></button>
  </div>
</div>`;
    if (a === undefined) {
      const sel = document.getElementById("ag-scope") as HTMLSelectElement;
      if (sel) sel.value = scope;
    }
  }

  parent.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const name = btn.getAttribute("data-name");
    const agent = agents.find((x) => x.name === name);

    switch (action) {
      case "add-agent":
        showEditor();
        break;
      case "edit-agent":
        if (agent) showEditor(agent, scopeFor(agent));
        break;
      case "delete-agent":
        if (agent)
          vscode.postMessage({ type: "deleteAgent", name: agent.name, scope: scopeFor(agent) });
        break;
      case "reset-agent":
        if (agent)
          vscode.postMessage({ type: "resetBuiltin", name: agent.name, scope: scopeFor(agent) });
        break;
      case "open-agent":
        if (agent) vscode.postMessage({ type: "openAgentFile", filePath: agent.filePath });
        break;
      case "save-agent": {
        const form = {
          name: (document.getElementById("ag-name") as HTMLInputElement)?.value.trim() ?? "",
          description: (document.getElementById("ag-desc") as HTMLInputElement)?.value ?? "",
          model: (document.getElementById("ag-model") as HTMLSelectElement)?.value || undefined,
          systemPrompt: (document.getElementById("ag-prompt") as HTMLTextAreaElement)?.value ?? "",
          tools: ((document.getElementById("ag-tools") as HTMLTextAreaElement)?.value ?? "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          disableModelInvocation:
            (document.getElementById("ag-dmi") as HTMLInputElement)?.checked ?? false,
        };
        if (!form.name) {
          showError(parent, t("Agent name is required"));
          return;
        }
        if (editing) {
          vscode.postMessage({ type: "updateAgent", scope: scopeFor(editing), data: form });
        } else {
          const scope = (document.getElementById("ag-scope") as HTMLSelectElement)?.value ?? "user";
          vscode.postMessage({ type: "createAgent", scope, data: form });
        }
        break;
      }
      case "cancel-agent":
        editing = undefined;
        renderList();
        break;
    }
  });
  renderList();
}

function badgeClass(source: string, hasOverride?: boolean): string {
  if (source === "user") return "badge-user";
  if (source === "project") return "badge-project";
  if (source === "builtin") return hasOverride ? "badge-cli" : "badge-builtin";
  return "badge-other";
}

function showError(parent: HTMLElement, msg: string) {
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
