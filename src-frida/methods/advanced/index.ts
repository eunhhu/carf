import type { MethodHandler } from "../../rpc/types";

// Cloak - hide threads from Frida

// Add current thread to cloak
export const cloakAddCurrentThread: MethodHandler = () => {
  try {
    Cloak.addThread(Process.getCurrentThreadId());
    return { success: true, threadId: Process.getCurrentThreadId() };
  } catch (e) {
    throw new Error(`Failed to cloak current thread: ${e}`);
  }
};

// Add thread to cloak
export const cloakAddThread: MethodHandler = ({ params }) => {
  const { threadId } = (params || {}) as { threadId?: number };

  if (threadId === undefined) {
    throw new Error("threadId parameter is required");
  }

  try {
    Cloak.addThread(threadId);
    return { success: true, threadId };
  } catch (e) {
    throw new Error(`Failed to cloak thread: ${e}`);
  }
};

// Remove thread from cloak
export const cloakRemoveThread: MethodHandler = ({ params }) => {
  const { threadId } = (params || {}) as { threadId?: number };

  if (threadId === undefined) {
    throw new Error("threadId parameter is required");
  }

  try {
    Cloak.removeThread(threadId);
    return { success: true, threadId };
  } catch (e) {
    throw new Error(`Failed to uncloak thread: ${e}`);
  }
};

// Check if thread is cloaked
export const cloakHasThread: MethodHandler = ({ params }) => {
  const { threadId } = (params || {}) as { threadId?: number };

  if (threadId === undefined) {
    throw new Error("threadId parameter is required");
  }

  try {
    const cloaked = Cloak.hasThread(threadId);
    return { threadId, cloaked };
  } catch (e) {
    throw new Error(`Failed to check thread cloak: ${e}`);
  }
};

// Add memory range to cloak
export const cloakAddRange: MethodHandler = ({ params }) => {
  const { base, size } = (params || {}) as { base?: string; size?: number };

  if (!base || !size) {
    throw new Error("base and size parameters are required");
  }

  try {
    Cloak.addRange({ base: new NativePointer(base), size });
    return { success: true, base, size };
  } catch (e) {
    throw new Error(`Failed to cloak range: ${e}`);
  }
};

// Remove memory range from cloak
export const cloakRemoveRange: MethodHandler = ({ params }) => {
  const { base, size } = (params || {}) as { base?: string; size?: number };

  if (!base || !size) {
    throw new Error("base and size parameters are required");
  }

  try {
    Cloak.removeRange({ base: new NativePointer(base), size });
    return { success: true, base, size };
  } catch (e) {
    throw new Error(`Failed to uncloak range: ${e}`);
  }
};

// Check if range is cloaked
export const cloakHasRange: MethodHandler = ({ params }) => {
  const { address } = (params || {}) as { address?: string };

  if (!address) {
    throw new Error("address parameter is required");
  }

  try {
    const cloaked = Cloak.hasRangeContaining(new NativePointer(address));
    return { address, cloaked };
  } catch (e) {
    throw new Error(`Failed to check range cloak: ${e}`);
  }
};

// Add file descriptor to cloak
export const cloakAddFd: MethodHandler = ({ params }) => {
  const { fd } = (params || {}) as { fd?: number };

  if (fd === undefined) {
    throw new Error("fd parameter is required");
  }

  try {
    Cloak.addFileDescriptor(fd);
    return { success: true, fd };
  } catch (e) {
    throw new Error(`Failed to cloak fd: ${e}`);
  }
};

// Remove file descriptor from cloak
export const cloakRemoveFd: MethodHandler = ({ params }) => {
  const { fd } = (params || {}) as { fd?: number };

  if (fd === undefined) {
    throw new Error("fd parameter is required");
  }

  try {
    Cloak.removeFileDescriptor(fd);
    return { success: true, fd };
  } catch (e) {
    throw new Error(`Failed to uncloak fd: ${e}`);
  }
};

