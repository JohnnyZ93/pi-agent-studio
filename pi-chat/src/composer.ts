import {
  vscode,
  state,
  models,
  thinkingLevels,
  commands,
  BUILTIN_CMDS,
  messagesEl,
  messagesInner,
  inputEl,
  sendBtn,
  attachBtn,
  attachPreviewEl,
  modelWrap,
  modelTrigger,
  modelTriggerLabel,
  modelPopup,
  modelSearch,
  modelList,
  enabledModelKeys,
  setEnabledModelKeys,
  ctxRing,
  ctxRingText,
  thinkingSelect,
  permissionSelect,
  permissionIcon,
  sessionInfoEl,
  acEl,
  overlayEl,
  el,
  updateSendButton,
  setStreaming,
  updateRefreshBtn,
  applyContextUsage,
  clearMessages,
  applyWidget,
  renderQueue,
  queueState,
  showTooltip,
  hideTooltip,
  showToast,
  showInfoPanel,
  scrollToBottom,
  setAutoScroll,
  setBtwAbortId,
  btwAbortId,
  sendBtnTip,
  pendingImages,
  inputHistory,
  getSendShortcut,
  setSendShortcut,
  getModelIcon,
  modelIconHtml,
} from "./globals";

import {
  handleEvent,
  hydrateMessages,
  pushHistory,
  handleBtw,
  setBtwLoading,
  addUserMessage,
} from "./messages";
import { t } from "./i18n";

import { applyRewindWidget, renderRewindDialog } from "./rewind";
import { openMcpDrawer, setMcpStatus } from "./mcp-panel";

// ---- model select rendering (custom dropdown) ----
function modelLabel(m: any): string {
  return (m.name || m.id) + (m.provider ? " \u00b7 " + m.provider : "");
}

function modelKey(m: any): string {
  return (m.provider || "") + "/" + (m.id || "");
}

function isFavorite(m: any): boolean {
  return enabledModelKeys.has(modelKey(m).toLowerCase());
}

const modelMeasurer = document.createElement("span");
modelMeasurer.style.cssText =
  "position:absolute;visibility:hidden;white-space:pre;font-family:var(--vscode-font-family);font-size: var(--chat-fs-12);";
document.body.appendChild(modelMeasurer);

function fitSelectToText(sel: HTMLSelectElement, extra: number) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt) return;
  modelMeasurer.textContent = opt.textContent || opt.value || "";
  sel.style.width = modelMeasurer.offsetWidth + extra + "px";
}

function fitModelTrigger() {
  modelMeasurer.textContent = modelTriggerLabel.textContent || "";
  modelTrigger.style.width = modelMeasurer.offsetWidth + 18 + "px";
}
function fitThinkingSelect() {
  fitSelectToText(thinkingSelect, 22);
}
function fitPermissionSelect() {
  fitSelectToText(permissionSelect, 16);
}

let modelPopupOpen = false;
let modelQuery = "";
let modelHighlight = -1;
let modelFiltered: any[] = [];

function currentModelIndex(): number {
  if (!state.model) return -1;
  for (let i = 0; i < models.length; i++) {
    if (models[i].provider === state.model.provider && models[i].id === state.model.id) return i;
  }
  return -1;
}

function computeFilteredModels() {
  const q = modelQuery.trim().toLowerCase();
  const matched: { m: any; ord: number }[] = [];
  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    if (!q) {
      matched.push({ m, ord: i });
      continue;
    }
    const name = String(m.name || m.id || "").toLowerCase();
    const id = String(m.id || "").toLowerCase();
    const provider = String(m.provider || "").toLowerCase();
    if (name.indexOf(q) >= 0 || id.indexOf(q) >= 0 || provider.indexOf(q) >= 0) {
      matched.push({ m, ord: i });
    }
  }
  matched.sort(function (a, b) {
    const fa = isFavorite(a.m) ? 1 : 0;
    const fb = isFavorite(b.m) ? 1 : 0;
    if (fa !== fb) return fb - fa;
    return a.ord - b.ord;
  });
  modelFiltered = matched.map(function (x) {
    return x.m;
  });
}

function renderModelList() {
  computeFilteredModels();
  modelList.innerHTML = "";
  if (!models.length) {
    const empty = el("div", "model-empty");
    empty.textContent = t("No models configured");
    modelList.appendChild(empty);
    modelHighlight = -1;
    return;
  }
  if (!modelFiltered.length) {
    const empty = el("div", "model-empty");
    empty.textContent = t("No matching models");
    modelList.appendChild(empty);
    modelHighlight = -1;
    return;
  }
  if (modelHighlight < 0 || modelHighlight >= modelFiltered.length) {
    const curIdx = currentModelIndex();
    let target = -1;
    if (curIdx >= 0) {
      for (let i = 0; i < modelFiltered.length; i++) {
        if (modelFiltered[i] === models[curIdx]) {
          target = i;
          break;
        }
      }
    }
    modelHighlight = target >= 0 ? target : 0;
  }
  for (let i = 0; i < modelFiltered.length; i++) {
    const m = modelFiltered[i];
    const item = el("div", "model-item" + (i === modelHighlight ? " active" : ""));
    item.setAttribute("data-i", String(i));
    const iconSlot = el("span", "model-item-icon");
    iconSlot.innerHTML = modelIconHtml(getModelIcon(m.name || m.id || ""));
    const label = el("span", "model-item-label");
    label.textContent = modelLabel(m);
    item.appendChild(iconSlot);
    item.appendChild(label);
    const star = el("button", "model-star" + (isFavorite(m) ? " is-on" : ""));
    star.type = "button";
    star.setAttribute("data-i", String(i));
    star.title = isFavorite(m) ? t("Remove from favorites") : t("Add to favorites");
    star.innerHTML = isFavorite(m)
      ? '<span class="codicon codicon-star-full"></span>'
      : '<span class="codicon codicon-star-empty"></span>';
    item.appendChild(star);
    modelList.appendChild(item);
  }
  const active = modelList.querySelector(".active") as HTMLElement | null;
  if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
}

