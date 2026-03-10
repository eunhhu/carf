import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import type { StalkerEvent } from "~/lib/types";
import { invoke, listen } from "~/lib/tauri";

export type NativeSubMode = "interceptor" | "stalker" | "functions";

interface FunctionCallResult {
  address: string;
  retval: unknown;
  timestamp: number;
}

interface NativeState {
  interceptorTarget: string;
  stalkerThreadId: number | null;
  stalkerEvents: StalkerEvent[];
  stalkerActive: boolean;
  functionAddress: string;
  functionRetType: string;
  functionArgTypes: string[];
  functionArgs: string[];
  functionResults: FunctionCallResult[];
}

const [state, setState] = createStore<NativeState>({
  interceptorTarget: "",
  stalkerThreadId: null,
  stalkerEvents: [],
  stalkerActive: false,
  functionAddress: "",
  functionRetType: "void",
  functionArgTypes: [],
  functionArgs: [],
  functionResults: [],
});

const [subMode, setSubMode] = createSignal<NativeSubMode>("interceptor");

function setInterceptorTarget(target: string): void {
  setState("interceptorTarget", target);
}

function setStalkerThread(threadId: number | null): void {
  setState("stalkerThreadId", threadId);
}

function addStalkerEvents(events: StalkerEvent[]): void {
  setState("stalkerEvents", (prev) => [...prev, ...events]);
}

function clearStalkerEvents(): void {
  setState("stalkerEvents", []);
}

function setStalkerActive(active: boolean): void {
  setState("stalkerActive", active);
}

function setFunctionAddress(address: string): void {
  setState("functionAddress", address);
}

function addFunctionResult(result: FunctionCallResult): void {
  setState("functionResults", (prev) => [...prev, result]);
}

// ─── RPC Functions ───

async function hookNativeFunction(
  sessionId: string,
  target: string,
  options?: {
    captureArgs?: boolean;
    captureRetval?: boolean;
    captureBacktrace?: boolean;
  },
): Promise<void> {
  try {
    await invoke("rpc_call", {
      sessionId,
      method: "hookFunction",
      params: { target, ...options },
    });
  } catch (e) {
    console.error("hookNativeFunction failed:", e);
    throw e;
  }
}

async function unhookNativeFunction(
  sessionId: string,
  hookId: string,
): Promise<void> {
  try {
    await invoke("rpc_call", {
      sessionId,
      method: "unhookFunction",
      params: { hookId },
    });
  } catch (e) {
    console.error("unhookNativeFunction failed:", e);
    throw e;
  }
}

async function startStalker(
  sessionId: string,
  threadId: number,
  events?: string[],
): Promise<void> {
  setStalkerActive(true);
  try {
    await invoke("rpc_call", {
      sessionId,
      method: "startStalker",
      params: { threadId, events: events ?? ["call", "ret"] },
    });
  } catch (e) {
    setStalkerActive(false);
    console.error("startStalker failed:", e);
    throw e;
  }
}

async function stopStalker(
  sessionId: string,
  threadId: number,
): Promise<void> {
  try {
    await invoke("rpc_call", {
      sessionId,
      method: "stopStalker",
      params: { threadId },
    });
  } catch (e) {
    console.error("stopStalker failed:", e);
    throw e;
  } finally {
    setStalkerActive(false);
  }
}

async function callNativeFunction(
  sessionId: string,
  address: string,
  retType: string,
  argTypes: string[],
  args: string[],
): Promise<void> {
  try {
    const result = await invoke<unknown>("rpc_call", {
      sessionId,
      method: "callFunction",
      params: { address, retType, argTypes, args },
    });
    addFunctionResult({ address, retval: result, timestamp: Date.now() });
  } catch (e) {
    console.error("callNativeFunction failed:", e);
    throw e;
  }
}

async function fetchStalkerEvents(
  sessionId: string,
  threadId: number,
): Promise<void> {
  try {
    const result = await invoke<StalkerEvent[]>("rpc_call", {
      sessionId,
      method: "getStalkerEvents",
      params: { threadId },
    });
    addStalkerEvents(result);
  } catch (e) {
    console.error("fetchStalkerEvents failed:", e);
    throw e;
  }
}

function setupStalkerListener(_sessionId: string): () => void {
  return listen<StalkerEvent[]>(`carf://stalker/event`, (events) => {
    addStalkerEvents(events);
  });
}

export {
  state as nativeState,
  subMode as nativeSubMode,
  setSubMode as setNativeSubMode,
  setInterceptorTarget,
  setStalkerThread,
  addStalkerEvents,
  clearStalkerEvents,
  setStalkerActive,
  setFunctionAddress,
  addFunctionResult,
  hookNativeFunction,
  unhookNativeFunction,
  startStalker,
  stopStalker,
  callNativeFunction,
  fetchStalkerEvents,
  setupStalkerListener,
};
