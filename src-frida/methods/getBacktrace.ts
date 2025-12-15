import type { MethodHandler } from "../rpc/types";

type Params = {
  thread_id?: number;
  context?: CpuContext;
};

// Get backtrace for a thread
export const getBacktrace: MethodHandler = ({ params }) => {
  const { thread_id } = (params || {}) as Params;

  let context: CpuContext | undefined;

  if (thread_id !== undefined) {
    const threads = Process.enumerateThreads();
    const thread = threads.find((t) => t.id === thread_id);
    if (!thread) {
      throw new Error(`Thread ${thread_id} not found`);
    }
    context = thread.context;
  }

  const backtrace = Thread.backtrace(context, Backtracer.ACCURATE);

  return backtrace.map((addr) => {
    const symbol = DebugSymbol.fromAddress(addr);
    return {
      address: addr.toString(),
      symbol: symbol.name || null,
      moduleName: symbol.moduleName || null,
      fileName: symbol.fileName || null,
      lineNumber: symbol.lineNumber || null,
    };
  });
};
