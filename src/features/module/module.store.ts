import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import type { ModuleInfo, ExportInfo, ImportInfo } from "~/lib/types";
import { invoke } from "~/lib/tauri";

interface ModuleState {
  modules: ModuleInfo[];
  loading: boolean;
  selectedModule: string | null;
  exports: ExportInfo[];
  imports: ImportInfo[];
  exportsLoading: boolean;
}

const [state, setState] = createStore<ModuleState>({
  modules: [],
  loading: false,
  selectedModule: null,
  exports: [],
  imports: [],
  exportsLoading: false,
});

const [searchQuery, setSearchQuery] = createSignal("");

const filteredModules = () => {
  const query = searchQuery().toLowerCase();
  if (!query) return state.modules;
  return state.modules.filter(
    (m) =>
      m.name.toLowerCase().includes(query) ||
      m.path.toLowerCase().includes(query),
  );
};

function setModules(modules: ModuleInfo[]): void {
  setState({ modules, loading: false });
}

function selectModule(name: string | null): void {
  setState({ selectedModule: name, exports: [], imports: [] });
}

function setModuleExports(exports: ExportInfo[]): void {
  setState({ exports, exportsLoading: false });
}

function setModuleImports(imports: ImportInfo[]): void {
  setState("imports", imports);
}

function setLoading(loading: boolean): void {
  setState("loading", loading);
}

function setExportsLoading(loading: boolean): void {
  setState("exportsLoading", loading);
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
  try {
    const result = await invoke<ImportInfo[]>("rpc_call", {
      sessionId,
      method: "getModuleImports",
      params: { moduleName },
    });
    setModuleImports(result);
  } catch (err) {
    throw err;
  }
}

export {
  state as moduleState,
  searchQuery as moduleSearchQuery,
  setSearchQuery as setModuleSearchQuery,
  filteredModules,
  setModules,
  selectModule,
  setModuleExports,
  setModuleImports,
  setLoading as setModuleLoading,
  setExportsLoading,
  selectedModuleInfo,
  fetchModules,
  fetchModuleExports,
  fetchModuleImports,
};
