import { createStore } from "solid-js/store";
import { normalizeHookEventPayload } from "~/lib/event-normalizers";
import { invoke, listen } from "~/lib/tauri";
import type { HookConfig, HookEvent, HookInfo } from "~/lib/types";

interface HooksState {
	hooks: HookInfo[];
	recentEvents: Map<string, HookEvent[]>;
}

const [state, setState] = createStore<HooksState>({
	hooks: [],
	recentEvents: new Map(),
});

function setHooks(hooks: HookInfo[]): void {
	setState("hooks", hooks);
}

function addHook(hook: HookInfo): void {
	const existingIndex = state.hooks.findIndex((item) => item.id === hook.id);

	if (existingIndex !== -1) {
		setState("hooks", existingIndex, hook);
		return;
	}

	setState("hooks", (prev) => [...prev, hook]);
}

function removeHook(hookId: string): void {
	setState("hooks", (prev) => prev.filter((h) => h.id !== hookId));
}

function updateHookStatus(hookId: string, active: boolean): void {
	setState("hooks", (h) => h.id === hookId, "active", active);
}

function incrementHits(hookId: string): void {
	setState(
		"hooks",
		(h) => h.id === hookId,
		"hits",
		(prev) => prev + 1,
	);
}

function addHookEvent(hookId: string, event: HookEvent): void {
	const maxEvents = 20;
	setState("recentEvents", (prev) => {
		const next = new Map(prev);
		const events = next.get(hookId) ?? [];
		const updated = [...events, event].slice(-maxEvents);
		next.set(hookId, updated);
		return next;
	});
}

function recordHookEvent(event: HookEvent): void {
	addHookEvent(event.hookId, event);
	incrementHits(event.hookId);
}

function getRecentEvents(hookId: string): HookEvent[] {
	return state.recentEvents.get(hookId) ?? [];
}

function exportHookConfigs(): HookConfig[] {
	return state.hooks.map((h) => ({
		type: h.type,
		target: h.target,
		address: h.address,
		options: {
			captureArgs: true,
			captureRetval: true,
			captureBacktrace: false,
		},
	}));
}

const hooksByType = (type: HookInfo["type"]) =>
	state.hooks.filter((h) => h.type === type);

const activeHooks = () => state.hooks.filter((h) => h.active);

function normalizeHookInfo(
	payload: unknown,
	fallbackType: HookInfo["type"],
): HookInfo | null {
	if (typeof payload !== "object" || payload === null) {
		return null;
	}

	const record = payload as Record<string, unknown>;
	const id =
		typeof record.id === "string"
			? record.id
			: typeof record.hookId === "string"
				? record.hookId
				: null;

	const type =
		record.type === "native" || record.type === "java" || record.type === "objc"
			? record.type
			: fallbackType;

	if (!id || typeof record.target !== "string") {
		return null;
	}

	return {
		id,
		target: record.target,
		address: typeof record.address === "string" ? record.address : null,
		type,
		active: typeof record.active === "boolean" ? record.active : true,
		hits: typeof record.hits === "number" ? record.hits : 0,
	};
}

function parseJavaTarget(
	target: string,
): { className: string; methodName: string } | null {
	const separator = target.lastIndexOf(".");
	if (separator <= 0 || separator >= target.length - 1) {
		return null;
	}

	return {
		className: target.slice(0, separator),
		methodName: target.slice(separator + 1),
	};
}

function parseObjcTarget(
	target: string,
): { className: string; selector: string } | null {
	const separator = target.indexOf(" ");
	if (separator <= 0 || separator >= target.length - 1) {
		return null;
	}

	return {
		className: target.slice(0, separator),
		selector: target.slice(separator + 1),
	};
}

// ─── RPC Functions ───

