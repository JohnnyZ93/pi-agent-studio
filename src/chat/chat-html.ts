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
.attach-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 10px 0;
}
.attach-thumb {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--vscode-widget-border, transparent);
  background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.1));
}
.attach-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.attach-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(0,0,0,0.6);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
}
.attach-remove:hover { background: var(--vscode-errorForeground, #f48771); }
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
  white-space: pre;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
}
.select-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  border: none;
  border-radius: 999px;
  background: transparent;
  transition: background 0.12s;
}
.select-wrap:hover { background: var(--vscode-toolbar-hoverBackground); }
.select-wrap:focus-within { background: var(--vscode-toolbar-hoverBackground); }
.select-wrap::after {
  content: "";
  position: absolute;
  right: 9px;
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
  background: transparent;
  color: var(--vscode-foreground);
  border: none;
  border-radius: 999px;
  font-size: 12px;
  font-family: inherit;
  padding: 3px 22px 3px 10px;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}
.model-select.select-borderless { width: auto; max-width: none; }
.thinking-select.select-borderless { width: auto; max-width: none; }
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
.toolbar .icon-btn {
  padding: 0;
  background: transparent;
  color: var(--vscode-foreground);
  opacity: 0.55;
  border: none;
  width: 24px;
  height: 24px;
}
.toolbar .icon-btn svg { width: 15px; height: 15px; display: block; }
.toolbar .icon-btn:hover:not(:disabled) { opacity: 1; }
.toolbar .icon-btn:disabled { opacity: 0.35; }
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
  color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
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
.scroll-bottom-btn:hover { transform: scale(1.12); }
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
.msg { display: flex; flex-direction: column; gap: 6px; max-width: 100%; flex-shrink: 0; }
.msg.user { align-items: flex-end; }
.msg.assistant { align-items: stretch; }
.msg-time {
  font-size: 11px;
  opacity: 0.5;
  white-space: nowrap;
  flex-shrink: 0;
  align-self: flex-end;
}

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
.user-bubble.is-collapsible { max-height: 220px; overflow-y: auto; }
.user-bubble.is-collapsible.is-expanded { max-height: none; overflow: visible; }
.user-bubble .bubble-imgs { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.user-bubble .bubble-imgs:empty { display: none; }
.user-bubble .bubble-imgs img { max-height: 160px; width: auto; max-width: 100%; border-radius: 4px; display: block; }
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
.text-block.is-collapsible { max-height: 340px; overflow-y: auto; }
.text-block.is-collapsible.is-expanded { max-height: none; overflow: visible; }
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
  display: flex;
  flex-direction: column;
  font-size: 12px;
}
.thinking-block > summary {
  cursor: pointer;
  opacity: 0.75;
  list-style: none;
  user-select: none;
  font-weight: 500;
  display: flex;
  align-items: center;
}
.thinking-block.is-running > summary { opacity: 1; }
.thinking-block.is-running > summary::after {
  content: "";
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-left: auto;
  border: 1.5px solid var(--vscode-charts-blue, #3794ff);
  border-top-color: transparent;
  border-radius: 50%;
  animation: tool-spin 0.7s linear infinite;
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
  position: relative;
  max-height: 340px;
  overflow-y: auto;
}
.thinking-block[open] .thinking-body {
  margin-top: 4px;
  margin-left: 3px;
  padding-left: 12px;
  border-left: 2px solid var(--vscode-widget-border, rgba(127,127,127,0.25));
}
.compaction-block {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vscode-widget-border, transparent);
  border-left: 3px solid var(--vscode-charts-purple, #b392f0);
  border-radius: 6px;
  background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.08));
  padding: 4px 8px;
  font-size: 12px;
}
.compaction-block > summary {
  cursor: pointer;
  opacity: 0.85;
  list-style: none;
  user-select: none;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
.compaction-block > summary::-webkit-details-marker { display: none; }
.compaction-block > summary:before { content: "▶"; font-size: 9px; opacity: 0.6; }
.compaction-block[open] > summary:before { content: "▼"; }
.compaction-label { font-weight: 600; opacity: 0.8; }
.compaction-body { margin-top: 6px; line-height: 1.55; padding: 2px 0; font-size: 13px; max-height: 340px; overflow-y: auto; }
.compaction-body > :last-child { margin-bottom: 0; }
.btw-block {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vscode-widget-border, transparent);
  border-left: 3px solid var(--vscode-charts-yellow, #cca700);
  border-radius: 6px;
  background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.08));
  padding: 4px 8px;
  font-size: 12px;
}
.btw-block > summary {
  cursor: pointer;
  opacity: 0.85;
  list-style: none;
  user-select: none;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btw-block > summary::-webkit-details-marker { display: none; }
.btw-block > summary:before { content: "▶"; font-size: 9px; opacity: 0.6; }
.btw-block[open] > summary:before { content: "▼"; }
.btw-label { font-weight: 600; opacity: 0.8; flex: 0 0 auto; }
.btw-q { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btw-body { margin-top: 6px; line-height: 1.55; padding: 2px 0; font-size: 13px; max-height: 340px; overflow-y: auto; }
.btw-body > :last-child { margin-bottom: 0; }
.btw-loading-text { opacity: 0.7; font-size: 12px; }

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
body.ctrl-key .tool-block[data-has-file] > .tool-head:hover { text-decoration: underline; }
.tool-name { font-weight: 600; font-family: var(--vscode-editor-font-family); }
.tool-summary { font-family: var(--vscode-editor-font-family); color: var(--vscode-foreground); opacity: 0.9; flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tool-status { opacity: 0.6; font-size: 11px; margin-left: auto; }
.tool-status.is-running { opacity: 1; color: var(--vscode-charts-blue, #3794ff); }
.tool-status.is-running::before {
  content: "";
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 5px;
  vertical-align: -1px;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: tool-spin 0.7s linear infinite;
}
@keyframes tool-spin { to { transform: rotate(360deg); } }
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
.tool-result img { display: block; max-height: 200px; width: auto; max-width: 100%; margin-top: 6px; border-radius: 4px; border: 1px solid var(--vscode-widget-border, transparent); }
.tool-block.is-error .tool-result { color: var(--vscode-errorForeground, #f48771); }
.tool-args:empty, .tool-result:empty { display: none; }
.diff-block {
  margin: 0;
  padding: 2px 0;
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  line-height: 1.5;
  color: var(--vscode-foreground);
}
.diff-line { white-space: pre-wrap; word-break: break-word; padding: 0 6px; }
.diff-sign { display: inline-block; width: 1ch; user-select: none; }
.diff-gutter { display: inline-block; min-width: 3.5em; padding-right: 8px; text-align: right; user-select: none; opacity: 0.5; }
.diff-content { display: inline; }
.diff-line.added { background: var(--vscode-diffEditor-insertedLineBackground, rgba(46,160,67,0.13)); }
.diff-line.added .diff-sign, .diff-line.added .diff-content { color: var(--vscode-gitDecoration-addedResourceForeground, #73c991); }
.diff-line.removed { background: var(--vscode-diffEditor-removedLineBackground, rgba(248,81,73,0.13)); }
.diff-line.removed .diff-sign, .diff-line.removed .diff-content { color: var(--vscode-gitDecoration-deletedResourceForeground, #f48771); }
.diff-line.context .diff-content { color: var(--vscode-descriptionForeground, var(--vscode-foreground)); opacity: 0.9; }
.diff-line.context .diff-gutter { opacity: 0.4; }
.diff-line.hunk { opacity: 0.5; }
.diff-line.hunk .diff-content { font-style: italic; }
.tool-block.is-diff .tool-args { display: none; }
.tool-block.is-subagent .tool-args { display: none; }
.subagent-wrap { color: var(--vscode-foreground); white-space: normal; }
.subagent-body { padding: 2px 0; font-size: 12px; line-height: 1.5; }
.sub-task {
  border: 1px solid var(--vscode-widget-border, transparent);
  border-left: 2px solid var(--vscode-charts-blue, #3794ff);
  border-radius: 3px;
  margin: 4px 0;
  overflow: hidden;
}
.sub-task.is-failed { border-left-color: var(--vscode-errorForeground, #f48771); }
.sub-task-head {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 8px; font-size: 12px; font-weight: 500;
  background: var(--vscode-list-hoverBackground, rgba(127,127,127,0.1));
  cursor: pointer; list-style: none; user-select: none;
}
.sub-task-head::-webkit-details-marker { display: none; }
.sub-task-head:before { content: "▼"; font-size: 8px; opacity: 0.5; }
.sub-task:not([open]) > .sub-task-head:before { content: "▶"; }
.sub-task-icon { flex: 0 0 auto; }
.sub-task-agent { color: var(--vscode-terminal-ansiGreen, #4ec9b0); flex: 0 0 auto; }
.sub-task-title { color: var(--vscode-foreground); opacity: 0.9; flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub-task-status { opacity: 0.6; font-size: 11px; margin-left: auto; flex: 0 0 auto; }
.sub-task-body { padding: 6px 8px; font-size: 12px; line-height: 1.5; }
.sub-section-label { color: var(--vscode-descriptionForeground, var(--vscode-foreground)); opacity: 0.7; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin: 6px 0 2px; }
.sub-task-text { color: var(--vscode-foreground); opacity: 0.85; margin-bottom: 8px; max-height: 160px; overflow-y: auto; }
.sub-toolcall { color: var(--vscode-descriptionForeground, var(--vscode-foreground)); opacity: 0.8; white-space: pre-wrap; word-break: break-word; font-family: var(--vscode-editor-font-family); }
.sub-toolcall-name { font-weight: 600; opacity: 1; color: var(--vscode-foreground); }
.sub-final { margin-top: 6px; }
.sub-md.text-block { font-size: 12px; padding: 0; line-height: 1.5; }
.sub-md.text-block p, .sub-md.text-block pre, .sub-md.text-block ul, .sub-md.text-block ol, .sub-md.text-block blockquote, .sub-md.text-block table { margin: 0 0 8px; }
.sub-md.text-block li { margin: 2px 0; }
.sub-md.text-block > :last-child { margin-bottom: 0; }
.sub-error { color: var(--vscode-errorForeground, #f48771); margin-top: 4px; white-space: pre-wrap; word-break: break-word; }
.sub-empty { opacity: 0.6; font-style: italic; }
.sub-usage { opacity: 0.75; font-size: 11px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid var(--vscode-widget-border, transparent); }
.sub-usage-model { color: var(--vscode-terminal-ansiGreen, #4ec9b0); font-weight: 500; }
.sub-total { opacity: 0.6; font-size: 11px; margin-top: 6px; padding-top: 4px; border-top: 1px solid var(--vscode-widget-border, transparent); }
.code-block {
  margin: 0;
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  line-height: 1.5;
  color: var(--vscode-foreground);
}
.code-line { white-space: pre-wrap; word-break: break-word; padding: 0 6px; }
.code-gutter { display: inline-block; min-width: 3.5em; padding-right: 8px; text-align: right; user-select: none; opacity: 0.4; }
.code-content { display: inline; }
.text-block.is-streaming { white-space: pre-wrap; word-break: break-word; max-height: 340px; overflow-y: auto; }

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
.autocomplete-item .ac-name mark.ac-hl { background: transparent; color: var(--vscode-list-highlightForeground, inherit); font-weight: 700; }

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
.toast.warning { border-color: var(--vscode-editorWarning-foreground, #cca700); }
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
.info-panel-actions { display: flex; justify-content: flex-end; gap: 6px; }
.info-panel .btn {
  padding: 5px 14px;
  cursor: pointer;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}
.info-panel .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.info-panel .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
.info-panel .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
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
.empty-hints {
  display: grid;
  grid-template-columns: auto auto;
  gap: 6px 24px;
  margin-top: 14px;
}
.empty-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  opacity: 0.72;
  white-space: nowrap;
  justify-self: start;
}
.empty-hint kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 19px;
  padding: 0 6px;
  font-family: var(--vscode-font-family);
  font-size: 11px;
  line-height: 1;
  color: var(--vscode-foreground);
  background: var(--vscode-button-secondaryBackground, rgba(127,127,127,0.12));
  border: 1px solid var(--vscode-widget-border, transparent);
  border-bottom-width: 2px;
  border-radius: 4px;
}
.widget { flex-shrink: 0; padding: 6px 8px 0; }
.widget-card {
  border: 1px solid var(--vscode-widget-border, transparent);
  border-radius: 6px;
  background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.06));
  padding: 8px 10px;
}
.widget-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 6px;
}
.widget-title {
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}
.widget-title svg { width: 14px; height: 14px; display: block; opacity: 0.9; }
.widget-stats {
  font-size: 11px;
  opacity: 0.7;
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
}
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
  flex: 0 0 auto;
  margin-left: auto;
}
.widget-clear:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
.widget-body {
  margin: 0;
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  white-space: pre;
  line-height: 1.5;
}
.todo-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 0;
}
.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 3px 4px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.45;
  transition: background 0.12s;
}
.todo-item:hover { background: var(--vscode-list-hoverBackground, rgba(127,127,127,0.08)); }
.todo-check {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  margin-top: 1px;
  border-radius: 4px;
  border: 1.5px solid var(--vscode-input-placeholderForeground, rgba(127,127,127,0.55));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  transition: background 0.15s, border-color 0.15s;
}
.todo-check svg { width: 11px; height: 11px; display: block; }
.todo-item.is-done .todo-check {
  background: var(--vscode-charts-green, #4ec9b0);
  border-color: var(--vscode-charts-green, #4ec9b0);
  color: var(--vscode-editor-background, #1e1e1e);
}
.todo-id {
  flex-shrink: 0;
  font-family: var(--vscode-editor-font-family);
  font-size: 11px;
  color: var(--vscode-textLink-foreground, var(--vscode-charts-blue, #3794ff));
  opacity: 0.8;
  margin-top: 1px;
  font-variant-numeric: tabular-nums;
}
.todo-text {
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-word;
}
.todo-item.is-done .todo-text {
  text-decoration: line-through;
  text-decoration-color: var(--vscode-disabledForeground, currentColor);
  opacity: 0.5;
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
    <button id="info-btn" class="icon-btn" type="button" title="Session info"></button>
    <button id="refresh-btn" class="icon-btn" type="button" title="Reload messages"></button>
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
      <div class="attach-preview" id="attach-preview" style="display:none"></div>
      <textarea id="input" rows="1" placeholder="Ask anything\u2026  (use / for commands, @ for files)"></textarea>
      <div class="composer-controls-bar">
        <button id="attach-btn" class="icon-btn" type="button" title="Add file or folder"></button>
        <div class="composer-spacer"></div>
        <span class="ctx-ring" id="ctx-ring" title="Context usage"><svg viewBox="0 0 16 16"><circle class="ctx-ring-track" cx="8" cy="8" r="6"></circle><circle class="ctx-ring-prog" id="ctx-ring-prog" cx="8" cy="8" r="6" pathLength="100"></circle></svg></span>
        <div class="select-wrap"><select id="model-select" class="select-borderless model-select" title="Model"></select></div>
        <div class="select-wrap"><select id="thinking-select" class="select-borderless thinking-select" title="Thinking level"></select></div>
        <button id="send" class="icon-btn send-btn" type="button" title="Send message"></button>
      </div>
    </div>
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
var state = { model: null, thinkingLevel: 'medium', isStreaming: false, isBtwLoading: false, sessionFile: null };
var retryAttempt = 0;
var inputHistory = [];
var historyIndex = -1;
var historyDraft = '';
var pendingImages = [];

var ICON_PLUS = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3.5v9M3.5 8h9"/></svg>';
var ICON_SEND = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12.5V4M4.5 7.5L8 4l3.5 3.5"/></svg>';
var ICON_STOP = '<svg viewBox="0 0 16 16"><rect x="4.5" y="4.5" width="7" height="7" rx="1.4" fill="currentColor"/></svg>';
var ICON_TODO = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5l1.5 1.5L6.5 3.5"/><path d="M2.5 10l1.5 1.5L6.5 8.5"/><path d="M9 4.5h4.5"/><path d="M9 10h4.5"/></svg>';
var ICON_CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-6.5"/></svg>';
var ICON_INFO = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.25"/><path d="M8 7.2v4"/><path d="M8 4.8h.01"/></svg>';
var ICON_REFRESH = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8a6 6 0 0 1 6-6 6.5 6.5 0 0 1 4.5 1.8L14 5.3"/><path d="M14 2v3.3h-3.3"/><path d="M14 8a6 6 0 0 1-6 6 6.5 6.5 0 0 1-4.5-1.8L2 10.7"/><path d="M2 14v-3.3h3.3"/></svg>';
var EMPTY_HTML = '<div class="empty">'
  + '<div class="empty-logo"><svg viewBox="0 0 800 800" fill="currentColor"><path fill-rule="evenodd" d="M165.29 165.29H517.36V400H400V517.36H282.65V634.72H165.29ZM282.65 282.65V400H400V282.65Z"/><path d="M517.36 400H634.72V634.72H517.36Z"/></svg></div>'
  + '<div class="empty-line">There are many agent harnesses</div>'
  + '<div class="empty-line">but this one is <span class="empty-accent">yours</span></div>'
  + '<div class="empty-hints">'
  + '<span class="empty-hint"><kbd>Enter</kbd>send / steer</span>'
  + '<span class="empty-hint"><kbd>Shift+Enter</kbd>newline</span>'
  + '<span class="empty-hint"><kbd>Alt+Enter</kbd>follow-up</span>'
  + '<span class="empty-hint"><kbd>\u2191\u2193</kbd>history</span>'
  + '<span class="empty-hint"><kbd>/</kbd>commands</span>'
  + '<span class="empty-hint"><kbd>@</kbd>files</span>'
  + '<span class="empty-hint"><kbd>' + (/Mac/i.test(navigator.platform || '') ? '\u2318V' : 'Ctrl+V') + '</kbd>paste image</span>'
  + '<span class="empty-hint"><kbd>Tab</kbd>complete</span>'
  + '</div>'
  + '</div>';
var messagesEl = document.getElementById('messages');
var widgetEl = document.getElementById('widget');
var queueEl = document.getElementById('queue');
var inputEl = document.getElementById('input');
var sendBtn = document.getElementById('send');
var attachBtn = document.getElementById('attach-btn');
var attachPreviewEl = document.getElementById('attach-preview');
attachBtn.innerHTML = ICON_PLUS;
var infoBtn = document.getElementById('info-btn');
infoBtn.innerHTML = ICON_INFO;
var refreshBtn = document.getElementById('refresh-btn');
refreshBtn.innerHTML = ICON_REFRESH;
infoBtn.addEventListener('click', function() {
  vscode.postMessage({ type: 'prompt', message: '/session' });
});
refreshBtn.addEventListener('click', function() {
  if (state.isStreaming) return;
  vscode.postMessage({ type: 'reload' });
});
var modelSelect = document.getElementById('model-select');
var ctxRing = document.getElementById('ctx-ring');
var ctxRingProg = document.getElementById('ctx-ring-prog');
var ctxRingText = '';
var lastCtxUsage = null;
var sessionCost = null;
var latestCacheHitPct = null;
var prevTurn = null;
var thinkingSelect = document.getElementById('thinking-select');
var statusEl = document.getElementById('status');
var sessionInfoEl = document.getElementById('session-info');
var acEl = document.getElementById('autocomplete');
var overlayEl = document.getElementById('overlay');
var toastEl = document.getElementById('toast');

var acItems = [];
var acIndex = -1;
var acMode = 'command';
var acMatchIndices = [];
var fileTimer = null;
var PI_HOME = ${JSON.stringify(home || "")};
var PI_SEP = ${JSON.stringify(sep || "/")};

// ---- helpers ----
function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
function formatTime(ts) {
  if (ts == null || typeof ts !== 'number' || !isFinite(ts)) return '';
  var d = new Date(ts);
  var h = d.getHours();
  var m = d.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  var hr = h % 12; if (hr === 0) hr = 12;
  var mm = m < 10 ? '0' + m : '' + m;
  return hr + ':' + mm + ' ' + ampm;
}
var autoScroll = true;
var programmaticScroll = false;
var scrollBottomBtn = document.getElementById('scroll-bottom-btn');
var STICK_THRESHOLD = 48;
function isAtBottom() {
  return messagesEl.scrollTop + messagesEl.clientHeight >= messagesEl.scrollHeight - STICK_THRESHOLD;
}
function updateScrollBtn() {
  if (autoScroll) scrollBottomBtn.classList.remove('show');
  else scrollBottomBtn.classList.add('show');
}
messagesEl.addEventListener('scroll', function() {
  if (programmaticScroll) { programmaticScroll = false; return; }
  autoScroll = isAtBottom();
  updateScrollBtn();
});
messagesEl.addEventListener('wheel', function(e) {
  programmaticScroll = false;
  if (e.deltaY < 0) {
    autoScroll = false;
    stickUntil = 0;
    if (stickRAF) { cancelAnimationFrame(stickRAF); stickRAF = null; }
    if (scrollRAF) { cancelAnimationFrame(scrollRAF); scrollRAF = null; }
    updateScrollBtn();
  }
}, true);
['keydown', 'mousedown', 'touchstart'].forEach(function(ev) {
  messagesEl.addEventListener(ev, function() { programmaticScroll = false; }, true);
});
setInterval(function() {
  if (typeof console !== 'undefined' && console.debug) console.debug('[pi-scroll] auto=' + autoScroll + ' top=' + Math.round(messagesEl.scrollTop) + ' sh=' + messagesEl.scrollHeight + ' ch=' + messagesEl.clientHeight + ' prog=' + programmaticScroll + ' stick=' + !!stickRAF + ' scroll=' + !!scrollRAF);
}, 1000);
scrollBottomBtn.addEventListener('click', scrollToBottom);
var scrollRAF = null;
var stickTimers = [];
function forceStickBottom() {
  programmaticScroll = true;
  messagesEl.scrollTop = messagesEl.scrollHeight;
  for (var i = 0; i < pendingTexts.length; i++) {
    var tb = pendingTexts[i];
    if (tb && tb.textEl) tb.textEl.scrollTop = tb.textEl.scrollHeight;
  }
  if (currentAssistant) {
    var blks = currentAssistant.blocks;
    for (var k = 0; k < blks.length; k++) {
      var tk = blks[k];
      if (tk && tk.type === 'thinking' && tk._tnode && tk.textEl) tk.textEl.scrollTop = tk.textEl.scrollHeight;
    }
  }
}
function scheduleScroll() {
  if (scrollRAF) return;
  scrollRAF = requestAnimationFrame(function() {
    scrollRAF = null;
    if (!autoScroll) return;
    forceStickBottom();
  });
}
function scrollToBottom() {
  autoScroll = true;
  programmaticScroll = false;
  if (scrollRAF) { cancelAnimationFrame(scrollRAF); scrollRAF = null; }
  for (var i = 0; i < stickTimers.length; i++) clearTimeout(stickTimers[i]);
  stickTimers = [];
  forceStickBottom();
  [60, 180, 400].forEach(function(ms) {
    stickTimers.push(setTimeout(function() { if (autoScroll) forceStickBottom(); }, ms));
  });
  updateScrollBtn();
}
function setStatus(t) { statusEl.textContent = t || ''; }
function updateSendButton() {
  if (state.isStreaming || state.isBtwLoading) {
    sendBtn.innerHTML = ICON_STOP;
    sendBtn.classList.add('is-stop');
    sendBtn.title = state.isBtwLoading ? 'Stop /btw' : 'Stop generation';
    sendBtn.disabled = false;
  } else {
    sendBtn.innerHTML = ICON_SEND;
    sendBtn.classList.remove('is-stop');
    sendBtn.title = 'Send message';
    sendBtn.disabled = !inputEl.value.trim() && !pendingImages.length;
  }
}
function setStreaming(b) {
  state.isStreaming = b;
  if (!b) finalizeTextBlocks();
  updateSendButton();
  attachBtn.disabled = b;
  refreshBtn.disabled = b;
  if (!b && !statusEl.textContent) setStatus('');
}
function applyContextUsage(usage, cost) {
  if (!ctxRingProg || !ctxRing) return;
  lastCtxUsage = usage;
  if (cost != null && typeof cost === 'number' && isFinite(cost)) sessionCost = cost;
  var pct = (usage && typeof usage.percent === 'number') ? usage.percent : 0;
  if (pct < 0) pct = 0; else if (pct > 100) pct = 100;
  ctxRingProg.style.strokeDashoffset = String(100 - pct);
  rebuildCtxRingTooltip();
}
function rebuildCtxRingTooltip() {
  var usage = lastCtxUsage;
  var lines = [];
  var tokens = (usage && typeof usage.tokens === 'number') ? usage.tokens : null;
  var cw = (usage && typeof usage.contextWindow === 'number') ? usage.contextWindow : null;
  if (tokens != null && cw != null) {
    var p = (typeof usage.percent === 'number') ? usage.percent : 0;
    if (p < 0) p = 0; else if (p > 100) p = 100;
    lines.push('Usage:   ' + p.toFixed(1) + '%');
    lines.push('Context: ' + formatTokens(tokens) + ' / ' + formatTokens(cw));
  }
  if (latestCacheHitPct != null) {
    lines.push('Cache:   ' + latestCacheHitPct.toFixed(1) + '% hit');
  }
  if (sessionCost != null) {
    lines.push('Cost:    $' + sessionCost.toFixed(3));
  }
  ctxRingText = lines.join('\\n');
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
  var payload = {};
  try { payload = JSON.parse(lines[0] || '{}'); } catch (e) {}
  var items = payload.todos || [];
  var doneCount = 0;
  for (var i = 0; i < items.length; i++) if (items[i].done) doneCount++;
  var totalCount = items.length;

  var card = el('div', 'widget-card');
  var head = el('div', 'widget-head');
  var title = el('span', 'widget-title');
  title.innerHTML = ICON_TODO + '<span>Todos</span>';
  head.appendChild(title);
  if (totalCount > 0) {
    var stats = el('span', 'widget-stats');
    stats.textContent = doneCount + '/' + totalCount + ' done';
    head.appendChild(stats);
  }
  if (items.length) {
    var clearBtn = el('button', 'widget-clear');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', function() { vscode.postMessage({ type: 'todoClear' }); });
    head.appendChild(clearBtn);
  }
  card.appendChild(head);
  if (items.length) {
    var list = el('div', 'todo-list');
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var row = el('div', 'todo-item' + (it.done ? ' is-done' : ''));
      var check = el('span', 'todo-check');
      if (it.done) check.innerHTML = ICON_CHECK;
      row.appendChild(check);
      if (it.id) {
        var idSpan = el('span', 'todo-id');
        idSpan.textContent = '#' + it.id;
        row.appendChild(idSpan);
      }
      var txt = el('span', 'todo-text');
      txt.textContent = it.text;
      row.appendChild(txt);
      list.appendChild(row);
    }
    card.appendChild(list);
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
var pendingCompactionBlock = null;
var pendingBtwBlock = null;
var btwAbortId = null;
var btwStatusActive = false;
var lastUserBubble = null;

function addUserMessage(text, images) {
  var empty = messagesEl.querySelector('.empty');
  if (empty) empty.remove();
  var row = el('div', 'msg user');
  var bubble = el('div', 'bubble user-bubble');
  if (text) bubble.textContent = text;
  if (images && images.length) {
    var wrap = el('div', 'bubble-imgs');
    for (var i = 0; i < images.length; i++) {
      var im = images[i];
      if (!im || !im.data || !im.mimeType) continue;
      var imgEl = document.createElement('img');
      imgEl.src = 'data:' + im.mimeType + ';base64,' + im.data;
      wrap.appendChild(imgEl);
    }
    bubble.appendChild(wrap);
  }
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  lastUserBubble = bubble;

  if (bubble.scrollHeight > 240) {
    bubble.classList.add('is-collapsible');
    var btn = el('button', 'expand-btn');
    btn.type = 'button';
    btn.textContent = 'Show more';
    btn.addEventListener('click', function() {
      var expanded = bubble.classList.toggle('is-expanded');
      btn.textContent = expanded ? 'Show less' : 'Show more';
    });
    row.appendChild(btn);
  }

  var timeEl = el('span', 'msg-time');
  row.appendChild(timeEl);
  bubble._piTimeEl = timeEl;

  scheduleScroll();
  return bubble;
}
function applyUserBubbleTime(bubble, ts) {
  if (!bubble) return;
  bubble._piTs = ts;
  if (bubble._piTimeEl) bubble._piTimeEl.textContent = formatTime(ts);
}

function addCompactionMessage(m) {
  var empty = messagesEl.querySelector('.empty');
  if (empty) empty.remove();
  var row = el('div', 'msg compaction');
  var det = el('details', 'compaction-block');
  var summ = el('summary', '');
  var label = el('span', 'compaction-label');
  label.textContent = '[compaction]';
  summ.appendChild(label);
  var tokensBefore = (m && typeof m.tokensBefore === 'number') ? m.tokensBefore : null;
  summ.appendChild(document.createTextNode('Compacted from ' + (tokensBefore != null ? tokensBefore.toLocaleString() : '?') + ' tokens'));
  det.appendChild(summ);
  var body = el('div', 'compaction-body text-block');
  renderMarkdown(body, (m && typeof m.summary === 'string') ? m.summary : '');
  det.appendChild(body);
  row.appendChild(det);
  messagesEl.appendChild(row);
  scheduleScroll();
}
function addCompactionPlaceholder() {
  var empty = messagesEl.querySelector('.empty');
  if (empty) empty.remove();
  var row = el('div', 'msg compaction');
  var det = el('details', 'compaction-block');
  det.setAttribute('open', '');
  var summ = el('summary', '');
  var label = el('span', 'compaction-label');
  label.textContent = '[compaction]';
  summ.appendChild(label);
  summ.appendChild(document.createTextNode(' Compacting\u2026'));
  var spin = el('span', 'tool-status is-running');
  summ.appendChild(spin);
  det.appendChild(summ);
  var body = el('div', 'compaction-body');
  body.textContent = 'Summarizing conversation\u2026';
  det.appendChild(body);
  row.appendChild(det);
  messagesEl.appendChild(row);
  pendingCompactionBlock = row;
  scheduleScroll();
}

function setBtwStatus(text) {
  if (text) { setStatus(text); btwStatusActive = true; }
  else if (btwStatusActive) { setStatus(''); btwStatusActive = false; }
}
function setBtwLoading(b) {
  state.isBtwLoading = b;
  if (!b) btwAbortId = null;
  updateSendButton();
}
function addBtwPlaceholder(question, model) {
  var empty = messagesEl.querySelector('.empty');
  if (empty) empty.remove();
  var row = el('div', 'msg btw');
  var det = el('details', 'btw-block');
  det.setAttribute('open', '');
  var summ = el('summary', '');
  var label = el('span', 'btw-label');
  label.textContent = '[btw]';
  summ.appendChild(label);
  var q = el('span', 'btw-q');
  q.textContent = question || '';
  q.title = question || '';
  summ.appendChild(q);
  var spin = el('span', 'tool-status is-running');
  summ.appendChild(spin);
  det.appendChild(summ);
  var body = el('div', 'btw-body btw-loading-text');
  body.textContent = 'Answering' + (model ? ' with ' + model : '') + '\u2026';
  det.appendChild(body);
  row.appendChild(det);
  messagesEl.appendChild(row);
  pendingBtwBlock = row;
  setBtwStatus('Answering /btw' + (model ? ' with ' + model : '') + '\u2026');
  scheduleScroll();
}
function showBtwResult(question, answer) {
  if (!pendingBtwBlock) addBtwPlaceholder(question, '');
  var det = pendingBtwBlock ? pendingBtwBlock.querySelector('.btw-block') : null;
  if (det) {
    var spin = det.querySelector('.tool-status.is-running');
    if (spin) spin.remove();
    var body = det.querySelector('.btw-body');
    if (body) {
      body.classList.remove('btw-loading-text');
      body.classList.add('text-block');
      renderMarkdown(body, answer || '');
    }
  }
  pendingBtwBlock = null;
  setBtwLoading(false);
  setBtwStatus(null);
  scheduleScroll();
}
function clearBtw() {
  if (pendingBtwBlock) { pendingBtwBlock.remove(); pendingBtwBlock = null; }
  setBtwLoading(false);
  setBtwStatus(null);
}
function showBtwError(message) {
  if (pendingBtwBlock) { pendingBtwBlock.remove(); pendingBtwBlock = null; }
  setBtwLoading(false);
  setBtwStatus(null);
  var eb = el('div', 'error-banner');
  eb.textContent = message || 'Error';
  messagesEl.appendChild(eb);
  scrollToBottom();
}
function handleBtw(lines) {
  var payload = {};
  if (lines && lines.length) {
    try { payload = JSON.parse(lines[0] || '{}'); } catch (e) {}
  }
  if (!payload || !payload.phase) { clearBtw(); return; }
  if (payload.phase === 'loading') addBtwPlaceholder(payload.question || '', payload.model || '');
  else if (payload.phase === 'result') showBtwResult(payload.question || '', payload.answer || '');
  else if (payload.phase === 'error') showBtwError(payload.message || '');
  else clearBtw();
}

function startAssistantMessage(ts) {
  var empty = messagesEl.querySelector('.empty');
  if (empty) empty.remove();
  var row = el('div', 'msg assistant');
  messagesEl.appendChild(row);
  currentAssistant = { el: row, blocks: [], ts: ts != null ? ts : null };
  scheduleScroll();
}

function collapseThinking() {
  if (!currentAssistant) return;
  for (var i = 0; i < currentAssistant.blocks.length; i++) {
    var b = currentAssistant.blocks[i];
    if (b && b.type === 'thinking') {
      b.el.classList.remove('is-running');
      if (!b.el._userToggled) b.el.removeAttribute('open');
    }
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
      if (b.statusEl) { b.statusEl.textContent = 'error'; b.statusEl.classList.remove('is-running'); }
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
  if (b.timeEl) {
    if (currentAssistant.ts != null) b.timeEl.textContent = formatTime(currentAssistant.ts);
    currentAssistant.el.appendChild(b.timeEl);
  }
  return b;
}

function createBlock(type) {
  if (type === 'text') {
    var t = el('div', 'text-block');
    var ttime = el('span', 'msg-time');
    return { type: 'text', el: t, text: '', textEl: t, timeEl: ttime };
  }
  if (type === 'thinking') {
    var det = el('details', 'thinking-block');
    det.setAttribute('open', '');
    var tSumm = el('summary', '');
    det.appendChild(tSumm);
    var body = el('div', 'thinking-body');
    det.appendChild(body);
    tSumm.addEventListener('click', function() { det._userToggled = true; });
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
  var argsPre = el('pre', 'tool-args');
  var resultPre = el('pre', 'tool-result');
  wrap.appendChild(head);
  wrap.appendChild(argsPre);
  wrap.appendChild(resultPre);
  var b = { type: 'toolcall', el: wrap, nameEl: name, summaryEl: summary, statusEl: st, argsEl: argsPre, resultEl: resultPre, toolCallId: null, name: 'tool', argsText: '', filePath: null, fileLine: null };
  head.addEventListener('click', function(ev) {
    wrap._userToggled = true;
    if ((ev.ctrlKey || ev.metaKey) && b.filePath) {
      ev.preventDefault();
      ev.stopPropagation();
      vscode.postMessage({ type: 'openFile', filePath: b.filePath, line: b.fileLine != null ? b.fileLine : null });
    }
  });
  return b;
}

function renderMarkdown(target, text) {
  target._piMd = text;
  try { target.innerHTML = md.render(text); } catch (e) { target.textContent = text; }
}
function applyTextCollapsible(b) {
  var textEl = b.textEl;
  if (!textEl || !textEl.parentNode) return;
  if (textEl._expandBtn) { textEl._expandBtn.remove(); textEl._expandBtn = null; }
  textEl.classList.remove('is-collapsible');
  textEl.classList.remove('is-expanded');
  if (textEl.scrollHeight <= 360) return;
  textEl.classList.add('is-collapsible');
  var btn = el('button', 'expand-btn');
  btn.type = 'button';
  btn.textContent = 'Show more';
  btn.addEventListener('click', function() {
    var expanded = textEl.classList.toggle('is-expanded');
    btn.textContent = expanded ? 'Show less' : 'Show more';
  });
  var host = b.el ? b.el.parentNode : textEl.parentNode;
  var ref = b.el ? b.el.nextSibling : textEl.nextSibling;
  host.insertBefore(btn, ref);
  textEl._expandBtn = btn;
}


var MAX_INLINE = 12000;
function setClamped(preEl, text) {
  text = typeof text === 'string' ? text : '';
  if (text.length > MAX_INLINE) {
    preEl.textContent = text.slice(0, MAX_INLINE) + ' ... (truncated, ' + (text.length - MAX_INLINE) + ' more chars)';
  } else {
    preEl.textContent = text;
  }
}
function extractToolResultText(content) {
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
function appendToolResultImages(resultEl, content) {
  if (!Array.isArray(content) || !resultEl) return;
  for (var i = 0; i < content.length; i++) {
    var c = content[i];
    if (c && c.type === 'image' && c.data && c.mimeType) {
      var img = document.createElement('img');
      img.src = 'data:' + c.mimeType + ';base64,' + c.data;
      resultEl.appendChild(img);
    }
  }
}
function parseDiffLine(line) {
  if (typeof line !== 'string' || line.length === 0) return null;
  var prefix = line.charAt(0);
  if (prefix !== '+' && prefix !== '-' && prefix !== ' ') return null;
  var rest = line.slice(1);
  var i = 0;
  while (i < rest.length) {
    var cc = rest.charCodeAt(i);
    if (cc === 32 || (cc >= 48 && cc <= 57)) i++; else break;
  }
  var lineNum = rest.slice(0, i);
  var content = rest.slice(i);
  if (content.charAt(0) === ' ') content = content.slice(1);
  return { prefix: prefix, lineNum: lineNum, content: content };
}
function renderToolDiff(resultEl, diffText) {
  if (!resultEl) return;
  resultEl._piMd = null;
  resultEl.textContent = '';
  var lines = String(diffText || '').split(String.fromCharCode(10));
  var wrap = el('div', 'diff-block');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var parsed = parseDiffLine(line);
    var row = el('div', 'diff-line');
    var sign = el('span', 'diff-sign');
    var gutter = el('span', 'diff-gutter');
    var content = el('span', 'diff-content');
    if (!parsed) {
      row.classList.add('context');
      sign.textContent = ' ';
      gutter.textContent = '';
      content.textContent = line;
    } else if (parsed.prefix === '+') {
      row.classList.add('added');
      sign.textContent = '+';
      gutter.textContent = parsed.lineNum.trim();
      content.textContent = parsed.content;
    } else if (parsed.prefix === '-') {
      row.classList.add('removed');
      sign.textContent = '-';
      gutter.textContent = parsed.lineNum.trim();
      content.textContent = parsed.content;
    } else if (parsed.content === '...' && parsed.lineNum.trim() === '') {
      row.classList.add('hunk');
      sign.textContent = ' ';
      gutter.textContent = '';
      content.textContent = '...';
    } else {
      row.classList.add('context');
      sign.textContent = ' ';
      gutter.textContent = parsed.lineNum.trim();
      content.textContent = parsed.content;
    }
    row.appendChild(sign);
    row.appendChild(gutter);
    row.appendChild(content);
    wrap.appendChild(row);
  }
  resultEl.appendChild(wrap);
}
function renderWriteContent(argsEl, args) {
  if (!argsEl) return;
  argsEl._piMd = null;
  argsEl.textContent = '';
  var parsed = args;
  if (typeof args === 'string') { try { parsed = JSON.parse(args); } catch (e) { parsed = null; } }
  var content = parsed && typeof parsed.content === 'string' ? parsed.content : '';
  if (!content) return;
  var lines = content.split(String.fromCharCode(10));
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (!lines.length) return;
  var wrap = el('div', 'code-block');
  var width = String(lines.length).length;
  for (var i = 0; i < lines.length; i++) {
    var numStr = String(i + 1);
    while (numStr.length < width) numStr = ' ' + numStr;
    var row = el('div', 'code-line');
    var gutter = el('span', 'code-gutter');
    gutter.textContent = numStr;
    var code = el('span', 'code-content');
    code.textContent = lines[i];
    row.appendChild(gutter);
    row.appendChild(code);
    wrap.appendChild(row);
  }
  argsEl.appendChild(wrap);
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
  if (autoScroll) scheduleScroll();
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
  b.el.classList.add('is-running');
  b.text += delta;
  if (!b._tnode) {
    b.textEl.textContent = '';
    b._tnode = document.createTextNode('');
    b.textEl.appendChild(b._tnode);
  }
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
  } else if (name === 'subagent') {
    if (args && args.tasks && args.tasks.length) {
      s = 'parallel · ' + args.tasks.length + (args.tasks.length > 1 ? ' tasks' : ' task');
    } else if (args && args.agent) {
      s = args.agent;
      var ttl = args.title ? String(args.title) : '';
      if (!ttl && args.task) ttl = args.task.length > 60 ? args.task.slice(0, 60) + '…' : args.task;
      if (ttl) s += ' · ' + ttl;
    } else {
      s = 'subagent';
    }
  }
  return s;
}

// ====== subagent rich rendering helpers ======
function formatTokens(count) {
  if (count < 1000) return count.toString();
  if (count < 10000) return (count / 1000).toFixed(1) + 'k';
  if (count < 1000000) return Math.round(count / 1000) + 'k';
  return (count / 1000000).toFixed(1) + 'M';
}
function getDisplayItems(messages) {
  var items = [];
  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    if (msg.role === 'assistant') {
      var content = msg.content;
      if (Array.isArray(content)) {
        for (var j = 0; j < content.length; j++) {
          var part = content[j];
          if (part.type === 'text') items.push({ type: 'text', text: part.text });
          else if (part.type === 'toolCall') items.push({ type: 'toolCall', name: part.name, args: part.arguments });
        }
      }
    }
  }
  return items;
}
function getFinalOutput(messages) {
  for (var i = messages.length - 1; i >= 0; i--) {
    var msg = messages[i];
    if (msg.role === 'assistant') {
      var content = msg.content;
      if (Array.isArray(content)) {
        for (var j = 0; j < content.length; j++) {
          var part = content[j];
          if (part.type === 'text') return part.text;
        }
      }
    }
  }
  return '';
}
function formatUsage(usage, model) {
  if (!usage) return '';
  var parts = [];
  if (usage.turns) parts.push(usage.turns + ' turn' + (usage.turns > 1 ? 's' : ''));
  if (usage.input) parts.push('\\u2191' + formatTokens(usage.input));
  if (usage.output) parts.push('\\u2193' + formatTokens(usage.output));
  if (usage.cacheRead) parts.push('R' + formatTokens(usage.cacheRead));
  if (usage.cacheWrite) parts.push('W' + formatTokens(usage.cacheWrite));
  if (usage.cost) parts.push('$' + usage.cost.toFixed(4));
  if (usage.contextTokens) parts.push('ctx:' + formatTokens(usage.contextTokens));
  if (model) parts.push(model);
  return parts.join(' ');
}
function computeCacheHitPct(usage) {
  if (!usage) return null;
  var cr = usage.cacheRead || 0;
  var cw = usage.cacheWrite || 0;
  if (cr <= 0 && cw <= 0) return null;
  var prompt = (usage.input || 0) + cr + cw;
  if (prompt <= 0) return null;
  return (cr / prompt) * 100;
}
function promptTokensOf(usage) {
  if (!usage) return 0;
  return (usage.input || 0) + (usage.cacheRead || 0) + (usage.cacheWrite || 0);
}
function cacheReadPricePerM() {
  var cost = state.model && state.model.cost;
  if (cost && typeof cost.cacheRead === 'number') return cost.cacheRead;
  return null;
}
function detectCacheMiss(usage, modelId, ts) {
  if (!prevTurn || !usage) return null;
  if (typeof ts === 'number' && ts === prevTurn.ts) return null;
  var promptTokens = (usage.input || 0) + (usage.cacheRead || 0) + (usage.cacheWrite || 0);
  if (promptTokens <= 0) return null;
  if (usage.cacheRead + usage.cacheWrite === 0 && !prevTurn.reportedCache) return null;
  var missedTokens = Math.min(prevTurn.promptTokens, promptTokens) - (usage.cacheRead || 0);
  if (missedTokens <= 1024) return null;
  var cost = (usage.cost && typeof usage.cost === 'object') ? usage.cost : null;
  var paidTokens = (usage.input || 0) + (usage.cacheWrite || 0);
  var paidPerToken = (cost && paidTokens > 0) ? ((cost.input || 0) + (cost.cacheWrite || 0)) / paidTokens : 0;
  var readPerToken;
  if ((usage.cacheRead || 0) > 0 && cost) {
    readPerToken = (cost.cacheRead || 0) / usage.cacheRead;
  } else {
    var price = cacheReadPricePerM();
    readPerToken = (price != null && price > 0) ? price / 1000000 : 0;
  }
  var missedCost = missedTokens * Math.max(0, paidPerToken - readPerToken);
  var showByTokens = missedTokens >= 20000;
  var showByCost = missedCost >= 0.10;
  if (!showByTokens && !showByCost) return null;
  var idleMs = (typeof ts === 'number' && typeof prevTurn.ts === 'number') ? ts - prevTurn.ts : 0;
  var modelChanged = !!modelId && !!prevTurn.modelId && modelId !== prevTurn.modelId;
  var label;
  if (modelChanged) label = 'Cache miss after model switch';
  else if (idleMs >= 300000) label = 'Cache miss after ' + Math.round(idleMs / 60000) + 'm idle';
  else label = 'Cache miss';
  return { label: label, missedTokens: missedTokens, missedCost: missedCost };
}
function recordCacheUsage(usage, modelId, ts) {
  latestCacheHitPct = computeCacheHitPct(usage);
  rebuildCtxRingTooltip();
  if (!usage) { prevTurn = null; return; }
  if (prevTurn && (typeof ts !== 'number' || ts !== prevTurn.ts)) {
    var miss = detectCacheMiss(usage, modelId, ts);
    if (miss) {
      var costStr = (miss.missedCost >= 0.01)
        ? ' (~$' + miss.missedCost.toFixed(2) + ')'
        : '';
      showToast('\\u26A0 ' + miss.label + ' \\u00B7 ' + formatTokens(miss.missedTokens) + ' tokens re-billed' + costStr, 'warning');
    }
  }
  prevTurn = {
    promptTokens: promptTokensOf(usage),
    modelId: modelId || '',
    ts: (typeof ts === 'number') ? ts : Date.now(),
    reportedCache: !!(prevTurn && prevTurn.reportedCache) || (usage.cacheRead + usage.cacheWrite > 0)
  };
}
function seedCacheBaseline(list) {
  if (!list || !list.length) return;
  for (var i = list.length - 1; i >= 0; i--) {
    var m = list[i];
    if (!m || m.role !== 'assistant' || !m.usage || m.stopReason === 'error') continue;
    var u = m.usage;
    if (!u.input && !u.output && !u.cacheRead && !u.cacheWrite) continue;
    latestCacheHitPct = computeCacheHitPct(u);
    prevTurn = {
      promptTokens: promptTokensOf(u),
      modelId: state.model ? state.model.provider + '/' + state.model.id : '',
      ts: (typeof m.timestamp === 'number') ? m.timestamp : Date.now(),
      reportedCache: (u.cacheRead + u.cacheWrite) > 0
    };
    rebuildCtxRingTooltip();
    break;
  }
}
function aggregateUsage(results) {
  var total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    total.input += r.usage.input;
    total.output += r.usage.output;
    total.cacheRead += r.usage.cacheRead;
    total.cacheWrite += r.usage.cacheWrite;
    total.cost += r.usage.cost;
    total.turns += r.usage.turns;
  }
  return total;
}
function subagentDetailsHasError(details) {
  if (!details || !details.results) return false;
  for (var i = 0; i < details.results.length; i++) {
    var r = details.results[i];
    if (!r) continue;
    if (r.errorMessage) return true;
    if (typeof r.exitCode === 'number' && r.exitCode !== -1 && r.exitCode !== 0) return true;
  }
  return false;
}
function isFailedSubagent(r) {
  if (!r) return false;
  if (r.exitCode === -1) return false;
  return r.exitCode !== 0 || r.stopReason === 'error' || r.stopReason === 'aborted';
}
function subagentTitle(r) {
  if (r && r.title) return String(r.title);
  if (r && r.task) return r.task.length > 60 ? r.task.slice(0, 60) + '…' : r.task;
  return '';
}
function renderSubMd(target, text) {
  target._piMd = text;
  try { target.innerHTML = md.render(text); } catch (e) { target.textContent = text; }
}
function renderAgentBody(parent, r) {
  var failed = isFailedSubagent(r);
  var usageStr = formatUsage(r.usage, r.model);
  if (usageStr) {
    var uDiv = el('div', 'sub-usage');
    var usageStats = formatUsage(r.usage, null);
    if (usageStats) uDiv.appendChild(document.createTextNode(usageStats + (r.model ? ' · ' : '')));
    if (r.model) {
      var mSpan = el('span', 'sub-usage-model');
      mSpan.textContent = r.model;
      uDiv.appendChild(mSpan);
    }
    parent.appendChild(uDiv);
  }
  if (r && r.task) {
    var tLabel = el('div', 'sub-section-label');
    tLabel.textContent = 'Task';
    parent.appendChild(tLabel);
    var tBody = el('div', 'sub-task-text sub-md text-block');
    renderSubMd(tBody, r.task);
    parent.appendChild(tBody);
  }
  var items = getDisplayItems(r.messages || []);
  var callItems = [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].type === 'toolCall') callItems.push(items[i]);
  }
  var hasCalls = callItems.length > 0;
  if (hasCalls) {
    var sLabel = el('div', 'sub-section-label');
    sLabel.textContent = 'Steps';
    parent.appendChild(sLabel);
    for (var i = 0; i < callItems.length; i++) {
      var cdiv = el('div', 'sub-toolcall');
      var tcName = callItems[i].name || '';
      var tcSum = formatToolSummary(tcName, callItems[i].args);
      if (!tcSum) {
        var astr = JSON.stringify(callItems[i].args || {});
        tcSum = astr.length > 50 ? astr.slice(0, 50) + '…' : astr;
      }
      cdiv.appendChild(document.createTextNode('→ '));
      var tcNameSpan = el('span', 'sub-toolcall-name');
      tcNameSpan.textContent = tcName;
      cdiv.appendChild(tcNameSpan);
      cdiv.appendChild(document.createTextNode(' ' + tcSum));
      parent.appendChild(cdiv);
    }
  }
  if (failed && r.errorMessage) {
    var errDiv = el('div', 'sub-error');
    errDiv.textContent = 'Error: ' + r.errorMessage;
    parent.appendChild(errDiv);
  }
  var final = getFinalOutput(r.messages || []);
  if (final) {
    var fLabel = el('div', 'sub-section-label');
    fLabel.textContent = 'Result';
    parent.appendChild(fLabel);
    var mdDiv = el('div', 'sub-final sub-md text-block');
    renderSubMd(mdDiv, final.trim());
    parent.appendChild(mdDiv);
  } else if (!failed && !hasCalls && !(r && r.task)) {
    var empty = el('div', 'sub-empty');
    empty.textContent = r && r.exitCode === -1 ? '(running…)' : '(no output)';
    parent.appendChild(empty);
  }
  return usageStr;
}

function renderSubagentResult(b, details) {
  if (!b || !b.resultEl) return;
  b.resultEl._piMd = null;
  if (!details || !details.results || !details.results.length) return;
  var results = details.results;
  var wrap = el('div', 'subagent-wrap');
  if (details.mode === 'single' && results.length === 1) {
    var r = results[0];
    var body = el('div', 'subagent-body');
    renderAgentBody(body, r);
    wrap.appendChild(body);
    if (b.summaryEl) {
      b.summaryEl.textContent = r.agent + (subagentTitle(r) ? ' · ' + subagentTitle(r) : '');
    }
  } else if (details.mode === 'parallel') {
    var running = 0, done = 0, fail = 0;
    for (var di = 0; di < results.length; di++) {
      if (results[di].exitCode === -1) running++;
      else { done++; if (isFailedSubagent(results[di])) fail++; }
    }
    var pic = running > 0 ? '⏳' : (fail > 0 ? '◐' : '✓');
    for (var ri = 0; ri < results.length; ri++) {
      var sr = results[ri];
      var sric = sr.exitCode === -1 ? '⏳' : (sr.exitCode === 0 ? '✓' : '✗');
      var sdet = el('details', 'sub-task');
      if (isFailedSubagent(sr)) sdet.classList.add('is-failed');
      if (sr.exitCode === -1) sdet.setAttribute('open', '');
      var shead = el('summary', 'sub-task-head');
      var sicon = el('span', 'sub-task-icon');
      sicon.textContent = sric;
      var sname = el('span', 'sub-task-agent');
      sname.textContent = sr.agent;
      shead.appendChild(sicon);
      shead.appendChild(sname);
      if (subagentTitle(sr)) {
        var stitle = el('span', 'sub-task-title');
        stitle.textContent = '· ' + subagentTitle(sr);
        shead.appendChild(stitle);
      }
      var sstatus = el('span', 'sub-task-status');
      sstatus.textContent = sr.exitCode === -1 ? 'running' : (isFailedSubagent(sr) ? 'failed' : 'done');
      shead.appendChild(sstatus);
      sdet.appendChild(shead);
      var sbody = el('div', 'sub-task-body');
      renderAgentBody(sbody, sr);
      sdet.appendChild(sbody);
      wrap.appendChild(sdet);
    }
    var tu = aggregateUsage(results);
    var tus = formatUsage(tu);
    if (tus) {
      var tud = el('div', 'sub-total');
      tud.textContent = 'Total: ' + tus;
      wrap.appendChild(tud);
    }
    if (b.summaryEl) {
      b.summaryEl.textContent = pic + ' parallel · ' + done + '/' + results.length + (running > 0 ? ' running' : (fail > 0 ? ' (' + fail + ' failed)' : ' done'));
    }
  } else {
    return;
  }
  b.resultEl.textContent = '';
  b.resultEl.appendChild(wrap);
}
function applyToolSummary(b, name, args) {
  if (!b || !b.summaryEl) return;
  var parsed = args;
  if (typeof args === 'string') { try { parsed = JSON.parse(args); } catch (e) { parsed = null; } }
  b.summaryEl.textContent = formatToolSummary(name || b.name || '', parsed);
}
function expandHomePath(p) {
  if (typeof p !== 'string' || !p) return '';
  if (p.charAt(0) === '~' && (p.length === 1 || p.charAt(1) === PI_SEP)) {
    return (PI_HOME || '') + p.slice(1);
  }
  return p;
}
function applyToolFileTarget(b, name, args) {
  if (!b || !b.el) return;
  b.filePath = null;
  b.fileLine = null;
  b.el.removeAttribute('data-has-file');
  if (!args) return;
  var parsed = args;
  if (typeof args === 'string') { try { parsed = JSON.parse(args); } catch (e) { parsed = null; } }
  if (!parsed || typeof parsed !== 'object') return;
  if (name !== 'read' && name !== 'write' && name !== 'edit') return;
  var fp = parsed.file_path != null ? parsed.file_path : parsed.path;
  if (typeof fp !== 'string' || !fp) return;
  fp = expandHomePath(fp);
  if (!fp) return;
  b.filePath = fp;
  if (name === 'read' && parsed.offset != null) {
    var ln = parseInt(parsed.offset, 10);
    if (!isNaN(ln) && ln > 0) b.fileLine = ln;
  }
  b.el.setAttribute('data-has-file', '');
}
function finalizeToolCall(ci, toolCall) {
  var b = ensureBlock(ci, 'toolcall');
  if (toolCall) {
    if (toolCall.name) {
      b.name = toolCall.name;
      b.nameEl.textContent = toolCall.name;
      if (b.name === 'subagent') b.el.classList.add('is-subagent');
    }
    if (toolCall.id) { b.toolCallId = toolCall.id; b.el.setAttribute('data-tcid', toolCall.id); }
    var args = toolCall.arguments;
    if (args !== undefined && args !== null) {
      b.argsText = typeof args === 'string' ? args : JSON.stringify(args, null, 2);
      b._anode = null;
      if (b.name === 'write') renderWriteContent(b.argsEl, args);
      else if (b.name === 'subagent') b.argsEl.textContent = '';
      else setClamped(b.argsEl, b.argsText);
    }
    applyToolSummary(b, b.name, args);
    applyToolFileTarget(b, b.name, args);
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
  if (ev.toolName) { b.name = ev.toolName; b.nameEl ? (b.nameEl.textContent = ev.toolName) : null; if (b.name === 'subagent') b.el.classList.add('is-subagent'); }
  b.el._block = b;
  if (b.statusEl) { b.statusEl.textContent = ''; b.statusEl.classList.add('is-running'); }
  if (ev.args !== undefined && ev.args !== null && b.argsEl && !b.argsText) {
    b.argsText = typeof ev.args === 'string' ? ev.args : JSON.stringify(ev.args, null, 2);
    b._anode = null;
    if (b.name !== 'subagent') setClamped(b.argsEl, b.argsText);
  }
  applyToolSummary(b, b.name, ev.args);
  applyToolFileTarget(b, b.name, ev.args);
  scheduleScroll();
}
function updateToolExecution(ev) {
  var b = findToolBlock(ev.toolCallId);
  if (!b || !b.resultEl) return;
  var pr = ev.partialResult;
  if (!pr) return;
  if (b.name === 'subagent' && pr.details) {
    renderSubagentResult(b, pr.details);
    return;
  }
  if (pr.content) {
    var txt = extractToolResultText(pr.content);
    if (txt) setClamped(b.resultEl, txt);
    else b.resultEl.textContent = '';
    appendToolResultImages(b.resultEl, pr.content);
  }
}
function endToolExecution(ev) {
  var b = findToolBlock(ev.toolCallId);
  if (!b) return;
  if (b.statusEl) { b.statusEl.textContent = ev.isError ? 'error' : 'done'; b.statusEl.classList.remove('is-running'); }
  if (ev.isError) b.el.classList.add('is-error');
  var r = ev.result;
  if (b.name === 'subagent' && r && r.details) {
    renderSubagentResult(b, r.details);
    if (!ev.isError && subagentDetailsHasError(r.details)) {
      if (b.statusEl) { b.statusEl.textContent = 'error'; b.statusEl.classList.remove('is-running'); }
      b.el.classList.add('is-error');
    }
    if (!b.el._userToggled) b.el.removeAttribute('open');
    scheduleScroll();
    return;
  }
  if (b.name === 'edit' && !ev.isError && r && r.details && typeof r.details.diff === 'string') {
    b.el.classList.add('is-diff');
    renderToolDiff(b.resultEl, r.details.diff);
    scheduleScroll();
    return;
  }
  if (b.name === 'write' && !ev.isError) {
    if (b.resultEl) { b.resultEl._piMd = null; b.resultEl.textContent = ''; }
    if (!b.el._userToggled) b.el.removeAttribute('open');
    scheduleScroll();
    return;
  }
  b.el.classList.remove('is-diff');
  if (r && r.content && b.resultEl) {
    var txt = extractToolResultText(r.content);
    if (txt) setClamped(b.resultEl, txt);
    else b.resultEl.textContent = '';
    appendToolResultImages(b.resultEl, r.content);
  }
  if (!b.el._userToggled) b.el.removeAttribute('open');
  scheduleScroll();
}

var isHydrating = false;
// ---- hydrate from get_messages ----
function hydrateMessages(list) {
  messagesEl.innerHTML = '';
  pendingCompactionBlock = null;
  pendingBtwBlock = null;
  btwAbortId = null;
  btwStatusActive = false;
  state.isBtwLoading = false;
  currentAssistant = null;
  pendingTexts = [];
  prevTurn = null;
  latestCacheHitPct = null;
  sessionCost = null;
  if (!list || !list.length) {
    clearMessages();
    rebuildCtxRingTooltip();
    isHydrating = false;
    return;
  }
  isHydrating = true;
  setStatus('Loading history...');
  var i = 0;
  var CHUNK = 8;
  function step() {
    var end = Math.min(i + CHUNK, list.length);
    for (; i < end; i++) hydrateOne(list[i]);
    if (i < list.length) requestAnimationFrame(step);
    else { isHydrating = false; setStatus(''); scrollToBottom(); seedCacheBaseline(list); }
  }
  requestAnimationFrame(step);
}
function hydrateOne(m) {
  if (!m || typeof m !== 'object') return;
  var role = m.role;
  if (role === 'user') {
    var utext = extractText(m.content);
    pushHistory(utext);
    var ub = addUserMessage(utext, extractImages(m.content));
    if (m && m.timestamp != null) applyUserBubbleTime(ub, m.timestamp);
  } else if (role === 'assistant') {
    startAssistantMessage(m.timestamp);
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
    var evResult = { content: m.content };
    if (m.details) evResult.details = m.details;
    var fakeEv = { toolCallId: m.toolCallId, result: evResult, isError: !!m.isError };
    endToolExecution(fakeEv);
  } else if (role === 'compactionSummary') {
    addCompactionMessage(m);
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
function extractImages(content) {
  var imgs = [];
  if (Array.isArray(content)) {
    for (var i = 0; i < content.length; i++) {
      var c = content[i];
      if (c && c.type === 'image' && c.data && c.mimeType) imgs.push({ type: 'image', data: c.data, mimeType: c.mimeType });
    }
  }
  return imgs;
}

// ---- event dispatch ----
function handleAssistantMessageEvent(amev) {
  if (!amev || typeof amev !== 'object') return;
  var t = amev.type;
  var ci = amev.contentIndex || 0;
  if (t === 'text_start') { collapseThinking(); ensureBlock(ci, 'text'); }
  else if (t === 'text_delta') { appendTextDelta(ci, amev.delta || ''); }
  else if (t === 'thinking_start') { var tb = ensureBlock(ci, 'thinking'); tb.el.classList.add('is-running'); }
  else if (t === 'thinking_delta') { appendThinkingDelta(ci, amev.delta || ''); }
  else if (t === 'toolcall_start') { collapseThinking(); var tcb = ensureBlock(ci, 'toolcall'); if (tcb.statusEl) { tcb.statusEl.textContent = ''; tcb.statusEl.classList.add('is-running'); } }
  else if (t === 'toolcall_delta') { appendToolCallDelta(ci, amev.delta || ''); }
  else if (t === 'toolcall_end') { finalizeToolCall(ci, amev.toolCall); }
}
function handleEvent(event) {
  if (!event || typeof event !== 'object') return;
  switch (event.type) {
    case 'agent_start': setStreaming(true); break;
    case 'agent_settled': setStreaming(false); retryAttempt = 0; break;
    case 'message_start':
      if (event.message && event.message.role === 'assistant') startAssistantMessage(event.message.timestamp);
      else if (event.message && event.message.role === 'user') {
        if (lastUserBubble && lastUserBubble._piTs == null) {
          if (event.message.timestamp != null) applyUserBubbleTime(lastUserBubble, event.message.timestamp);
        } else {
          var ub = addUserMessage(extractText(event.message.content));
          if (event.message.timestamp != null) applyUserBubbleTime(ub, event.message.timestamp);
        }
      }
      break;
    case 'message_end':
      if (event.message && event.message.role === 'assistant') {
        var amsg = event.message;
        var asr = amsg.stopReason;
        applyAssistantStopError(asr, amsg.errorMessage, retryAttempt);
        endAssistantMessage();
        if (asr && asr !== 'error') {
          retryAttempt = 0;
          recordCacheUsage(
            amsg.usage,
            state.model ? state.model.provider + '/' + state.model.id : '',
            amsg.timestamp
          );
        }
      }
      break;
    case 'message_update': handleAssistantMessageEvent(event.assistantMessageEvent); break;
    case 'tool_execution_start': startToolExecution(event); break;
    case 'tool_execution_update': updateToolExecution(event); break;
    case 'tool_execution_end': endToolExecution(event); break;
    case 'compaction_start': setStatus('Compacting\u2026'); addCompactionPlaceholder(); break;
    case 'compaction_end':
      hideToast();
      setStatus('');
      if (d.aborted || d.errorMessage) {
        if (pendingCompactionBlock) { pendingCompactionBlock.remove(); pendingCompactionBlock = null; }
        if (d.errorMessage) showToast(d.errorMessage, 'error');
      }
      break;
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
function modelLabel(m) {
  return (m.name || m.id) + (m.provider ? ' [' + m.provider + ']' : '');
}
var modelMeasurer = document.createElement('span');
modelMeasurer.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-family:var(--vscode-font-family);font-size:12px;';
document.body.appendChild(modelMeasurer);
function fitSelectToText(sel, extra) {
  var opt = sel.options[sel.selectedIndex];
  if (!opt) return;
  modelMeasurer.textContent = opt.textContent || opt.value || '';
  sel.style.width = (modelMeasurer.offsetWidth + extra) + 'px';
}
function fitModelSelect() { fitSelectToText(modelSelect, 34); }
function fitThinkingSelect() { fitSelectToText(thinkingSelect, 34); }
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
});
thinkingSelect.addEventListener('change', function() {
  vscode.postMessage({ type: 'setThinking', level: thinkingSelect.value });
  fitThinkingSelect();
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
function showTooltip(target, text) {
  if (!text) return;
  ctxTooltip.textContent = text;
  ctxTooltip.style.display = 'block';
  var r = target.getBoundingClientRect();
  ctxTooltip.style.left = (r.left + r.width / 2 - ctxTooltip.offsetWidth / 2) + 'px';
  ctxTooltip.style.top = (r.top - ctxTooltip.offsetHeight - 6) + 'px';
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
messagesEl.addEventListener('mouseover', function(ev) {
  var head = toolHeadOfFile(ev.target);
  if (head) showTooltip(head, OPEN_FILE_HINT);
});
messagesEl.addEventListener('mouseout', function(ev) {
  if (toolHeadOfFile(ev.target) && !toolHeadOfFile(ev.relatedTarget)) hideTooltip();
});

document.addEventListener('keydown', function(e) { if (e.ctrlKey || e.metaKey) document.body.classList.add('ctrl-key'); });
document.addEventListener('keyup', function(e) { if (!e.ctrlKey && !e.metaKey) document.body.classList.remove('ctrl-key'); });
window.addEventListener('blur', function() { document.body.classList.remove('ctrl-key'); });

autoGrow();
updateSendButton();
applyContextUsage(null);
clearMessages();
</script>
</body></html>`;
}
