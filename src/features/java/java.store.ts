import { createMemo, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { addHook } from "~/features/hooks/hooks.store";
import { activeSession } from "~/features/session/session.store";
import { scheduleTransition } from "~/lib/scheduling";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke } from "~/lib/tauri";
import type { HookInfo, JavaFieldInfo, JavaMethodInfo } from "~/lib/types";

type JavaSubTab = "methods" | "fields" | "instances";
type JavaRequestKind =
	| "availability"
	| "classes"
	| "methods"
	| "fields"
	| "instances";

interface JavaState {
	classesLoading: boolean;
	selectedClass: string | null;
	detailLoading: boolean;
	available: boolean | null;
}

type JavaViewState = JavaState & {
	classes: string[];
	methods: JavaMethodInfo[];
	fields: JavaFieldInfo[];
	instances: unknown[];
};

const DEFAULT_STATE: JavaState = {
	classesLoading: false,
	selectedClass: null,
	detailLoading: false,
	available: null,
};

const [state, setState] = createStore<JavaState>({
	...DEFAULT_STATE,
});
const [classes, setClassesData] = createSignal<string[]>([]);
const [methods, setMethodsData] = createSignal<JavaMethodInfo[]>([]);
const [fields, setFieldsData] = createSignal<JavaFieldInfo[]>([]);
const [instances, setInstancesData] = createSignal<unknown[]>([]);

const [searchQuery, setSearchQuery] = createSignal("");
const [subTab, setSubTab] = createSignal<JavaSubTab>("methods");
const requestVersions = new Map<string, Record<JavaRequestKind, number>>();
const JAVA_CLASS_RESULT_LIMIT = 200;

function getRequestVersions(
	sessionId: string,
): Record<JavaRequestKind, number> {
	const existing = requestVersions.get(sessionId);
	if (existing) {
		return existing;
	}

	const created = {
		availability: 0,
		classes: 0,
		methods: 0,
		fields: 0,
		instances: 0,
	};
	requestVersions.set(sessionId, created);
	return created;
}

function beginRequest(sessionId: string, kind: JavaRequestKind): number {
	const versions = getRequestVersions(sessionId);
	versions[kind] += 1;
	return versions[kind];
}

function shouldCommitRequest(
	sessionId: string,
	kind: JavaRequestKind,
	requestId: number,
): boolean {
	return (
		getRequestVersions(sessionId)[kind] === requestId &&
		activeSession()?.id === sessionId
	);
}

const filteredClasses = createMemo(() => classes());

const javaState: JavaViewState = {
	get classes() {
		return classes();
	},
	get classesLoading() {
		return state.classesLoading;
	},
	get selectedClass() {
		return state.selectedClass;
	},
	get methods() {
		return methods();
	},
	get fields() {
		return fields();
	},
	get instances() {
		return instances();
	},
	get detailLoading() {
		return state.detailLoading;
	},
	get available() {
		return state.available;
	},
};

function setClasses(classes: string[]): void {
	setClassesData(classes);
	setState({ classesLoading: false });
}

function clearJavaClasses(): void {
	setClassesData([]);
	setMethodsData([]);
	setFieldsData([]);
	setInstancesData([]);
	setState({
		classesLoading: false,
		selectedClass: null,
		detailLoading: false,
	});
}

function selectClass(name: string | null): void {
	setMethodsData([]);
	setFieldsData([]);
	setInstancesData([]);
	setState({
		selectedClass: name,
	});
}

function setMethods(methods: JavaMethodInfo[]): void {
	setMethodsData(methods);
	setState({ detailLoading: false });
}

function setFields(fields: JavaFieldInfo[]): void {
	setFieldsData(fields);
}

function setInstances(instances: unknown[]): void {
	setInstancesData(instances);
}

function setAvailable(available: boolean): void {
	setState("available", available);
}

function setClassesLoading(loading: boolean): void {
	setState("classesLoading", loading);
}

function setDetailLoading(loading: boolean): void {
	setState("detailLoading", loading);
}

function resetJavaState(): void {
	setState(restoreStore(DEFAULT_STATE));
	setClassesData([]);
	setMethodsData([]);
	setFieldsData([]);
	setInstancesData([]);
	setSearchQuery("");
	setSubTab("methods");
}

function snapshotJavaState(): {
	state: JavaState;
	classes: string[];
	methods: JavaMethodInfo[];
	fields: JavaFieldInfo[];
	instances: unknown[];
	searchQuery: string;
	subTab: JavaSubTab;
} {
	return {
		state: snapshotStore(state),
		classes: snapshotStore(classes()),
		methods: snapshotStore(methods()),
		fields: snapshotStore(fields()),
		instances: snapshotStore(instances()),
		searchQuery: searchQuery(),
		subTab: subTab(),
	};
}

