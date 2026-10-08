import { el, hideTooltip, showTooltip, vscode } from "./globals";
import { t } from "./i18n";

interface McpServerStatus {
  name: string;
  state: string;
  disabled: boolean;
  tools: number;
  exposure: string;
  error?: string;
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
  if (s.state === "starting") return "mcp-dot mcp-dot-busy";
  if (s.disabled || s.state === "disabled") return "mcp-dot mcp-dot-off";
  return "mcp-dot mcp-dot-err";
}

function stateLabel(s: McpServerStatus): string {
  return s.disabled ? "disabled" : s.state;
}

function renderRows(): void {
  if (!drawerEl) return;
  const body = drawerEl.querySelector(".mcp-drawer-body") as HTMLElement;
  body.innerHTML = "";

  if (lastServers.length === 0) {
    const empty = el("div", "mcp-empty");
    empty.textContent = t("No MCP servers configured. Add servers in pi's MCP settings.");
    body.appendChild(empty);
    return;
  }

  for (let i = 0; i < lastServers.length; i++) {
    const s = lastServers[i];
    const row = el("div", "mcp-row");

    const label = stateLabel(s);
    const dot = el("span", stateDotClass(s));
    dot.setAttribute("aria-label", t(label));
    dot.addEventListener("mouseenter", () => showTooltip(dot, t(label)));
    dot.addEventListener("mouseleave", hideTooltip);
    row.appendChild(dot);

    const main = el("div", "mcp-row-main");
    const nameLine = el("div", "mcp-name-line");
    const nameEl = el("span", "mcp-name");
    nameEl.textContent = s.name;
    nameLine.appendChild(nameEl);

    const st = el("span", "mcp-state mcp-state-" + label);
    st.textContent = t(label);
    nameLine.appendChild(st);
    main.appendChild(nameLine);

    const parts: string[] = [];
    if (s.tools) parts.push(t("{0} tools", s.tools));
    if (s.exposure) parts.push(s.exposure);
    if (parts.length) {
      const meta = el("span", "mcp-meta");
      meta.textContent = parts.join(" · ");
      main.appendChild(meta);
    }

    if (s.error) {
      const err = el("span", "mcp-err");
      err.textContent = s.error;
      err.setAttribute("aria-label", s.error);
      err.addEventListener("mouseenter", () => showTooltip(err, s.error ?? ""));
      err.addEventListener("mouseleave", hideTooltip);
      main.appendChild(err);
    }
    row.appendChild(main);

    const reconnect = el("button", "mcp-icon-btn") as HTMLButtonElement;
    reconnect.setAttribute("aria-label", t("Reconnect"));
    reconnect.addEventListener("mouseenter", () => showTooltip(reconnect, t("Reconnect")));
    reconnect.addEventListener("mouseleave", hideTooltip);
    reconnect.innerHTML = '<span class="codicon codicon-refresh"></span>';
    reconnect.addEventListener("click", function () {
      vscode.postMessage({ type: "mcpAction", action: "reconnect", server: s.name });
    });
    row.appendChild(reconnect);

    body.appendChild(row);
  }
}

function buildPopover(): void {
  if (popoverEl) return;
  popoverEl = el("div", "mcp-popover");
  drawerEl = el("div", "mcp-drawer");

  const head = el("div", "mcp-drawer-head");
  const title = el("span", "mcp-drawer-title");
  title.textContent = t("MCP Servers");
  head.appendChild(title);
  const close = el("button", "mcp-icon-btn") as HTMLButtonElement;
  close.setAttribute("aria-label", t("Close"));
  close.addEventListener("mouseenter", () => showTooltip(close, t("Close")));
  close.addEventListener("mouseleave", hideTooltip);
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
