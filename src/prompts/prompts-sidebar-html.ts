export function getPromptsHtml(hasWorkspace: boolean): string {
  const projectOpt = hasWorkspace
    ? '<option value="project">project (.pi/prompts)</option>'
    : '<option value="project" disabled>project (no workspace)</option>';
  return `<!DOCTYPE html>
<html style="height:100%;margin:0;padding:0">
<head><meta charset="utf-8"><style>
*{box-sizing:border-box}
body{height:100%;margin:0;padding:0;font-family:var(--vscode-font-family);font-size:13px;color:var(--vscode-foreground);display:flex;flex-direction:column;overflow:hidden}
.header{padding:8px;display:flex;align-items:center;justify-content:space-between;gap:6px;flex-shrink:0;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent))}
.header strong{font-size:12px;white-space:nowrap}
.header-actions{display:flex;gap:4px;flex-shrink:0}
.header button{padding:2px 4px;cursor:pointer;background:transparent;color:var(--vscode-foreground);border:1px solid var(--vscode-widget-border,transparent);border-radius:3px;font-size:12px;opacity:.7;white-space:nowrap}
.header button:hover{opacity:1}
.main{flex:1;overflow-y:auto}
.prompt-item{padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent));position:relative}
.prompt-item:hover{background:var(--vscode-list-hoverBackground)}
.prompt-item.selected{background:var(--vscode-list-activeSelectionBackground);color:var(--vscode-list-activeSelectionForeground)}
.prompt-item-row{display:flex;align-items:center;gap:6px;padding-right:60px}
.prompt-name{flex:0 1 auto;min-width:0;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prompt-source{font-size:10px;opacity:.6;flex-shrink:0;padding:1px 5px;border-radius:3px;background:var(--vscode-badge-background,rgba(127,127,127,0.15))}
.prompt-source.user{background:rgba(0,120,212,0.25);opacity:.85}
.prompt-source.project{background:rgba(0,150,80,0.18);opacity:.85}
.prompt-source.package{background:rgba(150,100,220,0.22);opacity:.85}
.prompt-source.cli{background:rgba(220,130,0,0.2);opacity:.85}
.prompt-source.other{background:rgba(127,127,127,0.2);opacity:.7}
.prompt-desc{font-size:11px;opacity:.6;margin-top:2px;padding-right:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prompt-actions{position:absolute;right:8px;top:8px;display:flex;gap:2px;opacity:0;transition:opacity .1s}
.prompt-item:hover .prompt-actions{opacity:1}
.prompt-actions button{padding:2px 6px;cursor:pointer;background:transparent;border:1px solid var(--vscode-widget-border,transparent);border-radius:3px;font-size:11px;color:var(--vscode-foreground)}
.prompt-actions button:hover{background:var(--vscode-toolbar-hoverBackground)}
.prompt-actions button.danger:hover{background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:var(--pi-error-text);border-color:transparent}
.detail{padding:10px;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent));background:var(--vscode-editor-background)}
.detail h3{margin:0 0 8px;font-size:13px}
.form-group{margin-bottom:8px}
.form-group label{display:block;font-size:11px;opacity:.7;margin-bottom:2px}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:4px 6px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:3px;font-size:12px;font-family:inherit;outline:none}
.form-group textarea{min-height:60px;resize:vertical}
.form-group .readonly-field{padding:4px 6px;font-size:12px;opacity:.6;border:1px solid transparent;border-radius:3px}
.form-group .readonly-field code{font-family:var(--vscode-editor-font-family)}
.form-group .readonly-pre{margin:0;padding:4px 6px;font-size:12px;opacity:.8;background:var(--vscode-input-background);border:1px solid transparent;border-radius:3px;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow:auto;font-family:var(--vscode-editor-font-family)}
.btn{padding:4px 12px;cursor:pointer;border:none;border-radius:3px;font-size:12px}
.btn-primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.btn-primary:hover{background:var(--vscode-button-hoverBackground)}
.btn-danger{background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:var(--pi-error-text)}
.btn-danger:hover{opacity:.9}
.btn-secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
.btn-secondary:hover{background:var(--vscode-button-secondaryHoverBackground)}
.btn-sm{padding:2px 8px;font-size:11px}
.btn-row{display:flex;gap:4px;margin-top:8px;flex-wrap:wrap}
.empty{padding:20px;text-align:center;opacity:.5;font-size:12px}
.error-toast{padding:8px 10px;margin:8px;background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:var(--pi-error-text);border-radius:4px;font-size:12px;display:none}
.error-toast.show{display:block}
.delete-confirm{padding:6px 10px;background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:var(--pi-error-text);font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:8px}
.delete-confirm button{padding:2px 8px;cursor:pointer;border:none;border-radius:3px;font-size:11px}
.delete-confirm .btn-confirm{background:rgba(0,0,0,0.15);color:var(--pi-error-text)}
.delete-confirm .btn-cancel{background:transparent;color:var(--pi-error-text);text-decoration:underline}
</style></head>
<body>
<div class="header"><strong>📋 Prompt Templates</strong><div class="header-actions"><button data-action="new" title="New Prompt">+</button><button data-action="refresh" title="Refresh">↻</button></div></div>
<div id="error-toast" class="error-toast"></div>
<div class="main" id="main"></div>
<script>
(function(){
var vsc = acquireVsCodeApi();
var VD = null;
var expanded = null;
var deleteTarget = null;

function escA(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escH(s) { var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
function showErr(m) { var e = document.getElementById('error-toast'); e.textContent = m; e.classList.add('show'); setTimeout(function(){ e.classList.remove('show'); }, 5000); }
function refresh() { vsc.postMessage({ type: 'refresh' }); }
function sourceClass(p) {
  var c = p.sourceLabel;
  return (c === 'user' || c === 'project' || c === 'package' || c === 'cli') ? c : 'other';
}

// ====== shared field renderers ======
function renderTextField(id, label, value, placeholder) {
  return '<div class="form-group"><label>' + escH(label) + '</label>' +
    '<input id="' + id + '" value="' + escA(value || '') + '" placeholder="' + escA(placeholder || '') + '" /></div>';
}
function renderTextareaField(id, label, value, placeholder) {
  return '<div class="form-group"><label>' + escH(label) + '</label>' +
    '<textarea id="' + id + '" placeholder="' + escA(placeholder || '') + '">' + escH(value || '') + '</textarea></div>';
}

// ====== render ======
function render() {
  if (!VD) return;
  var el = document.getElementById('main');
  var h = '';
  if (!VD.prompts || !VD.prompts.length) {
    h += '<div class="empty">No prompt templates yet. Click + to create one.</div>';
  } else {
    h += renderPromptList(VD.prompts);
  }
  if (expanded === '__new__') h += renderNewForm();
  el.innerHTML = h;
}

function renderPromptList(prompts) {
  var h = '';
  for (var i = 0; i < prompts.length; i++) {
    var p = prompts[i];
    if (deleteTarget === p.name) {
      h += '<div class="delete-confirm">Delete "' + escH(p.name) + '" (' + escH(p.sourceLabel) + ')? <span><button class="btn-confirm" data-action="delete-confirm" data-name="' + escA(p.name) + '" data-scope="' + escA(p.scope) + '">Delete</button> <button class="btn-cancel" data-action="delete-cancel">Cancel</button></span></div>';
      continue;
    }
    var isExpanded = expanded === p.name;
    h += '<div class="prompt-item' + (isExpanded ? ' selected' : '') + '">';
    h += '<div class="prompt-item-row" data-action="expand" data-name="' + escA(p.name) + '">';
    h += '<span class="prompt-name">' + escH(p.name) + '</span>';
    h += '<span class="prompt-source ' + sourceClass(p) + '" title="' + escA(p.filePath) + '">' + escH(p.sourceLabel) + '</span></div>';
    h += '<div class="prompt-desc">' + escH(p.description) + (p.argumentHint ? ' · ' + escH(p.argumentHint) : '') + '</div>';
    h += '<div class="prompt-actions">';
    if (p.editable) {
      h += '<button data-action="expand" data-name="' + escA(p.name) + '" title="Edit">✏️</button>';
      h += '<button class="danger" data-action="delete" data-name="' + escA(p.name) + '" data-scope="' + escA(p.scope) + '" title="Delete">🗑️</button>';
    } else {
      h += '<button data-action="openFile" data-file="' + escA(p.filePath) + '" title="Open file">📁</button>';
    }
    h += '</div></div>';
    if (isExpanded) h += renderDetail(p);
  }
  return h;
}

function renderDetail(p) {
  var h = '<div class="detail">';
  h += '<input type="hidden" id="f-name" value="' + escA(p.name || '') + '" />';
  if (p.editable) {
    h += '<div class="form-group"><label>Source</label><div class="readonly-field">' + escH(p.sourceLabel) + '</div></div>';
    h += '<div class="form-group"><label>Name (immutable)</label><div class="readonly-field"><code>' + escH(p.name) + '</code></div></div>';
    h += renderTextField('f-desc', 'Description', p.description || '', 'Short description');
    h += renderTextField('f-arg', 'Argument hint', p.argumentHint || '', '<PR-URL> or [instructions]');
    h += renderTextareaField('f-content', 'Content (body markdown)', p.content || '', 'Template body');
    h += '<div class="btn-row">';
    h += '<button class="btn btn-primary" data-action="save" data-name="' + escA(p.name) + '" data-new="0" data-scope="' + escA(p.scope) + '">Save</button>';
    h += '<button class="btn btn-secondary" data-action="openFile" data-file="' + escA(p.filePath) + '">Open file</button>';
    h += '<button class="btn btn-sm btn-danger" data-action="delete" data-name="' + escA(p.name) + '" data-scope="' + escA(p.scope) + '">Delete</button>';
    h += '</div>';
  } else {
    h += '<div class="form-group"><label>Source</label><div class="readonly-field">' + escH(p.sourceLabel) + '</div></div>';
    h += '<div class="form-group"><label>Name</label><div class="readonly-field"><code>' + escH(p.name) + '</code></div></div>';
    h += '<div class="form-group"><label>Description</label><div class="readonly-field">' + escH(p.description) + '</div></div>';
    h += '<div class="form-group"><label>Argument hint</label><div class="readonly-field">' + escH(p.argumentHint || '') + '</div></div>';
    h += '<div class="form-group"><label>Content</label><pre class="readonly-pre">' + escH(p.content || '') + '</pre></div>';
    h += '<div class="btn-row">';
    h += '<button class="btn btn-secondary" data-action="openFile" data-file="' + escA(p.filePath) + '">Open file</button>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function renderNewForm() {
  var h = '<div class="detail"><h3>New Prompt</h3>';
  h += '<input type="hidden" id="f-name" value="" />';
  h += '<div class="form-group"><label>Scope</label><select id="f-scope"><option value="user">user (~/.pi/agent/prompts)</option>${projectOpt}</select></div>';
  h += '<div class="form-group"><label>Name</label><input id="f-name-inp" value="" placeholder="my-prompt" /></div>';
  h += renderTextField('f-desc', 'Description', '', 'Short description');
  h += renderTextField('f-arg', 'Argument hint', '', '<PR-URL> or [instructions]');
  h += renderTextareaField('f-content', 'Content (body markdown)', '', 'Template body');
  h += '<div class="btn-row">';
  h += '<button class="btn btn-primary" data-action="save" data-new="1" data-scope="user">Create</button>';
  h += '<button class="btn btn-secondary" data-action="cancel">Cancel</button>';
  h += '</div></div>';
  return h;
}

function getFormData(name) {
  var inp = document.getElementById('f-name-inp');
  var newName = inp ? inp.value.trim() : (name || '');
  var scopeSel = document.getElementById('f-scope');
  return {
    name: newName,
    description: document.getElementById('f-desc') ? document.getElementById('f-desc').value.trim() : '',
    argumentHint: document.getElementById('f-arg') ? document.getElementById('f-arg').value.trim() : '',
    content: document.getElementById('f-content') ? document.getElementById('f-content').value : '',
    scope: scopeSel ? scopeSel.value : null,
  };
}

// ====== Event delegation ======
document.addEventListener('click', function(ev) {
  var target = ev.target;
  if (!target || !target.closest) return;
  var btn = target.closest('[data-action]');
  if (!btn) return;
  var action = btn.dataset.action;
  var name = btn.dataset.name || '';
  var isNew = btn.dataset.new === '1';

  switch (action) {
    case 'refresh':
      refresh();
      break;
    case 'new':
      expanded = '__new__';
      deleteTarget = null;
      render();
      break;
    case 'cancel':
      expanded = null;
      render();
      break;
    case 'expand':
      expanded = (expanded === name) ? null : name;
      deleteTarget = null;
      render();
      break;
    case 'save': {
      var data = getFormData(name);
      if (!data.name) { showErr('Name is required'); return; }
      var scope = data.scope || btn.dataset.scope || 'user';
      if (isNew) {
        vsc.postMessage({ type: 'createPrompt', data: data, scope: scope });
      } else {
        vsc.postMessage({ type: 'updatePrompt', data: data, scope: scope });
      }
      expanded = null;
      break;
    }
    case 'delete':
      deleteTarget = name;
      render();
      break;
    case 'delete-confirm':
      vsc.postMessage({ type: 'deletePrompt', name: name, scope: btn.dataset.scope || 'user' });
      deleteTarget = null;
      expanded = null;
      break;
    case 'delete-cancel':
      deleteTarget = null;
      render();
      break;
    case 'openFile':
      vsc.postMessage({ type: 'openFile', filePath: btn.dataset.file || '' });
      break;
  }
});

// ====== Message handler ======
window.addEventListener('message', function(e) {
  var msg = e.data;
  if (msg.type === 'data') {
    VD = msg.data;
    var stillExists = expanded && VD.prompts && VD.prompts.some(function(p){ return p.name === expanded; });
    if (!stillExists && expanded !== '__new__') expanded = null;
    deleteTarget = null;
    render();
  } else if (msg.type === 'error') {
    showErr(msg.message);
  } else if (msg.type === 'loading') {
    document.getElementById('main').innerHTML = '<div class="empty">Loading…</div>';
  }
});
})();
</script>
</body></html>`;
}
