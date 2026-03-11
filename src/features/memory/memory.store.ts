import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import { extractEventSessionId } from "~/lib/event-normalizers";
import type { MemoryRange, MemoryMonitorEvent, ScanResult } from "~/lib/types";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke, listen } from "~/lib/tauri";

export type MemorySubMode = "map" | "hex" | "search" | "monitor";

interface MemoryState {
  rangesLoading: boolean;
  hexAddress: string | null;
  hexLoading: boolean;
  searchPattern: string;
  searchProgress: number;
  searching: boolean;
  monitorActive: boolean;
}

interface MemorySnapshotState extends MemoryState {
  ranges: MemoryRange[];
  hexData: Uint8Array | null;
  searchResults: ScanResult[];
  monitorEvents: MemoryMonitorEvent[];
  monitorHeatmap: number[];
}

type MemoryViewState = MemoryState & {
  ranges: MemoryRange[];
  hexData: Uint8Array | null;
  searchResults: ScanResult[];
  monitorEvents: MemoryMonitorEvent[];
  monitorHeatmap: number[];
};

const DEFAULT_STATE: MemoryState = {
  rangesLoading: false,
  hexAddress: null,
  hexLoading: false,
  searchPattern: "",
  searchProgress: 0,
  searching: false,
  monitorActive: false,
};

const DEFAULT_MONITOR_HEATMAP = Array.from({ length: 256 }, () => 0);

const [ranges, setRangesSignal] = createSignal<MemoryRange[]>([]);
const [hexData, setHexData] = createSignal<Uint8Array | null>(null);
const [searchResults, setSearchResultsSignal] = createSignal<ScanResult[]>([]);
const [monitorEvents, setMonitorEvents] = createSignal<MemoryMonitorEvent[]>([]);
const [monitorHeatmap, setMonitorHeatmap] = createSignal<number[]>(
  DEFAULT_MONITOR_HEATMAP,
);

const [state, setState] = createStore<MemoryState>({
  ...DEFAULT_STATE,
});

const [subMode, setSubMode] = createSignal<MemorySubMode>("map");

function setRanges(ranges: MemoryRange[]): void {
  setRangesSignal(ranges);
  setState({ rangesLoading: false });
}

function setHexView(address: string, data: Uint8Array): void {
  setHexData(data);
  setState({ hexAddress: address, hexLoading: false });
  setSubMode("hex");
}

function setSearchResults(results: ScanResult[]): void {
  setSearchResultsSignal(results);
  setState({ searching: false });
}

function setSearchProgress(progress: number): void {
  setState("searchProgress", progress);
}

function setSearching(searching: boolean): void {
  setState("searching", searching);
}

function setMonitorActive(active: boolean): void {
  setState("monitorActive", active);
}

let monitorUnlisten: (() => void) | null = null;

async function startMemoryMonitor(
  sessionId: string,
  base: string,
  size: number,
): Promise<void> {
  setState({
    monitorActive: true,
  });
  setMonitorEvents([]);
  setMonitorHeatmap(DEFAULT_MONITOR_HEATMAP.slice());

  monitorUnlisten = listen<MemoryMonitorEvent>(
    "carf://memory/access",
    (payload) => {
      if (extractEventSessionId(payload) !== sessionId) return;
      setMonitorEvents((prev) => [...prev, payload]);
      const idx = payload.pageIndex % 256;
      setMonitorHeatmap((prev) => {
        const next = prev.slice();
        next[idx] = (next[idx] ?? 0) + 1;
        return next;
      });
    },
  );

  try {
    await invoke<void>("rpc_call", {
      sessionId,
      method: "startMemoryMonitor",
      params: { ranges: [{ base, size }] },
    });
  } catch (e) {
    setState("monitorActive", false);
    monitorUnlisten?.();
    monitorUnlisten = null;
    console.error("startMemoryMonitor error:", e);
  }
}

async function stopMemoryMonitor(sessionId: string): Promise<void> {
  try {
    await invoke<void>("rpc_call", {
      sessionId,
      method: "stopMemoryMonitor",
      params: {},
    });
  } catch (e) {
    console.error("stopMemoryMonitor error:", e);
  } finally {
    setState("monitorActive", false);
    monitorUnlisten?.();
    monitorUnlisten = null;
  }
}

function setRangesLoading(loading: boolean): void {
  setState("rangesLoading", loading);
}

function setHexLoading(loading: boolean): void {
  setState("hexLoading", loading);
}

function resetMemoryState(): void {
  setState(restoreStore(DEFAULT_STATE));
  setRangesSignal([]);
  setHexData(null);
  setSearchResultsSignal([]);
  setMonitorEvents([]);
  setMonitorHeatmap(DEFAULT_MONITOR_HEATMAP.slice());
  setSubMode("map");
}

