/** Minimum Node.js version required by the pi installer (docs/install.ps1). */
const MIN_NODE_VERSION = [22, 19, 0];

/**
 * Compare a "x.y.z" version string against the minimum supported Node.js version
 * (22.19.0). Returns false for unparseable or too-old versions.
 */
export function isNodeVersionSupported(version: string): boolean {
  const parts = version.replace(/^v/, "").split(".").map(Number);
  if (parts.length < 2 || parts.some(Number.isNaN)) return false;
  for (let i = 0; i < MIN_NODE_VERSION.length; i++) {
    const a = parts[i] ?? 0;
    const b = MIN_NODE_VERSION[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return true;
}
