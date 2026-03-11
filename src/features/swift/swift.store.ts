import { createDeferred, createMemo, createRoot, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { addHook } from "~/features/hooks/hooks.store";
import { activeSession } from "~/features/session/session.store";
import { scheduleTransition } from "~/lib/scheduling";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke } from "~/lib/tauri";
import type { HookInfo, SwiftMethodInfo, SwiftTypeInfo } from "~/lib/types";

type SwiftSubTab = "methods";
type SwiftRequestKind = "availability" | "modules" | "types" | "hook";

interface SwiftState {
	modules: string[];
	modulesLoading: boolean;
	selectedModule: string | null;
	types: SwiftTypeInfo[];
	typesLoading: boolean;
	selectedType: string | null;
	methods: SwiftMethodInfo[];
	available: boolean | null;
}

interface RawSwiftModule {
	name: string;
	path?: string;
}

interface RawSwiftMethodInfo {
	name?: string;
	mangledName?: string;
	address?: string;
	hooked?: boolean;
}

interface RawSwiftTypeInfo {
	name: string;
	kind?: string;
	mangledName?: string;
	metadataPointer?: string;
	address?: string;
	moduleName?: string;
	methods?: RawSwiftMethodInfo[];
}

const DEFAULT_STATE: SwiftState = {
	modules: [],
	modulesLoading: false,
	selectedModule: null,
	types: [],
	typesLoading: false,
	selectedType: null,
	methods: [],
	available: null,
};

const [state, setState] = createStore<SwiftState>({
	...DEFAULT_STATE,
});

const [searchQuery, setSearchQuery] = createSignal("");
const [subTab, setSubTab] = createSignal<SwiftSubTab>("methods");
const requestVersions = new Map<string, Record<SwiftRequestKind, number>>();

function getRequestVersions(
	sessionId: string,
): Record<SwiftRequestKind, number> {
	const existing = requestVersions.get(sessionId);
	if (existing) return existing;
	const created = { availability: 0, modules: 0, types: 0, hook: 0 };
	requestVersions.set(sessionId, created);
	return created;
}

function beginRequest(sessionId: string, kind: SwiftRequestKind): number {
	const versions = getRequestVersions(sessionId);
	versions[kind] += 1;
	return versions[kind];
}

function shouldCommitRequest(
	sessionId: string,
	kind: SwiftRequestKind,
	requestId: number,
): boolean {
	return (
		getRequestVersions(sessionId)[kind] === requestId &&
		activeSession()?.id === sessionId
	);
}

const { filteredModules } = createRoot(() => {
	const deferredSearchQuery = createDeferred(searchQuery);
	return {
		filteredModules: createMemo(() => {
			const query = deferredSearchQuery().trim().toLowerCase();
			if (!query) return state.modules;
			return state.modules.filter((m) => m.toLowerCase().includes(query));
		}),
	};
});

function resetSwiftState(): void {
	setState(restoreStore(DEFAULT_STATE));
	setSearchQuery("");
	setSubTab("methods");
}

function snapshotSwiftState(): {
	state: SwiftState;
	searchQuery: string;
	subTab: SwiftSubTab;
} {
	return {
		state: snapshotStore(state),
		searchQuery: searchQuery(),
		subTab: subTab(),
	};
}

function restoreSwiftState(snapshot?: {
	state: SwiftState;
	searchQuery: string;
	subTab: SwiftSubTab;
}): void {
	if (!snapshot) {
		resetSwiftState();
		return;
	}
	setState(restoreStore(snapshot.state));
	setSearchQuery(snapshot.searchQuery);
	setSubTab(snapshot.subTab);
}

function normalizeSwiftKind(
	kind: string | undefined,
): SwiftTypeInfo["kind"] {
	switch (kind) {
		case "class":
		case "struct":
		case "enum":
		case "protocol":
			return kind;
		default:
			return "unknown";
	}
}

function normalizeSwiftMethodInfo(
	method: RawSwiftMethodInfo,
): SwiftMethodInfo {
	return {
		name: method.name ?? "(anonymous)",
		mangledName: method.mangledName ?? method.name ?? "",
		address: method.address ?? "0x0",
		hooked: method.hooked ?? false,
	};
}

function normalizeSwiftTypeInfo(
	moduleName: string,
	type: RawSwiftTypeInfo,
): SwiftTypeInfo {
	return {
		name: type.name,
		mangledName:
			type.mangledName ??
			type.metadataPointer ??
			type.address ??
			type.name,
		kind: normalizeSwiftKind(type.kind),
		moduleName: type.moduleName ?? moduleName,
		methods: Array.isArray(type.methods)
			? type.methods.map(normalizeSwiftMethodInfo)
			: [],
	};
}

