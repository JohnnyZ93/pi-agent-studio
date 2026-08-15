/**
 * Permission Gate Extension
 *
 * Gates dangerous bash commands behind an approval prompt.
 *
 * Mode and patterns come from the PI_VSCODE_PERMISSION env var
 * (JSON `{ mode, patterns }`, injected by the extension host from
 * `pi-agent-studio.permission.mode` / `permission.dangerousPatterns`).
 * The in-memory `mode` is the runtime source of truth and can be
 * switched with the `/permission` slash command (session-only).
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type PermissionMode = "AskForApproval" | "FullAccess";

export default function (pi: ExtensionAPI) {
  const env = (() => {
    try {
      return JSON.parse(process.env.PI_VSCODE_PERMISSION ?? "{}");
    } catch {
      return {};
    }
  })();

  let mode: PermissionMode =
    env.mode === "FullAccess" || env.mode === "AskForApproval" ? env.mode : "AskForApproval";

  const regexes: RegExp[] = [];
  if (Array.isArray(env.patterns)) {
    for (const pattern of env.patterns) {
      if (typeof pattern !== "string") continue;
      try {
        regexes.push(new RegExp(pattern, "i"));
      } catch {
        // skip invalid patterns
      }
    }
  }

  const statusBarEnabled = process.env.PI_VSCODE_STATUS_BAR !== "0";
  const STATUS_ID = "pi-permission";

  const refreshStatus = (ctx?: ExtensionContext) => {
    if (!statusBarEnabled || !ctx?.hasUI) return;
    const text =
      mode === "FullAccess"
        ? `${ctx.ui.theme.fg("error", mode)}`
        : `${ctx.ui.theme.fg("success", mode)}`;
    ctx.ui.setStatus(STATUS_ID, text);
  };

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined;
    if (mode === "FullAccess") return undefined;

    const command = (event.input as { command?: string }).command ?? "";
    if (!command) return undefined;
    if (!regexes.some((r) => r.test(command))) return undefined;

    if (mode === "AskForApproval") {
      if (!ctx.hasUI) {
        return { block: true, reason: "Dangerous command blocked (no UI for confirmation)" };
      }

      const tui = ctx.mode === "tui";
      const title = `${tui ? ctx.ui.theme.fg("warning", "Dangerous Command:") : "Dangerous Command:"}\n\n  ${command}`;
      const choice = await ctx.ui.select(title, ["Allow", "Block"]);

      if (choice !== "Allow") {
        return { block: true, reason: "Blocked by user" };
      }
    }

    return undefined;
  });

  pi.registerCommand("permission", {
    description: "Set permission mode (ask|full)",
    handler: async (args, ctx) => {
      const arg = (args ?? "").trim().toLowerCase();
      if (arg === "ask" || arg === "askforapproval") mode = "AskForApproval";
      else if (arg === "full" || arg === "fullaccess") mode = "FullAccess";
      else return;
      refreshStatus(ctx);
    },
  });

  pi.on("session_start", async (_e, ctx) => refreshStatus(ctx));

  pi.on("session_shutdown", async (_e, ctx) => {
    if (ctx?.hasUI) ctx.ui.setStatus(STATUS_ID, undefined);
  });
}
