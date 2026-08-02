export function getChatHtmlTemplate(): string {
  return /* html */ `<body>
<div class="app">
  <div class="toolbar">
    <span class="session-info" id="session-info"></span>
    <input id="name-input" class="name-input" type="text" style="display:none" />
    <span class="status" id="status"></span>
    <button id="name-btn" class="icon-btn" type="button"></button>
    <button id="info-btn" class="icon-btn" type="button"></button>
    <button id="refresh-btn" class="icon-btn" type="button"></button>
  </div>
  <div class="messages-wrap">
    <div class="messages" id="messages"><div class="messages-inner" id="messages-inner"></div></div>
    <button class="scroll-bottom-btn" id="scroll-bottom-btn" type="button" title="Scroll to bottom"><span class="codicon codicon-chevron-down"></span></button>
  </div>
  <div id="rewind-widget" class="rewind-widget" style="display:none"></div>
  <div id="widget" class="widget" style="display:none"></div>
  <div id="queue" class="queue" style="display:none"></div>
  <div class="composer">
    <div class="autocomplete" id="autocomplete" style="display:none"></div>
    <div class="composer-box">
      <div class="attach-preview" id="attach-preview" style="display:none"></div>
      <textarea id="input" rows="1" placeholder="Ask anything\u2026  (use / for commands, @ for files)"></textarea>
      <div class="composer-controls-bar">
        <button id="attach-btn" class="icon-btn" type="button" title="Add file or folder"></button>
        <div class="select-wrap permission-wrap"><span class="codicon permission-icon" id="permission-icon"></span><select id="permission-select" class="select-borderless permission-select" title="Permission mode"></select></div>
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
<div class="ctx-menu" id="ctx-menu" style="display:none"><button class="ctx-item" id="ctx-copy" type="button">Copy</button><button class="ctx-item" id="ctx-fork" type="button">Fork from here</button><button class="ctx-item" id="ctx-revert" type="button">Revert here</button></div>`;
}
