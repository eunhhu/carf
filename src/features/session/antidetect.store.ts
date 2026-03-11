import { createStore } from "solid-js/store";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke } from "~/lib/tauri";
import type { CloakStatus, BypassResult } from "~/lib/types";

interface AntiDetectState {
	sslPinningBypassed: boolean;
	rootDetectionBypassed: boolean;
	cloakedThreads: number[];
	cloakedRanges: Array<{ base: string; size: number }>;
	bypassResults: BypassResult[];
}

const DEFAULT_STATE: AntiDetectState = {
	sslPinningBypassed: false,
	rootDetectionBypassed: false,
	cloakedThreads: [],
	cloakedRanges: [],
	bypassResults: [],
};

const [antiDetectState, setAntiDetectState] = createStore<AntiDetectState>({
	...DEFAULT_STATE,
});

async function bypassSslPinning(sessionId: string): Promise<BypassResult> {
	const result = await invoke<BypassResult>("rpc_call", {
		sessionId,
		method: "bypassSslPinning",
		params: {},
	});
	setAntiDetectState("sslPinningBypassed", true);
	setAntiDetectState("bypassResults", (prev) => [...prev, result]);
	return result;
}

async function bypassRootDetection(sessionId: string): Promise<BypassResult> {
	const result = await invoke<BypassResult>("rpc_call", {
		sessionId,
		method: "bypassRootDetection",
		params: {},
	});
	setAntiDetectState("rootDetectionBypassed", true);
	setAntiDetectState("bypassResults", (prev) => [...prev, result]);
	return result;
}

async function cloakThread(
	sessionId: string,
	threadId: number,
): Promise<void> {
	await invoke("rpc_call", {
		sessionId,
		method: "cloakThread",
		params: { threadId },
	});
	setAntiDetectState("cloakedThreads", (prev) => [...prev, threadId]);
}

async function uncloakThread(
	sessionId: string,
	threadId: number,
): Promise<void> {
	await invoke("rpc_call", {
		sessionId,
		method: "uncloakThread",
		params: { threadId },
	});
	setAntiDetectState("cloakedThreads", (prev) =>
		prev.filter((t) => t !== threadId),
	);
}

async function refreshCloakStatus(sessionId: string): Promise<void> {
	const result = await invoke<CloakStatus>("rpc_call", {
		sessionId,
		method: "getCloakStatus",
		params: {},
	});
	setAntiDetectState({
		cloakedThreads: result.cloakedThreads,
		cloakedRanges: result.cloakedRanges,
	});
}

function resetAntiDetectState(): void {
	setAntiDetectState(restoreStore(DEFAULT_STATE));
}

function snapshotAntiDetectState(): AntiDetectState {
	return snapshotStore(antiDetectState);
}

function restoreAntiDetectState(snapshot?: AntiDetectState): void {
	setAntiDetectState(restoreStore(snapshot ?? DEFAULT_STATE));
}

export {
	antiDetectState,
	bypassSslPinning,
	bypassRootDetection,
	cloakThread,
	uncloakThread,
	refreshCloakStatus,
	resetAntiDetectState,
	snapshotAntiDetectState,
	restoreAntiDetectState,
};