function snapshotMemoryState(): {
  state: MemorySnapshotState;
  subMode: MemorySubMode;
} {
  return {
    state: {
      ...snapshotStore(state),
      ranges: ranges(),
      hexData: hexData(),
      searchResults: searchResults(),
      monitorEvents: monitorEvents(),
      monitorHeatmap: monitorHeatmap(),
    },
    subMode: subMode(),
  };
}

function restoreMemoryState(snapshot?: {
  state: MemorySnapshotState;
  subMode: MemorySubMode;
}): void {
  if (!snapshot) {
    resetMemoryState();
    return;
  }

  setState(restoreStore({
    rangesLoading: snapshot.state.rangesLoading,
    hexAddress: snapshot.state.hexAddress,
    hexLoading: snapshot.state.hexLoading,
    searchPattern: snapshot.state.searchPattern,
    searchProgress: snapshot.state.searchProgress,
    searching: snapshot.state.searching,
    monitorActive: snapshot.state.monitorActive,
  }));
  setRangesSignal(snapshot.state.ranges);
  setHexData(snapshot.state.hexData);
  setSearchResultsSignal(snapshot.state.searchResults);
  setMonitorEvents(snapshot.state.monitorEvents);
  setMonitorHeatmap(snapshot.state.monitorHeatmap);
  setSubMode(snapshot.subMode);
}

async function fetchRanges(sessionId: string): Promise<void> {
  setRangesLoading(true);
  try {
    const result = await invoke<MemoryRange[]>("rpc_call", {
      sessionId,
      method: "enumerateRanges",
      params: { protection: "---" },
    });
    setRanges(result);
  } catch (e) {
    setState({ rangesLoading: false });
    console.error("fetchRanges error:", e);
  }
}

async function readMemoryAt(
  sessionId: string,
  address: string,
  size?: number,
): Promise<void> {
  setHexLoading(true);
  try {
    const hexString = await invoke<string>("rpc_call", {
      sessionId,
      method: "readMemory",
      params: { address, size: size ?? 256 },
    });
    const data = new Uint8Array(
      hexString.match(/.{2}/g)?.map((b) => parseInt(b, 16)) ?? [],
    );
    setHexView(address, data);
  } catch (e) {
    setState({ hexLoading: false });
    console.error("readMemoryAt error:", e);
  }
}

async function writeMemoryAt(
  sessionId: string,
  address: string,
  data: string,
): Promise<void> {
  try {
    await invoke<void>("rpc_call", {
      sessionId,
      method: "writeMemory",
      params: { address, data },
    });
  } catch (e) {
    console.error("writeMemoryAt error:", e);
  }
}

async function searchMemory(
  sessionId: string,
  pattern: string,
): Promise<void> {
  setSearchResultsSignal([]);
  setState({
    searchPattern: pattern,
    searchProgress: 0,
    searching: true,
  });
  const unlistenProgress = listen<{ progress?: number }>(
    "carf://scan/progress",
    (payload) => {
      if (extractEventSessionId(payload) !== sessionId) {
        return;
      }
      if (typeof payload.progress === "number") {
        setSearchProgress(payload.progress);
      }
    },
  );
  const unlistenResult = listen<{ results?: ScanResult[] }>(
    "carf://scan/result",
    (payload) => {
      if (extractEventSessionId(payload) !== sessionId) {
        return;
      }
      if (Array.isArray(payload.results)) {
        setSearchResults(payload.results);
      }
    },
  );

  try {
    const result = await invoke<ScanResult[]>("rpc_call", {
      sessionId,
      method: "scanMemory",
      params: { pattern, ranges: "r--" },
    });
    setSearchResults(result);
  } catch (e) {
    setState({ searching: false });
    console.error("searchMemory error:", e);
  } finally {
    unlistenProgress();
    unlistenResult();
  }
}

const memoryState: MemoryViewState = {
  get ranges() {
    return ranges();
  },
  get rangesLoading() {
    return state.rangesLoading;
  },
  get hexAddress() {
    return state.hexAddress;
  },
  get hexData() {
    return hexData();
  },
  get hexLoading() {
    return state.hexLoading;
  },
  get searchPattern() {
    return state.searchPattern;
  },
  get searchResults() {
    return searchResults();
  },
  get searchProgress() {
    return state.searchProgress;
  },
  get searching() {
    return state.searching;
  },
  get monitorActive() {
    return state.monitorActive;
  },
  get monitorEvents() {
    return monitorEvents();
  },
  get monitorHeatmap() {
    return monitorHeatmap();
  },
};

export {
  ranges,
  hexData,
  searchResults,
  monitorEvents,
  monitorHeatmap,
  memoryState,
  subMode as memorySubMode,
  setSubMode as setMemorySubMode,
  setRanges,
  setHexView,
  setSearchResults,
  setSearchProgress,
  setSearching,
  setMonitorActive,
  setRangesLoading,
  setHexLoading,
  resetMemoryState,
  snapshotMemoryState,
  restoreMemoryState,
  fetchRanges,
  readMemoryAt,
  writeMemoryAt,
  searchMemory,
  startMemoryMonitor,
  stopMemoryMonitor,
};
