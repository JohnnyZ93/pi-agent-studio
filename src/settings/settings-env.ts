import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as vscode from "vscode";
import { findPiBinary } from "../pi.ts";

const execFileAsync = promisify(execFile);

const EXTENSION_ID = "johnny-zhao.pi-agent-studio";

/**
 * Run a system command resolved from PATH, tolerating Windows shims
 * (.cmd/.bat). Returns trimmed stdout, or undefined on failure/timeout.
 */
async function execOnPath(
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<string | undefined> {
  const isWin = process.platform === "win32";
  const opts = { timeout: timeoutMs, windowsHide: true, encoding: "utf8" as const };
  try {
    if (!isWin) {
      const { stdout } = await execFileAsync(command, args, opts);
      return stdout.trim();
    }
    const lower = command.toLowerCase();
    const needsCmd = lower.endsWith(".cmd") || lower.endsWith(".bat") || lower.endsWith(".ps1");
    if (needsCmd) {
      const { stdout } = await execFileAsync("cmd.exe", ["/d", "/s", "/c", command, ...args], opts);
      return stdout.trim();
    }
    // Windows, no extension: try the binary directly (node.exe), then retry
    // through cmd.exe for PATHEXT shims like npm.cmd that CreateProcess cannot
    // execute on its own.
    try {
      const { stdout } = await execFileAsync(command, args, opts);
      return stdout.trim();
    } catch {
      const { stdout } = await execFileAsync("cmd.exe", ["/d", "/s", "/c", command, ...args], opts);
      return stdout.trim();
    }
  } catch {
    return undefined;
  }
}

/** System-level Node.js/npm availability on PATH (used by the onboarding card —
 *  deliberately NOT the extension-host node, which may mislead new users). */
export async function detectSystemNodeEnv(): Promise<{
  nodeVersion: string | undefined;
  npmVersion: string | undefined;
}> {
  const [nodeVersion, npmVersion] = await Promise.all([
    execOnPath("node", ["--version"], 5000),
    execOnPath("npm", ["--version"], 5000),
  ]);
  return {
    nodeVersion: nodeVersion ? nodeVersion.replace(/^v/, "") : undefined,
    npmVersion: npmVersion ?? undefined,
  };
}

export interface SettingsStaticEnv {
  piPath: string;
  extensionVersion: string;
  nodeVersion: string;
}

export function getExtensionVersion(): string {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  const v = ext?.packageJSON?.version as string | undefined;
  return v ?? "(unknown)";
}

/** Synchronous environment info — pi/node versions are fetched separately. */
export function collectStaticEnv(): SettingsStaticEnv {
  return {
    piPath: findPiBinary(),
    extensionVersion: getExtensionVersion(),
    nodeVersion: "(loading…)",
  };
}

/**
 * Run a pi shim binary on Windows safely.
 */
function execPiShim(
  piPath: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  const isWin = process.platform === "win32";
  const lower = piPath.toLowerCase();
  const isShim =
    isWin && (lower.endsWith(".cmd") || lower.endsWith(".bat") || lower.endsWith(".ps1"));

  const opts = { timeout: timeoutMs, windowsHide: true, encoding: "utf8" as const };

  if (!isShim) {
    return execFileAsync(piPath, args, opts) as Promise<{ stdout: string; stderr: string }>;
  }

  if (lower.endsWith(".ps1")) {
    const quoteSingle = (s: string) => `'${s.replace(/'/g, "''")}'`;
    const ps =
      `& ${quoteSingle(piPath)}` + (args.length ? " " + args.map(quoteSingle).join(" ") : "");
    return execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
      opts,
    ) as Promise<{ stdout: string; stderr: string }>;
  }

  // .cmd / .bat — go through cmd.exe explicitly with proper quoting.
  return execFileAsync("cmd.exe", ["/d", "/s", "/c", piPath, ...args], opts) as Promise<{
    stdout: string;
    stderr: string;
  }>;
}

/**
 * Detect pi version by running `pi --version` (10s timeout).
 */
export async function detectPiVersion(piPath: string): Promise<string> {
  try {
    const { stdout, stderr } = await execPiShim(piPath, ["--version"], 10000);
    if (stderr && stderr.trim()) {
      console.error(`[pi-agent-studio] detectPiVersion stderr: ${stderr.trim()}`);
    }
    const trimmed = stdout.trim();
    if (trimmed) {
      // pi --version typically prints just the version (e.g. "0.79.0") or "pi 0.79.0".
      // Take the last whitespace-separated token.
      const last = trimmed.split(/\s+/).pop();
      if (last) return last;
    }
  } catch (err) {
    console.error(`[pi-agent-studio] detectPiVersion failed (piPath=${piPath}):`, err);
  }
  return "(unknown)";
}
