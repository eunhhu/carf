import { registerHandler } from "../rpc/router";

registerHandler("enumerateThreads", (_params: unknown) => {
  return Process.enumerateThreads().map((thread) => ({
    id: thread.id,
    name: null,
    state: thread.state,
  }));
});

registerHandler("getBacktrace", (params: unknown) => {
  const { threadId } = params as { threadId: number };

  const threads = Process.enumerateThreads();
  const target = threads.find((t) => t.id === threadId);
  if (!target) throw new Error(`Thread not found: ${threadId}`);

  const frames = Thread.backtrace(target.context, Backtracer.ACCURATE);
  return frames.map((addr) => {
    const sym = DebugSymbol.fromAddress(addr);
    const mod = Process.findModuleByAddress(addr);
    return {
      address: addr.toString(),
      symbolName: sym.name ?? null,
      moduleName: sym.moduleName,
      fileName: sym.fileName,
      lineNumber: sym.lineNumber,
      module: mod
        ? { name: mod.name, base: mod.base.toString(), path: mod.path }
        : null,
    };
  });
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

  const threads = Process.enumerateThreads();
  const target = threads.find((t) => t.id === threadId);
  if (!target) throw new Error(`Thread not found: ${threadId}`);

  try {
    const frames = Thread.backtrace(target.context, Backtracer.ACCURATE);
    return frames.map((addr) => {
      const sym = DebugSymbol.fromAddress(addr);
      const mod = Process.findModuleByAddress(addr);
      return {
        address: addr.toString(),
        symbolName: sym.name ?? null,
        moduleName: sym.moduleName,
        fileName: sym.fileName,
        lineNumber: sym.lineNumber,
        module: mod
          ? { name: mod.name, base: mod.base.toString(), path: mod.path }
          : null,
      };
    });
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
