import { vscode } from "../globals";
import { t } from "../i18n";

interface PromptItem {
  name: string;
  description: string;
  argumentHint: string | null;
  content: string;
  filePath: string;
  scope: string;
  origin: string;
  source: string;
  editable: boolean;
  sourceLabel: string;
}

interface PromptData {
  prompts: PromptItem[];
  hasWorkspace: boolean;
}

export function renderPromptsTab(parent: HTMLElement, data: PromptData) {
  const prompts = data.prompts || [];
  const hasWorkspace = data.hasWorkspace;
  let editing: PromptItem | undefined;

  function renderList() {
    const rows = prompts
      .map(
        (p) => /* html */ `
    <div class="item-row" data-name="${escHtml(p.name)}">
      <div class="item-main">
        <div class="item-title">
          <span class="item-name">${escHtml(p.name)}</span>
          <span class="badge ${badgeClass(p.sourceLabel)}">${t(p.sourceLabel)}</span>
          ${p.argumentHint ? `<span class="badge badge-stdio">${escHtml(p.argumentHint)}</span>` : ""}
        </div>
        <div class="item-desc">${escHtml(p.description || "")}</div>
      </div>
      <div class="item-actions">
        ${p.editable ? `<button class="btn-icon" data-action="edit-prompt" data-name="${escHtml(p.name)}" title="${t("Edit")}"><span class="codicon codicon-edit"></span></button>` : ""}
        <button class="btn-icon" data-action="open-prompt" data-name="${escHtml(p.name)}" title="${t("Open file")}"><span class="codicon codicon-go-to-file"></span></button>
        ${p.editable ? `<button class="btn-icon btn-danger" data-action="delete-prompt" data-name="${escHtml(p.name)}" title="${t("Delete")}"><span class="codicon codicon-trash"></span></button>` : ""}
      </div>
    </div>`,
      )
      .join("");

    parent.innerHTML = /* html */ `
<div class="tab-section">
  <div class="section-header">
    <h3>${t("Prompt Templates")}</h3>
    <button class="btn-primary" data-action="add-prompt"><span class="codicon codicon-add"></span> ${t("New Prompt")}</button>
  </div>
  <div class="hint">${t("Prompts are slash-command templates loaded by pi. Editable prompts live in <code>~/.pi/agent/prompts</code>{0}.", hasWorkspace ? t(" or <code>.pi/prompts</code>") : "")}</div>
  <div class="item-list">${rows || `<span class="dim">${t("No prompts found.")}</span>`}</div>
</div>`;
  }

  function showEditor(prompt?: PromptItem, scope: string = "user") {
    editing = prompt;
    const p = prompt;
    parent.innerHTML = /* html */ `
<div class="editor-card">
  <h3>${p ? t("Edit: {0}", escHtml(p.name)) : t("New Prompt")}</h3>
  ${
    p
      ? ""
      : `
  <label class="field-label">${t("Scope")}</label>
  <select id="pt-scope">
    <option value="user" selected>${t("user")}</option>
    ${hasWorkspace ? `<option value="project">${t("project")}</option>` : ""}
  </select>`
  }
  <label class="field-label">${t("Name")}</label>
  <input id="pt-name" value="${escHtml(p?.name ?? "")}" placeholder="my-prompt" ${p ? "disabled" : ""} />
  <label class="field-label">${t("Description")}</label>
  <input id="pt-desc" value="${escHtml(p?.description ?? "")}" placeholder="${t("What this prompt does")}" />
  <label class="field-label">${t("Argument hint")}</label>
  <input id="pt-arg" value="${escHtml(p?.argumentHint ?? "")}" placeholder="[question]" />
  <label class="field-label">${t("Content (template)")}</label>
  <textarea id="pt-content" class="ta" style="height:220px">${escHtml(p?.content ?? "")}</textarea>
  <div class="btn-row">
    <button class="btn-primary" data-action="save-prompt"><span class="codicon codicon-save"></span> ${t("Save")}</button>
    <button class="btn-secondary" data-action="cancel-prompt" title="${t("Cancel")}"><span class="codicon codicon-close"></span></button>
  </div>
</div>`;
    if (p === undefined) {
      const sel = document.getElementById("pt-scope") as HTMLSelectElement;
      if (sel) sel.value = scope;
    }
  }

  parent.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const name = btn.getAttribute("data-name");
    const prompt = prompts.find((x) => x.name === name);

    switch (action) {
      case "add-prompt":
        showEditor();
        break;
      case "edit-prompt":
        if (prompt) showEditor(prompt, prompt.scope);
        break;
      case "delete-prompt":
        if (prompt)
          vscode.postMessage({ type: "deletePrompt", name: prompt.name, scope: prompt.scope });
        break;
      case "open-prompt":
        if (prompt) vscode.postMessage({ type: "openPromptFile", filePath: prompt.filePath });
        break;
      case "save-prompt": {
        const form = {
          name: (document.getElementById("pt-name") as HTMLInputElement)?.value.trim() ?? "",
          description: (document.getElementById("pt-desc") as HTMLInputElement)?.value ?? "",
          argumentHint: (document.getElementById("pt-arg") as HTMLInputElement)?.value ?? "",
          content: (document.getElementById("pt-content") as HTMLTextAreaElement)?.value ?? "",
        };
        if (!form.name) {
          showError(parent, t("Prompt name is required"));
          return;
        }
        if (editing) {
          vscode.postMessage({ type: "updatePrompt", scope: editing.scope, data: form });
        } else {
          const scope = (document.getElementById("pt-scope") as HTMLSelectElement)?.value ?? "user";
          vscode.postMessage({ type: "createPrompt", scope, data: form });
        }
        break;
      }
      case "cancel-prompt":
        editing = undefined;
        renderList();
        break;
    }
  });
  renderList();
}

function badgeClass(label: string): string {
  switch (label) {
    case "user":
      return "badge-user";
    case "project":
      return "badge-project";
    case "builtin":
      return "badge-builtin";
    case "package":
      return "badge-package";
    case "cli":
      return "badge-cli";
    default:
      return "badge-other";
  }
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
