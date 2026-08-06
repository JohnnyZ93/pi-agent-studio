import {
  vscode,
  md,
  state,
  messagesInner,
  el,
  formatTime,
  setStreaming,
  setStatus,
  updateSendButton,
  scheduleScroll,
  scrollToBottom,
  PI_HOME,
  PI_SEP,
  showToast,
  hideToast,
  lastUserBubble,
  retryAttempt,
  pendingTexts,
  finalizeTextBlocks,
  rebuildCtxRingTooltip,
  prevTurn,
  formatTokens,
  getModelIcon,
  escHtml,
  modelIconHtml,
  shortenToolPath,
  inputHistory,
  clearMessages,
  btwStatusActive,
  setBtwAbortId,
  setBtwStatusActive,
  setLastUserBubble,
  setLatestCacheHitPct,
  setRetryAttempt,
  setSessionCost,
  setPrevTurn,
  queueState,
  renderQueue,
  currentAssistant,
  setCurrentAssistant,
} from "./globals";
import { showRewindConfirm, tipBtn } from "./rewind";
import { t } from "./i18n";

// ---- message DOM ----
let pendingCompactionBlockRef: HTMLElement | null = null;
let pendingBtwBlockRef: HTMLElement | null = null;

export function addUserMessage(text: string, images?: any[]) {
  const empty = messagesInner.querySelector(".empty");
  if (empty) empty.remove();
  const row = el("div", "msg user");
  const bubble = el("div", "bubble user-bubble");
  if (text) bubble.textContent = text;
  if (images && images.length) {
    const wrap = el("div", "bubble-imgs");
    for (let i = 0; i < images.length; i++) {
      const im = images[i];
      if (!im || !im.data || !im.mimeType) continue;
      const imgEl = document.createElement("img");
      imgEl.src = "data:" + im.mimeType + ";base64," + im.data;
      wrap.appendChild(imgEl);
    }
    bubble.appendChild(wrap);
  }
  row.appendChild(bubble);
  messagesInner.appendChild(row);
  setLastUserBubble(bubble);

  if (bubble.scrollHeight > 240) {
    bubble.classList.add("is-collapsible");
    const btn = el("button", "expand-btn");
    btn.type = "button";
    btn.textContent = t("Show more");
    btn.addEventListener("click", function () {
      const expanded = bubble.classList.toggle("is-expanded");
      btn.textContent = expanded ? t("Show less") : t("Show more");
    });
    row.appendChild(btn);
  }

  const timeEl = el("span", "msg-time");
  (bubble as any)._piTimeEl = timeEl;
  const metaEl = el("div", "bubble-meta");
  metaEl.appendChild(timeEl);
  row.appendChild(metaEl);

  appendUserActions(row, bubble, text, metaEl);

  scheduleScroll();
  return bubble;
}

export function applyUserBubbleTime(bubble: HTMLElement, ts: number) {
  if (!bubble) return;
  (bubble as any)._piTs = ts;
  if ((bubble as any)._piTimeEl) (bubble as any)._piTimeEl.textContent = formatTime(ts);
}

export function addCompactionMessage(m: any) {
  const empty = messagesInner.querySelector(".empty");
  if (empty) empty.remove();
  const row = el("div", "msg compaction");
  const det = document.createElement("details");
  det.className = "compaction-block";
  const summ = document.createElement("summary");
  const label = el("span", "compaction-label");
  label.textContent = t("[compaction]");
  summ.appendChild(label);
  const tokensBefore = m && typeof m.tokensBefore === "number" ? m.tokensBefore : null;
  summ.appendChild(
    document.createTextNode(
      t("Compacted from {0} tokens", tokensBefore != null ? tokensBefore.toLocaleString() : "?"),
    ),
  );
  det.appendChild(summ);
  const body = el("div", "compaction-body text-block");
  renderMarkdown(body, m && typeof m.summary === "string" ? m.summary : "");
  det.appendChild(body);
  row.appendChild(det);
  messagesInner.appendChild(row);
  scheduleScroll();
}

export function addCompactionPlaceholder() {
  const empty = messagesInner.querySelector(".empty");
  if (empty) empty.remove();
  const row = el("div", "msg compaction");
  const det = document.createElement("details");
  det.className = "compaction-block";
  det.setAttribute("open", "");
  const summ = document.createElement("summary");
  const label = el("span", "compaction-label");
  label.textContent = t("[compaction]");
  summ.appendChild(label);
  summ.appendChild(document.createTextNode(" " + t("Compacting…")));
  const spin = el("span", "tool-status is-running");
  summ.appendChild(spin);
  det.appendChild(summ);
  const body = el("div", "compaction-body");
  body.textContent = t("Summarizing conversation…");
  det.appendChild(body);
  row.appendChild(det);
  messagesInner.appendChild(row);
  pendingCompactionBlockRef = row;
  scheduleScroll();
}

export function setBtwStatus(text: string | null) {
  if (text) {
    setStatus(text);
    setBtwStatusActive(true);
  } else if (btwStatusActive) {
    setStatus("");
    setBtwStatusActive(false);
  }
}

export function setBtwLoading(b: boolean) {
  state.isBtwLoading = b;
  if (!b) setBtwAbortId(null);
  updateSendButton();
}

export function addBtwPlaceholder(question: string, model?: string) {
  const empty = messagesInner.querySelector(".empty");
  if (empty) empty.remove();
  const row = el("div", "msg btw");
  const det = document.createElement("details");
  det.className = "btw-block";
  det.setAttribute("open", "");
  const summ = document.createElement("summary");
  const label = el("span", "btw-label");
  label.textContent = t("[btw]");
  summ.appendChild(label);
  const q = el("span", "btw-q");
  q.textContent = question || "";
  q.title = question || "";
  summ.appendChild(q);
  const spin = el("span", "tool-status is-running");
  summ.appendChild(spin);
  det.appendChild(summ);
  const body = el("div", "btw-body btw-loading-text");
  body.textContent = t("Answering") + (model ? " " + t("with {0}", model) : "") + "\u2026";
  det.appendChild(body);
  row.appendChild(det);
  messagesInner.appendChild(row);
  pendingBtwBlockRef = row;
  setBtwStatus(t("Answering /btw") + (model ? " " + t("with {0}", model) : "") + "\u2026");
  scheduleScroll();
}

export function showBtwResult(question: string, answer: string) {
  if (!pendingBtwBlockRef) addBtwPlaceholder(question, "");
  const det = pendingBtwBlockRef ? pendingBtwBlockRef.querySelector(".btw-block") : null;
  if (det) {
    const spin = det.querySelector(".tool-status.is-running");
    if (spin) spin.remove();
    const body = det.querySelector(".btw-body");
    if (body) {
      body.classList.remove("btw-loading-text");
      body.classList.add("text-block");
      renderMarkdown(body as HTMLElement, answer || "");
    }
  }
  pendingBtwBlockRef = null;
  setBtwLoading(false);
  setBtwStatus(null);
  scheduleScroll();
}

export function clearBtw() {
  if (pendingBtwBlockRef) {
    pendingBtwBlockRef.remove();
    pendingBtwBlockRef = null;
  }
  setBtwLoading(false);
  setBtwStatus(null);
}

export function showBtwError(message: string) {
  if (pendingBtwBlockRef) {
    pendingBtwBlockRef.remove();
    pendingBtwBlockRef = null;
  }
  setBtwLoading(false);
  setBtwStatus(null);
  const eb = el("div", "error-banner");
  eb.textContent = message || t("Error");
  messagesInner.appendChild(eb);
  scrollToBottom();
}

export function handleBtw(lines: string[]) {
  let payload: any = {};
  if (lines && lines.length) {
    try {
      payload = JSON.parse(lines[0] || "{}");
    } catch {
      /* ignore */
    }
  }
  if (!payload || !payload.phase) {
    clearBtw();
    return;
  }
  if (payload.phase === "loading") addBtwPlaceholder(payload.question || "", payload.model || "");
  else if (payload.phase === "result") showBtwResult(payload.question || "", payload.answer || "");
  else if (payload.phase === "error") showBtwError(payload.message || "");
  else clearBtw();
}

