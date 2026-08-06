import markdownit from "markdown-it";
import { t } from "./i18n";

const acquireVscodeApi: any =
  typeof acquireVsCodeApi === "function"
    ? acquireVsCodeApi
    : () => ({ postMessage: () => {}, getState: () => null, setState: () => {} });

export const vscode = acquireVscodeApi();
export const md = markdownit({ html: false, breaks: true, linkify: true });

export const state: Record<string, any> = {
  model: null,
  thinkingLevel: "medium",
  isStreaming: false,
  isBtwLoading: false,
  sessionFile: null,
  sessionName: "",
};

export let models: any[] = [];
export let thinkingLevels: string[] = [];
export let commands: any[] = [];
export const BUILTIN_CMDS: Record<string, number> = {
  compact: 1,
  autocompact: 1,
  session: 1,
  name: 1,
  changelog: 1,
  clear: 1,
  new: 1,
};

export let currentAssistant: any = null;
export function setCurrentAssistant(v: any): void {
  currentAssistant = v;
}
export let pendingCompactionBlock: HTMLElement | null = null;
export let pendingBtwBlock: HTMLElement | null = null;
export let btwAbortId: string | null = null;
export let btwStatusActive = false;
export let lastUserBubble: HTMLElement | null = null;
export let retryAttempt = 0;
export let todoCollapsed = false;

export function setBtwStatusActive(b: boolean) {
  btwStatusActive = b;
}
export function setLastUserBubble(el: HTMLElement | null) {
  lastUserBubble = el;
}
export function setRetryAttempt(n: number) {
  retryAttempt = n;
}

export let inputHistory: string[] = [];
export let pendingImages: { data: string; mimeType: string; dataUrl: string }[] = [];

export function setBtwAbortId(id: string | null) {
  btwAbortId = id;
}
export let sendBtnTip = "";

export const PI_HOME: string = (window as any).__PI_HOME__ || "";
export const PI_SEP: string = (window as any).__PI_SEP__ || "/";

// ---- DOM refs ----
export const messagesEl = document.getElementById("messages")!;
export const messagesInner = document.getElementById("messages-inner")!;
export const widgetEl = document.getElementById("widget")!;
export const queueEl = document.getElementById("queue")!;
export const inputEl = document.getElementById("input") as HTMLTextAreaElement;
export const sendBtn = document.getElementById("send") as HTMLButtonElement;
export const attachBtn = document.getElementById("attach-btn") as HTMLButtonElement;
export const attachPreviewEl = document.getElementById("attach-preview")!;
export const infoBtn = document.getElementById("info-btn") as HTMLButtonElement;
export const refreshBtn = document.getElementById("refresh-btn") as HTMLButtonElement;
export const mcpBtn = document.getElementById("mcp-btn") as HTMLButtonElement;
export const settingsBtn = document.getElementById("settings-btn") as HTMLButtonElement;
export const modelWrap = document.getElementById("model-wrap")!;
export const modelTrigger = document.getElementById("model-trigger") as HTMLButtonElement;
export const modelTriggerLabel = document.getElementById("model-trigger-label")!;
export const modelPopup = document.getElementById("model-popup")!;
export const modelSearch = document.getElementById("model-search") as HTMLInputElement;
export const modelList = document.getElementById("model-list")!;
export let enabledModelKeys: Set<string> = new Set();
export function setEnabledModelKeys(keys: string[]): void {
  enabledModelKeys = new Set((keys || []).map((k) => String(k).toLowerCase()));
}
export const ctxRing = document.getElementById("ctx-ring")!;
export const ctxRingProg = document.getElementById("ctx-ring-prog")!;
export let ctxRingText = "";
export let lastCtxUsage: any = null;
export let sessionCost: number | null = null;
export let latestCacheHitPct: number | null = null;
export function setSessionCost(v: number | null) {
  sessionCost = v;
}
export function setLatestCacheHitPct(v: number | null) {
  latestCacheHitPct = v;
}
export let prevTurn: any = null;
export function setPrevTurn(v: any) {
  prevTurn = v;
}
export const thinkingSelect = document.getElementById("thinking-select") as HTMLSelectElement;
export const permissionSelect = document.getElementById("permission-select") as HTMLSelectElement;
export const permissionIcon = document.getElementById("permission-icon")!;
export const statusEl = document.getElementById("status")!;
export const sessionInfoEl = document.getElementById("session-info")!;
export const nameBtn = document.getElementById("name-btn") as HTMLButtonElement;
export const nameInput = document.getElementById("name-input") as HTMLInputElement;
export let nameEditing = false;
export const acEl = document.getElementById("autocomplete")!;
export const overlayEl = document.getElementById("overlay")!;
export const toastEl = document.getElementById("toast")!;
export const scrollBottomBtn = document.getElementById("scroll-bottom-btn")!;

