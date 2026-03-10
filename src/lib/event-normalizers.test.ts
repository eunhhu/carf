import { describe, expect, it } from "vitest";
import {
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
});
