import { createStore } from "solid-js/store";
import type { HookInfo, HookEvent, HookConfig } from "~/lib/types";
import { invoke, listen } from "~/lib/tauri";

interface HooksState {
  hooks: HookInfo[];
  recentEvents: Map<string, HookEvent[]>;
}

const [state, setState] = createStore<HooksState>({
  hooks: [],
  recentEvents: new Map(),
});

function setHooks(hooks: HookInfo[]): void {
  setState("hooks", hooks);
}

function addHook(hook: HookInfo): void {
  setState("hooks", (prev) => [...prev, hook]);
}

function removeHook(hookId: string): void {
  setState("hooks", (prev) => prev.filter((h) => h.id !== hookId));
}

function updateHookStatus(hookId: string, active: boolean): void {
  setState(
    "hooks",
    (h) => h.id === hookId,
    "active",
    active,
  );
}

function incrementHits(hookId: string): void {
  setState(
    "hooks",
    (h) => h.id === hookId,
    "hits",
    (prev) => prev + 1,
  );
}

function addHookEvent(hookId: string, event: HookEvent): void {
  const maxEvents = 20;
  setState("recentEvents", (prev) => {
    const next = new Map(prev);
    const events = next.get(hookId) ?? [];
    const updated = [...events, event].slice(-maxEvents);
    next.set(hookId, updated);
    return next;
  });
}

function getRecentEvents(hookId: string): HookEvent[] {
  return state.recentEvents.get(hookId) ?? [];
}

function exportHookConfigs(): HookConfig[] {
  return state.hooks.map((h) => ({
    type: h.type,
    target: h.target,
    address: h.address,
    options: {
      captureArgs: true,
      captureRetval: true,
      captureBacktrace: false,
    },
  }));
}

const hooksByType = (type: HookInfo["type"]) =>
  state.hooks.filter((h) => h.type === type);

const activeHooks = () => state.hooks.filter((h) => h.active);

// ─── RPC Functions ───

async function fetchHooks(sessionId: string): Promise<void> {
  try {
    const result = await invoke<HookInfo[]>("rpc_call", {
      sessionId,
      method: "listHooks",
      params: {},
    });
    setHooks(result);
  } catch (e) {
    console.error("fetchHooks failed:", e);
    throw e;
  }
}

async function toggleHook(
  sessionId: string,
  hookId: string,
  active: boolean,
): Promise<void> {
  try {
    await invoke("rpc_call", {
      sessionId,
      method: active ? "enableHook" : "disableHook",
      params: { hookId },
    });
    updateHookStatus(hookId, active);
  } catch (e) {
    console.error("toggleHook failed:", e);
    throw e;
  }
}

async function deleteHook(sessionId: string, hookId: string): Promise<void> {
  try {
    await invoke("rpc_call", {
      sessionId,
      method: "unhookFunction",
      params: { hookId },
    });
    removeHook(hookId);
  } catch (e) {
    console.error("deleteHook failed:", e);
    throw e;
  }
}

async function importHookConfigs(
  sessionId: string,
  configs: HookConfig[],
): Promise<void> {
  for (const config of configs) {
    try {
      if (config.type === "native") {
        await invoke("rpc_call", {
          sessionId,
          method: "hookFunction",
          params: { target: config.target, ...config.options },
        });
      } else if (config.type === "java") {
        await invoke("rpc_call", {
          sessionId,
          method: "hookJavaMethod",
          params: { target: config.target, ...config.options },
        });
      } else if (config.type === "objc") {
        await invoke("rpc_call", {
          sessionId,
          method: "hookObjcMethod",
          params: { target: config.target, ...config.options },
        });
      }
    } catch (e) {
      console.error(`importHookConfigs: failed for ${config.target}:`, e);
    }
  }
}

function setupHookEventListener(_sessionId: string): () => void {
  return listen<HookEvent>(`carf://hook/event`, (event) => {
    addHookEvent(event.hookId, event);
    incrementHits(event.hookId);
  });
}

export {
  state as hooksState,
  setHooks,
  addHook,
  removeHook,
  updateHookStatus,
  incrementHits,
  addHookEvent,
  getRecentEvents,
  exportHookConfigs,
  hooksByType,
  activeHooks,
  fetchHooks,
  toggleHook,
  deleteHook,
  importHookConfigs,
  setupHookEventListener,
};
