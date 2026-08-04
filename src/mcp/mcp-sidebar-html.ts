export function getMcpHtml(hasWorkspace: boolean): string {
  const projectOpt = hasWorkspace
    ? '<option value="project">project (.pi/mcp.json)</option>'
    : '<option value="project" disabled>project (no workspace)</option>';
  return `<!DOCTYPE html>
<html style="height:100%;margin:0;padding:0">
<head><meta charset="utf-8"><style>
*{box-sizing:border-box}
body{height:100%;margin:0;padding:0;font-family:var(--vscode-font-family);font-size:13px;color:var(--vscode-foreground);display:flex;flex-direction:column;overflow:hidden}
.header{padding:8px;display:flex;align-items:center;justify-content:space-between;gap:6px;flex-shrink:0;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent))}
.header strong{font-size:12px;white-space:nowrap}
.header-actions{display:flex;gap:4px;align-items:center;flex-shrink:0}
.header select{padding:2px 4px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:3px;font-size:11px;font-family:inherit}
.header button{padding:2px 6px;cursor:pointer;background:transparent;color:var(--vscode-foreground);border:1px solid var(--vscode-widget-border,transparent);border-radius:3px;font-size:13px;opacity:.7;line-height:1}
.header button:hover{opacity:1}
.main{flex:1;overflow-y:auto}
.srv{padding:8px 10px;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent));position:relative}
.srv:hover{background:var(--vscode-list-hoverBackground)}
.srv-row{display:flex;align-items:center;gap:6px;padding-right:90px}
.srv-name{flex:0 1 auto;min-width:0;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.badge{font-size:10px;opacity:.7;flex-shrink:0;padding:1px 5px;border-radius:3px;background:var(--vscode-badge-background,rgba(127,127,127,0.15))}
.badge.stdio{background:rgba(0,120,212,0.18)}
.badge.http{background:rgba(150,80,0,0.18)}
.badge.disabled{background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:var(--pi-error-text);opacity:.9}
.srv-transport{font-size:11px;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.srv-actions{position:absolute;right:8px;top:8px;display:flex;gap:2px;opacity:0;transition:opacity .1s}
.srv:hover .srv-actions{opacity:1}
.srv-actions button{padding:2px 6px;cursor:pointer;background:transparent;border:1px solid var(--vscode-widget-border,transparent);border-radius:3px;font-size:11px;color:var(--vscode-foreground)}
.srv-actions button:hover{background:var(--vscode-toolbar-hoverBackground)}
.srv-actions button.danger:hover{background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:var(--pi-error-text);border-color:transparent}
.empty{padding:20px;text-align:center;opacity:.5;font-size:12px}
.detail{padding:10px;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent));background:var(--vscode-editor-background)}
.detail h3{margin:0 0 8px;font-size:13px}
.form-group{margin-bottom:8px}
.form-group label{display:block;font-size:11px;opacity:.7;margin-bottom:2px}
.form-check{display:flex;align-items:center;gap:6px}
.form-check label{display:flex;align-items:center;gap:4px;cursor:pointer}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:4px 6px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:3px;font-size:12px;font-family:inherit;outline:none}
.form-group textarea{min-height:54px;resize:vertical;font-family:var(--vscode-editor-font-family,monospace)}
.hint{font-size:10px;opacity:.5;margin-top:2px}
.btn{padding:4px 12px;cursor:pointer;border:none;border-radius:3px;font-size:12px}
.btn-primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.btn-primary:hover{background:var(--vscode-button-hoverBackground)}
.btn-secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
.btn-secondary:hover{background:var(--vscode-button-secondaryHoverBackground)}
.btn-row{display:flex;gap:4px;margin-top:8px}
.error-toast{padding:8px 10px;margin:8px;background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:var(--pi-error-text);border-radius:4px;font-size:12px;display:none}
.error-toast.show{display:block}
</style></head>
<body>
<div class="header">
  <strong>🔌 MCP Servers</strong>
  <div class="header-actions">
    <select id="scope-sel"><option value="user">user</option>${projectOpt}</select>
    <button data-action="new" title="Add server">+</button>
    <button data-action="refresh" title="Refresh">↻</button>
    <button data-action="openFile" title="Open config file">{ }</button>
  </div>
</div>
<div id="error-toast" class="error-toast"></div>
<div class="main" id="main"></div>
<script>
(function(){
var vsc = acquireVsCodeApi();
var D = null;
var scope = "user";
var editing = null; // null | {isNew, name}

function escA(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function escH(s){var d=document.createElement('div');d.textContent=String(s==null?'':s);return d.innerHTML}
function showErr(m){var e=document.getElementById('error-toast');e.textContent=m;e.classList.add('show');setTimeout(function(){e.classList.remove('show')},5000)}
function refresh(){vsc.postMessage({type:'refresh'})}

function servers(){
  return scope==='project' ? (D&&D.projectServers||[]) : (D&&D.userServers||[]);
}

function transportOf(e){return e&&e.url?'http':'stdio'}

function renderList(){
  var main = document.getElementById('main');
  if(editing){ renderForm(main); return; }
  var list = servers();
  if(list.length===0){
    main.innerHTML = '<div class="empty">No MCP servers in '+scope+' config.<br>Click + to add one.</div>';
    return;
  }
  var h = '';
  for(var i=0;i<list.length;i++){
    var s = list[i];
    var t = transportOf(s.entry);
    var dis = s.entry.disabled ? '<span class="badge disabled">disabled</span>' : '';
    var detail = t==='http' ? (s.entry.url||'') : (s.entry.command||'') + (s.entry.args&&s.entry.args.length?(' '+s.entry.args.join(' ')):'');
    h += '<div class="srv" data-name="'+escA(s.name)+'">'
      + '<div class="srv-row"><span class="srv-name">'+escH(s.name)+'</span>'
      + '<span class="badge '+t+'">'+t+'</span>'+dis+'</div>'
      + '<div class="srv-transport">'+escH(detail)+'</div>'
      + '<div class="srv-actions">'
      + '<button data-action="toggle" data-name="'+escA(s.name)+'" title="Enable/disable">'+(s.entry.disabled?'☐':'☑')+'</button>'
      + '<button data-action="edit" data-name="'+escA(s.name)+'">edit</button>'
      + '<button data-action="delete" data-name="'+escA(s.name)+'" class="danger">del</button>'
      + '</div></div>';
  }
  main.innerHTML = h;
}

function entryToForm(e){
  e = e||{};
  return {
    command: e.command||'',
    args: (e.args||[]).join('\\n'),
    env: e.env ? Object.entries(e.env).map(function(kv){return kv[0]+'='+kv[1]}).join('\\n') : '',
    cwd: e.cwd||'',
    url: e.url||'',
    headers: e.headers ? Object.entries(e.headers).map(function(kv){return kv[0]+': '+kv[1]}).join('\\n') : '',
    bearerToken: e.bearerToken||'',
    disabled: !!e.disabled
  };
}

function renderForm(main){
  var s = editing.isNew ? null : (servers().filter(function(x){return x.name===editing.name})[0]||null);
  var f = entryToForm(s?s.entry:null);
  var t = transportOf(f);
  var h = '<div class="detail"><h3>'+(editing.isNew?'Add MCP server':'Edit: '+escH(editing.name))+'</h3>'
    + (editing.isNew ? '<div class="form-group"><label>Name</label><input id="f-name" value="" placeholder="e.g. filesystem"/></div>' : '')
    + '<div class="form-group"><label>Transport</label><select id="f-transport"><option value="stdio"'+(t==='stdio'?' selected':'')+'>stdio (local command)</option><option value="http"'+(t==='http'?' selected':'')+'>http (remote URL)</option></select></div>'
    + '<div id="stdio-fields">'
    + '<div class="form-group"><label>Command</label><input id="f-command" value="'+escA(f.command)+'" placeholder="e.g. npx"/></div>'
    + '<div class="form-group"><label>Args <span class="hint">(one per line)</span></label><textarea id="f-args" placeholder="-y\\n@modelcontextprotocol/server-filesystem">'+escH(f.args)+'</textarea></div>'
    + '<div class="form-group"><label>Env <span class="hint">(KEY=VALUE per line)</span></label><textarea id="f-env">'+escH(f.env)+'</textarea></div>'
    + '<div class="form-group"><label>CWD</label><input id="f-cwd" value="'+escA(f.cwd)+'"/></div>'
    + '</div>'
    + '<div id="http-fields">'
    + '<div class="form-group"><label>URL</label><input id="f-url" value="'+escA(f.url)+'" placeholder="https://example.com/mcp"/></div>'
    + '<div class="form-group"><label>Headers <span class="hint">(KEY: VALUE per line)</span></label><textarea id="f-headers">'+escH(f.headers)+'</textarea></div>'
    + '<div class="form-group"><label>Bearer token</label><input id="f-bearer" value="'+escA(f.bearerToken)+'"/></div>'
    + '</div>'
    + '<div class="form-check"><label><input type="checkbox" id="f-disabled" '+(f.disabled?'checked':'')+'/> Disabled (skip this server)</label></div>'
    + '<div class="btn-row"><button class="btn btn-primary" data-action="save">Save</button><button class="btn btn-secondary" data-action="cancel">Cancel</button></div>'
    + '</div>';
  main.innerHTML = h;
  toggleTransport();
  document.getElementById('f-transport').onchange = toggleTransport;
}

function toggleTransport(){
  var t = document.getElementById('f-transport').value;
  document.getElementById('stdio-fields').style.display = t==='stdio'?'':'none';
  document.getElementById('http-fields').style.display = t==='http'?'':'none';
}

function collectForm(){
  var t = document.getElementById('f-transport').value;
  return {
    command: document.getElementById('f-command').value,
    args: document.getElementById('f-args').value,
    env: document.getElementById('f-env').value,
    cwd: document.getElementById('f-cwd').value,
    url: document.getElementById('f-url').value,
    headers: document.getElementById('f-headers').value,
    bearerToken: document.getElementById('f-bearer').value,
    disabled: document.getElementById('f-disabled').checked,
    _transport: t
  };
}

window.addEventListener('message', function(e){
  var msg = e.data;
  if(msg.type==='data'){ D = msg.data; renderList(); }
  else if(msg.type==='error'){ showErr(msg.message); }
});

document.getElementById('scope-sel').addEventListener('change', function(){
  scope = this.value;
  editing = null;
  renderList();
});

document.getElementById('main').addEventListener('click', function(e){
  var btn = e.target.closest('button[data-action]');
  if(!btn) return;
  var action = btn.getAttribute('data-action');
  var name = btn.getAttribute('data-name');
  if(action==='edit'){ editing = {isNew:false, name:name}; renderList(); }
  else if(action==='delete'){ if(confirm('Delete server "'+name+'"?')){ vsc.postMessage({type:'deleteServer',scope:scope,name:name}); } }
  else if(action==='toggle'){ vsc.postMessage({type:'toggleDisabled',scope:scope,name:name}); }
  else if(action==='save'){
    var f = collectForm();
    if(editing.isNew){
      var nm = document.getElementById('f-name').value.trim();
      if(!nm){ showErr('Name is required'); return; }
      vsc.postMessage({type:'addServer',scope:scope,name:nm,entry:f});
    } else {
      vsc.postMessage({type:'updateServer',scope:scope,name:editing.name,entry:f});
    }
    editing = null;
  }
  else if(action==='cancel'){ editing = null; renderList(); }
});

document.querySelector('.header-actions').addEventListener('click', function(e){
  var btn = e.target.closest('button[data-action]');
  if(!btn) return;
  var action = btn.getAttribute('data-action');
  if(action==='new'){ editing = {isNew:true, name:null}; renderList(); }
  else if(action==='refresh'){ refresh(); }
  else if(action==='openFile'){ vsc.postMessage({type:'openFile',scope:scope}); }
});

vsc.postMessage({type:'ready'});
})();
</script>
</body></html>`;
}
