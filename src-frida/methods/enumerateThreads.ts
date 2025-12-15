import type { MethodHandler } from "../rpc/types";

// Enumerate all threads in the process
export const enumerateThreads: MethodHandler = () => {
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
};