async function fetchHooks(sessionId: string): Promise<void> {
	try {
		const [nativeHooks, javaHooks, objcHooks] = await Promise.all([
			invoke<unknown[]>("rpc_call", {
				sessionId,
				method: "listHooks",
				params: {},
			}),
			invoke<unknown[]>("rpc_call", {
				sessionId,
				method: "listJavaHooks",
				params: {},
			}),
			invoke<unknown[]>("rpc_call", {
				sessionId,
				method: "listObjcHooks",
				params: {},
			}),
		]);

		setHooks(
			[...nativeHooks, ...javaHooks, ...objcHooks]
				.map((hook, index) =>
					normalizeHookInfo(
						hook,
						index < nativeHooks.length
							? "native"
							: index < nativeHooks.length + javaHooks.length
								? "java"
								: "objc",
					),
				)
				.filter((hook): hook is HookInfo => hook !== null),
		);
	} catch (e) {
		console.error("fetchHooks failed:", e);
		throw e;
	}
}

async function toggleHook(
	sessionId: string,
	hook: HookInfo,
	active: boolean,
): Promise<void> {
	try {
		await invoke("rpc_call", {
			sessionId,
			method:
				hook.type === "native"
					? "setNativeHookActive"
					: hook.type === "java"
						? "setJavaHookActive"
						: "setObjcHookActive",
			params: { hookId: hook.id, active },
		});
		updateHookStatus(hook.id, active);
	} catch (e) {
		console.error("toggleHook failed:", e);
		throw e;
	}
}

async function deleteHook(sessionId: string, hook: HookInfo): Promise<void> {
	try {
		await invoke("rpc_call", {
			sessionId,
			method:
				hook.type === "native"
					? "unhookFunction"
					: hook.type === "java"
						? "unhookJavaMethod"
						: "unhookObjcMethod",
			params: { hookId: hook.id },
		});
		removeHook(hook.id);
	} catch (e) {
		console.error("deleteHook failed:", e);
		throw e;
	}
}

async function importHookConfigs(
	sessionId: string,
	configs: HookConfig[],
): Promise<void> {
	for (const config of configs) {
		try {
			if (config.type === "native") {
				const result = await invoke<unknown>("rpc_call", {
					sessionId,
					method: "hookFunction",
					params: { target: config.target, ...config.options },
				});
				const hook = normalizeHookInfo(result, "native");
				if (hook) {
					addHook(hook);
				}
			} else if (config.type === "java") {
				const parsed = parseJavaTarget(config.target);
				if (!parsed) {
					console.error(
						`importHookConfigs: invalid Java target ${config.target}`,
					);
					continue;
				}
				const result = await invoke<unknown>("rpc_call", {
					sessionId,
					method: "hookJavaMethod",
					params: { ...parsed },
				});
				const hook = normalizeHookInfo(result, "java");
				if (hook) {
					addHook(hook);
				}
			} else if (config.type === "objc") {
				const parsed = parseObjcTarget(config.target);
				if (!parsed) {
					console.error(
						`importHookConfigs: invalid ObjC target ${config.target}`,
					);
					continue;
				}
				const result = await invoke<unknown>("rpc_call", {
					sessionId,
					method: "hookObjcMethod",
					params: { ...parsed },
				});
				const hook = normalizeHookInfo(result, "objc");
				if (hook) {
					addHook(hook);
				}
			}
		} catch (e) {
			console.error(`importHookConfigs: failed for ${config.target}:`, e);
		}
	}
}

function setupHookEventListener(_sessionId: string): () => void {
	return listen<HookEvent>("carf://hook/event", (payload) => {
		recordHookEvent(normalizeHookEventPayload(payload));
	});
}

export {
	state as hooksState,
	setHooks,
	addHook,
	removeHook,
	updateHookStatus,
	incrementHits,
	addHookEvent,
	recordHookEvent,
	getRecentEvents,
	exportHookConfigs,
	hooksByType,
	activeHooks,
	fetchHooks,
	toggleHook,
	deleteHook,
	importHookConfigs,
	setupHookEventListener,
};
