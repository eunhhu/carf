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
	loading: boolean;
	selectedModule: string | null;
	exportsLoading: boolean;
	importsLoading: boolean;
	symbolsLoading: boolean;
}

type ModuleViewState = ModuleState & {
	modules: ModuleInfo[];
	exports: ExportInfo[];
	imports: ImportInfo[];
	symbols: SymbolInfo[];
};

const DEFAULT_STATE: ModuleState = {
	loading: false,
	selectedModule: null,
	exportsLoading: false,
	importsLoading: false,
	symbolsLoading: false,
};

const [state, setState] = createStore<ModuleState>({
	...DEFAULT_STATE,
});
const [modules, setModulesData] = createSignal<ModuleInfo[]>([]);
const [exportsData, setExportsData] = createSignal<ExportInfo[]>([]);
const [importsData, setImportsData] = createSignal<ImportInfo[]>([]);
const [symbolsData, setSymbolsData] = createSignal<SymbolInfo[]>([]);

const [moduleSubTab, setModuleSubTab] = createSignal<ModuleSubTab>("exports");

const [searchQuery, setSearchQuery] = createSignal("");
const deferredSearchQuery = createDeferred(searchQuery);
const filteredModules = createMemo(() => {
	const query = deferredSearchQuery().trim().toLowerCase();
	const items = modules();
	if (!query) return items;
	return items.filter(
		(moduleInfo) =>
			moduleInfo.name.toLowerCase().includes(query) ||
			moduleInfo.path.toLowerCase().includes(query),
	);
});

function setModules(modules: ModuleInfo[]): void {
	scheduleTransition(() => {
		setModulesData(modules);
		setState({ loading: false });
	});
}

function selectModule(name: string | null): void {
	scheduleTransition(() => {
		setExportsData([]);
		setImportsData([]);
		setSymbolsData([]);
		setState({ selectedModule: name });
		setModuleSubTab("exports");
	});
}

function setModuleExports(exports: ExportInfo[]): void {
	scheduleTransition(() => {
		setExportsData(exports);
		setState({ exportsLoading: false });
	});
}

function setModuleImports(imports: ImportInfo[]): void {
	scheduleTransition(() => {
		setImportsData(imports);
		setState({ importsLoading: false });
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
	setModulesData([]);
	setExportsData([]);
	setImportsData([]);
	setSymbolsData([]);
	setModuleSubTab("exports");
	setSearchQuery("");
}

function snapshotModuleState(): {
	state: ModuleState;
	modules: ModuleInfo[];
	exports: ExportInfo[];
	imports: ImportInfo[];
	symbols: SymbolInfo[];
	moduleSubTab: ModuleSubTab;
	searchQuery: string;
} {
	return {
		state: snapshotStore(state),
		modules: snapshotStore(modules()),
		exports: snapshotStore(exportsData()),
		imports: snapshotStore(importsData()),
		symbols: snapshotStore(symbolsData()),
		moduleSubTab: moduleSubTab(),
		searchQuery: searchQuery(),
	};
}

function restoreModuleState(snapshot?: {
	state: ModuleState;
	modules: ModuleInfo[];
	exports: ExportInfo[];
	imports: ImportInfo[];
	symbols: SymbolInfo[];
	moduleSubTab: ModuleSubTab;
	searchQuery: string;
}): void {
	if (!snapshot) {
		resetModuleState();
		return;
	}

	setState(restoreStore(snapshot.state));
	setModulesData(restoreStore(snapshot.modules));
	setExportsData(restoreStore(snapshot.exports));
	setImportsData(restoreStore(snapshot.imports));
	setSymbolsData(restoreStore(snapshot.symbols));
	setModuleSubTab(snapshot.moduleSubTab);
	setSearchQuery(snapshot.searchQuery);
}

const selectedModuleInfo = () =>
	modules().find((moduleInfo) => moduleInfo.name === state.selectedModule) ?? null;

const moduleState: ModuleViewState = {
	get modules() {
		return modules();
	},
	get loading() {
		return state.loading;
	},
	get selectedModule() {
		return state.selectedModule;
	},
	get exports() {
		return exportsData();
	},
	get imports() {
		return importsData();
	},
	get symbols() {
		return symbolsData();
	},
	get exportsLoading() {
		return state.exportsLoading;
	},
	get importsLoading() {
		return state.importsLoading;
	},
	get symbolsLoading() {
		return state.symbolsLoading;
	},
};

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
			setSymbolsData(result ?? []);
			setState({ symbolsLoading: false });
		});
	} catch (err) {
		setState("symbolsLoading", false);
		throw err;
	}
}

export {
	modules as moduleItems,
	exportsData as moduleExports,
	importsData as moduleImports,
	symbolsData as moduleSymbols,
	moduleState,
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
