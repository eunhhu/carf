import { create } from 'zustand';

// Safe invoke wrapper that works in browser without Tauri
const safeInvoke = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> => {
  // Check if we're in Tauri environment
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  }
  // Fallback for browser-only mode - silent in non-Tauri environment
  return null;
};

// Entry types covering all discoverable entities
export type LibraryEntryType =
  | 'function'
  | 'address'
  | 'class'
  | 'symbol'
  | 'module'
  | 'method'
  | 'memory_region'
  | 'watch'
  | 'hook';

export interface LibraryEntry {
  id: string;
  type: LibraryEntryType;
  name: string;
  address?: string;
  module?: string;
  folderId: string | null;
  tags: string[];
  notes?: string;
  starred: boolean;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

export interface LibraryFolder {
  id: string;
  name: string;
  parentId: string | null;
  color?: string;
  createdAt: number;
}

interface LibraryData {
  entries: Record<string, LibraryEntry>;
  folders: Record<string, LibraryFolder>;
}

interface LibraryState {
  // Data
  entries: Record<string, LibraryEntry>;
  folders: Record<string, LibraryFolder>;

  // UI State
  selectedIds: string[];
  expandedFolderIds: string[];
  searchQuery: string;
  filterType: LibraryEntryType | 'all';
  sortBy: 'name' | 'type' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';

  // Loading state
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

interface LibraryActions {
  // Initialization
  loadLibrary: () => Promise<void>;
  saveLibrary: () => Promise<void>;