// ---- icon constants ----
export const ICON_PLUS = '<span class="codicon codicon-add"></span>';
export const ICON_SEND = '<span class="codicon codicon-send"></span>';
export const ICON_STOP = '<span class="codicon codicon-debug-stop"></span>';
export const ICON_TODO = '<span class="codicon codicon-checklist"></span>';
export const ICON_CHECK = '<span class="codicon codicon-check"></span>';
export const ICON_INFO = '<span class="codicon codicon-info"></span>';
export const ICON_REFRESH = '<span class="codicon codicon-refresh"></span>';
export const ICON_EDIT = '<span class="codicon codicon-edit"></span>';
export function getEmptyHtml(): string {
  return (
    '<div class="empty">' +
    '<div class="empty-logo"><svg viewBox="0 0 800 800" fill="currentColor"><path fill-rule="evenodd" d="M165.29 165.29H517.36V400H400V517.36H282.65V634.72H165.29ZM282.65 282.65V400H400V282.65Z"/><path d="M517.36 400H634.72V634.72H517.36Z"/></svg></div>' +
    '<div class="empty-line">' +
    t("There are many agent harnesses") +
    "</div>" +
    '<div class="empty-line">' +
    t("but this one is") +
    ' <span class="empty-accent">' +
    t("yours") +
    "</span></div>" +
    '<div class="empty-hints">' +
    '<span class="empty-hint"><kbd>Enter</kbd>' +
    t("send / steer") +
    "</span>" +
    '<span class="empty-hint"><kbd>Shift+Enter</kbd>' +
    t("newline") +
    "</span>" +
    '<span class="empty-hint"><kbd>Alt+Enter</kbd>' +
    t("follow-up") +
    "</span>" +
    '<span class="empty-hint"><kbd>\u2191\u2193</kbd>' +
    t("history") +
    "</span>" +
    '<span class="empty-hint"><kbd>/</kbd>' +
    t("commands") +
    "</span>" +
    '<span class="empty-hint"><kbd>@</kbd>' +
    t("files") +
    "</span>" +
    '<span class="empty-hint"><kbd>' +
    (/Mac/i.test(navigator.platform || "") ? "\u2318V" : "Ctrl+V") +
    "</kbd>" +
    t("paste image") +
    "</span>" +
    '<span class="empty-hint"><kbd>Tab</kbd>' +
    t("complete") +
    "</span>" +
    '<span class="empty-hint"><kbd>' +
    (/Mac/i.test(navigator.platform || "") ? "\u2318U" : "Ctrl+U") +
    "</kbd>" +
    t("clear") +
    "</span>" +
    "</div>" +
    "</div>"
  );
}

