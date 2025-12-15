import type { MethodHandler } from "../../rpc/types";
import { emitEvent } from "../../rpc/reply";

// Get current working directory
export const getCurrentDir: MethodHandler = () => {
  try {
    return { path: Process.getCurrentDir() };
  } catch (e) {
    throw new Error(`Failed to get current directory: ${e}`);
  }
};

// Get home directory
export const getHomeDir: MethodHandler = () => {
  try {
    return { path: Process.getHomeDir() };
  } catch (e) {
    throw new Error(`Failed to get home directory: ${e}`);
  }
};

// Get temp directory
export const getTmpDir: MethodHandler = () => {
  try {
    return { path: Process.getTmpDir() };
  } catch (e) {
    throw new Error(`Failed to get temp directory: ${e}`);
  }
};

// Check if debugger is attached
export const isDebuggerAttached: MethodHandler = () => {
  try {
    return { attached: Process.isDebuggerAttached() };
  } catch (e) {
    throw new Error(`Failed to check debugger: ${e}`);
  }
};

// Enumerate memory ranges
export const enumerateRanges: MethodHandler = ({ params }) => {
  const { protection, coalesce } = (params || {}) as {
    protection?: string;
    coalesce?: boolean;
  };

  try {
    const prot = protection || "r--";
    const specifier = coalesce !== undefined ? { protection: prot, coalesce } : prot;
    const ranges = Process.enumerateRanges(specifier);

    return ranges.map((r) => ({
      base: r.base.toString(),
      size: r.size,
      protection: r.protection,
      file: r.file
        ? {
            path: r.file.path,
            offset: r.file.offset,
            size: r.file.size,
          }
        : null,
    }));
  } catch (e) {
    throw new Error(`Failed to enumerate ranges: ${e}`);
  }
};

// Enumerate malloc ranges
export const enumerateMallocRanges: MethodHandler = () => {
  try {
    const ranges = Process.enumerateMallocRanges();
    return ranges.slice(0, 1000).map((r) => ({
      base: r.base.toString(),
      size: r.size,
      protection: r.protection,
    }));
  } catch (e) {
    throw new Error(`Failed to enumerate malloc ranges: ${e}`);
  }
};

// Find range by address
export const findRangeByAddress: MethodHandler = ({ params }) => {
  const { address } = (params || {}) as { address?: string };

  if (!address) {
    throw new Error("address parameter is required");
  }

  try {
    const ptr = new NativePointer(address);
    const range = Process.findRangeByAddress(ptr);

    if (!range) {
      return null;
    }

    return {
      base: range.base.toString(),
      size: range.size,
      protection: range.protection,
      file: range.file
        ? {
            path: range.file.path,
            offset: range.file.offset,
            size: range.file.size,
          }
        : null,
    };
  } catch (e) {
    throw new Error(`Failed to find range: ${e}`);
  }
};

// Module observer state
let moduleObserver: ModuleObserver | null = null;

// Start module observer
export const attachModuleObserver: MethodHandler = () => {
  if (moduleObserver) {
    return { status: "already_running" };
  }

  try {
    moduleObserver = Process.attachModuleObserver({
      onAdded(module) {
        emitEvent("module_added", {
          name: module.name,
          base: module.base.toString(),
          size: module.size,
          path: module.path,
        });
      },
      onRemoved(module) {
        emitEvent("module_removed", {
          name: module.name,
          base: module.base.toString(),
          size: module.size,
          path: module.path,
        });
      },
    });

    return { status: "started" };
  } catch (e) {
    throw new Error(`Failed to attach module observer: ${e}`);
  }
};

// Stop module observer
export const detachModuleObserver: MethodHandler = () => {
  if (!moduleObserver) {
    return { status: "not_running" };
  }

  try {
    moduleObserver.detach();
    moduleObserver = null;
    return { status: "stopped" };
  } catch (e) {
    throw new Error(`Failed to detach module observer: ${e}`);
  }
};

// Thread observer state
let threadObserver: ThreadObserver | null = null;

// Start thread observer
export const attachThreadObserver: MethodHandler = () => {
  if (threadObserver) {
    return { status: "already_running" };
  }

  try {
    threadObserver = Process.attachThreadObserver({
      onAdded(thread) {
        emitEvent("thread_added", {
          id: thread.id,
          name: thread.name || null,
        });
      },
      onRemoved(thread) {
        emitEvent("thread_removed", {
          id: thread.id,
          name: thread.name || null,
        });
      },
      onRenamed(thread, previousName) {
        emitEvent("thread_renamed", {
          id: thread.id,
          name: thread.name || null,
          previousName: previousName || null,
        });
      },
    });

    return { status: "started" };
  } catch (e) {
    throw new Error(`Failed to attach thread observer: ${e}`);
  }
};

// Stop thread observer
export const detachThreadObserver: MethodHandler = () => {
  if (!threadObserver) {
    return { status: "not_running" };
  }

  try {
    threadObserver.detach();
    threadObserver = null;
    return { status: "stopped" };
  } catch (e) {
    throw new Error(`Failed to detach thread observer: ${e}`);
  }
};

// Exception handler state
let exceptionHandlerInstalled = false;

// Install exception handler
export const setExceptionHandler: MethodHandler = () => {
  if (exceptionHandlerInstalled) {
    return { status: "already_installed" };
  }

  try {
    Process.setExceptionHandler((details) => {
      emitEvent("native_exception", {
        type: details.type,
        address: details.address.toString(),
        memory: details.memory
          ? {
              operation: details.memory.operation,
              address: details.memory.address.toString(),
            }
          : null,
        context: {
          pc: details.context.pc.toString(),
          sp: details.context.sp.toString(),
        },
      });

      // Return false to let the exception propagate
      return false;
    });

    exceptionHandlerInstalled = true;
    return { status: "installed" };
  } catch (e) {
    throw new Error(`Failed to set exception handler: ${e}`);
  }
};

// Get main module info
export const getMainModule: MethodHandler = () => {
  try {
    const mod = Process.mainModule;
    return {
      name: mod.name,
      base: mod.base.toString(),
      size: mod.size,
      path: mod.path,
    };
  } catch (e) {
    throw new Error(`Failed to get main module: ${e}`);
  }
};