function renderModels() {
  const idx = currentModelIndex();
  const m = idx >= 0 ? models[idx] : null;
  if (m) {
    modelTriggerLabel.textContent = modelLabel(m);
  } else if (!models.length) {
    modelTriggerLabel.textContent = t("No models configured");
  } else {
    modelTriggerLabel.textContent = "";
  }
  fitModelTrigger();
  updateModelIcon();
  if (modelPopupOpen) renderModelList();
}

function updateModelIcon() {
  const slot = document.getElementById("model-icon");
  if (!slot) return;
  const idx = currentModelIndex();
  const m = idx >= 0 ? models[idx] : null;
  if (!m) {
    slot.innerHTML = "";
    return;
  }
  const icon = getModelIcon(m.name || m.id || "");
  slot.innerHTML = modelIconHtml(icon);
}

function positionModelPopup() {
  const r = modelWrap.getBoundingClientRect();
  modelPopup.style.minWidth = Math.max(260, r.width) + "px";
  modelPopup.style.left = "";
  modelPopup.style.right = "";
  const pw = modelPopup.offsetWidth;
  const margin = 8;
  let left = 0;
  const rightEdge = r.left + pw;
  if (rightEdge > window.innerWidth - margin) {
    left = r.width - pw;
    if (r.left + left < margin) {
      left = -(r.left - margin);
    }
  }
  modelPopup.style.left = left + "px";
  const ph = modelPopup.offsetHeight || 220;
  const spaceBelow = window.innerHeight - r.bottom;
  if (spaceBelow < ph + 8 && r.top > spaceBelow) {
    modelPopup.style.bottom = r.height + "px";
    modelPopup.style.top = "";
  } else {
    modelPopup.style.top = r.height + "px";
    modelPopup.style.bottom = "";
  }
}

function openModelPopup() {
  if (modelPopupOpen) return;
  modelPopupOpen = true;
  modelQuery = "";
  modelSearch.value = "";
  modelHighlight = -1;
  modelPopup.style.display = "block";
  renderModelList();
  positionModelPopup();
  modelWrap.classList.add("is-open");
  document.addEventListener("mousedown", onModelPopupOutside);
  setTimeout(function () {
    modelSearch.focus();
  }, 0);
}

function closeModelPopup() {
  if (!modelPopupOpen) return;
  modelPopupOpen = false;
  modelPopup.style.display = "none";
  modelWrap.classList.remove("is-open");
  document.removeEventListener("mousedown", onModelPopupOutside);
}

function onModelPopupOutside(ev: MouseEvent) {
  const t = ev.target as HTMLElement;
  if (t && (t === modelWrap || modelWrap.contains(t))) return;
  closeModelPopup();
}

function selectModel(m: any) {
  vscode.postMessage({ type: "setModel", provider: m.provider, modelId: m.id });
  closeModelPopup();
}

function toggleFavorite(m: any) {
  const key = modelKey(m).toLowerCase();
  if (enabledModelKeys.has(key)) enabledModelKeys.delete(key);
  else enabledModelKeys.add(key);
  renderModelList();
  vscode.postMessage({ type: "toggleFavorite", provider: m.provider, modelId: m.id });
}

function renderThinking() {
  thinkingSelect.innerHTML = "";
  const levels = thinkingLevels.length ? thinkingLevels : ["off"];
  for (let i = 0; i < levels.length; i++) {
    const opt = document.createElement("option");
    opt.value = levels[i];
    opt.textContent = levels[i];
    if (levels[i] === state.thinkingLevel) opt.selected = true;
    thinkingSelect.appendChild(opt);
  }
  fitThinkingSelect();
}

let permissionTip = "";

function renderPermission() {
  permissionSelect.innerHTML = "";
  const modes = ["AskForApproval", "FullAccess"];
  for (let i = 0; i < modes.length; i++) {
    const opt = document.createElement("option");
    opt.value = modes[i];
    opt.textContent = modes[i];
    permissionSelect.appendChild(opt);
  }
  fitPermissionSelect();
  updatePermissionColor(permissionSelect.value);
}

function updatePermissionColor(mode: string) {
  const safe = mode === "AskForApproval";
  permissionSelect.classList.toggle("permission-safe", safe);
  permissionSelect.classList.toggle("permission-danger", !safe);
  permissionTip = safe
    ? t("Ask for approval before running commands")
    : t("Full access: run commands without asking");
  if (permissionIcon) {
    permissionIcon.classList.toggle("codicon-shield", safe);
    permissionIcon.classList.toggle("codicon-unlock", !safe);
    permissionIcon.classList.toggle("permission-safe", safe);
    permissionIcon.classList.toggle("permission-danger", !safe);
  }
}

function applyState(s: any) {
  if (!s) return;
  state.model = s.model;
  state.thinkingLevel = s.thinkingLevel;
  state.sessionFile = s.sessionFile || null;
  state.sessionName = s.sessionName || "";
  updateRefreshBtn();
  renderModels();
  renderThinking();
}

// ---- autocomplete ----

function currentSlashToken(): { token: string; lineStart: number; after: string } | null {
  const val = inputEl.value;
  const pos = inputEl.selectionStart;
  if (pos == null) return null;
  const before = val.slice(0, pos);
  const lineStart = before.lastIndexOf("\n") + 1;
  const lineTail = before.slice(lineStart);
  if (lineTail.charAt(0) !== "/") return null;
  const token = lineTail.slice(1);
  if (token.indexOf(" ") !== -1) return null;
  return { token, lineStart, after: inputEl.value.slice(pos) };
}

function currentAtToken(): { query: string; lineStart: number; after: string } | null {
  const val = inputEl.value;
  const pos = inputEl.selectionStart;
  if (pos == null) return null;
  const before = val.slice(0, pos);
  let wordStart = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    if (/\s/.test(before.charAt(i))) {
      wordStart = i + 1;
      break;
    }
  }
  const token = before.slice(wordStart, pos);
  if (token.charAt(0) !== "@") return null;
  return { query: token.slice(1), lineStart: wordStart, after: val.slice(pos) };
}

