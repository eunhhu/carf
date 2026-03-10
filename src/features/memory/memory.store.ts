import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import type { MemoryRange, ScanResult } from "~/lib/types";
import { invoke } from "~/lib/tauri";

export type MemorySubMode = "map" | "hex" | "search" | "monitor";

interface MemoryState {
  ranges: MemoryRange[];
  rangesLoading: boolean;
  hexAddress: string | null;
  hexData: Uint8Array | null;
  hexLoading: boolean;
  searchPattern: string;
  searchResults: ScanResult[];
  searchProgress: number;
  searching: boolean;
  monitorActive: boolean;
}

const [state, setState] = createStore<MemoryState>({
  ranges: [],
  rangesLoading: false,
  hexAddress: null,
  hexData: null,
  hexLoading: false,
  searchPattern: "",
  searchResults: [],
  searchProgress: 0,
  searching: false,
  monitorActive: false,
});

const [subMode, setSubMode] = createSignal<MemorySubMode>("map");

function setRanges(ranges: MemoryRange[]): void {
  setState({ ranges, rangesLoading: false });
}

function setHexView(address: string, data: Uint8Array): void {
  setState({ hexAddress: address, hexData: data, hexLoading: false });
  setSubMode("hex");
}

function setSearchResults(results: ScanResult[]): void {
  setState({ searchResults: results, searching: false });
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

function setRangesLoading(loading: boolean): void {
  setState("rangesLoading", loading);
}

function setHexLoading(loading: boolean): void {
  setState("hexLoading", loading);
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
  setSearching(true);
  try {
    const result = await invoke<ScanResult[]>("rpc_call", {
      sessionId,
      method: "scanMemory",
      params: { pattern, protection: "r--" },
    });
    setSearchResults(result);
  } catch (e) {
    setState({ searching: false });
    console.error("searchMemory error:", e);
  }
}

export {
  state as memoryState,
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
  fetchRanges,
  readMemoryAt,
  writeMemoryAt,
  searchMemory,
};
