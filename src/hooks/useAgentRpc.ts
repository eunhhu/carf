/**
 * useAgentRpc - React hook for Agent RPC communication
 * 
 * Provides typed RPC request/response handling with the injected Frida agent.
 * Supports request timeout, event subscription, and automatic cleanup.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================

export type ScriptMessageEvent = {
  session_id: number;
  script_id: number;
  message: unknown;
  data?: number[];
};

export type AgentEvent = {
  event: string;
  [key: string]: unknown;
};

export type AgentEventHandler = (event: AgentEvent) => void;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT_MS = 10000;

// ============================================================================
// Hook
// ============================================================================

type UseAgentRpcOptions = {
  /** Script ID to communicate with */
  scriptId: number | null;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Auto-start listening on mount */
  autoStart?: boolean;
};

export function useAgentRpc(options: UseAgentRpcOptions) {
  const { scriptId, timeout = DEFAULT_TIMEOUT_MS, autoStart = true } = options;

  const [isListening, setIsListening] = useState(false);
  const pendingRef = useRef(new Map<number, PendingRequest>());
  const eventHandlersRef = useRef(new Set<AgentEventHandler>());
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const nextIdRef = useRef(1);

  // Check if message is a carf:response
  const isCarfResponse = useCallback((event: ScriptMessageEvent): boolean => {
    const msg = event.message as { type?: unknown; payload?: unknown };
    if (!msg || msg.type !== "send") return false;

    const payload = msg.payload as {
      type?: unknown;
      id?: unknown;
      result?: unknown;
    };

    return (
      !!payload &&
      payload.type === "carf:response" &&
      typeof payload.id === "number" &&
      (payload.result === "ok" || payload.result === "error")
    );
  }, []);

  // Check if message is a carf:event
  const isCarfEvent = useCallback((event: ScriptMessageEvent): boolean => {
    const msg = event.message as { type?: unknown; payload?: unknown };
    if (!msg || msg.type !== "send") return false;

    const payload = msg.payload as { type?: unknown; event?: unknown };
    return !!payload && payload.type === "carf:event" && typeof payload.event === "string";
  }, []);

  // Handle incoming script messages
  const handleMessage = useCallback(
    (event: ScriptMessageEvent) => {
      if (scriptId !== null && event.script_id !== scriptId) return;

      // Handle RPC responses
      if (isCarfResponse(event)) {
        const msg = event.message as {
          payload: { id: number; result: "ok" | "error"; returns: unknown };
        };
        const { id, result, returns } = msg.payload;
        const req = pendingRef.current.get(id);
        if (!req) return;

        clearTimeout(req.timer);
        pendingRef.current.delete(id);

        if (result === "ok") {
          req.resolve(returns);
        } else {
          const payload = returns as { message?: string; stack?: string } | null;
          const err = new Error(payload?.message ?? "Agent error");
          if (payload?.stack) err.stack = payload.stack;
          req.reject(err);
        }
        return;
      }

      // Handle agent events
      if (isCarfEvent(event)) {
        const msg = event.message as { payload: AgentEvent };
        eventHandlersRef.current.forEach((handler) => {
          try {
            handler(msg.payload);
          } catch (e) {
            console.error("[useAgentRpc] Event handler error:", e);
          }
        });
      }
    },
    [scriptId, isCarfResponse, isCarfEvent]
  );

  // Start listening for script messages
  const start = useCallback(async () => {
    if (unlistenRef.current) return;

    unlistenRef.current = await listen<ScriptMessageEvent>(
      "frida_script_message",
      (event) => handleMessage(event.payload)
    );
    setIsListening(true);
  }, [handleMessage]);

  // Stop listening and reject all pending requests
  const stop = useCallback(() => {
    if (!unlistenRef.current) return;

    // Reject all pending requests
    pendingRef.current.forEach((req) => {
      clearTimeout(req.timer);
      req.reject(new Error("RPC stopped"));
    });
    pendingRef.current.clear();

    unlistenRef.current();
    unlistenRef.current = null;
    setIsListening(false);
  }, []);

  // Send an RPC request to the agent
  const request = useCallback(
    async <T = unknown>(method: string, params?: unknown): Promise<T> => {
      if (scriptId === null) {
        throw new Error("No script loaded");
      }

      // Auto-start if not listening
      if (!unlistenRef.current) {
        await start();
      }

      const id = nextIdRef.current++;
      const message = {
        type: "carf:request",
        payload: { id, method, params },
      };

      const promise = new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingRef.current.delete(id);
          reject(new Error(`RPC timeout: ${method} (${timeout}ms)`));
        }, timeout);

        pendingRef.current.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
          timer,
        });
      });

      try {
        await invoke<void>("frida_script_post", {
          script_id: scriptId,
          message,
          data: undefined,
        });
      } catch (e) {
        const req = pendingRef.current.get(id);
        if (req) {
          clearTimeout(req.timer);
          pendingRef.current.delete(id);
        }
        throw e;
      }

      return promise;
    },
    [scriptId, timeout, start]
  );

  // Subscribe to agent events
  const onEvent = useCallback((handler: AgentEventHandler): (() => void) => {
    eventHandlersRef.current.add(handler);
    return () => {
      eventHandlersRef.current.delete(handler);
    };
  }, []);

  // Auto-start on mount if enabled
  useEffect(() => {
    if (autoStart && scriptId !== null) {
      start();
    }
    return () => {
      stop();
    };
  }, [autoStart, scriptId, start, stop]);

  return {
    /** Whether the hook is currently listening for messages */
    isListening,
    /** Start listening for script messages */
    start,
    /** Stop listening and reject pending requests */
    stop,
    /** Send an RPC request to the agent */
    request,
    /** Subscribe to agent events (returns unsubscribe function) */
    onEvent,
  };
}

// ============================================================================
// Typed RPC helper (for convenience)
// ============================================================================

/**
 * Create a typed RPC caller for a specific method
 * 
 * @example
 * const rpc = useAgentRpc({ scriptId });
 * const enumerateModules = createRpcMethod<void, ModuleInfo[]>(rpc, "enumerate_modules");
 * const modules = await enumerateModules();
 */
export function createRpcMethod<TParams, TResult>(
  rpc: ReturnType<typeof useAgentRpc>,
  method: string
) {
  return async (params?: TParams): Promise<TResult> => {
    return await rpc.request<TResult>(method, params);
  };
}