export function startAssistantMessage(ts?: number) {
  const empty = messagesInner.querySelector(".empty");
  if (empty) empty.remove();
  const row = el("div", "msg assistant");
  messagesInner.appendChild(row);
  (row as any)._piTs = ts != null ? ts : null;
  setCurrentAssistant({
    el: row,
    blocks: [],
    ts: ts != null ? ts : null,
    model: "",
    timeEl: null,
  });
  scheduleScroll();
}

function collapseThinking() {
  if (!currentAssistant) return;
  for (let i = 0; i < currentAssistant.blocks.length; i++) {
    const b = currentAssistant.blocks[i];
    if (b && b.type === "thinking") {
      b.el.classList.remove("is-running");
      if (!b.el._userToggled) b.el.removeAttribute("open");
    }
  }
}

export function endAssistantMessage() {
  collapseThinking();
  finalizeTextBlocks();
  if (currentAssistant) {
    (currentAssistant.el as any)._piModel = currentAssistant.model || "";
    (currentAssistant.el as any)._piTimeEl = currentAssistant.timeEl || null;
    (currentAssistant.el as any)._piHasToolCall = assistantHasToolCalls();
    setCurrentAssistant(null);
  }
  applyLastAssistantModel();
}

export function applyLastAssistantModel() {
  const rows = messagesInner.querySelectorAll(".msg.assistant");
  for (let j = 0; j < rows.length; j++) {
    const rr = rows[j] as HTMLElement;
    if (!(rr as any)._piTimeEl) continue;
    const ts = (rr as any)._piTs != null ? (rr as any)._piTs : null;
    const timeStr = ts != null ? formatTime(ts) : "";
    if (!(rr as any)._piHasToolCall && (rr as any)._piModel) {
      const icon = getModelIcon((rr as any)._piModel);
      (rr as any)._piTimeEl.innerHTML =
        modelIconHtml(icon) + " " + escHtml((rr as any)._piModel) + " \u00b7 " + timeStr;
    } else {
      (rr as any)._piTimeEl.textContent = timeStr;
    }
  }
}

export function assistantHasToolCalls(): boolean {
  if (!currentAssistant) return false;
  for (let i = 0; i < currentAssistant.blocks.length; i++) {
    const b = currentAssistant.blocks[i];
    if (b && b.type === "toolcall") return true;
  }
  return false;
}

export function markAssistantToolErrors(text: string) {
  if (!currentAssistant) return;
  for (let i = 0; i < currentAssistant.blocks.length; i++) {
    const b = currentAssistant.blocks[i];
    if (b && b.type === "toolcall") {
      if (b.resultEl) setClamped(b.resultEl, text);
      b.el.classList.add("is-error");
      if (b.statusEl) {
        b.statusEl.textContent = "";
        b.statusEl.classList.remove("is-running");
      }
    }
  }
}

export function appendAssistantError(text: string) {
  if (!currentAssistant) return;
  const div = el("div", "msg-error");
  div.textContent = text;
  currentAssistant.el.appendChild(div);
  scheduleScroll();
}

export function applyAssistantStopError(
  stopReason: string,
  errorMessage: string,
  retryCount: number,
) {
  if (stopReason === "length") {
    appendAssistantError(
      t(
        "Error: Model stopped because it reached the maximum output token limit. The response may be incomplete.",
      ),
    );
  } else if (stopReason === "error") {
    const em = errorMessage || t("Unknown error");
    if (assistantHasToolCalls()) markAssistantToolErrors(em);
    else appendAssistantError(t("Error: {0}", em));
  } else if (stopReason === "aborted") {
    const am =
      retryCount > 0
        ? t("Aborted after {0} retry attempt{1}", retryCount, retryCount > 1 ? "s" : "")
        : t("Operation aborted");
    if (assistantHasToolCalls()) markAssistantToolErrors(am);
    else appendAssistantError(am);
  }
}

export function ensureBlock(ci: number, type: string): any {
  if (!currentAssistant) startAssistantMessage();
  const blocks = currentAssistant.blocks;
  while (blocks.length <= ci) blocks.push(null);
  let b = blocks[ci];
  if (b && b.type === type) return b;
  b = createBlock(type);
  blocks[ci] = b;
  currentAssistant.el.appendChild(b.el);
  if (b.timeEl) {
    if (currentAssistant.ts != null) b.timeEl.textContent = formatTime(currentAssistant.ts);
    currentAssistant.el.appendChild(b.timeEl);
    currentAssistant.timeEl = b.timeEl;
  }
  return b;
}

export function createBlock(type: string): any {
  if (type === "text") {
    const t = el("div", "text-block");
    const ttime = el("span", "msg-time");
    return { type: "text", el: t, text: "", textEl: t, timeEl: ttime };
  }
  if (type === "thinking") {
    const det = document.createElement("details");
    det.className = "thinking-block";
    det.setAttribute("open", "");
    const tSumm = document.createElement("summary");
    const tLabel = el("span", "thinking-label");
    tLabel.textContent = t("Thinking");
    tSumm.appendChild(tLabel);
    det.appendChild(tSumm);
    const body = el("div", "thinking-body");
    det.appendChild(body);
    tSumm.addEventListener("click", function () {
      (det as any)._userToggled = true;
    });
    return { type: "thinking", el: det, text: "", textEl: body };
  }
  // toolcall
  const wrap = document.createElement("details");
  wrap.className = "tool-block";
  const head = document.createElement("summary");
  head.className = "tool-head";
  const name = el("span", "tool-name");
  name.textContent = t("tool");
  const summary = el("span", "tool-summary");
  const st = el("span", "tool-status");
  head.appendChild(name);
  head.appendChild(summary);
  head.appendChild(st);
  const argsPre = el("pre", "tool-args");
  const resultPre = el("pre", "tool-result");
  wrap.appendChild(head);
  wrap.appendChild(argsPre);
  wrap.appendChild(resultPre);
  const b: any = {
    type: "toolcall",
    el: wrap,
    nameEl: name,
    summaryEl: summary,
    statusEl: st,
    argsEl: argsPre,
    resultEl: resultPre,
    toolCallId: null,
    name: "tool",
    argsText: "",
    filePath: null,
    fileLine: null,
  };
  head.addEventListener("click", function (ev: MouseEvent) {
    (wrap as any)._userToggled = true;
    if ((ev.ctrlKey || ev.metaKey) && b.filePath) {
      ev.preventDefault();
      ev.stopPropagation();
      vscode.postMessage({
        type: "openFile",
        filePath: b.filePath,
        line: b.fileLine != null ? b.fileLine : null,
      });
    }
  });
  return b;
}

export function renderMarkdown(target: HTMLElement, text: string): void {
  (target as any)._piMd = text;
  try {
    target.innerHTML = md.render(text);
  } catch {
    target.textContent = text;
  }
}

export function applyTextCollapsible(b: any): void {
  const textEl = b.textEl;
  if (!textEl || !textEl.parentNode) return;
  if (textEl._expandBtn) {
    textEl._expandBtn.remove();
    textEl._expandBtn = null;
  }
  textEl.classList.remove("is-collapsible");
  textEl.classList.remove("is-expanded");
  if (textEl.scrollHeight <= 360) return;
  textEl.classList.add("is-collapsible");
  const btn = el("button", "expand-btn");
  btn.type = "button";
  btn.textContent = t("Show more");
  btn.addEventListener("click", function () {
    const expanded = textEl.classList.toggle("is-expanded");
    btn.textContent = expanded ? t("Show less") : t("Show more");
  });
  const host = b.el ? b.el.parentNode : textEl.parentNode;
  const ref = b.el ? b.el.nextSibling : textEl.nextSibling;
  host!.insertBefore(btn, ref);
  textEl._expandBtn = btn;
}

const MAX_INLINE = 12000;