// ---- helpers ----
export function el(tag: "button", cls?: string): HTMLButtonElement;
export function el(tag: "div", cls?: string): HTMLDivElement;
export function el(tag: "span", cls?: string): HTMLSpanElement;
export function el(tag: string, cls?: string): HTMLElement;
export function el(tag: string, cls?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

export function formatTime(ts: any): string {
  if (ts == null || typeof ts !== "number" || !isFinite(ts)) return "";
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  const mm = m < 10 ? "0" + m : "" + m;
  return hr + ":" + mm + " " + ampm;
}

// ---- scroll management ----
export let autoScroll = true;
export function setAutoScroll(b: boolean) {
  autoScroll = b;
}
export let programmaticScroll = false;
let scrollRAF: number | null = null;
const STICK_THRESHOLD = 48;

export function isAtBottom(): boolean {
  return (
    messagesEl.scrollTop + messagesEl.clientHeight >= messagesEl.scrollHeight - STICK_THRESHOLD
  );
}

export function updateScrollBtn(): void {
  if (autoScroll) scrollBottomBtn.classList.remove("show");
  else scrollBottomBtn.classList.add("show");
}

messagesEl.addEventListener("scroll", function () {
  if (programmaticScroll) {
    programmaticScroll = false;
    return;
  }
  autoScroll = isAtBottom();
  updateScrollBtn();
});

messagesEl.addEventListener(
  "wheel",
  function (e: WheelEvent) {
    programmaticScroll = false;
    if (e.deltaY < 0) {
      autoScroll = false;
      if (scrollRAF) {
        cancelAnimationFrame(scrollRAF);
        scrollRAF = null;
      }
      updateScrollBtn();
    }
  },
  true,
);

["keydown", "mousedown", "touchstart"].forEach(function (ev) {
  messagesEl.addEventListener(
    ev,
    function () {
      programmaticScroll = false;
    },
    true,
  );
});

scrollBottomBtn.addEventListener("click", scrollToBottom);

export function scrollToBottom(): void {
  autoScroll = true;
  programmaticScroll = false;
  if (scrollRAF) {
    cancelAnimationFrame(scrollRAF);
    scrollRAF = null;
  }
  forceStickBottom();
  updateScrollBtn();
}

export function forceStickBottom(): void {
  programmaticScroll = true;
  messagesEl.scrollTop = messagesEl.scrollHeight;
  for (let i = 0; i < pendingTexts.length; i++) {
    const tb = pendingTexts[i];
    if (tb && tb.textEl) tb.textEl.scrollTop = tb.textEl.scrollHeight;
  }
  if (currentAssistant) {
    const blks = currentAssistant.blocks;
    for (let k = 0; k < blks.length; k++) {
      const tk = blks[k];
      if (tk && tk.type === "thinking" && tk._tnode && tk.textEl)
        tk.textEl.scrollTop = tk.textEl.scrollHeight;
    }
  }
}

export function scheduleScroll(): void {
  if (scrollRAF) return;
  scrollRAF = requestAnimationFrame(function () {
    scrollRAF = null;
    if (!autoScroll) return;
    forceStickBottom();
  });
}

if (typeof ResizeObserver !== "undefined" && messagesInner) {
  const stickRO = new ResizeObserver(function () {
    if (autoScroll) scheduleScroll();
  });
  stickRO.observe(messagesInner);
}

// ---- pending texts (used by messages.ts) ----
export let pendingTexts: any[] = [];

// ---- status / send button ----
export function setStatus(t?: string): void {
  statusEl.textContent = t || "";
}

export function updateSendButton(): void {
  if (state.isStreaming || state.isBtwLoading) {
    sendBtn.innerHTML = ICON_STOP;
    sendBtn.classList.add("is-stop");
    sendBtnTip = state.isBtwLoading ? t("Stop /btw") : t("Stop generation");
    sendBtn.disabled = false;
  } else {
    sendBtn.innerHTML = ICON_SEND;
    sendBtn.classList.remove("is-stop");
    sendBtnTip = t("Send message");
    sendBtn.disabled = !inputEl.value.trim() && !pendingImages.length;
  }
}

export function setStreaming(b: boolean): void {
  state.isStreaming = b;
  if (!b) finalizeTextBlocks();
  updateSendButton();
  attachBtn.disabled = b;
  refreshBtn.disabled = b;
  if (!b && !statusEl.textContent) setStatus("");
}

// ---- text block finalization (cross-module) ----
export function finalizeTextBlocks(): void {
  for (let i = 0; i < pendingTexts.length; i++) {
    const b = pendingTexts[i];
    b.finalized = true;
    b._pending = false;
    if (b._tnode) b._tnode = null;
    if (b.textEl) b.textEl.classList.remove("is-streaming");
    renderMarkdown(b.textEl, b.text);
    applyTextCollapsible(b);
  }
  pendingTexts = [];
  if (autoScroll) scheduleScroll();
}

// These are imported from messages.ts and set after module init
export let renderMarkdown: (target: HTMLElement, text: string) => void = () => {};
export let applyTextCollapsible: (b: any) => void = () => {};

// ---- context usage ----
export function applyContextUsage(usage: any, cost?: number): void {
  if (!ctxRingProg || !ctxRing) return;
  lastCtxUsage = usage;
  if (cost != null && typeof cost === "number" && isFinite(cost)) sessionCost = cost;
  const pct = usage && typeof usage.percent === "number" ? usage.percent : 0;
  ctxRingProg.style.strokeDashoffset = String(100 - Math.max(0, Math.min(100, pct)));
  ctxRing.classList.toggle("is-warn", pct >= 50 && pct < 80);
  ctxRing.classList.toggle("is-error", pct >= 80);
  rebuildCtxRingTooltip();
}

export function rebuildCtxRingTooltip(): void {
  const usage = lastCtxUsage;
  const lines: string[] = [];
  const tokens = usage && typeof usage.tokens === "number" ? usage.tokens : null;
  const cw = usage && typeof usage.contextWindow === "number" ? usage.contextWindow : null;
  if (tokens != null && cw != null) {
    const p = Math.max(
      0,
      Math.min(100, usage && typeof usage.percent === "number" ? usage.percent : 0),
    );
    lines.push(t("Usage:") + "   " + p.toFixed(1) + "%");
    lines.push(t("Context:") + " " + formatTokens(tokens) + " / " + formatTokens(cw));
  }
  if (latestCacheHitPct != null) {
    lines.push(t("Cache:") + "   " + latestCacheHitPct.toFixed(1) + "% " + t("hit"));
  }
  if (sessionCost != null) {
    lines.push(t("Cost:") + "    $" + sessionCost.toFixed(3));
  }
  ctxRingText = lines.join("\n");
}

export function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return (count / 1000).toFixed(1) + "k";
  if (count < 1000000) return Math.round(count / 1000) + "k";
  return (count / 1000000).toFixed(1) + "M";
}

