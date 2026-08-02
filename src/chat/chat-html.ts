// ---- Architecture overview ----
//
// This file is the entry point for the chat **webview** panel.
// It assembles a complete HTML page — CSS + DOM + JS — from individual
// modules, each returning a string fragment.
//
// The generated page runs in a VS Code WebviewPanel and communicates
// with the extension host exclusively via `acquireVsCodeApi().postMessage()`.
// No DOM-script injection, no eval — everything is inline at build time.
//
// ---- Data flow ----
//
//   Extension host (chat-panel.ts)  <--postMessage-->  Webview (this page)
//         |                                                 |
//         |-- state, models, commands, sessionInfo          |-- prompt, dialogResponse, copy
//         |-- event (agent_start, message_update, ...)      |-- setModel, setThinking, abort
//         |-- messages (get_messages result)                |-- searchFiles, pickResource, openFile
//         |-- widget, contextUsage, toast, dialog           |-- todoClear, reload, fork, revert
//         |-- files (search results), pickedResources       |
//         |-- prefillInput, btwAbortReady                   |
//
// ---- Rendering pipeline ----
//
//   getChatHtml(home, sep, fontSize)
//     ├── getChatCss(fontSize)        → <style>...</style>
//     ├── getChatHtmlTemplate()       → <body> + DOM skeleton
//     ├── mditSrc (raw import)        → vendor/markdown-it.min.js
//     ├── getCoreJs(home, sep)        → JS: state, DOM refs, helpers, scroll, widget, queue
//     ├── getMessagesJs()             → JS: message DOM, tool rendering, hydrate, events
//     └── getComposerJs()             → JS: controls, autocomplete, send, dialog, wire-up
//
// ---- Module responsibilities ----
//
//   chat-css.ts
//     All CSS styles. Accepts `fontSize` to set `--chat-fs` CSS variable.
//     The rest of the layout uses this variable for relative sizing.
//
//   chat-html-template.ts
//     Static DOM skeleton: toolbar, messages container, composer,
//     autocomplete dropdown, overlay, toast, context menu.
//     Elements are referenced by `id` in the JS modules.
//
//   chat-js/core.ts
//     - acquireVsCodeApi() + markdown-it init
//     - Global state: models, thinkingLevels, commands, inputHistory, pendingImages
//     - SVG icon constants (ICON_PLUS, ICON_SEND, etc.)
//     - DOM element references (messagesEl, inputEl, sendBtn, etc.)
//     - Helper functions: el(), formatTime()
//     - Scroll management: auto-scroll, stick-to-bottom, scroll button
//     - Context ring: token usage display with tooltip
//     - Set status, update send button, streaming state
//     - Widget: todo-list rendering (+ live stats, clear button)
//     - Queue: steering / follow-up item display
//
//   chat-js/messages.ts
//     - Message DOM construction: user bubbles, assistant blocks
//     - Thinking block (collapsible <details> with spinner)
//     - Compaction summary / BTW (back-to-work) rendering
//     - Text/thinking/toolCall delta streaming via appendData()
//     - Tool call rendering: bash, read, write, edit, subagent, todo
//     - Diff rendering (edit tool), code block (write tool), subagent task tree
//     - Tool execution lifecycle: start, update (partial), end (final)
//     - hydrateMessages(): batch-render a full conversation on restore
//     - handleEvent(): dispatches agent_start/settled, message_start/end,
//       message_update, tool_execution_*, compaction_*, auto_retry_*, queue_update
//     - Cache miss detection: computes cache hit % and warns on large misses
//
//   chat-js/composer.ts
//     - Model/thinking level select rendering and fit-to-text
//     - Autocomplete: slash commands (/) and file search (@) with fuzzy scoring
//     - Send: isLocalCommand() check, sendPrompt() with steer/followUp
//     - Input history navigation (ArrowUp/Down)
//     - Image attachment: paste, drag-drop, pick resource, preview thumbnails
//     - Context menu: copy / fork / revert on right-click
//     - Dialog: tool approval (confirm, select, input, questionnaire form)
//     - Toast notifications, info panel overlay
//     - Tooltip: context ring, model name, file open hint (Ctrl+Click)
//     - Wire-up: all event listeners, window.addEventListener('message')
//     - Initialization: autoGrow, updateSendButton, applyContextUsage(null), clearMessages

import mditSrc from "./vendor/markdown-it.min.js?raw";
import { getChatCss } from "./chat-css.ts";
import { getChatHtmlTemplate } from "./chat-html-template.ts";
import { getCoreJs } from "./chat-js/core.ts";
import { getMessagesJs } from "./chat-js/messages.ts";
import { getComposerJs } from "./chat-js/composer.ts";
import { getRewindJs } from "./chat-js/rewind.ts";

export function getChatHtml(home?: string, sep?: string, fontSize?: number): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en" style="height:100%;margin:0;padding:0">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${getChatCss(fontSize)}
</head>
${getChatHtmlTemplate()}
<script>
// ---- markdown-it (vendored, loaded via ?raw) ----
${mditSrc}
</script>
<script>
// ---- core: state, DOM refs, helpers, scroll, widget, queue ----
${getCoreJs(home, sep)}

// ---- messages: message DOM, tool rendering, hydrate, events ----
${getMessagesJs()}

// ---- composer: controls, autocomplete, send, dialog, wire-up ----
${getComposerJs()}

// ---- rewind: widget, per-message actions, rewind dialog ----
${getRewindJs()}
</script>
</body></html>`;
}
