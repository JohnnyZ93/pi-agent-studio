import { vscode } from "../globals";
import { t } from "../i18n";

interface CommitData {
  commitModel: string;
  commitLanguage: string;
  commitMessagePrompt: string;
  languages: string[];
  models: string[];
}

export function renderCommitTab(parent: HTMLElement, data: CommitData) {
  const languages = data.languages || [];
  const models = data.models || [];

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

  parent.innerHTML = /* html */ `
<div class="tab-section">
  <div class="section-header">
    <h3>${t("Commit Message")}</h3>
  </div>
  <div class="hint">${t("Settings are stored in VS Code configuration")} (<code>pi-agent-studio.commitModel</code>, <code>pi-agent-studio.commitLanguage</code>, <code>pi-agent-studio.commitMessagePrompt</code>).</div>
  <div class="editor-card">
    <label class="field-label">${t("Model")}</label>
    <select id="cm-model">${modelOptions(data.commitModel)}</select>
    <div class="hint">${t('Model used to generate Git commit messages, in "provider/model" format. Leave as (default) to use pi\'s default model.')}</div>
    <label class="field-label">${t("Language")}</label>
    <select id="cm-language">
      ${languages.map((l) => `<option value="${escHtml(l)}" ${l === data.commitLanguage ? "selected" : ""}>${escHtml(l)}</option>`).join("")}
    </select>
    <div class="hint">${t("Language for generated Git commit messages.")}</div>
    <label class="field-label">${t("Custom prompt")}</label>
    <textarea id="cm-prompt" class="ta" style="height:140px" placeholder="${t("Custom system prompt for commit message generation. If empty, uses the default prompt.")}">${escHtml(data.commitMessagePrompt ?? "")}</textarea>
    <div class="btn-row">
      <button class="btn-primary" data-action="save-commit"><span class="codicon codicon-save"></span> ${t("Save")}</button>
    </div>
  </div>
</div>`;

  parent.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!btn) return;
    if (btn.getAttribute("data-action") === "save-commit") {
      vscode.postMessage({
        type: "saveCommitConfig",
        commitModel: (document.getElementById("cm-model") as HTMLSelectElement)?.value ?? "",
        commitLanguage:
          (document.getElementById("cm-language") as HTMLSelectElement)?.value ?? "English",
        commitMessagePrompt:
          (document.getElementById("cm-prompt") as HTMLTextAreaElement)?.value ?? "",
      });
    }
  });
}

function escHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
