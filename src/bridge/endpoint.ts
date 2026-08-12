export type BridgeEndpoint =
  | { kind: "tcp"; port: number; invalid?: boolean }
  | { kind: "socket"; path: string; unique?: boolean };

export function resolveEndpoint(
  value: string | undefined,
  instanceId: string | number,
): BridgeEndpoint {
  const raw = value?.trim() ?? "";
  if (raw === "") return { kind: "tcp", port: 0 };
  if (/^\d+$/.test(raw)) {
    const port = Number(raw);
    if (port >= 1 && port <= 65535) return { kind: "tcp", port };
    return { kind: "tcp", port: 0, invalid: true };
  }
  const substituted = raw.replaceAll("{windowId}", String(instanceId));
  if (substituted === "") return { kind: "tcp", port: 0, invalid: true };
  return {
    kind: "socket",
    path: substituted,
    ...(substituted !== raw ? { unique: true } : {}),
  };
}