let acItems: any[] = [];
let acIndex = -1;
let acMode = "command";
let acMatchIndices: number[][] = [];
let fileTimer: number | null = null;

function scoreCommand(name: string, q: string): { score: number; indices: number[] | null } | null {
  const n = name.toLowerCase();
  if (!q) return { score: 1, indices: null };
  const pi = n.indexOf(q);
  if (pi >= 0) {
    const idx: number[] = [];
    for (let k = 0; k < q.length; k++) idx.push(pi + k);
    if (pi === 0) return { score: 900, indices: idx };
    const prev = n.charAt(pi - 1);
    const base = prev === "-" || prev === "_" || prev === " " ? 750 : 600;
    return { score: base - pi, indices: idx };
  }
  let qi = 0,
    firstIdx = -1,
    lastIdx = -1,
    consec = 0,
    maxConsec = 0;
  const indices: number[] = [];
  for (let i = 0; i < n.length && qi < q.length; i++) {
    if (n.charAt(i) === q.charAt(qi)) {
      if (firstIdx < 0) firstIdx = i;
      if (lastIdx >= 0 && i === lastIdx + 1) consec++;
      else consec = 1;
      if (consec > maxConsec) maxConsec = consec;
      lastIdx = i;
      indices.push(i);
      qi++;
    }
  }
  if (qi !== q.length) return null;
  let startBonus = 0;
  if (firstIdx === 0) startBonus = 50;
  else {
    const p = n.charAt(firstIdx - 1);
    if (p === "-" || p === "_" || p === " ") startBonus = 30;
  }
  const gaps = lastIdx - firstIdx + 1 - q.length;
  const compactBonus = gaps > 0 ? Math.max(0, 40 - gaps * 3) : 40;
  return { score: 100 + startBonus + maxConsec * 8 + compactBonus, indices };
}

function updateAutocomplete() {
  const slash = currentSlashToken();
  if (slash) {
    if (fileTimer) {
      clearTimeout(fileTimer);
      fileTimer = null;
    }
    acMode = "command";
    const q = slash.token.toLowerCase();
    const scored: { cmd: any; score: number; indices: number[] | null; ord: number }[] = [];
    for (let i = 0; i < commands.length; i++) {
      const c = commands[i];
      const m = scoreCommand(c.name, q);
      if (m) scored.push({ cmd: c, score: m.score, indices: m.indices, ord: i });
    }
    if (!scored.length) {
      hideAutocomplete();
      return;
    }
    scored.sort(function (a, b) {
      if (a.score !== b.score) return b.score - a.score;
      return a.ord - b.ord;
    });
    acItems = [];
    acMatchIndices = [];
    for (let j = 0; j < scored.length; j++) {
      acItems.push(scored[j].cmd);
      acMatchIndices.push(scored[j].indices || []);
    }
    acIndex = 0;
    renderAutocomplete();
    acEl.style.display = "block";
    return;
  }
  const at = currentAtToken();
  if (!at) {
    hideAutocomplete();
    return;
  }
  acMode = "file";
  acItems = [];
  acIndex = -1;
  acEl.style.display = "none";
  const query = at.query;
  if (fileTimer) {
    clearTimeout(fileTimer);
  }
  fileTimer = window.setTimeout(function () {
    vscode.postMessage({ type: "searchFiles", query: query });
  }, 120);
}

function renderAutocomplete() {
  acEl.innerHTML = "";
  for (let i = 0; i < acItems.length; i++) {
    const item = el("div", "autocomplete-item" + (i === acIndex ? " active" : ""));
    item.setAttribute("data-i", String(i));
    if (acMode === "file") {
      const p = acItems[i] as string;
      const slashIdx = p.lastIndexOf("/");
      const fname = el("div", "ac-name");
      fname.textContent = slashIdx >= 0 ? p.slice(slashIdx + 1) : p;
      item.appendChild(fname);
      if (slashIdx >= 0) {
        const fdir = el("div", "ac-desc");
        fdir.textContent = p.slice(0, slashIdx);
        item.appendChild(fdir);
      }
    } else {
      const c = acItems[i] as any;
      const cname = el("div", "ac-name");
      const matched = acMatchIndices[i];
      if (matched && matched.length) {
        cname.appendChild(document.createTextNode("/"));
        let mi = 0;
        for (let k = 0; k < c.name.length; k++) {
          if (mi < matched.length && matched[mi] === k) {
            const mk = document.createElement("mark");
            mk.className = "ac-hl";
            mk.textContent = c.name.charAt(k);
            cname.appendChild(mk);
            mi++;
          } else {
            cname.appendChild(document.createTextNode(c.name.charAt(k)));
          }
        }
      } else {
        cname.textContent = "/" + c.name;
      }
      const cdesc = el("div", "ac-desc");
      cdesc.textContent = c.description || "";
      const csrc = el("div", "ac-source");
      csrc.textContent = c.source;
      item.appendChild(cname);
      item.appendChild(cdesc);
      item.appendChild(csrc);
    }
    acEl.appendChild(item);
  }
  const active = acEl.querySelector(".active") as HTMLElement;
  if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
}

function hideAutocomplete() {
  if (fileTimer) {
    clearTimeout(fileTimer);
    fileTimer = null;
  }
  acEl.style.display = "none";
  acItems = [];
  acIndex = -1;
  acMode = "command";
  acMatchIndices = [];
}

function applyFileResults(query: string, files: string[]) {
  const info = currentAtToken();
  if (!info || info.query !== query) return;
  if (!files || !files.length) {
    hideAutocomplete();
    return;
  }
  acMode = "file";
  acItems = files;
  acIndex = 0;
  renderAutocomplete();
  acEl.style.display = "block";
}

