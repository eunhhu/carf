import { registerHandler } from "../rpc/router";

interface SerializedThreadContext {
  pc: string;
  sp: string;
  regs: Record<string, string>;
}

registerHandler("enumerateThreads", (_params: unknown) => {
  return Process.enumerateThreads().map((thread) => ({
    id: thread.id,
    name: null,
    state: thread.state,
  }));
});

function getThread(threadId: number) {
  const target = Process.enumerateThreads().find((thread) => thread.id === threadId);
  if (!target) {
    throw new Error(`Thread not found: ${threadId}`);
  }

  return target;
}

function stringifyRegisterValue(value: unknown): string {
  if (typeof value === "number") {
    return `0x${value.toString(16)}`;
  }

  if (typeof value === "bigint") {
    return `0x${value.toString(16)}`;
  }

  if (value === null || value === undefined) {
    return "0x0";
  }

  return String(value);
}

function readRegister(
  regs: Record<string, unknown>,
  names: string[],
): string | null {
  for (const name of names) {
    if (name in regs) {
      return stringifyRegisterValue(regs[name]);
    }
  }

  return null;
}

function serializeThreadContext(context: CpuContext): SerializedThreadContext {
  const regs = context as unknown as Record<string, unknown>;
  const pc = readRegister(regs, ["pc", "rip", "eip"]) ?? "0x0";
  const sp = readRegister(regs, ["sp", "rsp", "esp"]) ?? "0x0";
  const serializedRegs: Record<string, string> = {};

  for (const [name, value] of Object.entries(regs)) {
    if (name === "pc" || name === "rip" || name === "eip") {
      continue;
    }
    if (name === "sp" || name === "rsp" || name === "esp") {
      continue;
    }

    serializedRegs[name] = stringifyRegisterValue(value);
  }

  return { pc, sp, regs: serializedRegs };
}

function serializeBacktraceFrame(addr: NativePointerValue) {
  const pointer = ptr(addr);
  const sym = DebugSymbol.fromAddress(pointer);
  const mod = Process.findModuleByAddress(pointer);

  return {
    address: pointer.toString(),
    symbolName: sym.name ?? null,
    moduleName: sym.moduleName,
    fileName: sym.fileName,
    lineNumber: sym.lineNumber,
    module: mod
      ? { name: mod.name, base: mod.base.toString(), path: mod.path }
      : null,
  };
}

function fallbackBacktrace(context: SerializedThreadContext) {
  return context.pc === "0x0" ? [] : [serializeBacktraceFrame(context.pc)];
}

function collectBacktrace(threadId: number) {
  const target = getThread(threadId);
  const context = serializeThreadContext(target.context);

  if (target.state !== "running") {
    return fallbackBacktrace(context);
  }

  try {
    const frames = Thread.backtrace(target.context, Backtracer.FUZZY);
    if (frames.length === 0) {
      return fallbackBacktrace(context);
    }

    return frames.map((addr) => serializeBacktraceFrame(addr));
  } catch {
    return fallbackBacktrace(context);
  }
}

registerHandler("getBacktrace", (params: unknown) => {
  const { threadId } = params as { threadId: number };
  return collectBacktrace(threadId);
});

registerHandler("getThreadContext", (params: unknown) => {
  const { threadId } = params as { threadId: number };
  return serializeThreadContext(getThread(threadId).context);
});

// --- Thread Observer (Frida 17+) ---

let threadObserver: { detach(): void } | null = null;

registerHandler("startThreadObserver", (_params: unknown) => {
  if (threadObserver) throw new Error("Thread observer already active");

  threadObserver = Process.attachThreadObserver({
    onAdded(thread) {
      send({
        type: "carf://thread/added",
        timestamp: Date.now(),
        data: {
          id: thread.id,
          name: thread.name,
        },
      });
    },
    onRemoved(thread) {
      send({
        type: "carf://thread/removed",
        timestamp: Date.now(),
        data: {
          id: thread.id,
          name: thread.name,
        },
      });
    },
    onRenamed(thread, previousName) {
      send({
        type: "carf://thread/renamed",
        timestamp: Date.now(),
        data: {
          id: thread.id,
          name: thread.name,
          previousName,
        },
      });
    },
  });

  return { started: true };
});

registerHandler("stopThreadObserver", (_params: unknown) => {
  if (!threadObserver) throw new Error("No thread observer is active");
  threadObserver.detach();
  threadObserver = null;
  return { stopped: true };
});

registerHandler("getThreadBacktrace", (params: unknown) => {
  const { threadId } = params as { threadId: number };

  try {
    return collectBacktrace(threadId);
  } catch (e) {
    throw new Error(
      `Failed to get backtrace for thread ${threadId}: ${e instanceof Error ? e.message : String(e)}`
    );
  }
});

registerHandler("runOnThread", (params: unknown) => {
  const { threadId, code } = params as { threadId: number; code: string };

  if (!code || code.trim().length === 0) {
    throw new Error("Code must not be empty");
  }

  if (code.length > 10000) {
    throw new Error("Code exceeds maximum length of 10000 characters");
  }

  const threads = Process.enumerateThreads();
  const target = threads.find((t) => t.id === threadId);
  if (!target) throw new Error(`Thread not found: ${threadId}`);

  return new Promise<unknown>((resolve, reject) => {
    try {
      // NOTE: runOnThread with dynamic code evaluation is intentional —
      // CARF is a Frida-based dynamic analysis tool where executing
      // arbitrary instrumentation code on target threads is a core feature.
      Process.runOnThread(threadId, () => {
        try {
          const fn = new Function(code); // eslint-disable-line @typescript-eslint/no-implied-eval
          const result = fn();
          resolve({ threadId, result: result !== undefined ? String(result) : null });
        } catch (e) {
          reject(new Error(
            `Execution failed on thread ${threadId}: ${e instanceof Error ? e.message : String(e)}`
          ));
        }
      });
    } catch (e) {
      reject(new Error(
        `Failed to run on thread ${threadId}: ${e instanceof Error ? e.message : String(e)}`
      ));
    }
  });
});
