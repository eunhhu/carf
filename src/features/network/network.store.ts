import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { normalizeNetworkRequestPayload } from "~/lib/event-normalizers";
import { invoke, listen } from "~/lib/tauri";
import type { NetworkRequest } from "~/lib/types";

interface NetworkState {
	requests: NetworkRequest[];
	capturing: boolean;
	selectedRequestId: string | null;
}

const [state, setState] = createStore<NetworkState>({
	requests: [],
	capturing: false,
	selectedRequestId: null,
});

const [domainFilter, setDomainFilter] = createSignal("");
const [methodFilter, setMethodFilter] = createSignal<string | "all">("all");
const [statusFilter, setStatusFilter] = createSignal<number | "all">("all");

function addRequest(request: NetworkRequest): void {
	setState("requests", (prev) => [...prev, request]);
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
			const request = normalizeNetworkRequestPayload(payload);
			if (!request) return;
			setState("requests", (prev) => [...prev, request]);
		},
	);
	// sessionId reserved for future filtering
	void sessionId;
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
	filteredRequests,
	selectedRequest,
	startCapture,
	stopCapture,
	setupNetworkListener,
	exportHar,
};