export function setClamped(preEl: HTMLElement, text: string): void {
  text = typeof text === "string" ? text : "";
  if (text.length > MAX_INLINE) {
    preEl.textContent =
      text.slice(0, MAX_INLINE) + t(" ... (truncated, {0} more chars)", text.length - MAX_INLINE);
  } else {
    preEl.textContent = text;
  }
}

export function extractToolResultText(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    let t = "";
    for (let i = 0; i < content.length; i++) {
      const c = content[i];
      t += typeof c === "string" ? c : c && c.text ? c.text : "";
    }
    return t;
  }
  return "";
}

export function appendToolResultImages(resultEl: HTMLElement, content: any) {
  if (!Array.isArray(content) || !resultEl) return;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c && c.type === "image" && c.data && c.mimeType) {
      const img = document.createElement("img");
      img.src = "data:" + c.mimeType + ";base64," + c.data;
      resultEl.appendChild(img);
    }
  }
}

function parseDiffLine(line: string): any {
  if (typeof line !== "string" || line.length === 0) return null;
  const prefix = line.charAt(0);
  if (prefix !== "+" && prefix !== "-" && prefix !== " ") return null;
  const rest = line.slice(1);
  let i = 0;
  while (i < rest.length) {
    const cc = rest.charCodeAt(i);
    if (cc === 32 || (cc >= 48 && cc <= 57)) i++;
    else break;
  }
  const lineNum = rest.slice(0, i);
  let content = rest.slice(i);
  if (content.charAt(0) === " ") content = content.slice(1);
  return { prefix, lineNum, content };
}

export function renderToolDiff(resultEl: HTMLElement, diffText: string) {
  if (!resultEl) return;
  (resultEl as any)._piMd = null;
  resultEl.textContent = "";
  const lines = String(diffText || "").split("\n");
  const wrap = el("div", "diff-block");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parsed = parseDiffLine(line);
    const row = el("div", "diff-line");
    const sign = el("span", "diff-sign");
    const gutter = el("span", "diff-gutter");
    const content = el("span", "diff-content");
    if (!parsed) {
      row.classList.add("context");
      sign.textContent = " ";
      gutter.textContent = "";
      content.textContent = line;
    } else if (parsed.prefix === "+") {
      row.classList.add("added");
      sign.textContent = "+";
      gutter.textContent = parsed.lineNum.trim();
      content.textContent = parsed.content;
    } else if (parsed.prefix === "-") {
      row.classList.add("removed");
      sign.textContent = "-";
      gutter.textContent = parsed.lineNum.trim();
      content.textContent = parsed.content;
    } else if (parsed.content === "..." && parsed.lineNum.trim() === "") {
      row.classList.add("hunk");
      sign.textContent = " ";
      gutter.textContent = "";
      content.textContent = "...";
    } else {
      row.classList.add("context");
      sign.textContent = " ";
      gutter.textContent = parsed.lineNum.trim();
      content.textContent = parsed.content;
    }
    row.appendChild(sign);
    row.appendChild(gutter);
    row.appendChild(content);
    wrap.appendChild(row);
  }
  resultEl.appendChild(wrap);
}

export function renderWriteContent(argsEl: HTMLElement, args: any) {
  if (!argsEl) return;
  (argsEl as any)._piMd = null;
  argsEl.textContent = "";
  let parsed = args;
  if (typeof args === "string") {
    try {
      parsed = JSON.parse(args);
    } catch {
      parsed = null;
    }
  }
  const content = parsed && typeof parsed.content === "string" ? parsed.content : "";
  if (!content) return;
  const lines = content.split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  if (!lines.length) return;
  const wrap = el("div", "code-block");
  const width = String(lines.length).length;
  for (let i = 0; i < lines.length; i++) {
    let numStr = String(i + 1);
    while (numStr.length < width) numStr = " " + numStr;
    const row = el("div", "code-line");
    const gutter = el("span", "code-gutter");
    gutter.textContent = numStr;
    const code = el("span", "code-content");
    code.textContent = lines[i];
    row.appendChild(gutter);
    row.appendChild(code);
    wrap.appendChild(row);
  }
  argsEl.appendChild(wrap);
}

export function appendTextDelta(ci: number, delta: string) {
  const b = ensureBlock(ci, "text");
  b.text += delta;
  if (b.finalized) {
    renderMarkdown(b.textEl, b.text);
    applyTextCollapsible(b);
    scheduleScroll();
    return;
  }
  if (!b._pending) {
    b._pending = true;
    pendingTexts.push(b);
  }
  if (!b._tnode) {
    b.textEl.textContent = "";
    b._tnode = document.createTextNode("");
    b.textEl.appendChild(b._tnode);
    b.textEl.classList.add("is-streaming");
  }
  b._tnode.appendData(delta);
  scheduleScroll();
}

export function appendThinkingDelta(ci: number, delta: string) {
  const b = ensureBlock(ci, "thinking");
  b.el.classList.add("is-running");
  b.text += delta;
  if (!b._tnode) {
    b.textEl.textContent = "";
    b._tnode = document.createTextNode("");
    b.textEl.appendChild(b._tnode);
  }
  b._tnode.appendData(delta);
  scheduleScroll();
}

export function appendToolCallDelta(ci: number, delta: string) {
  const b = ensureBlock(ci, "toolcall");
  b.argsText += delta;
  if (!b._anode) {
    b.argsEl.textContent = "";
    b._anode = document.createTextNode("");
    b.argsEl.appendChild(b._anode);
  }
  b._anode.appendData(delta);
  scheduleScroll();
}

export function toolStr(v: any): string {
  return typeof v === "string" ? v : "";
}

export function toolPathArg(args: any): string {
  const p = args.file_path != null ? args.file_path : args.path;
  return typeof p === "string" ? p : "";
}

export function formatReadRange(args: any): string {
  if (args.offset === undefined && args.limit === undefined) return "";
  const startLine = args.offset != null ? args.offset : 1;
  const endLine = args.limit != null ? startLine + args.limit - 1 : "";
  return ":" + startLine + (endLine !== "" ? "-" + endLine : "");
}

export function isMcpTool(name: string): boolean {
  return name.startsWith("mcp__") || name.startsWith("mcp_tool_");
}

export function toolDisplayName(name: string): string {
  if (name.startsWith("mcp__")) {
    const rest = name.slice(5);
    const idx = rest.indexOf("__");
    if (idx > 0) return `${rest.slice(0, idx)}/${rest.slice(idx + 2)}`;
  }
  return name;
}

function mcpHandleParts(handle: string): { server: string; tool: string } {
  const idx = handle.indexOf("_");
  if (idx <= 0) return { server: "", tool: handle };
  return { server: handle.slice(0, idx), tool: handle.slice(idx + 1) };
}

function mcpArgsPreview(args: any): string {
  if (!args || typeof args !== "object") return "";
  try {
    const j = JSON.stringify(args);
    return j.length > 80 ? j.slice(0, 80) + "\u2026" : j;
  } catch {
    return "";
  }
}

