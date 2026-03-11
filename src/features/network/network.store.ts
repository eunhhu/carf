import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import {
	extractEventSessionId,
	normalizeNetworkRequestPayload,
} from "~/lib/event-normalizers";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke, listen } from "~/lib/tauri";
import type { NetworkRequest } from "~/lib/types";

interface NetworkState {
	requests: NetworkRequest[];
	capturing: boolean;
	selectedRequestId: string | null;
}

const DEFAULT_STATE: NetworkState = {
	requests: [],
	capturing: false,
	selectedRequestId: null,
};

const [state, setState] = createStore<NetworkState>({
	...DEFAULT_STATE,
});

const [domainFilter, setDomainFilter] = createSignal("");
const [methodFilter, setMethodFilter] = createSignal<string | "all">("all");
const [statusFilter, setStatusFilter] = createSignal<number | "all">("all");

function addRequest(request: NetworkRequest): void {
	setState("requests", (prev) => {
		const existingIndex = findMergeableRequestIndex(prev, request);
		if (existingIndex < 0) {
			return [...prev, request];
		}

		const next = [...prev];
		next[existingIndex] = {
			...next[existingIndex],
			...request,
		};
		return next;
	});
}

function findMergeableRequestIndex(
	requests: NetworkRequest[],
	request: NetworkRequest,
): number {
	const exactIndex = requests.findIndex((entry) => entry.id === request.id);
	if (exactIndex >= 0) {
		return exactIndex;
	}

	if (request.url.startsWith("tls://")) {
		return -1;
	}

	for (let index = requests.length - 1; index >= 0; index -= 1) {
		const entry = requests[index];
		if (entry.url !== request.url || entry.method !== request.method) {
			continue;
		}

		if (Math.abs(entry.timestamp - request.timestamp) > 30_000) {
			continue;
		}

		if (
			entry.statusCode === request.statusCode &&
			entry.duration === request.duration &&
			Object.keys(entry.requestHeaders).length > 0 &&
			Object.keys(request.requestHeaders).length > 0 &&
			Object.keys(entry.responseHeaders).length > 0 &&
			Object.keys(request.responseHeaders).length > 0
		) {
			continue;
		}

		return index;
	}

	return -1;
}

function updateRequest(id: string, updates: Partial<NetworkRequest>): void {
	setState(
		"requests",
		(r) => r.id === id,
		(prev) => ({ ...prev, ...updates }),
	);
}

function selectRequest(id: string | null): void {
	setState("selectedRequestId", id);
}

function setCapturing(capturing: boolean): void {
	setState("capturing", capturing);
}

function clearRequests(): void {
	setState({ requests: [], selectedRequestId: null });
}

function resetNetworkState(): void {
	setState(restoreStore(DEFAULT_STATE));
}

async function startCapture(sessionId: string): Promise<void> {
	try {
		await invoke("rpc_call", {
			sessionId,
			method: "startNetworkCapture",
			params: {},
		});
		setState("capturing", true);
	} catch (err) {
		console.error("[network] startCapture failed:", err);
	}
}

async function stopCapture(sessionId: string): Promise<void> {
	try {
		await invoke("rpc_call", {
			sessionId,
			method: "stopNetworkCapture",
			params: {},
		});
		setState("capturing", false);
	} catch (err) {
		console.error("[network] stopCapture failed:", err);
	}
}

function setupNetworkListener(sessionId: string): () => void {
	const cleanup = listen<NetworkRequest>(
		"carf://network/request",
		(payload) => {
			if (extractEventSessionId(payload) !== sessionId) {
				return;
			}
			const request = normalizeNetworkRequestPayload(payload);
			if (!request) return;
			addRequest(request);
		},
	);
	return cleanup;
}

function exportHar(): string {
	const entries = state.requests.map((req) => ({
		startedDateTime: new Date(req.timestamp).toISOString(),
		time: req.duration ?? 0,
		request: {
			method: req.method,
			url: req.url,
			httpVersion: req.protocol === "https" ? "HTTP/1.1" : "HTTP/1.1",
			headers: Object.entries(req.requestHeaders).map(([name, value]) => ({
				name,
				value,
			})),
			queryString: [],
			cookies: [],
			headersSize: -1,
			bodySize: req.requestBody ? req.requestBody.length : 0,
			postData: req.requestBody
				? { mimeType: "text/plain", text: req.requestBody }
				: undefined,
		},
		response: {
			status: req.statusCode ?? 0,
			statusText: "",
			httpVersion: "HTTP/1.1",
			headers: Object.entries(req.responseHeaders).map(([name, value]) => ({
				name,
				value,
			})),
			cookies: [],
			content: {
				size: req.responseBody ? req.responseBody.length : 0,
				mimeType: req.responseHeaders["content-type"] ?? "text/plain",
				text: req.responseBody ?? "",
			},
			redirectURL: "",
			headersSize: -1,
			bodySize: req.responseBody ? req.responseBody.length : 0,
		},
		cache: {},
		timings: { send: 0, wait: req.duration ?? 0, receive: 0 },
	}));

	const har = {
		log: {
			version: "1.2",
			creator: { name: "CARF", version: "2.0" },
			entries,
		},
	};

	return JSON.stringify(har, null, 2);
}

const filteredRequests = () => {
	let reqs = state.requests;
	const domain = domainFilter().toLowerCase();
	const method = methodFilter();
	const status = statusFilter();

	if (domain) {
		reqs = reqs.filter((r) => {
			try {
				return new URL(r.url).hostname.toLowerCase().includes(domain);
			} catch {
				return r.url.toLowerCase().includes(domain);
			}
		});
	}
	if (method !== "all") {
		reqs = reqs.filter((r) => r.method === method);
	}
	if (status !== "all") {
		reqs = reqs.filter((r) => r.statusCode === status);
	}
	return reqs;
};

const selectedRequest = () =>
	state.requests.find((r) => r.id === state.selectedRequestId) ?? null;

function snapshotNetworkState(): {
	state: NetworkState;
	domainFilter: string;
	methodFilter: string | "all";
	statusFilter: number | "all";
} {
	return {
		state: snapshotStore(state),
		domainFilter: domainFilter(),
		methodFilter: methodFilter(),
		statusFilter: statusFilter(),
	};
}

function restoreNetworkState(snapshot?: {
	state: NetworkState;
	domainFilter: string;
	methodFilter: string | "all";
	statusFilter: number | "all";
}): void {
	if (!snapshot) {
		resetNetworkState();
		setDomainFilter("");
		setMethodFilter("all");
		setStatusFilter("all");
		return;
	}

	setState(restoreStore(snapshot.state));
	setDomainFilter(snapshot.domainFilter);
	setMethodFilter(snapshot.methodFilter);
	setStatusFilter(snapshot.statusFilter);
}

export {
	state as networkState,
	domainFilter,
	setDomainFilter,
	methodFilter,
	setMethodFilter,
	statusFilter,
	setStatusFilter,
	addRequest,
	updateRequest,
	selectRequest,
	setCapturing,
	clearRequests,
	resetNetworkState,
	filteredRequests,
	selectedRequest,
	startCapture,
	stopCapture,
	setupNetworkListener,
	exportHar,
	snapshotNetworkState,
	restoreNetworkState,
};
