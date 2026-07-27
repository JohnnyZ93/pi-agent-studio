import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import {
  getOAuthProviders,
  getOAuthProviderStatuses,
  invalidateModelRuntime,
  logout,
} from "./auth-config.ts";

// Auth interaction shapes (mirrors pi-ai's AuthPrompt / AuthEvent / AuthInteraction,
// declared locally because @earendil-works/pi-ai is only a transitive dependency).
type AuthPrompt =
  | { type: "text"; message: string; placeholder?: string; signal?: AbortSignal }
  | { type: "secret"; message: string; placeholder?: string; signal?: AbortSignal }
  | {
      type: "select";
      message: string;
      options: readonly { id: string; label: string; description?: string }[];
      signal?: AbortSignal;
    }
  | { type: "manual_code"; message: string; placeholder?: string; signal?: AbortSignal };

type AuthEvent =
  | { type: "info"; message: string; links?: readonly { url: string; label?: string }[] }
  | { type: "auth_url"; url: string; instructions?: string }
  | {
      type: "device_code";
      userCode: string;
      verificationUri: string;
      intervalSeconds?: number;
      expiresInSeconds?: number;
    }
  | { type: "progress"; message: string };

interface AuthInteraction {
  signal?: AbortSignal;
  prompt(prompt: AuthPrompt): Promise<string>;
  notify(event: AuthEvent): void;
}

export interface OAuthProgressEvent {
  type:
    | "auth_url"
    | "device_code"
    | "prompt"
    | "select"
    | "progress"
    | "success"
    | "error"
    | "cancelled";
  url?: string;
  instructions?: string;
  userCode?: string;
  verificationUri?: string;
  message?: string;
  placeholder?: string;
  options?: { id: string; label: string }[];
  token?: string;
}

export interface OAuthFlowController {
  onProgress: (callback: (event: OAuthProgressEvent) => void) => void;
  respond: (token: string, value: string) => void;
  cancel: () => void;
}

interface PendingRequest {
  resolve: (v: string) => void;
  reject: (e: Error) => void;
}