export function formatToolSummary(name: string, args: any): string {
  if (!args || typeof args !== "object") return "";
  let s = "";
  if (name === "bash") {
    let cmd = toolStr(args.command);
    if (cmd.length > 80) cmd = cmd.slice(0, 80) + "\u2026";
    s = cmd || "...";
    if (args.timeout) s += t(" (timeout {0}s)", args.timeout);
  } else if (name === "read") {
    s = shortenToolPath(toolPathArg(args)) || "...";
    const rng = formatReadRange(args);
    if (rng) s += rng;
  } else if (name === "write" || name === "edit") {
    s = shortenToolPath(toolPathArg(args)) || "...";
  } else if (name === "ls") {
    s = shortenToolPath(toolStr(args.path) || ".");
    if (args.limit != null) s += t(" (limit {0})", args.limit);
  } else if (name === "find") {
    s = toolStr(args.pattern) + " " + t("in") + " " + shortenToolPath(toolStr(args.path) || ".");
    if (args.limit != null) s += t(" (limit {0})", args.limit);
  } else if (name === "grep") {
    s =
      "/" +
      toolStr(args.pattern) +
      "/ " +
      t("in") +
      " " +
      shortenToolPath(toolStr(args.path) || ".");
    if (args.glob) s += " (" + toolStr(args.glob) + ")";
    if (args.limit != null) s += " " + t("limit {0}", args.limit);
  } else if (name === "todo") {
    s = toolStr(args.action) || "...";
  } else if (name === "subagent") {
    if (args && args.tasks && args.tasks.length) {
      s =
        t("parallel") +
        " \u00b7 " +
        args.tasks.length +
        (args.tasks.length > 1 ? " " + t("tasks") : " " + t("task"));
    } else if (args && args.agent) {
      s = args.agent;
      let ttl = args.title ? String(args.title) : "";
      if (!ttl && args.task)
        ttl = args.task.length > 60 ? args.task.slice(0, 60) + "\u2026" : args.task;
      if (ttl) s += " \u00b7 " + ttl;
    } else {
      s = t("subagent");
    }
  } else if (name.startsWith("mcp__")) {
    s = mcpArgsPreview(args);
  } else if (name === "mcp_tool_call") {
    const h = toolStr(args && args.tool);
    if (h) {
      const parts = mcpHandleParts(h);
      s = parts.server ? `${parts.server}/${parts.tool}` : h;
    } else {
      s = "...";
    }
  } else if (name === "mcp_tool_search") {
    const q = toolStr(args && args.query);
    s = q ? `"${q}"` : "...";
    const opts: string[] = [];
    if (args && args.limit != null) opts.push(t("limit {0}", args.limit));
    if (args && args.offset != null) opts.push(t("offset {0}", args.offset));
    if (opts.length) s += ` (${opts.join(", ")})`;
  }
  return s;
}

export function expandHomePath(p: string): string {
  if (typeof p !== "string" || !p) return "";
  if (p.charAt(0) === "~" && (p.length === 1 || p.charAt(1) === PI_SEP)) {
    return (PI_HOME || "") + p.slice(1);
  }
  return p;
}

