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
