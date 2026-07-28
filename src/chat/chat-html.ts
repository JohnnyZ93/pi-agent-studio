import mditSrc from "./vendor/markdown-it.min.js?raw";

export function getChatHtml(home?: string, sep?: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en" style="height:100%;margin:0;padding:0">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; padding: 0; }
body {
  font-family: var(--vscode-font-family);
  font-size: 13px;
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}
.app { display: flex; flex-direction: column; height: 100%; width: 100%; max-width: 920px; }

.toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border, transparent));
  background: var(--vscode-sideBar-background, var(--vscode-editor-background));
}
.composer-box {
  border: 1px solid var(--vscode-input-border, var(--vscode-widget-border, transparent));
  border-radius: 8px;
  background: var(--vscode-input-background);
  display: flex;
  flex-direction: column;
  transition: border-color 0.12s;
}
.composer-box:focus-within { border-color: var(--vscode-focusBorder); }
.composer-controls-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px 4px;
}
.composer-spacer { flex: 1 1 auto; min-width: 4px; }
.ctx-ring {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.ctx-ring svg { width: 14px; height: 14px; transform: rotate(-90deg); display: block; }
.ctx-ring-track { fill: none; stroke: currentColor; stroke-width: 2; opacity: 0.3; }
.ctx-ring-prog {
  fill: none;
  stroke: var(--vscode-button-background);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  transition: stroke-dashoffset 0.3s ease;
}
.ctx-tooltip {
  position: fixed;
  z-index: 50;
  padding: 3px 8px;
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
  color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
  border: 1px solid var(--vscode-widget-border, transparent);
  border-radius: 4px;
  font-size: 11px;
  font-family: var(--vscode-font-family);
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
}
.select-wrap { position: relative; display: inline-flex; align-items: center; }
.select-wrap::after {
  content: "";
  position: absolute;
  right: 5px;
  top: 50%;
  margin-top: -2px;
  width: 0; height: 0;
  border-left: 3px solid transparent;
  border-right: 3px solid transparent;
  border-top: 4px solid currentColor;
  opacity: 0.55;
  pointer-events: none;
}
.select-borderless {
  min-width: 0;
  max-width: 200px;
  background: transparent;
  color: var(--vscode-foreground);
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  padding: 3px 16px 3px 6px;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}
.thinking-select.select-borderless { max-width: 92px; }
.select-borderless:hover { background: var(--vscode-toolbar-hoverBackground); }
.select-borderless:focus { background: var(--vscode-toolbar-hoverBackground); }
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  cursor: pointer;
  background: transparent;
  color: var(--vscode-foreground);
  border: none;
  border-radius: 5px;
  outline: none;
  flex-shrink: 0;
}
.icon-btn svg { width: 16px; height: 16px; display: block; }
.icon-btn:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground); }
.icon-btn:disabled { opacity: 0.4; cursor: default; }
.toolbar button {
  padding: 2px 8px;
  cursor: pointer;
  background: var(--vscode-button-secondaryBackground, transparent);
  color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
  border: 1px solid var(--vscode-widget-border, transparent);
  border-radius: 3px;
  font-size: 12px;
  font-family: inherit;
  white-space: nowrap;
}
.toolbar button:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground); }
.toolbar button:disabled { opacity: 0.4; cursor: default; }
.toolbar .session-info {
  font-size: 12px;
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1 1 auto;
  min-width: 0;
}
.toolbar .status {
  font-size: 11px;
  opacity: 0.7;
  margin-left: auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.messages-wrap { display: flex; flex-direction: column; flex: 1; min-height: 0; position: relative; }
.scroll-bottom-btn {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vscode-editorWidget-background, var(--vscode-button-secondaryBackground, #2d2d30));
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-widget-border, transparent);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  z-index: 30;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(6px);
  transition: opacity .18s, transform .18s, visibility .18s;
}
.scroll-bottom-btn.show { opacity: 1; visibility: visible; pointer-events: auto; transform: translateY(0); }
.scroll-bottom-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
.scroll-bottom-btn svg { width: 16px; height: 16px; display: block; }
.messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.msg { display: flex; flex-direction: column; gap: 6px; max-width: 100%; }
.msg.user { align-items: flex-end; }
.msg.assistant { align-items: stretch; content-visibility: auto; contain-intrinsic-size: auto 240px; }

.bubble {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}
.user-bubble {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
.user-bubble.is-collapsible { max-height: 220px; overflow: hidden; position: relative; }
.user-bubble.is-collapsible.is-expanded { max-height: none; overflow: visible; }
.user-bubble .expand-fade {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 44px;
  background: linear-gradient(to bottom, transparent, var(--vscode-button-background));
  pointer-events: none;
}
.user-bubble.is-expanded .expand-fade { display: none; }
.expand-btn {
  align-self: flex-end;
  margin-top: 2px;
  padding: 2px 6px;
  font-size: 11px;
  font-family: inherit;
  background: transparent;
  color: var(--vscode-foreground);
  opacity: 0.7;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}
.expand-btn:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
.text-block.is-collapsible { max-height: 340px; overflow: hidden; position: relative; }
.text-block.is-collapsible.is-expanded { max-height: none; overflow: visible; }
.text-block .expand-fade {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 44px;
  background: linear-gradient(to bottom, transparent, var(--vscode-editor-background));
  pointer-events: none;
}
.text-block.is-expanded .expand-fade { display: none; }
.assistant .text-block { line-height: 1.55; padding: 2px 0; font-size: 13px; }
.text-block > :last-child { margin-bottom: 0; }
.text-block p { margin: 0 0 8px; }
.text-block h1 { font-size: 1.4em; margin: 14px 0 8px; font-weight: 600; }
.text-block h2 { font-size: 1.25em; margin: 12px 0 6px; font-weight: 600; }
.text-block h3 { font-size: 1.1em; margin: 10px 0 6px; font-weight: 600; }
.text-block h4, .text-block h5, .text-block h6 { font-size: 1em; margin: 8px 0 4px; font-weight: 600; }
.text-block ul, .text-block ol { margin: 0 0 8px; padding-left: 22px; }
.text-block li { margin: 2px 0; }
.text-block a { color: var(--vscode-textLink-foreground); }
.text-block blockquote { margin: 0 0 8px; padding: 2px 10px; border-left: 3px solid var(--vscode-textBlockQuote-border, var(--vscode-widget-border, transparent)); color: var(--vscode-textBlockQuote-foreground, inherit); }
.text-block code { font-family: var(--vscode-editor-font-family); font-size: 0.92em; background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.1)); padding: 1px 4px; border-radius: 3px; }
.text-block pre { margin: 0 0 8px; padding: 8px 10px; background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.08)); border-radius: 4px; overflow-x: auto; }
.text-block pre code { background: none; padding: 0; font-size: 12px; line-height: 1.5; white-space: pre; }
.text-block table { border-collapse: collapse; margin: 0 0 8px; display: block; overflow-x: auto; }
.text-block th, .text-block td { border: 1px solid var(--vscode-widget-border, transparent); padding: 4px 8px; }
.text-block th { background: var(--vscode-list-hoverBackground, rgba(127,127,127,0.1)); font-weight: 600; }
.text-block hr { border: none; border-top: 1px solid var(--vscode-widget-border, transparent); margin: 10px 0; }
.text-block img { max-width: 100%; }
.thinking-block {
  border: 1px solid var(--vscode-widget-border, transparent);
  border-radius: 6px;
  background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.08));
  padding: 4px 8px;
  font-size: 12px;
}
.thinking-block > summary {
  cursor: pointer;
  opacity: 0.75;
  list-style: none;
  user-select: none;
  font-weight: 500;
}
.thinking-block > summary::-webkit-details-marker { display: none; }
.thinking-block > summary:before { content: "\\25B6  Thinking"; font-size: 11px; }
.thinking-block[open] > summary:before { content: "\\25BC  Thinking"; }
.thinking-body {
  margin-top: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  opacity: 0.85;
  line-height: 1.5;
}