  // Entry CRUD
  addEntry: (entry: Omit<LibraryEntry, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateEntry: (id: string, updates: Partial<LibraryEntry>) => void;
  removeEntry: (id: string) => void;
  removeEntries: (ids: string[]) => void;

  // Entry actions
  toggleStar: (id: string) => void;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
  setNotes: (id: string, notes: string) => void;
  moveToFolder: (entryIds: string[], folderId: string | null) => void;

  // Folder CRUD
  createFolder: (name: string, parentId?: string | null, color?: string) => string;
  updateFolder: (id: string, updates: Partial<LibraryFolder>) => void;
  removeFolder: (id: string, deleteContents?: boolean) => void;

  // Selection
  select: (id: string, multi?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  toggleFolderExpanded: (id: string) => void;

  // Filters
  setSearchQuery: (query: string) => void;
  setFilterType: (type: LibraryEntryType | 'all') => void;
  setSortBy: (field: LibraryState['sortBy']) => void;
  toggleSortOrder: () => void;

  // Import/Export
  exportEntries: (ids?: string[]) => string;
  importEntries: (json: string) => number;

  // Quick add helpers
  addFromAddress: (address: string, name?: string, type?: LibraryEntryType) => string;
  addFromModule: (
    moduleName: string,
    moduleBase: string,
    moduleSize?: number
  ) => string;
  addFromExport: (
    exportName: string,
    exportAddress: string,
    moduleName: string,
    exportType?: string
  ) => string;
}

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const initialState: LibraryState = {
  entries: {},
  folders: {},
  selectedIds: [],
  expandedFolderIds: [],
  searchQuery: '',
  filterType: 'all',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  loading: false,
  error: null,
  initialized: false,
};

export const useLibraryStore = create<LibraryState & LibraryActions>((set, get) => ({
  ...initialState,

  // Load library from Tauri file system
  loadLibrary: async () => {
    set({ loading: true, error: null });
    try {
      const data = await safeInvoke<string>('load_library');
      if (data) {
        const parsed: LibraryData = JSON.parse(data);
        set({
          entries: parsed.entries || {},
          folders: parsed.folders || {},
          initialized: true,
          loading: false,
        });
      } else {
        set({ initialized: true, loading: false });
      }
    } catch (error) {
      console.error('Failed to load library:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load library',
        initialized: true,
        loading: false,
      });
    }
  },

  // Save library to Tauri file system
  saveLibrary: async () => {
    const { entries, folders } = get();
    const data: LibraryData = { entries, folders };
    try {
      await safeInvoke('save_library', { data: JSON.stringify(data, null, 2) });
    } catch (error) {
      console.error('Failed to save library:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to save library',
      });
    }
  },

  // Entry CRUD
  addEntry: (entry) => {
    const id = generateId();
    const now = Date.now();
    const newEntry: LibraryEntry = {
      ...entry,
      id,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({
      entries: { ...s.entries, [id]: newEntry },
    }));
    // Auto-save
    get().saveLibrary();
    return id;
  },

  updateEntry: (id, updates) => {
    set((s) => {
      const entry = s.entries[id];
      if (!entry) return s;
      return {
        entries: {
          ...s.entries,
          [id]: { ...entry, ...updates, updatedAt: Date.now() },
        },
      };
    });
    get().saveLibrary();
  },

  removeEntry: (id) => {
    set((s) => {
      const { [id]: _, ...rest } = s.entries;
      return {
        entries: rest,
        selectedIds: s.selectedIds.filter((i) => i !== id),
      };
    });
    get().saveLibrary();
  },

  removeEntries: (ids) => {
    set((s) => {
      const entries = { ...s.entries };
      ids.forEach((id) => delete entries[id]);
      return {
        entries,
        selectedIds: s.selectedIds.filter((i) => !ids.includes(i)),
      };
    });
    get().saveLibrary();
  },

  // Entry actions
  toggleStar: (id) => {
    set((s) => {
      const entry = s.entries[id];
      if (!entry) return s;
      return {
        entries: {
          ...s.entries,
          [id]: { ...entry, starred: !entry.starred, updatedAt: Date.now() },
        },
      };
    });
    get().saveLibrary();
  },

  addTag: (id, tag) => {
    set((s) => {
      const entry = s.entries[id];
      if (!entry || entry.tags.includes(tag)) return s;
      return {
        entries: {
          ...s.entries,
          [id]: {
            ...entry,
            tags: [...entry.tags, tag],
            updatedAt: Date.now(),
          },
        },
      };
    });
    get().saveLibrary();
  },

  removeTag: (id, tag) => {
    set((s) => {
      const entry = s.entries[id];
      if (!entry) return s;
      return {
        entries: {
          ...s.entries,
          [id]: {
            ...entry,
            tags: entry.tags.filter((t) => t !== tag),
            updatedAt: Date.now(),
          },
        },
      };
    });
    get().saveLibrary();
  },

  setNotes: (id, notes) => {
    get().updateEntry(id, { notes });
  },

  moveToFolder: (entryIds, folderId) => {
    set((s) => {
      const entries = { ...s.entries };
      const now = Date.now();
      entryIds.forEach((id) => {
        if (entries[id]) {
          entries[id] = { ...entries[id], folderId, updatedAt: now };
        }
      });
      return { entries };
    });
    get().saveLibrary();
  },

  // Folder CRUD
  createFolder: (name, parentId = null, color) => {
    const id = generateId();
    const folder: LibraryFolder = {
      id,
      name,
      parentId,
      color,
      createdAt: Date.now(),
    };
    set((s) => ({
      folders: { ...s.folders, [id]: folder },
    }));
    get().saveLibrary();
    return id;
  },

  updateFolder: (id, updates) => {
    set((s) => {
      const folder = s.folders[id];
      if (!folder) return s;
      return {
        folders: { ...s.folders, [id]: { ...folder, ...updates } },
      };
    });
    get().saveLibrary();
  },

  removeFolder: (id, deleteContents = false) => {
    set((s) => {
      const { [id]: _, ...folders } = s.folders;
      let entries = s.entries;

      if (deleteContents) {
        // Delete all entries in folder
        entries = Object.fromEntries(
          Object.entries(entries).filter(([, e]) => e.folderId !== id)
        );
      } else {
        // Move entries to root
        entries = Object.fromEntries(
          Object.entries(entries).map(([key, e]) => [
            key,
            e.folderId === id ? { ...e, folderId: null } : e,
          ])
        );
      }

      return { folders, entries };
    });
    get().saveLibrary();
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
    set((s) => ({
      selectedIds: Object.keys(s.entries),
    }));
  },

  clearSelection: () => {
    set({ selectedIds: [] });
  },

  toggleFolderExpanded: (id) => {
    set((s) => ({
      expandedFolderIds: s.expandedFolderIds.includes(id)
        ? s.expandedFolderIds.filter((i) => i !== id)
        : [...s.expandedFolderIds, id],
    }));
  },

  // Filters
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilterType: (filterType) => set({ filterType }),
  setSortBy: (sortBy) => set({ sortBy }),
  toggleSortOrder: () =>
    set((s) => ({ sortOrder: s.sortOrder === 'asc' ? 'desc' : 'asc' })),

  // Import/Export
  exportEntries: (ids) => {
    const { entries, folders } = get();
    const toExport = ids
      ? Object.fromEntries(
          Object.entries(entries).filter(([id]) => ids.includes(id))
        )
      : entries;
    return JSON.stringify({ entries: toExport, folders }, null, 2);
  },

  importEntries: (json) => {
    try {
      const data: LibraryData = JSON.parse(json);
      const now = Date.now();
      let count = 0;

      set((s) => {
        const newEntries = { ...s.entries };
        const newFolders = { ...s.folders };

        // Import folders
        if (data.folders) {
          Object.values(data.folders).forEach((folder) => {
            const newId = generateId();
            newFolders[newId] = { ...folder, id: newId, createdAt: now };
          });
        }

        // Import entries
        if (data.entries) {
          Object.values(data.entries).forEach((entry) => {
            const newId = generateId();
            newEntries[newId] = {
              ...entry,
              id: newId,
              createdAt: now,
              updatedAt: now,
            };
            count++;
          });
        }

        return { entries: newEntries, folders: newFolders };
      });

      get().saveLibrary();
      return count;
    } catch (error) {
      console.error('Failed to import entries:', error);
      return 0;
    }
  },

  // Quick add helpers
  addFromAddress: (address, name, type = 'address') => {
    return get().addEntry({
      type,
      name: name || address,
      address,
      folderId: null,
      tags: [],
      starred: false,
      metadata: {},
    });
  },

  addFromModule: (moduleName, moduleBase, moduleSize) => {
    return get().addEntry({
      type: 'module',
      name: moduleName,
      address: moduleBase,
      folderId: null,
      tags: [],
      starred: false,
      metadata: { size: moduleSize },
    });
  },

  addFromExport: (exportName, exportAddress, moduleName, exportType) => {
    return get().addEntry({
      type: 'function',
      name: exportName,
      address: exportAddress,
      module: moduleName,
      folderId: null,
      tags: exportType ? [exportType] : [],
      starred: false,
      metadata: { exportType },
    });
  },
}));

// Selectors
export const selectFilteredEntries = (state: LibraryState): LibraryEntry[] => {
  let entries = Object.values(state.entries);

  // Filter by type
  if (state.filterType !== 'all') {
    entries = entries.filter((e) => e.type === state.filterType);
  }

  // Filter by search query
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    entries = entries.filter(
      (e) =>
        e.name.toLowerCase().includes(query) ||
        e.address?.toLowerCase().includes(query) ||
        e.module?.toLowerCase().includes(query) ||
        e.tags.some((t) => t.toLowerCase().includes(query)) ||
        e.notes?.toLowerCase().includes(query)
    );
  }

  // Sort
  entries.sort((a, b) => {
    let cmp = 0;
    switch (state.sortBy) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'type':
        cmp = a.type.localeCompare(b.type);
        break;
      case 'createdAt':
        cmp = a.createdAt - b.createdAt;
        break;
      case 'updatedAt':
        cmp = a.updatedAt - b.updatedAt;
        break;
    }
    return state.sortOrder === 'asc' ? cmp : -cmp;
  });

  return entries;
};

export const selectStarredEntries = (state: LibraryState): LibraryEntry[] => {
  return Object.values(state.entries).filter((e) => e.starred);
};

export const selectEntriesByFolder = (
  state: LibraryState,
  folderId: string | null
): LibraryEntry[] => {
  return Object.values(state.entries).filter((e) => e.folderId === folderId);
};