export function applyToolFileTarget(b: any, name: string, args: any) {
  if (!b || !b.el) return;
  b.filePath = null;
  b.fileLine = null;
  b.el.removeAttribute("data-has-file");
  if (!args) return;
  let parsed = args;
  if (typeof args === "string") {
    try {
      parsed = JSON.parse(args);
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== "object") return;
  if (name !== "read" && name !== "write" && name !== "edit") return;
  let fp = parsed.file_path != null ? parsed.file_path : parsed.path;
  if (typeof fp !== "string" || !fp) return;
  fp = expandHomePath(fp);
  if (!fp) return;
  b.filePath = fp;
  if (name === "read" && parsed.offset != null) {
    const ln = parseInt(parsed.offset, 10);
    if (!isNaN(ln) && ln > 0) b.fileLine = ln;
  }
  b.el.setAttribute("data-has-file", "");
}

export function finalizeToolCall(ci: number, toolCall: any) {
  const b = ensureBlock(ci, "toolcall");
  b.el._block = b;
  if (toolCall) {
    if (toolCall.name) {
      b.name = toolCall.name;
      b.nameEl.textContent = toolDisplayName(b.name);
      b.el.classList.toggle("is-mcp", isMcpTool(b.name));
      if (b.name === "subagent") b.el.classList.add("is-subagent");
    }
    if (toolCall.id) {
      b.toolCallId = toolCall.id;
      b.el.setAttribute("data-tcid", toolCall.id);
    }
    const args = toolCall.arguments;
    if (args !== undefined && args !== null) {
      b.argsText = typeof args === "string" ? args : JSON.stringify(args, null, 2);
      b._anode = null;
      if (b.name === "write") {
        renderWriteContent(b.argsEl, args);
        let wparsed = args;
        if (typeof args === "string") {
          try {
            wparsed = JSON.parse(args);
          } catch {
            wparsed = null;
          }
        }
        const wcontent = wparsed && typeof wparsed.content === "string" ? wparsed.content : "";
        if (wcontent) {
          const wlines = wcontent.split("\n");
          while (wlines.length && wlines[wlines.length - 1] === "") wlines.pop();
          b._writeLineCount = wlines.length;
        }
      } else if (b.name === "subagent") b.argsEl.textContent = "";
      else setClamped(b.argsEl, b.argsText);
    }
    applyToolSummary(b, b.name, args);
    applyToolFileTarget(b, b.name, args);
  }
}

function applyToolSummary(b: any, name: string, args: any) {
  if (!b || !b.summaryEl) return;
  let parsed = args;
  if (typeof args === "string") {
    try {
      parsed = JSON.parse(args);
    } catch {
      parsed = null;
    }
  }
  b.summaryEl.textContent = formatToolSummary(name || b.name || "", parsed);
}

export function findToolBlock(toolCallId: string): any {
  const children = messagesInner.querySelectorAll(
    '.tool-block[data-tcid="' + cssEscape(toolCallId) + '"]',
  );
  if (children.length) {
    for (let i = 0; i < children.length; i++) {
      const c = children[i] as HTMLElement;
      if ((c as any)._block) return (c as any)._block;
      const nameElRef = c.querySelector(".tool-name");
      return {
        el: c,
        nameEl: nameElRef,
        summaryEl: c.querySelector(".tool-summary"),
        statusEl: c.querySelector(".tool-status"),
        argsEl: c.querySelector(".tool-args"),
        resultEl: c.querySelector(".tool-result"),
        name: (nameElRef && nameElRef.textContent) || "",
      };
    }
  }
  if (currentAssistant) {
    for (let j = 0; j < currentAssistant.blocks.length; j++) {
      const bb = currentAssistant.blocks[j];
      if (bb && bb.type === "toolcall" && bb.toolCallId === toolCallId) return bb;
    }
  }
  return null;
}

function cssEscape(s: string): string {
  return String(s).replace(/["\\]/g, "\\$&");
}

export function startToolExecution(ev: any) {
  const tcid = ev.toolCallId;
  let b = findToolBlock(tcid);
  if (!b) {
    startAssistantMessage();
    b = ensureBlock(0, "toolcall");
    b.toolCallId = tcid;
    b.el.setAttribute("data-tcid", tcid);
  }
  if (ev.toolName) {
    b.name = ev.toolName;
    if (b.nameEl) b.nameEl.textContent = toolDisplayName(b.name);
    if (b.nameEl) b.el.classList.toggle("is-mcp", isMcpTool(b.name));
    if (b.name === "subagent") b.el.classList.add("is-subagent");
  }
  b.el._block = b;
  if (b.statusEl) {
    b.statusEl.textContent = "";
    b.statusEl.classList.add("is-running");
  }
  if (ev.args !== undefined && ev.args !== null && b.argsEl && !b.argsText) {
    b.argsText = typeof ev.args === "string" ? ev.args : JSON.stringify(ev.args, null, 2);
    b._anode = null;
    if (b.name !== "subagent") setClamped(b.argsEl, b.argsText);
  }
  applyToolSummary(b, b.name, ev.args);
  applyToolFileTarget(b, b.name, ev.args);
  if (b.name === "subagent" && !b.el._userToggled) b.el.setAttribute("open", "");
  scheduleScroll();
}

export function updateToolExecution(ev: any) {
  const b = findToolBlock(ev.toolCallId);
  if (!b || !b.resultEl) return;
  const pr = ev.partialResult;
  if (!pr) return;
  if (b.name === "subagent" && pr.details) {
    renderSubagentResult(b, pr.details);
    if (!b.el._userToggled) b.el.setAttribute("open", "");
    scheduleScroll();
    return;
  }
  if (pr.content) {
    const txt = extractToolResultText(pr.content);
    if (txt) setClamped(b.resultEl, txt);
    else b.resultEl.textContent = "";
    appendToolResultImages(b.resultEl, pr.content);
  }
}

export function endToolExecution(ev: any) {
  const b = findToolBlock(ev.toolCallId);
  if (!b) return;
  if (b.statusEl) {
    b.statusEl.textContent = "";
    b.statusEl.classList.remove("is-running");
  }
  if (ev.isError) b.el.classList.add("is-error");
  const r = ev.result;
  if (b.name === "subagent" && r && r.details) {
    renderSubagentResult(b, r.details);
    if (!ev.isError && subagentDetailsHasError(r.details)) {
      if (b.statusEl) {
        b.statusEl.textContent = "";
        b.statusEl.classList.remove("is-running");
      }
      b.el.classList.add("is-error");
    }
    if (!b.el._userToggled) b.el.removeAttribute("open");
    scheduleScroll();
    return;
  }
  if (b.name === "edit" && !ev.isError && r && r.details && typeof r.details.diff === "string") {
    b.el.classList.add("is-diff");
    renderToolDiff(b.resultEl, r.details.diff);
    const diffLines = r.details.diff.split("\n");
    let added = 0,
      removed = 0;
    for (let di = 0; di < diffLines.length; di++) {
      const ch = diffLines[di].charAt(0);
      if (ch === "+" && diffLines[di].charAt(1) !== "+") added++;
      else if (ch === "-" && diffLines[di].charAt(1) !== "-") removed++;
    }
    b.el.setAttribute("data-added", String(added));
    b.el.setAttribute("data-removed", String(removed));
    if (b.summaryEl && (added > 0 || removed > 0)) {
      let sumHtml = b.summaryEl.textContent;
      if (added > 0)
        sumHtml +=
          ' <span style="color:var(--vscode-gitDecoration-addedResourceForeground, #73c991)">+' +
          added +
          "</span>";
      if (removed > 0)
        sumHtml +=
          ' <span style="color:var(--vscode-gitDecoration-deletedResourceForeground, #f48771)">-' +
          removed +
          "</span>";
      b.summaryEl.innerHTML = sumHtml;
    }
    scheduleScroll();
    return;
  }
  if (b.name === "read" && !ev.isError) {
    if (b.argsEl) b.argsEl.style.display = "none";
  }
  if (b.name === "write" && !ev.isError) {
    if (b.resultEl) {
      (b.resultEl as any)._piMd = null;
      b.resultEl.textContent = "";
    }
    b.el.setAttribute("data-added", String(b._writeLineCount || 0));
    if (b._writeLineCount > 0 && b.summaryEl) {
      b.summaryEl.innerHTML =
        b.summaryEl.textContent +
        ' <span style="color:var(--vscode-gitDecoration-addedResourceForeground, #73c991)">+' +
        b._writeLineCount +
        "</span>";
    }
    if (!b.el._userToggled) b.el.removeAttribute("open");
    scheduleScroll();
    return;
  }
  b.el.classList.remove("is-diff");
  if (r && r.content && b.resultEl) {
    const txt = extractToolResultText(r.content);
    if (txt) setClamped(b.resultEl, txt);
    else b.resultEl.textContent = "";
    appendToolResultImages(b.resultEl, r.content);
  }
  if (!b.el._userToggled) b.el.removeAttribute("open");
  scheduleScroll();
}

// ---- subagent rendering ----
export function getDisplayItems(messages: any[]): any[] {
  const items: any[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      const content = msg.content;
      if (Array.isArray(content)) {
        for (let j = 0; j < content.length; j++) {
          const part = content[j];
          if (part.type === "text") items.push({ type: "text", text: part.text });
          else if (part.type === "toolCall")
            items.push({ type: "toolCall", name: part.name, args: part.arguments });
        }
      }
    }
  }
  return items;
}

export function getFinalOutput(messages: any[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      const content = msg.content;
      if (Array.isArray(content)) {
        for (let j = 0; j < content.length; j++) {
          const part = content[j];
          if (part.type === "text") return part.text;
        }
      }
    }
  }
  return "";
}

export function formatUsage(usage: any, model?: string): string {
  if (!usage) return "";
  const parts: string[] = [];
  if (usage.turns) parts.push(usage.turns + " turn" + (usage.turns > 1 ? "s" : ""));
  if (usage.input) parts.push("\u2191" + formatTokens(usage.input));
  if (usage.output) parts.push("\u2193" + formatTokens(usage.output));
  if (usage.cacheRead) parts.push("R" + formatTokens(usage.cacheRead));
  if (usage.cacheWrite) parts.push("W" + formatTokens(usage.cacheWrite));
  if (usage.cost) parts.push("$" + usage.cost.toFixed(4));
  if (usage.contextTokens) parts.push("ctx:" + formatTokens(usage.contextTokens));
  if (model) parts.push(model);
  return parts.join(" ");
}

export function computeCacheHitPct(usage: any): number | null {
  if (!usage) return null;
  const cr = usage.cacheRead || 0;
  const cw = usage.cacheWrite || 0;
  if (cr <= 0 && cw <= 0) return null;
  const prompt = (usage.input || 0) + cr + cw;
  if (prompt <= 0) return null;
  return (cr / prompt) * 100;
}

export function promptTokensOf(usage: any): number {
  if (!usage) return 0;
  return (usage.input || 0) + (usage.cacheRead || 0) + (usage.cacheWrite || 0);
}

export function cacheReadPricePerM(): number | null {
  const cost = state.model && state.model.cost;
  if (cost && typeof cost.cacheRead === "number") return cost.cacheRead;
  return null;
}

export function detectCacheMiss(usage: any, modelId: string, ts: number): any {
  if (!prevTurn || !usage) return null;
  if (typeof ts === "number" && ts === prevTurn.ts) return null;
  const promptTokens = (usage.input || 0) + (usage.cacheRead || 0) + (usage.cacheWrite || 0);
  if (promptTokens <= 0) return null;
  if (usage.cacheRead + usage.cacheWrite === 0 && !prevTurn.reportedCache) return null;
  const missedTokens = Math.min(prevTurn.promptTokens, promptTokens) - (usage.cacheRead || 0);
  if (missedTokens <= 1024) return null;
  const cost = usage.cost && typeof usage.cost === "object" ? usage.cost : null;
  const paidTokens = (usage.input || 0) + (usage.cacheWrite || 0);
  const paidPerToken =
    cost && paidTokens > 0 ? ((cost.input || 0) + (cost.cacheWrite || 0)) / paidTokens : 0;
  let readPerToken: number;
  if ((usage.cacheRead || 0) > 0 && cost) {
    readPerToken = (cost.cacheRead || 0) / usage.cacheRead;
  } else {
    const price = cacheReadPricePerM();
    readPerToken = price != null && price > 0 ? price / 1000000 : 0;
  }
  const missedCost = missedTokens * Math.max(0, paidPerToken - readPerToken);
  const showByTokens = missedTokens >= 20000;
  const showByCost = missedCost >= 0.1;
  if (!showByTokens && !showByCost) return null;
  const idleMs = typeof ts === "number" && typeof prevTurn.ts === "number" ? ts - prevTurn.ts : 0;
  const modelChanged = !!modelId && !!prevTurn.modelId && modelId !== prevTurn.modelId;
  let label: string;
  if (modelChanged) label = t("Cache miss after model switch");
  else if (idleMs >= 300000) label = t("Cache miss after {0}m idle", Math.round(idleMs / 60000));
  else label = t("Cache miss");
  return { label, missedTokens, missedCost };
}

export function recordCacheUsage(usage: any, modelId: string, ts: number) {
  const pct = computeCacheHitPct(usage);
  setLatestCacheHitPct(pct);
  rebuildCtxRingTooltip();
  if (!usage) {
    setPrevTurn(null);
    return;
  }
  if (prevTurn && (typeof ts !== "number" || ts !== prevTurn.ts)) {
    const miss = detectCacheMiss(usage, modelId, ts);
    if (miss) {
      const costStr = miss.missedCost >= 0.01 ? " (~$" + miss.missedCost.toFixed(2) + ")" : "";
      showToast(
        "\u26a0 " +
          miss.label +
          " \u00b7 " +
          formatTokens(miss.missedTokens) +
          " " +
          t("tokens re-billed") +
          costStr,
        "warning",
      );
    }
  }
  setPrevTurn({
    promptTokens: promptTokensOf(usage),
    modelId: modelId || "",
    ts: typeof ts === "number" ? ts : Date.now(),
    reportedCache: !!(prevTurn && prevTurn.reportedCache) || usage.cacheRead + usage.cacheWrite > 0,
  });
}

export function seedCacheBaseline(list: any[]) {
  if (!list || !list.length) return;
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (!m || m.role !== "assistant" || !m.usage || m.stopReason === "error") continue;
    const u = m.usage;
    if (!u.input && !u.output && !u.cacheRead && !u.cacheWrite) continue;
    const pct = computeCacheHitPct(u);
    setLatestCacheHitPct(pct);
    setPrevTurn({
      promptTokens: promptTokensOf(u),
      modelId: state.model ? state.model.provider + "/" + state.model.id : "",
      ts: typeof m.timestamp === "number" ? m.timestamp : Date.now(),
      reportedCache: u.cacheRead + u.cacheWrite > 0,
    });
    rebuildCtxRingTooltip();
    break;
  }
}

