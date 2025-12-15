// Frida Backend hooks (Tauri IPC)
export { useFridaBackend } from "./useFridaBackend";
export type { DeviceInfo, ProcessInfo, SessionInfo, ScriptInfo } from "./useFridaBackend";

// Frida Event hooks
export { useFridaEvents, useAutoFridaEvents } from "./useFridaEvents";
export type {
  SessionAttachedEvent,
  SessionDetachedEvent,
  ScriptMessageEvent,
  SessionDetachReason,
  SessionAttachedHandler,
  SessionDetachedHandler,
  ScriptMessageHandler,
} from "./useFridaEvents";

// Agent RPC hooks
export { useAgentRpc, createRpcMethod } from "./useAgentRpc";
export type { AgentEvent, AgentEventHandler } from "./useAgentRpc";