// Check if fd is cloaked
export const cloakHasFd: MethodHandler = ({ params }) => {
  const { fd } = (params || {}) as { fd?: number };

  if (fd === undefined) {
    throw new Error("fd parameter is required");
  }

  try {
    const cloaked = Cloak.hasFileDescriptor(fd);
    return { fd, cloaked };
  } catch (e) {
    throw new Error(`Failed to check fd cloak: ${e}`);
  }
};

// Script operations

// Get script runtime info
export const scriptGetRuntime: MethodHandler = () => {
  return {
    runtime: Script.runtime,
  };
};

// Pin script (prevent garbage collection)
export const scriptPin: MethodHandler = () => {
  try {
    Script.pin();
    return { pinned: true };
  } catch (e) {
    throw new Error(`Failed to pin script: ${e}`);
  }
};

// Unpin script
export const scriptUnpin: MethodHandler = () => {
  try {
    Script.unpin();
    return { pinned: false };
  } catch (e) {
    throw new Error(`Failed to unpin script: ${e}`);
  }
};

// Set global access handler
export const scriptSetGlobalAccessHandler: MethodHandler = async ({ params }) => {
  const { enabled } = (params || {}) as { enabled?: boolean };

  if (enabled === undefined) {
    throw new Error("enabled parameter is required");
  }

  try {
    if (enabled) {
      const { emitEvent } = await import("../../rpc/reply");

      Script.setGlobalAccessHandler({
        enumerate() {
          return [];
        },
        get(property) {
          emitEvent("global_access", { property, type: "get" });
          return undefined;
        },
      });
    } else {
      Script.setGlobalAccessHandler(null);
    }
    return { enabled };
  } catch (e) {
    throw new Error(`Failed to set global access handler: ${e}`);
  }
};

// Kernel operations (if available)

// Check if kernel API is available
export const kernelAvailable: MethodHandler = () => {
  return { available: Kernel.available };
};

// Get kernel base address
export const kernelGetBase: MethodHandler = () => {
  if (!Kernel.available) {
    throw new Error("Kernel API not available");
  }

  return { base: Kernel.base.toString() };
};

// Read kernel memory
export const kernelReadByteArray: MethodHandler = ({ params }) => {
  if (!Kernel.available) {
    throw new Error("Kernel API not available");
  }

  const { address, size } = (params || {}) as { address?: string; size?: number };

  if (!address || !size) {
    throw new Error("address and size parameters are required");
  }

  try {
    const data = Kernel.readByteArray(new UInt64(address), size);
    if (!data) {
      throw new Error("Failed to read kernel memory");
    }
    return {
      address,
      size,
      bytes: Array.from(new Uint8Array(data)),
    };
  } catch (e) {
    throw new Error(`Failed to read kernel memory: ${e}`);
  }
};

// Enumerate kernel modules
export const kernelEnumerateModules: MethodHandler = () => {
  if (!Kernel.available) {
    throw new Error("Kernel API not available");
  }

  try {
    const modules = Kernel.enumerateModules();
    return modules.map((m) => ({
      name: m.name,
      base: m.base.toString(),
      size: m.size,
    }));
  } catch (e) {
    throw new Error(`Failed to enumerate kernel modules: ${e}`);
  }
};

// Enumerate kernel memory ranges
export const kernelEnumerateRanges: MethodHandler = ({ params }) => {
  if (!Kernel.available) {
    throw new Error("Kernel API not available");
  }

  const { protection = "r--" } = (params || {}) as { protection?: string };

  try {
    const ranges = Kernel.enumerateRanges(protection);
    return ranges.slice(0, 100).map((r) => ({
      base: r.base.toString(),
      size: r.size,
      protection: r.protection,
    }));
  } catch (e) {
    throw new Error(`Failed to enumerate kernel ranges: ${e}`);
  }
};
