import { createStore } from "solid-js/store";
import {
	extractEventSessionId,
	normalizeHookEventPayload,
} from "~/lib/event-normalizers";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke, listen } from "~/lib/tauri";
import type { HookConfig, HookEvent, HookInfo } from "~/lib/types";
import { toastError, toastWarning } from "~/features/toast/toast.store";

interface HooksState {
	hooks: HookInfo[];
	recentEvents: Map<string, HookEvent[]>;
}

const DEFAULT_STATE: HooksState = {
	hooks: [],
	recentEvents: new Map(),
};

const [state, setState] = createStore<HooksState>({
	...DEFAULT_STATE,
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

function clearHooks(): void {
	setState(restoreStore(DEFAULT_STATE));
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
		record.type === "native" ||
		record.type === "java" ||
		record.type === "objc" ||
		record.type === "swift" ||
		record.type === "il2cpp"
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
		const [nativeHooks, javaHooks, objcHooks, swiftHooks, il2cppHooks] =
			await Promise.all([
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
			invoke<unknown[]>("rpc_call", {
				sessionId,
				method: "listSwiftHooks",
				params: {},
			}),
			invoke<unknown[]>("rpc_call", {
				sessionId,
				method: "listIl2cppHooks",
				params: {},
			}),
		]);

		const sources: Array<[unknown[], HookInfo["type"]]> = [
			[nativeHooks, "native"],
			[javaHooks, "java"],
			[objcHooks, "objc"],
			[swiftHooks, "swift"],
			[il2cppHooks, "il2cpp"],
		];

		setHooks(
			sources
				.flatMap(([hooks, type]) =>
					hooks.map((hook) => normalizeHookInfo(hook, type)),
				)
				.filter((hook): hook is HookInfo => hook !== null),
		);
	} catch (e) {
		toastError("Failed to fetch hooks", e);
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
						: hook.type === "objc"
							? "setObjcHookActive"
							: hook.type === "swift"
								? "setSwiftHookActive"
								: "setIl2cppHookActive",
			params: { hookId: hook.id, active },
		});
		updateHookStatus(hook.id, active);
	} catch (e) {
		toastError(
			active ? "Failed to enable hook" : "Failed to disable hook",
			e,
		);
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
						: hook.type === "objc"
							? "unhookObjcMethod"
							: hook.type === "swift"
								? "unhookSwiftFunction"
								: "unhookIl2cppMethod",
			params: { hookId: hook.id },
		});
		removeHook(hook.id);
	} catch (e) {
		toastError("Failed to delete hook", e);
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
					toastWarning(
						"Skipped import",
						`Invalid Java target: ${config.target}`,
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
					toastWarning(
						"Skipped import",
						`Invalid ObjC target: ${config.target}`,
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
			} else if (config.type === "swift") {
				const result = await invoke<unknown>("rpc_call", {
					sessionId,
					method: "hookSwiftFunction",
					params: {
						target: config.address ?? config.target,
						...config.options,
					},
				});
				const hook = normalizeHookInfo(result, "swift");
				if (hook) {
					addHook(hook);
				}
			} else if (config.type === "il2cpp") {
				const result = await invoke<unknown>("rpc_call", {
					sessionId,
					method: "hookIl2cppMethod",
					params: {
						address: config.address ?? config.target,
						methodName: config.target,
						...config.options,
					},
				});
				const hook = normalizeHookInfo(result, "il2cpp");
				if (hook) {
					addHook(hook);
				}
			}
		} catch (e) {
			toastError(`Failed to import hook: ${config.target}`, e);
		}
	}
}

function setupHookEventListener(sessionId: string): () => void {
	return listen<HookEvent>("carf://hook/event", (payload) => {
		if (extractEventSessionId(payload) !== sessionId) {
			return;
		}
		recordHookEvent(normalizeHookEventPayload(payload));
	});
}

function snapshotHooksState(): HooksState {
	return snapshotStore(state);
}

function restoreHooksState(snapshot?: HooksState): void {
	setState(restoreStore(snapshot ?? DEFAULT_STATE));
}

export {
	state as hooksState,
	setHooks,
	addHook,
	removeHook,
	clearHooks,
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
	snapshotHooksState,
	restoreHooksState,
};
