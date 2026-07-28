/**
 * Todo Extension - Demonstrates state management via session entries
 *
 * This extension:
 * - Registers a `todo` tool for the LLM to manage todos (batch operations)
 * - Registers a `/todos` command for users to view the list
 * - Renders a live todo list widget above the input editor, kept in sync
 *   with the session state.
 *
 * State is stored in tool result details (not external files), which allows
 * proper branching - when you branch, the todo state is automatically
 * correct for that point in history.
 */

import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, Text, truncateToWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

interface TodoResult {
  ok: boolean;
  id?: number;
  text?: string;
  done?: boolean;
  message?: string;
}

interface TodoDetails {
  action: "list" | "add" | "toggle" | "clear";
  todos: Todo[];
  nextId: number;
  error?: string;
  results?: TodoResult[];
}

interface TodoState {
  todos: Todo[];
  nextId: number;
}

interface TodoArgs {
  action: "list" | "add" | "toggle" | "clear";
  texts?: string[];
  ids?: number[];
}

type TextBlock = { type: "text"; text: string };

interface TodoActionResult {
  content: TextBlock[];
  details: TodoDetails;
}

const textBlock = (s: string): TextBlock => ({ type: "text" as const, text: s });

const TodoParams = Type.Object({
  action: StringEnum(["list", "add", "toggle", "clear"] as const),
  texts: Type.Optional(Type.Array(Type.String(), { description: "Todo texts (for add, >=1)" })),
  ids: Type.Optional(Type.Array(Type.Number(), { description: "Todo IDs (for toggle, >=1)" })),
});

const WIDGET_KEY = "todo-list";
const CLEAR_TYPE = "todo-clear";

function listTodos(state: TodoState): TodoActionResult {
  const { todos } = state;
  return {
    content: [
      textBlock(
        todos.length
          ? todos.map((t) => `[${t.done ? "x" : " "}] #${t.id}: ${t.text}`).join("\n")
          : "No todos",
      ),
    ],
    details: { action: "list", todos: [...todos], nextId: state.nextId },
  };
}

function addTodos(texts: string[] | undefined, state: TodoState): TodoActionResult {
  if (!texts || texts.length === 0) {
    return {
      content: [textBlock("Error: texts required (non-empty) for add")],
      details: {
        action: "add",
        todos: [...state.todos],
        nextId: state.nextId,
        error: "texts required (non-empty)",
      },
    };
  }
  const results: TodoResult[] = [];
  for (const text of texts) {
    const todo: Todo = { id: state.nextId++, text, done: false };
    state.todos.push(todo);
    results.push({ ok: true, id: todo.id, text });
  }
  const summary = results.map((r) => `#${r.id} ${r.text}`).join(", ");
  return {
    content: [textBlock(`Added ${results.length}: ${summary}`)],
    details: { action: "add", todos: [...state.todos], nextId: state.nextId, results },
  };
}

function toggleTodos(ids: number[] | undefined, state: TodoState): TodoActionResult {
  if (!ids || ids.length === 0) {
    return {
      content: [textBlock("Error: ids required (non-empty) for toggle")],
      details: {
        action: "toggle",
        todos: [...state.todos],
        nextId: state.nextId,
        error: "ids required (non-empty)",
      },
    };
  }
  const results: TodoResult[] = [];
  for (const id of ids) {
    const todo = state.todos.find((t) => t.id === id);
    if (!todo) {
      results.push({ ok: false, id, message: `#${id} not found` });
      continue;
    }
    todo.done = !todo.done;
    results.push({ ok: true, id: todo.id, done: todo.done });
  }
  const toggledOk = results.filter((r) => r.ok).length;
  const toggleSummary = results
    .map((r) => (r.ok ? `#${r.id}${r.done ? "✓" : "○"}` : `#${r.id}✗(${r.message})`))
    .join(", ");
  if (state.todos.length > 0 && state.todos.every((t) => t.done)) {
    const count = state.todos.length;
    state.todos = [];
    state.nextId = 1;
    return {
      content: [
        textBlock(
          `Toggled ${toggledOk}: ${toggleSummary}\n${count} todos completed! Auto-cleared.`,
        ),
      ],
      details: { action: "clear", todos: [], nextId: 1, results },
    };
  }
  return {
    content: [textBlock(`Toggled ${toggledOk}: ${toggleSummary}`)],
    details: { action: "toggle", todos: [...state.todos], nextId: state.nextId, results },
  };
}

