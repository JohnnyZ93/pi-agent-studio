import { vscode } from "../globals";
import { t } from "../i18n";

interface SkillItem {
  name: string;
  description: string;
  disableModelInvocation: boolean;
  body: string;
  filePath: string;
  baseDir: string;
  scope: string;
  sourceLabel: string;
  editable: boolean;
}

interface SkillData {
  skills: SkillItem[];
  hasWorkspace: boolean;
}

export function renderSkillsTab(parent: HTMLElement, data: SkillData) {
  const skills = data.skills || [];
  const hasWorkspace = data.hasWorkspace;
  let editing: SkillItem | undefined;

  function renderList() {
    const rows = skills
      .map(
        (sk) => /* html */ `
    <div class="item-row" data-name="${escHtml(sk.name)}">
      <div class="item-main">
        <div class="item-title">
          <span class="item-name">${escHtml(sk.name)}</span>
          <span class="badge ${badgeClass(sk.sourceLabel)}">${t(sk.sourceLabel)}</span>
          ${sk.disableModelInvocation ? `<span class="badge badge-http" title="${t("disable-model-invocation: hidden from system prompt")}">${t("hidden")}</span>` : ""}
        </div>
        <div class="item-desc">${escHtml(sk.description || "")}</div>
      </div>
      <div class="item-actions">
        ${sk.editable ? `<button class="btn-icon" data-action="edit-skill" data-name="${escHtml(sk.name)}" title="${t("Edit")}"><span class="codicon codicon-edit"></span></button>` : ""}
        <button class="btn-icon" data-action="open-skill" data-name="${escHtml(sk.name)}" title="${t("Open file")}"><span class="codicon codicon-go-to-file"></span></button>
        ${sk.editable ? `<button class="btn-icon btn-danger" data-action="delete-skill" data-name="${escHtml(sk.name)}" title="${t("Delete")}"><span class="codicon codicon-trash"></span></button>` : ""}
      </div>
    </div>`,
      )
      .join("");

    parent.innerHTML = /* html */ `
<div class="tab-section">
  <div class="section-header">
    <h3>${t("Skills")}</h3>
    <button class="btn-primary" data-action="add-skill"><span class="codicon codicon-add"></span> ${t("New Skill")}</button>
  </div>
  <div class="hint">${t("Skills are markdown files loaded by pi. User skills live in <code>~/.pi/agent/skills</code> or <code>~/.agents/skills</code>{0}.", hasWorkspace ? t(", project skills in <code>.pi/skills</code> or <code>.agents/skills</code>") : "")}</div>
  <div class="item-list">${rows || `<span class="dim">${t("No skills found.")}</span>`}</div>
</div>`;
  }

  function showEditor(skill?: SkillItem, scope: string = "user") {
    editing = skill;
    const s = skill;
    parent.innerHTML = /* html */ `
<div class="editor-card">
  <h3>${s ? t("Edit: {0}", escHtml(s.name)) : t("New Skill")}</h3>
  ${
    s
      ? ""
      : `
  <label class="field-label">${t("Scope")}</label>
  <select id="sk-scope">
    <option value="user" selected>${t("user")}</option>
    ${hasWorkspace ? `<option value="project">${t("project")}</option>` : ""}
  </select>`
  }
  <label class="field-label">${t("Name")}</label>
  <input id="sk-name" value="${escHtml(s?.name ?? "")}" placeholder="my-skill" ${s ? "disabled" : ""} />
  <label class="field-label">${t("Description")}</label>
  <input id="sk-desc" value="${escHtml(s?.description ?? "")}" placeholder="${t("What this skill does")}" />
  <label class="field-label">${t("Body (markdown)")}</label>
  <textarea id="sk-body" class="ta" style="height:200px">${escHtml(s?.body ?? "")}</textarea>
  <label class="check-label"><input type="checkbox" id="sk-dmi" ${s?.disableModelInvocation ? "checked" : ""} /> ${t("Disable model invocation")}</label>
  <div class="btn-row">
    <button class="btn-primary" data-action="save-skill"><span class="codicon codicon-save"></span> ${t("Save")}</button>
    <button class="btn-secondary" data-action="cancel-skill" title="${t("Cancel")}"><span class="codicon codicon-close"></span></button>
  </div>
</div>`;
    if (scope && s === undefined) {
      const sel = document.getElementById("sk-scope") as HTMLSelectElement;
      if (sel) sel.value = scope;
    }
  }

  parent.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const name = btn.getAttribute("data-name");
    const skill = skills.find((x) => x.name === name);

    switch (action) {
      case "add-skill":
        showEditor();
        break;
      case "edit-skill":
        if (skill) showEditor(skill, skill.sourceLabel);
        break;
      case "delete-skill":
        if (skill) vscode.postMessage({ type: "deleteSkill", baseDir: skill.baseDir });
        break;
      case "open-skill":
        if (skill) vscode.postMessage({ type: "openSkillFile", filePath: skill.filePath });
        break;
      case "save-skill": {
        const form = {
          name: (document.getElementById("sk-name") as HTMLInputElement)?.value.trim() ?? "",
          description: (document.getElementById("sk-desc") as HTMLInputElement)?.value ?? "",
          body: (document.getElementById("sk-body") as HTMLTextAreaElement)?.value ?? "",
          disableModelInvocation:
            (document.getElementById("sk-dmi") as HTMLInputElement)?.checked ?? false,
        };
        if (!form.name) {
          showError(parent, t("Skill name is required"));
          return;
        }
        if (editing) {
          vscode.postMessage({ type: "updateSkill", filePath: editing.filePath, data: form });
        } else {
          const scope = (document.getElementById("sk-scope") as HTMLSelectElement)?.value ?? "user";
          vscode.postMessage({ type: "createSkill", scope, data: form });
        }
        break;
      }
      case "cancel-skill":
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
