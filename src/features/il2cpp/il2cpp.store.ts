import { createDeferred, createMemo, createRoot, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { addHook } from "~/features/hooks/hooks.store";
import { activeSession } from "~/features/session/session.store";
import { scheduleTransition } from "~/lib/scheduling";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke } from "~/lib/tauri";
import type {
	HookInfo,
	Il2cppClassInfo,
	Il2cppFieldInfo,
	Il2cppInfo,
	Il2cppMethodInfo,
} from "~/lib/types";

type Il2cppSubTab = "methods" | "fields";
type Il2cppRequestKind =
	| "availability"
	| "classes"
	| "methods"
	| "fields"
	| "hook";

interface Il2cppState {
	info: Il2cppInfo | null;
	classes: Il2cppClassInfo[];
	classesLoading: boolean;
	selectedClass: string | null;
	methods: Il2cppMethodInfo[];
	fields: Il2cppFieldInfo[];
	detailLoading: boolean;
	available: boolean | null;
}

const DEFAULT_STATE: Il2cppState = {
	info: null,
	classes: [],
	classesLoading: false,
	selectedClass: null,
	methods: [],
	fields: [],
	detailLoading: false,
	available: null,
};

const [state, setState] = createStore<Il2cppState>({
	...DEFAULT_STATE,
});

const [searchQuery, setSearchQuery] = createSignal("");
const [subTab, setSubTab] = createSignal<Il2cppSubTab>("methods");
const requestVersions = new Map<string, Record<Il2cppRequestKind, number>>();

function getRequestVersions(
	sessionId: string,
): Record<Il2cppRequestKind, number> {
	const existing = requestVersions.get(sessionId);
	if (existing) return existing;
	const created = { availability: 0, classes: 0, methods: 0, fields: 0, hook: 0 };
	requestVersions.set(sessionId, created);
	return created;
}

function beginRequest(sessionId: string, kind: Il2cppRequestKind): number {
	const versions = getRequestVersions(sessionId);
	versions[kind] += 1;
	return versions[kind];
}

function shouldCommitRequest(
	sessionId: string,
	kind: Il2cppRequestKind,
	requestId: number,
): boolean {
	return (
		getRequestVersions(sessionId)[kind] === requestId &&
		activeSession()?.id === sessionId
	);
}

const { filteredClasses } = createRoot(() => {
	const deferredSearchQuery = createDeferred(searchQuery);
	return {
		filteredClasses: createMemo(() => {
			const query = deferredSearchQuery().trim().toLowerCase();
			if (!query) return state.classes;
			return state.classes.filter((c) =>
				c.fullName.toLowerCase().includes(query),
			);
		}),
	};
});

function resetIl2cppState(): void {
	setState(restoreStore(DEFAULT_STATE));
	setSearchQuery("");
	setSubTab("methods");
}

function snapshotIl2cppState(): {
	state: Il2cppState;
	searchQuery: string;
	subTab: Il2cppSubTab;
} {
	return {
		state: snapshotStore(state),
		searchQuery: searchQuery(),
		subTab: subTab(),
	};
}

function restoreIl2cppState(snapshot?: {
	state: Il2cppState;
	searchQuery: string;
	subTab: Il2cppSubTab;
}): void {
	if (!snapshot) {
		resetIl2cppState();
		return;
	}
	setState(restoreStore(snapshot.state));
	setSearchQuery(snapshot.searchQuery);
	setSubTab(snapshot.subTab);
}

