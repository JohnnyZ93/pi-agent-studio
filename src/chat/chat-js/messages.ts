export function getMessagesJs(): string {
  return `// ---- message DOM ----
var currentAssistant = null; // { el, blocks: [] }
var pendingCompactionBlock = null;
var pendingBtwBlock = null;
var btwAbortId = null;
var btwStatusActive = false;
var lastUserBubble = null;

function addUserMessage(text, images) {
  var empty = messagesEl.querySelector('.empty');
  if (empty) empty.remove();
  var row = el('div', 'msg user');
  var bubble = el('div', 'bubble user-bubble');
  if (text) bubble.textContent = text;
  if (images && images.length) {
    var wrap = el('div', 'bubble-imgs');
    for (var i = 0; i < images.length; i++) {
      var im = images[i];
      if (!im || !im.data || !im.mimeType) continue;
      var imgEl = document.createElement('img');
      imgEl.src = 'data:' + im.mimeType + ';base64,' + im.data;
      wrap.appendChild(imgEl);
    }
    bubble.appendChild(wrap);
  }
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  lastUserBubble = bubble;

  if (bubble.scrollHeight > 240) {
    bubble.classList.add('is-collapsible');
    var btn = el('button', 'expand-btn');
    btn.type = 'button';
    btn.textContent = 'Show more';
    btn.addEventListener('click', function() {
      var expanded = bubble.classList.toggle('is-expanded');
      btn.textContent = expanded ? 'Show less' : 'Show more';
    });
    row.appendChild(btn);
  }

  var timeEl = el('span', 'msg-time');
  row.appendChild(timeEl);
  bubble._piTimeEl = timeEl;

  scheduleScroll();
  return bubble;
}
function applyUserBubbleTime(bubble, ts) {
  if (!bubble) return;
  bubble._piTs = ts;
  if (bubble._piTimeEl) bubble._piTimeEl.textContent = formatTime(ts);
}

function addCompactionMessage(m) {
  var empty = messagesEl.querySelector('.empty');
  if (empty) empty.remove();
  var row = el('div', 'msg compaction');
  var det = el('details', 'compaction-block');
  var summ = el('summary', '');
  var label = el('span', 'compaction-label');
  label.textContent = '[compaction]';
  summ.appendChild(label);
  var tokensBefore = (m && typeof m.tokensBefore === 'number') ? m.tokensBefore : null;
  summ.appendChild(document.createTextNode('Compacted from ' + (tokensBefore != null ? tokensBefore.toLocaleString() : '?') + ' tokens'));
  det.appendChild(summ);
  var body = el('div', 'compaction-body text-block');
  renderMarkdown(body, (m && typeof m.summary === 'string') ? m.summary : '');
  det.appendChild(body);
  row.appendChild(det);
  messagesEl.appendChild(row);
  scheduleScroll();
}
function addCompactionPlaceholder() {
  var empty = messagesEl.querySelector('.empty');
  if (empty) empty.remove();
  var row = el('div', 'msg compaction');
  var det = el('details', 'compaction-block');
  det.setAttribute('open', '');
  var summ = el('summary', '');
  var label = el('span', 'compaction-label');
  label.textContent = '[compaction]';
  summ.appendChild(label);
  summ.appendChild(document.createTextNode(' Compacting\u2026'));
  var spin = el('span', 'tool-status is-running');
  summ.appendChild(spin);
  det.appendChild(summ);
  var body = el('div', 'compaction-body');
  body.textContent = 'Summarizing conversation\u2026';
  det.appendChild(body);
  row.appendChild(det);
  messagesEl.appendChild(row);
  pendingCompactionBlock = row;
  scheduleScroll();
}

function setBtwStatus(text) {
  if (text) { setStatus(text); btwStatusActive = true; }
  else if (btwStatusActive) { setStatus(''); btwStatusActive = false; }
}
function setBtwLoading(b) {
  state.isBtwLoading = b;
  if (!b) btwAbortId = null;
  updateSendButton();
}
function addBtwPlaceholder(question, model) {
  var empty = messagesEl.querySelector('.empty');
  if (empty) empty.remove();
  var row = el('div', 'msg btw');
  var det = el('details', 'btw-block');
  det.setAttribute('open', '');
  var summ = el('summary', '');
  var label = el('span', 'btw-label');
  label.textContent = '[btw]';
  summ.appendChild(label);
  var q = el('span', 'btw-q');
  q.textContent = question || '';
  q.title = question || '';
  summ.appendChild(q);
  var spin = el('span', 'tool-status is-running');
  summ.appendChild(spin);
  det.appendChild(summ);
  var body = el('div', 'btw-body btw-loading-text');
  body.textContent = 'Answering' + (model ? ' with ' + model : '') + '\u2026';
  det.appendChild(body);
  row.appendChild(det);
  messagesEl.appendChild(row);
  pendingBtwBlock = row;
  setBtwStatus('Answering /btw' + (model ? ' with ' + model : '') + '\u2026');
  scheduleScroll();
}
function showBtwResult(question, answer) {
  if (!pendingBtwBlock) addBtwPlaceholder(question, '');
  var det = pendingBtwBlock ? pendingBtwBlock.querySelector('.btw-block') : null;
  if (det) {
    var spin = det.querySelector('.tool-status.is-running');
    if (spin) spin.remove();
    var body = det.querySelector('.btw-body');
    if (body) {
      body.classList.remove('btw-loading-text');
      body.classList.add('text-block');
      renderMarkdown(body, answer || '');
    }
  }
  pendingBtwBlock = null;
  setBtwLoading(false);
  setBtwStatus(null);
  scheduleScroll();
}
function clearBtw() {
  if (pendingBtwBlock) { pendingBtwBlock.remove(); pendingBtwBlock = null; }
  setBtwLoading(false);
  setBtwStatus(null);
}
function showBtwError(message) {
  if (pendingBtwBlock) { pendingBtwBlock.remove(); pendingBtwBlock = null; }
  setBtwLoading(false);
  setBtwStatus(null);
  var eb = el('div', 'error-banner');
  eb.textContent = message || 'Error';
  messagesEl.appendChild(eb);
  scrollToBottom();
}
function handleBtw(lines) {
  var payload = {};
  if (lines && lines.length) {
    try { payload = JSON.parse(lines[0] || '{}'); } catch (e) {}
  }
  if (!payload || !payload.phase) { clearBtw(); return; }
  if (payload.phase === 'loading') addBtwPlaceholder(payload.question || '', payload.model || '');
  else if (payload.phase === 'result') showBtwResult(payload.question || '', payload.answer || '');
  else if (payload.phase === 'error') showBtwError(payload.message || '');
  else clearBtw();
}

function startAssistantMessage(ts) {
  var empty = messagesEl.querySelector('.empty');
  if (empty) empty.remove();
  var row = el('div', 'msg assistant');
  messagesEl.appendChild(row);
  row._piTs = ts != null ? ts : null;
  currentAssistant = { el: row, blocks: [], ts: ts != null ? ts : null };
  scheduleScroll();
}

function collapseThinking() {
  if (!currentAssistant) return;
  for (var i = 0; i < currentAssistant.blocks.length; i++) {
    var b = currentAssistant.blocks[i];
    if (b && b.type === 'thinking') {
      b.el.classList.remove('is-running');
      if (!b.el._userToggled) b.el.removeAttribute('open');
    }
  }
}
function endAssistantMessage() {
  collapseThinking();
  finalizeTextBlocks();
  if (currentAssistant) { currentAssistant = null; }
}

function assistantHasToolCalls() {
  if (!currentAssistant) return false;
  for (var i = 0; i < currentAssistant.blocks.length; i++) {
    var b = currentAssistant.blocks[i];
    if (b && b.type === 'toolcall') return true;
  }
  return false;
}
function markAssistantToolErrors(text) {
  if (!currentAssistant) return;
  for (var i = 0; i < currentAssistant.blocks.length; i++) {
    var b = currentAssistant.blocks[i];
    if (b && b.type === 'toolcall') {
      if (b.resultEl) setClamped(b.resultEl, text);
      b.el.classList.add('is-error');
      if (b.statusEl) { b.statusEl.textContent = 'error'; b.statusEl.classList.remove('is-running'); }
    }
  }
}
function appendAssistantError(text) {
  if (!currentAssistant) return;
  var div = el('div', 'msg-error');
  div.textContent = text;
  currentAssistant.el.appendChild(div);
  scheduleScroll();
}
function applyAssistantStopError(stopReason, errorMessage, retryCount) {
  if (stopReason === 'length') {
    appendAssistantError('Error: Model stopped because it reached the maximum output token limit. The response may be incomplete.');
  } else if (stopReason === 'error') {
    var em = errorMessage || 'Unknown error';
    if (assistantHasToolCalls()) markAssistantToolErrors(em);
    else appendAssistantError('Error: ' + em);
  } else if (stopReason === 'aborted') {
    var am = retryCount > 0
      ? 'Aborted after ' + retryCount + ' retry attempt' + (retryCount > 1 ? 's' : '')
      : 'Operation aborted';
    if (assistantHasToolCalls()) markAssistantToolErrors(am);
    else appendAssistantError(am);
  }
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
  if (b.timeEl) {
    if (currentAssistant.ts != null) b.timeEl.textContent = formatTime(currentAssistant.ts);
    currentAssistant.el.appendChild(b.timeEl);
  }
  return b;
}

function createBlock(type) {
  if (type === 'text') {
    var t = el('div', 'text-block');
    var ttime = el('span', 'msg-time');
    return { type: 'text', el: t, text: '', textEl: t, timeEl: ttime };
  }
  if (type === 'thinking') {
    var det = el('details', 'thinking-block');
    det.setAttribute('open', '');
    var tSumm = el('summary', '');
    det.appendChild(tSumm);
    var body = el('div', 'thinking-body');
    det.appendChild(body);
    tSumm.addEventListener('click', function() { det._userToggled = true; });
    return { type: 'thinking', el: det, text: '', textEl: body };
  }
  // toolcall
  var wrap = el('details', 'tool-block');
  var head = el('summary', 'tool-head');
  var name = el('span', 'tool-name');
  name.textContent = 'tool';
  var summary = el('span', 'tool-summary');
  var st = el('span', 'tool-status');
  head.appendChild(name);
  head.appendChild(summary);
  head.appendChild(st);
  var argsPre = el('pre', 'tool-args');
  var resultPre = el('pre', 'tool-result');
  wrap.appendChild(head);
  wrap.appendChild(argsPre);
  wrap.appendChild(resultPre);
  var b = { type: 'toolcall', el: wrap, nameEl: name, summaryEl: summary, statusEl: st, argsEl: argsPre, resultEl: resultPre, toolCallId: null, name: 'tool', argsText: '', filePath: null, fileLine: null };
  head.addEventListener('click', function(ev) {
    wrap._userToggled = true;
    if ((ev.ctrlKey || ev.metaKey) && b.filePath) {
      ev.preventDefault();
      ev.stopPropagation();
      vscode.postMessage({ type: 'openFile', filePath: b.filePath, line: b.fileLine != null ? b.fileLine : null });
    }
  });
  return b;
}

function renderMarkdown(target, text) {
  target._piMd = text;
  try { target.innerHTML = md.render(text); } catch (e) { target.textContent = text; }
}
function applyTextCollapsible(b) {
  var textEl = b.textEl;
  if (!textEl || !textEl.parentNode) return;
  if (textEl._expandBtn) { textEl._expandBtn.remove(); textEl._expandBtn = null; }
  textEl.classList.remove('is-collapsible');
  textEl.classList.remove('is-expanded');
  if (textEl.scrollHeight <= 360) return;
  textEl.classList.add('is-collapsible');
  var btn = el('button', 'expand-btn');
  btn.type = 'button';
  btn.textContent = 'Show more';
  btn.addEventListener('click', function() {
    var expanded = textEl.classList.toggle('is-expanded');
    btn.textContent = expanded ? 'Show less' : 'Show more';
  });
  var host = b.el ? b.el.parentNode : textEl.parentNode;
  var ref = b.el ? b.el.nextSibling : textEl.nextSibling;
  host.insertBefore(btn, ref);
  textEl._expandBtn = btn;
}


var MAX_INLINE = 12000;
function setClamped(preEl, text) {
  text = typeof text === 'string' ? text : '';
  if (text.length > MAX_INLINE) {
    preEl.textContent = text.slice(0, MAX_INLINE) + ' ... (truncated, ' + (text.length - MAX_INLINE) + ' more chars)';
  } else {
    preEl.textContent = text;
  }
}
function extractToolResultText(content) {
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
function appendToolResultImages(resultEl, content) {
  if (!Array.isArray(content) || !resultEl) return;
  for (var i = 0; i < content.length; i++) {
    var c = content[i];
    if (c && c.type === 'image' && c.data && c.mimeType) {
      var img = document.createElement('img');
      img.src = 'data:' + c.mimeType + ';base64,' + c.data;
      resultEl.appendChild(img);
    }
  }
}
function parseDiffLine(line) {
  if (typeof line !== 'string' || line.length === 0) return null;
  var prefix = line.charAt(0);
  if (prefix !== '+' && prefix !== '-' && prefix !== ' ') return null;
  var rest = line.slice(1);
  var i = 0;
  while (i < rest.length) {
    var cc = rest.charCodeAt(i);
    if (cc === 32 || (cc >= 48 && cc <= 57)) i++; else break;
  }
  var lineNum = rest.slice(0, i);
  var content = rest.slice(i);
  if (content.charAt(0) === ' ') content = content.slice(1);
  return { prefix: prefix, lineNum: lineNum, content: content };
}
function renderToolDiff(resultEl, diffText) {
  if (!resultEl) return;
  resultEl._piMd = null;
  resultEl.textContent = '';
  var lines = String(diffText || '').split(String.fromCharCode(10));
  var wrap = el('div', 'diff-block');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var parsed = parseDiffLine(line);
    var row = el('div', 'diff-line');
    var sign = el('span', 'diff-sign');
    var gutter = el('span', 'diff-gutter');
    var content = el('span', 'diff-content');
    if (!parsed) {
      row.classList.add('context');
      sign.textContent = ' ';
      gutter.textContent = '';
      content.textContent = line;
    } else if (parsed.prefix === '+') {
      row.classList.add('added');
      sign.textContent = '+';
      gutter.textContent = parsed.lineNum.trim();
      content.textContent = parsed.content;
    } else if (parsed.prefix === '-') {
      row.classList.add('removed');
      sign.textContent = '-';
      gutter.textContent = parsed.lineNum.trim();
      content.textContent = parsed.content;
    } else if (parsed.content === '...' && parsed.lineNum.trim() === '') {
      row.classList.add('hunk');
      sign.textContent = ' ';
      gutter.textContent = '';
      content.textContent = '...';
    } else {
      row.classList.add('context');
      sign.textContent = ' ';
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
function renderWriteContent(argsEl, args) {
  if (!argsEl) return;
  argsEl._piMd = null;
  argsEl.textContent = '';
  var parsed = args;
  if (typeof args === 'string') { try { parsed = JSON.parse(args); } catch (e) { parsed = null; } }
  var content = parsed && typeof parsed.content === 'string' ? parsed.content : '';
  if (!content) return;
  var lines = content.split(String.fromCharCode(10));
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (!lines.length) return;
  var wrap = el('div', 'code-block');
  var width = String(lines.length).length;
  for (var i = 0; i < lines.length; i++) {
    var numStr = String(i + 1);
    while (numStr.length < width) numStr = ' ' + numStr;
    var row = el('div', 'code-line');
    var gutter = el('span', 'code-gutter');
    gutter.textContent = numStr;
    var code = el('span', 'code-content');
    code.textContent = lines[i];
    row.appendChild(gutter);
    row.appendChild(code);
    wrap.appendChild(row);
  }
  argsEl.appendChild(wrap);
}

var pendingTexts = [];
function finalizeTextBlocks() {
  for (var i = 0; i < pendingTexts.length; i++) {
    var b = pendingTexts[i];
    b.finalized = true;
    b._pending = false;
    if (b._tnode) b._tnode = null;
    if (b.textEl) b.textEl.classList.remove('is-streaming');
    renderMarkdown(b.textEl, b.text);
    applyTextCollapsible(b);
  }
  pendingTexts = [];
  if (autoScroll) scheduleScroll();
}
function appendTextDelta(ci, delta) {
  var b = ensureBlock(ci, 'text');
  b.text += delta;
  if (b.finalized) { renderMarkdown(b.textEl, b.text); applyTextCollapsible(b); scheduleScroll(); return; }
  if (!b._pending) { b._pending = true; pendingTexts.push(b); }
  if (!b._tnode) {
    b.textEl.textContent = '';
    b._tnode = document.createTextNode('');
    b.textEl.appendChild(b._tnode);
    b.textEl.classList.add('is-streaming');
  }
  b._tnode.appendData(delta);
  scheduleScroll();
}
function appendThinkingDelta(ci, delta) {
  var b = ensureBlock(ci, 'thinking');
  b.el.classList.add('is-running');
  b.text += delta;
  if (!b._tnode) {
    b.textEl.textContent = '';
    b._tnode = document.createTextNode('');
    b.textEl.appendChild(b._tnode);
  }
  b._tnode.appendData(delta);
  scheduleScroll();
}
function appendToolCallDelta(ci, delta) {
  var b = ensureBlock(ci, 'toolcall');
  b.argsText += delta;
  if (!b._anode) { b.argsEl.textContent = ''; b._anode = document.createTextNode(''); b.argsEl.appendChild(b._anode); }
  b._anode.appendData(delta);
  scheduleScroll();
}
function shortenToolPath(p) {
  if (typeof p !== 'string' || !p) return '';
  if (PI_HOME && (p === PI_HOME || p.indexOf(PI_HOME + PI_SEP) === 0)) return '~' + p.slice(PI_HOME.length);
  return p;
}
function toolStr(v) { return typeof v === 'string' ? v : ''; }
function toolPathArg(args) {
  var p = args.file_path != null ? args.file_path : args.path;
  return typeof p === 'string' ? p : '';
}
function formatReadRange(args) {
  if (args.offset === undefined && args.limit === undefined) return '';
  var startLine = args.offset != null ? args.offset : 1;
  var endLine = args.limit != null ? (startLine + args.limit - 1) : '';
  return ':' + startLine + (endLine !== '' ? '-' + endLine : '');
}
function formatToolSummary(name, args) {
  if (!args || typeof args !== 'object') return '';
  var s = '';
  if (name === 'bash') {
    var cmd = toolStr(args.command);
    if (cmd.length > 80) cmd = cmd.slice(0, 80) + '…';
    s = cmd || '...';
    if (args.timeout) s += ' (timeout ' + args.timeout + 's)';
  } else if (name === 'read') {
    s = shortenToolPath(toolPathArg(args)) || '...';
    var rng = formatReadRange(args);
    if (rng) s += rng;
  } else if (name === 'write' || name === 'edit') {
    s = shortenToolPath(toolPathArg(args)) || '...';
  } else if (name === 'ls') {
    s = shortenToolPath(toolStr(args.path) || '.');
    if (args.limit != null) s += ' (limit ' + args.limit + ')';
  } else if (name === 'find') {
    s = toolStr(args.pattern) + ' in ' + shortenToolPath(toolStr(args.path) || '.');
    if (args.limit != null) s += ' (limit ' + args.limit + ')';
  } else if (name === 'grep') {
    s = '/' + toolStr(args.pattern) + '/ in ' + shortenToolPath(toolStr(args.path) || '.');
    if (args.glob) s += ' (' + toolStr(args.glob) + ')';
    if (args.limit != null) s += ' limit ' + args.limit;
  } else if (name === 'todo') {
    s = toolStr(args.action) || '...';
  } else if (name === 'subagent') {
    if (args && args.tasks && args.tasks.length) {
      s = 'parallel · ' + args.tasks.length + (args.tasks.length > 1 ? ' tasks' : ' task');
    } else if (args && args.agent) {
      s = args.agent;
      var ttl = args.title ? String(args.title) : '';
      if (!ttl && args.task) ttl = args.task.length > 60 ? args.task.slice(0, 60) + '…' : args.task;
      if (ttl) s += ' · ' + ttl;
    } else {
      s = 'subagent';
    }
  }
  return s;
}

// ====== subagent rich rendering helpers ======
function formatTokens(count) {
  if (count < 1000) return count.toString();
  if (count < 10000) return (count / 1000).toFixed(1) + 'k';
  if (count < 1000000) return Math.round(count / 1000) + 'k';
  return (count / 1000000).toFixed(1) + 'M';
}
function getDisplayItems(messages) {
  var items = [];
  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    if (msg.role === 'assistant') {
      var content = msg.content;
      if (Array.isArray(content)) {
        for (var j = 0; j < content.length; j++) {
          var part = content[j];
          if (part.type === 'text') items.push({ type: 'text', text: part.text });
          else if (part.type === 'toolCall') items.push({ type: 'toolCall', name: part.name, args: part.arguments });
        }
      }
    }
  }
  return items;
}
function getFinalOutput(messages) {
  for (var i = messages.length - 1; i >= 0; i--) {
    var msg = messages[i];
    if (msg.role === 'assistant') {
      var content = msg.content;
      if (Array.isArray(content)) {
        for (var j = 0; j < content.length; j++) {
          var part = content[j];
          if (part.type === 'text') return part.text;
        }
      }
    }
  }
  return '';
}
function formatUsage(usage, model) {
  if (!usage) return '';
  var parts = [];
  if (usage.turns) parts.push(usage.turns + ' turn' + (usage.turns > 1 ? 's' : ''));
  if (usage.input) parts.push('\\u2191' + formatTokens(usage.input));
  if (usage.output) parts.push('\\u2193' + formatTokens(usage.output));
  if (usage.cacheRead) parts.push('R' + formatTokens(usage.cacheRead));
  if (usage.cacheWrite) parts.push('W' + formatTokens(usage.cacheWrite));
  if (usage.cost) parts.push('$' + usage.cost.toFixed(4));
  if (usage.contextTokens) parts.push('ctx:' + formatTokens(usage.contextTokens));
  if (model) parts.push(model);
  return parts.join(' ');
}
function computeCacheHitPct(usage) {
  if (!usage) return null;
  var cr = usage.cacheRead || 0;
  var cw = usage.cacheWrite || 0;
  if (cr <= 0 && cw <= 0) return null;
  var prompt = (usage.input || 0) + cr + cw;
  if (prompt <= 0) return null;
  return (cr / prompt) * 100;
}
function promptTokensOf(usage) {
  if (!usage) return 0;
  return (usage.input || 0) + (usage.cacheRead || 0) + (usage.cacheWrite || 0);
}
function cacheReadPricePerM() {
  var cost = state.model && state.model.cost;
  if (cost && typeof cost.cacheRead === 'number') return cost.cacheRead;
  return null;
}
function detectCacheMiss(usage, modelId, ts) {
  if (!prevTurn || !usage) return null;
  if (typeof ts === 'number' && ts === prevTurn.ts) return null;
  var promptTokens = (usage.input || 0) + (usage.cacheRead || 0) + (usage.cacheWrite || 0);
  if (promptTokens <= 0) return null;
  if (usage.cacheRead + usage.cacheWrite === 0 && !prevTurn.reportedCache) return null;
  var missedTokens = Math.min(prevTurn.promptTokens, promptTokens) - (usage.cacheRead || 0);
  if (missedTokens <= 1024) return null;
  var cost = (usage.cost && typeof usage.cost === 'object') ? usage.cost : null;
  var paidTokens = (usage.input || 0) + (usage.cacheWrite || 0);
  var paidPerToken = (cost && paidTokens > 0) ? ((cost.input || 0) + (cost.cacheWrite || 0)) / paidTokens : 0;
  var readPerToken;
  if ((usage.cacheRead || 0) > 0 && cost) {
    readPerToken = (cost.cacheRead || 0) / usage.cacheRead;
  } else {
    var price = cacheReadPricePerM();
    readPerToken = (price != null && price > 0) ? price / 1000000 : 0;
  }
  var missedCost = missedTokens * Math.max(0, paidPerToken - readPerToken);
  var showByTokens = missedTokens >= 20000;
  var showByCost = missedCost >= 0.10;
  if (!showByTokens && !showByCost) return null;
  var idleMs = (typeof ts === 'number' && typeof prevTurn.ts === 'number') ? ts - prevTurn.ts : 0;
  var modelChanged = !!modelId && !!prevTurn.modelId && modelId !== prevTurn.modelId;
  var label;
  if (modelChanged) label = 'Cache miss after model switch';
  else if (idleMs >= 300000) label = 'Cache miss after ' + Math.round(idleMs / 60000) + 'm idle';
  else label = 'Cache miss';
  return { label: label, missedTokens: missedTokens, missedCost: missedCost };
}
function recordCacheUsage(usage, modelId, ts) {
  latestCacheHitPct = computeCacheHitPct(usage);
  rebuildCtxRingTooltip();
  if (!usage) { prevTurn = null; return; }
  if (prevTurn && (typeof ts !== 'number' || ts !== prevTurn.ts)) {
    var miss = detectCacheMiss(usage, modelId, ts);
    if (miss) {
      var costStr = (miss.missedCost >= 0.01)
        ? ' (~$' + miss.missedCost.toFixed(2) + ')'
        : '';
      showToast('\\u26A0 ' + miss.label + ' \\u00B7 ' + formatTokens(miss.missedTokens) + ' tokens re-billed' + costStr, 'warning');
    }
  }
  prevTurn = {
    promptTokens: promptTokensOf(usage),
    modelId: modelId || '',
    ts: (typeof ts === 'number') ? ts : Date.now(),
    reportedCache: !!(prevTurn && prevTurn.reportedCache) || (usage.cacheRead + usage.cacheWrite > 0)
  };
}
function seedCacheBaseline(list) {
  if (!list || !list.length) return;
  for (var i = list.length - 1; i >= 0; i--) {
    var m = list[i];
    if (!m || m.role !== 'assistant' || !m.usage || m.stopReason === 'error') continue;
    var u = m.usage;
    if (!u.input && !u.output && !u.cacheRead && !u.cacheWrite) continue;
    latestCacheHitPct = computeCacheHitPct(u);
    prevTurn = {
      promptTokens: promptTokensOf(u),
      modelId: state.model ? state.model.provider + '/' + state.model.id : '',
      ts: (typeof m.timestamp === 'number') ? m.timestamp : Date.now(),
      reportedCache: (u.cacheRead + u.cacheWrite) > 0
    };
    rebuildCtxRingTooltip();
    break;
  }
}
function aggregateUsage(results) {
  var total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    total.input += r.usage.input;
    total.output += r.usage.output;
    total.cacheRead += r.usage.cacheRead;
    total.cacheWrite += r.usage.cacheWrite;
    total.cost += r.usage.cost;
    total.turns += r.usage.turns;
  }
  return total;
}
function subagentDetailsHasError(details) {
  if (!details || !details.results) return false;
  for (var i = 0; i < details.results.length; i++) {
    var r = details.results[i];
    if (!r) continue;
    if (r.errorMessage) return true;
    if (typeof r.exitCode === 'number' && r.exitCode !== -1 && r.exitCode !== 0) return true;
  }
  return false;
}
function isFailedSubagent(r) {
  if (!r) return false;
  if (r.exitCode === -1) return false;
  return r.exitCode !== 0 || r.stopReason === 'error' || r.stopReason === 'aborted';
}
function subagentTitle(r) {
  if (r && r.title) return String(r.title);
  if (r && r.task) return r.task.length > 60 ? r.task.slice(0, 60) + '…' : r.task;
  return '';
}
function renderSubMd(target, text) {
  target._piMd = text;
  try { target.innerHTML = md.render(text); } catch (e) { target.textContent = text; }
}
function renderAgentBody(parent, r) {
  var failed = isFailedSubagent(r);
  var usageStr = formatUsage(r.usage, r.model);
  if (usageStr) {
    var uDiv = el('div', 'sub-usage');
    var usageStats = formatUsage(r.usage, null);
    if (usageStats) uDiv.appendChild(document.createTextNode(usageStats + (r.model ? ' · ' : '')));
    if (r.model) {
      var mSpan = el('span', 'sub-usage-model');
      mSpan.textContent = r.model;
      uDiv.appendChild(mSpan);
    }
    parent.appendChild(uDiv);
  }
  if (r && r.task) {
    var tLabel = el('div', 'sub-section-label');
    tLabel.textContent = 'Task';
    parent.appendChild(tLabel);
    var tBody = el('div', 'sub-task-text sub-md text-block');
    renderSubMd(tBody, r.task);
    parent.appendChild(tBody);
  }
  var items = getDisplayItems(r.messages || []);
  var callItems = [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].type === 'toolCall') callItems.push(items[i]);
  }
  var hasCalls = callItems.length > 0;
  if (hasCalls) {
    var sLabel = el('div', 'sub-section-label');
    sLabel.textContent = 'Steps';
    parent.appendChild(sLabel);
    for (var i = 0; i < callItems.length; i++) {
      var cdiv = el('div', 'sub-toolcall');
      var tcName = callItems[i].name || '';
      var tcSum = formatToolSummary(tcName, callItems[i].args);
      if (!tcSum) {
        var astr = JSON.stringify(callItems[i].args || {});
        tcSum = astr.length > 50 ? astr.slice(0, 50) + '…' : astr;
      }
      cdiv.appendChild(document.createTextNode('→ '));
      var tcNameSpan = el('span', 'sub-toolcall-name');
      tcNameSpan.textContent = tcName;
      cdiv.appendChild(tcNameSpan);
      cdiv.appendChild(document.createTextNode(' ' + tcSum));
      parent.appendChild(cdiv);
    }
  }
  if (failed && r.errorMessage) {
    var errDiv = el('div', 'sub-error');
    errDiv.textContent = 'Error: ' + r.errorMessage;
    parent.appendChild(errDiv);
  }
  var final = getFinalOutput(r.messages || []);
  if (final) {
    var fLabel = el('div', 'sub-section-label');
    fLabel.textContent = 'Result';
    parent.appendChild(fLabel);
    var mdDiv = el('div', 'sub-final sub-md text-block');
    renderSubMd(mdDiv, final.trim());
    parent.appendChild(mdDiv);
  } else if (!failed && !hasCalls && !(r && r.task)) {
    var empty = el('div', 'sub-empty');
    empty.textContent = r && r.exitCode === -1 ? '(running…)' : '(no output)';
    parent.appendChild(empty);
  }
  return usageStr;
}

function renderSubagentResult(b, details) {
  if (!b || !b.resultEl) return;
  b.resultEl._piMd = null;
  if (!details || !details.results || !details.results.length) return;
  var results = details.results;
  var wrap = el('div', 'subagent-wrap');
  if (details.mode === 'single' && results.length === 1) {
    var r = results[0];
    var body = el('div', 'subagent-body');
    renderAgentBody(body, r);
    wrap.appendChild(body);
    if (b.summaryEl) {
      b.summaryEl.textContent = r.agent + (subagentTitle(r) ? ' · ' + subagentTitle(r) : '');
    }
  } else if (details.mode === 'parallel') {
    var running = 0, done = 0, fail = 0;
    for (var di = 0; di < results.length; di++) {
      if (results[di].exitCode === -1) running++;
      else { done++; if (isFailedSubagent(results[di])) fail++; }
    }
    var pic = running > 0 ? '⏳' : (fail > 0 ? '◐' : '✓');
    for (var ri = 0; ri < results.length; ri++) {
      var sr = results[ri];
      var sric = sr.exitCode === -1 ? '⏳' : (sr.exitCode === 0 ? '✓' : '✗');
      var sdet = el('details', 'sub-task');
      if (isFailedSubagent(sr)) sdet.classList.add('is-failed');
      if (sr.exitCode === -1) sdet.setAttribute('open', '');
      var shead = el('summary', 'sub-task-head');
      var sicon = el('span', 'sub-task-icon');
      sicon.textContent = sric;
      var sname = el('span', 'sub-task-agent');
      sname.textContent = sr.agent;
      shead.appendChild(sicon);
      shead.appendChild(sname);
      if (subagentTitle(sr)) {
        var stitle = el('span', 'sub-task-title');
        stitle.textContent = '· ' + subagentTitle(sr);
        shead.appendChild(stitle);
      }
      var sstatus = el('span', 'sub-task-status');
      sstatus.textContent = sr.exitCode === -1 ? 'running' : (isFailedSubagent(sr) ? 'failed' : 'done');
      shead.appendChild(sstatus);
      sdet.appendChild(shead);
      var sbody = el('div', 'sub-task-body');
      renderAgentBody(sbody, sr);
      sdet.appendChild(sbody);
      wrap.appendChild(sdet);
    }
    var tu = aggregateUsage(results);
    var tus = formatUsage(tu);
    if (tus) {
      var tud = el('div', 'sub-total');
      tud.textContent = 'Total: ' + tus;
      wrap.appendChild(tud);
    }
    if (b.summaryEl) {
      b.summaryEl.textContent = pic + ' parallel · ' + done + '/' + results.length + (running > 0 ? ' running' : (fail > 0 ? ' (' + fail + ' failed)' : ' done'));
    }
  } else {
    return;
  }
  b.resultEl.textContent = '';
  b.resultEl.appendChild(wrap);
}
function applyToolSummary(b, name, args) {
  if (!b || !b.summaryEl) return;
  var parsed = args;
  if (typeof args === 'string') { try { parsed = JSON.parse(args); } catch (e) { parsed = null; } }
  b.summaryEl.textContent = formatToolSummary(name || b.name || '', parsed);
}
function expandHomePath(p) {
  if (typeof p !== 'string' || !p) return '';
  if (p.charAt(0) === '~' && (p.length === 1 || p.charAt(1) === PI_SEP)) {
    return (PI_HOME || '') + p.slice(1);
  }
  return p;
}
function applyToolFileTarget(b, name, args) {
  if (!b || !b.el) return;
  b.filePath = null;
  b.fileLine = null;
  b.el.removeAttribute('data-has-file');
  if (!args) return;
  var parsed = args;
  if (typeof args === 'string') { try { parsed = JSON.parse(args); } catch (e) { parsed = null; } }
  if (!parsed || typeof parsed !== 'object') return;
  if (name !== 'read' && name !== 'write' && name !== 'edit') return;
  var fp = parsed.file_path != null ? parsed.file_path : parsed.path;
  if (typeof fp !== 'string' || !fp) return;
  fp = expandHomePath(fp);
  if (!fp) return;
  b.filePath = fp;
  if (name === 'read' && parsed.offset != null) {
    var ln = parseInt(parsed.offset, 10);
    if (!isNaN(ln) && ln > 0) b.fileLine = ln;
  }
  b.el.setAttribute('data-has-file', '');
}
function finalizeToolCall(ci, toolCall) {
  var b = ensureBlock(ci, 'toolcall');
  b.el._block = b;
  if (toolCall) {
    if (toolCall.name) {
      b.name = toolCall.name;
      b.nameEl.textContent = toolCall.name;
      if (b.name === 'subagent') b.el.classList.add('is-subagent');
    }
    if (toolCall.id) { b.toolCallId = toolCall.id; b.el.setAttribute('data-tcid', toolCall.id); }
    var args = toolCall.arguments;
    if (args !== undefined && args !== null) {
      b.argsText = typeof args === 'string' ? args : JSON.stringify(args, null, 2);
      b._anode = null;
      if (b.name === 'write') {
        renderWriteContent(b.argsEl, args);
        var wparsed = args;
        if (typeof args === 'string') { try { wparsed = JSON.parse(args); } catch (e) { wparsed = null; } }
        var wcontent = wparsed && typeof wparsed.content === 'string' ? wparsed.content : '';
        if (wcontent) {
          var wlines = wcontent.split(String.fromCharCode(10));
          while (wlines.length && wlines[wlines.length - 1] === '') wlines.pop();
          b._writeLineCount = wlines.length;
        }
      } else if (b.name === 'subagent') b.argsEl.textContent = '';
      else setClamped(b.argsEl, b.argsText);
    }
    applyToolSummary(b, b.name, args);
    applyToolFileTarget(b, b.name, args);
  }
}

function findToolBlock(toolCallId) {
  var children = messagesEl.querySelectorAll('.tool-block[data-tcid="' + cssEscape(toolCallId) + '"]');
  if (children.length) {
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      if (c._block) return c._block;
      // reconstruct minimal ref
      var nameElRef = c.querySelector('.tool-name');
      return { el: c, nameEl: nameElRef, summaryEl: c.querySelector('.tool-summary'), statusEl: c.querySelector('.tool-status'), argsEl: c.querySelector('.tool-args'), resultEl: c.querySelector('.tool-result'), name: (nameElRef && nameElRef.textContent) || '' };
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
  if (ev.toolName) { b.name = ev.toolName; b.nameEl ? (b.nameEl.textContent = ev.toolName) : null; if (b.name === 'subagent') b.el.classList.add('is-subagent'); }
  b.el._block = b;
  if (b.statusEl) { b.statusEl.textContent = ''; b.statusEl.classList.add('is-running'); }
  if (ev.args !== undefined && ev.args !== null && b.argsEl && !b.argsText) {
    b.argsText = typeof ev.args === 'string' ? ev.args : JSON.stringify(ev.args, null, 2);
    b._anode = null;
    if (b.name !== 'subagent') setClamped(b.argsEl, b.argsText);
  }
  applyToolSummary(b, b.name, ev.args);
  applyToolFileTarget(b, b.name, ev.args);
  scheduleScroll();
}
function updateToolExecution(ev) {
  var b = findToolBlock(ev.toolCallId);
  if (!b || !b.resultEl) return;
  var pr = ev.partialResult;
  if (!pr) return;
  if (b.name === 'subagent' && pr.details) {
    renderSubagentResult(b, pr.details);
    return;
  }
  if (pr.content) {
    var txt = extractToolResultText(pr.content);
    if (txt) setClamped(b.resultEl, txt);
    else b.resultEl.textContent = '';
    appendToolResultImages(b.resultEl, pr.content);
  }
}
function endToolExecution(ev) {
  var b = findToolBlock(ev.toolCallId);
  if (!b) return;
  if (b.statusEl) { b.statusEl.textContent = ev.isError ? 'error' : 'done'; b.statusEl.classList.remove('is-running'); }
  if (ev.isError) b.el.classList.add('is-error');
  var r = ev.result;
  if (b.name === 'subagent' && r && r.details) {
    renderSubagentResult(b, r.details);
    if (!ev.isError && subagentDetailsHasError(r.details)) {
      if (b.statusEl) { b.statusEl.textContent = 'error'; b.statusEl.classList.remove('is-running'); }
      b.el.classList.add('is-error');
    }
    if (!b.el._userToggled) b.el.removeAttribute('open');
    scheduleScroll();
    return;
  }
  if (b.name === 'edit' && !ev.isError && r && r.details && typeof r.details.diff === 'string') {
    b.el.classList.add('is-diff');
    renderToolDiff(b.resultEl, r.details.diff);
    var diffLines = r.details.diff.split(String.fromCharCode(10));
    var added = 0, removed = 0;
    for (var di = 0; di < diffLines.length; di++) {
      var ch = diffLines[di].charAt(0);
      if (ch === '+' && diffLines[di].charAt(1) !== '+') added++;
      else if (ch === '-' && diffLines[di].charAt(1) !== '-') removed++;
    }
    if (b.summaryEl && (added > 0 || removed > 0)) {
      var sumHtml = b.summaryEl.textContent;
      if (added > 0) sumHtml += ' <span style="color:var(--vscode-gitDecoration-addedResourceForeground, #73c991)">+' + added + '</span>';
      if (removed > 0) sumHtml += ' <span style="color:var(--vscode-gitDecoration-deletedResourceForeground, #f48771)">-' + removed + '</span>';
      b.summaryEl.innerHTML = sumHtml;
    }
    scheduleScroll();
    return;
  }
  if (b.name === 'read' && !ev.isError) {
    if (b.argsEl) b.argsEl.style.display = 'none';
  }
  if (b.name === 'write' && !ev.isError) {
    if (b.resultEl) { b.resultEl._piMd = null; b.resultEl.textContent = ''; }
    if (b._writeLineCount > 0 && b.summaryEl) {
      b.summaryEl.innerHTML = b.summaryEl.textContent + ' <span style="color:var(--vscode-gitDecoration-addedResourceForeground, #73c991)">+' + b._writeLineCount + '</span>';
    }
    if (!b.el._userToggled) b.el.removeAttribute('open');
    scheduleScroll();
    return;
  }
  b.el.classList.remove('is-diff');
  if (r && r.content && b.resultEl) {
    var txt = extractToolResultText(r.content);
    if (txt) setClamped(b.resultEl, txt);
    else b.resultEl.textContent = '';
    appendToolResultImages(b.resultEl, r.content);
  }
  if (!b.el._userToggled) b.el.removeAttribute('open');
  scheduleScroll();
}

var isHydrating = false;
// ---- hydrate from get_messages ----
function hydrateMessages(list) {
  messagesEl.innerHTML = '';
  pendingCompactionBlock = null;
  pendingBtwBlock = null;
  btwAbortId = null;
  btwStatusActive = false;
  state.isBtwLoading = false;
  currentAssistant = null;
  pendingTexts = [];
  prevTurn = null;
  latestCacheHitPct = null;
  sessionCost = null;
  if (!list || !list.length) {
    clearMessages();
    rebuildCtxRingTooltip();
    isHydrating = false;
    return;
  }
  isHydrating = true;
  setStatus('Loading history...');
  var i = 0;
  var CHUNK = 8;
  function step() {
    var end = Math.min(i + CHUNK, list.length);
    for (; i < end; i++) hydrateOne(list[i]);
    if (i < list.length) requestAnimationFrame(step);
    else { isHydrating = false; setStatus(''); scrollToBottom(); seedCacheBaseline(list); wrapAllWorkSegments(); }
  }
  requestAnimationFrame(step);
}
function hydrateOne(m) {
  if (!m || typeof m !== 'object') return;
  var role = m.role;
  if (role === 'user') {
    var utext = extractText(m.content);
    pushHistory(utext);
    var ub = addUserMessage(utext, extractImages(m.content));
    if (m && m.timestamp != null) applyUserBubbleTime(ub, m.timestamp);
  } else if (role === 'assistant') {
    startAssistantMessage(m.timestamp);
    var content = m.content;
    if (Array.isArray(content)) {
      for (var k = 0; k < content.length; k++) {
        var blk = content[k];
        if (!blk || typeof blk !== 'object') continue;
        if (blk.type === 'text') {
          var tb = ensureBlock(k, 'text');
          tb.text = blk.text || '';
          renderMarkdown(tb.textEl, tb.text);
          tb.finalized = true;
          applyTextCollapsible(tb);
        } else if (blk.type === 'thinking') {
          var hb = ensureBlock(k, 'thinking');
          hb.text = blk.thinking || '';
          hb.textEl.textContent = hb.text;
        } else if (blk.type === 'toolCall') {
          finalizeToolCall(k, blk);
        }
      }
    }
    applyAssistantStopError(m.stopReason, m.errorMessage, 0);
    endAssistantMessage();
  } else if (role === 'toolResult') {
    var evResult = { content: m.content };
    if (m.details) evResult.details = m.details;
    var fakeEv = { toolCallId: m.toolCallId, result: evResult, isError: !!m.isError };
    endToolExecution(fakeEv);
  } else if (role === 'compactionSummary') {
    addCompactionMessage(m);
  }
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
function extractImages(content) {
  var imgs = [];
  if (Array.isArray(content)) {
    for (var i = 0; i < content.length; i++) {
      var c = content[i];
      if (c && c.type === 'image' && c.data && c.mimeType) imgs.push({ type: 'image', data: c.data, mimeType: c.mimeType });
    }
  }
  return imgs;
}

function formatDuration(ms) {
  if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '';
  var s = Math.round(ms / 1000);
  if (s < 1) return ms > 0 ? '<1s' : '0s';
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  if (h > 0) return h + 'h ' + m + 'm ' + sec + 's';
  if (m > 0) return m + 'm ' + sec + 's';
  return sec + 's';
}
function formatWorkTitle(turns, startTs, endTs) {
  var t = turns + ' Turn' + (turns === 1 ? '' : 's');
  if (typeof startTs === 'number' && typeof endTs === 'number' && endTs >= startTs) {
    var d = formatDuration(endTs - startTs);
    if (d) t += '  \u00B7  Worked for ' + d;
  }
  return t;
}
// Collapse the work (thinking / tool calls / intermediate text) between a user
// message and the final assistant text of its segment into one <details> block.
function wrapWorkSegment(userRow) {
  if (!userRow || !userRow.parentNode) return;
  var parent = userRow.parentNode;
  var first = userRow.nextElementSibling;
  if (first && first.classList.contains('work-block')) return;
  var seg = [];
  var node = first;
  while (node) {
    if (node.classList.contains('work-block')) break;
    if (node.classList.contains('msg') && node.classList.contains('user')) break;
    seg.push(node);
    node = node.nextElementSibling;
  }
  if (!seg.length) return;
  var assistantRows = [];
  for (var i = 0; i < seg.length; i++) {
    if (seg[i].classList.contains('msg') && seg[i].classList.contains('assistant')) assistantRows.push(seg[i]);
  }
  if (!assistantRows.length) return;
  var turns = assistantRows.length;
  var lastRow = assistantRows[assistantRows.length - 1];
  var endTs = lastRow._piTs;
  var ub = userRow.querySelector('.user-bubble');
  var startTs = ub && ub._piTs != null ? ub._piTs : null;
  var finalText = null;
  var kids = lastRow.children;
  for (var k = kids.length - 1; k >= 0; k--) {
    if (kids[k].classList.contains('text-block')) { finalText = kids[k]; break; }
  }
  var keep = [];
  if (finalText) {
    keep.push(finalText);
    var n1 = finalText.nextElementSibling;
    if (n1 && n1.classList.contains('expand-btn')) { keep.push(n1); n1 = n1.nextElementSibling; }
    if (n1 && n1.classList.contains('msg-time')) keep.push(n1);
  }
  var hasWork = false;
  for (var s = 0; s < seg.length; s++) {
    if (seg[s] !== lastRow) { hasWork = true; break; }
  }
  if (!hasWork && finalText) {
    var ch = lastRow.children;
    for (var c = 0; c < ch.length; c++) { if (keep.indexOf(ch[c]) === -1) { hasWork = true; break; } }
  }
  if (!hasWork) return;
  var det = el('details', 'work-block');
  var summ = el('summary', 'work-head');
  summ.textContent = formatWorkTitle(turns, startTs, endTs);
  det.appendChild(summ);
  var body = el('div', 'work-body');
  det.appendChild(body);
  parent.insertBefore(det, seg[0]);
  for (var s2 = 0; s2 < seg.length; s2++) {
    var sr = seg[s2];
    if (finalText && sr === lastRow) {
      var children = Array.prototype.slice.call(sr.children);
      for (var c2 = 0; c2 < children.length; c2++) {
        if (keep.indexOf(children[c2]) === -1) body.appendChild(children[c2]);
      }
    } else {
      body.appendChild(sr);
    }
  }
  scheduleScroll();
}
function wrapLastWorkSegment() {
  var rows = messagesEl.querySelectorAll('.msg.user');
  if (!rows.length) return;
  wrapWorkSegment(rows[rows.length - 1]);
}
function wrapAllWorkSegments() {
  var rows = messagesEl.querySelectorAll('.msg.user');
  var n = rows.length;
  for (var i = 0; i < n; i++) {
    if (i === n - 1 && state.isStreaming) continue;
    wrapWorkSegment(rows[i]);
  }
}

// ---- event dispatch ----
function handleAssistantMessageEvent(amev) {
  if (!amev || typeof amev !== 'object') return;
  var t = amev.type;
  var ci = amev.contentIndex || 0;
  if (t === 'text_start') { collapseThinking(); ensureBlock(ci, 'text'); }
  else if (t === 'text_delta') { appendTextDelta(ci, amev.delta || ''); }
  else if (t === 'thinking_start') { var tb = ensureBlock(ci, 'thinking'); tb.el.classList.add('is-running'); }
  else if (t === 'thinking_delta') { appendThinkingDelta(ci, amev.delta || ''); }
  else if (t === 'toolcall_start') { collapseThinking(); var tcb = ensureBlock(ci, 'toolcall'); if (tcb.statusEl) { tcb.statusEl.textContent = ''; tcb.statusEl.classList.add('is-running'); } }
  else if (t === 'toolcall_delta') { appendToolCallDelta(ci, amev.delta || ''); }
  else if (t === 'toolcall_end') { finalizeToolCall(ci, amev.toolCall); }
}
function handleEvent(event) {
  if (!event || typeof event !== 'object') return;
  switch (event.type) {
    case 'agent_start': setStreaming(true); break;
    case 'agent_settled': setStreaming(false); retryAttempt = 0; wrapLastWorkSegment(); break;
    case 'message_start':
      if (event.message && event.message.role === 'assistant') startAssistantMessage(event.message.timestamp);
      else if (event.message && event.message.role === 'user') {
        if (lastUserBubble && lastUserBubble._piTs == null) {
          if (event.message.timestamp != null) applyUserBubbleTime(lastUserBubble, event.message.timestamp);
        } else {
          var ub = addUserMessage(extractText(event.message.content));
          if (event.message.timestamp != null) applyUserBubbleTime(ub, event.message.timestamp);
        }
      }
      break;
    case 'message_end':
      if (event.message && event.message.role === 'assistant') {
        var amsg = event.message;
        var asr = amsg.stopReason;
        applyAssistantStopError(asr, amsg.errorMessage, retryAttempt);
        endAssistantMessage();
        if (asr && asr !== 'error') {
          retryAttempt = 0;
          recordCacheUsage(
            amsg.usage,
            state.model ? state.model.provider + '/' + state.model.id : '',
            amsg.timestamp
          );
        }
      }
      break;
    case 'message_update': handleAssistantMessageEvent(event.assistantMessageEvent); break;
    case 'tool_execution_start': startToolExecution(event); break;
    case 'tool_execution_update': updateToolExecution(event); break;
    case 'tool_execution_end': endToolExecution(event); break;
    case 'compaction_start': setStatus('Compacting\u2026'); addCompactionPlaceholder(); break;
    case 'compaction_end':
      hideToast();
      setStatus('');
      if (d.aborted || d.errorMessage) {
        if (pendingCompactionBlock) { pendingCompactionBlock.remove(); pendingCompactionBlock = null; }
        if (d.errorMessage) showToast(d.errorMessage, 'error');
      }
      break;
    case 'auto_retry_start':
      retryAttempt = event.attempt;
      setStatus('Retrying ' + event.attempt + '/' + event.maxAttempts + '\u2026');
      break;
    case 'auto_retry_end':
      setStatus('');
      retryAttempt = 0;
      if (event.success === false) {
        var rfe = event.finalError || 'Unknown error';
        var reb = el('div', 'error-banner');
        reb.textContent = 'Error: Retry failed after ' + event.attempt + ' attempts: ' + rfe;
        messagesEl.appendChild(reb);
        scrollToBottom();
      }
      break;
    case 'queue_update':
      queueState.steering = Array.isArray(event.steering) ? event.steering : [];
      queueState.followUp = Array.isArray(event.followUp) ? event.followUp : [];
      renderQueue();
      break;
    default: break;
  }
}`;
}
