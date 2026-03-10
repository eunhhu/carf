import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { addHook } from "~/features/hooks/hooks.store";
import { invoke } from "~/lib/tauri";
import type { HookInfo, JavaFieldInfo, JavaMethodInfo } from "~/lib/types";

type JavaSubTab = "methods" | "fields" | "instances";

interface JavaState {
	classes: string[];
	classesLoading: boolean;
	selectedClass: string | null;
	methods: JavaMethodInfo[];
	fields: JavaFieldInfo[];
	instances: unknown[];
	detailLoading: boolean;
	available: boolean | null;
}

const [state, setState] = createStore<JavaState>({
	classes: [],
	classesLoading: false,
	selectedClass: null,
	methods: [],
	fields: [],
	instances: [],
	detailLoading: false,
	available: null,
});

const [searchQuery, setSearchQuery] = createSignal("");
const [subTab, setSubTab] = createSignal<JavaSubTab>("methods");

const filteredClasses = () => {
	const query = searchQuery().toLowerCase();
	if (!query) return state.classes;
	return state.classes.filter((c) => c.toLowerCase().includes(query));
};

function setClasses(classes: string[]): void {
	setState({ classes, classesLoading: false });
}

function selectClass(name: string | null): void {
	setState({
		selectedClass: name,
		methods: [],
		fields: [],
		instances: [],
	});
}

function setMethods(methods: JavaMethodInfo[]): void {
	setState({ methods, detailLoading: false });
}

function setFields(fields: JavaFieldInfo[]): void {
	setState("fields", fields);
}

function setInstances(instances: unknown[]): void {
	setState("instances", instances);
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

async function checkJavaAvailable(sessionId: string): Promise<void> {
	try {
		const result = await invoke<boolean>("rpc_call", {
			sessionId,
			method: "isJavaAvailable",
			params: {},
		});
		setAvailable(result);
	} catch (e) {
		console.error("checkJavaAvailable error:", e);
	}
}

async function fetchJavaClasses(
	sessionId: string,
	filter?: string,
): Promise<void> {
	setClassesLoading(true);
	try {
		const result = await invoke<string[]>("rpc_call", {
			sessionId,
			method: "enumerateJavaClasses",
			params: { filter },
		});
		setClasses(result);
	} catch (e) {
		setState({ classesLoading: false });
		console.error("fetchJavaClasses error:", e);
	}
}

async function fetchJavaMethods(
	sessionId: string,
	className: string,
): Promise<void> {
	setDetailLoading(true);
	try {
		const result = await invoke<JavaMethodInfo[]>("rpc_call", {
			sessionId,
			method: "getJavaMethods",
			params: { className },
		});
		setMethods(result);
	} catch (e) {
		setState({ detailLoading: false });
		console.error("fetchJavaMethods error:", e);
	}
}

async function fetchJavaFields(
	sessionId: string,
	className: string,
): Promise<void> {
	try {
		const result = await invoke<JavaFieldInfo[]>("rpc_call", {
			sessionId,
			method: "getJavaFields",
			params: { className },
		});
		setFields(result);
	} catch (e) {
		console.error("fetchJavaFields error:", e);
	}
}

async function fetchJavaInstances(
	sessionId: string,
	className: string,
	maxCount?: number,
): Promise<void> {
	try {
		const result = await invoke<unknown[]>("rpc_call", {
			sessionId,
			method: "chooseJavaInstances",
			params: { className, maxCount: maxCount ?? 10 },
		});
		setInstances(result);
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
		addHook(hook);
		setState("methods", (method) => method.name === methodName, "hooked", true);
	} catch (e) {
		console.error("hookJavaMethod error:", e);
	}
}

export {
	state as javaState,
	searchQuery as javaSearchQuery,
	setSearchQuery as setJavaSearchQuery,
	subTab as javaSubTab,
	setSubTab as setJavaSubTab,
	filteredClasses as filteredJavaClasses,
	setClasses as setJavaClasses,
	selectClass as selectJavaClass,
	setMethods as setJavaMethods,
	setFields as setJavaFields,
	setInstances as setJavaInstances,
	setAvailable as setJavaAvailable,
	setClassesLoading as setJavaClassesLoading,
	setDetailLoading as setJavaDetailLoading,
	checkJavaAvailable,
	fetchJavaClasses,
	fetchJavaMethods,
	fetchJavaFields,
	fetchJavaInstances,
	hookJavaMethod,
};
