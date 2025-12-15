import { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import { Terminal, Trash2, Download } from 'lucide-react';
import { theme } from '../../styles';
import { PanelContainer } from '../common/Panel';
import { IconButton } from '../common/Button';
import { Input } from '../common/Input';

const ConsoleHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.bg.tertiary};
  border-bottom: 1px solid ${theme.colors.border.primary};
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
  gap: ${theme.spacing.xs};
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

const LogEntry = styled(motion.div)<{ $type: 'info' | 'error' | 'warn' | 'success' | 'input' }>`
  display: flex;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.xs} 0;
  color: ${({ $type }) => {
    switch ($type) {
      case 'error': return theme.colors.status.error;
      case 'warn': return theme.colors.status.warning;
      case 'success': return theme.colors.status.success;
      case 'input': return theme.colors.text.accent;
      default: return theme.colors.text.primary;
    }
  }};
`;

const LogTimestamp = styled.span`
  color: ${theme.colors.text.muted};
  min-width: 80px;
`;

const LogPrefix = styled.span`
  color: ${theme.colors.text.muted};
`;

const LogMessage = styled.span`
  word-break: break-all;
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

type LogEntryData = {
  id: string;
  timestamp: Date;
  type: 'info' | 'error' | 'warn' | 'success' | 'input';
  message: string;
};

type ConsolePanelProps = {
  logs?: LogEntryData[];
  onCommand?: (command: string) => void;
};

export function ConsolePanel({ logs: externalLogs, onCommand }: ConsolePanelProps) {
  const [logs, setLogs] = useState<LogEntryData[]>(externalLogs || []);
  const [inputValue, setInputValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (externalLogs) {
      setLogs(externalLogs);
    }
  }, [externalLogs]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (type: LogEntryData['type'], message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        timestamp: new Date(),
        type,
        message,
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    addLog('input', inputValue);
    setHistory((prev) => [...prev, inputValue]);
    setHistoryIndex(-1);

    if (onCommand) {
      onCommand(inputValue);
    }

    setInputValue('');
  };

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

  const clearLogs = () => {
    setLogs([]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour12: false });
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
        </ConsoleTitle>
        <ConsoleActions>
          <IconButton $size="sm" onClick={clearLogs} title="Clear console">
            <Trash2 size={14} />
          </IconButton>
          <IconButton $size="sm" title="Export logs">
            <Download size={14} />
          </IconButton>
        </ConsoleActions>
      </ConsoleHeader>

      <ConsoleOutput ref={outputRef}>
        {logs.map((log) => (
          <LogEntry
            key={log.id}
            $type={log.type}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <LogTimestamp>{formatTime(log.timestamp)}</LogTimestamp>
            <LogPrefix>
              {log.type === 'input' ? '>' : log.type === 'error' ? '✗' : log.type === 'success' ? '✓' : '•'}
            </LogPrefix>
            <LogMessage>{log.message}</LogMessage>
          </LogEntry>
        ))}
        {logs.length === 0 && (
          <LogEntry $type="info">
            <LogMessage style={{ color: theme.colors.text.muted }}>
              Console ready. Type commands or view script messages here.
            </LogMessage>
          </LogEntry>
        )}
      </ConsoleOutput>

      <form onSubmit={handleSubmit}>
        <ConsoleInput>
          <InputPrefix>&gt;</InputPrefix>
          <CommandInput
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            autoFocus
          />
        </ConsoleInput>
      </form>
    </PanelContainer>
  );
}
