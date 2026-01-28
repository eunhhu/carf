import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Terminal,
  Trash2,
  Download,
  Pause,
  Play,
  ChevronRight,
} from "lucide-react";
import {
  PageContainer,
  PageHeader,
  PageTitle,
  PageActions,
  Flex,
  Text,
  Badge,
} from "../../components/ui/Layout";
import {
  Toolbar,
  ToolbarSearch,
  ToolbarCount,
  ToolbarSpacer,
} from "../../components/ui/Toolbar";
import { IconButton } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Tabs } from "../../components/ui/Tabs";
import styled from "@emotion/styled";
import { theme } from "../../styles";
import {
  useConsoleStore,
  type LogLevel as ConsoleLogLevel,
} from "../../stores/consoleStore";

// ============================================================================
// Types (for backwards compatibility)
// ============================================================================

export type LogLevel = "log" | "info" | "warn" | "error" | "debug";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: unknown;
}

export interface ConsolePageProps {
  logs?: LogEntry[];
  onClear?: () => void;
  onExport?: () => void;
  onCommand?: (command: string) => void;
}

// ============================================================================
// Styles (minimal, for console-specific needs)
// ============================================================================

const LogContainer = styled.div`
  flex: 1;
  overflow: auto;
  font-family: "SF Mono", "Consolas", monospace;
  font-size: ${theme.fontSize.xs};
  background: ${theme.colors.bg.primary};
`;

const LogLine = styled.div<{ $level: string }>`
  display: flex;
  align-items: flex-start;
  padding: 4px 12px;
  border-bottom: 1px solid ${theme.colors.border.primary};
  color: ${({ $level }) => {
    switch ($level) {
      case "error":
        return theme.colors.status.error;
      case "warn":
        return theme.colors.status.warning;
      case "info":
        return theme.colors.accent.primary;
      case "debug":
        return theme.colors.text.muted;
      case "success":
        return theme.colors.status.success;
      case "event":
        return theme.colors.accent.secondary;
      default:
        return theme.colors.text.primary;
    }
  }};

  &:hover {
    background: ${theme.colors.bg.hover};
  }
`;

const LogTimestamp = styled.span`
  color: ${theme.colors.text.muted};
  margin-right: 12px;
  flex-shrink: 0;
`;

const LogLevelBadge = styled.span<{ $level: string }>`
  width: 50px;
  flex-shrink: 0;
  text-transform: uppercase;
  font-weight: 500;
`;

const LogMessage = styled.span`
  flex: 1;
  white-space: pre-wrap;
  word-break: break-all;
`;

const LogData = styled.pre`
  margin: 4px 0 0 62px;
  padding: 8px;
  background: ${theme.colors.bg.tertiary};
  border-radius: ${theme.borderRadius.sm};
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.secondary};
  overflow-x: auto;
`;

const CommandInput = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: ${theme.colors.bg.tertiary};
  border-top: 1px solid ${theme.colors.border.primary};
`;

const CommandPrompt = styled.span`
  color: ${theme.colors.accent.primary};
  font-family: "SF Mono", "Consolas", monospace;
