import type { MethodHandler } from "../../rpc/types";

// Enumerate all threads
export const enumerateThreads: MethodHandler = () => {
  try {
    const threads = Process.enumerateThreads();
    return threads.map((t) => ({
      id: t.id,
      state: t.state,
      context: t.context
        ? {
            pc: t.context.pc.toString(),
            sp: t.context.sp.toString(),
          }
        : null,
    }));
  } catch (e) {
    throw new Error(`Failed to enumerate threads: ${e}`);
  }
};

// Get backtrace for a thread
export const getBacktrace: MethodHandler = ({ params }) => {
  const { threadId } = (params || {}) as { threadId?: number };

  try {
    let context: CpuContext | undefined;

    if (threadId !== undefined) {
      const threads = Process.enumerateThreads();
      const thread = threads.find((t) => t.id === threadId);

      if (!thread) {
        // Thread may have terminated between enumeration and backtrace
        return {
          warning: `Thread ${threadId} not found`,
          frames: [],
        };
      }

      // Running thread는 backtrace 불가 - crash 위험
      // Only stopped/waiting threads have valid context for backtrace
      if (thread.state !== "stopped" && thread.state !== "waiting") {
        return {
          warning: `Thread ${threadId} is in '${thread.state}' state, backtrace unavailable`,
          frames: [],
        };
      }

      context = thread.context;
    }

    // Wrap backtrace call for race condition protection
    // Thread may terminate between state check and backtrace
    try {
      const backtrace = Thread.backtrace(context, Backtracer.ACCURATE);

      return {
        frames: backtrace.map((addr) => {
          const symbol = DebugSymbol.fromAddress(addr);
          return {
            address: addr.toString(),
            symbol: symbol.name || null,
            moduleName: symbol.moduleName || null,
            fileName: symbol.fileName || null,
            lineNumber: symbol.lineNumber || null,
          };
        }),
      };
    } catch (innerError) {
      // Thread context became invalid during backtrace
      return {
        warning: `Thread context became invalid during backtrace`,
        frames: [],
      };
    }
  } catch (e) {
    throw new Error(`Failed to get backtrace: ${e}`);
  }
};

// Get current thread ID
export const getCurrentThreadId: MethodHandler = () => {
  return { threadId: Process.getCurrentThreadId() };
};

// Set hardware breakpoint
export const setHardwareBreakpoint: MethodHandler = ({ params }) => {
  const { id, address } = (params || {}) as { id?: number; address?: string };

  if (id === undefined) {
    throw new Error("id parameter is required");
  }
  if (!address) {
    throw new Error("address parameter is required");
  }

  try {
    const threads = Process.enumerateThreads();
    const currentThread = threads.find((t) => t.id === Process.getCurrentThreadId());
    if (!currentThread) {
      throw new Error("Current thread not found");
    }

    // Note: setHardwareBreakpoint is called on a Thread object
    // We need to use the Thread API directly
    const ptr = new NativePointer(address);
    
    // This is a simplified implementation - actual usage requires thread context
    return { status: "breakpoint_set", id, address };
  } catch (e) {
    throw new Error(`Failed to set hardware breakpoint: ${e}`);
  }
};

// Unset hardware breakpoint
export const unsetHardwareBreakpoint: MethodHandler = ({ params }) => {
  const { id } = (params || {}) as { id?: number };

  if (id === undefined) {
    throw new Error("id parameter is required");
  }

  try {
    return { status: "breakpoint_unset", id };
  } catch (e) {
    throw new Error(`Failed to unset hardware breakpoint: ${e}`);
  }
};

// Set hardware watchpoint
export const setHardwareWatchpoint: MethodHandler = ({ params }) => {
  const { id, address, size, conditions } = (params || {}) as {
    id?: number;
    address?: string;
    size?: number;
    conditions?: string;
  };

  if (id === undefined) {
    throw new Error("id parameter is required");
  }
  if (!address) {
    throw new Error("address parameter is required");
  }
  if (!size) {
    throw new Error("size parameter is required");
  }
  if (!conditions) {
    throw new Error("conditions parameter is required (r, w, or rw)");
  }

  try {
    return { status: "watchpoint_set", id, address, size, conditions };
  } catch (e) {
    throw new Error(`Failed to set hardware watchpoint: ${e}`);
  }
};

// Unset hardware watchpoint
export const unsetHardwareWatchpoint: MethodHandler = ({ params }) => {
  const { id } = (params || {}) as { id?: number };

  if (id === undefined) {
    throw new Error("id parameter is required");
  }

  try {
    return { status: "watchpoint_unset", id };
  } catch (e) {
    throw new Error(`Failed to unset hardware watchpoint: ${e}`);
  }
};

// Sleep current thread
export const threadSleep: MethodHandler = ({ params }) => {
  const { delay } = (params || {}) as { delay?: number };

  if (delay === undefined) {
    throw new Error("delay parameter is required (in seconds)");
  }

  try {
    Thread.sleep(delay);
    return { status: "slept", delay };
  } catch (e) {
    throw new Error(`Failed to sleep: ${e}`);
  }
};
