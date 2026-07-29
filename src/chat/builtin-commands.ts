import type { RpcCommand } from "./chat-types.ts";

export const BUILTIN_COMMAND_NAMES = [
  "compact",
  "autocompact",
  "session",
  "name",
  "changelog",
  "clear",
  "new",
] as const;

export function builtinCommands(): RpcCommand[] {
  return [
    {
      name: "compact",
      description: "Run pi compaction (optionally with custom instructions)",
      source: "builtin",
    },
    {
      name: "autocompact",
      description: "Toggle automatic compaction: on | off | toggle",
      source: "builtin",
    },
    {
      name: "session",
      description: "Show session stats (tokens/messages/cost/session file)",
      source: "builtin",
    },
    {
      name: "name",
      description: "Set session display name",
      source: "builtin",
    },
    {
      name: "changelog",
      description: "Print the installed pi changelog (best-effort)",
      source: "builtin",
    },
    { name: "clear", description: "Start a new session", source: "builtin" },
    { name: "new", description: "Start a new session", source: "builtin" },
  ];
}

export interface ParsedBuiltin {
  name: string;
  args: string;
}

export function parseBuiltin(message: string): ParsedBuiltin | null {
  const s = message.trim();
  if (s.charAt(0) !== "/") return null;
  const rest = s.slice(1);
  const sp = rest.indexOf(" ");
  const name = sp >= 0 ? rest.slice(0, sp) : rest;
  if (name === "") return null;
  const args = sp >= 0 ? rest.slice(sp + 1).trim() : "";
  if (!(BUILTIN_COMMAND_NAMES as readonly string[]).includes(name)) return null;
  return { name, args };
}

export function mergeBuiltinCommands(piCommands: RpcCommand[]): RpcCommand[] {
  const builtins = builtinCommands();
  const seen = new Set<string>();
  const merged: RpcCommand[] = [];
  for (const c of builtins) {
    if (seen.has(c.name)) continue;
    seen.add(c.name);
    merged.push(c);
  }
  for (const c of piCommands) {
    if (seen.has(c.name)) continue;
    seen.add(c.name);
    merged.push(c);
  }
  merged.sort((a, b) => {
    const an = (a.name ?? "").toLowerCase();
    const bn = (b.name ?? "").toLowerCase();
    return an < bn ? -1 : an > bn ? 1 : 0;
  });
  return merged;
}