export function aggregateUsage(results: any[]): any {
  const total: any = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cost: 0,
    contextTokens: 0,
    turns: 0,
  };
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    total.input += r.usage.input;
    total.output += r.usage.output;
    total.cacheRead += r.usage.cacheRead;
    total.cacheWrite += r.usage.cacheWrite;
    total.cost += r.usage.cost;
    total.turns += r.usage.turns;
  }
  return total;
}

export function subagentDetailsHasError(details: any): boolean {
  if (!details || !details.results) return false;
  for (let i = 0; i < details.results.length; i++) {
    const r = details.results[i];
    if (!r) continue;
    if (r.errorMessage) return true;
    if (typeof r.exitCode === "number" && r.exitCode !== -1 && r.exitCode !== 0) return true;
  }
  return false;
}

export function isFailedSubagent(r: any): boolean {
  if (!r) return false;
  if (r.exitCode === -1) return false;
  return r.exitCode !== 0 || r.stopReason === "error" || r.stopReason === "aborted";
}

export function subagentTitle(r: any): string {
  if (r && r.title) return String(r.title);
  if (r && r.task) return r.task.length > 60 ? r.task.slice(0, 60) + "\u2026" : r.task;
  return "";
}

function renderSubMd(target: HTMLElement, text: string) {
  (target as any)._piMd = text;
  try {
    target.innerHTML = md.render(text);
  } catch {
    target.textContent = text;
  }
}

function renderAgentBody(parent: HTMLElement, r: any): string {
  const failed = isFailedSubagent(r);
  const usageStr = formatUsage(r.usage, r.model);
  if (usageStr) {
    const uDiv = el("div", "sub-usage");
    const usageStats = formatUsage(r.usage, undefined);
    if (usageStats)
      uDiv.appendChild(document.createTextNode(usageStats + (r.model ? " \u00b7 " : "")));
    if (r.model) {
      const mSpan = el("span", "sub-usage-model");
      mSpan.textContent = r.model;
      uDiv.appendChild(mSpan);
    }
    parent.appendChild(uDiv);
  }
  if (r && r.task) {
    const tLabel = el("div", "sub-section-label");
    tLabel.textContent = t("Task");
    parent.appendChild(tLabel);
    const tBody = el("div", "sub-task-text sub-md text-block");
    renderSubMd(tBody, r.task);
    parent.appendChild(tBody);
  }
  const items = getDisplayItems(r.messages || []);
  const callItems: any[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].type === "toolCall") callItems.push(items[i]);
  }
  const hasCalls = callItems.length > 0;
  if (hasCalls) {
    const sLabel = el("div", "sub-section-label");
    sLabel.textContent = t("Steps");
    parent.appendChild(sLabel);
    for (let i = 0; i < callItems.length; i++) {
      const cdiv = el("div", "sub-toolcall");
      const tcName = callItems[i].name || "";
      let tcSum = formatToolSummary(tcName, callItems[i].args);
      if (!tcSum) {
        const astr = JSON.stringify(callItems[i].args || {});
        tcSum = astr.length > 50 ? astr.slice(0, 50) + "\u2026" : astr;
      }
      cdiv.appendChild(document.createTextNode("\u2192 "));
      const tcNameSpan = el("span", "sub-toolcall-name");
      tcNameSpan.textContent = tcName;
      cdiv.appendChild(tcNameSpan);
      cdiv.appendChild(document.createTextNode(" " + tcSum));
      parent.appendChild(cdiv);
    }
  }
  if (failed && r.errorMessage) {
    const errDiv = el("div", "sub-error");
    errDiv.textContent = t("Error: {0}", r.errorMessage);
    parent.appendChild(errDiv);
  }
  const final = getFinalOutput(r.messages || []);
  if (final) {
    const fLabel = el("div", "sub-section-label");
    fLabel.textContent = t("Result");
    parent.appendChild(fLabel);
    const mdDiv = el("div", "sub-final sub-md text-block");
    renderSubMd(mdDiv, final.trim());
    parent.appendChild(mdDiv);
  } else if (!failed && !hasCalls && !(r && r.task)) {
    const empty = el("div", "sub-empty");
    empty.textContent = r && r.exitCode === -1 ? t("(running…)") : t("(no output)");
    parent.appendChild(empty);
  }
  return usageStr;
}

export function renderSubagentResult(b: any, details: any) {
  if (!b || !b.resultEl) return;
  (b.resultEl as any)._piMd = null;
  if (!details || !details.results || !details.results.length) return;
  const results = details.results;
  const wrap = el("div", "subagent-wrap");
  if (details.mode === "single" && results.length === 1) {
    const r = results[0];
    const body = el("div", "subagent-body");
    renderAgentBody(body, r);
    wrap.appendChild(body);
    if (b.summaryEl) {
      b.summaryEl.textContent = r.agent + (subagentTitle(r) ? " \u00b7 " + subagentTitle(r) : "");
    }
  } else if (details.mode === "parallel") {
    let running = 0,
      done = 0,
      fail = 0;
    for (let di = 0; di < results.length; di++) {
      if (results[di].exitCode === -1) running++;
      else {
        done++;
        if (isFailedSubagent(results[di])) fail++;
      }
    }
    const pic = running > 0 ? "\u23f3" : fail > 0 ? "\u25d0" : "\u2713";
    for (let ri = 0; ri < results.length; ri++) {
      const sr = results[ri];
      const sric = sr.exitCode === -1 ? "\u23f3" : sr.exitCode === 0 ? "\u2713" : "\u2717";
      const sdet = document.createElement("details");
      sdet.className = "sub-task";
      if (isFailedSubagent(sr)) sdet.classList.add("is-failed");
      if (sr.exitCode === -1) sdet.setAttribute("open", "");
      const shead = document.createElement("summary");
      shead.className = "sub-task-head";
      const sicon = el("span", "sub-task-icon");
      sicon.textContent = sric;
      const sname = el("span", "sub-task-agent");
      sname.textContent = sr.agent;
      shead.appendChild(sicon);
      shead.appendChild(sname);
      if (subagentTitle(sr)) {
        const stitle = el("span", "sub-task-title");
        stitle.textContent = " \u00b7 " + subagentTitle(sr);
        shead.appendChild(stitle);
      }
      const sstatus = el("span", "sub-task-status");
      sstatus.textContent =
        sr.exitCode === -1 ? t("running") : isFailedSubagent(sr) ? t("failed") : t("done");
      shead.appendChild(sstatus);
      sdet.appendChild(shead);
      const sbody = el("div", "sub-task-body");
      renderAgentBody(sbody, sr);
      sdet.appendChild(sbody);
      wrap.appendChild(sdet);
    }
    const tu = aggregateUsage(results);
    const tus = formatUsage(tu);
    if (tus) {
      const tud = el("div", "sub-total");
      tud.textContent = t("Total: {0}", tus);
      wrap.appendChild(tud);
    }
    if (b.summaryEl) {
      b.summaryEl.textContent =
        pic +
        " " +
        t("parallel") +
        " \u00b7 " +
        done +
        "/" +
        results.length +
        (running > 0
          ? " " + t("running")
          : fail > 0
            ? " (" + t("{0} failed", fail) + ")"
            : " " + t("done"));
    }
  } else {
    return;
  }
  b.resultEl.textContent = "";
  b.resultEl.appendChild(wrap);
}

