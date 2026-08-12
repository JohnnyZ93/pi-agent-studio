import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { normalizePiSpawnTarget } from "../pi.ts";
import { rpcTrace, rpcTraceErr } from "./rpc-trace.ts";
import type {
  ExtensionUiRequest,
  RpcClient,
  RpcCommand,
  RpcCompactionResult,
  RpcContextUsage,
  RpcEntriesData,
  RpcEvent,
  RpcModel,
  RpcResponse,
  RpcSessionStats,
  RpcState,
} from "./chat-types.ts";

export interface RpcClientHandlers {
  onEvent: (event: RpcEvent) => void;
  onExtensionUiRequest: (request: ExtensionUiRequest) => void;
  onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
  onError: (err: Error) => void;
}

export interface CreateRpcClientOptions {
  piPath: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  traceTag?: string;
  handlers: RpcClientHandlers;
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export async function createRpcClient(options: CreateRpcClientOptions): Promise<RpcClient> {
  const traceTag = options.traceTag ?? "rpc";
  const target = normalizePiSpawnTarget(options.piPath, options.args);
  const proc: ChildProcess = spawn(target.command, target.args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...options.env },
    cwd: options.cwd,
    windowsHide: true,
  });

  const pending = new Map<string, Pending>();
  let disposed = false;

  const failAll = (message: string) => {
    for (const [, p] of pending) p.reject(new Error(message));
    pending.clear();
  };

  const attachJsonlReader = (
    stream: NodeJS.ReadableStream | null,
    onLine: (line: string) => void,
  ) => {
    if (!stream) return;
    const decoder = new StringDecoder("utf8");
    let buffer = "";
    stream.on("data", (chunk: Buffer | string) => {
      buffer += typeof chunk === "string" ? chunk : decoder.write(chunk);
      while (true) {
        const nl = buffer.indexOf("\n");
        if (nl === -1) break;
        let line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.length > 0) onLine(line);
      }
    });
    stream.on("end", () => {
      buffer += decoder.end();
      if (buffer.length > 0) {
        let line = buffer;
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.length > 0) onLine(line);
      }
    });
  };

  attachJsonlReader(proc.stdout, (line) => {
    rpcTrace(traceTag, "in", line);
    let msg: unknown;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;
    const obj = msg as { type?: string };
    if (obj.type === "response") {
      const resp = obj as RpcResponse;
      const key = resp.id;
      const p = key !== undefined ? pending.get(String(key)) : undefined;
      if (p) {
        pending.delete(String(key));
        if (resp.success) p.resolve(resp.data);
        else p.reject(new Error(resp.error ?? `RPC command "${resp.command}" failed`));
      }
    } else if (obj.type === "extension_ui_request") {
      options.handlers.onExtensionUiRequest(obj as ExtensionUiRequest);
    } else {
      options.handlers.onEvent(obj as RpcEvent);
    }
  });

  attachJsonlReader(proc.stderr, (line) => {
    rpcTraceErr(traceTag, line);
  });

  proc.on("error", (err) => {
    options.handlers.onError(err);
    failAll(err.message);
  });
  proc.on("exit", (code, signal) => {
    failAll("Pi RPC process exited");
    options.handlers.onExit(code, signal);
  });

  const send = (command: Record<string, unknown>): void => {
    if (disposed || !proc.stdin || proc.stdin.destroyed) {
      throw new Error("Pi RPC process is not running");
    }
    const json = JSON.stringify(command);
    proc.stdin.write(json + "\n");
    rpcTrace(traceTag, "out", json);
  };

  const request = <T>(command: Record<string, unknown>): Promise<T> => {
    const id = randomUUID();
    return new Promise<T>((resolve, reject) => {
      pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      });
      try {
        send({ ...command, id });
      } catch (e) {
        pending.delete(id);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  };

  const respondExtensionUi = (
    id: string,
    payload: { value?: string; confirmed?: boolean; cancelled?: boolean },
  ): void => {
    const resp: Record<string, unknown> = { type: "extension_ui_response", id };
    if (payload.cancelled) {
      resp.cancelled = true;
    } else if (payload.confirmed !== undefined) {
      resp.confirmed = !!payload.confirmed;
    } else if (payload.value !== undefined) {
      resp.value = payload.value;
    } else {
      resp.cancelled = true;
    }
    try {
      send(resp);
    } catch {
      // process gone; nothing to do
    }
  };

  const dispose = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    disposed = true;
    failAll("Pi RPC client disposed");
    if (proc.pid !== undefined && !proc.killed) {
      if (process.platform === "win32") {
        try {
          spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
            windowsHide: true,
          });
        } catch {
          // ignore
        }
      }
      try {
        proc.kill();
      } catch {
        // ignore
      }
    }
    return Promise.resolve();
  };

  return {
    send,
    request,
    prompt: (message, streamingBehavior, images) =>
      request<void>({
        type: "prompt",
        message,
        ...(streamingBehavior ? { streamingBehavior } : {}),
        ...(images && images.length ? { images } : {}),
      }),
    abort: () => request<void>({ type: "abort" }),
    setModel: (provider, modelId) => request<RpcModel>({ type: "set_model", provider, modelId }),
    setThinkingLevel: (level) => request<void>({ type: "set_thinking_level", level }),
    getAvailableModels: () =>
      request<{ models: RpcModel[] }>({ type: "get_available_models" }).then((d) => d.models),
    getAvailableThinkingLevels: () =>
      request<{ levels: string[] }>({ type: "get_available_thinking_levels" }).then(
        (d) => d.levels,
      ),
    getCommands: () =>
      request<{ commands: RpcCommand[] }>({ type: "get_commands" }).then((d) => d.commands),
    getMessages: () =>
      request<{ messages: unknown[] }>({ type: "get_messages" }).then((d) => d.messages),
    getState: () => request<RpcState>({ type: "get_state" }),
    getSessionStats: () =>
      request<{ contextUsage?: RpcContextUsage | null }>({ type: "get_session_stats" }).then(
        (d) => d.contextUsage ?? null,
      ),
    getSessionStatsFull: () => request<RpcSessionStats>({ type: "get_session_stats" }),
    compact: (customInstructions) =>
      request<RpcCompactionResult>(
        customInstructions ? { type: "compact", customInstructions } : { type: "compact" },
      ),
    setAutoCompaction: (enabled) => request<void>({ type: "set_auto_compaction", enabled }),
    setSessionName: (name) => request<void>({ type: "set_session_name", name }),
    newSession: () => request<{ cancelled: boolean }>({ type: "new_session" }),
    switchSession: (sessionPath) =>
      request<{ cancelled: boolean }>({ type: "switch_session", sessionPath }),
    getEntries: () => request<RpcEntriesData>({ type: "get_entries" }),
    fork: (entryId) => request<{ text: string; cancelled: boolean }>({ type: "fork", entryId }),
    respondExtensionUi,
    dispose,
  } satisfies RpcClient;
}