export function clearMessages(): void {
  messagesInner.innerHTML = getEmptyHtml();
}

// ---- widget ----
export function applyWidget(key: string, lines: string[]): void {
  if (!key || !lines || !lines.length) {
    widgetEl.style.display = "none";
    widgetEl.innerHTML = "";
    return;
  }
  widgetEl.innerHTML = "";
  if (key !== "todo-list") {
    const pre = el("pre", "widget-body");
    pre.textContent = lines.join("\n");
    widgetEl.appendChild(pre);
    widgetEl.style.display = "block";
    return;
  }
  let payload: any = {};
  try {
    payload = JSON.parse(lines[0] || "{}");
  } catch {}
  const items = payload.todos || [];
  let doneCount = 0;
  for (let i = 0; i < items.length; i++) if (items[i].done) doneCount++;
  const totalCount = items.length;

  const card = el("div", "widget-card");
  card.classList.toggle("is-collapsed", todoCollapsed);
  const head = el("div", "widget-head");
  const toggle = el("button", "widget-toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-label", t("Collapse"));
  toggle.innerHTML = '<span class="codicon codicon-chevron-right"></span>';
  toggle.addEventListener("click", function () {
    todoCollapsed = !todoCollapsed;
    applyWidget(key, lines);
  });
  toggle.addEventListener("mouseenter", function () {
    showTooltip(toggle, t("Expand"));
  });
  toggle.addEventListener("mouseleave", hideTooltip);
  head.appendChild(toggle);
  const title = el("span", "widget-title");
  title.innerHTML = ICON_TODO + "<span>" + t("Todos") + "</span>";
  head.appendChild(title);
  if (totalCount > 0) {
    const stats = el("span", "widget-stats");
    stats.textContent = doneCount + "/" + totalCount;
    head.appendChild(stats);
  }
  if (items.length) {
    const clearBtn = el("button", "widget-clear");
    clearBtn.type = "button";
    clearBtn.setAttribute("aria-label", t("Clear all todos"));
    clearBtn.innerHTML = '<span class="codicon codicon-clear-all"></span>';
    clearBtn.addEventListener("click", function () {
      vscode.postMessage({ type: "todoClear" });
    });
    clearBtn.addEventListener("mouseenter", function () {
      showTooltip(clearBtn, t("Clear all todos"));
    });
    clearBtn.addEventListener("mouseleave", hideTooltip);
    head.appendChild(clearBtn);
  }
  card.appendChild(head);
  if (items.length) {
    const list = el("div", "todo-list");
    for (let j = 0; j < items.length; j++) {
      const it = items[j];
      const row = el("div", "todo-item" + (it.done ? " is-done" : ""));
      const check = el("span", "todo-check");
      if (it.done) check.innerHTML = ICON_CHECK;
      row.appendChild(check);
      if (it.id) {
        const idSpan = el("span", "todo-id");
        idSpan.textContent = "#" + it.id;
        row.appendChild(idSpan);
      }
      const txt = el("span", "todo-text");
      txt.textContent = it.text;
      row.appendChild(txt);
      list.appendChild(row);
    }
    card.appendChild(list);
  }
  widgetEl.appendChild(card);
  widgetEl.style.display = "block";
}