// ---- hydration ----
export function hydrateMessages(list: any[]) {
  messagesInner.innerHTML = "";
  pendingCompactionBlockRef = null;
  pendingBtwBlockRef = null;
  setBtwAbortId(null);
  setBtwStatusActive(false);
  state.isBtwLoading = false;
  setCurrentAssistant(null);
  pendingTexts.length = 0;
  setPrevTurn(null);
  setLatestCacheHitPct(null);
  setSessionCost(null);
  if (!list || !list.length) {
    clearMessages();
    rebuildCtxRingTooltip();
    return;
  }
  setStatus(t("Loading history..."));
  let i = 0;
  const CHUNK = 8;
  function step() {
    const end = Math.min(i + CHUNK, list.length);
    for (; i < end; i++) hydrateOne(list[i]);
    if (i < list.length) requestAnimationFrame(step);
    else {
      setStatus("");
      scrollToBottom();
      seedCacheBaseline(list);
      wrapAllWorkSegments();
      applyLastAssistantModel();
    }
  }
  requestAnimationFrame(step);
}

function hydrateOne(m: any) {
  if (!m || typeof m !== "object") return;
  const role = m.role;
  if (role === "user") {
    const utext = extractText(m.content);
    pushHistory(utext);
    const ub = addUserMessage(utext, extractImages(m.content));
    if (m && m.timestamp != null) applyUserBubbleTime(ub, m.timestamp);
  } else if (role === "assistant") {
    startAssistantMessage(m.timestamp);
    currentAssistant.model = m.model || "";
    const content = m.content;
    if (Array.isArray(content)) {
      for (let k = 0; k < content.length; k++) {
        const blk = content[k];
        if (!blk || typeof blk !== "object") continue;
        if (blk.type === "text") {
          const tb = ensureBlock(k, "text");
          tb.text = blk.text || "";
          renderMarkdown(tb.textEl, tb.text);
          tb.finalized = true;
          applyTextCollapsible(tb);
        } else if (blk.type === "thinking") {
          const hb = ensureBlock(k, "thinking");
          hb.text = blk.thinking || "";
          hb.textEl.textContent = hb.text;
        } else if (blk.type === "toolCall") {
          finalizeToolCall(k, blk);
        }
      }
    }
    applyAssistantStopError(m.stopReason, m.errorMessage, 0);
    endAssistantMessage();
  } else if (role === "toolResult") {
    const evResult: any = { content: m.content };
    if (m.details) evResult.details = m.details;
    const fakeEv = { toolCallId: m.toolCallId, result: evResult, isError: !!m.isError };
    endToolExecution(fakeEv);
  } else if (role === "compactionSummary") {
    addCompactionMessage(m);
  }
}

export function extractText(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    let t = "";
    for (let i = 0; i < content.length; i++) {
      const c = content[i];
      t += typeof c === "string" ? c : c && c.text ? c.text : "";
    }
    return t;
  }
  return "";
}

export function extractImages(content: any): any[] {
  const imgs: any[] = [];
  if (Array.isArray(content)) {
    for (let i = 0; i < content.length; i++) {
      const c = content[i];
      if (c && c.type === "image" && c.data && c.mimeType)
        imgs.push({ type: "image", data: c.data, mimeType: c.mimeType });
    }
  }
  return imgs;
}

// ---- work segment wrapping ----
export function formatDuration(ms: number): string {
  if (typeof ms !== "number" || !isFinite(ms) || ms < 0) return "";
  const s = Math.round(ms / 1000);
  if (s < 1) return ms > 0 ? t("<1s") : t("0s");
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return t("{0}h {1}m {2}s", h, m, sec);
  if (m > 0) return t("{0}m {1}s", m, sec);
  return t("{0}s", sec);
}

export function formatWorkTitle(
  turns: number,
  startTs: number,
  endTs: number,
  added: number,
  removed: number,
): string {
  let w = turns + " " + (turns === 1 ? t("Turn") : t("Turns"));
  if (typeof startTs === "number" && typeof endTs === "number" && endTs >= startTs) {
    const d = formatDuration(endTs - startTs);
    if (d) w += "  \u00b7  " + t("Worked for {0}", d);
  }
  if (added > 0 || removed > 0) {
    w += "  \u00b7  ";
    if (added > 0)
      w +=
        '<span style="color:var(--vscode-gitDecoration-addedResourceForeground, #73c991)">+' +
        added +
        "</span>";
    if (added > 0 && removed > 0) w += " ";
    if (removed > 0)
      w +=
        '<span style="color:var(--vscode-gitDecoration-deletedResourceForeground, #f48771)">-' +
        removed +
        "</span>";
  }
  return w;
}

export function wrapWorkSegment(userRow: HTMLElement) {
  if (!userRow || !userRow.parentNode) return;
  const parent = userRow.parentNode;
  const first = userRow.nextElementSibling as HTMLElement;
  if (first && first.classList.contains("work-block")) return;
  const seg: HTMLElement[] = [];
  let node = first;
  while (node) {
    if (node.classList.contains("work-block")) break;
    if (node.classList.contains("msg") && node.classList.contains("user")) break;
    seg.push(node);
    node = node.nextElementSibling as HTMLElement;
  }
  if (!seg.length) return;
  const assistantRows: HTMLElement[] = [];
  for (let i = 0; i < seg.length; i++) {
    if (seg[i].classList.contains("msg") && seg[i].classList.contains("assistant"))
      assistantRows.push(seg[i]);
  }
  if (!assistantRows.length) return;
  const turns = assistantRows.length;
  const lastRow = assistantRows[assistantRows.length - 1];
  const endTs = (lastRow as any)._piTs;
  const ub = userRow.querySelector(".user-bubble") as HTMLElement;
  const startTs = ub && (ub as any)._piTs != null ? (ub as any)._piTs : null;
  let finalText: HTMLElement | null = null;
  const kids = lastRow.children;
  for (let k = kids.length - 1; k >= 0; k--) {
    if ((kids[k] as HTMLElement).classList.contains("text-block")) {
      finalText = kids[k] as HTMLElement;
      break;
    }
  }
  const keep: HTMLElement[] = [];
  if (finalText) {
    keep.push(finalText);
    let n1 = finalText.nextElementSibling as HTMLElement;
    if (n1 && n1.classList.contains("expand-btn")) {
      keep.push(n1);
      n1 = n1.nextElementSibling as HTMLElement;
    }
    if (n1 && n1.classList.contains("msg-time")) keep.push(n1);
  }
  let hasWork = false;
  for (let s = 0; s < seg.length; s++) {
    if (seg[s] !== lastRow) {
      hasWork = true;
      break;
    }
  }
  if (!hasWork && finalText) {
    const ch = lastRow.children;
    for (let c = 0; c < ch.length; c++) {
      if (keep.indexOf(ch[c] as HTMLElement) === -1) {
        hasWork = true;
        break;
      }
    }
  }
  if (!hasWork) return;
  let added = 0,
    removed = 0;
  for (let si = 0; si < seg.length; si++) {
    const tbs = seg[si].querySelectorAll(".tool-block");
    for (let ti = 0; ti < tbs.length; ti++) {
      const da = (tbs[ti] as HTMLElement).getAttribute("data-added");
      const dr = (tbs[ti] as HTMLElement).getAttribute("data-removed");
      if (da) added += parseInt(da, 10) || 0;
      if (dr) removed += parseInt(dr, 10) || 0;
    }
  }
  const det = document.createElement("details");
  det.className = "work-block";
  const summ = document.createElement("summary");
  summ.className = "work-head";
  summ.innerHTML = formatWorkTitle(turns, startTs, endTs, added, removed);
  det.appendChild(summ);
  const body = el("div", "work-body");
  det.appendChild(body);
  parent.insertBefore(det, seg[0]);
  for (let s2 = 0; s2 < seg.length; s2++) {
    const sr = seg[s2];
    if (finalText && sr === lastRow) {
      const children = Array.prototype.slice.call(sr.children);
      for (let c2 = 0; c2 < children.length; c2++) {
        if (keep.indexOf(children[c2] as HTMLElement) === -1)
          body.appendChild(children[c2] as HTMLElement);
      }
    } else {
      const srTime = sr.querySelector(":scope > .msg-time");
      if (srTime) srTime.remove();
      body.appendChild(sr);
    }
  }
  scheduleScroll();
}

