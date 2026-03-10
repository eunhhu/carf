import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import type { ObjCMethodInfo } from "~/lib/types";
import { invoke } from "~/lib/tauri";

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

const [state, setState] = createStore<ObjCState>({
  classes: [],
  classesLoading: false,
  selectedClass: null,
  methods: [],
  instances: [],
  detailLoading: false,
  available: null,
  appClassesOnly: true,
});

const [searchQuery, setSearchQuery] = createSignal("");
const [subTab, setSubTab] = createSignal<ObjCSubTab>("methods");

const filteredClasses = () => {
  let classes = state.classes;
  if (state.appClassesOnly) {
    classes = classes.filter(
      (c) => !c.startsWith("NS") && !c.startsWith("UI") && !c.startsWith("_"),
    );
  }
  const query = searchQuery().toLowerCase();
  if (!query) return classes;
  return classes.filter((c) => c.toLowerCase().includes(query));
};

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
    setClasses(result);
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
    setMethods(result);
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
    setInstances(result);
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
    await invoke<void>("rpc_call", {
      sessionId,
      method: "hookObjcMethod",
      params: { className, selector },
    });
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
};
