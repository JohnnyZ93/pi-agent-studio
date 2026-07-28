/**
 * Questionnaire Tool - Unified tool for asking single or multiple questions
 *
 * Single question: simple options list
 * Multiple questions: tab bar navigation between questions
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
  Text,
  truncateToWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";

// Types
interface QuestionOption {
  label: string;
  description?: string;
}

type RenderOption = QuestionOption & { isOther?: boolean };

interface Question {
  id: string;
  label: string;
  prompt: string;
  options: QuestionOption[];
  allowOther: boolean;
}

interface Answer {
  id: string;
  value: string;
  label: string;
  wasCustom: boolean;
  index?: number;
}

interface QuestionnaireResult {
  questions: Question[];
  answers: Answer[];
  cancelled: boolean;
}

// Schema
const QuestionOptionSchema = Type.Object({
  label: Type.String({ description: "Display label for the option" }),
  description: Type.Optional(
    Type.String({ description: "Optional description shown below label" }),
  ),
});

const QuestionSchema = Type.Object({
  id: Type.String({ description: "Unique identifier for this question" }),
  label: Type.Optional(
    Type.String({
      description:
        "Short contextual label for tab bar, e.g. 'Scope', 'Priority' (defaults to Q1, Q2)",
    }),
  ),
  prompt: Type.String({ description: "The full question text to display" }),
  options: Type.Array(QuestionOptionSchema, { description: "Available options to choose from" }),
  allowOther: Type.Optional(
    Type.Boolean({ description: "Allow 'Type something' option (default: true)" }),
  ),
});

const QuestionnaireParams = Type.Object({
  questions: Type.Array(QuestionSchema, { description: "Questions to ask the user" }),
});

function errorResult(
  message: string,
  questions: Question[] = [],
): { content: { type: "text"; text: string }[]; details: QuestionnaireResult } {
  return {
    content: [{ type: "text", text: message }],
    details: { questions, answers: [], cancelled: true },
  };
}

export default function questionnaire(pi: ExtensionAPI) {
  const disabledTools = (() => {
    try {
      const parsed = JSON.parse(process.env.PI_VSCODE_DISABLED_TOOLS ?? "[]");
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  })();

  if (!disabledTools.includes("questionnaire")) {
    pi.registerTool({
      name: "questionnaire",
      label: "Questionnaire",
      description:
        "Ask the user one or more questions. Use for clarifying requirements, getting preferences, or confirming decisions. For single questions, shows a simple option list. For multiple questions, shows a tab-based interface.",
      parameters: QuestionnaireParams,

      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        if (!ctx.hasUI) {
          return errorResult("Error: UI not available (running in non-interactive mode)");
        }
        if (params.questions.length === 0) {
          return errorResult("Error: No questions provided");
        }

        // Normalize questions with defaults
        const questions: Question[] = params.questions.map((q, i) => ({
          ...q,
          label: q.label || `Q${i + 1}`,
          allowOther: q.allowOther !== false,
        }));

        if (ctx.mode === "rpc") {
          const raw = await ctx.ui.editor("Pi Questionnaire Form", JSON.stringify({ questions }));
          if (raw === undefined) {
            return {
              content: [{ type: "text", text: "User cancelled the questionnaire" }],
              details: { questions, answers: [], cancelled: true },
            };
          }
          let parsed: { answers?: Answer[] };
          try {
            parsed = JSON.parse(raw);
          } catch {
            return errorResult("Error: invalid questionnaire response", questions);
          }
          const answers = parsed.answers ?? [];
          const answerLines = answers.map((a) => {
            const qLabel = questions.find((q) => q.id === a.id)?.label || a.id;
            if (a.wasCustom) {
              return `${qLabel}: user wrote: ${a.label}`;
            }
            return `${qLabel}: user selected: ${a.index}. ${a.label}`;
          });
          return {
            content: [{ type: "text", text: answerLines.join("\n") }],
            details: { questions, answers, cancelled: false },
          };
        }

        const isMulti = questions.length > 1;
        const totalTabs = questions.length + 1; // questions + Submit

        const result = await ctx.ui.custom<QuestionnaireResult>((tui, theme, _kb, done) => {
          // State
          let currentTab = 0;
          let optionIndex = 0;
          let inputMode = false;
          let inputQuestionId: string | null = null;
          let cachedLines: string[] | undefined;
          let cachedWidth: number | undefined;
          const answers = new Map<string, Answer>();

          // Editor for "Type something" option
          const editorTheme: EditorTheme = {
            borderColor: (s) => theme.fg("accent", s),
            selectList: {
              selectedPrefix: (t) => theme.fg("accent", t),
              selectedText: (t) => theme.fg("accent", t),
              description: (t) => theme.fg("muted", t),
              scrollInfo: (t) => theme.fg("dim", t),
              noMatch: (t) => theme.fg("warning", t),
            },
          };
          const editor = new Editor(tui, editorTheme);

          // Helpers
          function refresh() {
            cachedLines = undefined;
            cachedWidth = undefined;
            tui.requestRender();
          }

          function submit(cancelled: boolean) {
            done({ questions, answers: Array.from(answers.values()), cancelled });
          }

          function currentQuestion(): Question | undefined {
            return questions[currentTab];
          }

          function currentOptions(): RenderOption[] {
            const q = currentQuestion();
            if (!q) return [];
            const opts: RenderOption[] = [...q.options];
            if (q.allowOther) {
              opts.push({ label: "Type something.", isOther: true });
            }
            return opts;
          }

          function allAnswered(): boolean {
            return questions.every((q) => answers.has(q.id));
          }

          // Compute the option index to highlight when entering a tab,
          // based on any previously saved answer for that question.
          function indexForTab(tabIdx: number): number {
            const q = questions[tabIdx];
            if (!q) return 0;
            const ans = answers.get(q.id);
            if (!ans) return 0;
            if (ans.wasCustom) {
              // "Type something" sits at the end when allowOther is true.
              return q.allowOther ? q.options.length : 0;
            }
            const idx = q.options.findIndex((o) => o.label === ans.value);
            return idx >= 0 ? idx : 0;
          }

          function advanceAfterAnswer() {
            if (!isMulti) {
              submit(false);
              return;
            }
            if (currentTab < questions.length - 1) {
              currentTab++;
            } else {
              currentTab = questions.length; // Submit tab
            }
            optionIndex = indexForTab(currentTab);
            refresh();
          }

          function saveAnswer(
            questionId: string,
            value: string,
            label: string,
            wasCustom: boolean,
            index?: number,
          ) {
            answers.set(questionId, { id: questionId, value, label, wasCustom, index });
          }

          // Editor submit callback
          editor.onSubmit = (value) => {
            if (!inputQuestionId) return;
            const trimmed = value.trim() || "(no response)";
            saveAnswer(inputQuestionId, trimmed, trimmed, true);
            inputMode = false;
            inputQuestionId = null;
            editor.setText("");
            advanceAfterAnswer();
          };

          function handleInput(data: string) {
            // Input mode: route to editor
            if (inputMode) {
              if (matchesKey(data, Key.escape)) {
                inputMode = false;
                inputQuestionId = null;
                editor.setText("");
                refresh();
                return;
              }
              editor.handleInput(data);
              refresh();
              return;
            }

            const q = currentQuestion();
            const opts = currentOptions();

            // Tab navigation (multi-question only)
            if (isMulti) {
              if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
                currentTab = (currentTab + 1) % totalTabs;
                optionIndex = indexForTab(currentTab);
                refresh();
                return;
              }
              if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
                currentTab = (currentTab - 1 + totalTabs) % totalTabs;
                optionIndex = indexForTab(currentTab);
                refresh();
                return;
              }
            }

            // Submit tab
            if (currentTab === questions.length) {
              if (matchesKey(data, Key.enter) && allAnswered()) {
                submit(false);
              } else if (matchesKey(data, Key.escape)) {
                submit(true);
              }
              return;
            }

            // Option navigation
            if (matchesKey(data, Key.up)) {
              optionIndex = Math.max(0, optionIndex - 1);
              refresh();
              return;
            }
            if (matchesKey(data, Key.down)) {
              optionIndex = Math.min(opts.length - 1, optionIndex + 1);
              refresh();
              return;
            }

            // Select option
            if (matchesKey(data, Key.enter) && q) {
              const opt = opts[optionIndex];
              if (opt.isOther) {
                inputMode = true;
                inputQuestionId = q.id;
                editor.setText("");
                refresh();
                return;
              }
              saveAnswer(q.id, opt.label, opt.label, false, optionIndex + 1);
              advanceAfterAnswer();
              return;
            }

            // Cancel
            if (matchesKey(data, Key.escape)) {
              submit(true);
            }
          }

          function render(width: number): string[] {
            if (cachedLines && cachedWidth === width) return cachedLines;

            const lines: string[] = [];
            const q = currentQuestion();
            const opts = currentOptions();

            // Helper to add a truncated single-line entry (for rules/tabs/etc.)
            const add = (s: string) => lines.push(truncateToWidth(s, width));
            // Helper to add a wrapped multi-line entry.
            // `indent` is prepended to every wrapped continuation line so visual
            // alignment under list bullets / labels is preserved.
            const addWrapped = (s: string, indent = "") => {
              const innerWidth = Math.max(1, width - indent.length);
              const wrapped = wrapTextWithAnsi(s, innerWidth);
              if (wrapped.length === 0) {
                lines.push("");
                return;
              }
              lines.push(wrapped[0]);
              for (let i = 1; i < wrapped.length; i++) {
                lines.push(indent + wrapped[i]);
              }
            };

            add(theme.fg("accent", "─".repeat(width)));

            // Tab bar (multi-question only)
            if (isMulti) {
              const tabs: string[] = ["← "];
              for (let i = 0; i < questions.length; i++) {
                const isActive = i === currentTab;
                const isAnswered = answers.has(questions[i].id);
                const lbl = questions[i].label;
                const box = isAnswered ? "■" : "□";
                const color = isAnswered ? "success" : "muted";
                const text = ` ${box} ${lbl} `;
                const styled = isActive
                  ? theme.bg("selectedBg", theme.fg("text", text))
                  : theme.fg(color, text);
                tabs.push(`${styled} `);
              }
              const canSubmit = allAnswered();
              const isSubmitTab = currentTab === questions.length;
              const submitText = " ✓ Submit ";
              const submitStyled = isSubmitTab
                ? theme.bg("selectedBg", theme.fg("text", submitText))
                : theme.fg(canSubmit ? "success" : "dim", submitText);
              tabs.push(`${submitStyled} →`);
              add(` ${tabs.join("")}`);
              lines.push("");
            }

            // Helper to render options list
            function renderOptions() {
              const savedAns = q ? answers.get(q.id) : undefined;
              for (let i = 0; i < opts.length; i++) {
                const opt = opts[i];
                const selected = i === optionIndex;
                const isOther = opt.isOther === true;
                const isSaved =
                  !!savedAns &&
                  ((isOther && savedAns.wasCustom) ||
                    (!isOther && !savedAns.wasCustom && savedAns.value === opt.label));
                const prefix = selected ? theme.fg("accent", "> ") : "  ";
                const color = selected ? "accent" : "text";
                // Continuation lines align under the label, past "> 1. "
                const contIndent = "     ";
                const marker = isSaved ? theme.fg("success", " ✓") : "";
                const displayLabel =
                  isOther && savedAns?.wasCustom ? `${opt.label} (${savedAns.label})` : opt.label;
                // Mark "Type something" differently when in input mode
                if (isOther && inputMode) {
                  addWrapped(prefix + theme.fg("accent", `${i + 1}. ${opt.label} ✎`), contIndent);
                } else {
                  addWrapped(
                    prefix + theme.fg(color, `${i + 1}. ${displayLabel}`) + marker,
                    contIndent,
                  );
                }
                if (opt.description) {
                  addWrapped(`     ${theme.fg("muted", opt.description)}`, contIndent);
                }
              }
            }

            // Content
            if (inputMode && q) {
              addWrapped(theme.fg("text", ` ${q.prompt}`), " ");
              lines.push("");
              // Show options for reference
              renderOptions();
              lines.push("");
              add(theme.fg("muted", " Your answer:"));
              for (const line of editor.render(width - 2)) {
                add(` ${line}`);
              }
              lines.push("");
              addWrapped(theme.fg("dim", " Enter to submit • Esc to cancel"), " ");
            } else if (currentTab === questions.length) {
              add(theme.fg("accent", theme.bold(" Ready to submit")));
              lines.push("");
              for (const question of questions) {
                const answer = answers.get(question.id);
                if (answer) {
                  const prefix = answer.wasCustom ? "(wrote) " : "";
                  addWrapped(
                    `${theme.fg("muted", ` ${question.label}: `)}${theme.fg("text", prefix + answer.label)}`,
                    "   ",
                  );
                }
              }
              lines.push("");
              if (allAnswered()) {
                addWrapped(theme.fg("success", " Press Enter to submit"), " ");
              } else {
                const missing = questions
                  .filter((q) => !answers.has(q.id))
                  .map((q) => q.label)
                  .join(", ");
                addWrapped(theme.fg("warning", ` Unanswered: ${missing}`), "   ");
              }
            } else if (q) {
              addWrapped(theme.fg("text", ` ${q.prompt}`), " ");
              lines.push("");
              renderOptions();
            }

            lines.push("");
            if (!inputMode) {
              const help = isMulti
                ? " Tab/←→ navigate • ↑↓ select • Enter confirm • Esc cancel"
                : " ↑↓ navigate • Enter select • Esc cancel";
              addWrapped(theme.fg("dim", help), " ");
            }
            add(theme.fg("accent", "─".repeat(width)));

            cachedLines = lines;
            cachedWidth = width;
            return lines;
          }

          return {
            render,
            invalidate: () => {
              cachedLines = undefined;
              cachedWidth = undefined;
            },
            handleInput,
          };
        });

        if (result.cancelled) {
          return {
            content: [{ type: "text", text: "User cancelled the questionnaire" }],
            details: result,
          };
        }

        const answerLines = result.answers.map((a) => {
          const qLabel = questions.find((q) => q.id === a.id)?.label || a.id;
          if (a.wasCustom) {
            return `${qLabel}: user wrote: ${a.label}`;
          }
          return `${qLabel}: user selected: ${a.index}. ${a.label}`;
        });

        return {
          content: [{ type: "text", text: answerLines.join("\n") }],
          details: result,
        };
      },

      renderCall(args, theme, _context) {
        const qs = (args.questions as Question[]) || [];
        const count = qs.length;
        const labels = qs.map((q) => q.label || q.id).join(", ");
        let text = theme.fg("toolTitle", theme.bold("questionnaire "));
        text += theme.fg("muted", `${count} question${count !== 1 ? "s" : ""}`);
        if (labels) {
          text += theme.fg("dim", ` (${truncateToWidth(labels, 40)})`);
        }
        return new Text(text, 0, 0);
      },

      renderResult(result, _options, theme, _context) {
        const details = result.details as QuestionnaireResult | undefined;
        if (!details) {
          const text = result.content[0];
          return new Text(text?.type === "text" ? text.text : "", 0, 0);
        }
        if (details.cancelled) {
          return new Text(theme.fg("warning", "Cancelled"), 0, 0);
        }
        const lines = details.answers.map((a) => {
          if (a.wasCustom) {
            return `${theme.fg("success", "✓ ")}${theme.fg("accent", a.id)}: ${theme.fg("muted", "(wrote) ")}${a.label}`;
          }
          const display = a.index ? `${a.index}. ${a.label}` : a.label;
          return `${theme.fg("success", "✓ ")}${theme.fg("accent", a.id)}: ${display}`;
        });
        return new Text(lines.join("\n"), 0, 0);
      },
    });
  }
}
