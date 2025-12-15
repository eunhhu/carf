import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Trash2,
  Download,
  Pause,
  Play,
  Clock,
  Code,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  Search,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Bug,
  Zap,
} from 'lucide-react';
import { theme } from '../../styles';
import { PanelContainer } from '../common/Panel';
import { IconButton } from '../common/Button';
import { Input } from '../common/Input';
import {
  useConsoleStore,
  selectFilteredLogs,
  type LogLevel,
  type LogEntry,
} from '../../stores/consoleStore';
import { useFridaStore } from '../../features/frida';

const ConsoleHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  background: ${theme.colors.bg.tertiary};
  border-bottom: 1px solid ${theme.colors.border.primary};
  min-height: 40px;
`;

const ConsoleTitle = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  font-size: ${theme.fontSize.sm};
  font-weight: 600;
  color: ${theme.colors.text.primary};
`;

const ConsoleActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
`;

const Divider = styled.div`
  width: 1px;
  height: 16px;
  background: ${theme.colors.border.primary};
  margin: 0 ${theme.spacing.xs};
`;

const FilterBar = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  background: ${theme.colors.bg.secondary};
  border-bottom: 1px solid ${theme.colors.border.primary};
`;

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
`;

const FilterChip = styled.button<{ $active: boolean; $color?: string }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid ${({ $active, $color }) => $active ? ($color || theme.colors.accent.primary) : theme.colors.border.primary};
  background: ${({ $active, $color }) => $active ? `${$color || theme.colors.accent.primary}20` : 'transparent'};
  color: ${({ $active, $color }) => $active ? ($color || theme.colors.accent.primary) : theme.colors.text.muted};
  font-size: ${theme.fontSize.xs};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: ${({ $color }) => $color || theme.colors.accent.primary};
    background: ${({ $color }) => `${$color || theme.colors.accent.primary}10`};
  }
`;

const SearchInput = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  padding: 4px 8px;
  background: ${theme.colors.bg.primary};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.sm};
  flex: 1;
  max-width: 200px;

  input {
    border: none;
    background: transparent;
    color: ${theme.colors.text.primary};
    font-size: ${theme.fontSize.xs};
    outline: none;
    width: 100%;

    &::placeholder {
      color: ${theme.colors.text.muted};
    }
  }
`;

const StatusBadge = styled.span<{ $paused?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  background: ${({ $paused }) => $paused ? `${theme.colors.status.warning}20` : `${theme.colors.status.success}20`};
  color: ${({ $paused }) => $paused ? theme.colors.status.warning : theme.colors.status.success};
`;

const LogCount = styled.span`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
  margin-left: ${theme.spacing.xs};
`;

const ConsoleOutput = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${theme.spacing.sm};
  font-family: 'Consolas', monospace;
  font-size: ${theme.fontSize.xs};
  line-height: 1.6;
  background: ${theme.colors.bg.primary};
`;

const LogEntryRow = styled(motion.div)<{ $level: LogLevel }>`
  display: flex;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.sm};
  color: ${({ $level }) => {
    switch ($level) {
      case 'error': return theme.colors.status.error;
      case 'warn': return theme.colors.status.warning;
      case 'success': return theme.colors.status.success;
      case 'event': return theme.colors.accent.primary;
      case 'debug': return theme.colors.text.muted;
      default: return theme.colors.text.primary;
    }
  }};

  &:hover {
    background: ${theme.colors.bg.secondary};
  }
`;

const LogIcon = styled.span<{ $level: LogLevel }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
`;

const LogTimestamp = styled.span`
  color: ${theme.colors.text.muted};
  min-width: 70px;
  font-size: 11px;
  flex-shrink: 0;
`;

const LogCategory = styled.span`
  color: ${theme.colors.accent.secondary};
  font-weight: 500;
  flex-shrink: 0;
`;

const LogPrefix = styled.span`
  color: ${theme.colors.text.muted};
`;

const LogMessage = styled.span`
  word-break: break-word;
  flex: 1;
`;

const LogData = styled.div`
  margin-top: ${theme.spacing.xs};
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  background: ${theme.colors.bg.tertiary};
  border-radius: ${theme.borderRadius.sm};
  font-size: 11px;
  overflow-x: auto;

  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }
`;

const ExpandButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: ${theme.colors.text.muted};
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 2px;

  &:hover {
    color: ${theme.colors.text.primary};
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${theme.colors.text.muted};
  gap: ${theme.spacing.sm};
`;

const ConsoleInput = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.bg.tertiary};
  border-top: 1px solid ${theme.colors.border.primary};
`;

const InputPrefix = styled.span`
  color: ${theme.colors.text.accent};
  font-family: 'Consolas', monospace;
`;

const CommandInput = styled(Input)`
  flex: 1;
  background: transparent;
  border: none;
  padding: 0;
  
  &:focus {
    outline: none;
    border-color: transparent;
  }
`;

// Level config for UI
const LEVEL_CONFIG: Record<LogLevel, { icon: typeof Info; color: string; label: string }> = {
  info: { icon: Info, color: theme.colors.text.primary, label: 'Info' },
  warn: { icon: AlertTriangle, color: theme.colors.status.warning, label: 'Warn' },
  error: { icon: AlertCircle, color: theme.colors.status.error, label: 'Error' },
  success: { icon: CheckCircle, color: theme.colors.status.success, label: 'Success' },
  debug: { icon: Bug, color: theme.colors.text.muted, label: 'Debug' },
  event: { icon: Zap, color: theme.colors.accent.primary, label: 'Event' },
};

type ConsolePanelProps = {
  onCommand?: (command: string) => void;
};

// Single log entry component with expand/collapse
function LogEntryItem({ log, showTimestamp, showJson }: { log: LogEntry; showTimestamp: boolean; showJson: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = log.data !== undefined;
  const config = LEVEL_CONFIG[log.level];
  const Icon = config.icon;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <LogEntryRow
      $level={log.level}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      {hasData ? (
        <ExpandButton onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </ExpandButton>
      ) : (
        <LogIcon $level={log.level}>
          <Icon size={12} />
        </LogIcon>
      )}
      {showTimestamp && <LogTimestamp>{formatTime(log.timestamp)}</LogTimestamp>}
      {log.category && <LogCategory>[{log.category}]</LogCategory>}
      <LogMessage>
        {log.message}
        {expanded && hasData && showJson && (
          <LogData>
            <pre>{JSON.stringify(log.data, null, 2)}</pre>
          </LogData>
        )}
      </LogMessage>
    </LogEntryRow>
  );
}

export function ConsolePanel({ onCommand }: ConsolePanelProps) {
  // Store state
  const {
    logs,
    filter,
    isPaused,
    showTimestamps,
    showJson,
    log,
    clear,
    pause,
    resume,
    toggleTimestamps,
    toggleJson,
    setLevelFilter,
    setSearchFilter,
    resetFilters,
    startEventListener,
    exportLogs,
  } = useConsoleStore();

  const { agentRequest, loadedScriptId } = useFridaStore();

  // Local UI state
  const [inputValue, setInputValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showFilters, setShowFilters] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  // Filtered logs
  const filteredLogs = useMemo(() => selectFilteredLogs({ logs, filter, isPaused, showTimestamps, showJson }), [logs, filter, isPaused, showTimestamps, showJson]);

  // Start event listener on mount
  useEffect(() => {
    const unsubscribe = startEventListener();
    return unsubscribe;
  }, [startEventListener]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current && !isPaused) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [filteredLogs, isPaused]);

  // Toggle level filter
  const toggleLevel = useCallback((level: LogLevel) => {
    const newLevels = new Set(filter.levels);
    if (newLevels.has(level)) {
      newLevels.delete(level);
    } else {
      newLevels.add(level);
    }
    setLevelFilter(newLevels);
  }, [filter.levels, setLevelFilter]);

  // Handle command submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const cmd = inputValue.trim();
    log('info', `> ${cmd}`, { source: 'user' });
    setHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setInputValue('');

    // Built-in commands
    if (cmd === 'clear') {
      clear();
      return;
    }
    if (cmd === 'help') {
      log('info', 'Available commands: clear, help, ping, arch, process');
      return;
    }

    // RPC commands (if script loaded)
    if (loadedScriptId) {
      try {
        let result: unknown;
        if (cmd === 'ping') {
          result = await agentRequest('ping');
        } else if (cmd === 'arch') {
          result = await agentRequest('get_arch');
        } else if (cmd === 'process') {
          result = await agentRequest('get_process_info');
        } else {
          // Try as generic RPC call
          const parts = cmd.split(' ');
          const method = parts[0];
          let params: unknown = undefined;
          if (parts.length > 1) {
            try {
              params = JSON.parse(parts.slice(1).join(' '));
            } catch {
              params = { args: parts.slice(1) };
            }
          }
          result = await agentRequest(method, params);
        }
        log('success', JSON.stringify(result, null, 2), { data: result });
      } catch (err) {
        log('error', err instanceof Error ? err.message : String(err));
      }
    } else {
      if (onCommand) {
        onCommand(cmd);
      } else {
        log('warn', 'No script loaded. Attach to a process first.');
      }
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInputValue(history[history.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputValue(history[history.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputValue('');
      }
    }
  };

  // Export logs to file
  const handleExport = () => {
    const content = exportLogs();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carf-console-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PanelContainer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <ConsoleHeader>
        <ConsoleTitle>
          <Terminal size={14} />
          Console
          <LogCount>{filteredLogs.length} / {logs.length}</LogCount>
        </ConsoleTitle>
        <ConsoleActions>
          {isPaused && <StatusBadge $paused>Paused</StatusBadge>}
          
          <IconButton
            $size="sm"
            onClick={() => setShowFilters(!showFilters)}
            title="Toggle filters"
            style={{ color: showFilters ? theme.colors.accent.primary : undefined }}
          >
            <Filter size={14} />
          </IconButton>
          
          <Divider />
          
          <IconButton
            $size="sm"
            onClick={toggleTimestamps}
            title="Toggle timestamps"
            style={{ color: showTimestamps ? theme.colors.accent.primary : undefined }}
          >
            <Clock size={14} />
          </IconButton>
          <IconButton
            $size="sm"
            onClick={toggleJson}
            title="Toggle JSON view"
            style={{ color: showJson ? theme.colors.accent.primary : undefined }}
          >
            <Code size={14} />
          </IconButton>
          
          <Divider />
          
          <IconButton
            $size="sm"
            onClick={isPaused ? resume : pause}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
          </IconButton>
          <IconButton $size="sm" onClick={clear} title="Clear console">
            <Trash2 size={14} />
          </IconButton>
          <IconButton $size="sm" onClick={handleExport} title="Export logs">
            <Download size={14} />
          </IconButton>
        </ConsoleActions>
      </ConsoleHeader>

      <AnimatePresence>
        {showFilters && (
          <FilterBar
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <FilterGroup>
              {(Object.keys(LEVEL_CONFIG) as LogLevel[]).map((level) => {
                const config = LEVEL_CONFIG[level];
                return (
                  <FilterChip
                    key={level}
                    $active={filter.levels.has(level)}
                    $color={config.color}
                    onClick={() => toggleLevel(level)}
                  >
                    <config.icon size={10} />
                    {config.label}
                  </FilterChip>
                );
              })}
            </FilterGroup>
            
            <SearchInput>
              <Search size={12} />
              <input
                type="text"
                placeholder="Search..."
                value={filter.search}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
              {filter.search && (
                <IconButton $size="sm" onClick={() => setSearchFilter('')}>
                  <X size={10} />
                </IconButton>
              )}
            </SearchInput>
            
            <IconButton $size="sm" onClick={resetFilters} title="Reset filters">
              <X size={12} />
            </IconButton>
          </FilterBar>
        )}
      </AnimatePresence>

      <ConsoleOutput ref={outputRef}>
        {filteredLogs.length > 0 ? (
          filteredLogs.map((logEntry) => (
            <LogEntryItem
              key={logEntry.id}
              log={logEntry}
              showTimestamp={showTimestamps}
              showJson={showJson}
            />
          ))
        ) : (
          <EmptyState>
            <Terminal size={32} strokeWidth={1} />
            {logs.length === 0 ? (
              <span>Console ready. Type commands or view script messages here.</span>
            ) : (
              <span>No logs match the current filter.</span>
            )}
          </EmptyState>
        )}
      </ConsoleOutput>

      <form onSubmit={handleSubmit}>
        <ConsoleInput>
          <InputPrefix>&gt;</InputPrefix>
          <CommandInput
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command... (help for available commands)"
          />
        </ConsoleInput>
      </form>
    </PanelContainer>
  );
}