async function checkSwiftAvailable(sessionId: string): Promise<boolean> {
	const requestId = beginRequest(sessionId, "availability");
	try {
		const result = await invoke<boolean>("rpc_call", {
			sessionId,
			method: "isSwiftAvailable",
			params: {},
		});
		if (shouldCommitRequest(sessionId, "availability", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "availability", requestId)) {
					setState("available", result);
				}
			});
		}
		return result;
	} catch (e) {
		console.error("checkSwiftAvailable error:", e);
		if (shouldCommitRequest(sessionId, "availability", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "availability", requestId)) {
					setState("available", false);
				}
			});
		}
		return false;
	}
}

async function fetchSwiftModules(sessionId: string): Promise<void> {
	const requestId = beginRequest(sessionId, "modules");
	setState("modulesLoading", true);
	try {
		const result = await invoke<Array<string | RawSwiftModule>>("rpc_call", {
			sessionId,
			method: "enumerateSwiftModules",
			params: {},
		});
		const modules = result.map((entry) =>
			typeof entry === "string" ? entry : entry.name,
		);
		if (shouldCommitRequest(sessionId, "modules", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "modules", requestId)) {
					setState({ modules, modulesLoading: false });
				}
			});
		}
	} catch (e) {
		if (shouldCommitRequest(sessionId, "modules", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "modules", requestId)) {
					setState("modulesLoading", false);
				}
			});
		}
		console.error("fetchSwiftModules error:", e);
	}
}

async function fetchSwiftTypes(
	sessionId: string,
	moduleName: string,
): Promise<void> {
	const requestId = beginRequest(sessionId, "types");
	setState("typesLoading", true);
	try {
		const result = await invoke<RawSwiftTypeInfo[]>("rpc_call", {
			sessionId,
			method: "enumerateSwiftTypes",
			params: { moduleName },
		});
		const types = result.map((type) => normalizeSwiftTypeInfo(moduleName, type));
		if (shouldCommitRequest(sessionId, "types", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "types", requestId)) {
					setState({ types, typesLoading: false });
				}
			});
		}
	} catch (e) {
		if (shouldCommitRequest(sessionId, "types", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "types", requestId)) {
					setState("typesLoading", false);
				}
			});
		}
		console.error("fetchSwiftTypes error:", e);
	}
}

function selectSwiftModule(name: string | null): void {
	setState({
		selectedModule: name,
		types: [],
		selectedType: null,
		methods: [],
	});
}

function selectSwiftType(name: string | null): void {
	const type = state.types.find((t) => t.name === name);
	setState({
		selectedType: name,
		methods: type?.methods ?? [],
	});
}

async function hookSwiftFunction(
	sessionId: string,
	address: string,
	name: string,
): Promise<void> {
	try {
		const hook = await invoke<HookInfo>("rpc_call", {
			sessionId,
			method: "hookSwiftFunction",
			params: { target: address || name },
		});
		if (activeSession()?.id !== sessionId) return;
		addHook(hook);
		setState(
			"methods",
			(m) => m.address === address,
			"hooked",
			true,
		);
	} catch (e) {
		console.error("hookSwiftFunction error:", e);
	}
}

async function unhookSwiftFunction(
	sessionId: string,
	hookId: string,
	address?: string,
): Promise<void> {
	try {
		await invoke<void>("rpc_call", {
			sessionId,
			method: "unhookSwiftFunction",
			params: { hookId },
		});
		if (activeSession()?.id !== sessionId) return;
		if (address) {
			setState(
				"methods",
				(m) => m.address === address,
				"hooked",
				false,
			);
		}
	} catch (e) {
		console.error("unhookSwiftFunction error:", e);
	}
}

export {
	state as swiftState,
	searchQuery as swiftSearchQuery,
	setSearchQuery as setSwiftSearchQuery,
	subTab as swiftSubTab,
	setSubTab as setSwiftSubTab,
	filteredModules as filteredSwiftModules,
	selectSwiftModule,
	selectSwiftType,
	resetSwiftState,
	snapshotSwiftState,
	restoreSwiftState,
	checkSwiftAvailable,
	fetchSwiftModules,
	fetchSwiftTypes,
	hookSwiftFunction,
	unhookSwiftFunction,
};
