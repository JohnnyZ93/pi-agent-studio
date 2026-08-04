export function getSkillsHtml(hasWorkspace: boolean): string {
  const projectOpt = hasWorkspace
    ? '<option value="project">project (.pi/skills)</option>'
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
.skill-item{padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent));position:relative}
.skill-item:hover{background:var(--vscode-list-hoverBackground)}
.skill-item.selected{background:var(--vscode-list-activeSelectionBackground);color:var(--vscode-list-activeSelectionForeground)}
.skill-item-row{display:flex;align-items:center;gap:6px;padding-right:60px}
.skill-name{flex:0 1 auto;min-width:0;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.skill-source{font-size:10px;opacity:.6;flex-shrink:0;padding:1px 5px;border-radius:3px;background:var(--vscode-badge-background,rgba(127,127,127,0.15))}
.skill-source.user{background:rgba(0,120,212,0.25);opacity:.85}
.skill-source.project{background:rgba(0,150,80,0.18);opacity:.85}
.skill-source.other{background:rgba(127,127,127,0.2);opacity:.7}
.skill-flag{font-size:10px;opacity:.85;flex-shrink:0;padding:1px 5px;border-radius:3px;background:rgba(220,130,0,0.2);color:var(--vscode-foreground)}
.skill-desc{font-size:11px;opacity:.6;margin-top:2px;padding-right:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.skill-actions{position:absolute;right:8px;top:8px;display:flex;gap:2px;opacity:0;transition:opacity .1s}
.skill-item:hover .skill-actions{opacity:1}
.skill-actions button{padding:2px 6px;cursor:pointer;background:transparent;border:1px solid var(--vscode-widget-border,transparent);border-radius:3px;font-size:11px;color:var(--vscode-foreground)}
.skill-actions button:hover{background:var(--vscode-toolbar-hoverBackground)}
.skill-actions button.danger:hover{background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:var(--pi-error-text);border-color:transparent}
.detail{padding:10px;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent));background:var(--vscode-editor-background)}
.detail h3{margin:0 0 8px;font-size:13px}
.form-group{margin-bottom:8px}
.form-group label{display:block;font-size:11px;opacity:.7;margin-bottom:2px}
.form-group input[type=text],.form-group select,.form-group textarea{width:100%;padding:4px 6px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:3px;font-size:12px;font-family:inherit;outline:none}
.form-group textarea{min-height:120px;resize:vertical}
.form-group .checkbox-row{display:flex;align-items:center;gap:6px}
.form-group .checkbox-row input[type=checkbox]{margin:0}
.form-group .readonly-field{padding:4px 6px;font-size:12px;opacity:.6;border:1px solid transparent;border-radius:3px}
.form-group .readonly-field code{font-family:var(--vscode-editor-font-family)}
.form-group .readonly-pre{margin:0;padding:4px 6px;font-size:12px;opacity:.8;background:var(--vscode-input-background);border:1px solid transparent;border-radius:3px;white-space:pre-wrap;word-break:break-word;max-height:240px;overflow:auto;font-family:var(--vscode-editor-font-family)}
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
<div class="header"><strong>🧩 Skills</strong><div class="header-actions"><button data-action="new" title="New Skill">+</button><button data-action="refresh" title="Refresh">↻</button></div></div>
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
function sourceClass(s) {
  var c = s.sourceLabel;
  return (c === 'user' || c === 'project') ? c : 'other';
}

// ====== shared field renderers ======
function renderTextField(id, label, value, placeholder) {
  return '<div class="form-group"><label>' + escH(label) + '</label>' +
    '<input type="text" id="' + id + '" value="' + escA(value || '') + '" placeholder="' + escA(placeholder || '') + '" /></div>';
}
function renderTextareaField(id, label, value, placeholder) {
  return '<div class="form-group"><label>' + escH(label) + '</label>' +
    '<textarea id="' + id + '" placeholder="' + escA(placeholder || '') + '">' + escH(value || '') + '</textarea></div>';
}
function renderCheckboxField(id, label, checked) {
  return '<div class="form-group"><div class="checkbox-row"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + ' /><label for="' + id + '" style="margin:0">' + escH(label) + '</label></div></div>';
}

// ====== render ======
function render() {
  if (!VD) return;
  var el = document.getElementById('main');
  var h = '';
  if (!VD.skills || !VD.skills.length) {
    h += '<div class="empty">No skills yet. Click + to create one.</div>';
  } else {
    h += renderSkillList(VD.skills);
  }
  if (expanded === '__new__') h += renderNewForm();
  el.innerHTML = h;
}