// ---- queue ----
export const queueState: { steering: string[]; followUp: string[] } = {
  steering: [],
  followUp: [],
};

export function makeQueueItem(text: string, kind: string): HTMLElement {
  const item = el("div", "queue-item" + (kind === "followUp" ? " is-followup" : ""));
  const badge = el("span", "queue-badge");
  badge.textContent = kind === "followUp" ? t("Follow-up") : t("Steering");
  const txt = el("div", "queue-text");
  txt.textContent = text;
  txt.title = text;
  item.appendChild(badge);
  item.appendChild(txt);
  return item;
}

export function renderQueue(): void {
  const s = queueState.steering || [];
  const f = queueState.followUp || [];
  if (!s.length && !f.length) {
    queueEl.style.display = "none";
    queueEl.innerHTML = "";
    return;
  }
  queueEl.innerHTML = "";
  for (let i = 0; i < s.length; i++) queueEl.appendChild(makeQueueItem(s[i], "steer"));
  for (let j = 0; j < f.length; j++) queueEl.appendChild(makeQueueItem(f[j], "followUp"));
  queueEl.style.display = "flex";
}

// ---- tooltip ----
export const ctxTooltip = document.createElement("div");
ctxTooltip.className = "ctx-tooltip";
ctxTooltip.style.display = "none";
document.body.appendChild(ctxTooltip);

export function showTooltip(target: HTMLElement, text: string): void {
  if (!text) return;
  ctxTooltip.textContent = text;
  ctxTooltip.style.display = "block";
  const r = target.getBoundingClientRect();
  const cw = ctxTooltip.offsetWidth;
  const ch = ctxTooltip.offsetHeight;
  let x = r.left + r.width / 2 - cw / 2;
  if (x < 4) x = 4;
  else if (x + cw > window.innerWidth - 4) x = window.innerWidth - cw - 4;
  const aboveY = r.top - ch - 6;
  const belowY = r.bottom + 6;
  const below = aboveY < 4;
  ctxTooltip.style.left = x + "px";
  ctxTooltip.style.top = (below ? belowY : aboveY) + "px";
}

export function hideTooltip(): void {
  ctxTooltip.style.display = "none";
}

// ---- toast ----
let toastTimer: number | null = null;

export function showToast(text: string, kind?: string, persistent?: boolean): void {
  if (!text) return;
  toastEl.textContent = text;
  toastEl.className = "toast show" + (kind ? " " + kind : "") + (persistent ? " persistent" : "");
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  if (!persistent) {
    toastTimer = window.setTimeout(function () {
      toastEl.className = "toast";
    }, 3500);
  }
}

export function hideToast(): void {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  toastEl.className = "toast";
}

// ---- info panel ----
let infoBackdropFn: ((ev: MouseEvent) => void) | null = null;

export function showInfoPanel(title: string, markdown: string): void {
  closeInfoPanel();
  const box = el("div", "info-panel");
  const h = el("h3");
  h.textContent = title || "";
  box.appendChild(h);
  const body = el("div", "info-panel-body");
  box.appendChild(body);
  renderMarkdown(body, markdown || "");
  const actions = el("div", "info-panel-actions");
  const copyBtn = el("button", "btn btn-secondary");
  copyBtn.textContent = t("Copy");
  copyBtn.addEventListener("click", function () {
    vscode.postMessage({ type: "copy", text: markdown || "" });
    showToast(t("Copied"), "success");
  });
  actions.appendChild(copyBtn);
  const closeBtn = el("button", "btn btn-primary");
  closeBtn.textContent = t("Close");
  closeBtn.addEventListener("click", closeInfoPanel);
  actions.appendChild(closeBtn);
  box.appendChild(actions);
  overlayEl.appendChild(box);
  infoBackdropFn = function (ev: MouseEvent) {
    if (ev.target === overlayEl) closeInfoPanel();
  };
  overlayEl.addEventListener("click", infoBackdropFn);
  overlayEl.style.display = "flex";
}

