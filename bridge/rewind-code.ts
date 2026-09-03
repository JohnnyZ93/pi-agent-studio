/**
 * Rewind Code Extension
 *
 * When rewinding to a historical user message via /tree or /fork, prompt to choose:
 *   1) Rewind message only (keep code changes)
 *   2) Rewind message + code (restore files)
 *
 * Implementation: file-level content snapshots (no git dependency).
 * - Before a tool_call(edit/write) executes, read the file's before content; after tool_result, read the after content.
 * - Deduplicate by sha256 and store under ~/.pi/snapshots/{sessionId}/{hash}, aggregated by the owning user message entryId.
 * - bash direct file changes are out of scope (input has no path); on rewind, notify that they are not covered.
 *
 * Widget mode (RPC/webview):
 * - Maintains baseline per file ("last accept point" or session-start original state).
 * - Live widget reports files whose current disk state differs from their baseline, with line-level +added/-removed counts.
 * - Accept moves the baseline forward; revert restores the baseline snapshot.
 */

import {
  isToolCallEventType,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

interface FileChange {
  atEntryId: string;
  beforeHash: FileSnapshot;
  beforeMode: number | null;
  afterHash: FileSnapshot;
  afterMode: number | null;
}

/** File content hash or absence state: string = sha256 (snapshot persisted); null = does not exist; undefined = exists but untracked (oversized / non-regular). */
type FileSnapshot = string | null | undefined;

interface CapturedFile {
  hash: FileSnapshot;
  mode: number | null;
}

interface Pending {
  userEntryId: string;
  files: Map<string, CapturedFile>;
}

interface Baseline {
  hash: FileSnapshot;
  mode: number | null;
}

interface WidgetFile {
  id: number;
  absPath: string;
  basename: string;
  added: number | null;
  removed: number | null;
  baselineHash: string | null;
  baselineMode: number | null;
  currentExists: boolean;
}

interface WidgetData {
  sessionId: string;
  files: WidgetFile[];
  totals: { added: number; removed: number };
}

const SNAP_ROOT = path.join(os.homedir(), ".pi", "snapshots");
const MAX_SNAPSHOT_BYTES = 50 * 1024 * 1024;
const SNAP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_DIFF_LINES = 4000;
const WIDGET_KEY = "rewind-files";

let currentSnapDir: string | undefined;

const fileHistory = new Map<string, FileChange[]>();
const pendingBefore = new Map<string, Pending>();
const baselines = new Map<string, Baseline>();
const fileIds = new Map<string, number>();
let nextRewindId = 1;

function hashStream(abs: string): string {
  const h = crypto.createHash("sha256");
  const fd = fs.openSync(abs, "r");
  try {
    const buf = Buffer.alloc(65536);
    let pos = 0;
    let n: number;
    while ((n = fs.readSync(fd, buf, 0, buf.length, pos)) > 0) {
      h.update(buf.subarray(0, n));
      pos += n;
    }
  } finally {
    fs.closeSync(fd);
  }
  return h.digest("hex");
}

function persist(hash: string, abs: string) {
  if (!currentSnapDir) return;
  fs.mkdirSync(currentSnapDir, { recursive: true });
  const p = path.join(currentSnapDir, hash);
  if (!fs.existsSync(p)) fs.copyFileSync(abs, p);
}

function readSnapshot(abs: string): CapturedFile {
  let st: fs.Stats;
  try {
    st = fs.statSync(abs);
  } catch {
    return { hash: null, mode: null };
  }
  if (!st.isFile()) return { hash: undefined, mode: null };
  if (st.size > MAX_SNAPSHOT_BYTES) return { hash: undefined, mode: null };

  let h: string;
  try {
    h = hashStream(abs);
  } catch {
    return { hash: null, mode: null };
  }
  try {
    persist(h, abs);
  } catch {}
  return { hash: h, mode: st.mode & 0o7777 };
}

function sweepStaleSnapshots(currentSessionId: string) {
  let names: string[];
  try {
    names = fs.readdirSync(SNAP_ROOT);
  } catch {
    return;
  }
  const now = Date.now();
  for (const name of names) {
    if (name === currentSessionId) continue;
    const dir = path.join(SNAP_ROOT, name);
    try {
      const st = fs.statSync(dir);
      if (!st.isDirectory()) continue;
      if (now - st.mtimeMs >= SNAP_MAX_AGE_MS || fs.readdirSync(dir).length === 0) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch {
      // best-effort; ignore
    }
  }
}

function lastUserEntryId(ctx: ExtensionContext): string | undefined {
  const entries = ctx.sessionManager.getEntries();
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.type === "message" && e.message?.role === "user") return e.id;
  }
  return undefined;
}

