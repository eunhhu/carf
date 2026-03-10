import { registerHandler } from "../rpc/router";

registerHandler("enumerateThreads", (_params: unknown) => {
  return Process.enumerateThreads().map((thread) => ({
    id: thread.id,
    state: thread.state,
    context: thread.context,
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
      name: sym.name,
      moduleName: sym.moduleName,
      fileName: sym.fileName,
      lineNumber: sym.lineNumber,
      module: mod
        ? { name: mod.name, base: mod.base.toString(), path: mod.path }
        : null,
    };
  });
});