function completeAutocomplete(item: any) {
  if (acMode === "file") {
    const info = currentAtToken();
    if (!info) {
      hideAutocomplete();
      return;
    }
    const val = inputEl.value;
    const replacement = "@" + item + " ";
    inputEl.value = val.slice(0, info.lineStart) + replacement + info.after;
    const newPos = info.lineStart + replacement.length;
    inputEl.focus();
    try {
      inputEl.setSelectionRange(newPos, newPos);
    } catch {
      /* ignore */
    }
    hideAutocomplete();
    return;
  }
  const c = item;
  const val = inputEl.value;
  const pos = inputEl.selectionStart;
  if (pos == null) {
    hideAutocomplete();
    return;
  }
  const before = val.slice(0, pos);
  const lineStart = before.lastIndexOf("\n") + 1;
  const after = val.slice(pos);
  const replacement = "/" + c.name + " ";
  inputEl.value = val.slice(0, lineStart) + replacement + after;
  const newPos = lineStart + replacement.length;
  inputEl.focus();
  try {
    inputEl.setSelectionRange(newPos, newPos);
  } catch {
    /* ignore */
  }
  hideAutocomplete();
}

// ---- send ----
function isLocalCommand(msg: string): boolean {
  const s = msg.trim();
  if (s.charAt(0) !== "/") return false;
  let name = s.slice(1);
  const sp = name.indexOf(" ");
  if (sp >= 0) name = name.slice(0, sp);
  if (!name) return false;
  if (BUILTIN_CMDS[name]) return true;
  for (let i = 0; i < commands.length; i++) {
    const c = commands[i];
    if (c.name === name && c.source === "extension") return true;
  }
  return false;
}

function sendPrompt(behavior?: string) {
  const msg = inputEl.value;
  const imgs = pendingImages.slice();
  const hasText = !!msg.trim();
  const hasImgs = imgs.length > 0;
  if (!hasText && !hasImgs) return;
  const isLocal = isLocalCommand(msg);
  if (state.isStreaming && isLocal) return;
  const sendImgs =
    !isLocal && hasImgs
      ? imgs.map(function (im) {
          return { type: "image", data: im.data, mimeType: im.mimeType };
        })
      : null;
  pushHistory(msg);
  inputEl.value = "";
  autoGrow();
  hideAutocomplete();
  historyIndex = -1;
  historyDraft = "";
  clearPendingImages();
  if (state.isStreaming) {
    const steerPayload: any = {
      type: "prompt",
      message: msg,
      streamingBehavior: behavior || "steer",
    };
    if (sendImgs) steerPayload.images = sendImgs;
    vscode.postMessage(steerPayload);
  } else {
    setAutoScroll(true);
    addUserMessage(msg, sendImgs ?? undefined);
    scrollToBottom();
    if (!isLocal) {
      setStreaming(true);
    } else {
      updateSendButton();
    }
    const payload: any = { type: "prompt", message: msg };
    if (sendImgs) payload.images = sendImgs;
    vscode.postMessage(payload);
  }
}

function autoGrow() {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + "px";
}

let historyIndex = -1;
let historyDraft = "";

function navigateHistory(delta: number) {
  if (!inputHistory.length) return;
  if (historyIndex === -1) {
    if (delta > 0) return;
    historyDraft = inputEl.value;
    historyIndex = inputHistory.length - 1;
  } else {
    historyIndex += delta;
    if (historyIndex >= inputHistory.length) {
      historyIndex = -1;
      inputEl.value = historyDraft;
      historyDraft = "";
      autoGrow();
      updateSendButton();
      return;
    }
    if (historyIndex < 0) historyIndex = 0;
  }
  inputEl.value = inputHistory[historyIndex];
  const len = inputEl.value.length;
  try {
    inputEl.setSelectionRange(len, len);
  } catch {
    /* ignore */
  }
  autoGrow();
  updateSendButton();
}

// ---- image attachment ----
function addImageFromFile(file: File) {
  const reader = new FileReader();
  reader.onload = function () {
    const dataUrl = String(reader.result || "");
    const marker = ";base64,";
    const idx = dataUrl.indexOf(marker);
    if (idx < 0 || dataUrl.indexOf("data:") !== 0) return;
    const mimeType = dataUrl.slice(5, idx);
    const data = dataUrl.slice(idx + marker.length);
    pendingImages.push({ data, mimeType, dataUrl });
    renderPendingImages();
    updateSendButton();
  };
  reader.onerror = function () {
    /* ignore */
  };
  reader.readAsDataURL(file);
}

function removePendingImage(idx: number) {
  pendingImages.splice(idx, 1);
  renderPendingImages();
  updateSendButton();
}

function clearPendingImages() {
  pendingImages.length = 0;
  renderPendingImages();
}

function renderPendingImages() {
  attachPreviewEl.innerHTML = "";
  if (!pendingImages.length) {
    attachPreviewEl.style.display = "none";
    return;
  }
  for (let i = 0; i < pendingImages.length; i++) {
    (function (im, idx) {
      const thumb = el("div", "attach-thumb");
      const img = document.createElement("img");
      img.src = im.dataUrl;
      thumb.appendChild(img);
      const rm = el("button", "attach-remove") as HTMLButtonElement;
      rm.type = "button";
      rm.title = t("Remove image");
      rm.textContent = "\u00d7";
      rm.addEventListener("click", function () {
        removePendingImage(idx);
      });
      thumb.appendChild(rm);
      attachPreviewEl.appendChild(thumb);
    })(pendingImages[i], i);
  }
  attachPreviewEl.style.display = "flex";
}

function isImageType(t: string): boolean {
  return typeof t === "string" && t.indexOf("image/") === 0;
}

function dtHasFiles(dt: DataTransfer | null): boolean {
  if (!dt || !dt.types) return false;
  for (let i = 0; i < dt.types.length; i++) if (dt.types[i] === "Files") return true;
  return false;
}

function insertPickedResources(paths: string[]) {
  if (!paths || !paths.length) return;
  const text = paths
    .map(function (p) {
      return "@" + p + " ";
    })
    .join("\n");
  let val = inputEl.value;
  const pos = inputEl.selectionStart || val.length;
  const before = val.slice(0, pos);
  const after = val.slice(pos);
  const pre = before.length && !/[\n\s]$/.test(before) ? "\n" : "";
  const post = after.length && !/^[\n\s]/.test(after) ? "\n" : "";
  inputEl.value = before + pre + text + post + after;
  const newPos = (before + pre + text).length;
  inputEl.focus();
  try {
    inputEl.setSelectionRange(newPos, newPos);
  } catch {
    /* ignore */
  }
  autoGrow();
  updateSendButton();
}

