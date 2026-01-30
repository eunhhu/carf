import { create } from 'zustand';

// Value types matching agent freeze/watch
export type MemoryValueType =
  | 's8'
  | 'u8'
  | 's16'
  | 'u16'
  | 's32'
  | 'u32'
  | 's64'
  | 'u64'
  | 'float'
  | 'double';

export const VALUE_TYPE_LABELS: Record<MemoryValueType, string> = {
  s8: '1-byte (signed)',
  u8: '1-byte',
  s16: '2-byte (signed)',
  u16: '2-byte',
  s32: '4-byte (signed)',
  u32: '4-byte',
  s64: '8-byte (signed)',
  u64: '8-byte',
  float: 'Float',
  double: 'Double',
};

export const VALUE_TYPE_SIZES: Record<MemoryValueType, number> = {
  s8: 1,
  u8: 1,
  s16: 2,
  u16: 2,
  s32: 4,
  u32: 4,
  s64: 8,
  u64: 8,
  float: 4,
  double: 8,
};

// CE-style multi-view entry
export interface MemoryTableEntry {
  id: string;
  address: string;
  description: string;

  // Primary type for freeze/write
  primaryType: MemoryValueType;

  // Current values (updated periodically or manually)
  values: Partial<Record<MemoryValueType, string>>;

  // Freeze state
  frozen: boolean;
  freezeId?: string;
  freezeValue?: string; // Value to freeze at

  // Watch state (periodic read)
  watched: boolean;
  watchId?: string;

  // ASLR support
  module?: string;
  offset?: string;

  // Metadata
  createdAt: number;
  updatedAt: number;
}

// Visible columns in table
export type VisibleColumns = Partial<Record<MemoryValueType, boolean>>;

interface MemoryTableState {
  // Entries
  entries: Record<string, MemoryTableEntry>;
  entryOrder: string[]; // Maintain insertion order

  // UI state
  selectedIds: string[];
  visibleColumns: VisibleColumns;
  showOnlyFrozen: boolean;
  showOnlyWatched: boolean;
  searchQuery: string;

  // Pending updates (for batch value updates from agent)
  pendingUpdates: Map<string, Partial<Record<MemoryValueType, string>>>;

  // Loading state
  loading: boolean;
  error: string | null;
}

interface MemoryTableActions {
  // Entry CRUD
  addEntry: (
    address: string,
    primaryType: MemoryValueType,
    description?: string,
    module?: string,
    offset?: string
  ) => string;
  removeEntry: (id: string) => void;
  removeEntries: (ids: string[]) => void;
  clearEntries: () => void;

  // Entry updates
  updateDescription: (id: string, description: string) => void;
  updatePrimaryType: (id: string, primaryType: MemoryValueType) => void;
  updateValues: (id: string, values: Partial<Record<MemoryValueType, string>>) => void;
  batchUpdateValues: (updates: Array<{ id: string; values: Partial<Record<MemoryValueType, string>> }>) => void;

  // Freeze controls
  setFrozen: (id: string, frozen: boolean, freezeId?: string, freezeValue?: string) => void;
  updateFreezeValue: (id: string, value: string) => void;
  freezeAll: () => string[]; // Returns ids that need freeze
  unfreezeAll: () => string[]; // Returns ids that need unfreeze

  // Watch controls
  setWatched: (id: string, watched: boolean, watchId?: string) => void;