async function checkIl2cppAvailable(sessionId: string): Promise<boolean> {
	const requestId = beginRequest(sessionId, "availability");
	try {
		const result = await invoke<boolean>("rpc_call", {
			sessionId,
			method: "isIl2cppAvailable",
			params: {},
		});
		if (shouldCommitRequest(sessionId, "availability", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "availability", requestId)) {
					setState("available", result);
				}
			});
		}
		if (result) {
			const info = await invoke<Il2cppInfo>("rpc_call", {
				sessionId,
				method: "getIl2cppInfo",
				params: {},
			});
			if (shouldCommitRequest(sessionId, "availability", requestId)) {
				setState("info", info);
			}
		}
		return result;
	} catch (e) {
		console.error("checkIl2cppAvailable error:", e);
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

async function fetchIl2cppClasses(sessionId: string): Promise<void> {
	const requestId = beginRequest(sessionId, "classes");
	setState("classesLoading", true);
	try {
		const result = await invoke<Il2cppClassInfo[]>("rpc_call", {
			sessionId,
			method: "enumerateIl2cppClasses",
			params: {},
		});
		if (shouldCommitRequest(sessionId, "classes", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "classes", requestId)) {
					setState({ classes: result, classesLoading: false });
				}
			});
		}
	} catch (e) {
		if (shouldCommitRequest(sessionId, "classes", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "classes", requestId)) {
					setState("classesLoading", false);
				}
			});
		}
		console.error("fetchIl2cppClasses error:", e);
	}
}

async function fetchIl2cppMethods(
	sessionId: string,
	className: string,
): Promise<void> {
	const requestId = beginRequest(sessionId, "methods");
	setState("detailLoading", true);
	try {
		const result = await invoke<Il2cppMethodInfo[]>("rpc_call", {
			sessionId,
			method: "getIl2cppClassMethods",
			params: { className },
		});
		if (shouldCommitRequest(sessionId, "methods", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "methods", requestId)) {
					setState({ methods: result, detailLoading: false });
				}
			});
		}
	} catch (e) {
		if (shouldCommitRequest(sessionId, "methods", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "methods", requestId)) {
					setState("detailLoading", false);
				}
			});
		}
		console.error("fetchIl2cppMethods error:", e);
	}
}

async function fetchIl2cppFields(
	sessionId: string,
	className: string,
): Promise<void> {
	const requestId = beginRequest(sessionId, "fields");
	try {
		const result = await invoke<Il2cppFieldInfo[]>("rpc_call", {
			sessionId,
			method: "getIl2cppClassFields",
			params: { className },
		});
		if (shouldCommitRequest(sessionId, "fields", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "fields", requestId)) {
					setState("fields", result);
				}
			});
		}
	} catch (e) {
		console.error("fetchIl2cppFields error:", e);
	}
}

function selectIl2cppClass(name: string | null): void {
	setState({
		selectedClass: name,
		methods: [],
		fields: [],
	});
}

async function hookIl2cppMethod(
	sessionId: string,
	className: string,
	methodName: string,
	address: string,
): Promise<void> {
	try {
		const hook = await invoke<HookInfo>("rpc_call", {
			sessionId,
			method: "hookIl2cppMethod",
			params: { className, methodName, address },
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
		console.error("hookIl2cppMethod error:", e);
	}
}

async function unhookIl2cppMethod(
	sessionId: string,
	address: string,
): Promise<void> {
	try {
		await invoke<void>("rpc_call", {
			sessionId,
			method: "unhookIl2cppMethod",
			params: { address },
		});
		if (activeSession()?.id !== sessionId) return;
		setState(
			"methods",
			(m) => m.address === address,
			"hooked",
			false,
		);
	} catch (e) {
		console.error("unhookIl2cppMethod error:", e);
	}
}

async function dumpIl2cppMetadata(sessionId: string): Promise<string | null> {
	try {
		const result = await invoke<{ path: string }>("rpc_call", {
			sessionId,
			method: "dumpIl2cppMetadata",
			params: {},
		});
		return result.path;
	} catch (e) {
		console.error("dumpIl2cppMetadata error:", e);
		return null;
	}
}

export {
	state as il2cppState,
	searchQuery as il2cppSearchQuery,
	setSearchQuery as setIl2cppSearchQuery,
	subTab as il2cppSubTab,
	setSubTab as setIl2cppSubTab,
	filteredClasses as filteredIl2cppClasses,
	selectIl2cppClass,
	resetIl2cppState,
	snapshotIl2cppState,
	restoreIl2cppState,
	checkIl2cppAvailable,
	fetchIl2cppClasses,
	fetchIl2cppMethods,
	fetchIl2cppFields,
	hookIl2cppMethod,
	unhookIl2cppMethod,
	dumpIl2cppMetadata,
};