// ---- context menu ----
const ctxMenu = document.getElementById("ctx-menu")!;
const ctxCopy = document.getElementById("ctx-copy") as HTMLButtonElement;
const ctxFork = document.getElementById("ctx-fork") as HTMLButtonElement;
const ctxRevert = document.getElementById("ctx-revert") as HTMLButtonElement;
let ctxText = "";
let ctxUserTs: number | null = null;
const COPYABLE = ".user-bubble, .text-block, .thinking-body";

function showCtxMenu(x: number, y: number, text: string, userTs: number | null) {
  ctxText = text || "";
  ctxCopy.disabled = !ctxText;
  ctxUserTs = userTs != null ? userTs : null;
  if (ctxUserTs == null) {
    ctxFork.disabled = true;
    ctxFork.style.display = "none";
    ctxRevert.disabled = true;
    ctxRevert.style.display = "none";
  } else {
    ctxFork.disabled = state.isStreaming;
    ctxFork.style.display = "";
    ctxRevert.disabled = state.isStreaming;
    ctxRevert.style.display = "";
  }
  ctxMenu.style.display = "block";
  ctxMenu.style.left = "0px";
  ctxMenu.style.top = "0px";
  const rect = ctxMenu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 4);
  const top = Math.min(y, window.innerHeight - rect.height - 4);
  ctxMenu.style.left = Math.max(4, left) + "px";
  ctxMenu.style.top = Math.max(4, top) + "px";
}

function hideCtxMenu() {
  ctxMenu.style.display = "none";
}

// ---- dialog ----
function renderQuestionnaireForm(box: HTMLElement, request: any) {
  let data: any;
  try {
    data = JSON.parse(request.prefill || "{}");
  } catch {
    data = { questions: [] };
  }
  const qs = data.questions || [];
  const answers: Record<string, any> = {};
  let submitBtn: HTMLButtonElement | null = null;

  function updateTitle() {
    let answered = 0;
    for (let i = 0; i < qs.length; i++) {
      if (answers[qs[i].id]) answered++;
    }
    h.textContent = t("{0}/{1} questions", answered, qs.length);
  }

  function updateSubmit() {
    updateTitle();
    if (!submitBtn) return;
    const allAnswered = qs.every(function (q: any) {
      return answers[q.id];
    });
    submitBtn.disabled = !allAnswered;
  }

  const h = document.createElement("h3");
  box.appendChild(h);

  for (let qi = 0; qi < qs.length; qi++) {
    (function (q, idx) {
      const block = el("div", "q-block");
      const hdr = el("div", "q-header");
      const num = el("span", "q-num");
      num.textContent = idx + 1 + ".";
      const lbl = el("span", "q-label");
      lbl.textContent = q.label || "Q" + (idx + 1);
      hdr.appendChild(num);
      hdr.appendChild(lbl);
      block.appendChild(hdr);
      const prompt = el("div", "q-prompt");
      prompt.textContent = q.prompt;
      block.appendChild(prompt);
      const opts = (q.options || []).slice();
      if (q.allowOther !== false) opts.push({ label: t("Type something."), isOther: true });
      const optList = el("div", "q-options");
      const ta = document.createElement("textarea");
      ta.className = "q-textarea dialog-input";
      ta.style.display = "none";
      ta.placeholder = t("Type your answer...");
      for (let oi = 0; oi < opts.length; oi++) {
        (function (opt, oIndex) {
          const btn = el("button", "opt-btn") as HTMLButtonElement;
          if (opt.description) {
            const l = el("span", "opt-label");
            l.textContent = opt.label;
            const d = el("span", "opt-desc");
            d.textContent = opt.description;
            btn.appendChild(l);
            btn.appendChild(d);
          } else {
            btn.textContent = opt.label;
          }
          btn.addEventListener("click", function () {
            const sibs = optList.querySelectorAll(".opt-btn");
            for (let s = 0; s < sibs.length; s++) sibs[s].classList.remove("selected");
            btn.classList.add("selected");
            if (opt.isOther) {
              ta.style.display = "block";
              ta.focus();
              const v = ta.value.trim() || t("(no response)");
              answers[q.id] = { id: q.id, value: v, label: v, wasCustom: true };
              updateSubmit();
            } else {
              ta.style.display = "none";
              ta.value = "";
              answers[q.id] = {
                id: q.id,
                value: opt.label,
                label: opt.label,
                wasCustom: false,
                index: oIndex + 1,
              };
              updateSubmit();
            }
          });
          optList.appendChild(btn);
        })(opts[oi], oi);
      }
      block.appendChild(optList);
      block.appendChild(ta);
      ta.addEventListener("input", function () {
        if (answers[q.id] && answers[q.id].wasCustom) {
          const v = ta.value.trim() || t("(no response)");
          answers[q.id] = { id: q.id, value: v, label: v, wasCustom: true };
        }
      });
      box.appendChild(block);
    })(qs[qi], qi);
  }

  const actions = el("div", "dialog-actions");
  const cancel = el("button", "btn btn-secondary") as HTMLButtonElement;
  cancel.textContent = t("Cancel");
  cancel.addEventListener("click", function () {
    respond(request.id, { cancelled: true });
  });
  submitBtn = el("button", "btn btn-primary") as HTMLButtonElement;
  submitBtn.textContent = t("Submit");
  submitBtn.addEventListener("click", function () {
    const arr: any[] = [];
    for (let qi2 = 0; qi2 < qs.length; qi2++) {
      const a = answers[qs[qi2].id];
      if (a) arr.push(a);
    }
    respond(request.id, { value: JSON.stringify({ answers: arr }) });
  });
  actions.appendChild(cancel);
  actions.appendChild(submitBtn);
  box.appendChild(actions);
  updateSubmit();
}

