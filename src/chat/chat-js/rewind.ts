export function getRewindJs(): string {
  return `// ---- rewind: widget, per-message actions, custom dialogs ----
var ICON_COPY = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5V3A1.5 1.5 0 0 0 9 1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h.5"/></svg>';
var ICON_FORK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13.5v-8"/><path d="M4 5.5c0-2.5 8-2.5 8 0"/><path d="M12 5.5v8"/><path d="M4 2.5v1"/><path d="M12 2.5v1"/></svg>';
var ICON_REVERT = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5V2.5h3"/><path d="M4 2.5c2.5-1.8 8-0.6 8 4 0 4.5-6 6-9 3.5"/></svg>';
var ICON_CHEVRON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 3.5L10 8l-4.5 4.5"/></svg>';
var ICON_ACCEPT = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-6.5"/></svg>';
var ICON_REVERT_FILE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5A4.7 4.7 0 0 1 11.5 7"/><path d="M9 3.5l2.5 3.5L14 3.5"/><path d="M12 13.5A4.7 4.7 0 0 1 4.5 7"/><path d="M7 16l-2.5-3.5L7 9"/></svg>';

var rewindWidgetEl = document.getElementById('rewind-widget');
var rewindCollapsed = true;

function formatRewindCounts(f) {
  if (f.added == null && f.removed == null) return '-';
  var out = '';
  if (f.added != null && f.added > 0) out += '+' + f.added;
  if (f.removed != null && f.removed > 0) out += (out ? '/' : '') + '-' + f.removed;
  return out || '\\u00B10';
}
function formatRewindTotals(t) {
  var out = '';
  if (t && t.added > 0) out += '+' + t.added;
  if (t && t.removed > 0) out += (out ? '/' : '') + '-' + t.removed;
  return out ? out : '\\u00B10';
}

function applyRewindWidget(lines) {
  if (!lines || !lines.length) {
    rewindWidgetEl.style.display = 'none';
    rewindWidgetEl.innerHTML = '';
    return;
  }
  var data = {};
  try { data = JSON.parse(lines[0] || '{}'); } catch (e) { data = {}; }
  var files = data.files || [];
  var totals = data.totals || { added: 0, removed: 0 };
  if (!files.length) {
    rewindWidgetEl.style.display = 'none';
    rewindWidgetEl.innerHTML = '';
    return;
  }
  rewindWidgetEl.innerHTML = '';
  rewindWidgetEl.classList.toggle('is-collapsed', rewindCollapsed);
  rewindWidgetEl.style.display = 'block';

  var card = el('div', 'widget-card rewind-card');
  var head = el('div', 'rewind-head');

  var chev = el('span', 'rewind-chevron');
  chev.innerHTML = ICON_CHEVRON;
  chev.title = rewindCollapsed ? 'Expand' : 'Collapse';
  chev.addEventListener('click', function() {
    rewindCollapsed = !rewindCollapsed;
    applyRewindWidget(lines);
  });
  head.appendChild(chev);

  var title = el('span', 'rewind-title');
  title.textContent = '已修改文件 (' + files.length + ')';
  head.appendChild(title);

  var totalsEl = el('span', 'rewind-totals');
  totalsEl.textContent = formatRewindTotals(totals);
  head.appendChild(totalsEl);

  var headActions = el('span', 'rewind-head-actions');
  var acceptAll = el('button', 'rewind-btn');
  acceptAll.type = 'button';
  acceptAll.title = 'Accept all changes (baseline = current state)';
  acceptAll.innerHTML = ICON_ACCEPT + '<span>全部接受</span>';
  acceptAll.addEventListener('click', function() {
    if (state.isStreaming) { showToast('Stop the agent before changing files.', 'error'); return; }
    vscode.postMessage({ type: 'rewindAccept' });
  });
  headActions.appendChild(acceptAll);

  var revertAll = el('button', 'rewind-btn');
  revertAll.type = 'button';
  revertAll.title = 'Revert all files to their accepted baseline';
  revertAll.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5A4.7 4.7 0 0 1 11.5 7"/><path d="M9 3.5l2.5 3.5L14 3.5"/><path d="M7 13.5A4.7 4.7 0 0 1 4.5 15"/><path d="M5 16l-2.5-3.5L5 9"/></svg><span>全部回退</span>';
  revertAll.addEventListener('click', function() {
    if (state.isStreaming) { showToast('Stop the agent before reverting.', 'error'); return; }
    showRewindConfirm('回退全部 ' + files.length + ' 个文件', function() {
      vscode.postMessage({ type: 'rewindRevert' });
    });
  });
  headActions.appendChild(revertAll);
  head.appendChild(headActions);
  card.appendChild(head);

  if (!rewindCollapsed) {
    var body = el('div', 'rewind-body');
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var row = el('div', 'rewind-row');
      var fileEl = el('span', 'rewind-file');
      fileEl.textContent = shortenToolPath(f.absPath) || f.basename;
      fileEl.title = f.absPath;
      fileEl.addEventListener('click', function(f) {
        return function() {
          vscode.postMessage({
            type: 'rewindDiff',
            absPath: f.absPath,
            baselineHash: f.baselineHash,
            sessionId: data.sessionId,
            basename: f.basename
          });
        };
      }(f));
      row.appendChild(fileEl);

      var counts = el('span', 'rewind-counts');
      counts.textContent = formatRewindCounts(f);
      row.appendChild(counts);

      var rowActions = el('span', 'rewind-row-actions');
      var accBtn = el('button', 'rewind-btn');
      accBtn.type = 'button';
      accBtn.title = 'Accept this file (baseline = current state)';
      accBtn.innerHTML = ICON_ACCEPT + '<span>接受</span>';
      accBtn.addEventListener('click', function(id) {
        return function() {
          if (state.isStreaming) { showToast('Stop the agent before changing files.', 'error'); return; }
          vscode.postMessage({ type: 'rewindAcceptFile', id: id });
        };
      }(f.id));
      rowActions.appendChild(accBtn);

      var revBtn = el('button', 'rewind-btn');
      revBtn.type = 'button';
      revBtn.title = 'Revert this file to its accepted baseline';
      revBtn.innerHTML = ICON_REVERT_FILE + '<span>回退</span>';
      revBtn.addEventListener('click', function(id) {
        return function() {
          if (state.isStreaming) { showToast('Stop the agent before reverting.', 'error'); return; }
          vscode.postMessage({ type: 'rewindRevertFile', id: id });
        };
      }(f.id));
      rowActions.appendChild(revBtn);
      row.appendChild(rowActions);

      body.appendChild(row);
    }
    card.appendChild(body);
  }

  rewindWidgetEl.appendChild(card);
}

function appendUserActions(row, bubble, text) {
  if (!row || !bubble) return;
  var actions = el('div', 'bubble-actions');
  var copyBtn = el('button', 'icon-btn');
  copyBtn.type = 'button';
  copyBtn.title = 'Copy';
  copyBtn.innerHTML = ICON_COPY;
  copyBtn.addEventListener('click', function() {
    vscode.postMessage({ type: 'copy', text: text || '' });
  });
  actions.appendChild(copyBtn);

  var forkBtn = el('button', 'icon-btn');
  forkBtn.type = 'button';
  forkBtn.title = 'Fork from here';
  forkBtn.innerHTML = ICON_FORK;
  forkBtn.addEventListener('click', function() {
    var ts = bubble._piTs;
    if (state.isStreaming) return;
    if (ts == null) { showToast('Message not ready yet.', 'info'); return; }
    vscode.postMessage({ type: 'fork', ts: ts });
  });
  actions.appendChild(forkBtn);

  var revertBtn = el('button', 'icon-btn');
  revertBtn.type = 'button';
  revertBtn.title = 'Revert here';
  revertBtn.innerHTML = ICON_REVERT;
  revertBtn.addEventListener('click', function() {
    var ts = bubble._piTs;
    if (state.isStreaming) return;
    if (ts == null) { showToast('Message not ready yet.', 'info'); return; }
    vscode.postMessage({ type: 'revert', ts: ts });
  });
  actions.appendChild(revertBtn);

  row.appendChild(actions);
}

function renderRewindDialog(box, request) {
  box.classList.add('rewind-dialog');
  var data = {};
  try { data = JSON.parse(request.prefill || '{}'); } catch (e) { data = {}; }
  var label = data.label || '';
  var affected = Number(data.affected);
  if (!isFinite(affected)) affected = 0;

  var h = box.querySelector('h3');
  if (h) h.textContent = '回退确认';
  if (label) {
    var p = el('p');
    p.textContent = label;
    box.appendChild(p);
  }
  var p2 = el('p');
  p2.textContent = '受影响文件 ' + affected + (affected === 1 ? ' 个' : ' 个');
  box.appendChild(p2);

  var actions = el('div', 'dialog-actions');
  var msgOnly = el('button', 'btn btn-secondary');
  msgOnly.textContent = '仅回退消息';
  msgOnly.addEventListener('click', function() { respond(request.id, { value: 'message-only' }); });
  actions.appendChild(msgOnly);

  var msgAndCode = el('button', 'btn btn-primary');
  msgAndCode.textContent = '回退消息+代码';
  msgAndCode.addEventListener('click', function() { respond(request.id, { value: 'message+code' }); });
  actions.appendChild(msgAndCode);

  var cancel = el('button', 'btn btn-secondary');
  cancel.textContent = '取消';
  cancel.addEventListener('click', function() { respond(request.id, { cancelled: true }); });
  actions.appendChild(cancel);

  box.appendChild(actions);
}

function showRewindConfirm(text, onConfirm) {
  overlayEl.innerHTML = '';
  var box = el('div', 'dialog rewind-dialog');
  var h = el('h3');
  h.textContent = text || '回退确认';
  box.appendChild(h);
  var p = el('p');
  p.textContent = '将把文件恢复到上一次接受时的状态，不会影响对话历史。';
  box.appendChild(p);
  var actions = el('div', 'dialog-actions');
  var cancel = el('button', 'btn btn-secondary');
  cancel.textContent = '取消';
  cancel.addEventListener('click', function() {
    overlayEl.style.display = 'none';
    overlayEl.innerHTML = '';
  });
  var confirm = el('button', 'btn btn-primary');
  confirm.textContent = '确认回退';
  confirm.addEventListener('click', function() {
    confirm.disabled = true;
    overlayEl.style.display = 'none';
    overlayEl.innerHTML = '';
    if (onConfirm) onConfirm();
  });
  actions.appendChild(cancel);
  actions.appendChild(confirm);
  box.appendChild(actions);
  overlayEl.appendChild(box);
  overlayEl.style.display = 'flex';
}`;
}
