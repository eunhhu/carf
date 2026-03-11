import { createDeferred, createMemo, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { scheduleTransition } from "~/lib/scheduling";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke } from "~/lib/tauri";
import type {
	ExportInfo,
	ImportInfo,
	ModuleInfo,
	SymbolInfo,
} from "~/lib/types";

export type ModuleSubTab = "exports" | "imports" | "symbols";

interface ModuleState {
	modules: ModuleInfo[];
	loading: boolean;
	selectedModule: string | null;
	exports: ExportInfo[];
	imports: ImportInfo[];
	symbols: SymbolInfo[];
	exportsLoading: boolean;
	importsLoading: boolean;
	symbolsLoading: boolean;
}

const DEFAULT_STATE: ModuleState = {
	modules: [],
	loading: false,
	selectedModule: null,
	exports: [],
	imports: [],
	symbols: [],
	exportsLoading: false,
	importsLoading: false,
	symbolsLoading: false,
};

const [state, setState] = createStore<ModuleState>({
	...DEFAULT_STATE,
});

const [moduleSubTab, setModuleSubTab] = createSignal<ModuleSubTab>("exports");

const [searchQuery, setSearchQuery] = createSignal("");
const deferredSearchQuery = createDeferred(searchQuery);

const filteredModules = createMemo(() => {
	const query = deferredSearchQuery().trim().toLowerCase();
	if (!query) return state.modules;
	return state.modules.filter(
		(m) =>
			m.name.toLowerCase().includes(query) ||
			m.path.toLowerCase().includes(query),
	);
});

function setModules(modules: ModuleInfo[]): void {
	scheduleTransition(() => {
		setState({ modules, loading: false });
	});
}

function selectModule(name: string | null): void {
	scheduleTransition(() => {
		setState({ selectedModule: name, exports: [], imports: [], symbols: [] });
		setModuleSubTab("exports");
	});
}

function setModuleExports(exports: ExportInfo[]): void {
	scheduleTransition(() => {
		setState({ exports, exportsLoading: false });
	});
}

function setModuleImports(imports: ImportInfo[]): void {
	scheduleTransition(() => {
		setState({ imports, importsLoading: false });
	});
}

function setLoading(loading: boolean): void {
	setState("loading", loading);
}

function setExportsLoading(loading: boolean): void {
	setState("exportsLoading", loading);
}

function resetModuleState(): void {
	setState(restoreStore(DEFAULT_STATE));
	setModuleSubTab("exports");
	setSearchQuery("");
}

function snapshotModuleState(): {
	state: ModuleState;
	moduleSubTab: ModuleSubTab;
	searchQuery: string;
} {
	return {
		state: snapshotStore(state),
		moduleSubTab: moduleSubTab(),
		searchQuery: searchQuery(),
	};
}

function restoreModuleState(snapshot?: {
	state: ModuleState;
	moduleSubTab: ModuleSubTab;
	searchQuery: string;
}): void {
	if (!snapshot) {
		resetModuleState();
		return;
	}

	setState(restoreStore(snapshot.state));
	setModuleSubTab(snapshot.moduleSubTab);
	setSearchQuery(snapshot.searchQuery);
}

const selectedModuleInfo = () =>
	state.modules.find((m) => m.name === state.selectedModule) ?? null;

async function fetchModules(sessionId: string): Promise<void> {
	setLoading(true);
	try {
		const result = await invoke<ModuleInfo[]>("rpc_call", {
			sessionId,
			method: "enumerateModules",
			params: {},
		});
		setModules(result);
	} catch (err) {
		setLoading(false);
		throw err;
	}
}

async function fetchModuleExports(
	sessionId: string,
	moduleName: string,
): Promise<void> {
	setExportsLoading(true);
	try {
		const result = await invoke<ExportInfo[]>("rpc_call", {
			sessionId,
			method: "getModuleExports",
			params: { moduleName },
		});
		setModuleExports(result);
	} catch (err) {
		setExportsLoading(false);
		throw err;
	}
}

async function fetchModuleImports(
	sessionId: string,
	moduleName: string,
): Promise<void> {
	setState("importsLoading", true);
	try {
		const result = await invoke<ImportInfo[]>("rpc_call", {
			sessionId,
			method: "getModuleImports",
			params: { moduleName },
		});
		setModuleImports(result ?? []);
	} catch (err) {
		setState("importsLoading", false);
		throw err;
	}
}

async function fetchModuleSymbols(
	sessionId: string,
	moduleName: string,
): Promise<void> {
	setState("symbolsLoading", true);
	try {
		const result = await invoke<SymbolInfo[]>("rpc_call", {
			sessionId,
			method: "getModuleSymbols",
			params: { moduleName },
		});
		scheduleTransition(() => {
			setState({ symbols: result ?? [], symbolsLoading: false });
		});
	} catch (err) {
		setState("symbolsLoading", false);
		throw err;
	}
}

export {
	state as moduleState,
	searchQuery as moduleSearchQuery,
	setSearchQuery as setModuleSearchQuery,
	moduleSubTab,
	setModuleSubTab,
	filteredModules,
	setModules,
	selectModule,
	setModuleExports,
	setModuleImports,
	setLoading as setModuleLoading,
	setExportsLoading,
	resetModuleState,
	snapshotModuleState,
	restoreModuleState,
	selectedModuleInfo,
	fetchModules,
	fetchModuleExports,
	fetchModuleImports,
	fetchModuleSymbols,
};
