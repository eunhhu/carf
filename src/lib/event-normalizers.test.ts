import { describe, expect, it } from "vitest";
import {
	extractEventSessionId,
	normalizeConsoleMessagePayload,
	normalizeHookEventPayload,
	normalizeNetworkRequestPayload,
} from "~/lib/event-normalizers";

describe("normalizeConsoleMessagePayload", () => {
	it("maps agent log payloads to the frontend shape", () => {
		expect(
			normalizeConsoleMessagePayload({
				level: "info",
				message: "hello",
			}),
		).toEqual({
			level: "info",
			source: "agent",
			content: "hello",
			data: undefined,
		});
	});
});

describe("normalizeHookEventPayload", () => {
	it("supports legacy eventType payloads", () => {
		expect(
			normalizeHookEventPayload({
				hookId: "hook-1",
				eventType: "leave",
				className: "com.example.MainActivity",
				methodName: "onCreate",
				threadId: 42,
			}),
		).toMatchObject({
			hookId: "hook-1",
			type: "leave",
			target: "com.example.MainActivity.onCreate",
			threadId: 42,
			args: [],
			backtrace: [],
		});
	});
});

describe("normalizeNetworkRequestPayload", () => {
	it("maps raw agent request payloads into NetworkRequest records", () => {
		const result = normalizeNetworkRequestPayload({
			timestamp: 1234,
			http: {
				direction: "request",
				method: "GET",
				path: "/health",
				headers: {
					host: "example.com",
				},
				body: "",
			},
		});

		expect(result).toMatchObject({
			timestamp: 1234,
			method: "GET",
			url: "https://example.com/health",
			protocol: "https",
			source: "native",
		});
	});

	it("falls back to generic TLS entries when HTTP parsing fails", () => {
		const result = normalizeNetworkRequestPayload({
			timestamp: 5678,
			direction: "outgoing",
			ssl: "0x1234",
			preview: "opaque payload",
		});

		expect(result).toMatchObject({
			timestamp: 5678,
			method: "TLS_WRITE",
			url: "tls://0x1234",
			requestBody: "opaque payload",
			protocol: "https",
			source: "native",
		});
	});

	it("reuses the pending native request id for matching responses", () => {
		const request = normalizeNetworkRequestPayload({
			timestamp: 1000,
			ssl: "0xbeef",
			http: {
				direction: "request",
				method: "GET",
				path: "/status",
				headers: {
					host: "example.com",
				},
				body: "",
			},
		});
		const response = normalizeNetworkRequestPayload({
			timestamp: 1100,
			ssl: "0xbeef",
			http: {
				direction: "response",
				statusCode: 200,
				headers: {
					"content-type": "text/plain",
				},
				body: "ok",
			},
		});

		expect(request).not.toBeNull();
		expect(response).not.toBeNull();
		expect(response).toMatchObject({
			id: request?.id,
			method: request?.method,
			url: request?.url,
			statusCode: 200,
			responseBody: "ok",
		});
	});
});

describe("extractEventSessionId", () => {
	it("reads session ids from event payloads", () => {
		expect(extractEventSessionId({ sessionId: "session-1" })).toBe("session-1");
		expect(extractEventSessionId({})).toBeNull();
		expect(extractEventSessionId(null)).toBeNull();
	});
});
