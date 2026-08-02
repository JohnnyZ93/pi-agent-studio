export function getComposerJs(): string {
  return `// ---- controls ----
function modelLabel(m) {
  return (m.name || m.id) + (m.provider ? ' [' + m.provider + ']' : '');
}
var modelMeasurer = document.createElement('span');
modelMeasurer.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-family:var(--vscode-font-family);font-size: var(--chat-fs-12);';
document.body.appendChild(modelMeasurer);
function fitSelectToText(sel, extra) {
  var opt = sel.options[sel.selectedIndex];
  if (!opt) return;
  modelMeasurer.textContent = opt.textContent || opt.value || '';
  sel.style.width = (modelMeasurer.offsetWidth + extra) + 'px';
}
function fitModelSelect() { fitSelectToText(modelSelect, 34); }
function fitThinkingSelect() { fitSelectToText(thinkingSelect, 34); }
function fitPermissionSelect() { fitSelectToText(permissionSelect, 34); }
function renderModels() {
  var prev = state.model ? (state.model.provider + '/' + state.model.id) : '';
  modelSelect.innerHTML = '';
  for (var i = 0; i < models.length; i++) {
    var m = models[i];
    var opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = modelLabel(m);
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
  fitModelSelect();
  updateModelIcon();
}
function updateModelIcon() {
  var slot = document.getElementById('model-icon');
  if (!slot) return;
  var idx = Number(modelSelect.value);
  var m = models[idx];
  if (!m) { slot.innerHTML = ''; return; }
  var icon = getModelIcon(m.name || m.id || '');
  slot.innerHTML = modelIconHtml(icon);
  slot.setAttribute('title', m.name || m.id || '');
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
  fitThinkingSelect();
}
function renderPermission() {
  permissionSelect.innerHTML = '';
  var modes = ['AskForApproval', 'FullAccess'];
  for (var i = 0; i < modes.length; i++) {
    var opt = document.createElement('option');
    opt.value = modes[i];
    opt.textContent = modes[i];
    permissionSelect.appendChild(opt);
  }
  fitPermissionSelect();
  updatePermissionColor(permissionSelect.value);
}
function updatePermissionColor(mode) {
  var safe = mode === 'AskForApproval';
  permissionSelect.classList.toggle('permission-safe', safe);
  permissionSelect.classList.toggle('permission-danger', !safe);
  var desc = safe
    ? 'Ask for approval before running commands'
    : 'Full access: run commands without asking';
  permissionSelect.title = desc;
  if (permissionIcon) {
    permissionIcon.classList.toggle('codicon-shield', safe);
    permissionIcon.classList.toggle('codicon-unlock', !safe);
    permissionIcon.classList.toggle('permission-safe', safe);
    permissionIcon.classList.toggle('permission-danger', !safe);
    permissionIcon.title = desc;
  }
}
function applyState(s) {
  if (!s) return;
  state.model = s.model;
  state.thinkingLevel = s.thinkingLevel;
  state.sessionFile = s.sessionFile || null;
  state.sessionName = s.sessionName || '';
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
function currentAtToken() {
  var val = inputEl.value;
  var pos = inputEl.selectionStart;
  if (pos == null) return null;
  var before = val.slice(0, pos);
  var wordStart = 0;
  for (var i = before.length - 1; i >= 0; i--) {
    if (/\\s/.test(before.charAt(i))) { wordStart = i + 1; break; }
  }
  var token = before.slice(wordStart, pos);
  if (token.charAt(0) !== '@') return null;
  return { query: token.slice(1), lineStart: wordStart, after: val.slice(pos) };
}
function scoreCommand(name, q) {
  var n = name.toLowerCase();
  if (!q) return { score: 1, indices: null };
  var pi = n.indexOf(q);
  if (pi >= 0) {
    var idx = [];
    for (var k = 0; k < q.length; k++) idx.push(pi + k);
    if (pi === 0) return { score: 900, indices: idx };
    var prev = n.charAt(pi - 1);
    var base = (prev === '-' || prev === '_' || prev === ' ') ? 750 : 600;
    return { score: base - pi, indices: idx };
  }
  var qi = 0, firstIdx = -1, lastIdx = -1, consec = 0, maxConsec = 0, indices = [];
  for (var i = 0; i < n.length && qi < q.length; i++) {
    if (n.charAt(i) === q.charAt(qi)) {
      if (firstIdx < 0) firstIdx = i;
      if (lastIdx >= 0 && i === lastIdx + 1) consec++; else consec = 1;
      if (consec > maxConsec) maxConsec = consec;
      lastIdx = i;
      indices.push(i);
      qi++;
    }
  }
  if (qi !== q.length) return null;
  var startBonus = 0;
  if (firstIdx === 0) startBonus = 50;
  else { var p = n.charAt(firstIdx - 1); if (p === '-' || p === '_' || p === ' ') startBonus = 30; }
  var gaps = (lastIdx - firstIdx + 1) - q.length;
  var compactBonus = gaps > 0 ? Math.max(0, 40 - gaps * 3) : 40;
  return { score: 100 + startBonus + maxConsec * 8 + compactBonus, indices: indices };
}
function updateAutocomplete() {
  var slash = currentSlashToken();
  if (slash) {
    clearTimeout(fileTimer);
    acMode = 'command';
    var q = slash.token.toLowerCase();
    var scored = [];
    for (var i = 0; i < commands.length; i++) {
      var c = commands[i];
      var m = scoreCommand(c.name, q);
      if (m) scored.push({ cmd: c, score: m.score, indices: m.indices, ord: i });
    }
    if (!scored.length) { hideAutocomplete(); return; }
    scored.sort(function(a, b) {
      if (a.score !== b.score) return b.score - a.score;
      return a.ord - b.ord;
    });
    acItems = [];
    acMatchIndices = [];
    for (var j = 0; j < scored.length; j++) {
      acItems.push(scored[j].cmd);
      acMatchIndices.push(scored[j].indices);
    }
    acIndex = 0;
    renderAutocomplete();
    acEl.style.display = 'block';
    return;
  }
  var at = currentAtToken();
  if (!at) { hideAutocomplete(); return; }
  acMode = 'file';
  acItems = [];
  acIndex = -1;
  acEl.style.display = 'none';
  var query = at.query;
  clearTimeout(fileTimer);
  fileTimer = setTimeout(function() {
    vscode.postMessage({ type: 'searchFiles', query: query });
  }, 120);
}
function renderAutocomplete() {
  acEl.innerHTML = '';
  for (var i = 0; i < acItems.length; i++) {
    var item = el('div', 'autocomplete-item' + (i === acIndex ? ' active' : ''));
    item.setAttribute('data-i', String(i));
    if (acMode === 'file') {
      var p = acItems[i];
      var slashIdx = p.lastIndexOf('/');
      var fname = el('div', 'ac-name');
      fname.textContent = slashIdx >= 0 ? p.slice(slashIdx + 1) : p;
      item.appendChild(fname);
      if (slashIdx >= 0) {
        var fdir = el('div', 'ac-desc');
        fdir.textContent = p.slice(0, slashIdx);
        item.appendChild(fdir);
      }
    } else {
      var c = acItems[i];
      var cname = el('div', 'ac-name');
      var matched = acMatchIndices[i];
      if (matched && matched.length) {
        cname.appendChild(document.createTextNode('/'));
        var mi = 0;
        for (var k = 0; k < c.name.length; k++) {
          if (mi < matched.length && matched[mi] === k) {
            var mk = el('mark', 'ac-hl');
            mk.textContent = c.name.charAt(k);
            cname.appendChild(mk);
            mi++;
          } else {
            cname.appendChild(document.createTextNode(c.name.charAt(k)));
          }
        }
      } else {
        cname.textContent = '/' + c.name;
      }
      var cdesc = el('div', 'ac-desc');
      cdesc.textContent = c.description || '';
      var csrc = el('div', 'ac-source');
      csrc.textContent = c.source;
      item.appendChild(cname);
      item.appendChild(cdesc);
      item.appendChild(csrc);
    }
    acEl.appendChild(item);
  }
  var active = acEl.querySelector('.active');
  if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
}
function hideAutocomplete() { clearTimeout(fileTimer); acEl.style.display = 'none'; acItems = []; acIndex = -1; acMode = 'command'; acMatchIndices = []; }
function applyFileResults(query, files) {
  var info = currentAtToken();
  if (!info || info.query !== query) return;
  if (!files || !files.length) { hideAutocomplete(); return; }
  acMode = 'file';
  acItems = files;
  acIndex = 0;
  renderAutocomplete();
  acEl.style.display = 'block';
}
function completeAutocomplete(item) {
  if (acMode === 'file') {
    var info = currentAtToken();
    if (!info) { hideAutocomplete(); return; }
    var val = inputEl.value;
    var replacement = '@' + item + ' ';
    inputEl.value = val.slice(0, info.lineStart) + replacement + info.after;
    var newPos = info.lineStart + replacement.length;
    inputEl.focus();
    try { inputEl.setSelectionRange(newPos, newPos); } catch (e) {}
    hideAutocomplete();
    return;
  }
  var c = item;
  var val2 = inputEl.value;
  var pos = inputEl.selectionStart;
  var before = val2.slice(0, pos);
  var lineStart = before.lastIndexOf('\\n') + 1;
  var after = val2.slice(pos);
  var replacement2 = '/' + c.name + ' ';
  inputEl.value = val2.slice(0, lineStart) + replacement2 + after;
  var newPos2 = lineStart + replacement2.length;
  inputEl.focus();
  try { inputEl.setSelectionRange(newPos2, newPos2); } catch (e) {}
  hideAutocomplete();
}

// ---- send ----
function isLocalCommand(msg) {
  var s = msg.trim();
  if (s.charAt(0) !== '/') return false;
  var name = s.slice(1);
  var sp = name.indexOf(' ');
  if (sp >= 0) name = name.slice(0, sp);
  if (!name) return false;
  if (BUILTIN_CMDS[name]) return true;
  for (var i = 0; i < commands.length; i++) {
    var c = commands[i];
    if (c.name === name && c.source === 'extension') return true;
  }
  return false;
}

function sendPrompt(behavior) {
  var msg = inputEl.value;
  var imgs = pendingImages.slice();
  var hasText = !!msg.trim();
  var hasImgs = imgs.length > 0;
  if (!hasText && !hasImgs) return;
  var isLocal = isLocalCommand(msg);
  if (state.isStreaming && isLocal) return;
  var sendImgs = (!isLocal && hasImgs)
    ? imgs.map(function(im) { return { type: 'image', data: im.data, mimeType: im.mimeType }; })
    : null;
  pushHistory(msg);
  inputEl.value = '';
  autoGrow();
  hideAutocomplete();
  historyIndex = -1;
  historyDraft = '';
  clearPendingImages();
  if (state.isStreaming) {
    var steerPayload = { type: 'prompt', message: msg, streamingBehavior: behavior || 'steer' };
    if (sendImgs) steerPayload.images = sendImgs;
    vscode.postMessage(steerPayload);
  } else {
    autoScroll = true;
    addUserMessage(msg, sendImgs);
    scrollToBottom();
    if (!isLocal) {
      setStreaming(true);
    } else {
      updateSendButton();
    }
    var payload = { type: 'prompt', message: msg };
    if (sendImgs) payload.images = sendImgs;
    vscode.postMessage(payload);
  }
}

function autoGrow() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
}
function pushHistory(msg) {
  if (typeof msg !== 'string' || !msg.trim()) return;
  var last = inputHistory.length ? inputHistory[inputHistory.length - 1] : '';
  if (last.trim() === msg.trim()) return;
  inputHistory.push(msg);
  if (inputHistory.length > 500) inputHistory.shift();
}
function navigateHistory(delta) {
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
      historyDraft = '';
      autoGrow();
      updateSendButton();
      return;
    }
    if (historyIndex < 0) historyIndex = 0;
  }
  inputEl.value = inputHistory[historyIndex];
  var len = inputEl.value.length;
  try { inputEl.setSelectionRange(len, len); } catch (e) {}
  autoGrow();
  updateSendButton();
}

attachBtn.addEventListener('click', function() {
  if (state.isStreaming) return;
  vscode.postMessage({ type: 'pickResource' });
});
function addImageFromFile(file) {
  var reader = new FileReader();
  reader.onload = function() {
    var dataUrl = String(reader.result || '');
    var marker = ';base64,';
    var idx = dataUrl.indexOf(marker);
    if (idx < 0 || dataUrl.indexOf('data:') !== 0) return;
    var mimeType = dataUrl.slice(5, idx);
    var data = dataUrl.slice(idx + marker.length);
    pendingImages.push({ data: data, mimeType: mimeType, dataUrl: dataUrl });
    renderPendingImages();
    updateSendButton();
  };
  reader.onerror = function() { /* ignore */ };
  reader.readAsDataURL(file);
}
function removePendingImage(idx) {
  pendingImages.splice(idx, 1);
  renderPendingImages();
  updateSendButton();
}
function clearPendingImages() {
  pendingImages = [];
  renderPendingImages();
}
function renderPendingImages() {
  attachPreviewEl.innerHTML = '';
  if (!pendingImages.length) { attachPreviewEl.style.display = 'none'; return; }
  for (var i = 0; i < pendingImages.length; i++) {
    (function(im, idx) {
      var thumb = el('div', 'attach-thumb');
      var img = document.createElement('img');
      img.src = im.dataUrl;
      thumb.appendChild(img);
      var rm = el('button', 'attach-remove');
      rm.type = 'button';
      rm.title = 'Remove image';
      rm.textContent = '\u00d7';
      rm.addEventListener('click', function() { removePendingImage(idx); });
      thumb.appendChild(rm);
      attachPreviewEl.appendChild(thumb);
    })(pendingImages[i], i);
  }
  attachPreviewEl.style.display = 'flex';
}
function isImageType(t) { return typeof t === 'string' && t.indexOf('image/') === 0; }
function dtHasFiles(dt) {
  if (!dt || !dt.types) return false;
  for (var i = 0; i < dt.types.length; i++) if (dt.types[i] === 'Files') return true;
  return false;
}
inputEl.addEventListener('paste', function(ev) {
  var cd = ev.clipboardData;
  if (!cd || !cd.items) return;
  var imgItems = [];
  for (var i = 0; i < cd.items.length; i++) {
    var it = cd.items[i];
    if (it.kind === 'file' && isImageType(it.type)) imgItems.push(it);
  }
  if (!imgItems.length) return;
  ev.preventDefault();
  for (var k = 0; k < imgItems.length; k++) {
    var file = imgItems[k].getAsFile();
    if (file) addImageFromFile(file);
  }
});
inputEl.addEventListener('dragover', function(ev) {
  if (dtHasFiles(ev.dataTransfer)) ev.preventDefault();
});
inputEl.addEventListener('drop', function(ev) {
  if (!ev.dataTransfer || !ev.dataTransfer.files || !ev.dataTransfer.files.length) return;
  var files = ev.dataTransfer.files;
  var hasImg = false;
  for (var i = 0; i < files.length; i++) if (isImageType(files[i].type)) hasImg = true;
  if (!hasImg) return;
  ev.preventDefault();
  for (var j = 0; j < files.length; j++) if (isImageType(files[j].type)) addImageFromFile(files[j]);
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

// ---- context menu (copy / fork / revert) ----
var ctxMenu = document.getElementById('ctx-menu');
var ctxCopy = document.getElementById('ctx-copy');
var ctxFork = document.getElementById('ctx-fork');
var ctxRevert = document.getElementById('ctx-revert');
var ctxText = '';
var ctxUserTs = null;
var COPYABLE = '.user-bubble, .text-block, .thinking-body';
function showCtxMenu(x, y, text, userTs) {
  ctxText = text || '';
  ctxCopy.disabled = !ctxText;
  ctxUserTs = userTs != null ? userTs : null;
  if (ctxUserTs == null) {
    ctxFork.disabled = true;
    ctxFork.style.display = 'none';
    ctxRevert.disabled = true;
    ctxRevert.style.display = 'none';
  } else {
    ctxFork.disabled = state.isStreaming;
    ctxFork.style.display = '';
    ctxRevert.disabled = state.isStreaming;
    ctxRevert.style.display = '';
  }
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
  var userTs = null;
  var node = ev.target;
  while (node && node !== messagesEl && node !== document) {
    if (node.classList && node.classList.contains('user-bubble')) { userTs = node._piTs != null ? node._piTs : null; break; }
    if (node.classList && node.classList.contains('bubble-meta')) {
      var ub = node.parentNode ? node.parentNode.querySelector('.user-bubble') : null;
      if (ub) { userTs = ub._piTs != null ? ub._piTs : null; break; }
    }
    if (node.classList && node.classList.contains('msg') && node.classList.contains('user')) break;
    node = node.parentNode;
  }
  if (!text) {
    var node2 = ev.target;
    while (node2 && node2 !== messagesEl && node2 !== document) {
      if (node2.matches && node2.matches(COPYABLE)) { text = node2._piMd || node2.textContent || ''; break; }
      node2 = node2.parentNode;
    }
  }
  if (!text && userTs == null) { hideCtxMenu(); return; }
  ev.preventDefault();
  showCtxMenu(ev.clientX, ev.clientY, text, userTs);
});
ctxCopy.addEventListener('click', function() {
  if (ctxText) vscode.postMessage({ type: 'copy', text: ctxText });
  hideCtxMenu();
});
ctxFork.addEventListener('click', function() {
  if (ctxUserTs == null || state.isStreaming) return;
  var ts = ctxUserTs;
  hideCtxMenu();
  vscode.postMessage({ type: 'fork', ts: ts });
});
ctxRevert.addEventListener('click', function() {
  if (ctxUserTs == null || state.isStreaming) return;
  var ts = ctxUserTs;
  hideCtxMenu();
  vscode.postMessage({ type: 'revert', ts: ts });
});
document.addEventListener('mousedown', function(ev) {
  if (ctxMenu.style.display === 'none') return;
  if (ev.target === ctxMenu || ctxMenu.contains(ev.target)) return;
  hideCtxMenu();
});
messagesEl.addEventListener('scroll', hideCtxMenu, true);
window.addEventListener('blur', hideCtxMenu);

// ---- dialog (tool approval) ----
function renderQuestionnaireForm(box, request) {
  var data;
  try { data = JSON.parse(request.prefill || '{}'); } catch (e) { data = { questions: [] }; }
  var qs = data.questions || [];
  var answers = {};
  var submitBtn = null;
  function updateTitle() {
    var answered = 0;
    for (var i = 0; i < qs.length; i++) { if (answers[qs[i].id]) answered++; }
    h.textContent = answered + '/' + qs.length + ' questions';
  }
  function updateSubmit() {
    updateTitle();
    if (!submitBtn) return;
    var allAnswered = qs.every(function(q) { return answers[q.id]; });
    submitBtn.disabled = !allAnswered;
  }
  var h = el('h3');
  box.appendChild(h);
  for (var qi = 0; qi < qs.length; qi++) {
    (function(q, idx) {
      var block = el('div', 'q-block');
      var hdr = el('div', 'q-header');
      var num = el('span', 'q-num'); num.textContent = (idx + 1) + '.';
      var lbl = el('span', 'q-label'); lbl.textContent = q.label || ('Q' + (idx + 1));
      hdr.appendChild(num); hdr.appendChild(lbl);
      block.appendChild(hdr);
      var prompt = el('div', 'q-prompt'); prompt.textContent = q.prompt; block.appendChild(prompt);
      var opts = (q.options || []).slice();
      if (q.allowOther !== false) opts.push({ label: 'Type something.', isOther: true });
      var optList = el('div', 'q-options');
      var ta = el('textarea', 'q-textarea dialog-input');
      ta.style.display = 'none';
      ta.placeholder = 'Type your answer...';
      for (var oi = 0; oi < opts.length; oi++) {
        (function(opt, oIndex) {
          var btn = el('button', 'opt-btn');
          if (opt.description) {
            var l = el('span', 'opt-label'); l.textContent = opt.label;
            var d = el('span', 'opt-desc'); d.textContent = opt.description;
            btn.appendChild(l); btn.appendChild(d);
          } else {
            btn.textContent = opt.label;
          }
          btn.addEventListener('click', function() {
            var sibs = optList.querySelectorAll('.opt-btn');
            for (var s = 0; s < sibs.length; s++) sibs[s].classList.remove('selected');
            btn.classList.add('selected');
            if (opt.isOther) {
              ta.style.display = 'block';
              ta.focus();
              var v = ta.value.trim() || '(no response)';
              answers[q.id] = { id: q.id, value: v, label: v, wasCustom: true };
              updateSubmit();
            } else {
              ta.style.display = 'none';
              ta.value = '';
              answers[q.id] = { id: q.id, value: opt.label, label: opt.label, wasCustom: false, index: oIndex + 1 };
              updateSubmit();
            }
          });
          optList.appendChild(btn);
        })(opts[oi], oi);
      }
      block.appendChild(optList);
      block.appendChild(ta);
      ta.addEventListener('input', function() {
        if (answers[q.id] && answers[q.id].wasCustom) {
          var v = ta.value.trim() || '(no response)';
          answers[q.id] = { id: q.id, value: v, label: v, wasCustom: true };
        }
      });
      box.appendChild(block);
    })(qs[qi], qi);
  }
  var actions = el('div', 'dialog-actions');
  var cancel = el('button', 'btn btn-secondary'); cancel.textContent = 'Cancel';
  cancel.addEventListener('click', function() { respond(request.id, { cancelled: true }); });
  submitBtn = el('button', 'btn btn-primary'); submitBtn.textContent = 'Submit';
  submitBtn.addEventListener('click', function() {
    var arr = [];
    for (var qi2 = 0; qi2 < qs.length; qi2++) {
      var a = answers[qs[qi2].id];
      if (a) arr.push(a);
    }
    respond(request.id, { value: JSON.stringify({ answers: arr }) });
  });
  actions.appendChild(cancel); actions.appendChild(submitBtn);
  box.appendChild(actions);
  updateSubmit();
}
function showDialog(request) {
  overlayEl.innerHTML = '';
  var box = el('div', 'dialog');
  var method = request.method;
  var title = request.title || (method === 'confirm' ? 'Confirm' : 'Input required');
  var h = el('h3'); h.textContent = title;
  var isPermission = method === 'select' && String(request.title || '').indexOf('Dangerous Command:') === 0;
  box.appendChild(h);
  if (request.message) { var p = el('p'); p.textContent = String(request.message); box.appendChild(p); }

  var inputField = null;
  if (method === 'editor' && request.title === 'Pi Questionnaire Form') {
    renderQuestionnaireForm(box, request);
    overlayEl.appendChild(box);
    overlayEl.style.display = 'flex';
    return;
  }
  if (method === 'editor' && request.title === 'Pi Rewind Confirm') {
    renderRewindDialog(box, request);
    overlayEl.appendChild(box);
    overlayEl.style.display = 'flex';
    return;
  }
  if (method === 'select' && Array.isArray(request.options)) {
    var list = el('div', 'opt-list');
    for (var i = 0; i < request.options.length; i++) {
      (function(opt) {
        var btn = el('button', 'opt-btn');
        btn.textContent = String(opt);
        if (isPermission) {
          if (String(opt) === 'Allow') btn.classList.add('opt-allow');
          else if (String(opt) === 'Block') btn.classList.add('opt-block');
        }
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

var toastTimer = null;
function showToast(text, kind, persistent) {
  if (!text) return;
  toastEl.textContent = text;
  toastEl.className = 'toast show' + (kind ? ' ' + kind : '') + (persistent ? ' persistent' : '');
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  if (!persistent) {
    toastTimer = setTimeout(function() { toastEl.className = 'toast'; }, 3500);
  }
}
function hideToast() {
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  toastEl.className = 'toast';
}

var infoBackdropFn = null;
function showInfoPanel(title, markdown) {
  closeInfoPanel();
  var box = el('div', 'info-panel');
  var h = el('h3'); h.textContent = title || ''; box.appendChild(h);
  var body = el('div', 'info-panel-body');
  box.appendChild(body);
  renderMarkdown(body, markdown || '');
  var actions = el('div', 'info-panel-actions');
  var copyBtn = el('button', 'btn btn-secondary'); copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', function() {
    vscode.postMessage({ type: 'copy', text: markdown || '' });
    showToast('Copied', 'success');
  });
  actions.appendChild(copyBtn);
  var closeBtn = el('button', 'btn btn-primary'); closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', closeInfoPanel);
  actions.appendChild(closeBtn);
  box.appendChild(actions);
  overlayEl.appendChild(box);
  infoBackdropFn = function(ev) { if (ev.target === overlayEl) closeInfoPanel(); };
  overlayEl.addEventListener('click', infoBackdropFn);
  overlayEl.style.display = 'flex';
}
function closeInfoPanel() {
  if (infoBackdropFn) { overlayEl.removeEventListener('click', infoBackdropFn); infoBackdropFn = null; }
  overlayEl.style.display = 'none';
  overlayEl.innerHTML = '';
}

// ---- wire up ----
modelSelect.addEventListener('change', function() {
  var idx = Number(modelSelect.value);
  var m = models[idx];
  if (m) vscode.postMessage({ type: 'setModel', provider: m.provider, modelId: m.id });
  fitModelSelect();
  updateModelIcon();
});
thinkingSelect.addEventListener('change', function() {
  vscode.postMessage({ type: 'setThinking', level: thinkingSelect.value });
  fitThinkingSelect();
});
permissionSelect.addEventListener('change', function() {
  var v = permissionSelect.value;
  fitPermissionSelect();
  updatePermissionColor(v);
  vscode.postMessage({ type: 'setPermission', mode: v });
});
sendBtn.addEventListener('click', function() {
  if (state.isStreaming) { vscode.postMessage({ type: 'abort' }); return; }
  if (state.isBtwLoading && btwAbortId) { vscode.postMessage({ type: 'btwAbort', id: btwAbortId }); return; }
  sendPrompt();
});

inputEl.addEventListener('input', function() { autoGrow(); updateAutocomplete(); updateSendButton(); historyIndex = -1; historyDraft = ''; });
inputEl.addEventListener('keydown', function(ev) {
  if (acItems.length && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
    ev.preventDefault();
    acIndex = (acIndex + (ev.key === 'ArrowDown' ? 1 : -1) + acItems.length) % acItems.length;
    renderAutocomplete();
    return;
  }
  if (acItems.length && !ev.altKey && (ev.key === 'Enter' || ev.key === 'Tab')) {
    ev.preventDefault();
    completeAutocomplete(acItems[acIndex]);
    return;
  }
  if (ev.key === 'Escape' && (acItems.length || fileTimer)) { ev.preventDefault(); hideAutocomplete(); return; }
  if (!ev.shiftKey && !ev.altKey && !ev.ctrlKey && !ev.metaKey && ev.key === 'ArrowUp') {
    var pos = inputEl.selectionStart;
    if (inputEl.value.slice(0, pos).indexOf('\\n') === -1) { ev.preventDefault(); navigateHistory(-1); return; }
  }
  if (!ev.shiftKey && !ev.altKey && !ev.ctrlKey && !ev.metaKey && ev.key === 'ArrowDown') {
    var dpos = inputEl.selectionStart;
    if (inputEl.value.slice(dpos).indexOf('\\n') === -1) { ev.preventDefault(); navigateHistory(1); return; }
  }
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
    ev.preventDefault();
    sendPrompt(ev.altKey ? 'followUp' : 'steer');
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
    case 'state': applyState(d.state); break;
    case 'sessionInfo': sessionInfoEl.textContent = d.label || ''; break;
    case 'models': models = d.models || []; renderModels(); break;
    case 'thinkingLevels': thinkingLevels = d.levels || []; renderThinking(); break;
    case 'permissionMode':
      permissionSelect.value = d.mode || 'AskForApproval';
      fitPermissionSelect();
      updatePermissionColor(permissionSelect.value);
      break;
    case 'commands': commands = d.commands || []; break;
    case 'messages': queueState.steering = []; queueState.followUp = []; renderQueue(); hydrateMessages(d.messages); break;
    case 'event': handleEvent(d.event); break;
    case 'pickedResources': insertPickedResources(d.paths); break;
    case 'prefillInput':
      inputEl.value = d.text || '';
      autoGrow();
      updateSendButton();
      inputEl.focus();
      break;
    case 'files': applyFileResults(d.query, d.files); break;
    case 'widget':
      if (d.widgetKey === 'btw') handleBtw(d.widgetLines);
      else if (d.widgetKey === 'rewind-files') applyRewindWidget(d.widgetLines);
      else applyWidget(d.widgetKey, d.widgetLines);
      break;
    case 'btwAbortReady':
      btwAbortId = d.id;
      setBtwLoading(true);
      break;
    case 'contextUsage': applyContextUsage(d.usage, d.cost); break;
    case 'toast': showToast(d.text, d.kind); break;
    case 'infoPanel': showInfoPanel(d.title, d.markdown); break;
    case 'dialog': showDialog(d.request); break;
    case 'error':
      setStreaming(false);
      var eb = el('div', 'error-banner');
      eb.textContent = d.message || 'Error';
      messagesInner.appendChild(eb);
      scrollToBottom();
      break;
    default: break;
  }
});

var ctxTooltip = document.createElement('div');
ctxTooltip.className = 'ctx-tooltip';
ctxTooltip.style.display = 'none';
document.body.appendChild(ctxTooltip);
function showTooltip(target, text) {
  if (!text) return;
  ctxTooltip.textContent = text;
  ctxTooltip.style.display = 'block';
  var r = target.getBoundingClientRect();
  var cw = ctxTooltip.offsetWidth;
  var ch = ctxTooltip.offsetHeight;
  var x = r.left + r.width / 2 - cw / 2;
  if (x < 4) x = 4;
  else if (x + cw > window.innerWidth - 4) x = window.innerWidth - cw - 4;
  var aboveY = r.top - ch - 6;
  var belowY = r.bottom + 6;
  var below = aboveY < 4;
  ctxTooltip.style.left = x + 'px';
  ctxTooltip.style.top = (below ? belowY : aboveY) + 'px';
}
function hideTooltip() { ctxTooltip.style.display = 'none'; }
ctxRing.addEventListener('mouseenter', function() { showTooltip(ctxRing, ctxRingText); });
ctxRing.addEventListener('mouseleave', hideTooltip);
modelSelect.addEventListener('mouseenter', function() {
  var idx = Number(modelSelect.value);
  var m = models[idx];
  showTooltip(modelSelect, m ? modelLabel(m) : '');
});
modelSelect.addEventListener('mouseleave', hideTooltip);
var OPEN_FILE_HINT = /Mac/i.test(navigator.platform || '') ? '\u2318 Click to open file' : 'Ctrl+Click to open file';
function toolHeadOfFile(target) {
  if (!target || !target.closest) return null;
  var node = target.closest('.tool-block[data-has-file] > .tool-head');
  return node || null;
}
var fileHintHead = null;
var fileHintTimer = null;
messagesEl.addEventListener('mouseover', function(ev) {
  var head = toolHeadOfFile(ev.target);
  if (head !== fileHintHead) {
    if (fileHintTimer) { clearTimeout(fileHintTimer); fileHintTimer = null; }
    hideTooltip();
    fileHintHead = head;
    if (head) {
      fileHintTimer = setTimeout(function() { showTooltip(head, OPEN_FILE_HINT); }, 500);
    }
  }
});
messagesEl.addEventListener('mouseout', function(ev) {
  if (fileHintHead && !toolHeadOfFile(ev.relatedTarget)) {
    if (fileHintTimer) { clearTimeout(fileHintTimer); fileHintTimer = null; }
    fileHintHead = null;
    hideTooltip();
  }
});

document.addEventListener('keydown', function(e) { if (e.ctrlKey || e.metaKey) document.body.classList.add('ctrl-key'); });
document.addEventListener('keyup', function(e) { if (!e.ctrlKey && !e.metaKey) document.body.classList.remove('ctrl-key'); });
window.addEventListener('blur', function() { document.body.classList.remove('ctrl-key'); });

autoGrow();
updateSendButton();
applyContextUsage(null);
clearMessages();
renderPermission();`;
}
