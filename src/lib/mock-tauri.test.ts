import { beforeEach, describe, expect, it } from "vitest";
import { mockInvoke, mockListen, resetMockRuntime } from "~/lib/mock-tauri";
import type { HookEvent, SessionDetachedEvent, SessionInfo } from "~/lib/types";

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

describe("mock-tauri runtime", () => {
	beforeEach(() => {
		resetMockRuntime();
	});

	it("creates sessions and serves RPC-backed tab data", async () => {
		const session = await mockInvoke<SessionInfo>("attach", {
			deviceId: "device-local-1",
			options: { target: 4201 },
		});

		const modules = await mockInvoke<{ name: string }[]>("rpc_call", {
			sessionId: session.id,
			method: "enumerateModules",
			params: {},
		});
		const threads = await mockInvoke<{ id: number }[]>("rpc_call", {
			sessionId: session.id,
			method: "enumerateThreads",
			params: {},
		});

		expect(session.processName).toBe("DemoBank");
		expect(modules[0]?.name).toBe("libdemo.so");
		expect(threads[0]?.id).toBe(1337);
	});

	it("emits hook and detach events for browser-mode flows", async () => {
		const session = await mockInvoke<SessionInfo>("attach", {
			deviceId: "device-local-1",
			options: { target: 4201 },
		});

		const hookEvents: HookEvent[] = [];
		const detachedEvents: SessionDetachedEvent[] = [];
		const unlistenHook = mockListen<HookEvent>("carf://hook/event", (event) => {
			hookEvents.push(event);
		});
		const unlistenDetached = mockListen<SessionDetachedEvent>(
			"carf://session/detached",
			(event) => {
				detachedEvents.push(event);
			},
		);

		await mockInvoke("rpc_call", {
			sessionId: session.id,
			method: "hookFunction",
			params: { target: "libdemo.so!login" },
		});
		await delay(180);
		await mockInvoke("detach", { sessionId: session.id });

		unlistenHook();
		unlistenDetached();

		expect(hookEvents.some((event) => event.hookId.startsWith("hook-"))).toBe(
			true,
		);
		expect(detachedEvents).toEqual([
			{
				sessionId: session.id,
				reason: "application_requested",
			},
		]);
	});
});
