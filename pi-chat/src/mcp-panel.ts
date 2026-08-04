import { el, vscode } from "./globals";

interface McpServerStatus {
  name: string;
  state: string;
  source: "user" | "project";
  disabled: boolean;
  error?: string;
  tools: number;
  resources: number;
  prompts: number;
}

let popoverEl: HTMLDivElement | null = null;
let drawerEl: HTMLDivElement | null = null;
let lastServers: McpServerStatus[] = [];

function appEl(): HTMLElement {
  return document.querySelector(".app") as HTMLElement;
}

function toolbarEl(): HTMLElement {
  return document.querySelector(".toolbar") as HTMLElement;
}

function stateDotClass(s: McpServerStatus): string {
  if (s.state === "connected") return "mcp-dot mcp-dot-ok";
  if (s.state === "connecting") return "mcp-dot mcp-dot-busy";
  if (s.state === "error") return "mcp-dot mcp-dot-err";
  if (s.disabled) return "mcp-dot mcp-dot-off";
  return "mcp-dot mcp-dot-err";
}

function stateLabel(s: McpServerStatus): string {
  if (s.state === "connected") return "connected";
  if (s.state === "connecting") return "connecting";
  if (s.state === "error") return "error";
  if (s.disabled) return "disabled";
  return "stopped";
}

function isOn(s: McpServerStatus): boolean {
  return s.state === "connected" || s.state === "connecting";
}

function renderRows(): void {
  if (!drawerEl) return;
  const body = drawerEl.querySelector(".mcp-drawer-body") as HTMLElement;
  body.innerHTML = "";

  if (lastServers.length === 0) {
    const empty = el("div", "mcp-empty");
    empty.textContent = "No MCP servers configured. Add servers in the MCP sidebar.";
    body.appendChild(empty);
    return;
  }

  for (let i = 0; i < lastServers.length; i++) {
    const s = lastServers[i];
    const row = el("div", "mcp-row");

    const dot = el("span", stateDotClass(s));
    dot.title = stateLabel(s);
    row.appendChild(dot);

    const main = el("div", "mcp-row-main");
    const nameLine = el("div", "mcp-name-line");
    const nameEl = el("span", "mcp-name");
    nameEl.textContent = s.name;
    nameLine.appendChild(nameEl);

    const src = el("span", "mcp-tag mcp-tag-" + s.source);
    src.textContent = s.source;
    nameLine.appendChild(src);

    const st = el("span", "mcp-state mcp-state-" + stateLabel(s));
    st.textContent = stateLabel(s);
    nameLine.appendChild(st);
    main.appendChild(nameLine);

    const meta = el("span", "mcp-meta");
    const parts: string[] = [];
    if (s.tools) parts.push(`${s.tools} tools`);
    if (s.resources) parts.push(`${s.resources} resources`);
    if (s.prompts) parts.push(`${s.prompts} prompts`);
    meta.textContent = parts.join(" · ");
    main.appendChild(meta);

    if (s.error) {
      const err = el("span", "mcp-err");
      err.textContent = s.error;
      err.title = s.error;
      main.appendChild(err);
    }
    row.appendChild(main);

    const reconnect = el("button", "mcp-icon-btn") as HTMLButtonElement;
    reconnect.title = "Reconnect";
    reconnect.innerHTML = '<span class="codicon codicon-refresh"></span>';
    reconnect.addEventListener("click", function () {
      vscode.postMessage({ type: "mcpAction", action: "reconnect", server: s.name });
    });
    row.appendChild(reconnect);

    const sw = el("button", "mcp-switch") as HTMLButtonElement;
    sw.title = isOn(s) ? "Stop" : "Start";
    if (isOn(s)) sw.classList.add("mcp-switch-on");
    const knob = el("span", "mcp-switch-knob");
    sw.appendChild(knob);
    sw.addEventListener("click", function () {
      vscode.postMessage({
        type: "mcpAction",
        action: isOn(s) ? "stop" : "start",
        server: s.name,
      });
    });
    row.appendChild(sw);

    body.appendChild(row);
  }
}

function buildPopover(): void {
  if (popoverEl) return;
  popoverEl = el("div", "mcp-popover");
  drawerEl = el("div", "mcp-drawer");

  const head = el("div", "mcp-drawer-head");
  const title = el("span", "mcp-drawer-title");
  title.textContent = "MCP Servers";
  head.appendChild(title);
  const close = el("button", "mcp-icon-btn") as HTMLButtonElement;
  close.title = "Close";
  close.innerHTML = '<span class="codicon codicon-discard"></span>';
  close.addEventListener("click", closeMcpDrawer);
  head.appendChild(close);
  drawerEl.appendChild(head);

  const body = el("div", "mcp-drawer-body");
  drawerEl.appendChild(body);

  popoverEl.appendChild(drawerEl);
  popoverEl.addEventListener("click", function (ev: MouseEvent) {
    if (ev.target === popoverEl) closeMcpDrawer();
  });

  appEl().appendChild(popoverEl);
}

export function openMcpDrawer(): void {
  buildPopover();
  const tb = toolbarEl();
  if (tb && popoverEl) popoverEl.style.top = tb.offsetHeight + "px";
  renderRows();
  if (popoverEl) popoverEl.style.display = "flex";
}

export function closeMcpDrawer(): void {
  if (popoverEl) popoverEl.style.display = "none";
}

export function setMcpStatus(servers: McpServerStatus[]): void {
  lastServers = Array.isArray(servers) ? servers : [];
  renderRows();
}
