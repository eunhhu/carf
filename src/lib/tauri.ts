import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import { mockInvoke, mockListen } from "~/lib/mock-tauri";
import { unwrapRpcResult } from "~/lib/rpc";

const IS_TAURI =
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const EXPLICIT_BRIDGE_URL = import.meta.env.VITE_CARF_BRIDGE_URL?.trim();
const DEFAULT_BRIDGE_URL =
	typeof window !== "undefined" &&
	(window.location.hostname === "localhost" ||
		window.location.hostname === "127.0.0.1")
		? "http://127.0.0.1:7766"
		: undefined;
const BRIDGE_BASE_URL = EXPLICIT_BRIDGE_URL || DEFAULT_BRIDGE_URL;

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
				if (!shouldFallbackToMock(error)) {
					throw error;
				}
			}
		}

		return mockInvoke<T>(cmd, args);
	}
	const result = await tauriInvoke<unknown>(cmd, args);

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
				if (!EXPLICIT_BRIDGE_URL) {
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
