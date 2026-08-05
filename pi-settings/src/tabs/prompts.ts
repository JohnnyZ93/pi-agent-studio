import { vscode } from "../globals";

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

  function renderList() {
    const rows = prompts
      .map(
        (p) => /* html */ `
    <div class="item-row" data-name="${escHtml(p.name)}">
      <div class="item-main">
        <span class="item-name">${escHtml(p.name)}</span>
        <span class="badge">${escHtml(p.sourceLabel)}</span>
        ${p.argumentHint ? `<code class="dim">${escHtml(p.argumentHint)}</code>` : ""}
        <span class="dim">${escHtml(p.description || "")}</span>
      </div>
      <div class="item-actions">
        ${p.editable ? `<button class="btn-sm" data-action="edit-prompt" data-name="${escHtml(p.name)}">Edit</button>` : ""}
        <button class="btn-sm" data-action="open-prompt" data-name="${escHtml(p.name)}">Open</button>
        ${p.editable ? `<button class="btn-sm btn-danger" data-action="delete-prompt" data-name="${escHtml(p.name)}">Delete</button>` : ""}
      </div>
    </div>`,
      )
      .join("");

    parent.innerHTML = /* html */ `
<div class="tab-section">
  <div class="section-header">
    <h3>Prompt Templates</h3>
    <button class="btn-primary" data-action="add-prompt">New Prompt</button>
  </div>
  <div class="item-list">${rows || '<span class="dim">No prompts found.</span>'}</div>
  <div class="hint">Prompts are slash-command templates loaded by pi. Editable prompts live in <code>~/.pi/agent/prompts</code>${hasWorkspace ? " or <code>.pi/prompts</code>" : ""}.</div>
</div>`;
  }

  function showEditor(prompt?: PromptItem, scope: string = "user") {
    const p = prompt;
    parent.innerHTML = /* html */ `
<div class="editor-card">
  <h3>${p ? `Edit: ${escHtml(p.name)}` : "New Prompt"}</h3>
  ${
    p
      ? ""
      : `
  <label class="field-label">Scope</label>
  <select id="pt-scope">
    <option value="user" selected>user</option>
    ${hasWorkspace ? '<option value="project">project</option>' : ""}
  </select>`
  }
  <label class="field-label">Name</label>
  <input id="pt-name" value="${escHtml(p?.name ?? "")}" placeholder="my-prompt" ${p ? "disabled" : ""} />
  <label class="field-label">Description</label>
  <input id="pt-desc" value="${escHtml(p?.description ?? "")}" placeholder="What this prompt does" />
  <label class="field-label">Argument hint</label>
  <input id="pt-arg" value="${escHtml(p?.argumentHint ?? "")}" placeholder="[question]" />
  <label class="field-label">Content (template)</label>
  <textarea id="pt-content" class="ta" style="height:220px">${escHtml(p?.content ?? "")}</textarea>
  <div class="btn-row">
    <button class="btn-primary" data-action="save-prompt">Save</button>
    <button class="btn-secondary" data-action="cancel-prompt">Cancel</button>
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
          showError(parent, "Prompt name is required");
          return;
        }
        if (prompt) {
          vscode.postMessage({ type: "updatePrompt", scope: prompt.scope, data: form });
        } else {
          const scope = (document.getElementById("pt-scope") as HTMLSelectElement)?.value ?? "user";
          vscode.postMessage({ type: "createPrompt", scope, data: form });
        }
        break;
      }
      case "cancel-prompt":
        renderList();
        break;
    }
  });
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