.tool-block {
  border: 1px solid var(--vscode-widget-border, transparent);
  border-left: 3px solid var(--vscode-charts-blue, #3794ff);
  border-radius: 4px;
  background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.06));
  overflow: hidden;
}
.tool-block.is-error { border-left-color: var(--vscode-errorForeground, #f48771); }
.tool-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  font-size: 12px;
  background: var(--vscode-list-hoverBackground, rgba(127,127,127,0.1));
  cursor: pointer;
  list-style: none;
  user-select: none;
}
.tool-head::-webkit-details-marker { display: none; }
.tool-head:before { content: "\\25BC"; font-size: 9px; opacity: 0.6; }
.tool-block:not([open]) > .tool-head:before { content: "\\25B6"; }
.tool-name { font-weight: 600; font-family: var(--vscode-editor-font-family); }
.tool-summary { font-family: var(--vscode-editor-font-family); color: var(--vscode-foreground); opacity: 0.9; flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tool-status { opacity: 0.6; font-size: 11px; margin-left: auto; }
.tool-args, .tool-result {
  margin: 0;
  padding: 6px 8px;
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
  max-height: 320px;
  overflow-y: auto;
}
.tool-args { border-top: 1px solid var(--vscode-widget-border, transparent); color: var(--vscode-foreground); }
.tool-result { border-top: 1px solid var(--vscode-widget-border, transparent); color: var(--vscode-terminal-ansiGreen, #4ec9b0); }
.tool-block.is-error .tool-result { color: var(--vscode-errorForeground, #f48771); }
.tool-args:empty, .tool-result:empty { display: none; }
.tool-expand { margin: 4px 0; align-self: flex-start; font-size: 11px; padding: 2px 8px; cursor: pointer; border: 1px solid var(--vscode-button-border, transparent); background: var(--vscode-button-secondaryBackground, var(--vscode-toolbar-hoverBackground)); color: var(--vscode-button-secondaryForeground, var(--vscode-foreground)); border-radius: 3px; }
.text-block.is-streaming { white-space: pre-wrap; word-break: break-word; }

.error-banner {
  padding: 6px 10px;
  background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
  color: var(--vscode-inputValidation-errorForeground, #f48771);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg-error {
  margin-top: 6px;
  padding: 2px 0;
  color: var(--vscode-errorForeground, #f48771);
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
}

.composer {
  flex-shrink: 0;
  border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border, transparent));
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  background: var(--vscode-editor-background);
}
.autocomplete {
  position: absolute;
  bottom: 100%;
  left: 8px;
  right: 8px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--vscode-quickInput-background, var(--vscode-dropdown-background));
  border: 1px solid var(--vscode-dropdown-border, var(--vscode-widget-border, transparent));
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  z-index: 10;
}
.autocomplete-item {
  padding: 6px 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 1px;
  border-bottom: 1px solid var(--vscode-widget-border, transparent);
}
.autocomplete-item:last-child { border-bottom: none; }
.autocomplete-item.active { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.autocomplete-item .ac-name { font-weight: 500; font-family: var(--vscode-editor-font-family); font-size: 12px; }
.autocomplete-item .ac-desc { font-size: 11px; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.autocomplete-item .ac-source { font-size: 10px; opacity: 0.5; }

#input {
  width: 100%;
  display: block;
  resize: none;
  min-height: 28px;
  max-height: 200px;
  padding: 8px 10px 2px;
  background: transparent;
  color: var(--vscode-input-foreground);
  border: none;
  border-radius: 8px 8px 0 0;
  font-family: var(--vscode-font-family);
  font-size: 13px;
  line-height: 1.5;
  outline: none;
}
#input::placeholder { color: var(--vscode-input-placeholderForeground, var(--vscode-descriptionForeground)); }
.send-btn {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-radius: 50%;
  margin-left: 6px;
}
.send-btn:hover:not(:disabled):not(.is-stop) { background: var(--vscode-button-hoverBackground); }
.send-btn.is-stop {
  background: var(--vscode-button-secondaryBackground, var(--vscode-toolbar-hoverBackground));
  color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
  animation: stop-breath 2.2s ease-in-out infinite;
}
@keyframes stop-breath {
  0%, 100% { box-shadow: 0 0 0 0 rgba(244,135,113,0); filter: brightness(1); }
  50% { box-shadow: 0 0 0 4px rgba(244,135,113,0.30), 0 0 10px 2px rgba(244,135,113,0.35); filter: brightness(1.06); }
}
.send-btn.is-stop:hover {
  animation: none;
  background: var(--vscode-errorForeground, #f48771);
  color: var(--vscode-editor-background, #1e1e1e);
  filter: brightness(1.12);
}
.hint { font-size: 11px; opacity: 0.5; padding: 0 2px; }

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.dialog {
  width: 460px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
  border: 1px solid var(--vscode-widget-border, transparent);
  border-radius: 8px;
  padding: 14px 16px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dialog h3 { margin: 0; font-size: 14px; }
.dialog p { margin: 0; opacity: 0.85; white-space: pre-wrap; word-break: break-word; }
.toast {
  position: fixed;
  right: 16px;
  bottom: 16px;
  max-width: 360px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--vscode-editorWidget-background, #2d2d30);
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-widget-border, transparent);
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  z-index: 120;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity .15s, transform .15s;
  pointer-events: none;
}
.toast.show { opacity: 1; transform: translateY(0); }
.toast.error { border-color: var(--vscode-errorForeground, #f48771); }
.toast.success { border-color: var(--vscode-testing-runPassed, #3fb950); }
@keyframes toast-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
.toast.persistent { animation: toast-pulse 1.4s ease-in-out infinite; }
.info-panel {
  width: min(720px, 92vw);
  max-height: 82vh;
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
  border: 1px solid var(--vscode-widget-border, transparent);
  border-radius: 8px;
  padding: 14px 16px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.info-panel h3 { margin: 0; font-size: 14px; }
.info-panel-body { overflow-y: auto; flex: 1; }
.info-panel-body table { border-collapse: collapse; font-size: 12px; }
.info-panel-body th, .info-panel-body td { border: 1px solid var(--vscode-widget-border, #444); padding: 2px 8px; }
.info-panel-actions { display: flex; justify-content: flex-end; }
.dialog .dialog-input, .dialog textarea.dialog-input {
  width: 100%;
  padding: 6px 8px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, var(--vscode-widget-border, transparent));
  border-radius: 4px;
  font-family: var(--vscode-font-family);
  font-size: 13px;
  outline: none;
}
.dialog textarea.dialog-input { min-height: 100px; resize: vertical; }
.dialog .opt-list { display: flex; flex-direction: column; gap: 4px; }
.dialog .opt-btn {
  text-align: left;
  padding: 8px 10px;
  cursor: pointer;
  background: var(--vscode-button-secondaryBackground, transparent);
  color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
  border: 1px solid var(--vscode-widget-border, transparent);
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}
.dialog .opt-btn:hover { background: var(--vscode-list-hoverBackground); }
.dialog .dialog-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 4px; }
.dialog .btn {
  padding: 5px 14px;
  cursor: pointer;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}
.dialog .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.dialog .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
.dialog .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
.dialog .q-block { display: flex; flex-direction: column; gap: 6px; padding: 8px 0; border-bottom: 1px solid var(--vscode-widget-border, transparent); }
.dialog .q-block:last-of-type { border-bottom: none; }
.dialog .q-header { display: flex; align-items: baseline; gap: 6px; }
.dialog .q-num { font-weight: 600; font-size: 13px; }
.dialog .q-label { font-weight: 600; font-size: 13px; }
.dialog .q-prompt { color: var(--vscode-descriptionForeground); font-size: 12px; white-space: pre-wrap; word-break: break-word; }
.dialog .q-options { display: flex; flex-direction: column; gap: 4px; }
.dialog .opt-btn .opt-label { display: block; }
.dialog .opt-btn .opt-desc { display: block; font-size: 11px; opacity: 0.7; margin-top: 2px; }
.dialog .opt-btn.selected { border-color: var(--vscode-button-background); background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground)); }
.dialog .q-textarea { width: 100%; min-height: 60px; resize: vertical; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, var(--vscode-widget-border, transparent)); border-radius: 4px; padding: 6px; font-family: inherit; font-size: 13px; box-sizing: border-box; }
.dialog .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  text-align: center;
}
.empty-logo { width: 56px; height: 56px; opacity: 0.7; }
.empty-logo svg { width: 100%; height: 100%; display: block; }
.empty-line { font-size: 15px; font-weight: 600; color: var(--vscode-foreground); }
.empty-accent { color: var(--vscode-button-background, var(--vscode-textLink-foreground, #0e639c)); }
.widget { flex-shrink: 0; padding: 6px 8px 0; }
.widget-card {
  border: 1px solid var(--vscode-widget-border, transparent);
  border-left: 3px solid var(--vscode-charts-blue, #3794ff);
  border-radius: 4px;
  background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.06));
  padding: 6px 8px;
}
.widget-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
}
.widget-head .widget-title { flex: 1 1 auto; min-width: 0; }
.widget-clear {
  background: transparent;
  color: var(--vscode-foreground);
  opacity: 0.7;
  border: 1px solid var(--vscode-widget-border, transparent);
  border-radius: 4px;
  padding: 1px 8px;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
}
.widget-clear:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
.widget-body {
  margin: 0;
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  white-space: pre;
  line-height: 1.5;
}
.queue { flex-shrink: 0; padding: 6px 8px 0; display: flex; flex-direction: column; gap: 4px; }
.queue-item {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  border: 1px solid var(--vscode-widget-border, transparent);
  border-left: 3px solid var(--vscode-charts-blue, #3794ff);
  border-radius: 4px;
  background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.06));
  padding: 4px 8px;
  font-size: 12px;
}
.queue-item.is-followup { border-left-color: var(--vscode-charts-purple, #b392f0); }
.queue-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--vscode-charts-blue, #3794ff);
  color: var(--vscode-button-foreground, #fff);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.queue-item.is-followup .queue-badge { background: var(--vscode-charts-purple, #b392f0); }
.queue-text {
  flex: 1 1 auto;
  min-width: 0;
  white-space: pre-wrap;
  word-break: break-word;
  opacity: 0.9;
  max-height: 60px;
  overflow: hidden;
}

.ctx-menu {
  position: fixed;
  z-index: 200;
  min-width: 90px;
  background: var(--vscode-menu-background, var(--vscode-quickInput-background, var(--vscode-dropdown-background)));
  border: 1px solid var(--vscode-dropdown-border, var(--vscode-widget-border, transparent));
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  padding: 2px 0;
}
.ctx-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 4px 14px;
  background: transparent;
  color: var(--vscode-foreground);
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
}
.ctx-item:hover:not(:disabled) { background: var(--vscode-list-hoverBackground); }
.ctx-item:disabled { opacity: 0.4; cursor: default; }
</style>
</head>
<body>
<div class="app">
  <div class="toolbar">
    <span class="session-info" id="session-info"></span>
    <span class="status" id="status"></span>
  </div>
  <div class="messages-wrap">
    <div class="messages" id="messages"></div>
    <button class="scroll-bottom-btn" id="scroll-bottom-btn" type="button" title="Scroll to bottom"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.5v9M4.5 7.5L8 11l3.5-3.5"/></svg></button>
  </div>
  <div id="widget" class="widget" style="display:none"></div>
  <div id="queue" class="queue" style="display:none"></div>
  <div class="composer">
    <div class="autocomplete" id="autocomplete" style="display:none"></div>
    <div class="composer-box">
      <textarea id="input" rows="1" placeholder="Ask anything\u2026  (use / for commands)"></textarea>
      <div class="composer-controls-bar">
        <button id="attach-btn" class="icon-btn" type="button" title="Add file or folder"></button>
        <div class="composer-spacer"></div>
        <span class="ctx-ring" id="ctx-ring" title="Context usage"><svg viewBox="0 0 16 16"><circle class="ctx-ring-track" cx="8" cy="8" r="6"></circle><circle class="ctx-ring-prog" id="ctx-ring-prog" cx="8" cy="8" r="6" pathLength="100"></circle></svg></span>
        <div class="select-wrap"><select id="model-select" class="select-borderless" title="Model"></select></div>
        <div class="select-wrap"><select id="thinking-select" class="select-borderless thinking-select" title="Thinking level"></select></div>
        <button id="send" class="icon-btn send-btn" type="button" title="Send message"></button>
      </div>
    </div>
    <div class="hint" id="hint"></div>
  </div>
</div>
<div class="overlay" id="overlay" style="display:none"></div>
<div class="toast" id="toast"></div>
<div class="ctx-menu" id="ctx-menu" style="display:none"><button class="ctx-item" id="ctx-copy" type="button">Copy</button><button class="ctx-item" id="ctx-fork" type="button">Fork from here</button><button class="ctx-item" id="ctx-revert" type="button">Revert here</button></div>
<script>
${mditSrc}
</script>
<script>
var vscode = acquireVsCodeApi();
var md = window.markdownit({ html: false, breaks: true, linkify: true });

var models = [];
var thinkingLevels = [];
var commands = [];
var BUILTIN_CMDS = { compact: 1, autocompact: 1, session: 1, name: 1, changelog: 1, clear: 1, new: 1 };
var state = { model: null, thinkingLevel: 'medium', isStreaming: false, sessionFile: null };
var retryAttempt = 0;

var ICON_PLUS = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3.5v9M3.5 8h9"/></svg>';
var ICON_SEND = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12.5V4M4.5 7.5L8 4l3.5 3.5"/></svg>';
var ICON_STOP = '<svg viewBox="0 0 16 16"><rect x="4.5" y="4.5" width="7" height="7" rx="1.4" fill="currentColor"/></svg>';
var EMPTY_HTML = '<div class="empty">'
  + '<div class="empty-logo"><svg viewBox="0 0 800 800" fill="currentColor"><path fill-rule="evenodd" d="M165.29 165.29H517.36V400H400V517.36H282.65V634.72H165.29ZM282.65 282.65V400H400V282.65Z"/><path d="M517.36 400H634.72V634.72H517.36Z"/></svg></div>'
  + '<div class="empty-line">There are many agent harnesses</div>'
  + '<div class="empty-line">but this one is <span class="empty-accent">yours</span></div>'
  + '</div>';
var messagesEl = document.getElementById('messages');
var widgetEl = document.getElementById('widget');
var queueEl = document.getElementById('queue');
var inputEl = document.getElementById('input');
var sendBtn = document.getElementById('send');
var attachBtn = document.getElementById('attach-btn');
attachBtn.innerHTML = ICON_PLUS;
var modelSelect = document.getElementById('model-select');
var ctxRing = document.getElementById('ctx-ring');
var ctxRingProg = document.getElementById('ctx-ring-prog');
var ctxRingText = '';
var thinkingSelect = document.getElementById('thinking-select');
var statusEl = document.getElementById('status');
var sessionInfoEl = document.getElementById('session-info');
var hintEl = document.getElementById('hint');
var acEl = document.getElementById('autocomplete');
var overlayEl = document.getElementById('overlay');
var toastEl = document.getElementById('toast');

var acItems = [];
var acIndex = -1;
var PI_HOME = ${JSON.stringify(home || "")};
var PI_SEP = ${JSON.stringify(sep || "/")};

// ---- helpers ----
function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
var autoScroll = true;
var scrollBottomBtn = document.getElementById('scroll-bottom-btn');
function updateScrollBtn() {
  if (autoScroll) scrollBottomBtn.classList.remove('show');
  else scrollBottomBtn.classList.add('show');
}
messagesEl.addEventListener('scroll', function() {
  autoScroll = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
  updateScrollBtn();
});
scrollBottomBtn.addEventListener('click', scrollToBottom);
var scrollRAF = null;
function scheduleScroll() {
  if (scrollRAF) return;
  scrollRAF = requestAnimationFrame(function() {
    scrollRAF = null;
    if (autoScroll) messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}
function scrollToBottom() {
  autoScroll = true;
  if (scrollRAF) { cancelAnimationFrame(scrollRAF); scrollRAF = null; }
  messagesEl.scrollTop = messagesEl.scrollHeight;
  updateScrollBtn();
}
function setStatus(t) { statusEl.textContent = t || ''; }
function updateSendButton() {
  if (state.isStreaming) {
    sendBtn.innerHTML = ICON_STOP;
    sendBtn.classList.add('is-stop');
    sendBtn.title = 'Stop generation';
    sendBtn.disabled = false;
  } else {
    sendBtn.innerHTML = ICON_SEND;
    sendBtn.classList.remove('is-stop');
    sendBtn.title = 'Send message';
    sendBtn.disabled = !inputEl.value.trim();
  }
}
function setStreaming(b) {
  state.isStreaming = b;
  if (!b) finalizeTextBlocks();
  updateSendButton();
  attachBtn.disabled = b;
  if (!b && !statusEl.textContent) setStatus('');
}
function showHint(t) { hintEl.textContent = t || ''; }

function formatTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'm';
  if (n >= 100000) return Math.round(n / 1000) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}
function applyContextUsage(usage) {
  if (!ctxRingProg || !ctxRing) return;
  var pct = (usage && typeof usage.percent === 'number') ? usage.percent : 0;
  if (pct < 0) pct = 0; else if (pct > 100) pct = 100;
  ctxRingProg.style.strokeDashoffset = String(100 - pct);
  var tokens = (usage && typeof usage.tokens === 'number') ? usage.tokens : null;
  var cw = (usage && typeof usage.contextWindow === 'number') ? usage.contextWindow : null;
  if (tokens != null && cw != null) {
    ctxRingText = formatTokens(tokens) + '/' + formatTokens(cw) + ' tokens';
  } else {
    ctxRingText = '';
  }
}

function clearMessages() {
  messagesEl.innerHTML = EMPTY_HTML;
}

function applyWidget(key, lines) {
  if (!key || !lines || !lines.length) { widgetEl.style.display = 'none'; widgetEl.innerHTML = ''; return; }
  widgetEl.innerHTML = '';
  if (key !== 'todo-list') {
    var pre = el('pre', 'widget-body');
    pre.textContent = lines.join('\\n');
    widgetEl.appendChild(pre);
    widgetEl.style.display = 'block';
    return;
  }
  var card = el('div', 'widget-card');
  var head = el('div', 'widget-head');
  var title = el('span', 'widget-title');
  title.textContent = lines[0] || 'Todos';
  head.appendChild(title);
  if (lines.length > 1) {
    var clearBtn = el('button', 'widget-clear');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', function() { vscode.postMessage({ type: 'todoClear' }); });
    head.appendChild(clearBtn);
  }
  card.appendChild(head);
  if (lines.length > 1) {
    var body = el('pre', 'widget-body');
    body.textContent = lines.slice(1).join('\\n');
    card.appendChild(body);
  }
  widgetEl.appendChild(card);
  widgetEl.style.display = 'block';
}

var queueState = { steering: [], followUp: [] };
function makeQueueItem(text, kind) {
  var item = el('div', 'queue-item' + (kind === 'followUp' ? ' is-followup' : ''));
  var badge = el('span', 'queue-badge');
  badge.textContent = kind === 'followUp' ? 'Follow-up' : 'Steering';
  var txt = el('div', 'queue-text');
  txt.textContent = text;
  txt.title = text;
  item.appendChild(badge);
  item.appendChild(txt);
  return item;
}
function renderQueue() {
  var s = queueState.steering || [];
  var f = queueState.followUp || [];
  if (!s.length && !f.length) { queueEl.style.display = 'none'; queueEl.innerHTML = ''; return; }
  queueEl.innerHTML = '';
  for (var i = 0; i < s.length; i++) queueEl.appendChild(makeQueueItem(s[i], 'steer'));
  for (var j = 0; j < f.length; j++) queueEl.appendChild(makeQueueItem(f[j], 'followUp'));
  queueEl.style.display = 'flex';
}

// ---- message DOM ----
var currentAssistant = null; // { el, blocks: [] }
var lastUserBubble = null;

function addUserMessage(text) {
  var empty = messagesEl.querySelector('.empty');
  if (empty) empty.remove();
  var row = el('div', 'msg user');
  var bubble = el('div', 'bubble user-bubble');
  bubble.textContent = text;
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  lastUserBubble = bubble;

  if (bubble.scrollHeight > 240) {
    bubble.classList.add('is-collapsible');
    bubble.appendChild(el('div', 'expand-fade'));
    var btn = el('button', 'expand-btn');
    btn.type = 'button';
    btn.textContent = 'Show more';
    btn.addEventListener('click', function() {
      var expanded = bubble.classList.toggle('is-expanded');
      btn.textContent = expanded ? 'Show less' : 'Show more';
      scrollToBottom();
    });
    row.appendChild(btn);
  }

  scheduleScroll();
  return bubble;
}

function startAssistantMessage() {
  var empty = messagesEl.querySelector('.empty');
  if (empty) empty.remove();
  var row = el('div', 'msg assistant');
  messagesEl.appendChild(row);
  currentAssistant = { el: row, blocks: [] };
  scheduleScroll();
}

function collapseThinking() {
  if (!currentAssistant) return;
  for (var i = 0; i < currentAssistant.blocks.length; i++) {
    var b = currentAssistant.blocks[i];
    if (b && b.type === 'thinking') b.el.removeAttribute('open');
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
      if (b.statusEl) b.statusEl.textContent = 'error';
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
  return b;
}

function createBlock(type) {
  if (type === 'text') {
    var t = el('div', 'text-block');
    return { type: 'text', el: t, text: '', textEl: t };
  }
  if (type === 'thinking') {
    var det = el('details', 'thinking-block');
    det.setAttribute('open', '');
    det.appendChild(el('summary', ''));
    var body = el('div', 'thinking-body');
    det.appendChild(body);
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
  var args = el('pre', 'tool-args');
  var result = el('pre', 'tool-result');
  wrap.appendChild(head);
  wrap.appendChild(args);
  wrap.appendChild(result);
  return { type: 'toolcall', el: wrap, nameEl: name, summaryEl: summary, statusEl: st, argsEl: args, resultEl: result, toolCallId: null, name: 'tool', argsText: '' };
}

function renderMarkdown(target, text) {
  target._piMd = text;
  try { target.innerHTML = md.render(text); } catch (e) { target.textContent = text; }
}
function applyTextCollapsible(b) {
  var textEl = b.textEl;
  if (!textEl || !textEl.parentNode) return;
  if (textEl._expandBtn) { textEl._expandBtn.remove(); textEl._expandBtn = null; }
  if (textEl._fade) { textEl._fade.remove(); textEl._fade = null; }
  textEl.classList.remove('is-collapsible');
  textEl.classList.remove('is-expanded');
  if (textEl.scrollHeight <= 360) return;
  textEl.classList.add('is-collapsible');
  var fade = el('div', 'expand-fade');
  textEl.appendChild(fade);
  textEl._fade = fade;
  var btn = el('button', 'expand-btn');
  btn.type = 'button';
  btn.textContent = 'Show more';
  btn.addEventListener('click', function() {
    var expanded = textEl.classList.toggle('is-expanded');
    btn.textContent = expanded ? 'Show less' : 'Show more';
    scrollToBottom();
  });
  textEl.parentNode.insertBefore(btn, textEl.nextSibling);
  textEl._expandBtn = btn;
}

var MAX_INLINE = 12000;
function setClamped(preEl, text) {
  text = typeof text === 'string' ? text : '';
  if (text.length > MAX_INLINE) {
    if (preEl._fullBtn) preEl._fullBtn.remove();
    preEl.textContent = text.slice(0, MAX_INLINE) + ' ... (truncated, ' + (text.length - MAX_INLINE) + ' more chars)';
    var full = text;
    var btn = el('button', 'tool-expand');
    btn.type = 'button';
    btn.textContent = 'Expand';
    btn.addEventListener('click', function() {
      preEl.textContent = full;
      if (preEl._fullBtn) { preEl._fullBtn.remove(); preEl._fullBtn = null; }
      preEl._full = null;
      scheduleScroll();
    });
    if (preEl.parentNode) preEl.parentNode.insertBefore(btn, preEl.nextSibling);
    preEl._full = full;
    preEl._fullBtn = btn;
  } else {
    preEl.textContent = text;
    if (preEl._fullBtn) { preEl._fullBtn.remove(); preEl._fullBtn = null; }
    preEl._full = null;
  }
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
  b.text += delta;
  if (!b._tnode) { b.textEl.textContent = ''; b._tnode = document.createTextNode(''); b.textEl.appendChild(b._tnode); }
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
  }
  return s;
}
function applyToolSummary(b, name, args) {
  if (!b || !b.summaryEl) return;
  var parsed = args;
  if (typeof args === 'string') { try { parsed = JSON.parse(args); } catch (e) { parsed = null; } }
  b.summaryEl.textContent = formatToolSummary(name || b.name || '', parsed);
}
function finalizeToolCall(ci, toolCall) {
  var b = ensureBlock(ci, 'toolcall');
  if (toolCall) {
    if (toolCall.name) { b.name = toolCall.name; b.nameEl.textContent = toolCall.name; }
    if (toolCall.id) { b.toolCallId = toolCall.id; b.el.setAttribute('data-tcid', toolCall.id); }
    var args = toolCall.arguments;
    if (args !== undefined && args !== null) {
      b.argsText = typeof args === 'string' ? args : JSON.stringify(args, null, 2);
      b._anode = null;
      setClamped(b.argsEl, b.argsText);
    }
    applyToolSummary(b, b.name, args);
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
  if (ev.toolName) { b.name = ev.toolName; b.nameEl ? (b.nameEl.textContent = ev.toolName) : null; }
  b.el._block = b;
  b.el.setAttribute('open', '');
  if (b.statusEl) b.statusEl.textContent = 'running';
  if (ev.args !== undefined && ev.args !== null && b.argsEl && !b.argsText) {
    b.argsText = typeof ev.args === 'string' ? ev.args : JSON.stringify(ev.args, null, 2);
    b._anode = null;
    setClamped(b.argsEl, b.argsText);
  }
  applyToolSummary(b, b.name, ev.args);
  scheduleScroll();
}
function updateToolExecution(ev) {
  var b = findToolBlock(ev.toolCallId);
  if (!b || !b.resultEl) return;
  var pr = ev.partialResult;
  if (pr && pr.content) {
    var txt = '';
    if (Array.isArray(pr.content)) {
      for (var i = 0; i < pr.content.length; i++) {
        var c = pr.content[i];
        txt += (typeof c === 'string' ? c : (c && c.text ? c.text : ''));
      }
    } else if (typeof pr.content === 'string') {
      txt = pr.content;
    }
    if (txt) setClamped(b.resultEl, txt);
  }
}
function endToolExecution(ev) {
  var b = findToolBlock(ev.toolCallId);
  if (!b) return;
  if (b.statusEl) b.statusEl.textContent = ev.isError ? 'error' : 'done';
  if (ev.isError) b.el.classList.add('is-error');
  var r = ev.result;
  if (r && r.content && b.resultEl) {
    var txt = '';
    if (Array.isArray(r.content)) {
      for (var i = 0; i < r.content.length; i++) {
        var c = r.content[i];
        txt += (typeof c === 'string' ? c : (c && c.text ? c.text : ''));
      }
    } else if (typeof r.content === 'string') {
      txt = r.content;
    }
    if (txt) setClamped(b.resultEl, txt);
  }
  b.el.removeAttribute('open');
  scheduleScroll();
}

// ---- hydrate from get_messages ----
function hydrateMessages(list) {
  messagesEl.innerHTML = '';
  currentAssistant = null;
  pendingTexts = [];
  if (!list || !list.length) {
    clearMessages();
    return;
  }
  setStatus('Loading history...');
  var i = 0;
  var CHUNK = 30;
  function step() {
    var end = Math.min(i + CHUNK, list.length);
    for (; i < end; i++) hydrateOne(list[i]);
    if (i < list.length) requestAnimationFrame(step);
    else { setStatus(''); scrollToBottom(); }
  }
  requestAnimationFrame(step);
}
function hydrateOne(m) {
  if (!m || typeof m !== 'object') return;
  var role = m.role;
  if (role === 'user') {
    var ub = addUserMessage(extractText(m.content));
    if (m && m.timestamp != null) ub._piTs = m.timestamp;
  } else if (role === 'assistant') {
    startAssistantMessage();
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
    var fakeEv = { toolCallId: m.toolCallId, result: { content: m.content }, isError: !!m.isError };
    endToolExecution(fakeEv);
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

// ---- event dispatch ----
function handleAssistantMessageEvent(amev) {
  if (!amev || typeof amev !== 'object') return;
  var t = amev.type;
  var ci = amev.contentIndex || 0;
  if (t === 'text_start') { collapseThinking(); ensureBlock(ci, 'text'); }
  else if (t === 'text_delta') { appendTextDelta(ci, amev.delta || ''); }
  else if (t === 'thinking_start') { ensureBlock(ci, 'thinking'); }
  else if (t === 'thinking_delta') { appendThinkingDelta(ci, amev.delta || ''); }
  else if (t === 'toolcall_start') { collapseThinking(); ensureBlock(ci, 'toolcall'); }
  else if (t === 'toolcall_delta') { appendToolCallDelta(ci, amev.delta || ''); }
  else if (t === 'toolcall_end') { finalizeToolCall(ci, amev.toolCall); }
}
function handleEvent(event) {
  if (!event || typeof event !== 'object') return;
  switch (event.type) {
    case 'agent_start': setStreaming(true); break;
    case 'agent_settled': setStreaming(false); retryAttempt = 0; break;
    case 'message_start':
      if (event.message && event.message.role === 'assistant') startAssistantMessage();
      else if (event.message && event.message.role === 'user') {
        if (lastUserBubble && lastUserBubble._piTs == null) {
          if (event.message.timestamp != null) lastUserBubble._piTs = event.message.timestamp;
        } else {
          var ub = addUserMessage(extractText(event.message.content));
          if (event.message.timestamp != null) ub._piTs = event.message.timestamp;
        }
      }
      break;
    case 'message_end':
      if (event.message && event.message.role === 'assistant') {
        var amsg = event.message;
        var asr = amsg.stopReason;
        applyAssistantStopError(asr, amsg.errorMessage, retryAttempt);
        endAssistantMessage();
        if (asr && asr !== 'error') retryAttempt = 0;
      }
      break;
    case 'message_update': handleAssistantMessageEvent(event.assistantMessageEvent); break;
    case 'tool_execution_start': startToolExecution(event); break;
    case 'tool_execution_update': updateToolExecution(event); break;
    case 'tool_execution_end': endToolExecution(event); break;
    case 'compaction_start': setStatus('Compacting\u2026'); showToast('Compacting session\u2026', 'info', true); break;
    case 'compaction_end': hideToast(); setStatus(''); break;
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
}

// ---- controls ----
function renderModels() {
  var prev = state.model ? (state.model.provider + '/' + state.model.id) : '';
  modelSelect.innerHTML = '';
  for (var i = 0; i < models.length; i++) {
    var m = models[i];
    var opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = m.name || m.id;
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
}
function applyState(s) {
  if (!s) return;
  state.model = s.model;
  state.thinkingLevel = s.thinkingLevel;
  state.sessionFile = s.sessionFile || null;
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
function updateAutocomplete() {
  var info = currentSlashToken();
  if (!info) { hideAutocomplete(); return; }
  var q = info.token.toLowerCase();
  var matches = [];
  for (var i = 0; i < commands.length; i++) {
    var c = commands[i];
    if (c.name.toLowerCase().indexOf(q) === 0) matches.push(c);
    if (matches.length >= 8) break;
  }
  if (!matches.length) { hideAutocomplete(); return; }
  acItems = matches;
  acIndex = 0;
  renderAutocomplete();
  acEl.style.display = 'block';
}
function renderAutocomplete() {
  acEl.innerHTML = '';
  for (var i = 0; i < acItems.length; i++) {
    var c = acItems[i];
    var item = el('div', 'autocomplete-item' + (i === acIndex ? ' active' : ''));
    item.setAttribute('data-i', String(i));
    var name = el('div', 'ac-name');
    name.textContent = '/' + c.name;
    var desc = el('div', 'ac-desc');
    desc.textContent = c.description || '';
    var src = el('div', 'ac-source');
    src.textContent = c.source;
    item.appendChild(name);
    item.appendChild(desc);
    item.appendChild(src);
    acEl.appendChild(item);
  }
}
function hideAutocomplete() { acEl.style.display = 'none'; acItems = []; acIndex = -1; }
function completeAutocomplete(c) {
  var val = inputEl.value;
  var pos = inputEl.selectionStart;
  var before = val.slice(0, pos);
  var lineStart = before.lastIndexOf('\\n') + 1;
  var after = val.slice(pos);
  var replacement = '/' + c.name + ' ';
  inputEl.value = val.slice(0, lineStart) + replacement + after;
  var newPos = lineStart + replacement.length;
  inputEl.focus();
  try { inputEl.setSelectionRange(newPos, newPos); } catch (e) {}
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
  if (!msg.trim()) return;
  if (state.isStreaming && isLocalCommand(msg)) return;
  inputEl.value = '';
  autoGrow();
  hideAutocomplete();
  if (state.isStreaming) {
    vscode.postMessage({ type: 'prompt', message: msg, streamingBehavior: behavior || 'steer' });
  } else {
    addUserMessage(msg);
    if (!isLocalCommand(msg)) {
      setStreaming(true);
    } else {
      updateSendButton();
    }
    vscode.postMessage({ type: 'prompt', message: msg });
  }
}

function autoGrow() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
}

attachBtn.addEventListener('click', function() {
  if (state.isStreaming) return;
  vscode.postMessage({ type: 'pickResource' });
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
  var h = el('h3'); h.textContent = title; box.appendChild(h);
  if (request.message) { var p = el('p'); p.textContent = String(request.message); box.appendChild(p); }

  var inputField = null;
  if (method === 'editor' && request.title === 'Pi Questionnaire Form') {
    renderQuestionnaireForm(box, request);
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
  overlayEl.innerHTML = '';
  var box = el('div', 'info-panel');
  var h = el('h3'); h.textContent = title || ''; box.appendChild(h);
  var body = el('div', 'info-panel-body');
  box.appendChild(body);
  renderMarkdown(body, markdown || '');
  var actions = el('div', 'info-panel-actions');
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
});
thinkingSelect.addEventListener('change', function() {
  vscode.postMessage({ type: 'setThinking', level: thinkingSelect.value });
});
sendBtn.addEventListener('click', function() {
  if (state.isStreaming) { vscode.postMessage({ type: 'abort' }); return; }
  sendPrompt();
});

inputEl.addEventListener('input', function() { autoGrow(); updateAutocomplete(); updateSendButton(); });
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
  if (ev.key === 'Escape' && acItems.length) { ev.preventDefault(); hideAutocomplete(); return; }
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
    case 'ready': break;
    case 'state': applyState(d.state); break;
    case 'sessionInfo': sessionInfoEl.textContent = d.label || ''; break;
    case 'models': models = d.models || []; renderModels(); break;
    case 'thinkingLevels': thinkingLevels = d.levels || []; renderThinking(); break;
    case 'commands': commands = d.commands || []; break;
    case 'messages': queueState.steering = []; queueState.followUp = []; renderQueue(); hydrateMessages(d.messages); break;
    case 'event': handleEvent(d.event); break;
    case 'pickedResources': insertPickedResources(d.paths); break;
    case 'widget': applyWidget(d.widgetKey, d.widgetLines); break;
    case 'contextUsage': applyContextUsage(d.usage); break;
    case 'toast': showToast(d.text, d.kind); break;
    case 'infoPanel': showInfoPanel(d.title, d.markdown); break;
    case 'dialog': showDialog(d.request); break;
    case 'error':
      setStreaming(false);
      var eb = el('div', 'error-banner');
      eb.textContent = d.message || 'Error';
      messagesEl.appendChild(eb);
      scrollToBottom();
      break;
    default: break;
  }
});

var ctxTooltip = document.createElement('div');
ctxTooltip.className = 'ctx-tooltip';
ctxTooltip.style.display = 'none';
document.body.appendChild(ctxTooltip);
function showCtxTooltip() {
  if (!ctxRingText) return;
  ctxTooltip.textContent = ctxRingText;
  ctxTooltip.style.display = 'block';
  var r = ctxRing.getBoundingClientRect();
  ctxTooltip.style.left = (r.left + r.width / 2 - ctxTooltip.offsetWidth / 2) + 'px';
  ctxTooltip.style.top = (r.top - ctxTooltip.offsetHeight - 6) + 'px';
}
function hideCtxTooltip() { ctxTooltip.style.display = 'none'; }
ctxRing.addEventListener('mouseenter', showCtxTooltip);
ctxRing.addEventListener('mouseleave', hideCtxTooltip);

autoGrow();
updateSendButton();
applyContextUsage(null);
clearMessages();
</script>
</body></html>`;
}
