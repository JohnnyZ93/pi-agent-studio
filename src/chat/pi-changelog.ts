import { execFile } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PI_PACKAGE_NAME = "@earendil-works/pi-coding-agent";
const MAX_CHARS = 20000;

function truncate(content: string): string {
  return content.length > MAX_CHARS
    ? content.slice(0, MAX_CHARS) + "\n\n...(truncated)..."
    : content;
}

async function findPackageRoot(startDir: string): Promise<string | null> {
  let dir = startDir;
  for (let i = 0; i < 12; i++) {
    try {
      const raw = await readFile(join(dir, "package.json"), "utf8");
      const pkg = JSON.parse(raw) as { name?: string };
      if (pkg.name === PI_PACKAGE_NAME) return dir;
    } catch {
      // not this directory
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

async function readChangelogAt(dir: string): Promise<string | null> {
  try {
    const content = await readFile(join(dir, "CHANGELOG.md"), "utf8");
    return truncate(content);
  } catch {
    return null;
  }
}

export async function readPiChangelog(piPath: string | undefined): Promise<string | null> {
  if (!piPath) return null;
  let resolved = piPath;
  try {
    resolved = await realpath(piPath);
  } catch {
    resolved = piPath;
  }

  const root = await findPackageRoot(dirname(resolved));
  if (root) {
    const content = await readChangelogAt(root);
    if (content != null) return content;
  }

  try {
    const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
    const { stdout } = await execFileAsync(npmBin, ["root", "-g"]);
    const globalRoot = stdout.trim();
    if (globalRoot) {
      const content = await readChangelogAt(join(globalRoot, PI_PACKAGE_NAME));
      if (content != null) return content;
    }
  } catch {
    // best-effort fallback
  }

  return null;
}
