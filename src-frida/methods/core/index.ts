import type { MethodHandler } from "../../rpc/types";

// Ping - health check
export const ping: MethodHandler = () => {
  return { pong: true, timestamp: Date.now() };
};

// Get process architecture
export const getArch: MethodHandler = () => {
  return { arch: Process.arch };
};

// Get process info
export const getProcessInfo: MethodHandler = () => {
  return {
    id: Process.id,
    arch: Process.arch,
    platform: Process.platform,
    pageSize: Process.pageSize,
    pointerSize: Process.pointerSize,
    codeSigningPolicy: Process.codeSigningPolicy,
  };
};
