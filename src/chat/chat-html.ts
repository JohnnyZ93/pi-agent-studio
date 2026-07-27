import mditSrc from "./vendor/markdown-it.min.js?raw";

export function getChatHtml(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en" style="height:100%;margin:0;padding:0">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; padding: 0; }
body {
  font-family: var(--vscode-font-family);
  font-size: 13px;
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}
.app { display: flex; flex-direction: column; height: 100%; width: 100%; max-width: 920px; }

.toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border, transparent));
  background: var(--vscode-sideBar-background, var(--vscode-editor-background));
}
.composer-box {
  border: 1px solid var(--vscode-input-border, var(--vscode-widget-border, transparent));
  border-radius: 8px;
  background: var(--vscode-input-background);
  display: flex;
  flex-direction: column;
  transition: border-color 0.12s;
}
.composer-box:focus-within { border-color: var(--vscode-focusBorder); }
.composer-controls-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px 4px;
}
.composer-spacer { flex: 1 1 auto; min-width: 4px; }
.ctx-ring {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.ctx-ring svg { width: 14px; height: 14px; transform: rotate(-90deg); display: block; }
.ctx-ring-track { fill: none; stroke: currentColor; stroke-width: 2; opacity: 0.3; }
.ctx-ring-prog {
  fill: none;
  stroke: var(--vscode-button-background);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  transition: stroke-dashoffset 0.3s ease;
}
.ctx-tooltip {
  position: fixed;
  z-index: 50;
  padding: 3px 8px;
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
  color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
  border: 1px solid var(--vscode-widget-border, transparent);
  border-radius: 4px;
  font-size: 11px;
  font-family: var(--vscode-font-family);
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
}
.select-wrap { position: relative; display: inline-flex; align-items: center; }
.select-wrap::after {
  content: "";
  position: absolute;
  right: 5px;
  top: 50%;
  margin-top: -2px;
  width: 0; height: 0;
  border-left: 3px solid transparent;
  border-right: 3px solid transparent;
  border-top: 4px solid currentColor;
  opacity: 0.55;
  pointer-events: none;
}
.select-borderless {
  min-width: 0;
  max-width: 200px;
  background: transparent;
  color: var(--vscode-foreground);
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  padding: 3px 16px 3px 6px;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}
.thinking-select.select-borderless { max-width: 92px; }
.select-borderless:hover { background: var(--vscode-toolbar-hoverBackground); }
.select-borderless:focus { background: var(--vscode-toolbar-hoverBackground); }
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  cursor: pointer;
  background: transparent;
  color: var(--vscode-foreground);
  border: none;
  border-radius: 5px;
  outline: none;
  flex-shrink: 0;
}
.icon-btn svg { width: 16px; height: 16px; display: block; }
.icon-btn:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground); }
.icon-btn:disabled { opacity: 0.4; cursor: default; }
.toolbar button {
  padding: 2px 8px;
  cursor: pointer;
  background: var(--vscode-button-secondaryBackground, transparent);
  color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
  border: 1px solid var(--vscode-widget-border, transparent);
  border-radius: 3px;
  font-size: 12px;
  font-family: inherit;
  white-space: nowrap;
}
.toolbar button:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground); }
.toolbar button:disabled { opacity: 0.4; cursor: default; }
.toolbar .session-info {
  font-size: 12px;
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 auto;
  min-width: 0;
}
.toolbar .status {
  font-size: 11px;
  opacity: 0.7;
  margin-left: auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.msg { display: flex; flex-direction: column; gap: 6px; max-width: 100%; }
.msg.user { align-items: flex-end; }
.msg.assistant { align-items: stretch; }

.bubble {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}
.user-bubble {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
.assistant .text-block { line-height: 1.55; padding: 2px 0; font-size: 13px; }
.text-block > :last-child { margin-bottom: 0; }
.text-block p { margin: 0 0 8px; }
.text-block h1 { font-size: 1.4em; margin: 14px 0 8px; font-weight: 600; }
.text-block h2 { font-size: 1.25em; margin: 12px 0 6px; font-weight: 600; }
.text-block h3 { font-size: 1.1em; margin: 10px 0 6px; font-weight: 600; }
.text-block h4, .text-block h5, .text-block h6 { font-size: 1em; margin: 8px 0 4px; font-weight: 600; }
.text-block ul, .text-block ol { margin: 0 0 8px; padding-left: 22px; }
.text-block li { margin: 2px 0; }
.text-block a { color: var(--vscode-textLink-foreground); }
.text-block blockquote { margin: 0 0 8px; padding: 2px 10px; border-left: 3px solid var(--vscode-textBlockQuote-border, var(--vscode-widget-border, transparent)); color: var(--vscode-textBlockQuote-foreground, inherit); }
.text-block code { font-family: var(--vscode-editor-font-family); font-size: 0.92em; background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.1)); padding: 1px 4px; border-radius: 3px; }
.text-block pre { margin: 0 0 8px; padding: 8px 10px; background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.08)); border-radius: 4px; overflow-x: auto; }
.text-block pre code { background: none; padding: 0; font-size: 12px; line-height: 1.5; white-space: pre; }
.text-block table { border-collapse: collapse; margin: 0 0 8px; display: block; overflow-x: auto; }
.text-block th, .text-block td { border: 1px solid var(--vscode-widget-border, transparent); padding: 4px 8px; }
.text-block th { background: var(--vscode-list-hoverBackground, rgba(127,127,127,0.1)); font-weight: 600; }
.text-block hr { border: none; border-top: 1px solid var(--vscode-widget-border, transparent); margin: 10px 0; }
.text-block img { max-width: 100%; }
.thinking-block {
  border: 1px solid var(--vscode-widget-border, transparent);
  border-radius: 6px;
  background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.08));
  padding: 4px 8px;
  font-size: 12px;
}
.thinking-block > summary {
  cursor: pointer;
  opacity: 0.75;
  list-style: none;
  user-select: none;
  font-weight: 500;
}
.thinking-block > summary::-webkit-details-marker { display: none; }
.thinking-block > summary:before { content: "\\25B6  Thinking"; font-size: 11px; }
.thinking-block[open] > summary:before { content: "\\25BC  Thinking"; }
.thinking-body {
  margin-top: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  opacity: 0.85;
  line-height: 1.5;
}

