import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpConnection } from "./types.ts";
import type { McpSession } from "./connection.ts";

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function parsePromptArgs(raw: string): Record<string, string> | undefined {
  const args: Record<string, string> = {};
  for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
    const eq = token.indexOf("=");
    if (eq > 0) {
      args[token.slice(0, eq)] = token.slice(eq + 1);
    }
  }
  return Object.keys(args).length > 0 ? args : undefined;
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
      handler: async (args) => {
        const session = getSession();
        if (!session) throw new Error("MCP session not active");
        const promptArgs = parsePromptArgs(args);
        const result = await session.getPrompt(conn.name, prompt.name, promptArgs);
        const text = promptResultToText(result);
        pi.sendUserMessage(text);
      },
    });
  }
}
