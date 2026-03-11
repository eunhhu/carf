import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import type { ThreadInfo, BacktraceFrame, StalkerEvent } from "~/lib/types";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke, listen } from "~/lib/tauri";
import {
  extractEventSessionId,
  normalizeStalkerEventPayload,
} from "~/lib/event-normalizers";

type RefreshInterval = 2000 | 5000 | 0;
export type ThreadSubTab = "backtrace" | "context" | "stalker";
type StalkerMode = "stalker" | "sampling";

interface ThreadContext {
  pc: string;
  sp: string;
  regs: Record<string, string>;
}

interface StartStalkerResult {
  threadId: number;
  started: boolean;
  events: string[];
  mode?: StalkerMode;
}

interface ThreadState {
  threads: ThreadInfo[];
  loading: boolean;
  selectedThreadId: number | null;
  backtrace: BacktraceFrame[];
  backtraceLoading: boolean;
  context: ThreadContext | null;
  contextLoading: boolean;
  stalkerActive: boolean;
  stalkerEvents: StalkerEvent[];
}

const DEFAULT_STATE: ThreadState = {
  threads: [],
  loading: false,
  selectedThreadId: null,
  backtrace: [],
  backtraceLoading: false,
  context: null,
  contextLoading: false,
  stalkerActive: false,
  stalkerEvents: [],
};

const [state, setState] = createStore<ThreadState>({
  ...DEFAULT_STATE,
});

const [refreshInterval, setRefreshInterval] = createSignal<RefreshInterval>(0);
const [subTab, setSubTab] = createSignal<ThreadSubTab>("backtrace");

function setThreads(threads: ThreadInfo[]): void {
  setState({ threads, loading: false });
}

function selectThread(threadId: number | null): void {
  setState({
    selectedThreadId: threadId,
    backtrace: [],
    backtraceLoading: false,
    context: null,
    contextLoading: false,
  });
}

function setBacktrace(frames: BacktraceFrame[]): void {
  setState({ backtrace: frames, backtraceLoading: false });
}

function setLoading(loading: boolean): void {
  setState("loading", loading);
}

function setBacktraceLoading(loading: boolean): void {
  setState("backtraceLoading", loading);
}

function resetThreadState(): void {
  setState(restoreStore(DEFAULT_STATE));
  setRefreshInterval(0);
  setSubTab("backtrace");
}

function snapshotThreadState(): {
  state: ThreadState;
  refreshInterval: RefreshInterval;
  subTab: ThreadSubTab;
} {
  return {
    state: snapshotStore(state),
    refreshInterval: refreshInterval(),
    subTab: subTab(),
  };
}

function restoreThreadState(snapshot?: {
  state: ThreadState;
  refreshInterval: RefreshInterval;
  subTab: ThreadSubTab;
}): void {
  if (!snapshot) {
    resetThreadState();
    return;
  }

  setState(restoreStore(snapshot.state));
  setRefreshInterval(snapshot.refreshInterval);
  setSubTab(snapshot.subTab);
}

const selectedThread = () =>
  state.threads.find((t) => t.id === state.selectedThreadId) ?? null;

const threadsByState = (threadState: ThreadInfo["state"]) =>
  state.threads.filter((t) => t.state === threadState);

async function fetchThreads(sessionId: string): Promise<void> {
  setLoading(true);
  try {
    const result = await invoke<ThreadInfo[]>("rpc_call", {
      sessionId,
      method: "enumerateThreads",
      params: {},
    });
    setThreads(result);
  } catch (err) {
    setLoading(false);
    throw err;
  }
}

async function fetchBacktrace(
  sessionId: string,
  threadId: number,
): Promise<void> {
  setState({ backtrace: [], backtraceLoading: true });
  try {
    const result = await invoke<BacktraceFrame[]>("rpc_call", {
      sessionId,
      method: "getBacktrace",
      params: { threadId },
    });
    setBacktrace(result);
  } catch (err) {
    setState({ backtrace: [], backtraceLoading: false });
    console.error("fetchBacktrace error:", err);
  }
}

