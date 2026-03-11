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
	classPointers: Record<string, string>;
	classesLoading: boolean;
	selectedClass: string | null;
	methods: Il2cppMethodInfo[];
	fields: Il2cppFieldInfo[];
	detailLoading: boolean;
	available: boolean | null;
}

interface RawIl2cppInfo {
	name?: string;
	moduleName?: string;
	base?: string;
	size?: number;
	version?: string | null;
}

interface RawIl2cppAssembly {
	name: string;
	imageName: string;
	imagePtr: string;
}

interface RawIl2cppDomains {
	assemblies?: RawIl2cppAssembly[];
}

interface RawIl2cppClassEntry {
	name: string;
	namespace: string;
	classPtr: string;
}

interface RawIl2cppClassResult {
	totalCount?: number;
	classes?: RawIl2cppClassEntry[];
}

interface RawIl2cppMethodInfo {
	name: string;
	address: string;
	paramCount: number;
}

interface RawIl2cppFieldInfo {
	name: string;
	offset: number;
	typeName?: string | null;
}

interface RawIl2cppDump {
	path?: string;
	moduleName?: string;
	totalAssemblies?: number;
	dump?: Array<{ imageName: string; classes: unknown[] }>;
}

const DEFAULT_STATE: Il2cppState = {
	info: null,
	classes: [],
	classPointers: {},
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

function normalizeIl2cppInfo(result: RawIl2cppInfo): Il2cppInfo {
	return {
		available: true,
		moduleName: result.moduleName ?? result.name ?? null,
		base: result.base ?? null,
		size: result.size ?? null,
		version: result.version ?? null,
	};
}

function normalizeIl2cppMethod(
	method: RawIl2cppMethodInfo,
): Il2cppMethodInfo {
	return {
		name: method.name,
		address: method.address,
		paramCount: method.paramCount,
		returnType: "unknown",
		isStatic: false,
		hooked: false,
	};
}

function normalizeIl2cppField(
	field: RawIl2cppFieldInfo,
): Il2cppFieldInfo {
	return {
		name: field.name,
		type: field.typeName ?? "unknown",
		offset: field.offset,
		isStatic: false,
	};
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
			const info = await invoke<RawIl2cppInfo>("rpc_call", {
				sessionId,
				method: "getIl2cppInfo",
				params: {},
			});
			if (shouldCommitRequest(sessionId, "availability", requestId)) {
				setState("info", normalizeIl2cppInfo(info));
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
		const domains = await invoke<RawIl2cppDomains>("rpc_call", {
			sessionId,
			method: "enumerateIl2cppDomains",
			params: {},
		});
		const assemblies = domains.assemblies ?? [];
		const classPointers: Record<string, string> = {};
		const classes: Il2cppClassInfo[] = [];
		const rawQuery = searchQuery().trim().toLowerCase();
		const filter = rawQuery.length >= 2 ? rawQuery : undefined;

		for (let index = 0; index < assemblies.length; index += 1) {
			const assembly = assemblies[index];
			const result = await invoke<RawIl2cppClassResult>("rpc_call", {
				sessionId,
				method: "enumerateIl2cppClasses",
				params: {
					imagePtr: assembly.imagePtr,
					filter,
					maxCount: filter ? 200 : 100,
				},
			});

			for (const cls of result.classes ?? []) {
				const baseFullName = cls.namespace ? `${cls.namespace}.${cls.name}` : cls.name;
				const fullName =
					classPointers[baseFullName] === undefined
						? baseFullName
						: `${baseFullName} [${assembly.imageName}]`;
				classPointers[fullName] = cls.classPtr;
				classes.push({
					name: cls.name,
					namespace: cls.namespace,
					fullName,
					methodCount: 0,
					fieldCount: 0,
					imageIndex: index,
				});
			}
		}

		classes.sort((left, right) => left.fullName.localeCompare(right.fullName));

		if (shouldCommitRequest(sessionId, "classes", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "classes", requestId)) {
					setState({ classes, classPointers, classesLoading: false });
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
	const classPtr = state.classPointers[className];
	if (!classPtr) {
		setState({ methods: [], detailLoading: false });
		return;
	}
	try {
		const result = await invoke<RawIl2cppMethodInfo[]>("rpc_call", {
			sessionId,
			method: "getIl2cppClassMethods",
			params: { classPtr },
		});
		const methods = result.map(normalizeIl2cppMethod);
		if (shouldCommitRequest(sessionId, "methods", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "methods", requestId)) {
					setState({ methods, detailLoading: false });
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
	const classPtr = state.classPointers[className];
	if (!classPtr) {
		setState("fields", []);
		return;
	}
	try {
		const result = await invoke<RawIl2cppFieldInfo[]>("rpc_call", {
			sessionId,
			method: "getIl2cppClassFields",
			params: { classPtr },
		});
		const fields = result.map(normalizeIl2cppField);
		if (shouldCommitRequest(sessionId, "fields", requestId)) {
			scheduleTransition(() => {
				if (shouldCommitRequest(sessionId, "fields", requestId)) {
					setState("fields", fields);
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
	methodName: string,
	address: string,
): Promise<void> {
	try {
		const hook = await invoke<HookInfo>("rpc_call", {
			sessionId,
			method: "hookIl2cppMethod",
			params: { methodName, address },
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
	hookId: string,
	address?: string,
): Promise<void> {
	try {
		await invoke<void>("rpc_call", {
			sessionId,
			method: "unhookIl2cppMethod",
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
		console.error("unhookIl2cppMethod error:", e);
	}
}

async function dumpIl2cppMetadata(sessionId: string): Promise<string | null> {
	try {
		const result = await invoke<RawIl2cppDump>("rpc_call", {
			sessionId,
			method: "dumpIl2cppMetadata",
			params: {},
		});
		if (typeof result.path === "string") {
			return result.path;
		}
		const dumpedClasses = (result.dump ?? []).reduce(
			(total, image) => total + image.classes.length,
			0,
		);
		return `${result.moduleName ?? "IL2CPP"}: ${result.totalAssemblies ?? 0} assemblies, ${dumpedClasses} classes`;
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
