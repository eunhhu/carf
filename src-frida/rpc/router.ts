import type { MethodHandler, RequestMessage } from "./types";
import { replyError, replyOk } from "./reply";

export type RpcRouter = {
  start: () => void;
};

export function createRpcRouter(handlers: Record<string, MethodHandler>): RpcRouter {
  async function handleRequest(id: number, method: string, params?: unknown) {
    try {
      const handler = handlers[method];
      if (!handler) {
        replyError(id, `Unknown method: ${method}`);
        return;
      }

      // Support both sync and async handlers
      const result = handler({ params });
      const returns = result instanceof Promise ? await result : result;
      replyOk(id, returns);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const stack = e instanceof Error ? e.stack : undefined;
      replyError(id, message, stack);
    }
  }

  function onMessage(message: RequestMessage) {
    const { id, method, params } = message.payload;
    
    // Handle async - don't block the message loop
    handleRequest(id, method, params);
    
    // Re-register for next message
    recv("carf:request", onMessage);
  }

  return {
    start: () => {
      recv("carf:request", onMessage);
    },
  };
}
