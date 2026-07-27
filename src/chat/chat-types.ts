// RPC protocol types (subset of pi's rpc.md) + webview<->extension postMessage protocol.

export interface RpcModel {
  id: string;
  name?: string;
  provider: string;
  api?: string;
  baseUrl?: string;
  reasoning?: boolean;
  input?: string[];
  contextWindow?: number;
  maxTokens?: number;
  cost?: Record<string, unknown>;
}

export interface RpcContextUsage {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
}

export interface RpcState {
  model: RpcModel | null;
  thinkingLevel: string;
  isStreaming: boolean;
  isCompacting?: boolean;
  sessionFile?: string;
  sessionId?: string;
  sessionName?: string;
  messageCount?: number;
  pendingMessageCount?: number;
}

export interface RpcCommand {
  name: string;
  description?: string;
  source: "extension" | "prompt" | "skill";
  location?: string;
  path?: string;
}

export interface RpcResponse {
  id?: string | number;
  type: "response";
  command: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Typed client over a `pi --mode rpc` subprocess. */
export interface RpcClient {
  send(command: Record<string, unknown>): void;
  request<T = unknown>(command: Record<string, unknown>): Promise<T>;
  prompt(message: string, streamingBehavior?: "steer" | "followUp"): Promise<void>;
  abort(): Promise<void>;
  setModel(provider: string, modelId: string): Promise<RpcModel>;
  setThinkingLevel(level: string): Promise<void>;
  getAvailableModels(): Promise<RpcModel[]>;
  getAvailableThinkingLevels(): Promise<string[]>;
  getCommands(): Promise<RpcCommand[]>;
  getMessages(): Promise<unknown[]>;
  getState(): Promise<RpcState>;
  getSessionStats(): Promise<RpcContextUsage | null>;
  newSession(): Promise<{ cancelled: boolean }>;
  switchSession(sessionPath: string): Promise<{ cancelled: boolean }>;
  respondExtensionUi(
    id: string,
    payload: { value?: string; confirmed?: boolean; cancelled?: boolean },
  ): void;
  dispose(): Promise<void>;
}

export type RpcEvent = { type: string } & Record<string, unknown>;

export interface ExtensionUiRequest {
  type: "extension_ui_request";
  id: string;
  method:
    | "select"
    | "confirm"
    | "input"
    | "editor"
    | "notify"
    | "setStatus"
    | "setWidget"
    | "setTitle"
    | "set_editor_text";
  [k: string]: unknown;
}

// ---- postMessage: extension -> webview ----
export type ExtToWebview =
  | { type: "ready" }
  | { type: "state"; state: RpcState }
  | { type: "models"; models: RpcModel[] }
  | { type: "thinkingLevels"; levels: string[] }
  | { type: "commands"; commands: RpcCommand[] }
  | { type: "messages"; messages: unknown[] }
  | { type: "event"; event: RpcEvent }
  | { type: "dialog"; request: ExtensionUiRequest }
  | { type: "pickedResources"; paths: string[] }
  | { type: "contextUsage"; usage: RpcContextUsage | null }
  | { type: "error"; message: string };

// ---- postMessage: webview -> extension ----
export type WebviewToExt =
  | { type: "prompt"; message: string; streamingBehavior?: "steer" | "followUp" }
  | { type: "abort" }
  | { type: "pickResource" }
  | { type: "setModel"; provider: string; modelId: string }
  | { type: "setThinking"; level: string }
  | { type: "newSession" }
  | {
      type: "dialogResponse";
      id: string;
      value?: string;
      confirmed?: boolean;
      cancelled?: boolean;
    };