/** Active branch only (root -> leaf)*/
function buildOrderMap(ctx: ExtensionContext): Map<string, number> {
  const m = new Map<string, number>();
  const branch = ctx.sessionManager.getBranch().slice().reverse();
  for (let i = 0; i < branch.length; i++) m.set(branch[i].id, i);
  return m;
}

function countAffected(order: Map<string, number>, targetIndex: number): number {
  let n = 0;
  for (const changes of fileHistory.values()) {
    if (
      changes.some((c) => {
        const i = order.get(c.atEntryId);
        return i !== undefined && i >= targetIndex;
      })
    )
      n++;
  }
  return n;
}

function restoreToEntry(
  order: Map<string, number>,
  targetIndex: number,
): { touched: number; failedPaths: string[] } {
  const failedPaths: string[] = [];
  if (!currentSnapDir) return { touched: 0, failedPaths };
  let touched = 0;
  for (const [abs, changes] of fileHistory) {
    const onBranch = changes.filter((c) => order.has(c.atEntryId));
    const affected = onBranch.some((c) => (order.get(c.atEntryId) ?? -1) >= targetIndex);
    if (!affected) continue;

    const atTarget = onBranch.find((c) => (order.get(c.atEntryId) ?? -1) === targetIndex);
    let targetHash: FileSnapshot;
    let targetMode: number | null;
    if (atTarget) {
      // The target turn itself changed this file -> restore to before that turn was processed.
      targetHash = atTarget.beforeHash;
      targetMode = atTarget.beforeMode;
    } else {
      // Find the earliest recorded change (project-original state if no earlier change exists).
      let earliest: FileChange | undefined;
      for (const c of onBranch) {
        const ci = order.get(c.atEntryId) ?? -1;
        if (!earliest || (order.get(earliest.atEntryId) ?? -1) > ci) earliest = c;
      }
      // Take the content after the last change before the target (= the file content when the target was sent).
      let lastBefore: FileChange | undefined;
      for (const c of onBranch) {
        const ci = order.get(c.atEntryId) ?? -1;
        if (ci < targetIndex && (!lastBefore || (order.get(lastBefore.atEntryId) ?? -1) < ci)) {
          lastBefore = c;
        }
      }
      // target is earlier than all recorded changes: file was project-original -> restore earliest before (original content);
      // earliest before being null means the file didn't originally exist -> delete.
      targetHash = lastBefore ? lastBefore.afterHash : earliest ? earliest.beforeHash : null;
      targetMode = lastBefore ? lastBefore.afterMode : earliest ? earliest.beforeMode : null;
    }

    if (targetHash === undefined) continue; // oversized/non-regular file: no snapshot to restore

    try {
      if (targetHash === null) {
        fs.rmSync(abs, { force: true });
      } else {
        const src = path.join(currentSnapDir, targetHash);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.copyFileSync(src, abs);
      }
      if (targetMode !== null) {
        try {
          fs.chmodSync(abs, targetMode);
        } catch {}
      }
      touched++;
    } catch {
      failedPaths.push(abs);
    }
  }
  return { touched, failedPaths };
}

/** Line-level diff (+added / -removed) between baseline snapshot and current disk file.
 *  Returns null when either side exceeds MAX_DIFF_LINES (webview shows "-"). */
