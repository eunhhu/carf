// RPC Router - registers handlers and creates rpc.exports
import type { RpcHandler } from "./types";

const handlers = new Map<string, RpcHandler>();

function registerHandler(method: string, handler: RpcHandler): void {
	if (handlers.has(method)) {
		throw new Error(`RPC handler already registered: ${method}`);
	}
	handlers.set(method, handler);
}

function createRpcExports(): Record<string, (...args: unknown[]) => unknown> {
	const exports: Record<string, (...args: unknown[]) => unknown> = {};

	for (const [method, handler] of handlers) {
		exports[method] = async (...args: unknown[]) => {
			try {
				const params = args[0];
				const result = await handler(params);
				const data =
					typeof result === "undefined" ? "null" : JSON.stringify(result);
				return { success: true, data };
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				return { success: false, error: message };
			}
		};
	}

	return exports;
}

export { registerHandler, createRpcExports };
