import { create } from 'zustand';
import type { TabId } from '../components/layout/Sidebar';

// ============================================================================
// Types - Action System for cross-feature communication
// ============================================================================

/**
 * Represents an addressable item that can be acted upon
 */
export interface AddressableItem {
  address: string;
  name?: string;
  type: 'function' | 'symbol' | 'address' | 'module' | 'class' | 'method';
  module?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Pending action to be executed when switching tabs
 */
export interface PendingAction {
  type: 'read_memory' | 'hook_function' | 'view_module' | 'view_class';
  target: AddressableItem;
  timestamp: number;
}

// ============================================================================
// Store
// ============================================================================

interface ActionState {
  // Currently selected item (can be acted upon via context menu or quick actions)
  selectedItem: AddressableItem | null;

  // Pending action to execute after tab switch
  pendingAction: PendingAction | null;

  // History of recently accessed items for quick access
  recentItems: AddressableItem[];

  // Maximum number of recent items to keep
  maxRecentItems: number;
}

interface ActionActions {
  // Set the currently selected item
  setSelectedItem: (item: AddressableItem | null) => void;

  // Queue an action to be executed (will trigger tab switch)
  queueAction: (action: PendingAction) => void;

  // Consume the pending action (called by target tab)
  consumePendingAction: () => PendingAction | null;

  // Add item to recent history
  addToRecent: (item: AddressableItem) => void;

  // Clear recent items
  clearRecent: () => void;

  // Helper: Navigate to memory and read address
  navigateToMemory: (address: string, name?: string) => void;

  // Helper: Navigate to native and view module
  navigateToModule: (moduleName: string, address?: string) => void;

  // Helper: Hook a function
  hookFunction: (item: AddressableItem) => void;
}

// We need to import the UI store to change tabs
// But to avoid circular dependencies, we'll use a callback pattern
let tabSwitchCallback: ((tab: TabId) => void) | null = null;

export function setTabSwitchCallback(callback: (tab: TabId) => void) {
  tabSwitchCallback = callback;
}

export const useActionStore = create<ActionState & ActionActions>()((set, get) => ({
  // Initial state
  selectedItem: null,
  pendingAction: null,
  recentItems: [],
  maxRecentItems: 20,

  // Actions
  setSelectedItem: (item) => {
    set({ selectedItem: item });
    if (item) {
      get().addToRecent(item);
    }
  },

  queueAction: (action) => {
    set({ pendingAction: action });

    // Determine which tab to switch to based on action type
    let targetTab: TabId = 'attach';
    switch (action.type) {
      case 'read_memory':
        targetTab = 'memory';
        break;
      case 'hook_function':
        targetTab = 'methods';
        break;
      case 'view_module':
        targetTab = 'native';
        break;
      case 'view_class':
        // Could be objc or java depending on context
        targetTab = 'objc';
        break;
    }

    // Switch tab
    if (tabSwitchCallback) {
      tabSwitchCallback(targetTab);
    }
  },

  consumePendingAction: () => {
    const action = get().pendingAction;
    set({ pendingAction: null });
    return action;
  },

  addToRecent: (item) => {
    set((state) => {
      // Remove duplicate if exists
      const filtered = state.recentItems.filter(
        (i) => !(i.address === item.address && i.type === item.type)
      );
      // Add to front
      const newRecent = [item, ...filtered].slice(0, state.maxRecentItems);
      return { recentItems: newRecent };
    });
  },

  clearRecent: () => {
    set({ recentItems: [] });
  },

  // Helper functions for common actions
  navigateToMemory: (address, name) => {
    const item: AddressableItem = {
      address,
      name: name ?? address,
      type: 'address',
    };
    get().queueAction({
      type: 'read_memory',
      target: item,
      timestamp: Date.now(),
    });
  },

  navigateToModule: (moduleName, address) => {
    const item: AddressableItem = {
      address: address ?? '0x0',
      name: moduleName,
      type: 'module',
    };
    get().queueAction({
      type: 'view_module',
      target: item,
      timestamp: Date.now(),
    });
  },

  hookFunction: (item) => {
    get().queueAction({
      type: 'hook_function',
      target: item,
      timestamp: Date.now(),
    });
  },
}));

// ============================================================================
// Context Menu Item Builders
// ============================================================================

import {
  Copy,
  Eye,
  Crosshair,
  Bookmark,
  Package,
} from 'lucide-react';
import type { ContextMenuItemOrSeparator } from '../components/ui/ContextMenu';
import { useLibraryStore } from './libraryStore';

/**
 * Build context menu items for an addressable item
 */
export function buildContextMenuItems(
  item: AddressableItem,
  options: {
    hasSession?: boolean;
    onCopy?: () => void;
    onViewMemory?: () => void;
    onHook?: () => void;
    onAddToLibrary?: () => void;
    onViewModule?: () => void;
  } = {}
): ContextMenuItemOrSeparator[] {
  const items: ContextMenuItemOrSeparator[] = [];
  const { hasSession = true } = options;

  // Copy address
  items.push({
    id: 'copy-address',
    label: 'Copy Address',
    icon: Copy,
    shortcut: '⌘C',
    onSelect: () => {
      navigator.clipboard.writeText(item.address);
      options.onCopy?.();
    },
  });

  // Copy name if available
  if (item.name && item.name !== item.address) {
    items.push({
      id: 'copy-name',
      label: 'Copy Name',
      icon: Copy,
      onSelect: () => {
        navigator.clipboard.writeText(item.name!);
      },
    });
  }

  items.push({ type: 'separator' });

  // View in Memory
  items.push({
    id: 'view-memory',
    label: 'View in Memory',
    icon: Eye,
    disabled: !hasSession,
    onSelect: () => {
      useActionStore.getState().navigateToMemory(item.address, item.name);
      options.onViewMemory?.();
    },
  });

  // Hook function (only for function types)
  if (item.type === 'function' || item.type === 'method') {
    items.push({
      id: 'hook-function',
      label: 'Hook Function',
      icon: Crosshair,
      disabled: !hasSession,
      onSelect: () => {
        useActionStore.getState().hookFunction(item);
        options.onHook?.();
      },
    });
  }

  // View module (if has module info)
  if (item.module) {
    items.push({
      id: 'view-module',
      label: `View Module (${item.module})`,
      icon: Package,
      disabled: !hasSession,
      onSelect: () => {
        useActionStore.getState().navigateToModule(item.module!, item.address);
        options.onViewModule?.();
      },
    });
  }

  items.push({ type: 'separator' });

  // Add to Library
  items.push({
    id: 'add-to-library',
    label: 'Add to Library',
    icon: Bookmark,
    onSelect: () => {
      const store = useLibraryStore.getState();
      store.addEntry({
        type: item.type,
        name: item.name ?? item.address,
        address: item.address,
        module: item.module,
        folderId: null,
        tags: [],
        starred: false,
        metadata: item.metadata ?? {},
      });
      options.onAddToLibrary?.();
    },
  });

  return items;
}

/**
 * Build simple address context menu
 */
export function buildAddressContextMenu(
  address: string,
  hasSession: boolean
): ContextMenuItemOrSeparator[] {
  return buildContextMenuItems(
    { address, type: 'address' },
    { hasSession }
  );
}

/**
 * Build function context menu
 */
export function buildFunctionContextMenu(
  name: string,
  address: string,
  module: string | undefined,
  hasSession: boolean
): ContextMenuItemOrSeparator[] {
  return buildContextMenuItems(
    { address, name, type: 'function', module },
    { hasSession }
  );
}
