export function getAgentsHtml(hasWorkspace: boolean): string {
  const projectOpt = hasWorkspace
    ? '<option value="project">project (.pi/agents)</option>'
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
.agent-item{padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent));position:relative}
.agent-item:hover{background:var(--vscode-list-hoverBackground)}
.agent-item.selected{background:var(--vscode-list-activeSelectionBackground);color:var(--vscode-list-activeSelectionForeground)}
.agent-item-row{display:flex;align-items:center;gap:6px;padding-right:60px}
.agent-name{flex:0 1 auto;min-width:0;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.agent-source{font-size:10px;opacity:.6;flex-shrink:0;padding:1px 5px;border-radius:3px;background:var(--vscode-badge-background,rgba(127,127,127,0.15))}
.agent-source.user{background:rgba(0,120,212,0.25);opacity:.85}
.agent-source.builtin{background:var(--vscode-list-activeSelectionBackground,rgba(0,120,212,0.3));opacity:.85}
.agent-source.project{background:rgba(0,150,80,0.18);opacity:.85}
.agent-desc{font-size:11px;opacity:.6;margin-top:2px;padding-right:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.agent-actions{position:absolute;right:8px;top:8px;display:flex;gap:2px;opacity:0;transition:opacity .1s}
.agent-item:hover .agent-actions{opacity:1}
.agent-actions button{padding:2px 6px;cursor:pointer;background:transparent;border:1px solid var(--vscode-widget-border,transparent);border-radius:3px;font-size:11px;color:var(--vscode-foreground)}
.agent-actions button:hover{background:var(--vscode-toolbar-hoverBackground)}
.agent-actions button.danger:hover{background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:var(--pi-error-text);border-color:transparent}
.detail{padding:10px;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent));background:var(--vscode-editor-background)}
.detail h3{margin:0 0 8px;font-size:13px}
.form-group{margin-bottom:8px}
.form-group label{display:block;font-size:11px;opacity:.7;margin-bottom:2px}
.form-check{display:flex;align-items:center;gap:6px}
.form-check label{display:flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:4px 6px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:3px;font-size:12px;font-family:inherit;outline:none}
.form-group textarea{min-height:60px;resize:vertical}
.form-row{display:flex;gap:6px}
.form-row .form-group{flex:1}
.form-group .readonly-field{padding:4px 6px;font-size:12px;opacity:.6;border:1px solid transparent;border-radius:3px}
.form-group .readonly-field code{font-family:var(--vscode-editor-font-family)}
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
<div class="header"><strong>🤖 Agents</strong><div class="header-actions"><button data-action="new" title="New Agent">+</button><button data-action="refresh" title="Refresh">↻</button></div></div>
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
function sourceLabel(a) { return a.isBuiltin ? 'built-in' : a.source; }
function sourceClass(a) { return a.isBuiltin ? 'builtin' : a.source; }

// ====== shared field renderers (used by both create & edit forms) ======
function renderTextField(id, label, value, placeholder) {
  return '<div class="form-group"><label>' + escH(label) + '</label>' +
    '<input id="' + id + '" value="' + escA(value || '') + '" placeholder="' + escA(placeholder || '') + '" /></div>';
}
function renderTextareaField(id, label, value, placeholder) {
  return '<div class="form-group"><label>' + escH(label) + '</label>' +
    '<textarea id="' + id + '" placeholder="' + escA(placeholder || '') + '">' + escH(value || '') + '</textarea></div>';
}
function renderModelSelect(currentModel) {
  var models = (VD && VD.models) ? VD.models : [];
  var h = '<div class="form-group"><label>Model</label><select id="f-model">';
  h += '<option value="">(default)</option>';
  var found = false;
  for (var i = 0; i < models.length; i++) {
    var key = models[i];
    var sel = key === currentModel;
    if (sel) found = true;
    h += '<option value="' + escA(key) + '"' + (sel ? ' selected' : '') + '>' + escH(key) + '</option>';
  }
  if (currentModel && !found) {
    h += '<option value="' + escA(currentModel) + '" selected>' + escH(currentModel) + '</option>';
  }
  h += '</select></div>';
  return h;
}
function renderDisableCheckbox(checked) {
  return '<div class="form-group form-check"><label><input type="checkbox" id="f-disable" ' + (checked ? 'checked' : '') + ' /> Disable model invocation</label></div>';
}

// ====== render ======
function render() {
  if (!VD) return;
  var el = document.getElementById('main');
  var h = '';
  if (!VD.agents || !VD.agents.length) {
    h += '<div class="empty">No agents yet. Click + to create one.</div>';
  } else {
    h += renderAgentList(VD.agents);
  }
  if (expanded === '__new__') h += renderNewForm();
  el.innerHTML = h;
}

function renderAgentList(agents) {
  var h = '';
  for (var i = 0; i < agents.length; i++) {
    var a = agents[i];
    if (deleteTarget === a.name) {
      h += '<div class="delete-confirm">Delete "' + escH(a.name) + '" (' + escH(sourceLabel(a)) + ')? <span><button class="btn-confirm" data-action="delete-confirm" data-name="' + escA(a.name) + '" data-scope="' + escA(a.source) + '">Delete</button> <button class="btn-cancel" data-action="delete-cancel">Cancel</button></span></div>';
      continue;
    }
    var isExpanded = expanded === a.name;
    h += '<div class="agent-item' + (isExpanded ? ' selected' : '') + '">';
    h += '<div class="agent-item-row" data-action="expand" data-name="' + escA(a.name) + '">';
    h += '<span class="agent-name">' + escH(a.name) + '</span>';
    h += '<span class="agent-source ' + sourceClass(a) + '">' + escH(sourceLabel(a)) + (a.isBuiltin && a.hasOverride ? ' *' : '') + '</span></div>';
    h += '<div class="agent-desc">' + escH(a.description) + (a.model ? ' · ' + escH(a.model) : '') + '</div>';
    h += '<div class="agent-actions">';
    h += '<button data-action="expand" data-name="' + escA(a.name) + '" title="Edit">✏️</button>';
    if (a.isBuiltin && !a.hasOverride) {
      h += '<button disabled style="opacity:0.4;cursor:default" title="Built-in cannot be deleted">🗑️</button>';
    } else {
      h += '<button class="danger" data-action="delete" data-name="' + escA(a.name) + '" data-scope="' + escA(a.source) + '" title="Delete">🗑️</button>';
    }
    h += '</div></div>';
    if (isExpanded) h += renderDetail(a);
  }
  return h;
}