  // Selection
  select: (id: string, multi?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // Column visibility
  setColumnVisible: (type: MemoryValueType, visible: boolean) => void;
  resetColumnVisibility: () => void;

  // Filters
  setShowOnlyFrozen: (show: boolean) => void;
  setShowOnlyWatched: (show: boolean) => void;
  setSearchQuery: (query: string) => void;

  // Reorder
  moveEntry: (fromIndex: number, toIndex: number) => void;

  // Error handling
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

const generateId = () => `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_VISIBLE_COLUMNS: VisibleColumns = {
  u8: true,
  u16: true,
  u32: true,
  float: true,
};

const initialState: MemoryTableState = {
  entries: {},
  entryOrder: [],
  selectedIds: [],
  visibleColumns: { ...DEFAULT_VISIBLE_COLUMNS },
  showOnlyFrozen: false,
  showOnlyWatched: false,
  searchQuery: '',
  pendingUpdates: new Map(),
  loading: false,
  error: null,
};

export const useMemoryStore = create<MemoryTableState & MemoryTableActions>((set, get) => ({
  ...initialState,

  // Entry CRUD
  addEntry: (address, primaryType, description = '', module, offset) => {
    const id = generateId();
    const now = Date.now();
    const entry: MemoryTableEntry = {
      id,
      address,
      description,
      primaryType,
      values: {},
      frozen: false,
      watched: false,
      module,
      offset,
      createdAt: now,
      updatedAt: now,
    };

    set((s) => ({
      entries: { ...s.entries, [id]: entry },
      entryOrder: [...s.entryOrder, id],
    }));

    return id;
  },

  removeEntry: (id) => {
    set((s) => {
      const { [id]: _, ...entries } = s.entries;
      return {
        entries,
        entryOrder: s.entryOrder.filter((i) => i !== id),
        selectedIds: s.selectedIds.filter((i) => i !== id),
      };
    });
  },

  removeEntries: (ids) => {
    set((s) => {
      const entries = { ...s.entries };
      ids.forEach((id) => delete entries[id]);
      return {
        entries,
        entryOrder: s.entryOrder.filter((i) => !ids.includes(i)),
        selectedIds: s.selectedIds.filter((i) => !ids.includes(i)),
      };
    });
  },

  clearEntries: () => {
    set({
      entries: {},
      entryOrder: [],
      selectedIds: [],
    });
  },

  // Entry updates
  updateDescription: (id, description) => {
    set((s) => {
      const entry = s.entries[id];
      if (!entry) return s;
      return {
        entries: {
          ...s.entries,
          [id]: { ...entry, description, updatedAt: Date.now() },
        },
      };
    });
  },

  updatePrimaryType: (id, primaryType) => {
    set((s) => {
      const entry = s.entries[id];
      if (!entry) return s;
      return {
        entries: {
          ...s.entries,
          [id]: { ...entry, primaryType, updatedAt: Date.now() },
        },
      };
    });
  },

  updateValues: (id, values) => {
    set((s) => {
      const entry = s.entries[id];
      if (!entry) return s;
      return {
        entries: {
          ...s.entries,
          [id]: {
            ...entry,
            values: { ...entry.values, ...values },
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  batchUpdateValues: (updates) => {
    set((s) => {
      const entries = { ...s.entries };
      const now = Date.now();
      updates.forEach(({ id, values }) => {
        if (entries[id]) {
          entries[id] = {
            ...entries[id],
            values: { ...entries[id].values, ...values },
            updatedAt: now,
          };
        }
      });
      return { entries };
    });
  },

  // Freeze controls
  setFrozen: (id, frozen, freezeId, freezeValue) => {
    set((s) => {
      const entry = s.entries[id];
      if (!entry) return s;
      return {
        entries: {
          ...s.entries,
          [id]: {
            ...entry,
            frozen,
            freezeId: frozen ? freezeId : undefined,
            freezeValue: frozen ? freezeValue : undefined,
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  updateFreezeValue: (id, value) => {
    set((s) => {
      const entry = s.entries[id];
      if (!entry) return s;
      return {
        entries: {
          ...s.entries,
          [id]: { ...entry, freezeValue: value, updatedAt: Date.now() },
        },
      };
    });
  },

  freezeAll: () => {
    const { entries, entryOrder } = get();
    const idsToFreeze: string[] = [];
    entryOrder.forEach((id) => {
      if (entries[id] && !entries[id].frozen) {
        idsToFreeze.push(id);
      }
    });
    return idsToFreeze;
  },

  unfreezeAll: () => {
    const { entries, entryOrder } = get();
    const idsToUnfreeze: string[] = [];
    entryOrder.forEach((id) => {
      if (entries[id] && entries[id].frozen) {
        idsToUnfreeze.push(id);
      }
    });
    return idsToUnfreeze;
  },

  // Watch controls
  setWatched: (id, watched, watchId) => {
    set((s) => {
      const entry = s.entries[id];
      if (!entry) return s;
      return {
        entries: {
          ...s.entries,
          [id]: {
            ...entry,
            watched,
            watchId: watched ? watchId : undefined,
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  // Selection
  select: (id, multi = false) => {
    set((s) => ({
      selectedIds: multi
        ? s.selectedIds.includes(id)
          ? s.selectedIds.filter((i) => i !== id)
          : [...s.selectedIds, id]
        : [id],
    }));
  },

  selectAll: () => {
    set((s) => ({ selectedIds: [...s.entryOrder] }));
  },

  clearSelection: () => {
    set({ selectedIds: [] });
  },

  // Column visibility
  setColumnVisible: (type, visible) => {
    set((s) => ({
      visibleColumns: { ...s.visibleColumns, [type]: visible },
    }));
  },

  resetColumnVisibility: () => {
    set({ visibleColumns: { ...DEFAULT_VISIBLE_COLUMNS } });
  },

  // Filters
  setShowOnlyFrozen: (showOnlyFrozen) => set({ showOnlyFrozen }),
  setShowOnlyWatched: (showOnlyWatched) => set({ showOnlyWatched }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  // Reorder
  moveEntry: (fromIndex, toIndex) => {
    set((s) => {
      const newOrder = [...s.entryOrder];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);
      return { entryOrder: newOrder };
    });
  },

  // Error handling
  setError: (error) => set({ error }),
  setLoading: (loading) => set({ loading }),
}));

// Selectors
export const selectFilteredEntries = (state: MemoryTableState): MemoryTableEntry[] => {
  let entries = state.entryOrder.map((id) => state.entries[id]).filter(Boolean);

  if (state.showOnlyFrozen) {
    entries = entries.filter((e) => e.frozen);
  }

  if (state.showOnlyWatched) {
    entries = entries.filter((e) => e.watched);
  }

  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    entries = entries.filter(
      (e) =>
        e.address.toLowerCase().includes(query) ||
        e.description.toLowerCase().includes(query) ||
        e.module?.toLowerCase().includes(query)
    );
  }

  return entries;
};

export const selectFrozenEntries = (state: MemoryTableState): MemoryTableEntry[] => {
  return state.entryOrder
    .map((id) => state.entries[id])
    .filter((e) => e && e.frozen);
};

export const selectWatchedEntries = (state: MemoryTableState): MemoryTableEntry[] => {
  return state.entryOrder
    .map((id) => state.entries[id])
    .filter((e) => e && e.watched);
};

export const selectVisibleColumnTypes = (state: MemoryTableState): MemoryValueType[] => {
  return (Object.entries(state.visibleColumns) as [MemoryValueType, boolean][])
    .filter(([, visible]) => visible)
    .map(([type]) => type);
};
