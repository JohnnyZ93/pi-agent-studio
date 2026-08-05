export function getSettingsHtml(): string {
  return /* html */ `<!DOCTYPE html>
<html style="height:100%;margin:0;padding:0">
<head><style>
* { box-sizing: border-box; }
body { height:100%; margin:0; padding:0; font-family: var(--vscode-font-family); font-size: 13px; color: var(--vscode-foreground); display:flex; flex-direction:column; overflow:hidden; }
.header { padding:8px; display:flex; align-items:center; justify-content:space-between; gap:6px; flex-shrink:0; border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent)); }
.header strong { font-size:12px; white-space:nowrap; }
.header-actions { display:flex; gap:4px; flex-shrink:0; }
.header button { padding:2px 4px; cursor:pointer; background:transparent; color:var(--vscode-foreground); border:1px solid var(--vscode-widget-border,transparent); border-radius:3px; font-size:12px; opacity:0.7; white-space:nowrap; }
.header button:hover { opacity:1; }
.scroll { flex:1; overflow-y:auto; }
.section { padding:10px 12px; border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent)); }
.section h3 { font-size:11px; text-transform:uppercase; letter-spacing:0.5px; opacity:0.7; margin:0 0 8px 0; font-weight:600; display:flex; align-items:center; gap:6px; }
.kv { display:grid; grid-template-columns:auto 1fr auto; gap:4px 10px; align-items:center; }
.kv .k { opacity:0.7; font-size:12px; white-space:nowrap; }
.kv .v { font-family:var(--vscode-editor-font-family,monospace); font-size:12px; word-break:break-all; min-width:0; }
.kv .v.placeholder { opacity:0.5; font-style:italic; }
.kv .v.with-action { display:flex; align-items:center; gap:6px; }
.kv .v.with-action .v-text { flex:1; min-width:0; word-break:break-all; }
.kv .inline-btn { padding:1px 6px; cursor:pointer; background:transparent; color:var(--vscode-foreground); border:1px solid var(--vscode-widget-border,transparent); border-radius:3px; font-size:11px; opacity:0.7; white-space:nowrap; flex-shrink:0; }
.kv .inline-btn:hover { opacity:1; background:var(--vscode-toolbar-hoverBackground); }
.kv .inline-btn.primary { background:var(--vscode-button-background); color:var(--vscode-button-foreground); border-color:transparent; opacity:1; }
.kv .inline-btn.primary:hover { background:var(--vscode-button-hoverBackground); }
.kv .copy-btn { padding:1px 6px; cursor:pointer; background:transparent; color:var(--vscode-foreground); border:1px solid var(--vscode-widget-border,transparent); border-radius:3px; font-size:11px; opacity:0.6; }
.kv .copy-btn:hover { opacity:1; background:var(--vscode-toolbar-hoverBackground); }
.row { display:flex; align-items:center; gap:8px; padding:4px 0; }
.row a { color:var(--vscode-textLink-foreground); text-decoration:none; word-break:break-all; }
.row a:hover { text-decoration:underline; }
.row .icon { width:18px; text-align:center; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; }
.row .icon svg { width:14px; height:14px; fill:currentColor; }
.btn { padding:4px 10px; cursor:pointer; background:var(--vscode-button-background); color:var(--vscode-button-foreground); border:none; border-radius:3px; font-size:12px; font-family:inherit; }
.btn:hover { background:var(--vscode-button-hoverBackground); }
.btn.secondary { background:transparent; color:var(--vscode-foreground); border:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent)); }
.btn.secondary:hover { background:var(--vscode-toolbar-hoverBackground); }
.btn-block { display:block; width:100%; text-align:left; }
.error { padding:6px 10px; background:var(--vscode-inputValidation-errorBackground,#5a1d1d); color:var(--vscode-inputValidation-errorForeground,#fff); border:1px solid var(--vscode-inputValidation-errorBorder,transparent); border-radius:3px; font-size:12px; margin:8px 12px; }
.toast { position:fixed; bottom:10px; left:50%; transform:translateX(-50%); background:var(--vscode-notifications-background,#252526); color:var(--vscode-notifications-foreground,#cccccc); border:1px solid var(--vscode-widget-border,transparent); padding:4px 10px; border-radius:3px; font-size:11px; opacity:0; transition:opacity 0.15s; pointer-events:none; z-index:10; }
.toast.show { opacity:1; }
</style></head>
<body>
<div class="header">
  <strong>Settings</strong>
  <div class="header-actions">
    <button data-action="openSettings" title="Open Full Settings">Full Settings</button>
    <button data-action="refresh" title="Refresh">Refresh</button>
  </div>
</div>
<div class="scroll" id="scroll">
  <div id="error-host"></div>

  <div class="section">
    <h3>Environment</h3>
    <div class="kv" id="env-kv">
      <div class="k">Pi version</div><div class="v with-action"><span class="v-text placeholder" id="env-pi-version">Loading…</span></div><div><button class="inline-btn primary" data-action="upgrade" title="Reinstall the pi CLI globally to the latest version">Upgrade</button></div>
      <div class="k">Pi path</div><div class="v" id="env-pi-path">…</div><div><button class="copy-btn" data-action="copy-pi-path" title="Copy">Copy</button></div>
      <div class="k">pi-agent-studio</div><div class="v" id="env-ext-version">…</div><div></div>
      <div class="k">Node</div><div class="v" id="env-node-version">…</div><div></div>
    </div>
  </div>

  <div class="section">
    <h3>Links</h3>
    <div class="row"><a id="link-home" href="https://pi.dev" target="_blank" rel="noopener">Pi Website</a></div>
    <div class="row"><a id="link-packages" href="https://pi.dev/packages" target="_blank" rel="noopener">Pi Packages</a></div>
    <div class="row"><a id="link-github" href="https://github.com/JohnnyZ93/pi-agent-studio" target="_blank" rel="noopener">pi-agent-studio on GitHub</a></div>
  </div>
</div>
<div class="toast" id="toast"></div>
<script>
const vsc = acquireVsCodeApi();
let piPath = "";

function escHtml(s) { var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }

function setText(id, text, placeholder) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  if (placeholder) el.classList.add('placeholder'); else el.classList.remove('placeholder');
}

function showError(msg) {
  var host = document.getElementById('error-host');
  host.innerHTML = '<div class="error">' + escHtml(msg) + '</div>';
  setTimeout(function() { host.innerHTML = ''; }, 6000);
}

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 1500);
}

function copyToClipboard(text) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      function() { showToast('Copied'); },
      function() { showToast('Copy failed'); }
    );
    return;
  }
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied');
  } catch (e) { showToast('Copy failed'); }
}

document.addEventListener('click', function(ev) {
  var target = ev.target;
  if (!target || !target.closest) return;
  var btn = target.closest('[data-action]');
  if (!btn) return;
  var action = btn.getAttribute('data-action');
  switch (action) {
    case 'refresh':
      vsc.postMessage({ type: 'refresh' });
      break;
    case 'upgrade':
      vsc.postMessage({ type: 'upgrade' });
      break;
    case 'openSettings':
      vsc.postMessage({ type: 'openSettings' });
      break;
    case 'copy-pi-path':
      copyToClipboard(piPath);
      break;
  }
});

function applyData(msg) {
  var env = msg.env || {};
  piPath = env.piPath || '';
  setText('env-pi-path', piPath || '(unknown)', !piPath);
  setText('env-ext-version', env.extensionVersion || '(unknown)', false);
  setText('env-node-version', env.nodeVersion || '(loading…)', env.nodeVersion === '(loading…)');
  if (env.piVersion !== undefined) {
    var loading = env.piVersion === '(loading…)';
    setText('env-pi-version', env.piVersion || '(unknown)', loading);
  }
  var links = msg.links || {};
  var home = document.getElementById('link-home');
  var pkgs = document.getElementById('link-packages');
  var gh = document.getElementById('link-github');
  if (links.home && home) { home.href = links.home; home.title = links.home; }
  if (links.packages && pkgs) { pkgs.href = links.packages; pkgs.title = links.packages; }
  if (links.github && gh) { gh.href = links.github; gh.title = links.github; }
}

window.addEventListener('message', function(e) {
  var msg = e.data || {};
  if (msg.type === 'data') {
    applyData(msg);
  } else if (msg.type === 'piVersion') {
    setText('env-pi-version', msg.piVersion || '(unknown)', false);
  } else if (msg.type === 'nodeVersion') {
    setText('env-node-version', msg.nodeVersion || '(unknown)', false);
  } else if (msg.type === 'error') {
    showError(msg.message || 'Unknown error');
  }
});

vsc.postMessage({ type: 'ready' });
</script>
</body></html>`;
}