function restoreJavaState(snapshot?: {
	state: JavaState;
	classes: string[];
	methods: JavaMethodInfo[];
	fields: JavaFieldInfo[];
	instances: unknown[];
	searchQuery: string;
	subTab: JavaSubTab;
}): void {
	if (!snapshot) {
		resetJavaState();
		return;
	}

	setState(restoreStore(snapshot.state));
	setClassesData(restoreStore(snapshot.classes));
	setMethodsData(restoreStore(snapshot.methods));
	setFieldsData(restoreStore(snapshot.fields));
	setInstancesData(restoreStore(snapshot.instances));
	setSearchQuery(snapshot.searchQuery);
	setSubTab(snapshot.subTab);
}

async function checkJavaAvailable(sessionId: string): Promise<boolean> {
	const requestId = beginRequest(sessionId, "availability");
	try {
		const result = await invoke<boolean>("rpc_call", {
			sessionId,
			method: "isJavaAvailable",
			params: {},
		});
		if (shouldCommitRequest(sessionId, "availability", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "availability", requestId)) {
					setAvailable(result);
				}
			});
		}
		return result;
	} catch (e) {
		console.error("checkJavaAvailable error:", e);
		if (shouldCommitRequest(sessionId, "availability", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "availability", requestId)) {
					setAvailable(false);
				}
			});
		}
		return false;
	}
}

async function fetchJavaClasses(
	sessionId: string,
	filter?: string,
): Promise<void> {
	const requestId = beginRequest(sessionId, "classes");
	setClassesLoading(true);
	try {
		const result = await invoke<string[]>("rpc_call", {
			sessionId,
			method: "enumerateJavaClasses",
			params: { filter, limit: JAVA_CLASS_RESULT_LIMIT },
		});
		if (shouldCommitRequest(sessionId, "classes", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "classes", requestId)) {
					setClasses(result);
				}
			});
		}
	} catch (e) {
		if (shouldCommitRequest(sessionId, "classes", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "classes", requestId)) {
					setState({ classesLoading: false });
				}
			});
		}
		console.error("fetchJavaClasses error:", e);
	}
}

async function fetchJavaMethods(
	sessionId: string,
	className: string,
): Promise<void> {
	const requestId = beginRequest(sessionId, "methods");
	setDetailLoading(true);
	try {
		const result = await invoke<JavaMethodInfo[]>("rpc_call", {
			sessionId,
			method: "getJavaMethods",
			params: { className },
		});
		if (shouldCommitRequest(sessionId, "methods", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "methods", requestId)) {
					setMethods(result);
				}
			});
		}
	} catch (e) {
		if (shouldCommitRequest(sessionId, "methods", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "methods", requestId)) {
					setState({ detailLoading: false });
				}
			});
		}
		console.error("fetchJavaMethods error:", e);
	}
}

async function fetchJavaFields(
	sessionId: string,
	className: string,
): Promise<void> {
	const requestId = beginRequest(sessionId, "fields");
	try {
		const result = await invoke<JavaFieldInfo[]>("rpc_call", {
			sessionId,
			method: "getJavaFields",
			params: { className },
		});
		if (shouldCommitRequest(sessionId, "fields", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "fields", requestId)) {
					setFields(result);
				}
			});
		}
	} catch (e) {
		console.error("fetchJavaFields error:", e);
	}
}

async function fetchJavaInstances(
	sessionId: string,
	className: string,
	maxCount?: number,
): Promise<void> {
	const requestId = beginRequest(sessionId, "instances");
	try {
		const result = await invoke<unknown[]>("rpc_call", {
			sessionId,
			method: "chooseJavaInstances",
			params: { className, maxCount: maxCount ?? 10 },
		});
		if (shouldCommitRequest(sessionId, "instances", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "instances", requestId)) {
					setInstances(result);
				}
			});
		}
	} catch (e) {
		console.error("fetchJavaInstances error:", e);
	}
}

async function hookJavaMethod(
	sessionId: string,
	className: string,
	methodName: string,
): Promise<void> {
	try {
		const hook = await invoke<HookInfo>("rpc_call", {
			sessionId,
			method: "hookJavaMethod",
			params: { className, methodName },
		});
		if (activeSession()?.id !== sessionId) {
			return;
		}
		addHook(hook);
		setMethodsData(
			methods().map((method) =>
				method.name === methodName ? { ...method, hooked: true } : method,
			),
		);
	} catch (e) {
		console.error("hookJavaMethod error:", e);
	}
}

export {
	classes as javaClasses,
	methods as javaMethods,
	fields as javaFields,
	instances as javaInstances,
	javaState,
	searchQuery as javaSearchQuery,
	setSearchQuery as setJavaSearchQuery,
	subTab as javaSubTab,
	setSubTab as setJavaSubTab,
	filteredClasses as filteredJavaClasses,
	setClasses as setJavaClasses,
	clearJavaClasses,
	selectClass as selectJavaClass,
	setMethods as setJavaMethods,
	setFields as setJavaFields,
	setInstances as setJavaInstances,
	setAvailable as setJavaAvailable,
	setClassesLoading as setJavaClassesLoading,
	setDetailLoading as setJavaDetailLoading,
	resetJavaState,
	checkJavaAvailable,
	fetchJavaClasses,
	fetchJavaMethods,
	fetchJavaFields,
	fetchJavaInstances,
	hookJavaMethod,
	snapshotJavaState,
	restoreJavaState,
};
