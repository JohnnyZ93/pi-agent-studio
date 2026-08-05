import codiconTtf from "@vscode/codicons/dist/codicon.ttf?inline";
import "./style.css";
import { vscode } from "./globals";
import { renderModelsTab, handleOAuthProgress, setModelsTabActive } from "./tabs/models";
import { renderAgentsTab } from "./tabs/agents";
import { renderPromptsTab } from "./tabs/prompts";
import { renderSkillsTab } from "./tabs/skills";
import { renderMcpTab } from "./tabs/mcp";
import { renderCommitTab } from "./tabs/commit";
import { renderSettingsTab } from "./tabs/settings";

const codiconStyle = document.createElement("style");
codiconStyle.textContent =
  '@font-face{font-family:"codicon";font-display:block;src:url(' +
  codiconTtf +
  ') format("truetype")}';
document.head.prepend(codiconStyle);

if (typeof (window as any).__PI_FONTSIZE__ === "number" && (window as any).__PI_FONTSIZE__ > 0) {
  document.documentElement.style.setProperty("--fs", (window as any).__PI_FONTSIZE__ + "px");
}

const nav = document.querySelector(".nav")!;
let content = document.getElementById("content")!;

let activeTab = "models";
const tabData: Record<string, any> = {};

nav.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".nav-tab");
  if (!btn) return;
  const tab = btn.dataset.tab;
  if (!tab || tab === activeTab) return;
  switchTab(tab);
});

document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".toolbar-btn[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === "reload") vscode.postMessage({ type: "refresh", tab: activeTab });
});

function switchTab(tab: string) {
  const prev = nav.querySelector(".nav-tab.active");
  if (prev) prev.classList.remove("active");
  const next = nav.querySelector(`.nav-tab[data-tab="${tab}"]`);
  if (next) next.classList.add("active");
  activeTab = tab;
  setModelsTabActive(tab === "models");
  content.innerHTML = '<div class="tab-placeholder">Loading…</div>';
  vscode.postMessage({ type: "tabLoad", tab });
}

function showToast(text: string, kind?: string) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast" + (kind ? " " + kind : "");
  toast.textContent = text;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

window.addEventListener("message", (ev) => {
  const msg = ev.data;
  if (!msg || typeof msg.type !== "string") return;
  switch (msg.type) {
    case "init":
      setModelsTabActive(activeTab === "models");
      vscode.postMessage({ type: "tabLoad", tab: activeTab });
      break;
    case "error":
      showToast(msg.message || "Unknown error", "error");
      break;
    case "tabData":
      tabData[msg.tab] = msg.data;
      if (activeTab === msg.tab) renderTab(msg.tab, msg.data);
      break;
    case "oauthProgress":
      handleOAuthProgress(msg.event);
      break;
    case "saved":
      if (msg.what === "system") showToast("System prompt saved", "success");
      else if (msg.what === "append") showToast("Append prompt saved", "success");
      else if (msg.what === "commit") showToast("Commit message settings saved", "success");
      break;
    default:
      break;
  }
});

function renderTab(tab: string, data: any) {
  const fresh = content.cloneNode(false) as HTMLElement;
  content.replaceWith(fresh);
  content = fresh;
  const loader = tabRenderers[tab];
  if (loader) {
    loader(content, data);
  } else {
    content.innerHTML = '<div class="tab-placeholder">Tab "' + tab + '" not yet implemented</div>';
  }
}

const tabRenderers: Record<string, (parent: HTMLElement, data: any) => void> = {
  models: renderModelsTab,
  agents: renderAgentsTab,
  prompts: renderPromptsTab,
  skills: renderSkillsTab,
  mcp: renderMcpTab,
  commit: renderCommitTab,
  settings: renderSettingsTab,
};

vscode.postMessage({ type: "ready" });
