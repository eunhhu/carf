import { createDeferred, createMemo, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { addHook } from "~/features/hooks/hooks.store";
import { scheduleTransition } from "~/lib/scheduling";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke } from "~/lib/tauri";
import type { HookInfo, ObjCMethodInfo } from "~/lib/types";

type ObjCSubTab = "methods" | "instances";

interface ObjCState {
	classes: string[];
	classesLoading: boolean;
	selectedClass: string | null;
	methods: ObjCMethodInfo[];
	instances: unknown[];
	detailLoading: boolean;
	available: boolean | null;
	appClassesOnly: boolean;
}

const DEFAULT_STATE: ObjCState = {
	classes: [],
	classesLoading: false,
	selectedClass: null,
	methods: [],
	instances: [],
	detailLoading: false,
	available: null,
	appClassesOnly: true,
};

const [state, setState] = createStore<ObjCState>({
	...DEFAULT_STATE,
});

const [searchQuery, setSearchQuery] = createSignal("");
const deferredSearchQuery = createDeferred(searchQuery);
const [subTab, setSubTab] = createSignal<ObjCSubTab>("methods");

const filteredClasses = createMemo(() => {
	let classes = state.classes;
	if (state.appClassesOnly) {
		classes = classes.filter(
			(c) => !c.startsWith("NS") && !c.startsWith("UI") && !c.startsWith("_"),
		);
	}
	const query = deferredSearchQuery().trim().toLowerCase();
	if (!query) return classes;
	return classes.filter((c) => c.toLowerCase().includes(query));
});

function setClasses(classes: string[]): void {
	setState({ classes, classesLoading: false });
}

function selectClass(name: string | null): void {
	setState({ selectedClass: name, methods: [], instances: [] });
}

function setMethods(methods: ObjCMethodInfo[]): void {
	setState({ methods, detailLoading: false });
}

function setInstances(instances: unknown[]): void {
	setState("instances", instances);
}

function setAvailable(available: boolean): void {
	setState("available", available);
}

function toggleAppClassesOnly(): void {
	setState("appClassesOnly", (prev) => !prev);
}

function setClassesLoading(loading: boolean): void {
	setState("classesLoading", loading);
}

function setDetailLoading(loading: boolean): void {
	setState("detailLoading", loading);
}

function resetObjcState(): void {
	setState(restoreStore(DEFAULT_STATE));
	setSearchQuery("");
	setSubTab("methods");
}

function snapshotObjcState(): {
	state: ObjCState;
	searchQuery: string;
	subTab: ObjCSubTab;
} {
	return {
		state: snapshotStore(state),
		searchQuery: searchQuery(),
		subTab: subTab(),
	};
}

function restoreObjcState(snapshot?: {
	state: ObjCState;
	searchQuery: string;
	subTab: ObjCSubTab;
}): void {
	if (!snapshot) {
		resetObjcState();
		return;
	}

	setState(restoreStore(snapshot.state));
	setSearchQuery(snapshot.searchQuery);
	setSubTab(snapshot.subTab);
}

async function checkObjcAvailable(sessionId: string): Promise<void> {
	try {
		const result = await invoke<boolean>("rpc_call", {
			sessionId,
			method: "isObjcAvailable",
			params: {},
		});
		setAvailable(result);
	} catch (e) {
		console.error("checkObjcAvailable error:", e);
	}
}

async function fetchObjcClasses(
	sessionId: string,
	filter?: string,
): Promise<void> {
	setClassesLoading(true);
	try {
		const result = await invoke<string[]>("rpc_call", {
			sessionId,
			method: "enumerateObjcClasses",
			params: { filter },
		});
		scheduleTransition(() => {
			setClasses(result);
		});
	} catch (e) {
		setState({ classesLoading: false });
		console.error("fetchObjcClasses error:", e);
	}
}

async function fetchObjcMethods(
	sessionId: string,
	className: string,
): Promise<void> {
	setDetailLoading(true);
	try {
		const result = await invoke<ObjCMethodInfo[]>("rpc_call", {
			sessionId,
			method: "getObjcMethods",
			params: { className },
		});
		scheduleTransition(() => {
			setMethods(result);
		});
	} catch (e) {
		setState({ detailLoading: false });
		console.error("fetchObjcMethods error:", e);
	}
}

async function fetchObjcInstances(
	sessionId: string,
	className: string,
	maxCount?: number,
): Promise<void> {
	try {
		const result = await invoke<unknown[]>("rpc_call", {
			sessionId,
			method: "chooseObjcInstances",
			params: { className, maxCount: maxCount ?? 10 },
		});
		scheduleTransition(() => {
			setInstances(result);
		});
	} catch (e) {
		console.error("fetchObjcInstances error:", e);
	}
}

async function hookObjcMethod(
	sessionId: string,
	className: string,
	selector: string,
): Promise<void> {
	try {
		const hook = await invoke<HookInfo>("rpc_call", {
			sessionId,
			method: "hookObjcMethod",
			params: { className, selector },
		});
		addHook(hook);
		setState(
			"methods",
			(method) => method.selector === selector,
			"hooked",
			true,
		);
	} catch (e) {
		console.error("hookObjcMethod error:", e);
	}
}

export {
	state as objcState,
	searchQuery as objcSearchQuery,
	setSearchQuery as setObjcSearchQuery,
	subTab as objcSubTab,
	setSubTab as setObjcSubTab,
	filteredClasses as filteredObjcClasses,
	setClasses as setObjcClasses,
	selectClass as selectObjcClass,
	setMethods as setObjcMethods,
	setInstances as setObjcInstances,
	setAvailable as setObjcAvailable,
	toggleAppClassesOnly,
	setClassesLoading as setObjcClassesLoading,
	setDetailLoading as setObjcDetailLoading,
	checkObjcAvailable,
	fetchObjcClasses,
	fetchObjcMethods,
	fetchObjcInstances,
	hookObjcMethod,
	resetObjcState,
	snapshotObjcState,
	restoreObjcState,
};
