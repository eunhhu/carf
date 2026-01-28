import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light' | 'system';
export type FontSize = 11 | 12 | 13 | 14;

interface SettingsState {
  // Appearance
  theme: ThemeMode;
  fontSize: FontSize;

  // RPC
  rpcTimeout: number; // milliseconds

  // Auto-refresh
  autoRefreshInterval: number; // milliseconds, 0 = disabled

  // Console
  maxLogEntries: number;
  showTimestamps: boolean;

  // Memory
  defaultReadSize: number;
  hexColumns: 16 | 32;

  // Advanced
  debugMode: boolean;
}

interface SettingsActions {
  // Generic setter
  setSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;

  // Specific setters for convenience
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (size: FontSize) => void;
  setRpcTimeout: (timeout: number) => void;
  setAutoRefreshInterval: (interval: number) => void;
  setMaxLogEntries: (max: number) => void;
  setShowTimestamps: (show: boolean) => void;
  setDefaultReadSize: (size: number) => void;
  setHexColumns: (columns: 16 | 32) => void;
  setDebugMode: (debug: boolean) => void;

  // Reset
  resetSettings: () => void;
}

const defaultSettings: SettingsState = {
  theme: 'dark',
  fontSize: 12,
  rpcTimeout: 10000,
  autoRefreshInterval: 0,
  maxLogEntries: 1000,
  showTimestamps: true,
  defaultReadSize: 256,
  hexColumns: 16,
  debugMode: false,
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setSetting: (key, value) => set({ [key]: value }),

      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setRpcTimeout: (rpcTimeout) => set({ rpcTimeout: Math.max(1000, Math.min(60000, rpcTimeout)) }),
      setAutoRefreshInterval: (autoRefreshInterval) => set({ autoRefreshInterval: Math.max(0, autoRefreshInterval) }),
      setMaxLogEntries: (maxLogEntries) => set({ maxLogEntries: Math.max(100, Math.min(10000, maxLogEntries)) }),
      setShowTimestamps: (showTimestamps) => set({ showTimestamps }),
      setDefaultReadSize: (defaultReadSize) => set({ defaultReadSize: Math.max(16, Math.min(4096, defaultReadSize)) }),
      setHexColumns: (hexColumns) => set({ hexColumns }),
      setDebugMode: (debugMode) => set({ debugMode }),

      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'carf-settings',
    }
  )
);

// Selector for computed theme (resolves 'system' to actual theme)
export const selectEffectiveTheme = (state: SettingsState): 'dark' | 'light' => {
  if (state.theme === 'system') {
    // Check system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }
  return state.theme;
};
