import type {
	ConsoleLevel,
	ConsoleMessage,
	ConsoleSource,
	HookEvent,
	NetworkRequest,
	StalkerEvent,
} from "~/lib/types";

let networkRequestCounter = 0;
const pendingNativeNetworkRequests = new Map<
	string,
	{ id: string; method: string; url: string; timestamp: number }
>();

function asRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value !== "object" || value === null) {
		return null;
	}

	return value as Record<string, unknown>;
}

function asStringRecord(value: unknown): Record<string, string> {
	const record = asRecord(value);
	if (!record) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(record).map(([key, entry]) => [key, String(entry)]),
	);
}

function buildHookTarget(payload: Record<string, unknown>): string {
	if (typeof payload.target === "string" && payload.target.length > 0) {
		return payload.target;
	}

	if (
		typeof payload.className === "string" &&
		typeof payload.methodName === "string"
	) {
		return `${payload.className}.${payload.methodName}`;
	}

	if (
		typeof payload.className === "string" &&
		typeof payload.selector === "string"
	) {
		return `${payload.className} ${payload.selector}`;
	}

	return "unknown";
}

export function extractEventSessionId(payload: unknown): string | null {
	const record = asRecord(payload);
	if (!record) {
		return null;
	}

	return typeof record.sessionId === "string" && record.sessionId.length > 0
		? record.sessionId
		: null;
}

export function normalizeConsoleMessagePayload(
	payload: unknown,
): Pick<ConsoleMessage, "level" | "source" | "content" | "data"> {
	const record = asRecord(payload);

	if (!record) {
		return {
			level: "info",
			source: "system",
			content: String(payload),
		};
	}

	const level = (record.level as ConsoleLevel | undefined) ?? "info";
	const source = (record.source as ConsoleSource | undefined) ?? "agent";
	const content =
		typeof record.content === "string"
			? record.content
			: typeof record.message === "string"
				? record.message
				: JSON.stringify(record);

	return {
		level,
		source,
		content,
		data: record.data,
	};
}

export function normalizeHookEventPayload(payload: unknown): HookEvent {
	const record = asRecord(payload) ?? {};
	const args = Array.isArray(record.args) ? record.args : [];
	const rawBacktrace = Array.isArray(record.backtrace) ? record.backtrace : [];
	const backtrace = rawBacktrace.map((entry) => {
		const frame = asRecord(entry);

		return {
			address:
				typeof frame?.address === "string"
					? frame.address
					: typeof entry === "string"
						? entry
						: "0x0",
			moduleName:
				typeof frame?.moduleName === "string" ? frame.moduleName : null,
			symbolName:
				typeof frame?.symbolName === "string"
					? frame.symbolName
					: typeof frame?.name === "string"
						? frame.name
						: null,
			fileName: typeof frame?.fileName === "string" ? frame.fileName : null,
			lineNumber:
				typeof frame?.lineNumber === "number" ? frame.lineNumber : null,
		};
	});

	return {
		sessionId:
			typeof record.sessionId === "string" ? record.sessionId : undefined,
		hookId:
			typeof record.hookId === "string" && record.hookId.length > 0
				? record.hookId
				: "unknown",
		type:
			(record.type as HookEvent["type"] | undefined) ??
			(record.eventType as HookEvent["type"] | undefined) ??
			"enter",
		timestamp:
			typeof record.timestamp === "number" ? record.timestamp : Date.now(),
		threadId: typeof record.threadId === "number" ? record.threadId : -1,
		target: buildHookTarget(record),
		address: typeof record.address === "string" ? record.address : null,
		args,
		retval: record.retval ?? null,
		backtrace,
	};
}

function normalizeSingleStalkerEvent(payload: unknown): StalkerEvent | null {
	const record = asRecord(payload);
	if (record) {
		const type = record.type;
		if (
			type === "call" ||
			type === "ret" ||
			type === "exec" ||
			type === "block"
		) {
			return {
				sessionId:
					typeof record.sessionId === "string" ? record.sessionId : undefined,
				threadId: typeof record.threadId === "number" ? record.threadId : -1,
				type,
				from:
					typeof record.from === "string"
						? record.from
						: typeof record.to === "string"
							? record.to
							: "0x0",
				to:
					typeof record.to === "string"
						? record.to
						: typeof record.from === "string"
							? record.from
							: "0x0",
				fromModule:
					typeof record.fromModule === "string" ? record.fromModule : null,
				toModule: typeof record.toModule === "string" ? record.toModule : null,
				fromSymbol:
					typeof record.fromSymbol === "string" ? record.fromSymbol : null,
				toSymbol: typeof record.toSymbol === "string" ? record.toSymbol : null,
				depth: typeof record.depth === "number" ? record.depth : 0,
				count: typeof record.count === "number" ? record.count : 1,
			};
		}
	}

	if (!Array.isArray(payload) || payload.length === 0) {
		return null;
	}

	const [type, fromValue, toValue, depthValue] = payload as [
		unknown,
		unknown,
		unknown?,
		unknown?,
	];

	if (
		type !== "call" &&
		type !== "ret" &&
		type !== "exec" &&
		type !== "block"
	) {
		return null;
	}

	const from =
		type === "exec" ? String(fromValue ?? "0x0") : String(fromValue ?? "0x0");
	const to =
		type === "exec"
			? String(fromValue ?? "0x0")
			: String(toValue ?? fromValue ?? "0x0");

	return {
		threadId: -1,
		type,
		from,
		to,
		fromModule: null,
		toModule: null,
		fromSymbol: null,
		toSymbol: null,
		depth:
			type === "call" || type === "ret"
				? typeof depthValue === "number"
					? depthValue
					: 0
				: 0,
		count: 1,
	};
}