function renderDetail(a) {
  var isBuiltin = a.isBuiltin;
  var h = '<div class="detail">';
  h += '<input type="hidden" id="f-name" value="' + escA(a.name || '') + '" />';
  if (isBuiltin && !a.hasOverride) {
    h += '<div class="form-group"><label>Save override to</label><select id="f-scope"><option value="user">user (~/.pi/agent/agents)</option>${projectOpt}</select></div>';
  } else {
    h += '<div class="form-group"><label>Source</label><div class="readonly-field">' + escH(sourceLabel(a)) + (isBuiltin && a.hasOverride ? ' (override)' : '') + '</div></div>';
  }
  h += '<div class="form-group"><label>Name</label><div class="readonly-field"><code>' + escH(a.name) + '</code></div></div>';
  h += renderTextField('f-desc', 'Description', a.description || '', 'Short description');
  h += renderTextField('f-tools', 'Tools', (a.tools || []).join(', '), 'bash, read, write, edit');
  h += renderModelSelect(a.model || '');
  h += renderTextareaField('f-prompt', 'System Prompt (body)', a.systemPrompt || '', 'Agent system prompt');
  h += renderDisableCheckbox(a.disableModelInvocation);
  h += '<div class="btn-row">';
  h += '<button class="btn btn-primary" data-action="save" data-name="' + escA(a.name) + '" data-new="0" data-builtin="' + (isBuiltin ? '1' : '0') + '" data-scope="' + escA(a.source) + '">Save</button>';
  if (a.filePath) {
    h += '<button class="btn btn-secondary" data-action="openFile" data-file="' + escA(a.filePath) + '">Open file</button>';
  }
  if (isBuiltin && a.hasOverride) {
    h += '<button class="btn btn-secondary" data-action="reset" data-name="' + escA(a.name) + '" data-scope="' + escA(a.source) + '" title="Delete the override file and restore built-in">Reset to built-in</button>';
  }
  if (!isBuiltin && a.name) {
    h += '<button class="btn btn-sm btn-danger" data-action="delete" data-name="' + escA(a.name) + '" data-scope="' + escA(a.source) + '">Delete</button>';
  }
  h += '</div></div>';
  return h;
}

function renderNewForm() {
  var h = '<div class="detail"><h3>New Agent</h3>';
  h += '<input type="hidden" id="f-name" value="" />';
  h += '<div class="form-group"><label>Scope</label><select id="f-scope"><option value="user">user (~/.pi/agent/agents)</option>${projectOpt}</select></div>';
  h += '<div class="form-group"><label>Name</label><input id="f-name-inp" value="" placeholder="my-agent" /></div>';
  h += renderTextField('f-desc', 'Description', '', 'Short description');
  h += renderTextField('f-tools', 'Tools', '', 'bash, read, write, edit');
  h += renderModelSelect('');
  h += renderTextareaField('f-prompt', 'System Prompt (body)', '', 'Agent system prompt');
  h += renderDisableCheckbox(false);
  h += '<div class="btn-row">';
  h += '<button class="btn btn-primary" data-action="save" data-new="1" data-builtin="0" data-scope="user">Create</button>';
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
    tools: document.getElementById('f-tools') ? document.getElementById('f-tools').value.split(',').map(function(t){ return t.trim(); }).filter(Boolean) : [],
    model: document.getElementById('f-model') ? document.getElementById('f-model').value.trim() : '',
    systemPrompt: document.getElementById('f-prompt') ? document.getElementById('f-prompt').value : '',
    disableModelInvocation: document.getElementById('f-disable') ? document.getElementById('f-disable').checked : false,
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
        vsc.postMessage({ type: 'createAgent', data: data, scope: scope });
      } else {
        vsc.postMessage({ type: 'updateAgent', data: data, scope: scope });
      }
      expanded = null;
      break;
    }
    case 'delete':
      deleteTarget = name;
      render();
      break;
    case 'delete-confirm':
      vsc.postMessage({ type: 'deleteAgent', name: name, scope: btn.dataset.scope || 'user' });
      deleteTarget = null;
      expanded = null;
      break;
    case 'delete-cancel':
      deleteTarget = null;
      render();
      break;
    case 'reset':
      vsc.postMessage({ type: 'resetBuiltin', name: name, scope: btn.dataset.scope || 'user' });
      expanded = null;
      break;
    case 'openFile':
      vsc.postMessage({ type: 'openAgentFile', filePath: btn.dataset.file || '' });
      break;
  }
});

// ====== Message handler ======
window.addEventListener('message', function(e) {
  var msg = e.data;
  if (msg.type === 'data') {
    VD = msg.data;
    var stillExists = expanded && VD.agents && VD.agents.some(function(a){ return a.name === expanded; });
    if (!stillExists && expanded !== '__new__') expanded = null;
    deleteTarget = null;
    render();
  } else if (msg.type === 'error') {
    showErr(msg.message);
  }
});
})();
</script>
</body></html>`;
}