function computeLineDiff(
  beforeAbs: string | null,
  afterAbs: string,
): { added: number; removed: number } | null {
  let beforeLines: string[];
  if (beforeAbs !== null) {
    try {
      beforeLines = fs.readFileSync(beforeAbs, "utf8").split("\n");
    } catch {
      beforeLines = [];
    }
  } else {
    beforeLines = [];
  }

  let afterLines: string[];
  try {
    afterLines = fs.readFileSync(afterAbs, "utf8").split("\n");
  } catch {
    afterLines = [];
  }

  if (beforeLines.length > MAX_DIFF_LINES || afterLines.length > MAX_DIFF_LINES) return null;

  // Trim trailing empty line (trailing newline artifact).
  while (beforeLines.length && beforeLines[beforeLines.length - 1] === "") beforeLines.pop();
  while (afterLines.length && afterLines[afterLines.length - 1] === "") afterLines.pop();

  const m = beforeLines.length;
  const n = afterLines.length;

  // Two-row LCS DP (O(m*n) time, O(n) memory) on raw line strings.
  let prev = Array.from({ length: n + 1 }, () => 0);
  let curr = Array.from({ length: n + 1 }, () => 0);
  for (let i = 1; i <= m; i++) {
    const bLine = beforeLines[i - 1];
    for (let j = 1; j <= n; j++) {
      if (bLine === afterLines[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        const a = prev[j];
        const b = curr[j - 1];
        curr[j] = a > b ? a : b;
      }
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  const lcsLength = prev[n];
  return { added: n - lcsLength, removed: m - lcsLength };
}

function baselineOf(abs: string): Baseline {
  const b = baselines.get(abs);
  if (b) return b;
  // Defensive: fall back to the first recorded change's before state.
  const changes = fileHistory.get(abs);
  const first = changes ? changes[0] : undefined;
  if (!first) return { hash: null, mode: null };
  return { hash: first.beforeHash, mode: first.beforeMode };
}

function buildWidgetData(ctx: ExtensionContext): WidgetData | null {
  if (!currentSnapDir) return null;
  const sessionId = ctx.sessionManager.getSessionId();
  const files: WidgetFile[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;

  for (const [abs, _changes] of fileHistory) {
    const baseline = baselineOf(abs);
    const current = readSnapshot(abs);
    if (current.hash === undefined) continue;
    if (current.hash === baseline.hash) continue;

    const baselinePath =
      baseline.hash !== null && baseline.hash !== undefined
        ? path.join(currentSnapDir, baseline.hash)
        : null;
    const diff = computeLineDiff(baselinePath, abs);

    files.push({
      id: fileIds.get(abs) ?? 0,
      absPath: abs,
      basename: path.basename(abs),
      added: diff !== null ? diff.added : null,
      removed: diff !== null ? diff.removed : null,
      baselineHash: baseline.hash ?? null,
      baselineMode: baseline.mode,
      currentExists: current.hash !== null,
    });

    if (diff !== null) {
      totalAdded += diff.added;
      totalRemoved += diff.removed;
    }
  }

  if (files.length === 0) return null;
  return { sessionId, files, totals: { added: totalAdded, removed: totalRemoved } };
}

/** Restore a single file to its baseline snapshot (null baseline = delete). */
function restoreFileToBaseline(abs: string, baseline: Baseline): boolean {
  try {
    if (baseline.hash === null) {
      fs.rmSync(abs, { force: true });
    } else if (baseline.hash === undefined) {
      // No snapshot was ever persisted for this file (oversized / non-regular) -> nothing to restore.
      return false;
    } else {
      const src = path.join(currentSnapDir ?? "", baseline.hash);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.copyFileSync(src, abs);
    }
    if (baseline.mode !== null) {
      try {
        fs.chmodSync(abs, baseline.mode);
      } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

function refreshWidget(ctx: ExtensionContext): void {
  if (!ctx.hasUI || ctx.mode !== "rpc") return;
  const data = buildWidgetData(ctx);
  if (!data || data.files.length === 0) {
    ctx.ui.setWidget(WIDGET_KEY, undefined);
    return;
  }
  ctx.ui.setWidget(WIDGET_KEY, [JSON.stringify(data)]);
}

function resetState(): void {
  fileHistory.clear();
  pendingBefore.clear();
  baselines.clear();
  fileIds.clear();
  nextRewindId = 1;
}

async function maybeRevert(
  ctx: ExtensionContext,
  targetId: string,
  label: string,
): Promise<{ cancel: true } | undefined> {
  if (!ctx.hasUI) return undefined;

  const order = buildOrderMap(ctx);
  const targetIndex = order.get(targetId);
  if (targetIndex === undefined) {
    ctx.ui.notify("Unable to locate target message, rewinding message only", "info");
    return undefined;
  }

  const affected = countAffected(order, targetIndex);
  if (affected === 0) {
    ctx.ui.notify("No tracked file changes after this message, rewinding message only", "info");
    return undefined;
  }

  if (ctx.mode === "rpc") {
    // Custom per-message dialog rendered entirely in the webview.
    const choice = await ctx.ui.editor("Pi Rewind Confirm", JSON.stringify({ label, affected }));
    if (choice === undefined) {
      return { cancel: true };
    }
    if (choice === "message+code") {
      const { touched, failedPaths } = restoreToEntry(order, targetIndex);
      refreshWidget(ctx);
      const base = `Restored ${touched} files to their state at that message (bash and oversized files not covered)`;
      if (failedPaths.length > 0) {
        ctx.ui.notify(`${base}; ${failedPaths.length} failed: ${failedPaths.join(", ")}`, "error");
      } else {
        ctx.ui.notify(base, "info");
      }
    }
    return undefined;
  }

  // TUI mode: keep the generic select.
  const OPT_MSG_ONLY = "Rewind message only (keep code changes)";
  const OPT_RESTORE = "Rewind message + code (restore files)";
  const choice = await ctx.ui.select(`${label}: also rewind code changes? (${affected} files)`, [
    OPT_MSG_ONLY,
    OPT_RESTORE,
  ]);

  if (choice === undefined) {
    return { cancel: true };
  }

  if (choice === OPT_RESTORE) {
    const { touched, failedPaths } = restoreToEntry(order, targetIndex);
    const base = `Restored ${touched} files to their state at that message (bash and oversized files not covered)`;
    if (failedPaths.length > 0) {
      ctx.ui.notify(`${base}; ${failedPaths.length} failed: ${failedPaths.join(", ")}`, "error");
    } else {
      ctx.ui.notify(base, "info");
    }
  }

  return undefined;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const sessionId = ctx.sessionManager.getSessionId();
    currentSnapDir = path.join(SNAP_ROOT, sessionId);
    resetState();
    sweepStaleSnapshots(sessionId);
    refreshWidget(ctx);
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("edit", event) && !isToolCallEventType("write", event)) return;

    const userEntryId = lastUserEntryId(ctx);
    if (!userEntryId) return;

    if (typeof event.input.path !== "string" || event.input.path.length === 0) return;
    const abs = path.resolve(ctx.cwd, event.input.path);
    const before = readSnapshot(abs);

    let p = pendingBefore.get(event.toolCallId);
    if (!p) {
      p = { userEntryId, files: new Map() };
      pendingBefore.set(event.toolCallId, p);
    }
    p.files.set(abs, before);
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "edit" && event.toolName !== "write") return;

    const p = pendingBefore.get(event.toolCallId);
    pendingBefore.delete(event.toolCallId);
    if (!p) return;

    let changed = false;
    for (const [abs, before] of p.files) {
      if (before.hash === undefined) continue;
      const after = readSnapshot(abs);
      if (after.hash === undefined) continue;
      if (before.hash === after.hash) continue;

      let arr = fileHistory.get(abs);
      if (!arr) {
        arr = [];
        fileHistory.set(abs, arr);
      }
      arr.push({
        atEntryId: p.userEntryId,
        beforeHash: before.hash,
        beforeMode: before.mode,
        afterHash: after.hash,
        afterMode: after.mode,
      });

      if (!baselines.has(abs)) baselines.set(abs, { hash: before.hash, mode: before.mode });
      if (!fileIds.has(abs)) fileIds.set(abs, nextRewindId++);
      changed = true;
    }
    if (changed) refreshWidget(ctx);
  });

  pi.on("session_before_tree", async (event, ctx) => {
    return maybeRevert(ctx, event.preparation.targetId, "Rewind to this message");
  });

  pi.on("session_compact", async (_event, ctx) => {
    resetState();
    refreshWidget(ctx);
  });

  pi.on("session_shutdown", async () => {
    if (currentSnapDir) {
      fs.rmSync(currentSnapDir, { recursive: true, force: true });
      currentSnapDir = undefined;
    }
    resetState();
  });

  pi.registerCommand("rewind-accept", {
    description: "Accept all pending file changes (reset widget baseline)",
    handler: async (_args, ctx) => {
      if (!currentSnapDir) return;
      let accepted = 0;
      let skipped = 0;
      for (const [abs] of fileHistory) {
        const baseline = baselines.get(abs);
        if (!baseline) continue;
        const current = readSnapshot(abs);
        if (current.hash === undefined) {
          skipped++;
          continue;
        }
        if (current.hash === baseline.hash) continue;
        baselines.set(abs, { hash: current.hash, mode: current.mode });
        accepted++;
      }
      refreshWidget(ctx);
      if (skipped > 0) {
        ctx.ui.notify(
          `Accepted ${accepted} file(s) (${skipped} oversized/untracked skipped)`,
          "info",
        );
      } else {
        ctx.ui.notify(`Accepted ${accepted} file(s)`, "info");
      }
    },
  });

  pi.registerCommand("rewind-accept-file", {
    description: "Accept a single file change (baseline = current disk state)",
    handler: async (args, ctx) => {
      if (!currentSnapDir) return;
      const id = Number(String(args ?? "").trim());
      if (!id) return;
      let abs: string | undefined;
      for (const [k, v] of fileIds) {
        if (v === id) {
          abs = k;
          break;
        }
      }
      if (!abs) {
        ctx.ui.notify(`File #${id} not found`, "error");
        return;
      }
      const baseline = baselines.get(abs);
      if (!baseline) return;
      const current = readSnapshot(abs);
      if (current.hash === undefined) {
        ctx.ui.notify(`Skipped oversized/untracked file: ${path.basename(abs)}`, "warning");
        return;
      }
      baselines.set(abs, { hash: current.hash, mode: current.mode });
      refreshWidget(ctx);
      ctx.ui.notify(`Accepted ${path.basename(abs)}`, "info");
    },
  });

  pi.registerCommand("rewind-revert", {
    description: "Revert all pending file changes to their baseline",
    handler: async (_args, ctx) => {
      if (!currentSnapDir) return;
      let reverted = 0;
      let failed = 0;
      for (const [abs] of fileHistory) {
        const baseline = baselines.get(abs);
        if (!baseline) continue;
        const current = readSnapshot(abs);
        if (current.hash === undefined) continue;
        if (current.hash === baseline.hash) continue;
        if (restoreFileToBaseline(abs, baseline)) reverted++;
        else failed++;
      }
      refreshWidget(ctx);
      if (failed > 0) {
        ctx.ui.notify(`Reverted ${reverted} file(s) to baseline (${failed} failed)`, "error");
      } else {
        ctx.ui.notify(`Reverted ${reverted} file(s) to baseline`, "info");
      }
    },
  });

  pi.registerCommand("rewind-revert-file", {
    description: "Revert a single file to its baseline",
    handler: async (args, ctx) => {
      if (!currentSnapDir) return;
      const id = Number(String(args ?? "").trim());
      if (!id) return;
      let abs: string | undefined;
      for (const [k, v] of fileIds) {
        if (v === id) {
          abs = k;
          break;
        }
      }
      if (!abs) {
        ctx.ui.notify(`File #${id} not found`, "error");
        return;
      }
      const baseline = baselines.get(abs);
      if (!baseline) return;
      const current = readSnapshot(abs);
      if (current.hash === undefined) return;
      if (current.hash === baseline.hash) return;
      if (restoreFileToBaseline(abs, baseline)) {
        refreshWidget(ctx);
        ctx.ui.notify(`Reverted ${path.basename(abs)} to baseline`, "info");
      } else {
        ctx.ui.notify(`Failed to revert ${path.basename(abs)}`, "error");
      }
    },
  });
}
