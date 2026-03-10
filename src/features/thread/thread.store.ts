import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import type { ThreadInfo, BacktraceFrame } from "~/lib/types";
import { invoke } from "~/lib/tauri";

type RefreshInterval = 2000 | 5000 | 0;

interface ThreadState {
  threads: ThreadInfo[];
  loading: boolean;
  selectedThreadId: number | null;
  backtrace: BacktraceFrame[];
  backtraceLoading: boolean;
}

const [state, setState] = createStore<ThreadState>({
  threads: [],
  loading: false,
  selectedThreadId: null,
  backtrace: [],
  backtraceLoading: false,
});

const [refreshInterval, setRefreshInterval] = createSignal<RefreshInterval>(0);

function setThreads(threads: ThreadInfo[]): void {
  setState({ threads, loading: false });
}

function selectThread(threadId: number | null): void {
  setState({ selectedThreadId: threadId, backtrace: [] });
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
  setBacktraceLoading(true);
  try {
    const result = await invoke<BacktraceFrame[]>("rpc_call", {
      sessionId,
      method: "getBacktrace",
      params: { threadId },
    });
    setBacktrace(result);
  } catch (err) {
    setBacktraceLoading(false);
    throw err;
  }
}

export {
  state as threadState,
  setThreads,
  selectThread,
  setBacktrace,
  setLoading as setThreadLoading,
  setBacktraceLoading,
  selectedThread,
  threadsByState,
  refreshInterval,
  setRefreshInterval,
  fetchThreads,
  fetchBacktrace,
};