function renderSkillList(skills) {
  var h = '';
  for (var i = 0; i < skills.length; i++) {
    var s = skills[i];
    if (deleteTarget === s.name) {
      h += '<div class="delete-confirm">Delete "' + escH(s.name) + '" (' + escH(s.sourceLabel) + ')? This removes the whole skill directory. <span><button class="btn-confirm" data-action="delete-confirm" data-name="' + escA(s.name) + '" data-scope="' + escA(s.scope) + '" data-dir="' + escA(s.baseDir) + '">Delete</button> <button class="btn-cancel" data-action="delete-cancel">Cancel</button></span></div>';
      continue;
    }
    var isExpanded = expanded === s.name;
    h += '<div class="skill-item' + (isExpanded ? ' selected' : '') + '">';
    h += '<div class="skill-item-row" data-action="expand" data-name="' + escA(s.name) + '">';
    h += '<span class="skill-name">' + escH(s.name) + '</span>';
    h += '<span class="skill-source ' + sourceClass(s) + '" title="' + escA(s.filePath) + '">' + escH(s.sourceLabel) + '</span>';
    if (s.disableModelInvocation) h += '<span class="skill-flag" title="disable-model-invocation: hidden from system prompt">hidden</span>';
    h += '</div>';
    h += '<div class="skill-desc">' + escH(s.description) + '</div>';
    h += '<div class="skill-actions">';
    if (s.editable) {
      h += '<button data-action="expand" data-name="' + escA(s.name) + '" title="Edit">✏️</button>';
      h += '<button class="danger" data-action="delete" data-name="' + escA(s.name) + '" data-scope="' + escA(s.scope) + '" data-dir="' + escA(s.baseDir) + '" title="Delete">🗑️</button>';
    } else {
      h += '<button data-action="openFile" data-file="' + escA(s.filePath) + '" title="Open file">📁</button>';
    }
    h += '</div></div>';
    if (isExpanded) h += renderDetail(s);
  }
  return h;
}

function renderDetail(s) {
  var h = '<div class="detail">';
  h += '<input type="hidden" id="f-name" value="' + escA(s.name || '') + '" />';
  if (s.editable) {
    h += '<div class="form-group"><label>Source</label><div class="readonly-field">' + escH(s.sourceLabel) + '</div></div>';
    h += '<div class="form-group"><label>Name (immutable)</label><div class="readonly-field"><code>' + escH(s.name) + '</code></div></div>';
    h += renderTextField('f-desc', 'Description', s.description || '', 'What this skill does and when to use it');
    h += renderCheckboxField('f-disable', 'disable-model-invocation (hidden from system prompt, only via /skill:name)', s.disableModelInvocation);
    h += renderTextareaField('f-body', 'Instructions (body markdown)', s.body || '', 'Skill instructions');
    h += '<div class="btn-row">';
    h += '<button class="btn btn-primary" data-action="save" data-name="' + escA(s.name) + '" data-new="0" data-scope="' + escA(s.scope) + '" data-file="' + escA(s.filePath) + '">Save</button>';
    h += '<button class="btn btn-secondary" data-action="openFile" data-file="' + escA(s.filePath) + '">Open file</button>';
    h += '<button class="btn btn-sm btn-danger" data-action="delete" data-name="' + escA(s.name) + '" data-scope="' + escA(s.scope) + '" data-dir="' + escA(s.baseDir) + '">Delete</button>';
    h += '</div>';
  } else {
    h += '<div class="form-group"><label>Source</label><div class="readonly-field">' + escH(s.sourceLabel) + '</div></div>';
    h += '<div class="form-group"><label>Name</label><div class="readonly-field"><code>' + escH(s.name) + '</code></div></div>';
    h += '<div class="form-group"><label>Description</label><div class="readonly-field">' + escH(s.description) + '</div></div>';
    h += '<div class="form-group"><label>disable-model-invocation</label><div class="readonly-field">' + escH(String(s.disableModelInvocation)) + '</div></div>';
    h += '<div class="form-group"><label>Instructions</label><pre class="readonly-pre">' + escH(s.body || '') + '</pre></div>';
    h += '<div class="btn-row">';
    h += '<button class="btn btn-secondary" data-action="openFile" data-file="' + escA(s.filePath) + '">Open file</button>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function renderNewForm() {
  var h = '<div class="detail"><h3>New Skill</h3>';
  h += '<input type="hidden" id="f-name" value="" />';
  h += '<div class="form-group"><label>Scope</label><select id="f-scope"><option value="user">user (~/.pi/agent/skills)</option>${projectOpt}</select></div>';
  h += '<div class="form-group"><label>Name</label><input type="text" id="f-name-inp" value="" placeholder="my-skill" /></div>';
  h += renderTextField('f-desc', 'Description', '', 'What this skill does and when to use it');
  h += renderCheckboxField('f-disable', 'disable-model-invocation (hidden from system prompt, only via /skill:name)', false);
  h += renderTextareaField('f-body', 'Instructions (body markdown)', '', 'Skill instructions');
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
  var disableEl = document.getElementById('f-disable');
  return {
    name: newName,
    description: document.getElementById('f-desc') ? document.getElementById('f-desc').value.trim() : '',
    disableModelInvocation: disableEl ? !!disableEl.checked : false,
    body: document.getElementById('f-body') ? document.getElementById('f-body').value : '',
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
      if (!data.description) { showErr('Description is required'); return; }
      var scope = data.scope || btn.dataset.scope || 'user';
      if (isNew) {
        vsc.postMessage({ type: 'createSkill', data: data, scope: scope });
      } else {
        vsc.postMessage({ type: 'updateSkill', data: data, filePath: btn.dataset.file || '' });
      }
      expanded = null;
      break;
    }
    case 'delete':
      deleteTarget = name;
      render();
      break;
    case 'delete-confirm':
      vsc.postMessage({ type: 'deleteSkill', baseDir: btn.dataset.dir || '' });
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
    var stillExists = expanded && VD.skills && VD.skills.some(function(s){ return s.name === expanded; });
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
