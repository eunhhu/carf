import { invoke, isTauri } from "@tauri-apps/api/core";

import type { DeviceInfo, ProcessInfo, ScriptInfo, SessionInfo } from "./types";

// Safe invoke that returns empty/default values in non-Tauri environment
async function safeInvoke<T>(command: string, args?: Record<string, unknown>, fallback?: T): Promise<T> {
  if (!isTauri()) {
    console.warn(`Tauri invoke '${command}' called outside Tauri environment`);
    if (fallback !== undefined) return fallback;
    throw new Error(`Cannot call '${command}' outside Tauri environment`);
  }
  return await invoke<T>(command, args);
}

// Thin typed wrappers around Tauri commands.
export const fridaBackendApi = {
  version: async () => {
    return await safeInvoke<string>("frida_version", undefined, "N/A (Browser)");
  },

  listDevices: async () => {
    return await safeInvoke<DeviceInfo[]>("frida_list_devices", undefined, []);
  },

  listProcesses: async (deviceId: string) => {
    return await safeInvoke<ProcessInfo[]>("frida_list_processes", {
      device_id: deviceId,
    }, []);
  },

  attach: async (deviceId: string, pid: number) => {
    return await safeInvoke<SessionInfo>("frida_attach", {
      device_id: deviceId,
      pid,
    });
  },

  detach: async (sessionId: number) => {
    return await safeInvoke<void>("frida_detach", {
      session_id: sessionId,
    });
  },

  spawn: async (deviceId: string, program: string, argv?: string[] | null) => {
    return await safeInvoke<number>("frida_spawn", {
      device_id: deviceId,
      program,
      argv: argv ?? null,
    });
  },

  resume: async (deviceId: string, pid: number) => {
    return await safeInvoke<void>("frida_resume", {
      device_id: deviceId,
      pid,
    });
  },

  kill: async (deviceId: string, pid: number) => {
    return await safeInvoke<void>("frida_kill", {
      device_id: deviceId,
      pid,
    });
  },

  loadDefaultScript: async (sessionId: number) => {
    return await safeInvoke<ScriptInfo>("frida_load_default_script", {
      session_id: sessionId,
    });
  },

  unloadScript: async (scriptId: number) => {
    return await safeInvoke<void>("frida_unload_script", {
      script_id: scriptId,
    });
  },

  scriptPost: async (scriptId: number, message: unknown, data?: Uint8Array) => {
    return await safeInvoke<void>("frida_script_post", {
      script_id: scriptId,
      message,
      data: data ? Array.from(data) : undefined,
    });
  },
};
