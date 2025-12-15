/**
 * useFridaBackend - React hook for Frida backend (Tauri IPC) operations
 * 
 * Provides typed async functions for device/process management, session control,
 * and script lifecycle. All functions return Promises.
 */

import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================

export type DeviceInfo = {
  id: string;
  name: string;
  device_type: string;
};

export type ProcessInfo = {
  pid: number;
  name: string;
};

export type SessionInfo = {
  session_id: number;
  script_id: number;
};

export type ScriptInfo = {
  script_id: number;
};

// ============================================================================
// Hook
// ============================================================================

export function useFridaBackend() {
  // Get Frida version string
  const getVersion = useCallback(async (): Promise<string> => {
    return await invoke<string>("frida_version");
  }, []);

  // List all available devices (local, USB, remote)
  const listDevices = useCallback(async (): Promise<DeviceInfo[]> => {
    return await invoke<DeviceInfo[]>("frida_list_devices");
  }, []);

  // List processes on a specific device
  const listProcesses = useCallback(async (deviceId: string): Promise<ProcessInfo[]> => {
    return await invoke<ProcessInfo[]>("frida_list_processes", {
      device_id: deviceId,
    });
  }, []);

  // Attach to a process and auto-load default agent script
  const attach = useCallback(async (deviceId: string, pid: number): Promise<SessionInfo> => {
    return await invoke<SessionInfo>("frida_attach", {
      device_id: deviceId,
      pid,
    });
  }, []);

  // Detach from a session
  const detach = useCallback(async (sessionId: number): Promise<void> => {
    return await invoke<void>("frida_detach", {
      session_id: sessionId,
    });
  }, []);

  // Spawn a new process (returns PID, process is paused)
  const spawn = useCallback(async (
    deviceId: string,
    program: string,
    argv?: string[] | null
  ): Promise<number> => {
    return await invoke<number>("frida_spawn", {
      device_id: deviceId,
      program,
      argv: argv ?? null,
    });
  }, []);

  // Resume a spawned process
  const resume = useCallback(async (deviceId: string, pid: number): Promise<void> => {
    return await invoke<void>("frida_resume", {
      device_id: deviceId,
      pid,
    });
  }, []);

  // Kill a process
  const kill = useCallback(async (deviceId: string, pid: number): Promise<void> => {
    return await invoke<void>("frida_kill", {
      device_id: deviceId,
      pid,
    });
  }, []);

  // Load the default agent script into a session
  const loadScript = useCallback(async (sessionId: number): Promise<ScriptInfo> => {
    return await invoke<ScriptInfo>("frida_load_default_script", {
      session_id: sessionId,
    });
  }, []);

  // Unload a script
  const unloadScript = useCallback(async (scriptId: number): Promise<void> => {
    return await invoke<void>("frida_unload_script", {
      script_id: scriptId,
    });
  }, []);

  // Post a message to a script (low-level, prefer useAgentRpc for RPC)
  const scriptPost = useCallback(async (
    scriptId: number,
    message: unknown,
    data?: Uint8Array
  ): Promise<void> => {
    return await invoke<void>("frida_script_post", {
      script_id: scriptId,
      message,
      data: data ? Array.from(data) : undefined,
    });
  }, []);

  return {
    getVersion,
    listDevices,
    listProcesses,
    attach,
    detach,
    spawn,
    resume,
    kill,
    loadScript,
    unloadScript,
    scriptPost,
  };
}