`;

// ============================================================================
// Component
// ============================================================================

export function ConsolePage({
  logs: externalLogs,
  onClear: externalOnClear,
  onExport: externalOnExport,
  onCommand,
}: ConsolePageProps) {
  // Use consoleStore - get raw logs array (stable reference)
  const rawLogs = useConsoleStore((state) => state.logs);
  const isPaused = useConsoleStore((state) => state.isPaused);
  const showJson = useConsoleStore((state) => state.showJson);
  const filter = useConsoleStore((state) => state.filter);
  const storeClear = useConsoleStore((state) => state.clear);
  const pause = useConsoleStore((state) => state.pause);
  const resume = useConsoleStore((state) => state.resume);
  const exportLogs = useConsoleStore((state) => state.exportLogs);
  const setSearchFilter = useConsoleStore((state) => state.setSearchFilter);
  const startEventListener = useConsoleStore((state) => state.startEventListener);

  const [command, setCommand] = useState("");
  const [levelFilter, setLevelFilterLocal] = useState<ConsoleLogLevel | "all">("all");
  const logContainerRef = useRef<HTMLDivElement>(null);
  const eventListenerStarted = useRef(false);

  // Start event listener on mount (only once)
  useEffect(() => {
    if (eventListenerStarted.current) return;
    eventListenerStarted.current = true;
    const unsubscribe = startEventListener();
    return () => {
      unsubscribe();
      eventListenerStarted.current = false;
    };
  }, [startEventListener]);

  // Use external logs if provided, otherwise use store logs
  const logs = useMemo(() => {
    if (externalLogs && externalLogs.length > 0) {
      return externalLogs;
    }
    // Convert store logs to component format
    return rawLogs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp.getTime(),
      level: log.level === "success" || log.level === "event" ? "info" : log.level as LogLevel,
      message: log.message,
      data: log.data,
      _originalLevel: log.level, // Keep original level for display
    }));
  }, [externalLogs, rawLogs]);

  // Filter logs by level (local filter for tab UI)
  const filteredLogs = useMemo(() => {
    let result = logs;

    // Apply level filter from tabs
    if (levelFilter !== "all") {
      result = result.filter((log) => {
        const originalLevel = (log as { _originalLevel?: string })._originalLevel || log.level;
        return originalLevel === levelFilter;
      });
    }

    // Apply search filter
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      result = result.filter((log) =>
        log.message.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [logs, levelFilter, filter.search]);

  // Auto-scroll to bottom when new logs arrive (unless paused)
  useEffect(() => {
    if (!isPaused && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, isPaused]);

  const handleCommand = useCallback(() => {
    if (command.trim() && onCommand) {
      onCommand(command.trim());
      setCommand("");
    }
  }, [command, onCommand]);

  const handleClear = useCallback(() => {
    if (externalOnClear) {
      externalOnClear();
    } else {
      storeClear();
    }
  }, [externalOnClear, storeClear]);

  const handleExport = useCallback(() => {
    if (externalOnExport) {
      externalOnExport();
    } else {
      const data = exportLogs();
      const blob = new Blob([data], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `carf-console-${Date.now()}.log`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [externalOnExport, exportLogs]);

  const handleTogglePause = useCallback(() => {
    if (isPaused) {
      resume();
    } else {
      pause();
    }
  }, [isPaused, pause, resume]);

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("en-US", { hour12: false }) + "." + date.getMilliseconds().toString().padStart(3, "0");
  };

  const levelTabs = [
    { id: "all", label: "All" },
    { id: "info", label: "Info" },
    { id: "warn", label: "Warn" },
    { id: "error", label: "Error" },
    { id: "debug", label: "Debug" },
    { id: "success", label: "Success" },
    { id: "event", label: "Events" },
  ];

  return (
    <PageContainer>
      <PageHeader>
        <Flex $align="center" $gap="12px">
          <Terminal size={18} />
          <PageTitle>Console</PageTitle>
          <Badge>{logs.length}</Badge>
        </Flex>
        <PageActions>
          <IconButton
            icon={isPaused ? Play : Pause}
            size="sm"
            onClick={handleTogglePause}
            tooltip={isPaused ? "Resume" : "Pause"}
          />
          <IconButton
            icon={Download}
            size="sm"
            onClick={handleExport}
            tooltip="Export logs"
          />
          <IconButton
            icon={Trash2}
            size="sm"
            onClick={handleClear}
            tooltip="Clear logs"
          />
        </PageActions>
      </PageHeader>

      <Toolbar>
        <Tabs
          items={levelTabs}
          value={levelFilter}
          onChange={(v) => setLevelFilterLocal(v as ConsoleLogLevel | "all")}
          size="sm"
          variant="pills"
        />
        <ToolbarSpacer />
        <ToolbarSearch
          value={filter.search}
          onChange={setSearchFilter}
          placeholder="Filter logs..."
        />
        <ToolbarCount total={logs.length} filtered={filteredLogs.length} />
      </Toolbar>

      <LogContainer ref={logContainerRef}>
        {filteredLogs.length === 0 ? (
          <Flex $direction="column" $align="center" $justify="center" style={{ height: "100%", padding: 24 }}>
            <Terminal size={32} color={theme.colors.text.muted} />
            <Text $color="muted" style={{ marginTop: 8 }}>No logs to display</Text>
          </Flex>
        ) : (
          filteredLogs.map((log) => {
            const originalLevel = (log as { _originalLevel?: string })._originalLevel || log.level;
            return (
              <div key={log.id}>
                <LogLine $level={originalLevel}>
                  <LogTimestamp>{formatTimestamp(log.timestamp)}</LogTimestamp>
                  <LogLevelBadge $level={originalLevel}>[{originalLevel}]</LogLevelBadge>
                  <LogMessage>{log.message}</LogMessage>
                </LogLine>
                {showJson && log.data !== undefined && (
                  <LogData>{JSON.stringify(log.data, null, 2)}</LogData>
                )}
              </div>
            );
          })
        )}
      </LogContainer>

      <CommandInput>
        <CommandPrompt>&gt;</CommandPrompt>
        <Input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCommand()}
          placeholder="Enter command..."
          inputSize="sm"
          style={{ flex: 1, background: "transparent", border: "none" }}
        />
        <IconButton
          icon={ChevronRight}
          size="sm"
          onClick={handleCommand}
          disabled={!command.trim()}
        />
      </CommandInput>
    </PageContainer>
  );
}