export function wrapLastWorkSegment() {
  const rows = messagesInner.querySelectorAll(".msg.user");
  if (!rows.length) return;
  wrapWorkSegment(rows[rows.length - 1] as HTMLElement);
}

export function wrapAllWorkSegments() {
  const rows = messagesInner.querySelectorAll(".msg.user");
  const n = rows.length;
  for (let i = 0; i < n; i++) {
    if (i === n - 1 && state.isStreaming) continue;
    wrapWorkSegment(rows[i] as HTMLElement);
  }
}

// ---- history management (shared with composer.ts) ----
export function pushHistory(msg: string) {
  if (typeof msg !== "string" || !msg.trim()) return;
  const last = inputHistory.length ? inputHistory[inputHistory.length - 1] : "";
  if (last.trim() === msg.trim()) return;
  inputHistory.push(msg);
  if (inputHistory.length > 500) inputHistory.shift();
}

// ---- event dispatch ----
export function handleAssistantMessageEvent(amev: any) {
  if (!amev || typeof amev !== "object") return;
  const t = amev.type;
  const ci = amev.contentIndex || 0;
  if (t === "text_start") {
    collapseThinking();
    ensureBlock(ci, "text");
  } else if (t === "text_delta") {
    appendTextDelta(ci, amev.delta || "");
  } else if (t === "thinking_start") {
    const tb = ensureBlock(ci, "thinking");
    tb.el.classList.add("is-running");
  } else if (t === "thinking_delta") {
    appendThinkingDelta(ci, amev.delta || "");
  } else if (t === "toolcall_start") {
    collapseThinking();
    const tcb = ensureBlock(ci, "toolcall");
    if (tcb.statusEl) {
      tcb.statusEl.textContent = "";
      tcb.statusEl.classList.add("is-running");
    }
  } else if (t === "toolcall_delta") {
    appendToolCallDelta(ci, amev.delta || "");
  } else if (t === "toolcall_end") {
    finalizeToolCall(ci, amev.toolCall);
  }
}

export function handleEvent(event: any) {
  if (!event || typeof event !== "object") return;
  switch (event.type) {
    case "agent_start":
      setStreaming(true);
      break;
    case "agent_settled":
      setStreaming(false);
      setRetryAttempt(0);
      wrapLastWorkSegment();
      break;
    case "message_start":
      if (event.message && event.message.role === "assistant")
        startAssistantMessage(event.message.timestamp);
      else if (event.message && event.message.role === "user") {
        if (lastUserBubble && (lastUserBubble as any)._piTs == null) {
          if (event.message.timestamp != null)
            applyUserBubbleTime(lastUserBubble, event.message.timestamp);
        } else {
          const ub = addUserMessage(extractText(event.message.content));
          if (event.message.timestamp != null) applyUserBubbleTime(ub, event.message.timestamp);
        }
      }
      break;
    case "message_end":
      if (event.message && event.message.role === "assistant") {
        const amsg = event.message;
        const asr = amsg.stopReason;
        if (currentAssistant) currentAssistant.model = amsg.model || "";
        applyAssistantStopError(asr, amsg.errorMessage, retryAttempt);
        endAssistantMessage();
        if (asr && asr !== "error") {
          setRetryAttempt(0);
          recordCacheUsage(
            amsg.usage,
            state.model ? state.model.provider + "/" + state.model.id : "",
            amsg.timestamp,
          );
        }
      }
      break;
    case "message_update":
      handleAssistantMessageEvent(event.assistantMessageEvent);
      break;
    case "tool_execution_start":
      startToolExecution(event);
      break;
    case "tool_execution_update":
      updateToolExecution(event);
      break;
    case "tool_execution_end":
      endToolExecution(event);
      break;
    case "compaction_start":
      showToast(t("Compacting…"), undefined, true);
      addCompactionPlaceholder();
      break;
    case "compaction_end":
      hideToast();
      if (event.aborted || event.errorMessage) {
        if (pendingCompactionBlockRef) {
          pendingCompactionBlockRef.remove();
          pendingCompactionBlockRef = null;
        }
        if (event.errorMessage) showToast(event.errorMessage, "error");
      }
      break;
    case "auto_retry_start":
      setRetryAttempt(event.attempt);
      showToast(t("Retrying {0}/{1}…", event.attempt, event.maxAttempts), undefined, true);
      break;
    case "auto_retry_end":
      hideToast();
      setRetryAttempt(0);
      if (event.success === false) {
        const rfe = event.finalError || t("Unknown error");
        const reb = el("div", "error-banner");
        reb.textContent = t("Error: Retry failed after {0} attempts: {1}", event.attempt, rfe);
        messagesInner.appendChild(reb);
        scrollToBottom();
      }
      break;
    case "queue_update":
      queueState.steering = Array.isArray(event.steering) ? event.steering : [];
      queueState.followUp = Array.isArray(event.followUp) ? event.followUp : [];
      renderQueue();
      break;
    default:
      break;
  }
}

// ---- user actions (used by rewind.ts) ----
export function appendUserActions(
  row: HTMLElement,
  bubble: HTMLElement,
  text: string,
  metaEl: HTMLElement,
) {
  if (!row || !bubble) return;
  const actions = el("div", "bubble-actions");
  const copyBtn = el("button", "icon-btn");
  copyBtn.type = "button";
  tipBtn(copyBtn, t("Copy"));
  copyBtn.innerHTML = '<span class="codicon codicon-copy"></span>';
  copyBtn.addEventListener("click", function () {
    vscode.postMessage({ type: "copy", text: text || "" });
  });
  actions.appendChild(copyBtn);

  const forkBtn = el("button", "icon-btn");
  forkBtn.type = "button";
  tipBtn(forkBtn, t("Fork"));
  forkBtn.innerHTML = '<span class="codicon codicon-repo-forked"></span>';
  forkBtn.addEventListener("click", function () {
    const ts = (bubble as any)._piTs;
    if (state.isStreaming) return;
    if (ts == null) {
      showToast(t("Message not ready yet."), "info");
      return;
    }
    showRewindConfirm(
      t("Fork from this message?"),
      t("Create a new branch from this message. Current file changes are kept."),
      function () {
        vscode.postMessage({ type: "fork", ts });
      },
      t("Fork"),
    );
  });
  actions.appendChild(forkBtn);

  const revertBtn = el("button", "icon-btn");
  revertBtn.type = "button";
  tipBtn(revertBtn, t("Revert"));
  revertBtn.innerHTML = '<span class="codicon codicon-discard"></span>';
  revertBtn.addEventListener("click", function () {
    const ts = (bubble as any)._piTs;
    if (state.isStreaming) return;
    if (ts == null) {
      showToast(t("Message not ready yet."), "info");
      return;
    }
    vscode.postMessage({ type: "revert", ts });
  });
  actions.appendChild(revertBtn);

  if (metaEl) metaEl.insertBefore(actions, metaEl.firstChild);
  else row.appendChild(actions);
}

// ---- circular deps: register render functions with globals ----
import { setRenderMarkdown } from "./globals";

setRenderMarkdown(renderMarkdown);
