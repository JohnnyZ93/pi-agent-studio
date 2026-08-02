export function getRewindJs(): string {
  return `// ---- rewind: widget, per-message actions, custom dialogs ----
var ICON_COPY = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5V3A1.5 1.5 0 0 0 9 1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h.5"/></svg>';
var ICON_FORK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="4.5" cy="3.5" r="1.5"/><circle cx="4.5" cy="12.5" r="1.5"/><circle cx="11.5" cy="8" r="1.5"/><path d="M4.5 5v6"/><path d="M6 8h4"/></svg>';
var ICON_REVERT = '<span class="codicon codicon-discard"></span>';
var ICON_CHEVRON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 3.5L10 8l-4.5 4.5"/></svg>';
var ICON_ACCEPT = '<span class="codicon codicon-check"></span>';
var ICON_REVERT_FILE = '<span class="codicon codicon-discard"></span>';

var rewindWidgetEl = document.getElementById('rewind-widget');
var rewindCollapsed = true;

function tipBtn(btn, text) {
  btn.addEventListener('mouseenter', function() { showTooltip(btn, text); });
  btn.addEventListener('mouseleave', hideTooltip);
  return btn;
}

function appendCounts(parent, added, removed) {
  var hasAdd = added != null && added > 0;
  var hasRem = removed != null && removed > 0;
  if (hasAdd) {
    var a = el('span', 'rewind-add');
    a.textContent = '+' + added;
    parent.appendChild(a);
  }
  if (hasRem) {
    var r = el('span', 'rewind-removed');
    r.textContent = '-' + removed;
    parent.appendChild(r);
  }
  if (!hasAdd && !hasRem) parent.textContent = '-';
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
  chev.addEventListener('click', function() {
    rewindCollapsed = !rewindCollapsed;
    applyRewindWidget(lines);
  });
  head.appendChild(chev);

  var title = el('span', 'rewind-title');
  title.textContent = 'Modified files (' + files.length + ')';
  head.appendChild(title);

  var totalsEl = el('span', 'rewind-totals');
  appendCounts(totalsEl, totals.added, totals.removed);
  head.appendChild(totalsEl);

  var headActions = el('span', 'rewind-head-actions');
  var acceptAll = el('button', 'rewind-btn rewind-accept');
  acceptAll.type = 'button';
  acceptAll.innerHTML = ICON_ACCEPT + '<span>Accept all</span>';
  acceptAll.addEventListener('click', function() {
    if (state.isStreaming) { showToast('Stop the agent before changing files.', 'error'); return; }
    vscode.postMessage({ type: 'rewindAccept' });
  });
  headActions.appendChild(acceptAll);

  var revertAll = el('button', 'rewind-btn rewind-revert');
  revertAll.type = 'button';
  revertAll.innerHTML = ICON_REVERT_FILE + '<span>Revert all</span>';
  revertAll.addEventListener('click', function() {
    if (state.isStreaming) { showToast('Stop the agent before reverting.', 'error'); return; }
    showRewindConfirm('Revert all ' + files.length + ' file' + (files.length === 1 ? '' : 's') + '?', 'Files will be restored to their last accepted state. Conversation history is not affected.', function() {
      vscode.postMessage({ type: 'rewindRevert' });
    }, 'Confirm revert');
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
      appendCounts(counts, f.added, f.removed);
      row.appendChild(counts);

      var rowActions = el('span', 'rewind-row-actions');
      var accBtn = el('button', 'rewind-btn rewind-accept');
      accBtn.type = 'button';
      accBtn.innerHTML = ICON_ACCEPT + '<span>Accept</span>';
      accBtn.addEventListener('click', function(id) {
        return function() {
          if (state.isStreaming) { showToast('Stop the agent before changing files.', 'error'); return; }
          vscode.postMessage({ type: 'rewindAcceptFile', id: id });
        };
      }(f.id));
      rowActions.appendChild(accBtn);

      var revBtn = el('button', 'rewind-btn rewind-revert');
      revBtn.type = 'button';
      revBtn.innerHTML = ICON_REVERT_FILE + '<span>Revert</span>';
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

function appendUserActions(row, bubble, text, metaEl) {
  if (!row || !bubble) return;
  var actions = el('div', 'bubble-actions');
  var copyBtn = el('button', 'icon-btn');
  copyBtn.type = 'button';
  tipBtn(copyBtn, 'Copy');
  copyBtn.innerHTML = ICON_COPY;
  copyBtn.addEventListener('click', function() {
    vscode.postMessage({ type: 'copy', text: text || '' });
  });
  actions.appendChild(copyBtn);

  var forkBtn = el('button', 'icon-btn');
  forkBtn.type = 'button';
  tipBtn(forkBtn, 'Fork');
  forkBtn.innerHTML = ICON_FORK;
  forkBtn.addEventListener('click', function() {
    var ts = bubble._piTs;
    if (state.isStreaming) return;
    if (ts == null) { showToast('Message not ready yet.', 'info'); return; }
    showRewindConfirm('Fork from this message?', 'Create a new branch from this message. Current file changes are kept.', function() {
      vscode.postMessage({ type: 'fork', ts: ts });
    }, 'Fork');
  });
  actions.appendChild(forkBtn);

  var revertBtn = el('button', 'icon-btn');
  revertBtn.type = 'button';
  tipBtn(revertBtn, 'Revert');
  revertBtn.innerHTML = ICON_REVERT;
  revertBtn.addEventListener('click', function() {
    var ts = bubble._piTs;
    if (state.isStreaming) return;
    if (ts == null) { showToast('Message not ready yet.', 'info'); return; }
    vscode.postMessage({ type: 'revert', ts: ts });
  });
  actions.appendChild(revertBtn);

  if (metaEl) metaEl.insertBefore(actions, metaEl.firstChild);
  else row.appendChild(actions);
}

function renderRewindDialog(box, request) {
  box.classList.add('rewind-dialog');
  var data = {};
  try { data = JSON.parse(request.prefill || '{}'); } catch (e) { data = {}; }
  var label = data.label || '';
  var affected = Number(data.affected);
  if (!isFinite(affected)) affected = 0;

  var h = box.querySelector('h3');
  if (h) h.textContent = 'Revert';
  if (label) {
    var p = el('p');
    p.textContent = label;
    box.appendChild(p);
  }
  var p2 = el('p');
  p2.textContent = affected + ' file' + (affected === 1 ? '' : 's') + ' affected';
  box.appendChild(p2);

  var actions = el('div', 'dialog-actions');
  var msgOnly = el('button', 'btn btn-secondary');
  msgOnly.textContent = 'Revert message only';
  msgOnly.addEventListener('click', function() { respond(request.id, { value: 'message-only' }); });
  actions.appendChild(msgOnly);

  var msgAndCode = el('button', 'btn btn-primary');
  msgAndCode.textContent = 'Revert message + code';
  msgAndCode.addEventListener('click', function() { respond(request.id, { value: 'message+code' }); });
  actions.appendChild(msgAndCode);

  var cancel = el('button', 'btn btn-secondary');
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', function() { respond(request.id, { cancelled: true }); });
  actions.appendChild(cancel);

  box.appendChild(actions);
}

function showRewindConfirm(title, description, onConfirm, confirmText) {
  overlayEl.innerHTML = '';
  var box = el('div', 'dialog rewind-dialog');
  var h = el('h3');
  h.textContent = title || 'Confirm';
  box.appendChild(h);
  var p = el('p');
  p.textContent = description || '';
  box.appendChild(p);
  var actions = el('div', 'dialog-actions');
  var cancel = el('button', 'btn btn-secondary');
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', function() {
    overlayEl.style.display = 'none';
    overlayEl.innerHTML = '';
  });
  var confirm = el('button', 'btn btn-primary');
  confirm.textContent = confirmText || 'Confirm';
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
