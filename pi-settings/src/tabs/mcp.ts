import { vscode } from "../globals";

interface ServerData {
  servers: Array<{
    name: string;
    entry: {
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
      url?: string;
      headers?: Record<string, string>;
      bearerToken?: string;
      disabled?: boolean;
      directTools?: string[] | boolean;
    };
    source: "user" | "project";
  }>;
  hasWorkspace: boolean;
}

interface McpForm {
  name: string;
  command?: string;
  url?: string;
  args?: string;
  env?: string;
  cwd?: string;
  headers?: string;
  bearerToken?: string;
  disabled?: boolean;
  directTools?: string;
  directToolsAll?: boolean;
}

export function renderMcpTab(parent: HTMLElement, data: ServerData) {
  const servers = data.servers || [];
  const hasWorkspace = data.hasWorkspace;

  function renderList() {
    const rows = servers
      .map(
        (s) => /* html */ `
    <div class="item-row" data-name="${escHtml(s.name)}" data-scope="${s.source}">
      <div class="item-main">
        <span class="item-name">${escHtml(s.name)}</span>
        <span class="badge">${s.source}</span>
        <span class="dim">${escHtml(formatTransport(s.entry))}</span>
        ${s.entry.disabled ? '<span class="badge badge-warn">disabled</span>' : ""}
      </div>
      <div class="item-actions">
        <button class="btn-sm" data-action="edit-server" data-name="${escHtml(s.name)}">Edit</button>
        <button class="btn-sm" data-action="toggle-disabled" data-name="${escHtml(s.name)}">${s.entry.disabled ? "Enable" : "Disable"}</button>
        <button class="btn-sm btn-danger" data-action="delete-server" data-name="${escHtml(s.name)}">Delete</button>
      </div>
    </div>`,
      )
      .join("");

    parent.innerHTML = /* html */ `
<div class="tab-section">
  <div class="section-header">
    <h3>MCP Servers</h3>
    <button class="btn-primary" data-action="add-server">Add Server</button>
  </div>
  <div class="item-list">${rows || '<span class="dim">No servers configured.</span>'}</div>
  <div class="btn-row">
    <button class="btn-secondary" data-action="open-mcp-json" data-scope="user">Open user mcp.json</button>
    ${hasWorkspace ? '<button class="btn-secondary" data-action="open-mcp-json" data-scope="project">Open project mcp.json</button>' : ""}
  </div>
</div>`;
  }

  function showEditor(server?: (typeof servers)[number]) {
    const e = server?.entry ?? {};
    const directTools = typeof e.directTools === "boolean" ? "" : (e.directTools ?? []).join("\n");
    const directToolsAll = e.directTools === true;

    parent.innerHTML = /* html */ `
<div class="editor-card">
  <h3>${server ? `Edit: ${escHtml(server.name)}` : "Add Server"}</h3>
  ${
    server
      ? ""
      : `<label class="field-label">Scope</label>
  <select id="mcp-scope">
    <option value="user" selected>user (~/.pi/agent/mcp.json)</option>
    ${hasWorkspace ? '<option value="project">project (.pi/mcp.json)</option>' : ""}
  </select>`
  }
  <label class="field-label">Name</label>
  <input id="mcp-name" value="${escHtml(server?.name ?? "")}" placeholder="my-server" />
  <label class="field-label">URL (HTTP transport)</label>
  <input id="mcp-url" value="${escHtml(e.url ?? "")}" placeholder="https://..." />
  <label class="field-label">Command (stdio transport)</label>
  <input id="mcp-command" value="${escHtml(e.command ?? "")}" placeholder="npx" />
  <label class="field-label">Args (one per line)</label>
  <textarea id="mcp-args" class="ta" style="height:60px" placeholder="-y&#10;@modelcontextprotocol/server-foo">${escHtml((e.args ?? []).join("\n"))}</textarea>
  <label class="field-label">Env (KEY=VALUE, one per line)</label>
  <textarea id="mcp-env" class="ta" style="height:60px" placeholder="API_KEY=xxx">${escHtml(kvToLines(e.env))}</textarea>
  <label class="field-label">cwd</label>
  <input id="mcp-cwd" value="${escHtml(e.cwd ?? "")}" />
  <label class="field-label">Headers (KEY: VALUE, one per line)</label>
  <textarea id="mcp-headers" class="ta" style="height:60px" placeholder="Authorization: Bearer xxx">${escHtml(kvToLines(e.headers, ": "))}</textarea>
  <label class="field-label">Bearer token</label>
  <input id="mcp-bearer" value="${escHtml(e.bearerToken ?? "")}" />
  <label class="field-label">Direct tools (one per line, or "all")</label>
  <textarea id="mcp-dt" class="ta" style="height:60px" placeholder="tool_a&#10;tool_b">${escHtml(directTools)}</textarea>
  <label class="check-label"><input type="checkbox" id="mcp-dt-all" ${directToolsAll ? "checked" : ""} /> All tools direct</label>
  <label class="check-label"><input type="checkbox" id="mcp-disabled" ${e.disabled ? "checked" : ""} /> Disabled</label>
  <div class="btn-row">
    <button class="btn-primary" data-action="save-mcp">Save</button>
    <button class="btn-secondary" data-action="cancel-mcp">Cancel</button>
  </div>
</div>`;
  }

  function readForm(): McpForm {
    const v = (id: string) => (document.getElementById(id) as HTMLInputElement)?.value ?? "";
    return {
      name: v("mcp-name"),
      url: v("mcp-url"),
      command: v("mcp-command"),
      args: (document.getElementById("mcp-args") as HTMLTextAreaElement)?.value ?? "",
      env: (document.getElementById("mcp-env") as HTMLTextAreaElement)?.value ?? "",
      cwd: v("mcp-cwd"),
      headers: (document.getElementById("mcp-headers") as HTMLTextAreaElement)?.value ?? "",
      bearerToken: v("mcp-bearer"),
      directTools: (document.getElementById("mcp-dt") as HTMLTextAreaElement)?.value ?? "",
      directToolsAll: (document.getElementById("mcp-dt-all") as HTMLInputElement)?.checked ?? false,
      disabled: (document.getElementById("mcp-disabled") as HTMLInputElement)?.checked ?? false,
    };
  }

  parent.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const name = btn.getAttribute("data-name");

    switch (action) {
      case "add-server":
        showEditor();
        break;
      case "edit-server": {
        const server = servers.find((s) => s.name === name);
        if (server) showEditor(server);
        break;
      }
      case "delete-server":
        if (name) {
          const server = servers.find((s) => s.name === name);
          vscode.postMessage({ type: "deleteServer", name, scope: server?.source ?? "user" });
        }
        break;
      case "toggle-disabled":
        if (name) {
          const server = servers.find((s) => s.name === name);
          vscode.postMessage({ type: "toggleDisabled", name, scope: server?.source ?? "user" });
        }
        break;
      case "open-mcp-json":
        vscode.postMessage({
          type: "openMcpFile",
          scope: btn.getAttribute("data-scope") ?? "user",
        });
        break;
      case "save-mcp": {
        const form = readForm();
        if (!form.name.trim()) {
          showError(parent, "Server name is required");
          return;
        }
        const existing = servers.find((s) => s.name === form.name.trim());
        vscode.postMessage({
          type: existing ? "updateServer" : "addServer",
          name: form.name.trim(),
          scope: existing
            ? existing.source
            : ((document.getElementById("mcp-scope") as HTMLSelectElement)?.value ?? "user"),
          entry: form,
        });
        break;
      }
      case "cancel-mcp":
        renderList();
        break;
    }
  });
}

function formatTransport(e: { url?: string; command?: string; args?: string[] }): string {
  if (e.url) return e.url;
  if (e.command) return e.command + (e.args?.length ? " " + e.args.join(" ") : "");
  return "(no transport)";
}

function kvToLines(kv: Record<string, string> | undefined, sep = "="): string {
  if (!kv) return "";
  return Object.entries(kv)
    .map(([k, v]) => `${k}${sep}${v}`)
    .join("\n");
}

function showError(parent: HTMLElement, msg: string) {
  const host = parent.querySelector(".error-host");
  const div = document.createElement("div");
  div.className = "error";
  div.textContent = msg;
  if (host) host.appendChild(div);
  else {
    div.style.margin = "8px 12px";
    parent.prepend(div);
  }
  setTimeout(() => div.remove(), 4000);
}

function escHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
