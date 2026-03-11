import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import { mockInvoke, mockListen } from "~/lib/mock-tauri";
import { unwrapRpcResult } from "~/lib/rpc";

const IS_TAURI =
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const ALLOW_MOCK_FALLBACK = import.meta.env.VITE_CARF_ALLOW_MOCK === "true";
const EXPLICIT_BRIDGE_URL = import.meta.env.VITE_CARF_BRIDGE_URL?.trim();
const DEFAULT_BRIDGE_URL =
	typeof window !== "undefined" && !IS_TAURI
		? window.location.origin
		: undefined;
const BRIDGE_BASE_URL = EXPLICIT_BRIDGE_URL || DEFAULT_BRIDGE_URL;
const RPC_CHUNK_EVENT = "carf://rpc/chunk";

interface RpcChunkEvent {
	requestId: string;
	phase: "chunk" | "complete";
	isArray: boolean;
	chunkIndex: number;
	totalChunks: number;
	data?: unknown;
}

function createRequestId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}

	return `rpc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function invokeChunkedRpc<T>(
	args?: Record<string, unknown>,
): Promise<T> {
	const requestId = createRequestId();
	const chunks: unknown[] = [];
	let scalarValue: unknown;

	return new Promise<T>((resolve, reject) => {
		let settled = false;
		let unlisten: (() => void) | undefined;

		const finish = (fn: () => void) => {
			if (settled) {
				return;
			}
			settled = true;
			unlisten?.();
			fn();
		};

		tauriListen<RpcChunkEvent>(RPC_CHUNK_EVENT, (event) => {
			const payload = event.payload;
			if (payload.requestId !== requestId) {
				return;
			}

			if (payload.phase === "chunk") {
				if (payload.isArray) {
					if (Array.isArray(payload.data)) {
						chunks.push(...payload.data);
					}
				} else {
					scalarValue = payload.data;
				}
				return;
			}

			finish(() => {
				resolve((payload.isArray ? chunks : scalarValue) as T);
			});
		})
			.then((cleanup) => {
				unlisten = cleanup;
				return tauriInvoke<void>("rpc_call_chunked", {
					...args,
					requestId,
					chunkSize: 128,
				});
			})
			.catch((error) => {
				finish(() => {
					reject(error);
				});
			});
	});
}

async function bridgeInvoke<T>(
	cmd: string,
	args?: Record<string, unknown>,
): Promise<T> {
	if (!BRIDGE_BASE_URL) {
		throw new Error(`Bridge not configured for ${cmd}`);
	}

	const response = await fetch(
		`${BRIDGE_BASE_URL}/api/invoke/${encodeURIComponent(cmd)}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(args ?? {}),
		},
	);

	const payload = (await response.json()) as {
		data?: unknown;
		error?: { message?: string };
	};

	if (!response.ok) {
		throw new Error(payload.error?.message ?? `Bridge invoke failed: ${cmd}`);
	}

	return payload.data as T;
}

function shouldFallbackToMock(error: unknown): boolean {
	if (EXPLICIT_BRIDGE_URL) {
		return false;
	}

	if (!(error instanceof Error)) {
		return true;
	}

	return /fetch|network|eventsource/i.test(error.message);
}

export async function invoke<T>(
	cmd: string,
	args?: Record<string, unknown>,
): Promise<T> {
	if (!IS_TAURI) {
		if (BRIDGE_BASE_URL) {
			try {
				return await bridgeInvoke<T>(cmd, args);
			} catch (error) {
				if (!ALLOW_MOCK_FALLBACK || !shouldFallbackToMock(error)) {
					throw error;
				}
			}
		}

		if (!ALLOW_MOCK_FALLBACK) {
			throw new Error(
				"CARF bridge is unavailable. Start the Axum bridge or run inside Tauri.",
			);
		}

		return mockInvoke<T>(cmd, args);
	}
	const result =
		cmd === "rpc_call"
			? await invokeChunkedRpc<unknown>(args)
			: await tauriInvoke<unknown>(cmd, args);

	if (cmd === "rpc_call") {
		return unwrapRpcResult(result) as T;
	}

	return result as T;
}

export function listen<T>(
	event: string,
	handler: (payload: T) => void,
): () => void {
	if (!IS_TAURI) {
		if (BRIDGE_BASE_URL) {
			const eventSource = new EventSource(`${BRIDGE_BASE_URL}/api/events`);
			let fallbackCleanup: (() => void) | undefined;
			let disposed = false;

			const listener = (eventPayload: Event) => {
				const payload = JSON.parse(
					(eventPayload as MessageEvent<string>).data,
				) as T;
				handler(payload);
			};

			eventSource.addEventListener(event, listener);
			eventSource.onerror = () => {
				if (disposed || fallbackCleanup) {
					return;
				}
				eventSource.close();
				if (!EXPLICIT_BRIDGE_URL && ALLOW_MOCK_FALLBACK) {
					fallbackCleanup = mockListen(event, handler);
				}
			};

			return () => {
				disposed = true;
				eventSource.removeEventListener(event, listener);
				eventSource.close();
				fallbackCleanup?.();
			};
		}

		if (!ALLOW_MOCK_FALLBACK) {
			throw new Error(
				"CARF bridge is unavailable. Start the Axum bridge or run inside Tauri.",
			);
		}

		return mockListen(event, handler);
	}
	let unlisten: (() => void) | undefined;
	let disposed = false;
	tauriListen<T>(event, (e) => handler(e.payload)).then((fn) => {
		if (disposed) {
			fn();
		} else {
			unlisten = fn;
		}
	});
	return () => {
		disposed = true;
		unlisten?.();
	};
}

export function isTauri(): boolean {
	return IS_TAURI;
}
