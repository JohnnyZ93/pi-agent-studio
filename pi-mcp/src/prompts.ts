import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { GetPromptResult, Prompt } from "@modelcontextprotocol/sdk/types.js";
import type { McpConnection } from "./types.ts";
import type { McpSession } from "./connection.ts";

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** Tokenize a raw arg string with bash-style quoting support. */
function tokenizeArgs(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;
  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

function findUnquotedEquals(token: string): number {
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "=") return i;
  }
  return -1;
}

function stripQuotes(value: string): string {
  if (
    value.length >= 2 &&
    (value.startsWith('"') || value.startsWith("'")) &&
    value.endsWith(value[0])
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Parse a slash-command argument string into positional and named arguments.
 * Supports bash-style quoting so callers can pass values with spaces:
 *   /mcp__demo__brief today "important tasks"
 *   /mcp__demo__brief day=today topic="important tasks"
 */
function parsePromptArgs(input: string): {
  positional: string[];
  named: Record<string, string>;
} {
  const positional: string[] = [];
  const named: Record<string, string> = {};
  for (const token of tokenizeArgs(input)) {
    const eq = findUnquotedEquals(token);
    if (eq > 0) {
      const key = token.slice(0, eq).trim();
      const value = stripQuotes(token.slice(eq + 1).trim());
      if (key) {
        named[key] = value;
        continue;
      }
    }
    positional.push(stripQuotes(token));
  }
  return { positional, named };
}

/**
 * Map positional + named args onto the prompt's declared argument list.
 * Named wins over positional for the same slot. Missing required args
 * produce a usage message surfaced via ctx.ui.notify.
 */
function resolvePromptArgs(
  prompt: Prompt,
  parsed: { positional: string[]; named: Record<string, string> },
): { ok: true; args: Record<string, string> } | { ok: false; error: string } {
  const args: Record<string, string> = {};
  const declared = prompt.arguments ?? [];
  let positionalIndex = 0;
  for (const argDef of declared) {
    const value = parsed.named[argDef.name] ?? parsed.positional[positionalIndex++];
    if (value !== undefined && value !== "") {
      args[argDef.name] = value;
    }
  }
  for (const [key, value] of Object.entries(parsed.named)) {
    if (!(key in args)) args[key] = value;
  }
  const missing = declared.filter(
    (a) => a.required && (args[a.name] === undefined || args[a.name] === ""),
  );
  if (missing.length > 0) {
    const usage = declared.map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`)).join(" ");
    const missingList = missing.map((a) => a.name).join(", ");
    return {
      ok: false,
      error:
        `Missing required argument${missing.length > 1 ? "s" : ""}: ${missingList}.\nUsage: ${usage}`.trim(),
    };
  }
  return { ok: true, args };
}

function messageText(content: unknown): string {
  if (!content || typeof content !== "object") return String(content ?? "");
  const block = content as { type?: string; text?: string; mimeType?: string; data?: string };
  if (block.type === "text") return block.text ?? "";
  if (block.type === "image" || block.type === "audio")
    return `[${block.type}: ${block.mimeType ?? "?"}]`;
  if (block.type === "resource") return `[resource: ${block.text ?? block.data ?? ""}]`;
  return `[${block.type ?? "content"}]`;
}

function promptResultToText(result: GetPromptResult): string {
  const messages = result.messages ?? [];
  if (messages.length === 0) return result.description ?? "(empty prompt)";
  const parts = messages.map((m) => {
    const text = messageText(m.content);
    return m.role === "assistant" ? `Assistant: ${text}` : text;
  });
  return parts.join("\n\n");
}

/** Register a slash command per discovered prompt: /mcp__<server>__<prompt>. */
export function registerServerPrompts(
  pi: ExtensionAPI,
  getSession: () => McpSession | null,
  conn: McpConnection,
): void {
  const server = sanitizeName(conn.name);
  const prompts = conn.discovered?.prompts ?? [];
  for (const prompt of prompts) {
    const cmdName = `mcp__${server}__${sanitizeName(prompt.name)}`;
    const argHint =
      prompt.arguments && prompt.arguments.length > 0
        ? ` Arguments: ${prompt.arguments.map((a) => `${a.name}${a.required ? "*" : ""}`).join(" ")}.`
        : "";
    pi.registerCommand(cmdName, {
      description: prompt.description ?? `MCP prompt ${prompt.name} from ${conn.name}.${argHint}`,
      handler: async (args, ctx) => {
        const session = getSession();
        if (!session) {
          ctx?.ui.notify("MCP session not active", "error");
          return;
        }
        const parsed = parsePromptArgs(args ?? "");
        const resolved = resolvePromptArgs(prompt, parsed);
        if (!resolved.ok) {
          ctx?.ui.notify(resolved.error, "error");
          return;
        }
        const result = await session.getPrompt(conn.name, prompt.name, resolved.args);
        const text = promptResultToText(result);
        pi.sendUserMessage(text);
      },
    });
  }
}
