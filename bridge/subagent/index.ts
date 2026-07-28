/**
 * Subagent Tool - Delegate tasks to specialized agents
 *
 * Spawns a separate `pi` process for each subagent invocation,
 * giving it an isolated context window.
 *
 * Supports two modes:
 *   - Single: { agent: "name", task: "..." }
 *   - Parallel: { tasks: [{ agent: "name", task: "..." }, ...] }
 *
 * Uses JSON mode to capture structured output from subagents.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import { type ExtensionAPI, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { type AgentConfig, type AgentSource, discoverAgents, isValidAgentName } from "./agents.ts";

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;
const COLLAPSED_ITEM_COUNT = 10;
const PER_TASK_OUTPUT_CAP = 50 * 1024;

function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}

function formatUsageStats(
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    cost: number;
    contextTokens?: number;
    turns?: number;
  },
  model?: string,
): string {
  const parts: string[] = [];
  if (usage.turns) parts.push(`${usage.turns} turn${usage.turns > 1 ? "s" : ""}`);
  if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
  if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
  if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
  if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
  if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
  if (usage.contextTokens && usage.contextTokens > 0) {
    parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
  }
  if (model) parts.push(model);
  return parts.join(" ");
}

function formatToolCall(
  toolName: string,
  args: Record<string, unknown>,
  themeFg: (color: any, text: string) => string,
): string {
  const shortenPath = (p: string) => {
    const home = os.homedir();
    return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
  };

  switch (toolName) {
    case "bash": {
      const command = (args.command as string) || "...";
      const preview = command.length > 60 ? `${command.slice(0, 60)}...` : command;
      return themeFg("muted", "$ ") + themeFg("toolOutput", preview);
    }
    case "read": {
      const rawPath = (args.file_path || args.path || "...") as string;
      const filePath = shortenPath(rawPath);
      const offset = args.offset as number | undefined;
      const limit = args.limit as number | undefined;
      let text = themeFg("accent", filePath);
      if (offset !== undefined || limit !== undefined) {
        const startLine = offset ?? 1;
        const endLine = limit !== undefined ? startLine + limit - 1 : "";
        text += themeFg("warning", `:${startLine}${endLine ? `-${endLine}` : ""}`);
      }
      return themeFg("muted", "read ") + text;
    }
    case "write": {
      const rawPath = (args.file_path || args.path || "...") as string;
      const filePath = shortenPath(rawPath);
      const content = (args.content || "") as string;
      const lines = content.split("\n").length;
      let text = themeFg("muted", "write ") + themeFg("accent", filePath);
      if (lines > 1) text += themeFg("dim", ` (${lines} lines)`);
      return text;
    }
    case "edit": {
      const rawPath = (args.file_path || args.path || "...") as string;
      return themeFg("muted", "edit ") + themeFg("accent", shortenPath(rawPath));
    }
    case "ls": {
      const rawPath = (args.path || ".") as string;
      return themeFg("muted", "ls ") + themeFg("accent", shortenPath(rawPath));
    }
    case "find": {
      const pattern = (args.pattern || "*") as string;
      const rawPath = (args.path || ".") as string;
      return (
        themeFg("muted", "find ") +
        themeFg("accent", pattern) +
        themeFg("dim", ` in ${shortenPath(rawPath)}`)
      );
    }
    case "grep": {
      const pattern = (args.pattern || "") as string;
      const rawPath = (args.path || ".") as string;
      return (
        themeFg("muted", "grep ") +
        themeFg("accent", `/${pattern}/`) +
        themeFg("dim", ` in ${shortenPath(rawPath)}`)
      );
    }
    default: {
      const argsStr = JSON.stringify(args);
      const preview = argsStr.length > 50 ? `${argsStr.slice(0, 50)}...` : argsStr;
      return themeFg("accent", toolName) + themeFg("dim", ` ${preview}`);
    }
  }
}

interface UsageStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  contextTokens: number;
  turns: number;
}

interface SingleResult {
  agent: string;
  agentSource: AgentSource | "unknown";
  task: string;
  exitCode: number;
  messages: Message[];
  stderr: string;
  usage: UsageStats;
  model?: string;
  stopReason?: string;
  errorMessage?: string;
  step?: number;
}

interface SubagentDetails {
  mode: "single" | "parallel";
  projectAgentsDir: string | null;
  results: SingleResult[];
}

function getFinalOutput(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      for (const part of msg.content) {
        if (part.type === "text") return part.text;
      }
    }
  }
  return "";
}

function isRunningResult(result: SingleResult): boolean {
  return result.exitCode === -1;
}

function isFailedResult(result: SingleResult): boolean {
  if (result.exitCode === -1) return false;
  return result.exitCode !== 0 || result.stopReason === "error" || result.stopReason === "aborted";
}

function getResultOutput(result: SingleResult): string {
  if (isFailedResult(result)) {
    return result.errorMessage || result.stderr || getFinalOutput(result.messages) || "(no output)";
  }
  return getFinalOutput(result.messages) || "(no output)";
}

function truncateParallelOutput(output: string): string {
  const buf = Buffer.from(output, "utf8");
  if (buf.length <= PER_TASK_OUTPUT_CAP) return output;

  // Decode on a byte buffer so Node handles UTF-8 boundaries; strip any
  // trailing replacement chars left from a partial multi-byte sequence.
  const head = buf
    .subarray(0, PER_TASK_OUTPUT_CAP)
    .toString("utf8")
    .replace(/\uFFFD+$/u, "");
  const omitted = buf.length - Buffer.byteLength(head, "utf8");
  return `${head}\n\n[Output truncated: ${omitted} bytes omitted. Full output preserved in tool details.]`;
}

type DisplayItem =
  | { type: "text"; text: string }
  | { type: "toolCall"; name: string; args: Record<string, any> };

function getDisplayItems(messages: Message[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  for (const msg of messages) {
    if (msg.role === "assistant") {
      for (const part of msg.content) {
        if (part.type === "text") items.push({ type: "text", text: part.text });
        else if (part.type === "toolCall")
          items.push({ type: "toolCall", name: part.name, args: part.arguments });
      }
    }
  }
  return items;
}

async function mapWithConcurrencyLimit<TIn, TOut>(
  items: TIn[],
  concurrency: number,
  fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: TOut[] = Array.from({ length: items.length });
  let nextIndex = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
  if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }

  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  if (!isGenericRuntime) {
    return { command: process.execPath, args };
  }

  return { command: "pi", args };
}

type OnUpdateCallback = (partial: AgentToolResult<SubagentDetails>) => void;

async function runSingleAgent(
  defaultCwd: string,
  agents: AgentConfig[],
  agentName: string,
  task: string,
  cwd: string | undefined,
  step: number | undefined,
  signal: AbortSignal | undefined,
  onUpdate: OnUpdateCallback | undefined,
  makeDetails: (results: SingleResult[]) => SubagentDetails,
): Promise<SingleResult> {
  const agent = agents.find((a) => a.name === agentName);

  if (!agent || !isValidAgentName(agentName)) {
    const available = agents.map((a) => `"${a.name}"`).join(", ") || "none";
    return {
      agent: agentName,
      agentSource: "unknown",
      task,
      exitCode: 1,
      messages: [],
      stderr: agent
        ? `Invalid agent name: ${JSON.stringify(agentName)}.`
        : `Unknown agent: ${JSON.stringify(agentName)}. Available agents: ${available}.`,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        contextTokens: 0,
        turns: 0,
      },
      step,
    };
  }

  const args: string[] = ["--mode", "json", "-p", "--no-session"];
  if (agent.model) args.push("--model", agent.model);
  if (agent.tools && agent.tools.length > 0) args.push("--tools", agent.tools.join(","));

  const currentResult: SingleResult = {
    agent: agentName,
    agentSource: agent.source,
    task,
    exitCode: -1,
    messages: [],
    stderr: "",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
      contextTokens: 0,
      turns: 0,
    },
    model: agent.model,
    step,
  };

  const emitUpdate = () => {
    if (onUpdate) {
      onUpdate({
        content: [{ type: "text", text: getFinalOutput(currentResult.messages) || "(running...)" }],
        details: makeDetails([currentResult]),
      });
    }
  };

  try {
    if (agent.systemPrompt.trim()) {
      args.push("--append-system-prompt", agent.filePath);
    }

    let wasAborted = false;

    const exitCode = await new Promise<number>((resolve) => {
      const invocation = getPiInvocation(args);
      const proc = spawn(invocation.command, invocation.args, {
        cwd: cwd ?? defaultCwd,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      });
      if (proc.stdin) {
        proc.stdin.on("error", () => {
          /* ignore EPIPE if child exits early */
        });
        proc.stdin.end(`Task: ${task}`);
      }
      let killProc: (() => void) | undefined;
      const cleanup = () => {
        if (killProc && signal) signal.removeEventListener("abort", killProc);
        killProc = undefined;
      };

      const processLine = (line: string) => {
        if (!line.trim()) return;
        let event: any;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }

        if (event.type === "message_end" && event.message) {
          const msg = event.message as Message;
          currentResult.messages.push(msg);

          if (msg.role === "assistant") {
            currentResult.usage.turns++;
            const usage = msg.usage;
            if (usage) {
              currentResult.usage.input += usage.input || 0;
              currentResult.usage.output += usage.output || 0;
              currentResult.usage.cacheRead += usage.cacheRead || 0;
              currentResult.usage.cacheWrite += usage.cacheWrite || 0;
              currentResult.usage.cost += usage.cost?.total || 0;
              currentResult.usage.contextTokens = usage.totalTokens || 0;
            }
            if (!currentResult.model && msg.model) currentResult.model = msg.model;
            if (msg.stopReason) currentResult.stopReason = msg.stopReason;
            if (msg.errorMessage) currentResult.errorMessage = msg.errorMessage;
          }
          emitUpdate();
        }

        if (event.type === "tool_result_end" && event.message) {
          currentResult.messages.push(event.message as Message);
          emitUpdate();
        }
      };

      // Iterate JSON events line by line. readline avoids the O(n²) append
      // pattern of `buffer += data.toString()` and handles UTF-8 boundaries
      // across chunk splits correctly.
      const stdoutLines = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });
      stdoutLines.on("line", processLine);

      proc.stderr.on("data", (data) => {
        currentResult.stderr += data.toString();
      });

      proc.on("close", (code) => {
        stdoutLines.close();
        cleanup();
        resolve(code ?? 0);
      });

      proc.on("error", () => {
        stdoutLines.close();
        cleanup();
        resolve(1);
      });

      if (signal) {
        killProc = () => {
          wasAborted = true;
          proc.kill("SIGTERM");
          setTimeout(() => {
            if (!proc.killed) proc.kill("SIGKILL");
          }, 5000);
        };
        if (signal.aborted) killProc();
        else signal.addEventListener("abort", killProc, { once: true });
      }
    });

    currentResult.exitCode = exitCode;
    if (wasAborted) {
      currentResult.exitCode = currentResult.exitCode || 1;
      currentResult.stopReason = "aborted";
      currentResult.errorMessage = currentResult.errorMessage || "Subagent was aborted";
    }
  } catch (err) {
    // Spawn / promise-level failure: surface as a failed result rather than
    // returning undefined, which would crash parallel callers.
    if (currentResult.exitCode <= 0) currentResult.exitCode = 1;
    currentResult.stopReason = currentResult.stopReason || "error";
    currentResult.errorMessage = err instanceof Error ? err.message : String(err);
  }
  return currentResult;
}

