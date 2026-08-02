export const TERMINAL_TITLE = "PI Code";

export const BRIDGE_EXTENSION_PATH = "bridge/pi-vscode-bridge.js";
export const BTW_EXTENSION_PATH = "bridge/btw.ts";
export const TODO_EXTENSION_PATH = "bridge/todo.ts";
export const PERMISSION_GATE_EXTENSION_PATH = "bridge/permission-gate.ts";
export const QUESTIONNAIRE_EXTENSION_PATH = "bridge/questionnaire.ts";
export const SUBAGENT_EXTENSION_PATH = "bridge/subagent/index.ts";
export const REWIND_CODE_EXTENSION_PATH = "bridge/rewind-code.ts";
export const BUILTIN_AGENTS_DIR = "bridge/agents";

export const BRIDGE_BOOTSTRAP_PROMPT =
  "You are running inside VS Code with a live IDE bridge. Prefer VS Code bridge tools over manual file reads or guesses: use them to get editor state, selection, diagnostics, symbols, definitions, hovers, references, code actions, workspace symbols, and open editors. After edits, check **vscode_get_diagnostics** for real-time type/lint errors from the IDE instead of running separate commands.";