function clearTodos(state: TodoState): TodoActionResult {
  const count = state.todos.length;
  state.todos = [];
  state.nextId = 1;
  return {
    content: [textBlock(`Cleared ${count} todos`)],
    details: { action: "clear", todos: [], nextId: 1 },
  };
}

function executeTodo(params: TodoArgs, state: TodoState): TodoActionResult {
  switch (params.action) {
    case "list":
      return listTodos(state);
    case "add":
      return addTodos(params.texts, state);
    case "toggle":
      return toggleTodos(params.ids, state);
    case "clear":
      return clearTodos(state);
  }
}

/**
 * Render the current todo list as styled lines for the editor widget.
 * Returns an empty array when there are no todos (widget is hidden).
 */
function renderTodoLines(todos: Todo[], theme: Theme, width: number): string[] {
  if (todos.length === 0) return [];

  const done = todos.filter((t) => t.done).length;
  const total = todos.length;
  const lines: string[] = [];

  const title = theme.fg("accent", theme.bold("Todos"));
  const stats = theme.fg("muted", `${done}/${total} done`);
  lines.push(truncateToWidth(`${title}  ${stats}`, width));

  for (const todo of todos) {
    const check = todo.done ? theme.fg("success", "✓") : theme.fg("dim", "○");
    const id = theme.fg("accent", `#${todo.id}`);
    const text = todo.done ? theme.fg("dim", todo.text) : theme.fg("text", todo.text);
    lines.push(truncateToWidth(`  ${check} ${id} ${text}`, width));
  }
  return lines;
}

function renderTodoLinesPlain(todos: Todo[]): string[] {
  if (todos.length === 0) return [];

  const done = todos.filter((t) => t.done).length;
  const total = todos.length;
  const lines: string[] = [];

  lines.push(`Todos  ${done}/${total} done`);
  for (const todo of todos) {
    const check = todo.done ? "✓" : "○";
    lines.push(`  ${check} #${todo.id} ${todo.text}`);
  }
  return lines;
}

function renderTodoCall(args: TodoArgs, theme: Theme): Text {
  let text = theme.fg("toolTitle", theme.bold("todo ")) + theme.fg("muted", args.action);
  const append = (items: string[], total: number, more: (n: number) => string) => {
    text += " " + items.join(" ");
    if (total > 5) text += " " + theme.fg("dim", more(total - 5));
  };
  if (args.texts && args.texts.length > 0) {
    append(
      args.texts.slice(0, 5).map((t) => theme.fg("dim", `"${t}"`)),
      args.texts.length,
      (n) => `… +${n}`,
    );
  }
  if (args.ids && args.ids.length > 0) {
    append(
      args.ids.slice(0, 5).map((id) => theme.fg("accent", `#${id}`)),
      args.ids.length,
      (n) => `… +${n}`,
    );
  }
  return new Text(text, 0, 0);
}