function showDialog(request: any) {
  overlayEl.innerHTML = "";
  const box = el("div", "dialog");
  const method = request.method;
  const title = request.title || (method === "confirm" ? t("Confirm") : t("Input required"));
  const h = document.createElement("h3");
  h.textContent = title;
  const isPermission =
    method === "select" && String(request.title || "").indexOf("Dangerous Command:") === 0;
  box.appendChild(h);
  if (request.message) {
    const p = document.createElement("p");
    p.textContent = String(request.message);
    box.appendChild(p);
  }

  let inputField: HTMLTextAreaElement | null = null;
  if (method === "editor" && request.title === "Pi Questionnaire Form") {
    renderQuestionnaireForm(box, request);
    overlayEl.appendChild(box);
    overlayEl.style.display = "flex";
    return;
  }
  if (method === "editor" && request.title === "Pi Rewind Confirm") {
    renderRewindDialog(box, request);
    overlayEl.appendChild(box);
    overlayEl.style.display = "flex";
    return;
  }
  if (method === "select" && Array.isArray(request.options)) {
    const list = el("div", "opt-list");
    for (let i = 0; i < request.options.length; i++) {
      (function (opt) {
        const btn = el("button", "opt-btn") as HTMLButtonElement;
        btn.textContent = String(opt);
        if (isPermission) {
          if (String(opt) === "Allow") btn.classList.add("opt-allow");
          else if (String(opt) === "Block") btn.classList.add("opt-block");
        }
        btn.addEventListener("click", function () {
          respond(request.id, { value: String(opt) });
        });
        list.appendChild(btn);
      })(request.options[i]);
    }
    box.appendChild(list);
  } else if (method === "confirm") {
    const actions = el("div", "dialog-actions");
    const no = el("button", "btn btn-secondary") as HTMLButtonElement;
    no.textContent = t("No");
    no.addEventListener("click", function () {
      respond(request.id, { confirmed: false });
    });
    const yes = el("button", "btn btn-primary") as HTMLButtonElement;
    yes.textContent = t("Yes");
    yes.addEventListener("click", function () {
      respond(request.id, { confirmed: true });
    });
    actions.appendChild(no);
    actions.appendChild(yes);
    box.appendChild(actions);
  } else {
    inputField = document.createElement("textarea");
    inputField.className = "dialog-input";
    if (request.prefill) inputField.value = String(request.prefill);
    box.appendChild(inputField);
    const actions = el("div", "dialog-actions");
    const cancel = el("button", "btn btn-secondary") as HTMLButtonElement;
    cancel.textContent = t("Cancel");
    cancel.addEventListener("click", function () {
      respond(request.id, { cancelled: true });
    });
    const ok = el("button", "btn btn-primary") as HTMLButtonElement;
    ok.textContent = t("OK");
    ok.addEventListener("click", function () {
      respond(request.id, { value: inputField!.value });
    });
    actions.appendChild(cancel);
    actions.appendChild(ok);
    box.appendChild(actions);
  }
  overlayEl.appendChild(box);
  overlayEl.style.display = "flex";
  if (inputField) {
    inputField.focus();
  }
}

function respond(id: string, payload: any) {
  vscode.postMessage(Object.assign({ type: "dialogResponse", id: id }, payload));
  overlayEl.style.display = "none";
  overlayEl.innerHTML = "";
}

// ---- wire-up events ----
modelTrigger.addEventListener("click", function () {
  if (modelPopupOpen) closeModelPopup();
  else openModelPopup();
});

modelList.addEventListener("click", function (ev: MouseEvent) {
  const t = ev.target as HTMLElement;
  const starBtn = t.closest ? (t.closest(".model-star") as HTMLElement | null) : null;
  if (starBtn) {
    ev.stopPropagation();
    const i = Number(starBtn.getAttribute("data-i"));
    const m = modelFiltered[i];
    if (m) toggleFavorite(m);
    return;
  }
  const item = t.closest ? (t.closest(".model-item") as HTMLElement | null) : null;
  if (item) {
    const i = Number(item.getAttribute("data-i"));
    const m = modelFiltered[i];
    if (m) selectModel(m);
  }
});

modelSearch.addEventListener("input", function () {
  modelQuery = modelSearch.value;
  modelHighlight = -1;
  renderModelList();
});

modelSearch.addEventListener("keydown", function (ev: KeyboardEvent) {
  if (ev.key === "Escape") {
    ev.preventDefault();
    closeModelPopup();
    return;
  }
  if (!modelFiltered.length) return;
  if (ev.key === "ArrowDown") {
    ev.preventDefault();
    modelHighlight = (modelHighlight + 1) % modelFiltered.length;
    renderModelList();
  } else if (ev.key === "ArrowUp") {
    ev.preventDefault();
    modelHighlight = (modelHighlight - 1 + modelFiltered.length) % modelFiltered.length;
    renderModelList();
  } else if (ev.key === "Enter") {
    ev.preventDefault();
    const m = modelFiltered[modelHighlight];
    if (m) selectModel(m);
  }
});

thinkingSelect.addEventListener("change", function () {
  vscode.postMessage({ type: "setThinking", level: thinkingSelect.value });
  fitThinkingSelect();
});

permissionSelect.addEventListener("change", function () {
  const v = permissionSelect.value;
  fitPermissionSelect();
  updatePermissionColor(v);
  vscode.postMessage({ type: "setPermission", mode: v });
});

sendBtn.addEventListener("click", function () {
  if (state.isStreaming) {
    vscode.postMessage({ type: "abort" });
    return;
  }
  if (state.isBtwLoading && btwAbortId) {
    vscode.postMessage({ type: "btwAbort", id: btwAbortId });
    return;
  }
  sendPrompt();
});

inputEl.addEventListener("input", function () {
  autoGrow();
  updateAutocomplete();
  updateSendButton();
  historyIndex = -1;
  historyDraft = "";
});

