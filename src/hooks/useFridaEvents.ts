/**
 * useFridaEvents - React hook for subscribing to Frida backend events
 * 
 * Provides event listeners for session attach/detach and script messages.
 * Returns cleanup functions for each subscription.
 */

import { useCallback, useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// ============================================================================
// Types
// ============================================================================

export type SessionDetachReason = "user" | "disposed";

export type SessionAttachedEvent = {
  session_id: number;
  script_id: number;
  device_id: string;
  pid: number;
};

export type SessionDetachedEvent = {
  session_id: number;
  reason: SessionDetachReason;
};

export type ScriptMessageEvent = {
  session_id: number;
  script_id: number;
  message: unknown;
  data?: number[];
};

export type SessionAttachedHandler = (event: SessionAttachedEvent) => void;
export type SessionDetachedHandler = (event: SessionDetachedEvent) => void;
export type ScriptMessageHandler = (event: ScriptMessageEvent) => void;

// ============================================================================
// Hook
// ============================================================================

export function useFridaEvents() {
  // Subscribe to session attached events
  const onSessionAttached = useCallback(
    async (handler: SessionAttachedHandler): Promise<UnlistenFn> => {
      return await listen<SessionAttachedEvent>("frida_session_attached", (event) => {
        handler(event.payload);
      });
    },
    []
  );

  // Subscribe to session detached events
  const onSessionDetached = useCallback(
    async (handler: SessionDetachedHandler): Promise<UnlistenFn> => {
      return await listen<SessionDetachedEvent>("frida_session_detached", (event) => {
        handler(event.payload);
      });
    },
    []
  );

  // Subscribe to script message events (raw messages from agent)
  const onScriptMessage = useCallback(
    async (handler: ScriptMessageHandler): Promise<UnlistenFn> => {
      return await listen<ScriptMessageEvent>("frida_script_message", (event) => {
        handler(event.payload);
      });
    },
    []
  );

  return {
    onSessionAttached,
    onSessionDetached,
    onScriptMessage,
  };
}

// ============================================================================
// Convenience hook for auto-cleanup subscriptions
// ============================================================================

type FridaEventHandlers = {
  onSessionAttached?: SessionAttachedHandler;
  onSessionDetached?: SessionDetachedHandler;
  onScriptMessage?: ScriptMessageHandler;
};

/**
 * useAutoFridaEvents - Auto-subscribes to events and cleans up on unmount
 * 
 * @example
 * useAutoFridaEvents({
 *   onSessionAttached: (e) => console.log("Attached:", e.session_id),
 *   onSessionDetached: (e) => console.log("Detached:", e.reason),
 *   onScriptMessage: (e) => console.log("Message:", e.message),
 * });
 */
export function useAutoFridaEvents(handlers: FridaEventHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setup = async () => {
      if (handlersRef.current.onSessionAttached) {
        const unlisten = await listen<SessionAttachedEvent>(
          "frida_session_attached",
          (event) => handlersRef.current.onSessionAttached?.(event.payload)
        );
        unlisteners.push(unlisten);
      }

      if (handlersRef.current.onSessionDetached) {
        const unlisten = await listen<SessionDetachedEvent>(
          "frida_session_detached",
          (event) => handlersRef.current.onSessionDetached?.(event.payload)
        );
        unlisteners.push(unlisten);
      }

      if (handlersRef.current.onScriptMessage) {
        const unlisten = await listen<ScriptMessageEvent>(
          "frida_script_message",
          (event) => handlersRef.current.onScriptMessage?.(event.payload)
        );
        unlisteners.push(unlisten);
      }
    };

    setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, []);
}
