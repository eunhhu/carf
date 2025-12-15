import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TabId } from "../components/layout/Sidebar";

// Module info cached from enumerate_modules
type ModuleInfo = {
  name: string;
  base: string;
  size: number;
};

// Export info cached from enumerate_exports
type ExportInfo = {
  name: string;
  address: string;
  type?: string;
};

// Thread info cached from enumerate_threads
type ThreadInfo = {
  id: number;
  state: string;
  context?: {
    pc: string;
    sp: string;
  };
};

// Backtrace frame
type BacktraceFrame = {
  address: string;
  symbol?: string;
  moduleName?: string;
};

// Native panel state
type NativePanelState = {
  modules: ModuleInfo[];
  selectedModule: string | null;
  exports: ExportInfo[];
  searchQuery: string;
};

// Memory panel state
type MemoryPanelState = {
  readAddress: string;
  readSize: string;
  hexDump: string | null;
  writeAddress: string;
  writeValue: string;
  searchPattern: string;
  searchResults: string[];
};

// Thread panel state
type ThreadPanelState = {
  threads: ThreadInfo[];
  selectedThread: number | null;
  backtrace: BacktraceFrame[];
};

// Console panel state
type ConsolePanelState = {
  logs: Array<{
    id: string;
    timestamp: number;
    type: "info" | "warn" | "error" | "event";
    message: string;
    data?: unknown;
  }>;
  maxLogs: number;
};

// UI Store state
type UIState = {
  // Active tab
  activeTab: TabId;

  // Panel states (persisted per-session)
  nativePanel: NativePanelState;
  memoryPanel: MemoryPanelState;
  threadPanel: ThreadPanelState;
  consolePanel: ConsolePanelState;
};

// UI Store actions
type UIActions = {
  setActiveTab: (tab: TabId) => void;

  // Native panel
  setNativeModules: (modules: ModuleInfo[]) => void;
  setNativeSelectedModule: (name: string | null) => void;
  setNativeExports: (exports: ExportInfo[]) => void;
  setNativeSearchQuery: (query: string) => void;

  // Memory panel
  setMemoryReadAddress: (address: string) => void;
  setMemoryReadSize: (size: string) => void;
  setMemoryHexDump: (hex: string | null) => void;
  setMemoryWriteAddress: (address: string) => void;
  setMemoryWriteValue: (value: string) => void;
  setMemorySearchPattern: (pattern: string) => void;
  setMemorySearchResults: (results: string[]) => void;

  // Thread panel
  setThreads: (threads: ThreadInfo[]) => void;
  setSelectedThread: (id: number | null) => void;
  setBacktrace: (frames: BacktraceFrame[]) => void;

  // Console panel
  addConsoleLog: (type: "info" | "warn" | "error" | "event", message: string, data?: unknown) => void;
  clearConsoleLogs: () => void;

  // Reset all panel states (on detach)
  resetPanelStates: () => void;
};

const initialNativePanel: NativePanelState = {
  modules: [],
  selectedModule: null,
  exports: [],
  searchQuery: "",
};

const initialMemoryPanel: MemoryPanelState = {
  readAddress: "",
  readSize: "64",
  hexDump: null,
  writeAddress: "",
  writeValue: "",
  searchPattern: "",
  searchResults: [],
};

const initialThreadPanel: ThreadPanelState = {
  threads: [],
  selectedThread: null,
  backtrace: [],
};

const initialConsolePanel: ConsolePanelState = {
  logs: [],
  maxLogs: 500,
};

export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set) => ({
      // Initial state
      activeTab: "attach",
      nativePanel: initialNativePanel,
      memoryPanel: initialMemoryPanel,
      threadPanel: initialThreadPanel,
      consolePanel: initialConsolePanel,

      // Tab
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Native panel actions
      setNativeModules: (modules) =>
        set((state) => ({
          nativePanel: { ...state.nativePanel, modules },
        })),
      setNativeSelectedModule: (name) =>
        set((state) => ({
          nativePanel: { ...state.nativePanel, selectedModule: name },
        })),
      setNativeExports: (exports) =>
        set((state) => ({
          nativePanel: { ...state.nativePanel, exports },
        })),
      setNativeSearchQuery: (query) =>
        set((state) => ({
          nativePanel: { ...state.nativePanel, searchQuery: query },
        })),

      // Memory panel actions
      setMemoryReadAddress: (address) =>
        set((state) => ({
          memoryPanel: { ...state.memoryPanel, readAddress: address },
        })),
      setMemoryReadSize: (size) =>
        set((state) => ({
          memoryPanel: { ...state.memoryPanel, readSize: size },
        })),
      setMemoryHexDump: (hex) =>
        set((state) => ({
          memoryPanel: { ...state.memoryPanel, hexDump: hex },
        })),
      setMemoryWriteAddress: (address) =>
        set((state) => ({
          memoryPanel: { ...state.memoryPanel, writeAddress: address },
        })),
      setMemoryWriteValue: (value) =>
        set((state) => ({
          memoryPanel: { ...state.memoryPanel, writeValue: value },
        })),
      setMemorySearchPattern: (pattern) =>
        set((state) => ({
          memoryPanel: { ...state.memoryPanel, searchPattern: pattern },
        })),
      setMemorySearchResults: (results) =>
        set((state) => ({
          memoryPanel: { ...state.memoryPanel, searchResults: results },
        })),

      // Thread panel actions
      setThreads: (threads) =>
        set((state) => ({
          threadPanel: { ...state.threadPanel, threads },
        })),
      setSelectedThread: (id) =>
        set((state) => ({
          threadPanel: { ...state.threadPanel, selectedThread: id },
        })),
      setBacktrace: (frames) =>
        set((state) => ({
          threadPanel: { ...state.threadPanel, backtrace: frames },
        })),

      // Console panel actions
      addConsoleLog: (type, message, data) =>
        set((state) => {
          const newLog = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            timestamp: Date.now(),
            type,
            message,
            data,
          };
          const logs = [newLog, ...state.consolePanel.logs].slice(0, state.consolePanel.maxLogs);
          return { consolePanel: { ...state.consolePanel, logs } };
        }),
      clearConsoleLogs: () =>
        set((state) => ({
          consolePanel: { ...state.consolePanel, logs: [] },
        })),

      // Reset all panel states
      resetPanelStates: () =>
        set({
          nativePanel: initialNativePanel,
          memoryPanel: initialMemoryPanel,
          threadPanel: initialThreadPanel,
          // Keep console logs on reset
        }),
    }),
    {
      name: "carf-ui-store",
      // Only persist activeTab, not panel data (to avoid stale data)
      partialize: (state) => ({
        activeTab: state.activeTab,
      }),
    }
  )
);
