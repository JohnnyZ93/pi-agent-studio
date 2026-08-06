import { vscode } from "../globals";
import { t } from "../i18n";

interface SysPromptData {
  systemPrompt: { content: string };
  appendSystemPrompt: { content: string };
}

export function renderSysPromptTab(parent: HTMLElement, data: SysPromptData) {
  let originalSystem = data.systemPrompt.content;
  let originalAppend = data.appendSystemPrompt.content;

  parent.innerHTML = /* html */ `
<div class="tab-section">
  <h3>${t("System Prompt — Append")}</h3>
  <p class="hint">${t("Appends to the default system prompt without replacing.")}</p>
  <p class="hint">${t("File:")} <code>~/.pi/agent/APPEND_SYSTEM.md</code></p>
  <textarea id="txt-append" class="ta" placeholder="${t("(empty — nothing appended)")}">${escHtml(data.appendSystemPrompt.content)}</textarea>
  <div class="btn-row">
    <button class="btn-primary" id="btn-save-append" data-action="saveAppend"><span class="codicon codicon-save"></span> ${t("Save")}</button>
    <button class="btn-secondary" data-action="resetAppend" title="${t("Reset")}"><span class="codicon codicon-discard"></span></button>
    <button class="btn-secondary" data-action="openAppend" title="${t("Open file")}"><span class="codicon codicon-go-to-file"></span> ${t("Open file")}</button>
  </div>
</div>
<div class="tab-section">
  <h3>${t("System Prompt — Override")}</h3>
  <div class="msg-warn">${t("⚠ <strong>Warning:</strong> This <strong>replaces</strong> Pi's built-in system prompt entirely and may significantly change Pi's behavior, tool usage, and safety guardrails. Prefer the Append section above unless you know what you're doing.")}</div>
  <p class="hint">${t("File:")} <code>~/.pi/agent/SYSTEM.md</code></p>
  <textarea id="txt-system" class="ta" placeholder="${t("(empty — using default system prompt)")}">${escHtml(data.systemPrompt.content)}</textarea>
  <div class="btn-row">
    <button class="btn-primary" id="btn-save-system" data-action="saveSystem"><span class="codicon codicon-save"></span> ${t("Save")}</button>
    <button class="btn-secondary" data-action="resetSystem" title="${t("Reset")}"><span class="codicon codicon-discard"></span></button>
    <button class="btn-secondary" data-action="openSystem" title="${t("Open file")}"><span class="codicon codicon-go-to-file"></span> ${t("Open file")}</button>
  </div>
</div>`;

  const taAppend = document.getElementById("txt-append") as HTMLTextAreaElement;
  const taSystem = document.getElementById("txt-system") as HTMLTextAreaElement;

  function updateDirty() {
    const aDirty = taAppend.value !== originalAppend;
    const sDirty = taSystem.value !== originalSystem;
    const abtn = document.getElementById("btn-save-append");
    const sbtn = document.getElementById("btn-save-system");
    if (abtn) abtn.classList.toggle("modified", aDirty);
    if (sbtn) sbtn.classList.toggle("modified", sDirty);
  }

  parent.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    if (t.id === "txt-append" || t.id === "txt-system") updateDirty();
  });

  parent.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    switch (action) {
      case "saveAppend":
        vscode.postMessage({ type: "saveAppendSystemPrompt", content: taAppend.value });
        break;
      case "saveSystem":
        vscode.postMessage({ type: "saveSystemPrompt", content: taSystem.value });
        break;
      case "resetAppend":
        taAppend.value = originalAppend;
        updateDirty();
        break;
      case "resetSystem":
        taSystem.value = originalSystem;
        updateDirty();
        break;
      case "openAppend":
        vscode.postMessage({ type: "openAppendSystemPromptFile" });
        break;
      case "openSystem":
        vscode.postMessage({ type: "openSystemPromptFile" });
        break;
    }
  });
}

function escHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