.tool-block {
  border: 1px solid var(--vscode-widget-border, transparent);
  border-left: 3px solid var(--vscode-charts-blue, #3794ff);
  border-radius: 4px;
  background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.06));
  overflow: hidden;
}
.tool-block.is-error { border-left-color: var(--vscode-errorForeground, #f48771); }
.tool-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  font-size: 12px;
  background: var(--vscode-list-hoverBackground, rgba(127,127,127,0.1));
  cursor: pointer;
  list-style: none;
  user-select: none;
}
.tool-head::-webkit-details-marker { display: none; }
.tool-head:before { content: "\\25BC"; font-size: 9px; opacity: 0.6; }
.tool-block:not([open]) > .tool-head:before { content: "\\25B6"; }
.tool-name { font-weight: 600; font-family: var(--vscode-editor-font-family); }
.tool-status { opacity: 0.6; font-size: 11px; margin-left: auto; }
.tool-args, .tool-result {
  margin: 0;
  padding: 6px 8px;
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
  max-height: 320px;
  overflow-y: auto;
}
.tool-args { border-top: 1px solid var(--vscode-widget-border, transparent); color: var(--vscode-foreground); }
.tool-result { border-top: 1px solid var(--vscode-widget-border, transparent); color: var(--vscode-terminal-ansiGreen, #4ec9b0); }
.tool-block.is-error .tool-result { color: var(--vscode-errorForeground, #f48771); }
.tool-args:empty, .tool-result:empty { display: none; }

.error-banner {
  padding: 6px 10px;
  background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
  color: var(--vscode-inputValidation-errorForeground, #f48771);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}

.composer {
  flex-shrink: 0;
  border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border, transparent));
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  background: var(--vscode-editor-background);
}
.autocomplete {
  position: absolute;
  bottom: 100%;
  left: 8px;
  right: 8px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--vscode-quickInput-background, var(--vscode-dropdown-background));
  border: 1px solid var(--vscode-dropdown-border, var(--vscode-widget-border, transparent));
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  z-index: 10;
}
.autocomplete-item {
  padding: 6px 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 1px;
  border-bottom: 1px solid var(--vscode-widget-border, transparent);
}
.autocomplete-item:last-child { border-bottom: none; }
.autocomplete-item.active { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.autocomplete-item .ac-name { font-weight: 500; font-family: var(--vscode-editor-font-family); font-size: 12px; }
.autocomplete-item .ac-desc { font-size: 11px; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.autocomplete-item .ac-source { font-size: 10px; opacity: 0.5; }

#input {
  width: 100%;
  display: block;
  resize: none;
  min-height: 28px;
  max-height: 200px;
  padding: 8px 10px 2px;
  background: transparent;
  color: var(--vscode-input-foreground);
  border: none;
  border-radius: 8px 8px 0 0;
  font-family: var(--vscode-font-family);
  font-size: 13px;
  line-height: 1.5;
  outline: none;
}
#input::placeholder { color: var(--vscode-input-placeholderForeground, var(--vscode-descriptionForeground)); }
.send-btn {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-radius: 50%;
  margin-left: 6px;
}
.send-btn:hover:not(:disabled):not(.is-stop) { background: var(--vscode-button-hoverBackground); }
.send-btn.is-stop {
  background: var(--vscode-button-secondaryBackground, var(--vscode-toolbar-hoverBackground));
  color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
}
.send-btn.is-stop:hover {
  background: var(--vscode-errorForeground, #f48771);
  color: var(--vscode-editor-background, #1e1e1e);
  filter: brightness(1.12);
}
.hint { font-size: 11px; opacity: 0.5; padding: 0 2px; }

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.dialog {
  width: 460px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
  border: 1px solid var(--vscode-widget-border, transparent);
  border-radius: 8px;
  padding: 14px 16px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dialog h3 { margin: 0; font-size: 14px; }
.dialog p { margin: 0; opacity: 0.85; white-space: pre-wrap; word-break: break-word; }
.dialog .dialog-input, .dialog textarea.dialog-input {
  width: 100%;
  padding: 6px 8px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, var(--vscode-widget-border, transparent));
  border-radius: 4px;
  font-family: var(--vscode-font-family);
  font-size: 13px;
  outline: none;
}
.dialog textarea.dialog-input { min-height: 100px; resize: vertical; }
.dialog .opt-list { display: flex; flex-direction: column; gap: 4px; }
.dialog .opt-btn {
  text-align: left;
  padding: 8px 10px;
  cursor: pointer;
  background: var(--vscode-button-secondaryBackground, transparent);
  color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
  border: 1px solid var(--vscode-widget-border, transparent);
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}
.dialog .opt-btn:hover { background: var(--vscode-list-hoverBackground); }
.dialog .dialog-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 4px; }
.dialog .btn {
  padding: 5px 14px;
  cursor: pointer;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}
.dialog .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.dialog .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
.dialog .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
.empty { text-align: center; opacity: 0.4; padding: 40px 20px; font-size: 13px; }

.ctx-menu {
  position: fixed;
  z-index: 200;
  min-width: 90px;
  background: var(--vscode-menu-background, var(--vscode-quickInput-background, var(--vscode-dropdown-background)));
  border: 1px solid var(--vscode-dropdown-border, var(--vscode-widget-border, transparent));
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  padding: 2px 0;
}
.ctx-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 4px 14px;
  background: transparent;
  color: var(--vscode-foreground);
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
}
.ctx-item:hover:not(:disabled) { background: var(--vscode-list-hoverBackground); }
.ctx-item:disabled { opacity: 0.4; cursor: default; }
</style>
</head>
<body>
<div class="app">
  <div class="toolbar">
    <span class="session-info" id="session-info"></span>
    <span class="status" id="status"></span>
  </div>
  <div class="messages" id="messages">
    <div class="empty">Start chatting with Pi\u2026</div>
  </div>
  <div class="composer">
    <div class="autocomplete" id="autocomplete" style="display:none"></div>
    <div class="composer-box">
      <textarea id="input" rows="1" placeholder="Send a message\u2026  (use / for commands, Shift+Enter for newline)"></textarea>
      <div class="composer-controls-bar">
        <button id="attach-btn" class="icon-btn" type="button" title="Add file or folder"></button>
        <div class="composer-spacer"></div>
        <span class="ctx-ring" id="ctx-ring" title="Context usage"><svg viewBox="0 0 16 16"><circle class="ctx-ring-track" cx="8" cy="8" r="6"></circle><circle class="ctx-ring-prog" id="ctx-ring-prog" cx="8" cy="8" r="6" pathLength="100"></circle></svg></span>
        <div class="select-wrap"><select id="model-select" class="select-borderless" title="Model"></select></div>
        <div class="select-wrap"><select id="thinking-select" class="select-borderless thinking-select" title="Thinking level"></select></div>
        <button id="send" class="icon-btn send-btn" type="button" title="Send message"></button>
      </div>
    </div>
    <div class="hint" id="hint"></div>
  </div>
</div>
<div class="overlay" id="overlay" style="display:none"></div>
<div class="ctx-menu" id="ctx-menu" style="display:none"><button class="ctx-item" id="ctx-copy" type="button">Copy</button></div>
<script>
${mditSrc}
</script>
<script>
var vscode = acquireVsCodeApi();
var md = window.markdownit({ html: false, breaks: true, linkify: true });

var models = [];
var thinkingLevels = [];
var commands = [];
var state = { model: null, thinkingLevel: 'medium', isStreaming: false, sessionFile: null };

var ICON_PLUS = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3.5v9M3.5 8h9"/></svg>';
var ICON_SEND = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12.5V4M4.5 7.5L8 4l3.5 3.5"/></svg>';
var ICON_STOP = '<svg viewBox="0 0 16 16"><rect x="4.5" y="4.5" width="7" height="7" rx="1.4" fill="currentColor"/></svg>';
var messagesEl = document.getElementById('messages');
var inputEl = document.getElementById('input');
var sendBtn = document.getElementById('send');
var attachBtn = document.getElementById('attach-btn');
attachBtn.innerHTML = ICON_PLUS;
var modelSelect = document.getElementById('model-select');
var ctxRing = document.getElementById('ctx-ring');
var ctxRingProg = document.getElementById('ctx-ring-prog');
var ctxRingText = '';
var thinkingSelect = document.getElementById('thinking-select');
var statusEl = document.getElementById('status');
var sessionInfoEl = document.getElementById('session-info');
var hintEl = document.getElementById('hint');
var acEl = document.getElementById('autocomplete');
var overlayEl = document.getElementById('overlay');

var acItems = [];
var acIndex = -1;

// ---- helpers ----
function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }
function setStatus(t) { statusEl.textContent = t || ''; }
function updateSendButton() {
  if (state.isStreaming) {
    sendBtn.innerHTML = ICON_STOP;
    sendBtn.classList.add('is-stop');
    sendBtn.title = 'Stop generation';
    sendBtn.disabled = false;
  } else {
    sendBtn.innerHTML = ICON_SEND;
    sendBtn.classList.remove('is-stop');
    sendBtn.title = 'Send message';
    sendBtn.disabled = !inputEl.value.trim();
  }
}
function setStreaming(b) {
  state.isStreaming = b;
  updateSendButton();
  attachBtn.disabled = b;
  if (!b && !statusEl.textContent) setStatus('');
}
function showHint(t) { hintEl.textContent = t || ''; }

function formatTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'm';
  if (n >= 100000) return Math.round(n / 1000) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}
function applyContextUsage(usage) {
  if (!ctxRingProg || !ctxRing) return;
  var pct = (usage && typeof usage.percent === 'number') ? usage.percent : 0;
  if (pct < 0) pct = 0; else if (pct > 100) pct = 100;
  ctxRingProg.style.strokeDashoffset = String(100 - pct);
  var tokens = (usage && typeof usage.tokens === 'number') ? usage.tokens : null;
  var cw = (usage && typeof usage.contextWindow === 'number') ? usage.contextWindow : null;
  if (tokens != null && cw != null) {
    ctxRingText = formatTokens(tokens) + '/' + formatTokens(cw) + ' tokens';
  } else {
    ctxRingText = '';
  }
}

function clearMessages() {
  messagesEl.innerHTML = '<div class="empty">Start chatting with Pi\u2026</div>';
}

// ---- message DOM ----
var currentAssistant = null; // { el, blocks: [] }

function addUserMessage(text) {
  var empty = messagesEl.querySelector('.empty');
  if (empty) empty.remove();
  var row = el('div', 'msg user');
  var bubble = el('div', 'bubble user-bubble');
  bubble.textContent = text;
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollToBottom();
}

function startAssistantMessage() {
  var empty = messagesEl.querySelector('.empty');
  if (empty) empty.remove();
  var row = el('div', 'msg assistant');
  messagesEl.appendChild(row);
  currentAssistant = { el: row, blocks: [] };
  scrollToBottom();
}

function collapseThinking() {
  if (!currentAssistant) return;
  for (var i = 0; i < currentAssistant.blocks.length; i++) {
    var b = currentAssistant.blocks[i];
    if (b && b.type === 'thinking') b.el.removeAttribute('open');
  }
}
function endAssistantMessage() {
  collapseThinking();
  if (currentAssistant) { currentAssistant = null; }
}

function ensureBlock(ci, type) {
  if (!currentAssistant) startAssistantMessage();
  var blocks = currentAssistant.blocks;
  while (blocks.length <= ci) blocks.push(null);
  var b = blocks[ci];
  if (b && b.type === type) return b;
  b = createBlock(type);
  blocks[ci] = b;
  currentAssistant.el.appendChild(b.el);
  return b;
}

function createBlock(type) {
  if (type === 'text') {
    var t = el('div', 'text-block');
    return { type: 'text', el: t, text: '', textEl: t };
  }
  if (type === 'thinking') {
    var det = el('details', 'thinking-block');
    det.setAttribute('open', '');
    det.appendChild(el('summary', ''));
    var body = el('div', 'thinking-body');
    det.appendChild(body);
    return { type: 'thinking', el: det, text: '', textEl: body };
  }
  // toolcall
  var wrap = el('details', 'tool-block');
  var head = el('summary', 'tool-head');
  var name = el('span', 'tool-name');
  name.textContent = 'tool';
  var st = el('span', 'tool-status');
  head.appendChild(name);
  head.appendChild(st);
  var args = el('pre', 'tool-args');
  var result = el('pre', 'tool-result');
  wrap.appendChild(head);
  wrap.appendChild(args);
  wrap.appendChild(result);
  return { type: 'toolcall', el: wrap, nameEl: name, statusEl: st, argsEl: args, resultEl: result, toolCallId: null, name: 'tool', argsText: '' };
}

function renderMarkdown(target, text) {
  target._piMd = text;
  try { target.innerHTML = md.render(text); } catch (e) { target.textContent = text; }
}
function appendTextDelta(ci, delta) {
  var b = ensureBlock(ci, 'text');
  b.text += delta;
  renderMarkdown(b.textEl, b.text);
  scrollToBottom();
}
function appendThinkingDelta(ci, delta) {
  var b = ensureBlock(ci, 'thinking');
  b.text += delta;
  b.textEl.textContent = b.text;
  scrollToBottom();
}
function appendToolCallDelta(ci, delta) {
  var b = ensureBlock(ci, 'toolcall');
  b.argsText += delta;
  b.argsEl.textContent = b.argsText;
  scrollToBottom();
}
function finalizeToolCall(ci, toolCall) {
  var b = ensureBlock(ci, 'toolcall');
  if (toolCall) {
    if (toolCall.name) { b.name = toolCall.name; b.nameEl.textContent = toolCall.name; }
    if (toolCall.id) { b.toolCallId = toolCall.id; b.el.setAttribute('data-tcid', toolCall.id); }
    var args = toolCall.arguments;
    if (args !== undefined && args !== null) {
      b.argsText = typeof args === 'string' ? args : JSON.stringify(args, null, 2);
      b.argsEl.textContent = b.argsText;
    }
  }
}

function findToolBlock(toolCallId) {
  var children = messagesEl.querySelectorAll('.tool-block[data-tcid="' + cssEscape(toolCallId) + '"]');
  if (children.length) {
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      if (c._block) return c._block;
      // reconstruct minimal ref
      return { el: c, statusEl: c.querySelector('.tool-status'), argsEl: c.querySelector('.tool-args'), resultEl: c.querySelector('.tool-result') };
    }
  }
  // fall back to currentAssistant blocks
  if (currentAssistant) {
    for (var j = 0; j < currentAssistant.blocks.length; j++) {
      var bb = currentAssistant.blocks[j];
      if (bb && bb.type === 'toolcall' && bb.toolCallId === toolCallId) return bb;
    }
  }
  return null;
}
function cssEscape(s) { return String(s).replace(/["\\\\]/g, '\\\\$&'); }

function startToolExecution(ev) {
  var tcid = ev.toolCallId;
  var b = findToolBlock(tcid);
  if (!b) {
    // create a standalone tool block in a new assistant row
    startAssistantMessage();
    b = ensureBlock(0, 'toolcall');
    b.toolCallId = tcid;
    b.el.setAttribute('data-tcid', tcid);
  }
  if (ev.toolName) { b.name = ev.toolName; b.nameEl ? (b.nameEl.textContent = ev.toolName) : null; }
  b.el._block = b;
  b.el.setAttribute('open', '');
  if (b.statusEl) b.statusEl.textContent = 'running';
  if (ev.args !== undefined && ev.args !== null && b.argsEl && !b.argsText) {
    b.argsText = typeof ev.args === 'string' ? ev.args : JSON.stringify(ev.args, null, 2);
    b.argsEl.textContent = b.argsText;
  }
  scrollToBottom();
}
function updateToolExecution(ev) {
  var b = findToolBlock(ev.toolCallId);
  if (!b || !b.resultEl) return;
  var pr = ev.partialResult;
  if (pr && pr.content) {
    var txt = '';
    if (Array.isArray(pr.content)) {
      for (var i = 0; i < pr.content.length; i++) {
        var c = pr.content[i];
        txt += (typeof c === 'string' ? c : (c && c.text ? c.text : ''));
      }
    } else if (typeof pr.content === 'string') {
      txt = pr.content;
    }
    if (txt) b.resultEl.textContent = txt;
  }
}
function endToolExecution(ev) {
  var b = findToolBlock(ev.toolCallId);
  if (!b) return;
  if (b.statusEl) b.statusEl.textContent = ev.isError ? 'error' : 'done';
  if (ev.isError) b.el.classList.add('is-error');
  var r = ev.result;
  if (r && r.content && b.resultEl) {
    var txt = '';
    if (Array.isArray(r.content)) {
      for (var i = 0; i < r.content.length; i++) {
        var c = r.content[i];
        txt += (typeof c === 'string' ? c : (c && c.text ? c.text : ''));
      }
    } else if (typeof r.content === 'string') {
      txt = r.content;
    }
    if (txt) b.resultEl.textContent = txt;
  }
  b.el.removeAttribute('open');
  scrollToBottom();
}

// ---- hydrate from get_messages ----
function hydrateMessages(list) {
  messagesEl.innerHTML = '';
  if (!list || !list.length) {
    clearMessages();
    return;
  }
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    if (!m || typeof m !== 'object') continue;
    var role = m.role;
    if (role === 'user') {
      addUserMessage(extractText(m.content));
    } else if (role === 'assistant') {
      startAssistantMessage();
      var content = m.content;
      if (Array.isArray(content)) {
        for (var k = 0; k < content.length; k++) {
          var blk = content[k];
          if (!blk || typeof blk !== 'object') continue;
          if (blk.type === 'text') {
            var tb = ensureBlock(k, 'text');
            tb.text = blk.text || '';
            renderMarkdown(tb.textEl, tb.text);
          } else if (blk.type === 'thinking') {
            var hb = ensureBlock(k, 'thinking');
            hb.text = blk.thinking || '';
            hb.textEl.textContent = hb.text;
          } else if (blk.type === 'toolCall') {
            finalizeToolCall(k, blk);
          }
        }
      }
      endAssistantMessage();
    } else if (role === 'toolResult') {
      var fakeEv = { toolCallId: m.toolCallId, result: { content: m.content }, isError: !!m.isError };
      endToolExecution(fakeEv);
    }
  }
  scrollToBottom();
}
function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    var t = '';
    for (var i = 0; i < content.length; i++) {
      var c = content[i];
      t += (typeof c === 'string' ? c : (c && c.text ? c.text : ''));
    }
    return t;
  }
  return '';
}

// ---- event dispatch ----
function handleAssistantMessageEvent(amev) {
  if (!amev || typeof amev !== 'object') return;
  var t = amev.type;
  var ci = amev.contentIndex || 0;
  if (t === 'text_start') { collapseThinking(); ensureBlock(ci, 'text'); }
  else if (t === 'text_delta') { appendTextDelta(ci, amev.delta || ''); }
  else if (t === 'thinking_start') { ensureBlock(ci, 'thinking'); }
  else if (t === 'thinking_delta') { appendThinkingDelta(ci, amev.delta || ''); }
  else if (t === 'toolcall_start') { collapseThinking(); ensureBlock(ci, 'toolcall'); }
  else if (t === 'toolcall_delta') { appendToolCallDelta(ci, amev.delta || ''); }
  else if (t === 'toolcall_end') { finalizeToolCall(ci, amev.toolCall); }
}
function handleEvent(event) {
  if (!event || typeof event !== 'object') return;
  switch (event.type) {
    case 'agent_start': setStreaming(true); break;
    case 'agent_settled': setStreaming(false); break;
    case 'message_start':
      if (event.message && event.message.role === 'assistant') startAssistantMessage();
      break;
    case 'message_end':
      if (event.message && event.message.role === 'assistant') endAssistantMessage();
      break;
    case 'message_update': handleAssistantMessageEvent(event.assistantMessageEvent); break;
    case 'tool_execution_start': startToolExecution(event); break;
    case 'tool_execution_update': updateToolExecution(event); break;
    case 'tool_execution_end': endToolExecution(event); break;
    case 'compaction_start': setStatus('Compacting\u2026'); break;
    case 'compaction_end': setStatus(''); break;
    case 'auto_retry_start': setStatus('Retrying ' + event.attempt + '/' + event.maxAttempts + '\u2026'); break;
    case 'auto_retry_end': setStatus(''); break;
    default: break;
  }
}

// ---- controls ----
function renderModels() {
  var prev = state.model ? (state.model.provider + '/' + state.model.id) : '';
  modelSelect.innerHTML = '';
  for (var i = 0; i < models.length; i++) {
    var m = models[i];
    var opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = m.name || m.id;
    var key = m.provider + '/' + m.id;
    if (key === prev) opt.selected = true;
    modelSelect.appendChild(opt);
  }
  if (!models.length) {
    var o = document.createElement('option');
    o.textContent = 'No models configured';
    o.value = '';
    modelSelect.appendChild(o);
  }
}
function renderThinking() {
  thinkingSelect.innerHTML = '';
  var levels = thinkingLevels.length ? thinkingLevels : ['off'];
  for (var i = 0; i < levels.length; i++) {
    var opt = document.createElement('option');
    opt.value = levels[i];
    opt.textContent = levels[i];
    if (levels[i] === state.thinkingLevel) opt.selected = true;
    thinkingSelect.appendChild(opt);
  }
}
function applyState(s) {
  if (!s) return;
  state.model = s.model;
  state.thinkingLevel = s.thinkingLevel;
  state.sessionFile = s.sessionFile || null;
  renderModels();
  renderThinking();
}

// ---- autocomplete ----
function currentSlashToken() {
  var val = inputEl.value;
  var pos = inputEl.selectionStart;
  var before = val.slice(0, pos);
  var lineStart = before.lastIndexOf('\\n') + 1;
  var lineTail = before.slice(lineStart);
  if (lineTail.charAt(0) !== '/') return null;
  // only complete when token has no spaces (still typing the command name)
  var token = lineTail.slice(1);
  if (token.indexOf(' ') !== -1) return null;
  return { token: token, lineStart: lineStart, after: inputEl.value.slice(pos) };
}
function updateAutocomplete() {
  var info = currentSlashToken();
  if (!info) { hideAutocomplete(); return; }
  var q = info.token.toLowerCase();
  var matches = [];
  for (var i = 0; i < commands.length; i++) {
    var c = commands[i];
    if (c.name.toLowerCase().indexOf(q) === 0) matches.push(c);
    if (matches.length >= 8) break;
  }
  if (!matches.length) { hideAutocomplete(); return; }
  acItems = matches;
  acIndex = 0;
  renderAutocomplete();
  acEl.style.display = 'block';
}
function renderAutocomplete() {
  acEl.innerHTML = '';
  for (var i = 0; i < acItems.length; i++) {
    var c = acItems[i];
    var item = el('div', 'autocomplete-item' + (i === acIndex ? ' active' : ''));
    item.setAttribute('data-i', String(i));
    var name = el('div', 'ac-name');
    name.textContent = '/' + c.name;
    var desc = el('div', 'ac-desc');
    desc.textContent = c.description || '';
    var src = el('div', 'ac-source');
    src.textContent = c.source;
    item.appendChild(name);
    item.appendChild(desc);
    item.appendChild(src);
    acEl.appendChild(item);
  }
}
function hideAutocomplete() { acEl.style.display = 'none'; acItems = []; acIndex = -1; }
function completeAutocomplete(c) {
  var val = inputEl.value;
  var pos = inputEl.selectionStart;
  var before = val.slice(0, pos);
  var lineStart = before.lastIndexOf('\\n') + 1;
  var after = val.slice(pos);
  var replacement = '/' + c.name + ' ';
  inputEl.value = val.slice(0, lineStart) + replacement + after;
  var newPos = lineStart + replacement.length;
  inputEl.focus();
  try { inputEl.setSelectionRange(newPos, newPos); } catch (e) {}
  hideAutocomplete();
}

// ---- send ----
function sendPrompt() {
  var msg = inputEl.value;
  if (!msg.trim() || state.isStreaming) return;
  inputEl.value = '';
  autoGrow();
  hideAutocomplete();
  addUserMessage(msg);
  setStreaming(true);
  vscode.postMessage({ type: 'prompt', message: msg });
}

function autoGrow() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
}

attachBtn.addEventListener('click', function() {
  if (state.isStreaming) return;
  vscode.postMessage({ type: 'pickResource' });
});
function insertPickedResources(paths) {
  if (!paths || !paths.length) return;
  var text = paths.map(function(p) { return '@' + p + ' '; }).join('\\n');
  var val = inputEl.value;
  var pos = inputEl.selectionStart || val.length;
  var before = val.slice(0, pos);
  var after = val.slice(pos);
  var pre = before.length && !/[\\n\\s]$/.test(before) ? '\\n' : '';
  var post = after.length && !/^[\\n\\s]/.test(after) ? '\\n' : '';
  inputEl.value = before + pre + text + post + after;
  var newPos = (before + pre + text).length;
  inputEl.focus();
  try { inputEl.setSelectionRange(newPos, newPos); } catch (e) {}
  autoGrow();
  updateSendButton();
}

// ---- context menu (copy) ----
var ctxMenu = document.getElementById('ctx-menu');
var ctxCopy = document.getElementById('ctx-copy');
var ctxText = '';
var COPYABLE = '.user-bubble, .text-block, .thinking-body';
function showCtxMenu(x, y, text) {
  ctxText = text || '';
  ctxCopy.disabled = !ctxText;
  ctxMenu.style.display = 'block';
  ctxMenu.style.left = '0px';
  ctxMenu.style.top = '0px';
  var rect = ctxMenu.getBoundingClientRect();
  var left = Math.min(x, window.innerWidth - rect.width - 4);
  var top = Math.min(y, window.innerHeight - rect.height - 4);
  ctxMenu.style.left = Math.max(4, left) + 'px';
  ctxMenu.style.top = Math.max(4, top) + 'px';
}
function hideCtxMenu() { ctxMenu.style.display = 'none'; }
messagesEl.addEventListener('contextmenu', function(ev) {
  var sel = window.getSelection();
  var text = sel && sel.toString();
  if (!text) {
    var node = ev.target;
    while (node && node !== messagesEl && node !== document) {
      if (node.matches && node.matches(COPYABLE)) { text = node._piMd || node.textContent || ''; break; }
      node = node.parentNode;
    }
  }
  if (!text) { hideCtxMenu(); return; }
  ev.preventDefault();
  showCtxMenu(ev.clientX, ev.clientY, text);
});
ctxCopy.addEventListener('click', function() {
  if (ctxText) vscode.postMessage({ type: 'copy', text: ctxText });
  hideCtxMenu();
});
document.addEventListener('mousedown', function(ev) {
  if (ctxMenu.style.display === 'none') return;
  if (ev.target === ctxMenu || ctxMenu.contains(ev.target)) return;
  hideCtxMenu();
});
messagesEl.addEventListener('scroll', hideCtxMenu, true);
window.addEventListener('blur', hideCtxMenu);

// ---- dialog (tool approval) ----
function showDialog(request) {
  overlayEl.innerHTML = '';
  var box = el('div', 'dialog');
  var method = request.method;
  var title = request.title || (method === 'confirm' ? 'Confirm' : 'Input required');
  var h = el('h3'); h.textContent = title; box.appendChild(h);
  if (request.message) { var p = el('p'); p.textContent = String(request.message); box.appendChild(p); }

  var inputField = null;
  if (method === 'select' && Array.isArray(request.options)) {
    var list = el('div', 'opt-list');
    for (var i = 0; i < request.options.length; i++) {
      (function(opt) {
        var btn = el('button', 'opt-btn');
        btn.textContent = String(opt);
        btn.addEventListener('click', function() { respond(request.id, { value: String(opt) }); });
        list.appendChild(btn);
      })(request.options[i]);
    }
    box.appendChild(list);
  } else if (method === 'confirm') {
    var actions = el('div', 'dialog-actions');
    var no = el('button', 'btn btn-secondary'); no.textContent = 'No';
    no.addEventListener('click', function() { respond(request.id, { confirmed: false }); });
    var yes = el('button', 'btn btn-primary'); yes.textContent = 'Yes';
    yes.addEventListener('click', function() { respond(request.id, { confirmed: true }); });
    actions.appendChild(no); actions.appendChild(yes);
    box.appendChild(actions);
  } else { // input / editor
    inputField = el('textarea', 'dialog-input');
    if (request.prefill) inputField.value = String(request.prefill);
    box.appendChild(inputField);
    var actions2 = el('div', 'dialog-actions');
    var cancel = el('button', 'btn btn-secondary'); cancel.textContent = 'Cancel';
    cancel.addEventListener('click', function() { respond(request.id, { cancelled: true }); });
    var ok = el('button', 'btn btn-primary'); ok.textContent = 'OK';
    ok.addEventListener('click', function() { respond(request.id, { value: inputField.value }); });
    actions2.appendChild(cancel); actions2.appendChild(ok);
    box.appendChild(actions2);
  }
  overlayEl.appendChild(box);
  overlayEl.style.display = 'flex';
  if (inputField) { inputField.focus(); }
}
function respond(id, payload) {
  vscode.postMessage(Object.assign({ type: 'dialogResponse', id: id }, payload));
  overlayEl.style.display = 'none';
  overlayEl.innerHTML = '';
}

// ---- wire up ----
modelSelect.addEventListener('change', function() {
  var idx = Number(modelSelect.value);
  var m = models[idx];
  if (m) vscode.postMessage({ type: 'setModel', provider: m.provider, modelId: m.id });
});
thinkingSelect.addEventListener('change', function() {
  vscode.postMessage({ type: 'setThinking', level: thinkingSelect.value });
});
sendBtn.addEventListener('click', function() {
  if (state.isStreaming) { vscode.postMessage({ type: 'abort' }); return; }
  sendPrompt();
});

inputEl.addEventListener('input', function() { autoGrow(); updateAutocomplete(); updateSendButton(); });
inputEl.addEventListener('keydown', function(ev) {
  if (acItems.length && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
    ev.preventDefault();
    acIndex = (acIndex + (ev.key === 'ArrowDown' ? 1 : -1) + acItems.length) % acItems.length;
    renderAutocomplete();
    return;
  }
  if (acItems.length && (ev.key === 'Enter' || ev.key === 'Tab')) {
    ev.preventDefault();
    completeAutocomplete(acItems[acIndex]);
    return;
  }
  if (ev.key === 'Escape' && acItems.length) { ev.preventDefault(); hideAutocomplete(); return; }
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
    ev.preventDefault();
    sendPrompt();
  }
});
acEl.addEventListener('click', function(ev) {
  var t = ev.target;
  while (t && t !== acEl) {
    if (t.classList && t.classList.contains('autocomplete-item')) {
      var i = Number(t.getAttribute('data-i'));
      if (acItems[i]) { completeAutocomplete(acItems[i]); }
      return;
    }
    t = t.parentNode;
  }
});

