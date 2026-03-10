import type {
	ConsoleLevel,
	ConsoleMessage,
	ConsoleSource,
	HookEvent,
	NetworkRequest,
} from "~/lib/types";

let networkRequestCounter = 0;

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

	if (
		typeof record.id === "string" &&
		typeof record.url === "string" &&
		typeof record.method === "string"
	) {
		return {
			id: record.id,
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
	if (!http) {
		return null;
	}

	const timestamp =
		typeof record.timestamp === "number" ? record.timestamp : Date.now();
	const protocol: NetworkRequest["protocol"] = "https";

	if (http.direction === "request" && typeof http.path === "string") {
		const requestHeaders = asStringRecord(http.headers);

		return {
			id: nextNetworkRequestId(),
			timestamp,
			method: typeof http.method === "string" ? http.method : "GET",
			url: buildRequestUrl(requestHeaders, http.path, protocol),
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
		return {
			id: nextNetworkRequestId(),
			timestamp,
			method: "RESPONSE",
			url:
				typeof record.ssl === "string"
					? `tls://${record.ssl}`
					: "tls://response",
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
