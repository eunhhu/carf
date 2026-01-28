import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { ScriptMessageEvent, SessionAttachedEvent, SessionDetachedEvent } from "./types";

// Check if running in Tauri environment
const isTauri = () => {
  return typeof window !== "undefined" && "__TAURI__" in window;
};

// No-op unlisten function for non-Tauri environments
const noopUnlisten: UnlistenFn = () => {};

// Typed event listeners around Tauri events.
// Returns no-op functions when not in Tauri environment.
export const fridaEvents = {
  sessionAttached: async (
    handler: (payload: SessionAttachedEvent) => void,
  ): Promise<UnlistenFn> => {
    if (!isTauri()) return noopUnlisten;
    return await listen<SessionAttachedEvent>("frida_session_attached", (event) => {
      handler(event.payload);
    });
  },

  sessionDetached: async (
    handler: (payload: SessionDetachedEvent) => void,
  ): Promise<UnlistenFn> => {
    if (!isTauri()) return noopUnlisten;
    return await listen<SessionDetachedEvent>("frida_session_detached", (event) => {
      handler(event.payload);
    });
  },

  scriptMessage: async (
    handler: (payload: ScriptMessageEvent) => void,
  ): Promise<UnlistenFn> => {
    if (!isTauri()) return noopUnlisten;
    return await listen<ScriptMessageEvent>("frida_script_message", (event) => {
      handler(event.payload);
    });
  },
};
