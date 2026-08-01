export function getCoreJs(home?: string, sep?: string): string {
  return `var vscode = acquireVsCodeApi();
var md = window.markdownit({ html: false, breaks: true, linkify: true });

var models = [];
var thinkingLevels = [];
var commands = [];
var BUILTIN_CMDS = { compact: 1, autocompact: 1, session: 1, name: 1, changelog: 1, clear: 1, new: 1 };
var state = { model: null, thinkingLevel: 'medium', isStreaming: false, isBtwLoading: false, sessionFile: null };
var retryAttempt = 0;
var inputHistory = [];
var historyIndex = -1;
var historyDraft = '';
var pendingImages = [];

var ICON_PLUS = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3.5v9M3.5 8h9"/></svg>';
var ICON_SEND = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12.5V4M4.5 7.5L8 4l3.5 3.5"/></svg>';
var ICON_STOP = '<svg viewBox="0 0 16 16"><rect x="4.5" y="4.5" width="7" height="7" rx="1.4" fill="currentColor"/></svg>';
var ICON_TODO = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5l1.5 1.5L6.5 3.5"/><path d="M2.5 10l1.5 1.5L6.5 8.5"/><path d="M9 4.5h4.5"/><path d="M9 10h4.5"/></svg>';
var ICON_CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-6.5"/></svg>';
var ICON_INFO = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.25"/><path d="M8 7.2v4"/><path d="M8 4.8h.01"/></svg>';
var ICON_REFRESH = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8a6 6 0 0 1 6-6 6.5 6.5 0 0 1 4.5 1.8L14 5.3"/><path d="M14 2v3.3h-3.3"/><path d="M14 8a6 6 0 0 1-6 6 6.5 6.5 0 0 1-4.5-1.8L2 10.7"/><path d="M2 14v-3.3h3.3"/></svg>';
var EMPTY_HTML = '<div class="empty">'
  + '<div class="empty-logo"><svg viewBox="0 0 800 800" fill="currentColor"><path fill-rule="evenodd" d="M165.29 165.29H517.36V400H400V517.36H282.65V634.72H165.29ZM282.65 282.65V400H400V282.65Z"/><path d="M517.36 400H634.72V634.72H517.36Z"/></svg></div>'
  + '<div class="empty-line">There are many agent harnesses</div>'
  + '<div class="empty-line">but this one is <span class="empty-accent">yours</span></div>'
  + '<div class="empty-hints">'
  + '<span class="empty-hint"><kbd>Enter</kbd>send / steer</span>'
  + '<span class="empty-hint"><kbd>Shift+Enter</kbd>newline</span>'
  + '<span class="empty-hint"><kbd>Alt+Enter</kbd>follow-up</span>'
  + '<span class="empty-hint"><kbd>\u2191\u2193</kbd>history</span>'
  + '<span class="empty-hint"><kbd>/</kbd>commands</span>'
  + '<span class="empty-hint"><kbd>@</kbd>files</span>'
  + '<span class="empty-hint"><kbd>' + (/Mac/i.test(navigator.platform || '') ? '\u2318V' : 'Ctrl+V') + '</kbd>paste image</span>'
  + '<span class="empty-hint"><kbd>Tab</kbd>complete</span>'
  + '</div>'
  + '</div>';
var messagesEl = document.getElementById('messages');
var messagesInner = document.getElementById('messages-inner');
var widgetEl = document.getElementById('widget');
var queueEl = document.getElementById('queue');
var inputEl = document.getElementById('input');
var sendBtn = document.getElementById('send');
var attachBtn = document.getElementById('attach-btn');
var attachPreviewEl = document.getElementById('attach-preview');
attachBtn.innerHTML = ICON_PLUS;
var infoBtn = document.getElementById('info-btn');
infoBtn.innerHTML = ICON_INFO;
var refreshBtn = document.getElementById('refresh-btn');
refreshBtn.innerHTML = ICON_REFRESH;
infoBtn.addEventListener('click', function() {
  vscode.postMessage({ type: 'prompt', message: '/session' });
});
refreshBtn.addEventListener('click', function() {
  if (state.isStreaming) return;
  vscode.postMessage({ type: 'reload' });
});
var modelSelect = document.getElementById('model-select');
var ctxRing = document.getElementById('ctx-ring');
var ctxRingProg = document.getElementById('ctx-ring-prog');
var ctxRingText = '';
var lastCtxUsage = null;
var sessionCost = null;
var latestCacheHitPct = null;
var prevTurn = null;
var thinkingSelect = document.getElementById('thinking-select');
var statusEl = document.getElementById('status');
var sessionInfoEl = document.getElementById('session-info');
var acEl = document.getElementById('autocomplete');
var overlayEl = document.getElementById('overlay');
var toastEl = document.getElementById('toast');

var acItems = [];
var acIndex = -1;
var acMode = 'command';
var acMatchIndices = [];
var fileTimer = null;
var PI_HOME = ${JSON.stringify(home || "")};
var PI_SEP = ${JSON.stringify(sep || "/")};

// ---- helpers ----
function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
function formatTime(ts) {
  if (ts == null || typeof ts !== 'number' || !isFinite(ts)) return '';
  var d = new Date(ts);
  var h = d.getHours();
  var m = d.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  var hr = h % 12; if (hr === 0) hr = 12;
  var mm = m < 10 ? '0' + m : '' + m;
  return hr + ':' + mm + ' ' + ampm;
}
var autoScroll = true;
var programmaticScroll = false;
var scrollBottomBtn = document.getElementById('scroll-bottom-btn');
var STICK_THRESHOLD = 48;
function isAtBottom() {
  return messagesEl.scrollTop + messagesEl.clientHeight >= messagesEl.scrollHeight - STICK_THRESHOLD;
}
function updateScrollBtn() {
  if (autoScroll) scrollBottomBtn.classList.remove('show');
  else scrollBottomBtn.classList.add('show');
}
messagesEl.addEventListener('scroll', function() {
  if (programmaticScroll) { programmaticScroll = false; return; }
  autoScroll = isAtBottom();
  updateScrollBtn();
});
messagesEl.addEventListener('wheel', function(e) {
  programmaticScroll = false;
  if (e.deltaY < 0) {
    autoScroll = false;
    if (scrollRAF) { cancelAnimationFrame(scrollRAF); scrollRAF = null; }
    updateScrollBtn();
  }
}, true);
['keydown', 'mousedown', 'touchstart'].forEach(function(ev) {
  messagesEl.addEventListener(ev, function() { programmaticScroll = false; }, true);
});
scrollBottomBtn.addEventListener('click', scrollToBottom);
var scrollRAF = null;
function forceStickBottom() {
  programmaticScroll = true;
  messagesEl.scrollTop = messagesEl.scrollHeight;
  for (var i = 0; i < pendingTexts.length; i++) {
    var tb = pendingTexts[i];
    if (tb && tb.textEl) tb.textEl.scrollTop = tb.textEl.scrollHeight;
  }
  if (currentAssistant) {
    var blks = currentAssistant.blocks;
    for (var k = 0; k < blks.length; k++) {
      var tk = blks[k];
      if (tk && tk.type === 'thinking' && tk._tnode && tk.textEl) tk.textEl.scrollTop = tk.textEl.scrollHeight;
    }
  }
}
function scheduleScroll() {
  if (scrollRAF) return;
  scrollRAF = requestAnimationFrame(function() {
    scrollRAF = null;
    if (!autoScroll) return;
    forceStickBottom();
  });
}
function scrollToBottom() {
  autoScroll = true;
  programmaticScroll = false;
  if (scrollRAF) { cancelAnimationFrame(scrollRAF); scrollRAF = null; }
  forceStickBottom();
  updateScrollBtn();
}
if (typeof ResizeObserver !== 'undefined' && messagesInner) {
  var stickRO = new ResizeObserver(function() { if (autoScroll) scheduleScroll(); });
  stickRO.observe(messagesInner);
}
function setStatus(t) { statusEl.textContent = t || ''; }
function updateSendButton() {
  if (state.isStreaming || state.isBtwLoading) {
    sendBtn.innerHTML = ICON_STOP;
    sendBtn.classList.add('is-stop');
    sendBtn.title = state.isBtwLoading ? 'Stop /btw' : 'Stop generation';
    sendBtn.disabled = false;
  } else {
    sendBtn.innerHTML = ICON_SEND;
    sendBtn.classList.remove('is-stop');
    sendBtn.title = 'Send message';
    sendBtn.disabled = !inputEl.value.trim() && !pendingImages.length;
  }
}
function setStreaming(b) {
  state.isStreaming = b;
  if (!b) finalizeTextBlocks();
  updateSendButton();
  attachBtn.disabled = b;
  refreshBtn.disabled = b;
  if (!b && !statusEl.textContent) setStatus('');
}
function applyContextUsage(usage, cost) {
  if (!ctxRingProg || !ctxRing) return;
  lastCtxUsage = usage;
  if (cost != null && typeof cost === 'number' && isFinite(cost)) sessionCost = cost;
  var pct = (usage && typeof usage.percent === 'number') ? usage.percent : 0;
  if (pct < 0) pct = 0; else if (pct > 100) pct = 100;
  ctxRingProg.style.strokeDashoffset = String(100 - pct);
  rebuildCtxRingTooltip();
}
function rebuildCtxRingTooltip() {
  var usage = lastCtxUsage;
  var lines = [];
  var tokens = (usage && typeof usage.tokens === 'number') ? usage.tokens : null;
  var cw = (usage && typeof usage.contextWindow === 'number') ? usage.contextWindow : null;
  if (tokens != null && cw != null) {
    var p = (typeof usage.percent === 'number') ? usage.percent : 0;
    if (p < 0) p = 0; else if (p > 100) p = 100;
    lines.push('Usage:   ' + p.toFixed(1) + '%');
    lines.push('Context: ' + formatTokens(tokens) + ' / ' + formatTokens(cw));
  }
  if (latestCacheHitPct != null) {
    lines.push('Cache:   ' + latestCacheHitPct.toFixed(1) + '% hit');
  }
  if (sessionCost != null) {
    lines.push('Cost:    $' + sessionCost.toFixed(3));
  }
  ctxRingText = lines.join('\\n');
}

function clearMessages() {
  messagesInner.innerHTML = EMPTY_HTML;
}

function applyWidget(key, lines) {
  if (!key || !lines || !lines.length) { widgetEl.style.display = 'none'; widgetEl.innerHTML = ''; return; }
  widgetEl.innerHTML = '';
  if (key !== 'todo-list') {
    var pre = el('pre', 'widget-body');
    pre.textContent = lines.join('\\n');
    widgetEl.appendChild(pre);
    widgetEl.style.display = 'block';
    return;
  }
  var payload = {};
  try { payload = JSON.parse(lines[0] || '{}'); } catch (e) {}
  var items = payload.todos || [];
  var doneCount = 0;
  for (var i = 0; i < items.length; i++) if (items[i].done) doneCount++;
  var totalCount = items.length;

  var card = el('div', 'widget-card');
  var head = el('div', 'widget-head');
  var title = el('span', 'widget-title');
  title.innerHTML = ICON_TODO + '<span>Todos</span>';
  head.appendChild(title);
  if (totalCount > 0) {
    var stats = el('span', 'widget-stats');
    stats.textContent = doneCount + '/' + totalCount + ' done';
    head.appendChild(stats);
  }
  if (items.length) {
    var clearBtn = el('button', 'widget-clear');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', function() { vscode.postMessage({ type: 'todoClear' }); });
    head.appendChild(clearBtn);
  }
  card.appendChild(head);
  if (items.length) {
    var list = el('div', 'todo-list');
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var row = el('div', 'todo-item' + (it.done ? ' is-done' : ''));
      var check = el('span', 'todo-check');
      if (it.done) check.innerHTML = ICON_CHECK;
      row.appendChild(check);
      if (it.id) {
        var idSpan = el('span', 'todo-id');
        idSpan.textContent = '#' + it.id;
        row.appendChild(idSpan);
      }
      var txt = el('span', 'todo-text');
      txt.textContent = it.text;
      row.appendChild(txt);
      list.appendChild(row);
    }
    card.appendChild(list);
  }
  widgetEl.appendChild(card);
  widgetEl.style.display = 'block';
}

var queueState = { steering: [], followUp: [] };
function makeQueueItem(text, kind) {
  var item = el('div', 'queue-item' + (kind === 'followUp' ? ' is-followup' : ''));
  var badge = el('span', 'queue-badge');
  badge.textContent = kind === 'followUp' ? 'Follow-up' : 'Steering';
  var txt = el('div', 'queue-text');
  txt.textContent = text;
  txt.title = text;
  item.appendChild(badge);
  item.appendChild(txt);
  return item;
}
function renderQueue() {
  var s = queueState.steering || [];
  var f = queueState.followUp || [];
  if (!s.length && !f.length) { queueEl.style.display = 'none'; queueEl.innerHTML = ''; return; }
  queueEl.innerHTML = '';
  for (var i = 0; i < s.length; i++) queueEl.appendChild(makeQueueItem(s[i], 'steer'));
  for (var j = 0; j < f.length; j++) queueEl.appendChild(makeQueueItem(f[j], 'followUp'));
  queueEl.style.display = 'flex';
}`;
}
