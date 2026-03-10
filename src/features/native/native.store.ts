import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { addHook } from "~/features/hooks/hooks.store";
import { invoke, listen } from "~/lib/tauri";
import type { HookInfo, StalkerEvent } from "~/lib/types";

export type NativeSubMode = "interceptor" | "stalker" | "functions";

interface FunctionCallResult {
	address: string;
	retval: unknown;
	timestamp: number;
}

interface NativeState {
	interceptorTarget: string;
	stalkerThreadId: number | null;
	stalkerEvents: StalkerEvent[];
	stalkerActive: boolean;
	functionAddress: string;
	functionRetType: string;
	functionArgTypes: string[];
	functionArgs: string[];
	functionResults: FunctionCallResult[];
}

const [state, setState] = createStore<NativeState>({
	interceptorTarget: "",
	stalkerThreadId: null,
	stalkerEvents: [],
	stalkerActive: false,
	functionAddress: "",
	functionRetType: "void",
	functionArgTypes: [],
	functionArgs: [],
	functionResults: [],
});

const [subMode, setSubMode] = createSignal<NativeSubMode>("interceptor");

function setInterceptorTarget(target: string): void {
	setState("interceptorTarget", target);
}

function setStalkerThread(threadId: number | null): void {
	setState("stalkerThreadId", threadId);
}

function addStalkerEvents(events: StalkerEvent[]): void {
	setState("stalkerEvents", (prev) => [...prev, ...events]);
}

function clearStalkerEvents(): void {
	setState("stalkerEvents", []);
}

function setStalkerActive(active: boolean): void {
	setState("stalkerActive", active);
}

function setFunctionAddress(address: string): void {
	setState("functionAddress", address);
}

function addFunctionResult(result: FunctionCallResult): void {
	setState("functionResults", (prev) => [...prev, result]);
}

// ─── RPC Functions ───

async function hookNativeFunction(
	sessionId: string,
	target: string,
	options?: {
		captureArgs?: boolean;
		captureRetval?: boolean;
		captureBacktrace?: boolean;
	},
): Promise<void> {
	try {
		const hook = await invoke<HookInfo>("rpc_call", {
			sessionId,
			method: "hookFunction",
			params: { target, ...options },
		});
		addHook(hook);
	} catch (e) {
		console.error("hookNativeFunction failed:", e);
		throw e;
	}
}

async function unhookNativeFunction(
	sessionId: string,
	hookId: string,
): Promise<void> {
	try {
		await invoke("rpc_call", {
			sessionId,
			method: "unhookFunction",
			params: { hookId },
		});
	} catch (e) {
		console.error("unhookNativeFunction failed:", e);
		throw e;
	}
}

async function startStalker(
	sessionId: string,
	threadId: number,
	events?: string[],
): Promise<void> {
	setStalkerActive(true);
	try {
		const selectedEvents = events ?? ["call", "ret"];
		await invoke("rpc_call", {
			sessionId,
			method: "startStalker",
			params: {
				threadId,
				events: {
					call: selectedEvents.includes("call"),
					ret: selectedEvents.includes("ret"),
					exec: selectedEvents.includes("exec"),
					block: selectedEvents.includes("block"),
				},
			},
		});
	} catch (e) {
		setStalkerActive(false);
		console.error("startStalker failed:", e);
		throw e;
	}
}

async function stopStalker(sessionId: string, threadId: number): Promise<void> {
	try {
		await invoke("rpc_call", {
			sessionId,
			method: "stopStalker",
			params: { threadId },
		});
	} catch (e) {
		console.error("stopStalker failed:", e);
		throw e;
	} finally {
		setStalkerActive(false);
	}
}

async function callNativeFunction(
	sessionId: string,
	address: string,
	retType: string,
	argTypes: string[],
	args: string[],
): Promise<void> {
	try {
		const result = await invoke<unknown>("rpc_call", {
			sessionId,
			method: "callFunction",
			params: { address, retType, argTypes, args },
		});
		const retval =
			typeof result === "object" && result !== null && "result" in result
				? (result as { result: unknown }).result
				: result;
		addFunctionResult({ address, retval, timestamp: Date.now() });
	} catch (e) {
		console.error("callNativeFunction failed:", e);
		throw e;
	}
}

async function fetchStalkerEvents(
	sessionId: string,
	threadId: number,
): Promise<void> {
	try {
		const result = await invoke<StalkerEvent[] | { events: StalkerEvent[] }>(
			"rpc_call",
			{
				sessionId,
				method: "getStalkerEvents",
				params: { threadId },
			},
		);
		addStalkerEvents(Array.isArray(result) ? result : (result.events ?? []));
	} catch (e) {
		console.error("fetchStalkerEvents failed:", e);
		throw e;
	}
}

function setupStalkerListener(_sessionId: string): () => void {
	return listen<StalkerEvent[] | { events: StalkerEvent[] }>(
		"carf://stalker/event",
		(payload) => {
			addStalkerEvents(
				Array.isArray(payload) ? payload : (payload.events ?? []),
			);
		},
	);
}

export {
	state as nativeState,
	subMode as nativeSubMode,
	setSubMode as setNativeSubMode,
	setInterceptorTarget,
	setStalkerThread,
	addStalkerEvents,
	clearStalkerEvents,
	setStalkerActive,
	setFunctionAddress,
	addFunctionResult,
	hookNativeFunction,
	unhookNativeFunction,
	startStalker,
	stopStalker,
	callNativeFunction,
	fetchStalkerEvents,
	setupStalkerListener,
};