inputEl.addEventListener("keydown", function (ev: KeyboardEvent) {
  if (acItems.length && (ev.key === "ArrowDown" || ev.key === "ArrowUp")) {
    ev.preventDefault();
    acIndex = (acIndex + (ev.key === "ArrowDown" ? 1 : -1) + acItems.length) % acItems.length;
    renderAutocomplete();
    return;
  }
  if (
    acItems.length &&
    !ev.altKey &&
    !ev.ctrlKey &&
    !ev.metaKey &&
    (ev.key === "Enter" || ev.key === "Tab")
  ) {
    ev.preventDefault();
    completeAutocomplete(acItems[acIndex]);
    return;
  }
  if (ev.key === "Escape" && (acItems.length || fileTimer)) {
    ev.preventDefault();
    hideAutocomplete();
    return;
  }
  if (ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey && ev.key === "u") {
    ev.preventDefault();
    inputEl.value = "";
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  if (!ev.shiftKey && !ev.altKey && !ev.ctrlKey && !ev.metaKey && ev.key === "ArrowUp") {
    const pos = inputEl.selectionStart;
    if (inputEl.value.slice(0, pos).indexOf("\n") === -1) {
      ev.preventDefault();
      navigateHistory(-1);
      return;
    }
  }
  if (!ev.shiftKey && !ev.altKey && !ev.ctrlKey && !ev.metaKey && ev.key === "ArrowDown") {
    const dpos = inputEl.selectionStart;
    if (inputEl.value.slice(dpos).indexOf("\n") === -1) {
      ev.preventDefault();
      navigateHistory(1);
      return;
    }
  }
  if (ev.key === "Enter" && !ev.isComposing) {
    const isMac = /Mac/i.test(navigator.platform || "");
    const isMod = isMac ? ev.metaKey : ev.ctrlKey;
    const isFollowUp = ev.altKey && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey;
    const isSend =
      getSendShortcut() === "enter"
        ? !ev.shiftKey && !ev.altKey && !ev.ctrlKey && !ev.metaKey
        : isMod && !ev.shiftKey && !ev.altKey;
    if (isFollowUp) {
      ev.preventDefault();
      sendPrompt("followUp");
    } else if (isSend) {
      ev.preventDefault();
      sendPrompt("steer");
    }
  }
});

acEl.addEventListener("click", function (ev: MouseEvent) {
  let t = ev.target as HTMLElement;
  while (t && t !== acEl) {
    if (t.classList && t.classList.contains("autocomplete-item")) {
      const i = Number(t.getAttribute("data-i"));
      if (acItems[i]) {
        completeAutocomplete(acItems[i]);
      }
      return;
    }
    t = t.parentNode as HTMLElement;
  }
});

attachBtn.addEventListener("click", function () {
  if (state.isStreaming) return;
  vscode.postMessage({ type: "pickResource" });
});

inputEl.addEventListener("paste", function (ev: ClipboardEvent) {
  const cd = ev.clipboardData;
  if (!cd || !cd.items) return;
  const imgItems: DataTransferItem[] = [];
  for (let i = 0; i < cd.items.length; i++) {
    const it = cd.items[i];
    if (it.kind === "file" && isImageType(it.type)) imgItems.push(it);
  }
  if (!imgItems.length) return;
  ev.preventDefault();
  for (let k = 0; k < imgItems.length; k++) {
    const file = imgItems[k].getAsFile();
    if (file) addImageFromFile(file);
  }
});

inputEl.addEventListener("dragover", function (ev: DragEvent) {
  if (dtHasFiles(ev.dataTransfer)) ev.preventDefault();
});

inputEl.addEventListener("drop", function (ev: DragEvent) {
  if (!ev.dataTransfer || !ev.dataTransfer.files || !ev.dataTransfer.files.length) return;
  const files = ev.dataTransfer.files;
  let hasImg = false;
  for (let i = 0; i < files.length; i++) if (isImageType(files[i].type)) hasImg = true;
  if (!hasImg) return;
  ev.preventDefault();
  for (let j = 0; j < files.length; j++) if (isImageType(files[j].type)) addImageFromFile(files[j]);
});

// ---- context menu events ----
messagesEl.addEventListener("contextmenu", function (ev: MouseEvent) {
  const sel = window.getSelection();
  let text = sel && sel.toString();
  let userTs: number | null = null;
  let node = ev.target as HTMLElement;
  while (node && node !== messagesEl && node !== document.body) {
    if (node.classList && node.classList.contains("user-bubble")) {
      userTs = (node as any)._piTs != null ? (node as any)._piTs : null;
      break;
    }
    if (node.classList && node.classList.contains("bubble-meta")) {
      const ub = node.parentNode
        ? ((node.parentNode as HTMLElement).querySelector(".user-bubble") as HTMLElement)
        : null;
      if (ub) {
        userTs = (ub as any)._piTs != null ? (ub as any)._piTs : null;
        break;
      }
    }
    if (node.classList && node.classList.contains("msg") && node.classList.contains("user")) break;
    node = node.parentNode as HTMLElement;
  }
  if (!text) {
    let node2 = ev.target as HTMLElement;
    while (node2 && node2 !== messagesEl && node2 !== document.body) {
      if (node2.matches && node2.matches(COPYABLE)) {
        text = (node2 as any)._piMd || node2.textContent || "";
        break;
      }
      node2 = node2.parentNode as HTMLElement;
    }
  }
  if (!text && userTs == null) {
    hideCtxMenu();
    return;
  }
  ev.preventDefault();
  showCtxMenu(ev.clientX, ev.clientY, text || "", userTs);
});

ctxCopy.addEventListener("click", function () {
  if (ctxText) vscode.postMessage({ type: "copy", text: ctxText });
  hideCtxMenu();
});

ctxFork.addEventListener("click", function () {
  if (ctxUserTs == null || state.isStreaming) return;
  const ts = ctxUserTs;
  hideCtxMenu();
  vscode.postMessage({ type: "fork", ts: ts });
});

ctxRevert.addEventListener("click", function () {
  if (ctxUserTs == null || state.isStreaming) {
    hideCtxMenu();
    return;
  }
  const ts = ctxUserTs;
  hideCtxMenu();
  vscode.postMessage({ type: "revert", ts: ts });
});

document.addEventListener("mousedown", function (ev: MouseEvent) {
  if (ctxMenu.style.display === "none") return;
  if (ev.target === ctxMenu || ctxMenu.contains(ev.target as Node)) return;
  hideCtxMenu();
});

messagesEl.addEventListener("scroll", hideCtxMenu, true);
window.addEventListener("blur", hideCtxMenu);

// ---- tooltip setup ----
ctxRing.addEventListener("mouseenter", function () {
  showTooltip(ctxRing, ctxRingText);
});
ctxRing.addEventListener("mouseleave", hideTooltip);
modelTrigger.addEventListener("mouseenter", function () {
  showTooltip(modelTrigger, t("Model"));
});
modelTrigger.addEventListener("mouseleave", hideTooltip);
const permissionWrap = document.querySelector(".permission-wrap") as HTMLElement;
permissionWrap.addEventListener("mouseenter", function () {
  showTooltip(permissionWrap, permissionTip);
});
permissionWrap.addEventListener("mouseleave", hideTooltip);
thinkingSelect.addEventListener("mouseenter", function () {
  showTooltip(thinkingSelect, t("Thinking level"));
});
thinkingSelect.addEventListener("mouseleave", hideTooltip);
sendBtn.addEventListener("mouseenter", function () {
  showTooltip(sendBtn, sendBtnTip);
});
sendBtn.addEventListener("mouseleave", hideTooltip);
attachBtn.addEventListener("mouseenter", function () {
  showTooltip(attachBtn, t("Add file or folder"));
});
attachBtn.addEventListener("mouseleave", hideTooltip);

const OPEN_FILE_HINT = /Mac/i.test(navigator.platform || "")
  ? t("\u2318 Click to open file")
  : t("Ctrl+Click to open file");

function toolHeadOfFile(target: HTMLElement): HTMLElement | null {
  if (!target || !target.closest) return null;
  const node = target.closest(".tool-block[data-has-file] > .tool-head") as HTMLElement;
  return node || null;
}

let fileHintHead: HTMLElement | null = null;
let fileHintTimer: number | null = null;

messagesEl.addEventListener("mouseover", function (ev: MouseEvent) {
  const head = toolHeadOfFile(ev.target as HTMLElement);
  if (head !== fileHintHead) {
    if (fileHintTimer) {
      clearTimeout(fileHintTimer);
      fileHintTimer = null;
    }
    hideTooltip();
    fileHintHead = head;
    if (head) {
      fileHintTimer = window.setTimeout(function () {
        showTooltip(head, OPEN_FILE_HINT);
      }, 500);
    }
  }
});

messagesEl.addEventListener("mouseout", function (ev: MouseEvent) {
  if (fileHintHead && !toolHeadOfFile(ev.relatedTarget as HTMLElement)) {
    if (fileHintTimer) {
      clearTimeout(fileHintTimer);
      fileHintTimer = null;
    }
    fileHintHead = null;
    hideTooltip();
  }
});

document.addEventListener("keydown", function (e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) document.body.classList.add("ctrl-key");
});
document.addEventListener("keyup", function (e: KeyboardEvent) {
  if (!e.ctrlKey && !e.metaKey) document.body.classList.remove("ctrl-key");
});
window.addEventListener("blur", function () {
  document.body.classList.remove("ctrl-key");
});

