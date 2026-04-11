import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { appendGraphEvents } from "~/features/callgraph/callgraph.store";
import { addHook } from "~/features/hooks/hooks.store";
import {
	extractEventSessionId,
	normalizeStalkerEventPayload,
} from "~/lib/event-normalizers";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke, listen } from "~/lib/tauri";
import { toastError } from "~/features/toast/toast.store";
import type { HookInfo, StalkerEvent } from "~/lib/types";

export type NativeSubMode = "interceptor" | "stalker" | "functions";
type StalkerMode = "stalker" | "sampling";

interface StartStalkerResult {
	threadId: number;
	started: boolean;
	events: string[];
	mode?: StalkerMode;
}

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
	stalkerMode: StalkerMode;
	functionAddress: string;
	functionRetType: string;
	functionArgTypes: string[];
	functionArgs: string[];
	functionResults: FunctionCallResult[];
}

const DEFAULT_STATE: NativeState = {
	interceptorTarget: "",
	stalkerThreadId: null,
	stalkerEvents: [],
	stalkerActive: false,
	stalkerMode: "stalker",
	functionAddress: "",
	functionRetType: "void",
	functionArgTypes: [],
	functionArgs: [],
	functionResults: [],
};

const [state, setState] = createStore<NativeState>({
	...DEFAULT_STATE,
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

function setStalkerMode(mode: StalkerMode): void {
	setState("stalkerMode", mode);
}

function setFunctionAddress(address: string): void {
	setState("functionAddress", address);
}

function addFunctionResult(result: FunctionCallResult): void {
	setState("functionResults", (prev) => [...prev, result]);
}

function resetNativeState(): void {
	setState(restoreStore(DEFAULT_STATE));
	setSubMode("interceptor");
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
		toastError("Failed to hook native function", e);
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
		toastError("Failed to unhook native function", e);
		throw e;
	}
}

async function startStalker(
	sessionId: string,
	threadId: number,
	events?: string[],
): Promise<void> {
	clearStalkerEvents();
	try {
		const selectedEvents = events ?? ["call", "ret"];
		const result = await invoke<StartStalkerResult>("rpc_call", {
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
		setStalkerThread(threadId);
		setStalkerActive(true);
		const mode = result.mode ?? "stalker";
		setStalkerMode(mode);
		if (mode === "sampling") {
			void fetchStalkerEvents(sessionId, threadId).catch((error) => {
				console.error("initial sampling fetch failed:", error);
			});
		}
	} catch (e) {
		setStalkerActive(false);
		setStalkerThread(null);
		setStalkerMode("stalker");
		toastError("Failed to start stalker", e);
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
		toastError("Failed to stop stalker", e);
		throw e;
	} finally {
		setStalkerActive(false);
		setStalkerThread(null);
		setStalkerMode("stalker");
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
		toastError("Failed to call native function", e);
		throw e;
	}
}

async function fetchStalkerEvents(
	sessionId: string,
	threadId: number,
): Promise<void> {
	try {
		const result = await invoke<unknown>("rpc_call", {
			sessionId,
			method: "getStalkerEvents",
			params: { threadId },
		});
		const events = normalizeStalkerEventPayload(result);
		addStalkerEvents(events);
		appendGraphEvents(events);
	} catch (e) {
		console.error("fetchStalkerEvents failed:", e);
		throw e;
	}
}

function setupStalkerListener(sessionId: string): () => void {
	return listen<unknown>("carf://stalker/event", (payload) => {
		if (extractEventSessionId(payload) !== sessionId) {
			return;
		}
		const events = normalizeStalkerEventPayload(payload);
		addStalkerEvents(events);
		appendGraphEvents(events);
	});
}

function setupStalkerSamplingPoller(sessionId: string): () => void {
	let inFlight = false;

	const timer = setInterval(() => {
		if (
			inFlight ||
			!state.stalkerActive ||
			state.stalkerMode !== "sampling" ||
			state.stalkerThreadId === null
		) {
			return;
		}

		inFlight = true;
		void fetchStalkerEvents(sessionId, state.stalkerThreadId)
			.catch(() => {})
			.finally(() => {
				inFlight = false;
			});
	}, 500);

	return () => clearInterval(timer);
}

function snapshotNativeState(): {
	state: NativeState;
	subMode: NativeSubMode;
} {
	return {
		state: snapshotStore(state),
		subMode: subMode(),
	};
}

function restoreNativeState(snapshot?: {
	state: NativeState;
	subMode: NativeSubMode;
}): void {
	if (!snapshot) {
		resetNativeState();
		return;
	}

	setState(restoreStore(snapshot.state));
	setSubMode(snapshot.subMode);
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
	setStalkerMode,
	setFunctionAddress,
	addFunctionResult,
	resetNativeState,
	hookNativeFunction,
	unhookNativeFunction,
	startStalker,
	stopStalker,
	callNativeFunction,
	fetchStalkerEvents,
	setupStalkerListener,
	setupStalkerSamplingPoller,
	snapshotNativeState,
	restoreNativeState,
};