window.addEventListener('message', function(e) {
  var d = e.data;
  if (!d || typeof d !== 'object') return;
  switch (d.type) {
    case 'ready': break;
    case 'state': applyState(d.state); break;
    case 'sessionInfo': sessionInfoEl.textContent = d.label || ''; break;
    case 'models': models = d.models || []; renderModels(); break;
    case 'thinkingLevels': thinkingLevels = d.levels || []; renderThinking(); break;
    case 'commands': commands = d.commands || []; break;
    case 'messages': hydrateMessages(d.messages); break;
    case 'event': handleEvent(d.event); break;
    case 'pickedResources': insertPickedResources(d.paths); break;
    case 'contextUsage': applyContextUsage(d.usage); break;
    case 'dialog': showDialog(d.request); break;
    case 'error':
      setStreaming(false);
      var eb = el('div', 'error-banner');
      eb.textContent = d.message || 'Error';
      messagesEl.appendChild(eb);
      scrollToBottom();
      break;
    default: break;
  }
});

var ctxTooltip = document.createElement('div');
ctxTooltip.className = 'ctx-tooltip';
ctxTooltip.style.display = 'none';
document.body.appendChild(ctxTooltip);
function showCtxTooltip() {
  if (!ctxRingText) return;
  ctxTooltip.textContent = ctxRingText;
  ctxTooltip.style.display = 'block';
  var r = ctxRing.getBoundingClientRect();
  ctxTooltip.style.left = (r.left + r.width / 2 - ctxTooltip.offsetWidth / 2) + 'px';
  ctxTooltip.style.top = (r.top - ctxTooltip.offsetHeight - 6) + 'px';
}
function hideCtxTooltip() { ctxTooltip.style.display = 'none'; }
ctxRing.addEventListener('mouseenter', showCtxTooltip);
ctxRing.addEventListener('mouseleave', hideCtxTooltip);

autoGrow();
updateSendButton();
applyContextUsage(null);
</script>
</body></html>`;
}
