import { create } from 'zustand';
import { agentRpc } from '../features/frida/agentRpc';

// Maximum number of log entries to keep (ring buffer)
const MAX_LOG_ENTRIES = 1000;

// Log entry types
export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug' | 'event';

export type LogEntry = {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: 'user' | 'agent' | 'system';
  category?: string; // For filtering (e.g., event name)
  message: string;
  data?: unknown; // Raw JSON data for expandable view
};

type ConsoleState = {
  logs: LogEntry[];
  filter: {
    levels: Set<LogLevel>;
    category: string;
    search: string;
  };
  isPaused: boolean;
  showTimestamps: boolean;
  showJson: boolean;
};

type ConsoleActions = {
  // Logging
  log: (level: LogLevel, message: string, options?: { source?: LogEntry['source']; category?: string; data?: unknown }) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
  success: (message: string, data?: unknown) => void;
  debug: (message: string, data?: unknown) => void;
  event: (eventName: string, data?: unknown) => void;

  // Control
  clear: () => void;
  pause: () => void;
  resume: () => void;
  toggleTimestamps: () => void;
  toggleJson: () => void;

  // Filtering
  setLevelFilter: (levels: Set<LogLevel>) => void;
  setCategoryFilter: (category: string) => void;
  setSearchFilter: (search: string) => void;
  resetFilters: () => void;

  // Event subscription
  startEventListener: () => () => void;

  // Export
  exportLogs: () => string;
};

let idCounter = 0;
const generateId = () => `log-${Date.now()}-${++idCounter}`;

export const useConsoleStore = create<ConsoleState & ConsoleActions>((set, get) => ({
  logs: [],
  filter: {
    levels: new Set(['info', 'warn', 'error', 'success', 'debug', 'event']),
    category: '',
    search: '',
  },
  isPaused: false,
  showTimestamps: true,
  showJson: false,

  log: (level, message, options = {}) => {
    if (get().isPaused) return;

    const entry: LogEntry = {
      id: generateId(),
      timestamp: new Date(),
      level,
      source: options.source ?? 'system',
      category: options.category,
      message,
      data: options.data,
    };

    set((state) => {
      const newLogs = [...state.logs, entry];
      // Ring buffer: keep only last MAX_LOG_ENTRIES
      if (newLogs.length > MAX_LOG_ENTRIES) {
        return { logs: newLogs.slice(-MAX_LOG_ENTRIES) };
      }
      return { logs: newLogs };
    });
  },

  info: (message, data) => get().log('info', message, { data }),
  warn: (message, data) => get().log('warn', message, { data }),
  error: (message, data) => get().log('error', message, { data }),
  success: (message, data) => get().log('success', message, { data }),
  debug: (message, data) => get().log('debug', message, { data }),
  event: (eventName, data) => get().log('event', eventName, { source: 'agent', category: eventName, data }),

  clear: () => set({ logs: [] }),

  pause: () => set({ isPaused: true }),
  resume: () => set({ isPaused: false }),

  toggleTimestamps: () => set((state) => ({ showTimestamps: !state.showTimestamps })),
  toggleJson: () => set((state) => ({ showJson: !state.showJson })),

  setLevelFilter: (levels) => set((state) => ({ filter: { ...state.filter, levels } })),
  setCategoryFilter: (category) => set((state) => ({ filter: { ...state.filter, category } })),
  setSearchFilter: (search) => set((state) => ({ filter: { ...state.filter, search } })),
  resetFilters: () => set({
    filter: {
      levels: new Set(['info', 'warn', 'error', 'success', 'debug', 'event']),
      category: '',
      search: '',
    },
  }),

  // Subscribe to agent events and log them
  startEventListener: () => {
    const unsubscribe = agentRpc.onEvent((payload) => {
      const { event, ...rest } = payload;
      get().event(event, rest);
    });
    return unsubscribe;
  },

  exportLogs: () => {
    const { logs } = get();
    return logs.map((log) => {
      const ts = log.timestamp.toISOString();
      const dataStr = log.data ? ` | ${JSON.stringify(log.data)}` : '';
      return `[${ts}] [${log.level.toUpperCase()}] ${log.category ? `[${log.category}] ` : ''}${log.message}${dataStr}`;
    }).join('\n');
  },
}));

// Selector for filtered logs
export const selectFilteredLogs = (state: ConsoleState): LogEntry[] => {
  const { logs, filter } = state;
  return logs.filter((log) => {
    // Level filter
    if (!filter.levels.has(log.level)) return false;
    // Category filter
    if (filter.category && log.category !== filter.category) return false;
    // Search filter
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const messageMatch = log.message.toLowerCase().includes(searchLower);
      const categoryMatch = log.category?.toLowerCase().includes(searchLower);
      const dataMatch = log.data ? JSON.stringify(log.data).toLowerCase().includes(searchLower) : false;
      if (!messageMatch && !categoryMatch && !dataMatch) return false;
    }
    return true;
  });
};
