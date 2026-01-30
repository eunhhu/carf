import { create } from 'zustand';

// Hook entry representing an Interceptor hook
export interface HookEntry {
  id: string;
  target: string;              // Original target (symbol name or address)
  targetResolved: string;      // Resolved address
  moduleName?: string;         // Module containing the target
  symbolName?: string;         // Symbol name if available
  enabled: boolean;
  onEnter: boolean;
  onLeave: boolean;
  callCount: number;
  lastCallTime?: number;
  createdAt: number;
}

// Call log entry for hook events
export interface HookCallLog {
  id: string;
  hookId: string;
  type: 'enter' | 'leave';
  timestamp: number;
  threadId: number;
  args?: string[];
  retval?: string;
}

interface HookState {
  // Hooks
  hooks: Record<string, HookEntry>;
  hookOrder: string[];

  // Call logs (ring buffer, max 500 entries)
  callLogs: HookCallLog[];
  maxLogs: number;
  showCallLogs: boolean;

  // UI state
  selectedHookId: string | null;
  filterByHook: string | null; // null = show all

  // Loading state
  loading: boolean;
  error: string | null;
}

interface HookActions {
  // Hook CRUD
  addHook: (hook: Omit<HookEntry, 'id' | 'callCount' | 'createdAt'>) => string;
  removeHook: (id: string) => void;
  updateHook: (id: string, updates: Partial<HookEntry>) => void;
  clearHooks: () => void;

  // Hook state changes
  setEnabled: (id: string, enabled: boolean) => void;
  incrementCallCount: (id: string) => void;

  // Call logs
  addCallLog: (log: Omit<HookCallLog, 'id'>) => void;
  clearCallLogs: () => void;
  setShowCallLogs: (show: boolean) => void;

  // Selection
  selectHook: (id: string | null) => void;
  setFilterByHook: (hookId: string | null) => void;

  // Error handling
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

const generateId = () => `hook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const generateLogId = () => `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const initialState: HookState = {
  hooks: {},
  hookOrder: [],
  callLogs: [],
  maxLogs: 500,
  showCallLogs: false,
  selectedHookId: null,
  filterByHook: null,
  loading: false,
  error: null,
};

export const useHookStore = create<HookState & HookActions>((set, get) => ({
  ...initialState,

  // Hook CRUD
  addHook: (hook) => {
    const id = generateId();
    const newHook: HookEntry = {
      ...hook,
      id,
      callCount: 0,
      createdAt: Date.now(),
    };

    set((s) => ({
      hooks: { ...s.hooks, [id]: newHook },
      hookOrder: [...s.hookOrder, id],
    }));

    return id;
  },

  removeHook: (id) => {
    set((s) => {
      const { [id]: _, ...hooks } = s.hooks;
      return {
        hooks,
        hookOrder: s.hookOrder.filter((i) => i !== id),
        selectedHookId: s.selectedHookId === id ? null : s.selectedHookId,
        filterByHook: s.filterByHook === id ? null : s.filterByHook,
      };
    });
  },

  updateHook: (id, updates) => {
    set((s) => {
      const hook = s.hooks[id];
      if (!hook) return s;
      return {
        hooks: {
          ...s.hooks,
          [id]: { ...hook, ...updates },
        },
      };
    });
  },

  clearHooks: () => {
    set({
      hooks: {},
      hookOrder: [],
      selectedHookId: null,
      filterByHook: null,
    });
  },

  // Hook state changes
  setEnabled: (id, enabled) => {
    set((s) => {
      const hook = s.hooks[id];
      if (!hook) return s;
      return {
        hooks: {
          ...s.hooks,
          [id]: { ...hook, enabled },
        },
      };
    });
  },

  incrementCallCount: (id) => {
    set((s) => {
      const hook = s.hooks[id];
      if (!hook) return s;
      return {
        hooks: {
          ...s.hooks,
          [id]: {
            ...hook,
            callCount: hook.callCount + 1,
            lastCallTime: Date.now(),
          },
        },
      };
    });
  },

  // Call logs
  addCallLog: (log) => {
    const id = generateLogId();
    const newLog: HookCallLog = { ...log, id };

    set((s) => {
      let logs = [newLog, ...s.callLogs];
      // Trim to max size
      if (logs.length > s.maxLogs) {
        logs = logs.slice(0, s.maxLogs);
      }
      return { callLogs: logs };
    });

    // Increment call count for the hook
    get().incrementCallCount(log.hookId);
  },

  clearCallLogs: () => {
    set({ callLogs: [] });
  },

  setShowCallLogs: (showCallLogs) => {
    set({ showCallLogs });
  },

  // Selection
  selectHook: (selectedHookId) => {
    set({ selectedHookId });
  },

  setFilterByHook: (filterByHook) => {
    set({ filterByHook });
  },

  // Error handling
  setError: (error) => set({ error }),
  setLoading: (loading) => set({ loading }),
}));

// Selectors
export const selectAllHooks = (state: HookState): HookEntry[] => {
  return state.hookOrder.map((id) => state.hooks[id]).filter(Boolean);
};

export const selectEnabledHooks = (state: HookState): HookEntry[] => {
  return state.hookOrder
    .map((id) => state.hooks[id])
    .filter((h) => h && h.enabled);
};

export const selectFilteredCallLogs = (state: HookState): HookCallLog[] => {
  if (!state.filterByHook) {
    return state.callLogs;
  }
  return state.callLogs.filter((log) => log.hookId === state.filterByHook);
};

export const selectHookById = (state: HookState, id: string): HookEntry | undefined => {
  return state.hooks[id];
};