function createToken(providerId: string): string {
  return `${providerId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Run an OAuth login for the given provider.
 *
 * Mirrors pi-web's `app/api/auth/login/[provider]/route.ts` SSE handler, but
 * in-process: instead of an HTTP request/response registry we use an
 * in-memory token -> promise map that the webview drives via `respond()`.
 *
 * 0.80.8 moved OAuth orchestration off the removed `AuthStorage.login()` onto
 * `ModelRuntime.login(providerId, "oauth", interaction)` with two callbacks:
 *   - `notify(event)` for one-way UI updates (auth_url / device_code / progress)
 *   - `prompt(prompt)` for awaited user input (manual_code / text / select)
 *
 * Key invariant (carried over from the AuthStorage era, still required by
 * pi-ai's OpenAI Codex / Anthropic providers): the browser-raced flows call
 * `notify(auth_url)` and then `prompt(manual_code)` which races a local
 * callback server. Both must resolve the SAME "manual input" promise, so the
 * "paste authorization code" box shown under the auth URL and the promise the
 * SDK awaits are the same object. We memoize that request on the first
 * `notify(auth_url)` (or first `prompt(manual_code)`) and reuse it.
 *
 * `ModelRuntime.login()` persists the REAL OAuth credentials to auth.json
 * itself via the credential store - we must NOT overwrite them afterwards.
 */
export function startOAuthFlow(providerId: string): OAuthFlowController {
  const listeners: Array<(event: OAuthProgressEvent) => void> = [];
  const pendingRequests = new Map<string, PendingRequest>();

  const emit = (event: OAuthProgressEvent) => {
    for (const cb of listeners) cb(event);
  };

  const abort = new AbortController();

  const wireAbort = (token: string, signal: AbortSignal): void => {
    if (signal.aborted) {
      const req = pendingRequests.get(token);
      if (req) {
        pendingRequests.delete(token);
        req.reject(new Error("Login cancelled"));
      }
      return;
    }
    const onAbort = () => {
      const req = pendingRequests.get(token);
      if (req) {
        pendingRequests.delete(token);
        req.reject(new Error("Login cancelled"));
      }
      signal.removeEventListener("abort", onAbort);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  };

  // A one-shot client input request (token + promise) the webview resolves
  // via `respond(token, value)`.
  const createClientInputRequest = (
    signal?: AbortSignal,
  ): { token: string; promise: Promise<string> } => {
    const token = createToken(providerId);
    const promise = new Promise<string>((resolve, reject) => {
      pendingRequests.set(token, { resolve, reject });
    });
    if (signal) wireAbort(token, signal);
    return { token, promise };
  };

  // The shared "manual input" request - memoized so notify(auth_url) and
  // prompt(manual_code) resolve the same promise. Cleared once it settles.
  let pendingManual: { token: string; promise: Promise<string>; emitted: boolean } | undefined;
  const getManualInputRequest = (
    signal?: AbortSignal,
  ): {
    token: string;
    promise: Promise<string>;
    emitted: boolean;
  } => {
    if (!pendingManual) {
      const { token, promise } = createClientInputRequest(signal);
      pendingManual = { token, promise, emitted: false };
      pendingManual.promise
        .finally(() => {
          pendingManual = undefined;
        })
        .catch(() => {
          // Swallow rejection from cleanup() so it doesn't surface as an
          // unhandled promise rejection. The SDK already saw the result
          // (or threw its own error) by the time we cancel.
        });
    } else if (signal) {
      wireAbort(pendingManual.token, signal);
    }
    return pendingManual;
  };

  const cleanup = () => {
    for (const [, req] of pendingRequests) {
      req.reject(new Error("Login cancelled"));
    }
    pendingRequests.clear();
    pendingManual = undefined;
  };

  // Defer the login run to a microtask so callers can attach their
  // onProgress listener synchronously AFTER startOAuthFlow() returns.
  // The first provider callback (notify / prompt) fires synchronously inside
  // modelRuntime.login() - if we ran the IIFE inline, that first emit() would
  // race ahead of the listener registration and the webview would never see
  // the initial auth_url/device_code event (looked like "clicking Login does nothing").
  queueMicrotask(() => {
    void (async () => {
      try {
        const providers = await getOAuthProviders();
        const providerInfo = providers.find((p) => p.id === providerId);
        if (!providerInfo) {
          emit({ type: "error", message: `Unknown OAuth provider: ${providerId}` });
          return;
        }

        const modelRuntime = await ModelRuntime.create();

        const interaction: AuthInteraction = {
          signal: abort.signal,
          notify: (event: AuthEvent) => {
            if (event.type === "auth_url") {
              // Surface the URL with the shared manual-input token so the
              // "paste code" box resolves the same promise prompt(manual_code)
              // returns to the SDK.
              const request = getManualInputRequest();
              request.emitted = true;
              emit({
                type: "auth_url",
                url: event.url,
                instructions: event.instructions ?? undefined,
                token: request.token,
              });
            } else if (event.type === "device_code") {
              emit({
                type: "device_code",
                userCode: event.userCode,
                verificationUri: event.verificationUri,
              });
            } else {
              // "progress" | "info" - both carry a human-readable message.
              emit({ type: "progress", message: event.message });
            }
          },
          prompt: async (prompt: AuthPrompt): Promise<string> => {
            if (prompt.type === "manual_code") {
              const request = getManualInputRequest(prompt.signal);
              if (!request.emitted) {
                // No auth_url was shown; surface a generic input so the user
                // can still paste the code / redirect URL.
                request.emitted = true;
                emit({
                  type: "prompt",
                  message: prompt.message,
                  placeholder: prompt.placeholder ?? undefined,
                  token: request.token,
                });
              }
              return request.promise;
            }
            if (prompt.type === "select") {
              const { token, promise } = createClientInputRequest(prompt.signal);
              emit({
                type: "select",
                message: prompt.message,
                options: prompt.options.map((o) => ({ id: o.id, label: o.label })),
                token,
              });
              return promise;
            }
            // "text" | "secret"
            const { token, promise } = createClientInputRequest(prompt.signal);
            emit({
              type: "prompt",
              message: prompt.message,
              placeholder: prompt.placeholder ?? undefined,
              token,
            });
            return promise;
          },
        };

        await modelRuntime.login(providerId, "oauth", interaction);

        emit({ type: "success" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "Login cancelled" || msg === "OAuth login cancelled") {
          emit({ type: "cancelled" });
        } else {
          emit({ type: "error", message: msg });
        }
      } finally {
        cleanup();
      }
    })();
  });

  return {
    onProgress(callback) {
      listeners.push(callback);
    },
    respond(token, value) {
      const req = pendingRequests.get(token);
      if (req) {
        pendingRequests.delete(token);
        req.resolve(value);
      }
    },
    cancel() {
      abort.abort();
      cleanup();
    },
  };
}

// Re-export from auth-config for convenience
export { getOAuthProviderStatuses, invalidateModelRuntime, logout as logoutOAuth };