// ---- message window listener ----
window.addEventListener("message", function (e: MessageEvent) {
  const d = e.data;
  if (!d || typeof d !== "object") return;
  switch (d.type) {
    case "state":
      applyState(d.state);
      break;
    case "sessionInfo":
      sessionInfoEl.textContent = d.label || "";
      if ("sessionFile" in d) {
        state.sessionFile = d.sessionFile || null;
        updateRefreshBtn();
      }
      break;
    case "models":
      models.length = 0;
      if (d.models) {
        for (let i = 0; i < d.models.length; i++) models.push(d.models[i]);
      }
      renderModels();
      break;
    case "enabledModels":
      setEnabledModelKeys(d.keys || []);
      if (modelPopupOpen) renderModelList();
      break;
    case "thinkingLevels":
      thinkingLevels.length = 0;
      if (d.levels) {
        for (let i = 0; i < d.levels.length; i++) thinkingLevels.push(d.levels[i]);
      }
      renderThinking();
      break;
    case "permissionMode":
      permissionSelect.value = d.mode || "AskForApproval";
      fitPermissionSelect();
      updatePermissionColor(permissionSelect.value);
      break;
    case "sendShortcut":
      setSendShortcut(d.value);
      break;
    case "commands":
      commands.length = 0;
      if (d.commands) {
        for (let i = 0; i < d.commands.length; i++) commands.push(d.commands[i]);
      }
      break;
    case "messages":
      queueState.steering = [];
      queueState.followUp = [];
      renderQueue();
      hydrateMessages(d.messages);
      break;
    case "event":
      handleEvent(d.event);
      break;
    case "pickedResources":
      insertPickedResources(d.paths);
      break;
    case "prefillInput":
      inputEl.value = d.text || "";
      autoGrow();
      updateSendButton();
      inputEl.focus();
      break;
    case "files":
      applyFileResults(d.query, d.files);
      break;
    case "widget":
      if (d.widgetKey === "btw") handleBtw(d.widgetLines);
      else if (d.widgetKey === "rewind-files") applyRewindWidget(d.widgetLines);
      else applyWidget(d.widgetKey, d.widgetLines);
      break;
    case "btwAbortReady":
      setBtwAbortId(d.id);
      setBtwLoading(true);
      break;
    case "contextUsage":
      applyContextUsage(d.usage, d.cost);
      break;
    case "toast":
      showToast(d.text, d.kind);
      break;
    case "infoPanel":
      showInfoPanel(d.title, d.markdown);
      break;
    case "mcpStatus":
      setMcpStatus(d.servers);
      openMcpDrawer();
      break;
    case "dialog":
      showDialog(d.request);
      break;
    case "error":
      setStreaming(false);
      const eb = el("div", "error-banner");
      eb.textContent = d.message || "Error";
      messagesInner.appendChild(eb);
      scrollToBottom();
      break;
    default:
      break;
  }
});

// ---- init ----
autoGrow();
updateSendButton();
applyContextUsage(null);
clearMessages();
renderPermission();
renderModels();
renderThinking();
