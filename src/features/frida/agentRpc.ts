import type { UnlistenFn } from "@tauri-apps/api/event";

import type { ScriptMessageEvent } from "./types";
import { fridaBackendApi } from "./backendApi";
import { fridaEvents } from "./events";

// Default timeout for RPC requests (ms)
const RPC_TIMEOUT_MS = 10000;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

// Event handler type for carf:event messages
type EventHandler = (event: { event: string; [key: string]: unknown }) => void;

const pending = new Map<number, PendingRequest>();
const eventHandlers = new Set<EventHandler>();

let unlisten: UnlistenFn | null = null;
let nextRequestId = 1;

// Check if message is a carf:response
function isCarfResponse(event: ScriptMessageEvent): event is ScriptMessageEvent & {
  message: {
    type: "send";
    payload: { type: "carf:response"; id: number; result: "ok" | "error"; returns: unknown };
  };
} {
  const msg = event.message as { type?: unknown; payload?: unknown };
  if (!msg || msg.type !== "send") return false;

  const payload = msg.payload as {
    type?: unknown;
    id?: unknown;
    result?: unknown;
    returns?: unknown;
  };

  return (
    !!payload &&
    payload.type === "carf:response" &&
    typeof payload.id === "number" &&
    (payload.result === "ok" || payload.result === "error")
  );
}

// Check if message is a carf:event
function isCarfEvent(event: ScriptMessageEvent): event is ScriptMessageEvent & {
  message: {
    type: "send";
    payload: { type: "carf:event"; event: string; [key: string]: unknown };
  };
} {
  const msg = event.message as { type?: unknown; payload?: unknown };
  if (!msg || msg.type !== "send") return false;

  const payload = msg.payload as { type?: unknown; event?: unknown };
  return !!payload && payload.type === "carf:event" && typeof payload.event === "string";
}

// Normalize agent error payload to JS Error
function normalizeError(returns: unknown): Error {
  if (returns instanceof Error) return returns;
  
  const payload = returns as { message?: string; stack?: string } | null;
  const message = payload?.message ?? "Agent error";
  const err = new Error(message);
  if (payload?.stack) err.stack = payload.stack;
  return err;
}

export type AgentRpc = {
  start: () => Promise<void>;
  stop: () => void;
  clearPending: () => void;
  request: (scriptId: number, method: string, params?: unknown) => Promise<unknown>;
  onEvent: (handler: EventHandler) => () => void;
};

// RPC helper for talking to the injected agent.
export const agentRpc: AgentRpc = {
  start: async () => {
    if (unlisten) return;

    unlisten = await fridaEvents.scriptMessage((payload) => {
      // Handle carf:response messages
      if (isCarfResponse(payload)) {
        const { id, result, returns } = payload.message.payload;
        const req = pending.get(id);
        if (!req) return;

        clearTimeout(req.timer);
        pending.delete(id);

        if (result === "ok") {
          req.resolve(returns);
        } else {
          req.reject(normalizeError(returns));
        }
        return;
      }

      // Handle carf:event messages
      if (isCarfEvent(payload)) {
        const eventPayload = payload.message.payload;
        eventHandlers.forEach((handler) => {
          try {
            handler(eventPayload);
          } catch (e) {
            console.error("Event handler error:", e);
          }
        });
        return;
      }
    });
  },

  stop: () => {
    if (!unlisten) return;
    const fn = unlisten;
    unlisten = null;

    // Reject all pending requests before clearing
    pending.forEach((req) => {
      clearTimeout(req.timer);
      req.reject(new Error("RPC stopped"));
    });
    pending.clear();

    fn();
  },

  // Clear pending requests without stopping listeners (called on session detach)
  clearPending: () => {
    pending.forEach((req) => {
      clearTimeout(req.timer);
      req.reject(new Error("Session detached"));
    });
    pending.clear();
  },

  request: async (scriptId, method, params) => {
    await agentRpc.start();

    const id = nextRequestId++;
    const message = {
      type: "carf:request",
      payload: {
        id,
        method,
        params,
      },
    };

    const p = new Promise<unknown>((resolve, reject) => {
      // Setup timeout to prevent hanging requests
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`RPC timeout: ${method} (${RPC_TIMEOUT_MS}ms)`));
      }, RPC_TIMEOUT_MS);

      pending.set(id, { resolve, reject, timer });
    });

    // If scriptPost fails, cleanup pending and rethrow
    try {
      await fridaBackendApi.scriptPost(scriptId, message);
    } catch (e) {
      const req = pending.get(id);
      if (req) {
        clearTimeout(req.timer);
        pending.delete(id);
      }
      throw e;
    }

    return await p;
  },

  // Subscribe to carf:event messages from agent
  onEvent: (handler: EventHandler) => {
    eventHandlers.add(handler);
    return () => {
      eventHandlers.delete(handler);
    };
  },
};