function renderTodoResult(
  result: { content: { type: string; text?: string }[]; details?: unknown },
  expanded: boolean,
  theme: Theme,
): Text {
  const details = result.details as TodoDetails | undefined;
  if (!details) {
    return new Text(result.content[0]?.text ?? "", 0, 0);
  }
  if (details.error) {
    return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
  }

  const todoList = details.todos;
  const preview = <T>(items: T[]) => (expanded ? items : items.slice(0, 5));
  const more = (n: number) => `\n${theme.fg("dim", `... ${n} more`)}`;

  switch (details.action) {
    case "list": {
      if (todoList.length === 0) return new Text(theme.fg("dim", "No todos"), 0, 0);
      let listText = theme.fg("muted", `${todoList.length} todo(s):`);
      for (const t of preview(todoList)) {
        const check = t.done ? theme.fg("success", "✓") : theme.fg("dim", "○");
        const itemText = t.done ? theme.fg("dim", t.text) : theme.fg("muted", t.text);
        listText += `\n${check} ${theme.fg("accent", `#${t.id}`)} ${itemText}`;
      }
      if (!expanded && todoList.length > 5) listText += more(todoList.length - 5);
      return new Text(listText, 0, 0);
    }
    case "add": {
      const results = details.results ?? [];
      if (results.length === 0) return new Text(result.content[0]?.text ?? "", 0, 0);
      let addText = theme.fg("muted", `Added ${results.length}:`);
      for (const r of preview(results)) {
        addText += `\n${theme.fg("success", "✓")} ${theme.fg("accent", `#${r.id}`)} ${theme.fg("muted", r.text ?? "")}`;
      }
      if (!expanded && results.length > 5) addText += more(results.length - 5);
      return new Text(addText, 0, 0);
    }
    case "toggle": {
      const results = details.results ?? [];
      if (results.length === 0) {
        return new Text(
          theme.fg("success", "✓ ") + theme.fg("muted", result.content[0]?.text ?? ""),
          0,
          0,
        );
      }
      const okCount = results.filter((r) => r.ok).length;
      let toggleText = theme.fg("muted", `Toggled ${okCount}/${results.length}:`);
      for (const r of preview(results)) {
        if (r.ok) {
          const mark = r.done ? theme.fg("success", "✓") : theme.fg("dim", "○");
          toggleText += `\n${mark} ${theme.fg("accent", `#${r.id}`)} ${theme.fg("muted", r.done ? "completed" : "uncompleted")}`;
        } else {
          toggleText += `\n${theme.fg("error", "✗")} ${theme.fg("accent", `#${r.id}`)} ${theme.fg("dim", r.message ?? "")}`;
        }
      }
      if (!expanded && results.length > 5) toggleText += more(results.length - 5);
      return new Text(toggleText, 0, 0);
    }
    case "clear": {
      if (details.results && details.results.length > 0) {
        return new Text(result.content[0]?.text ?? "", 0, 0);
      }
      return new Text(theme.fg("success", "✓ ") + theme.fg("muted", "Cleared all todos"), 0, 0);
    }
  }
}

/**
 * UI component for the /todos command
 */