async function fetchContext(
  sessionId: string,
  threadId: number,
): Promise<void> {
  setState({ context: null, contextLoading: true });
  try {
    const result = await invoke<ThreadContext>("rpc_call", {
      sessionId,
      method: "getThreadContext",
      params: { threadId },
    });
    setState({ context: result, contextLoading: false });
  } catch (err) {
    setState({ context: null, contextLoading: false });
    console.error("fetchContext error:", err);
  }
}

let stalkerUnlisten: (() => void) | null = null;
let stalkerPoller: ReturnType<typeof setInterval> | null = null;

function clearStalkerTracking(): void {
  stalkerUnlisten?.();
  stalkerUnlisten = null;

  if (stalkerPoller !== null) {
    clearInterval(stalkerPoller);
    stalkerPoller = null;
  }
}

function appendStalkerEvents(threadId: number, events: StalkerEvent[]): void {
  const matching = events.filter((event) => event.threadId === threadId);
  if (matching.length === 0) {
    return;
  }

  setState("stalkerEvents", (prev) => [...prev, ...matching]);
}

async function fetchStalkerEvents(
  sessionId: string,
  threadId: number,
): Promise<void> {
  const result = await invoke<unknown>("rpc_call", {
    sessionId,
    method: "getStalkerEvents",
    params: { threadId },
  });
  appendStalkerEvents(threadId, normalizeStalkerEventPayload(result));
}

function startStalkerSamplingPoller(
  sessionId: string,
  threadId: number,
): void {
  let inFlight = false;

  stalkerPoller = setInterval(() => {
    if (!state.stalkerActive || inFlight) {
      return;
    }

    inFlight = true;
    void fetchStalkerEvents(sessionId, threadId)
      .catch((error) => {
        console.error("fetchStalkerEvents error:", error);
      })
      .finally(() => {
        inFlight = false;
      });
  }, 500);
}

async function startStalker(
  sessionId: string,
  threadId: number,
): Promise<void> {
  setState({ stalkerActive: false, stalkerEvents: [] });
  clearStalkerTracking();

  stalkerUnlisten = listen<unknown>("carf://stalker/event", (payload) => {
    if (extractEventSessionId(payload) !== sessionId) return;
    appendStalkerEvents(threadId, normalizeStalkerEventPayload(payload));
  });

  try {
    const result = await invoke<StartStalkerResult>("rpc_call", {
      sessionId,
      method: "startStalker",
      params: {
        threadId,
        events: {
          call: true,
          ret: false,
          exec: false,
          block: false,
          compile: false,
        },
      },
    });
    setState("stalkerActive", true);

    if ((result.mode ?? "stalker") === "sampling") {
      await fetchStalkerEvents(sessionId, threadId);
      startStalkerSamplingPoller(sessionId, threadId);
    }
  } catch (err) {
    setState("stalkerActive", false);
    clearStalkerTracking();
    console.error("startStalker error:", err);
  }
}

async function stopStalker(
  sessionId: string,
  threadId: number,
): Promise<void> {
  try {
    await invoke<void>("rpc_call", {
      sessionId,
      method: "stopStalker",
      params: { threadId },
    });
  } catch (err) {
    console.error("stopStalker error:", err);
  } finally {
    setState("stalkerActive", false);
    clearStalkerTracking();
  }
}

export {
  state as threadState,
  setThreads,
  selectThread,
  setBacktrace,
  setLoading as setThreadLoading,
  setBacktraceLoading,
  resetThreadState,
  snapshotThreadState,
  restoreThreadState,
  selectedThread,
  threadsByState,
  refreshInterval,
  setRefreshInterval,
  subTab as threadSubTab,
  setSubTab as setThreadSubTab,
  fetchThreads,
  fetchBacktrace,
  fetchContext,
  startStalker,
  stopStalker,
};
