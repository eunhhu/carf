import type { MethodHandler, RequestMessage } from "./types";
import { replyError, replyOk } from "./reply";

export type RpcRouter = {
  start: () => void;
};

export function createRpcRouter(handlers: Record<string, MethodHandler>): RpcRouter {
  async function handleRequest(id: number, method: string, params?: unknown) {
    console.log(`[CARF-AGENT] RPC request: id=${id} method=${method}`);
    try {
      const handler = handlers[method];
      if (!handler) {
        console.log(`[CARF-AGENT] Unknown method: ${method}`);
        replyError(id, `Unknown method: ${method}`);
        return;
      }

      // Support both sync and async handlers
      console.log(`[CARF-AGENT] Calling handler for ${method}`);
      const result = handler({ params });
      const returns = result instanceof Promise ? await result : result;
      console.log(`[CARF-AGENT] Handler ${method} completed successfully`);
      replyOk(id, returns);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const stack = e instanceof Error ? e.stack : undefined;
      console.log(`[CARF-AGENT] Handler ${method} failed: ${message}`);
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