const TaskItem = Type.Object({
  agent: Type.String({ description: "Name of the agent to invoke" }),
  task: Type.String({ description: "Task to delegate to the agent" }),
  cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const SubagentParams = Type.Object({
  agent: Type.Optional(
    Type.String({ description: "Name of the agent to invoke (for single mode)" }),
  ),
  task: Type.Optional(Type.String({ description: "Task to delegate (for single mode)" })),
  tasks: Type.Optional(
    Type.Array(TaskItem, { description: "Array of {agent, task} for parallel execution" }),
  ),
  cwd: Type.Optional(
    Type.String({ description: "Working directory for the agent process (single mode)" }),
  ),
});

export default function (pi: ExtensionAPI) {
  const disabledTools = (() => {
    try {
      const parsed = JSON.parse(process.env.PI_VSCODE_DISABLED_TOOLS ?? "[]");
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  })();
  if (disabledTools.includes("subagent")) return;

  // Discover agents at registration time so we can list them in the tool description.
  // Note: this is static for the life of the process; `/reload` is required to pick up new agents.
  const startupDiscovery = discoverAgents(process.cwd());
  const startupAgents = startupDiscovery.agents;
  const agentSourceMap = new Map<string, AgentSource>(startupAgents.map((a) => [a.name, a.source]));
  const listableAgents = startupAgents.filter((a) => !a.disableModelInvocation);
  const agentListBlock =
    listableAgents.length === 0
      ? ""
      : `\n\nAvailable agent types:\n${listableAgents.map((a) => `- ${a.name}: ${a.description}`).join("\n")}`;

  const baseDescription = [
    "Delegate tasks to specialized subagents with isolated context. Each agent type has specific capabilities and tools available to it. When using the subagent tool, specify a 'agent' parameter to select which agent type to use.\n\n",
    "## When to use\nReach for this when the task matches an available agent type, when you have independent work to run in parallel, or when answering would mean reading across several files — delegate it and you keep the conclusion, not the file dumps. For a single-fact lookup where you already know the file, symbol, or value, search directly. Once you've delegated a search, don't also run it yourself — wait for the result.\n\n",
    "Modes: single (agent + task), parallel (tasks array).",
  ].join(" ");

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description: baseDescription + agentListBlock,
    parameters: SubagentParams,

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const discovery = discoverAgents(ctx.cwd);
      const agents = discovery.agents;

      const hasTasks = (params.tasks?.length ?? 0) > 0;
      const hasSingle = Boolean(params.agent && params.task);
      const modeCount = Number(hasTasks) + Number(hasSingle);

      const makeDetails =
        (mode: "single" | "parallel") =>
        (results: SingleResult[]): SubagentDetails => ({
          mode,
          projectAgentsDir: discovery.projectAgentsDir,
          results,
        });

      if (modeCount !== 1) {
        const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
        return {
          content: [
            {
              type: "text",
              text: `Invalid parameters. Provide exactly one mode.\nAvailable agents: ${available}`,
            },
          ],
          details: makeDetails("single")([]),
        };
      }

      if (params.tasks && params.tasks.length > 0) {
        if (params.tasks.length > MAX_PARALLEL_TASKS)
          return {
            content: [
              {
                type: "text",
                text: `Too many parallel tasks (${params.tasks.length}). Max is ${MAX_PARALLEL_TASKS}.`,
              },
            ],
            details: makeDetails("parallel")([]),
          };

        // Track all results for streaming updates
        const allResults: SingleResult[] = Array.from({ length: params.tasks.length });

        // Initialize placeholder results
        for (let i = 0; i < params.tasks.length; i++) {
          allResults[i] = {
            agent: params.tasks[i].agent,
            agentSource: "unknown",
            task: params.tasks[i].task,
            exitCode: -1, // -1 = still running
            messages: [],
            stderr: "",
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              cost: 0,
              contextTokens: 0,
              turns: 0,
            },
          };
        }

        const emitParallelUpdate = () => {
          if (onUpdate) {
            const running = allResults.filter((r) => r.exitCode === -1).length;
            const done = allResults.filter((r) => r.exitCode !== -1).length;
            onUpdate({
              content: [
                {
                  type: "text",
                  text: `Parallel: ${done}/${allResults.length} done, ${running} running...`,
                },
              ],
              details: makeDetails("parallel")([...allResults]),
            });
          }
        };

        const results = await mapWithConcurrencyLimit(
          params.tasks,
          MAX_CONCURRENCY,
          async (t, index) => {
            const result = await runSingleAgent(
              ctx.cwd,
              agents,
              t.agent,
              t.task,
              t.cwd,
              undefined,
              signal,
              // Per-task update callback
              (partial) => {
                if (partial.details?.results[0]) {
                  allResults[index] = partial.details.results[0];
                  emitParallelUpdate();
                }
              },
              makeDetails("parallel"),
            );
            allResults[index] = result;
            emitParallelUpdate();
            return result;
          },
        );

        const successCount = results.filter((r) => !isFailedResult(r)).length;
        const summaries = results.map((r) => {
          const output = truncateParallelOutput(getResultOutput(r));
          const status = isFailedResult(r)
            ? `failed${r.stopReason && r.stopReason !== "end" ? ` (${r.stopReason})` : ""}`
            : "completed";
          return `### [${r.agent}] ${status}\n\n${output}`;
        });
        return {
          content: [
            {
              type: "text",
              text: `Parallel: ${successCount}/${results.length} succeeded\n\n${summaries.join("\n\n---\n\n")}`,
            },
          ],
          details: makeDetails("parallel")(results),
        };
      }

      if (params.agent && params.task) {
        const result = await runSingleAgent(
          ctx.cwd,
          agents,
          params.agent,
          params.task,
          params.cwd,
          undefined,
          signal,
          onUpdate,
          makeDetails("single"),
        );
        const isError = isFailedResult(result);
        if (isError) {
          const errorMsg = getResultOutput(result);
          return {
            content: [
              { type: "text", text: `Agent ${result.stopReason || "failed"}: ${errorMsg}` },
            ],
            details: makeDetails("single")([result]),
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: getFinalOutput(result.messages) || "(no output)" }],
          details: makeDetails("single")([result]),
        };
      }

      const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
      return {
        content: [{ type: "text", text: `Invalid parameters. Available agents: ${available}` }],
        details: makeDetails("single")([]),
      };
    },

    renderCall(args, theme, _context) {
      const deriveScope = (names: string[]): string => {
        const sources = new Set<string>();
        for (const n of names) {
          const src = agentSourceMap.get(n);
          sources.add(src ?? "unknown");
        }
        if (sources.size === 0) return "unknown";
        if (sources.size === 1) return sources.values().next().value as string;
        return "both";
      };
      if (args.tasks && args.tasks.length > 0) {
        const scope = deriveScope(args.tasks.map((t) => t.agent));
        let text =
          theme.fg("toolTitle", theme.bold("subagent ")) +
          theme.fg("accent", `parallel (${args.tasks.length} tasks)`) +
          theme.fg("muted", ` [${scope}]`);
        for (const t of args.tasks.slice(0, 3)) {
          const preview = t.task.length > 40 ? `${t.task.slice(0, 40)}...` : t.task;
          text += `\n  ${theme.fg("accent", t.agent)}${theme.fg("dim", ` ${preview}`)}`;
        }
        if (args.tasks.length > 3)
          text += `\n  ${theme.fg("muted", `... +${args.tasks.length - 3} more`)}`;
        return new Text(text, 0, 0);
      }
      const agentName = args.agent || "...";
      const scope = deriveScope(args.agent ? [args.agent] : []);
      const preview = args.task
        ? args.task.length > 60
          ? `${args.task.slice(0, 60)}...`
          : args.task
        : "...";
      let text =
        theme.fg("toolTitle", theme.bold("subagent ")) +
        theme.fg("accent", agentName) +
        theme.fg("muted", ` [${scope}]`);
      text += `\n  ${theme.fg("dim", preview)}`;
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded }, theme, _context) {
      const details = result.details as SubagentDetails | undefined;
      if (!details || details.results.length === 0) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
      }

      const mdTheme = getMarkdownTheme();

      const renderDisplayItems = (items: DisplayItem[], limit?: number) => {
        const toShow = limit ? items.slice(-limit) : items;
        const skipped = limit && items.length > limit ? items.length - limit : 0;
        let text = "";
        if (skipped > 0) text += theme.fg("muted", `... ${skipped} earlier items\n`);
        for (const item of toShow) {
          if (item.type === "text") {
            const preview = expanded ? item.text : item.text.split("\n").slice(0, 3).join("\n");
            text += `${theme.fg("toolOutput", preview)}\n`;
          } else {
            text += `${theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme))}\n`;
          }
        }
        return text.trimEnd();
      };

      if (details.mode === "single" && details.results.length === 1) {
        const r = details.results[0];
        const isRunning = isRunningResult(r);
        const isError = isFailedResult(r);
        const icon = isRunning
          ? theme.fg("warning", "⏳")
          : isError
            ? theme.fg("error", "✗")
            : theme.fg("success", "✓");
        const displayItems = getDisplayItems(r.messages);
        const finalOutput = getFinalOutput(r.messages);

        if (expanded) {
          const container = new Container();
          let header = `${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}${theme.fg("muted", ` (${r.agentSource})`)}`;
          if (isError && r.stopReason) header += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
          container.addChild(new Text(header, 0, 0));
          if (isError && r.errorMessage)
            container.addChild(new Text(theme.fg("error", `Error: ${r.errorMessage}`), 0, 0));
          container.addChild(new Spacer(1));
          container.addChild(new Text(theme.fg("muted", "─── Task ───"), 0, 0));
          container.addChild(new Text(theme.fg("dim", r.task), 0, 0));
          container.addChild(new Spacer(1));
          container.addChild(new Text(theme.fg("muted", "─── Output ───"), 0, 0));
          if (displayItems.length === 0 && !finalOutput) {
            container.addChild(new Text(theme.fg("muted", "(no output)"), 0, 0));
          } else {
            for (const item of displayItems) {
              if (item.type === "toolCall")
                container.addChild(
                  new Text(
                    theme.fg("muted", "→ ") +
                      formatToolCall(item.name, item.args, theme.fg.bind(theme)),
                    0,
                    0,
                  ),
                );
            }
            if (finalOutput) {
              container.addChild(new Spacer(1));
              container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
            }
          }
          const usageStr = formatUsageStats(r.usage, r.model);
          if (usageStr) {
            container.addChild(new Spacer(1));
            container.addChild(new Text(theme.fg("dim", usageStr), 0, 0));
          }
          return container;
        }

        let text = `${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}${theme.fg("muted", ` (${r.agentSource})`)}`;
        if (isError && r.stopReason) text += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
        if (isError && r.errorMessage) text += `\n${theme.fg("error", `Error: ${r.errorMessage}`)}`;
        else if (displayItems.length === 0) text += `\n${theme.fg("muted", "(no output)")}`;
        else {
          text += `\n${renderDisplayItems(displayItems, COLLAPSED_ITEM_COUNT)}`;
          if (displayItems.length > COLLAPSED_ITEM_COUNT)
            text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
        }
        const usageStr = formatUsageStats(r.usage, r.model);
        if (usageStr) text += `\n${theme.fg("dim", usageStr)}`;
        return new Text(text, 0, 0);
      }

      const aggregateUsage = (results: SingleResult[]) => {
        const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 };
        for (const r of results) {
          total.input += r.usage.input;
          total.output += r.usage.output;
          total.cacheRead += r.usage.cacheRead;
          total.cacheWrite += r.usage.cacheWrite;
          total.cost += r.usage.cost;
          total.turns += r.usage.turns;
        }
        return total;
      };

      if (details.mode === "parallel") {
        const running = details.results.filter((r) => r.exitCode === -1).length;
        const successCount = details.results.filter(
          (r) => r.exitCode !== -1 && !isFailedResult(r),
        ).length;
        const failCount = details.results.filter(
          (r) => r.exitCode !== -1 && isFailedResult(r),
        ).length;
        const isRunning = running > 0;
        const icon = isRunning
          ? theme.fg("warning", "⏳")
          : failCount > 0
            ? theme.fg("warning", "◐")
            : theme.fg("success", "✓");
        const status = isRunning
          ? `${successCount + failCount}/${details.results.length} done, ${running} running`
          : `${successCount}/${details.results.length} tasks`;

        if (expanded && !isRunning) {
          const container = new Container();
          container.addChild(
            new Text(
              `${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`,
              0,
              0,
            ),
          );

          for (const r of details.results) {
            const rIcon = isFailedResult(r) ? theme.fg("error", "✗") : theme.fg("success", "✓");
            const displayItems = getDisplayItems(r.messages);
            const finalOutput = getFinalOutput(r.messages);

            container.addChild(new Spacer(1));
            container.addChild(
              new Text(`${theme.fg("muted", "─── ") + theme.fg("accent", r.agent)} ${rIcon}`, 0, 0),
            );
            container.addChild(
              new Text(theme.fg("muted", "Task: ") + theme.fg("dim", r.task), 0, 0),
            );

            // Show tool calls
            for (const item of displayItems) {
              if (item.type === "toolCall") {
                container.addChild(
                  new Text(
                    theme.fg("muted", "→ ") +
                      formatToolCall(item.name, item.args, theme.fg.bind(theme)),
                    0,
                    0,
                  ),
                );
              }
            }

            // Show final output as markdown
            if (finalOutput) {
              container.addChild(new Spacer(1));
              container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
            }

            const taskUsage = formatUsageStats(r.usage, r.model);
            if (taskUsage) container.addChild(new Text(theme.fg("dim", taskUsage), 0, 0));
          }

          const usageStr = formatUsageStats(aggregateUsage(details.results));
          if (usageStr) {
            container.addChild(new Spacer(1));
            container.addChild(new Text(theme.fg("dim", `Total: ${usageStr}`), 0, 0));
          }
          return container;
        }

        // Collapsed view (or still running)
        let text = `${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`;
        for (const r of details.results) {
          const rIcon =
            r.exitCode === -1
              ? theme.fg("warning", "⏳")
              : isFailedResult(r)
                ? theme.fg("error", "✗")
                : theme.fg("success", "✓");
          const displayItems = getDisplayItems(r.messages);
          text += `\n\n${theme.fg("muted", "─── ")}${theme.fg("accent", r.agent)} ${rIcon}`;
          if (displayItems.length === 0)
            text += `\n${theme.fg("muted", r.exitCode === -1 ? "(running...)" : "(no output)")}`;
          else text += `\n${renderDisplayItems(displayItems, 5)}`;
        }
        if (!isRunning) {
          const usageStr = formatUsageStats(aggregateUsage(details.results));
          if (usageStr) text += `\n\n${theme.fg("dim", `Total: ${usageStr}`)}`;
        }
        if (!expanded) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
        return new Text(text, 0, 0);
      }

      const text = result.content[0];
      return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
    },
  });
}
