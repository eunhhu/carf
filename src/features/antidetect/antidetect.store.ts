import { createStore } from "solid-js/store";
import { activeSession } from "~/features/session/session.store";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke } from "~/lib/tauri";
import { toastError } from "~/features/toast/toast.store";
import type { BypassResult, CloakStatus } from "~/lib/types";

interface RawCloakStatus {
	available?: boolean;
	threads?: number[];
	ranges?: Array<{ base: string; size: number }>;
	cloakedThreads?: number[];
	cloakedRanges?: Array<{ base: string; size: number }>;
}

interface RawBypassResult {
	active?: boolean;
	hooksInstalled?: number;
	message?: string;
	details?: string[];
	type?: BypassResult["type"];
}

interface AntiDetectState {
	cloakStatus: CloakStatus | null;
	statusLoading: boolean;
	sslBypass: BypassResult | null;
	rootBypass: BypassResult | null;
	sslBypassing: boolean;
	rootBypassing: boolean;
}

const DEFAULT_STATE: AntiDetectState = {
	cloakStatus: null,
	statusLoading: false,
	sslBypass: null,
	rootBypass: null,
	sslBypassing: false,
	rootBypassing: false,
};

const [state, setState] = createStore<AntiDetectState>({
	...DEFAULT_STATE,
});

function resetAntiDetectState(): void {
	setState(restoreStore(DEFAULT_STATE));
}

function snapshotAntiDetectState(): { state: AntiDetectState } {
	return { state: snapshotStore(state) };
}

function restoreAntiDetectState(snapshot?: { state: AntiDetectState }): void {
	if (!snapshot) {
		resetAntiDetectState();
		return;
	}
	setState(restoreStore(snapshot.state));
}

function normalizeCloakStatus(result: RawCloakStatus): CloakStatus {
	return {
		cloakedThreads: result.cloakedThreads ?? result.threads ?? [],
		cloakedRanges: result.cloakedRanges ?? result.ranges ?? [],
	};
}

function normalizeBypassResult(
	type: BypassResult["type"],
	result: RawBypassResult,
): BypassResult {
	return {
		type: result.type ?? type,
		hooksInstalled: result.hooksInstalled ?? 0,
		details:
			result.details ??
			(result.message ? [result.message] : []),
	};
}

async function fetchCloakStatus(sessionId: string): Promise<void> {
	setState("statusLoading", true);
	try {
		const result = await invoke<RawCloakStatus>("rpc_call", {
			sessionId,
			method: "getCloakStatus",
			params: {},
		});
		if (activeSession()?.id !== sessionId) return;
		setState({
			cloakStatus: normalizeCloakStatus(result),
			statusLoading: false,
		});
	} catch (e) {
		setState("statusLoading", false);
		toastError("Failed to fetch cloak status", e);
	}
}

async function cloakThread(
	sessionId: string,
	threadId: number,
): Promise<void> {
	try {
		await invoke<void>("rpc_call", {
			sessionId,
			method: "cloakThread",
			params: { threadId },
		});
		if (activeSession()?.id === sessionId) {
			await fetchCloakStatus(sessionId);
		}
	} catch (e) {
		toastError("Failed to cloak thread", e);
	}
}

async function uncloakThread(
	sessionId: string,
	threadId: number,
): Promise<void> {
	try {
		await invoke<void>("rpc_call", {
			sessionId,
			method: "uncloakThread",
			params: { threadId },
		});
		if (activeSession()?.id === sessionId) {
			await fetchCloakStatus(sessionId);
		}
	} catch (e) {
		toastError("Failed to uncloak thread", e);
	}
}

async function cloakRange(
	sessionId: string,
	base: string,
	size: number,
): Promise<void> {
	try {
		await invoke<void>("rpc_call", {
			sessionId,
			method: "cloakRange",
			params: { base, size },
		});
		if (activeSession()?.id === sessionId) {
			await fetchCloakStatus(sessionId);
		}
	} catch (e) {
		toastError("Failed to cloak range", e);
	}
}

async function uncloakRange(
	sessionId: string,
	base: string,
	size: number,
): Promise<void> {
	try {
		await invoke<void>("rpc_call", {
			sessionId,
			method: "uncloakRange",
			params: { base, size },
		});
		if (activeSession()?.id === sessionId) {
			await fetchCloakStatus(sessionId);
		}
	} catch (e) {
		toastError("Failed to uncloak range", e);
	}
}

async function bypassSslPinning(sessionId: string): Promise<void> {
	setState("sslBypassing", true);
	try {
		const result = await invoke<RawBypassResult>("rpc_call", {
			sessionId,
			method: "bypassSslPinning",
			params: {},
		});
		if (activeSession()?.id !== sessionId) return;
		setState({
			sslBypass: normalizeBypassResult("ssl-pinning", result),
			sslBypassing: false,
		});
	} catch (e) {
		setState("sslBypassing", false);
		toastError("Failed to bypass SSL pinning", e);
	}
}

async function bypassRootDetection(sessionId: string): Promise<void> {
	setState("rootBypassing", true);
	try {
		const result = await invoke<RawBypassResult>("rpc_call", {
			sessionId,
			method: "bypassRootDetection",
			params: {},
		});
		if (activeSession()?.id !== sessionId) return;
		setState({
			rootBypass: normalizeBypassResult("root-detection", result),
			rootBypassing: false,
		});
	} catch (e) {
		setState("rootBypassing", false);
		toastError("Failed to bypass root detection", e);
	}
}

export {
	state as antiDetectState,
	resetAntiDetectState,
	snapshotAntiDetectState,
	restoreAntiDetectState,
	fetchCloakStatus,
	cloakThread,
	uncloakThread,
	cloakRange,
	uncloakRange,
	bypassSslPinning,
	bypassRootDetection,
};