export function normalizeStalkerEventPayload(payload: unknown): StalkerEvent[] {
	const record = asRecord(payload);
	const rawEvents = Array.isArray(record?.events) ? record.events : [payload];

	return rawEvents
		.map((event) => normalizeSingleStalkerEvent(event))
		.filter((event): event is StalkerEvent => event !== null);
}

function nextNetworkRequestId(): string {
	networkRequestCounter += 1;
	return `network-${Date.now()}-${networkRequestCounter}`;
}

function buildRequestUrl(
	headers: Record<string, string>,
	path: string,
	protocol: NetworkRequest["protocol"],
): string {
	const host = headers.host ?? headers[":authority"];

	if (host) {
		return `${protocol}://${host}${path}`;
	}

	return path.startsWith("http://") || path.startsWith("https://")
		? path
		: `${protocol}://unknown${path.startsWith("/") ? path : `/${path}`}`;
}

export function normalizeNetworkRequestPayload(
	payload: unknown,
): NetworkRequest | null {
	const record = asRecord(payload);
	if (!record) {
		return null;
	}

	if (typeof record.url === "string" && typeof record.method === "string") {
		return {
			sessionId:
				typeof record.sessionId === "string" ? record.sessionId : undefined,
			id:
				typeof record.id === "string" && record.id.length > 0
					? record.id
					: nextNetworkRequestId(),
			timestamp:
				typeof record.timestamp === "number" ? record.timestamp : Date.now(),
			method: record.method,
			url: record.url,
			statusCode:
				typeof record.statusCode === "number" ? record.statusCode : null,
			requestHeaders: asStringRecord(record.requestHeaders),
			responseHeaders: asStringRecord(record.responseHeaders),
			requestBody:
				typeof record.requestBody === "string" ? record.requestBody : null,
			responseBody:
				typeof record.responseBody === "string" ? record.responseBody : null,
			duration: typeof record.duration === "number" ? record.duration : null,
			protocol:
				record.protocol === "http" || record.protocol === "https"
					? record.protocol
					: "https",
			source:
				record.source === "java" ||
				record.source === "objc" ||
				record.source === "native"
					? record.source
					: "native",
		};
	}

	const http = asRecord(record.http);
	const preview =
		typeof record.preview === "string" && record.preview.length > 0
			? record.preview
			: null;
	const sessionId =
		typeof record.sessionId === "string" ? record.sessionId : undefined;
	const connectionId =
		typeof record.ssl === "string" && record.ssl.length > 0 ? record.ssl : null;
	if (!http) {
		if (!preview) {
			return null;
		}

		const direction = record.direction === "incoming" ? "incoming" : "outgoing";
		const pending =
			connectionId !== null
				? (pendingNativeNetworkRequests.get(connectionId) ?? null)
				: null;
		const url =
			pending?.url ??
			(typeof record.ssl === "string"
				? `tls://${record.ssl}`
				: "tls://unknown");
		const method =
			pending?.method ?? (direction === "incoming" ? "TLS_READ" : "TLS_WRITE");

		return {
			sessionId,
			id: pending?.id ?? nextNetworkRequestId(),
			timestamp:
				typeof record.timestamp === "number"
					? record.timestamp
					: (pending?.timestamp ?? Date.now()),
			method,
			url,
			statusCode: null,
			requestHeaders: {},
			responseHeaders: {},
			requestBody: direction === "outgoing" ? preview : null,
			responseBody: direction === "incoming" ? preview : null,
			duration: null,
			protocol: "https",
			source: "native",
		};
	}

	const timestamp =
		typeof record.timestamp === "number" ? record.timestamp : Date.now();
	const protocol: NetworkRequest["protocol"] = "https";

	if (http.direction === "request" && typeof http.path === "string") {
		const requestHeaders = asStringRecord(http.headers);
		const url = buildRequestUrl(requestHeaders, http.path, protocol);
		const id = nextNetworkRequestId();

		if (connectionId !== null) {
			pendingNativeNetworkRequests.set(connectionId, {
				id,
				method: typeof http.method === "string" ? http.method : "GET",
				timestamp,
				url,
			});
		}

		return {
			sessionId,
			id,
			timestamp,
			method: typeof http.method === "string" ? http.method : "GET",
			url,
			statusCode: null,
			requestHeaders,
			responseHeaders: {},
			requestBody: typeof http.body === "string" ? http.body : null,
			responseBody: null,
			duration: null,
			protocol,
			source: "native",
		};
	}

	if (http.direction === "response") {
		const pending =
			connectionId !== null
				? (pendingNativeNetworkRequests.get(connectionId) ?? null)
				: null;
		if (connectionId !== null) {
			pendingNativeNetworkRequests.delete(connectionId);
		}

		return {
			sessionId,
			id: pending?.id ?? nextNetworkRequestId(),
			timestamp: pending?.timestamp ?? timestamp,
			method: pending?.method ?? "RESPONSE",
			url:
				pending?.url ??
				(typeof record.ssl === "string"
					? `tls://${record.ssl}`
					: "tls://response"),
			statusCode: typeof http.statusCode === "number" ? http.statusCode : null,
			requestHeaders: {},
			responseHeaders: asStringRecord(http.headers),
			requestBody: null,
			responseBody: typeof http.body === "string" ? http.body : null,
			duration: null,
			protocol,
			source: "native",
		};
	}

	return null;
}
