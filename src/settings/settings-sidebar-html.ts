import { getWebviewI18n, t } from "../i18n.ts";

export function getSettingsHtml(): string {
  const i18n = getWebviewI18n();
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
.inline-btn { padding:1px 6px; cursor:pointer; background:transparent; color:var(--vscode-foreground); border:1px solid var(--vscode-widget-border,transparent); border-radius:3px; font-size:11px; opacity:0.7; white-space:nowrap; flex-shrink:0; }
.inline-btn:hover { opacity:1; background:var(--vscode-toolbar-hoverBackground); }
.inline-btn.primary { background:var(--vscode-button-background); color:var(--vscode-button-foreground); border-color:transparent; opacity:1; }
.inline-btn.primary:hover { background:var(--vscode-button-hoverBackground); }
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
.onboarding { margin:8px 12px; border:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent)); border-radius:4px; padding:10px 12px; background:var(--vscode-editorWidget-background,transparent); }
.onboarding h3 { font-size:11px; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 8px 0; font-weight:600; }
.check-item { display:flex; align-items:center; gap:6px; padding:2px 0; font-size:12px; }
.check-item .mark { width:14px; height:14px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:10px; flex-shrink:0; }
.mark.ok { background:var(--vscode-testing-iconPassed,#388a34); color:#fff; }
.mark.fail { background:var(--vscode-testing-iconFailed,#e51400); color:#fff; }
.steps { margin:8px 0; padding-left:18px; font-size:12px; }
.steps li { margin:2px 0; }
.steps a { color:var(--vscode-textLink-foreground); text-decoration:none; }
.steps a:hover { text-decoration:underline; }
.hint { font-size:11px; opacity:0.8; margin-top:6px; }
.hint a { color:var(--vscode-textLink-foreground); text-decoration:none; }
.hint a:hover { text-decoration:underline; }
.next-steps { display:flex; flex-direction:column; gap:6px; }
.next-row { display:flex; align-items:center; gap:8px; font-size:12px; }
.next-row .step-num { width:16px; height:16px; border-radius:50%; background:var(--vscode-button-background); color:var(--vscode-button-foreground); display:inline-flex; align-items:center; justify-content:center; font-size:10px; flex-shrink:0; }
.next-row .step-text { flex:1; min-width:0; }
.onboarding .btn { margin-top:8px; }
.toast { position:fixed; bottom:10px; left:50%; transform:translateX(-50%); background:var(--vscode-notifications-background,#252526); color:var(--vscode-notifications-foreground,#cccccc); border:1px solid var(--vscode-widget-border,transparent); padding:4px 10px; border-radius:3px; font-size:11px; opacity:0; transition:opacity 0.15s; pointer-events:none; z-index:10; }
.toast.show { opacity:1; }
</style></head>
<body>
<div class="header">
  <strong>⚙️ ${t("Settings")}</strong>
  <div class="header-actions">
    <button data-action="refresh" title="${t("Refresh")}">↻</button>
    <button data-action="openSettings" title="${t("Open Full Settings")}">{ }</button>
  </div>
</div>
<div class="scroll" id="scroll">
  <div id="error-host"></div>
  <div id="onboarding-host"></div>

  <div class="section">
    <h3>${t("Environment")}</h3>
    <div class="kv" id="env-kv">
      <div class="k">${t("Pi version")}</div><div class="v with-action"><span class="v-text placeholder" id="env-pi-version">${t("Loading…")}</span></div><div><button class="inline-btn primary" data-action="upgrade" title="${t("Reinstall the pi CLI globally to the latest version")}">${t("Upgrade")}</button></div>
      <div class="k">${t("Pi path")}</div><div class="v" id="env-pi-path">…</div><div><button class="copy-btn" data-action="copy-pi-path" title="${t("Copy")}">${t("Copy")}</button></div>
      <div class="k">pi-agent-studio</div><div class="v" id="env-ext-version">…</div><div></div>
      <div class="k">Node</div><div class="v" id="env-node-version">…</div><div></div>
    </div>
  </div>

  <div class="section">
    <h3>${t("Links")}</h3>
    <div class="row"><span class="icon">🌐</span><a id="link-home" href="https://pi.dev" target="_blank" rel="noopener" title="https://pi.dev">${t("Pi Website")}</a></div>
    <div class="row"><span class="icon">📦</span><a id="link-packages" href="https://pi.dev/packages" target="_blank" rel="noopener" title="https://pi.dev/packages">${t("Pi Packages")}</a></div>
    <div class="row"><span class="icon"><svg viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg></span><a id="link-github" href="https://github.com/JohnnyZ93/pi-agent-studio" target="_blank" rel="noopener" title="https://github.com/JohnnyZ93/pi-agent-studio">${t("pi-agent-studio on GitHub")}</a></div>
  </div>
</div>
<div class="toast" id="toast"></div>
<script>
window.__I18N__ = ${JSON.stringify(i18n)};
function t(key, args) {
  var b = window.__I18N__.bundle || {};
  var s = b[key] || key;
  if (args) {
    for (var i = 0; i < args.length; i++) {
      s = s.split('{' + i + '}').join(String(args[i]));
    }
  }
  return s;
}
const vsc = acquireVsCodeApi();
let piPath = "";
let piVersion = null;
let envCheck = null;
let platform = "";

function escHtml(s) { var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }

function setText(id, text, placeholder) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  if (placeholder) el.classList.add('placeholder'); else el.classList.remove('placeholder');
}

function renderOnboarding() {
  var host = document.getElementById('onboarding-host');
  if (!host || piVersion === null) return;
  var piOk = piVersion !== '(unknown)';
  if (!envCheck) {
    host.innerHTML = piOk ? '' : '<div class="onboarding"><h3>' + t('Environment check') + '</h3><div class="hint">' + t('Checking environment…') + '</div></div>';
    return;
  }
  var nodeOk = !!envCheck.nodeSupported;
  var npmOk = !!envCheck.npmVersion;
  if (!piOk) {
    var nodeLine = nodeOk
      ? '<span class="mark ok">✓</span>Node.js ' + escHtml(envCheck.nodeVersion || '')
      : '<span class="mark fail">✗</span>Node.js — ' + t('needs 22.19.0 or newer');
    var npmLine = npmOk
      ? '<span class="mark ok">✓</span>npm ' + escHtml(envCheck.npmVersion || '')
      : '<span class="mark fail">✗</span>npm — ' + t('not detected');
    var piLine = '<span class="mark fail">✗</span>Pi — ' + t('not detected');
    var steps = '<ol class="steps">';
    if (!nodeOk) {
      steps += '<li>' + t('Install Node.js') + ': <a href="https://nodejs.org" target="_blank" rel="noopener">nodejs.org</a> — ' + t('Download LTS (22.19.0 or newer); npm is included.') + '</li>';
    }
    steps += '<li>' + t('Install Pi') + ': <a href="https://pi.dev" target="_blank" rel="noopener">pi.dev</a> — ' + t('follow the official install guide.') + '</li>';
    steps += '<li>' + t('Verify') + ': ' + t('Restart VS Code, then reopen this panel.') + '</li></ol>';
    var git = platform === 'win32'
      ? '<div class="hint">' + t('Windows tip') + ': <a href="https://git-scm.com" target="_blank" rel="noopener">' + t('Git Bash') + '</a> — ' + t('needed for bash-based features.') + '</div>'
      : '';
    host.innerHTML =
      '<div class="onboarding">' +
      '<h3>' + t('Environment check') + '</h3>' +
      '<div class="check-item">' + nodeLine + '</div>' +
      '<div class="check-item">' + npmLine + '</div>' +
      '<div class="check-item">' + piLine + '</div>' +
      steps + git +
      '</div>';
    return;
  }
  if (nodeOk && npmOk) {
    host.innerHTML =
      '<div class="onboarding">' +
      '<h3>' + t('Environment ready') + '</h3>' +
      '<div class="next-steps">' +
      '<div class="next-row"><span class="step-num">1</span><span class="step-text">' + t('Configure a model provider and API key') + '</span><button class="inline-btn primary" data-action="open-settings-tab" data-tab="models">' + t('Open Models settings') + '</button></div>' +
      '<div class="next-row"><span class="step-num">2</span><span class="step-text">' + t('Choose the UI mode (terminal or webview)') + '</span><button class="inline-btn primary" data-action="open-vscode-settings" data-query="pi-agent-studio.ui">' + t('Open VS Code settings') + '</button></div>' +
      '<div class="next-row"><span class="step-num">3</span><span class="step-text">' + t('Set pi-agent-studio.path if pi is not on your PATH') + '</span><button class="inline-btn primary" data-action="open-vscode-settings" data-query="pi-agent-studio.path">' + t('Open VS Code settings') + '</button></div>' +
      '</div></div>';
  } else {
    host.innerHTML = '';
  }
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
      function() { showToast(t('Copied')); },
      function() { showToast(t('Copy failed')); }
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
    showToast(t('Copied'));
  } catch (e) { showToast(t('Copy failed')); }
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
    case 'open-settings-tab':
      vsc.postMessage({ type: 'openSettings', tab: btn.getAttribute('data-tab') });
      break;
    case 'open-vscode-settings':
      vsc.postMessage({ type: 'openVscodeSettings', query: btn.getAttribute('data-query') });
      break;
  }
});

function applyData(msg) {
  var env = msg.env || {};
  piPath = env.piPath || '';
  piVersion = null;
  envCheck = null;
  platform = msg.platform || '';
  setText('env-pi-path', piPath || t('(unknown)'), !piPath);
  setText('env-ext-version', env.extensionVersion || t('(unknown)'), false);
  setText('env-node-version', env.nodeVersion || t('(loading…)'), env.nodeVersion === t('(loading…)'));
  var host = document.getElementById('onboarding-host');
  if (host) host.innerHTML = '';
  if (env.piVersion !== undefined) {
    var loading = env.piVersion === t('(loading…)');
    setText('env-pi-version', env.piVersion || t('(unknown)'), loading);
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
    piVersion = msg.piVersion || '(unknown)';
    setText('env-pi-version', piVersion, false);
    renderOnboarding();
  } else if (msg.type === 'envCheck') {
    envCheck = msg;
    renderOnboarding();
  } else if (msg.type === 'nodeVersion') {
    setText('env-node-version', msg.nodeVersion || t('(unknown)'), false);
  } else if (msg.type === 'error') {
    showError(msg.message || t('Unknown error'));
  }
});

vsc.postMessage({ type: 'ready' });
</script>
</body></html>`;
}