export function closeInfoPanel(): void {
  if (infoBackdropFn) {
    overlayEl.removeEventListener("click", infoBackdropFn);
    infoBackdropFn = null;
  }
  overlayEl.style.display = "none";
  overlayEl.innerHTML = "";
}

export function setRenderMarkdown(fn: typeof renderMarkdown): void {
  renderMarkdown = fn;
}

export function setApplyTextCollapsible(fn: typeof applyTextCollapsible): void {
  applyTextCollapsible = fn;
}

// ---- shorten path (used by messages.ts and rewind.ts) ----
export function shortenToolPath(p: string): string {
  if (typeof p !== "string" || !p) return "";
  if (PI_HOME && (p === PI_HOME || p.indexOf(PI_HOME + PI_SEP) === 0))
    return "~" + p.slice(PI_HOME.length);
  return p;
}

// ---- model icon imports (set from model-icons.ts) ----
export let getModelIcon: (name: string | null | undefined) => any = () => null;
export let modelIconHtml: (icon: any, cls?: string) => string = () => "";
export let escHtml: (s: string | null | undefined) => string = (s) => String(s == null ? "" : s);

export function setModelIconFns(
  gmi: typeof getModelIcon,
  mih: typeof modelIconHtml,
  eh: typeof escHtml,
): void {
  getModelIcon = gmi;
  modelIconHtml = mih;
  escHtml = eh;
}

// ---- name editing ----
export function enterNameEdit(): void {
  if (nameEditing) return;
  nameEditing = true;
  nameInput.value = state.sessionName || "";
  sessionInfoEl.style.display = "none";
  nameInput.style.display = "";
  nameInput.focus();
  nameInput.select();
}

export function exitNameEdit(submit: boolean): void {
  if (!nameEditing) return;
  nameEditing = false;
  const val = nameInput.value.trim();
  nameInput.style.display = "none";
  sessionInfoEl.style.display = "";
  if (submit && val) {
    vscode.postMessage({ type: "setSessionName", name: val });
  }
}

nameBtn.addEventListener("click", enterNameEdit);
nameBtn.addEventListener("mouseenter", function () {
  showTooltip(nameBtn, t("Rename session"));
});
nameBtn.addEventListener("mouseleave", hideTooltip);

infoBtn.addEventListener("click", function () {
  vscode.postMessage({ type: "prompt", message: "/session" });
});
infoBtn.addEventListener("mouseenter", function () {
  showTooltip(infoBtn, t("Session info"));
});
infoBtn.addEventListener("mouseleave", hideTooltip);

refreshBtn.addEventListener("click", function () {
  if (state.isStreaming) return;
  vscode.postMessage({ type: "reload" });
});
refreshBtn.addEventListener("mouseenter", function () {
  showTooltip(refreshBtn, t("Reload messages"));
});
refreshBtn.addEventListener("mouseleave", hideTooltip);

mcpBtn.addEventListener("click", function () {
  vscode.postMessage({ type: "mcpOpen" });
});
mcpBtn.addEventListener("mouseenter", function () {
  showTooltip(mcpBtn, t("Manage MCP"));
});
mcpBtn.addEventListener("mouseleave", hideTooltip);

settingsBtn.addEventListener("click", function () {
  vscode.postMessage({ type: "openSettings" });
});
settingsBtn.addEventListener("mouseenter", function () {
  showTooltip(settingsBtn, t("Settings"));
});
settingsBtn.addEventListener("mouseleave", hideTooltip);

nameInput.addEventListener("keydown", function (ev: KeyboardEvent) {
  if (!nameEditing) return;
  if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) {
    ev.preventDefault();
    exitNameEdit(true);
  } else if (ev.key === "Escape") {
    ev.preventDefault();
    exitNameEdit(false);
  }
});

nameInput.addEventListener("blur", function () {
  exitNameEdit(false);
});

// ---- init DOM ----
infoBtn.innerHTML = ICON_INFO;
refreshBtn.innerHTML = ICON_REFRESH;
nameBtn.innerHTML = ICON_EDIT;
attachBtn.innerHTML = ICON_PLUS;
updateSendButton();
applyContextUsage(null);
clearMessages();