class TodoListComponent {
  private todos: Todo[];
  private theme: Theme;
  private onClose: () => void;
  private onClear: () => void;
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(todos: Todo[], theme: Theme, onClose: () => void, onClear: () => void) {
    this.todos = todos;
    this.theme = theme;
    this.onClose = onClose;
    this.onClear = onClear;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.onClose();
    } else if (matchesKey(data, Key.ctrl("x"))) {
      this.onClear();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines: string[] = [];
    const th = this.theme;

    lines.push("");
    const title = th.fg("accent", " Todos ");
    const headerLine =
      th.fg("borderMuted", "─".repeat(3)) +
      title +
      th.fg("borderMuted", "─".repeat(Math.max(0, width - 10)));
    lines.push(truncateToWidth(headerLine, width));
    lines.push("");

    if (this.todos.length === 0) {
      lines.push(
        truncateToWidth(`  ${th.fg("dim", "No todos yet. Ask the agent to add some!")}`, width),
      );
    } else {
      const done = this.todos.filter((t) => t.done).length;
      const total = this.todos.length;
      lines.push(truncateToWidth(`  ${th.fg("muted", `${done}/${total} completed`)}`, width));
      lines.push("");

      for (const todo of this.todos) {
        const check = todo.done ? th.fg("success", "✓") : th.fg("dim", "○");
        const id = th.fg("accent", `#${todo.id}`);
        const text = todo.done ? th.fg("dim", todo.text) : th.fg("text", todo.text);
        lines.push(truncateToWidth(`  ${check} ${id} ${text}`, width));
      }
    }

    lines.push("");
    lines.push(
      truncateToWidth(
        `  ${th.fg("dim", "Ctrl+X clear all")}  ${th.fg("dim", "•")}  ${th.fg("dim", "Esc close")}`,
        width,
      ),
    );
    lines.push("");

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

export default function (pi: ExtensionAPI) {
  const state: TodoState = { todos: [], nextId: 1 };

  const disabledTools = (() => {
    try {
      const parsed = JSON.parse(process.env.PI_VSCODE_DISABLED_TOOLS ?? "[]");
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  })();

  /**
   * Reconstruct state from session entries.
   * Scans tool results for this tool and applies them in order.
   */
  const reconstructState = (ctx: ExtensionContext) => {
    state.todos = [];
    state.nextId = 1;

    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "custom") {
        if (entry.customType === CLEAR_TYPE) {
          state.todos = [];
          state.nextId = 1;
        }
        continue;
      }
      if (entry.type !== "message") continue;
      const msg = entry.message;
      if (msg.role !== "toolResult" || msg.toolName !== "todo") continue;

      const details = msg.details as TodoDetails | undefined;
      if (details) {
        state.todos = details.todos;
        state.nextId = details.nextId;
      }
    }
  };

  /**
   * Sync the editor widget (todo list above input) with the current
   * in-memory state. No-op outside TUI mode.
   */
  const updateTodoWidget = (ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    if (state.todos.length === 0) {
      ctx.ui.setWidget(WIDGET_KEY, undefined);
      return;
    }

    if (ctx.mode === "rpc") {
      ctx.ui.setWidget(WIDGET_KEY, renderTodoLinesPlain(state.todos));
      return;
    }

    // Component factory so the TUI passes the current width on each render;
    // todos are captured by reference and re-read, so toggles reflect live.
    ctx.ui.setWidget(WIDGET_KEY, (_tui, th) => ({
      render: (w: number) => renderTodoLines(state.todos, th, w),
      invalidate: () => {},
    }));
  };

  const clearAllTodos = (ctx: ExtensionContext) => {
    const count = state.todos.length;
    state.todos = [];
    state.nextId = 1;
    pi.appendEntry(CLEAR_TYPE, { cleared: count });
    updateTodoWidget(ctx);
  };

  // Reconstruct state on session events
  pi.on("session_start", async (_event, ctx) => {
    reconstructState(ctx);
    updateTodoWidget(ctx);
  });
  pi.on("session_tree", async (_event, ctx) => {
    reconstructState(ctx);
    updateTodoWidget(ctx);
  });

  // Register the todo tool for the LLM
  if (!disabledTools.includes("todo"))
    pi.registerTool({
      name: "todo",
      label: "Todo",
      description:
        "Manage a todo list (batch). Actions: list, add (texts[]), toggle (ids[]), clear. Empty arrays error; toggle flips done; auto-clears when all done.",
      parameters: TodoParams,

      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const result = executeTodo(params, state);
        updateTodoWidget(ctx);
        return result;
      },

      renderCall(args, theme, _context) {
        return renderTodoCall(args, theme);
      },

      renderResult(result, { expanded }, theme, _context) {
        return renderTodoResult(result, expanded, theme);
      },
    });

  // Register the /todos command for users
  pi.registerCommand("todos", {
    description: "Show all todos on the current branch",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") return;

      await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
        const onClose = () => done();
        const onClear = () => {
          clearAllTodos(ctx);
          done();
        };
        return new TodoListComponent(state.todos, theme, onClose, onClear);
      });
    },
  });

  pi.registerCommand("todo-clear", {
    description: "Clear all todos",
    handler: async (_args, ctx) => {
      clearAllTodos(ctx);
    },
  });
}
