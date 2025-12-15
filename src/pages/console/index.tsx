import { useState, useRef, useEffect, useMemo } from "react";
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

// ============================================================================
// Types
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

const LogLine = styled.div<{ $level: LogLevel }>`
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

const LogLevel = styled.span<{ $level: LogLevel }>`
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
  logs = [],
  onClear,
  onExport,
  onCommand,
}: ConsolePageProps) {
  const [search, setSearch] = useState("");
  const [paused, setPaused] = useState(false);
  const [command, setCommand] = useState("");
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const logContainerRef = useRef<HTMLDivElement>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (levelFilter !== "all" && log.level !== levelFilter) return false;
      if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logs, search, levelFilter]);

  // Auto-scroll to bottom when new logs arrive (unless paused)
  useEffect(() => {
    if (!paused && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, paused]);

  const handleCommand = () => {
    if (command.trim() && onCommand) {
      onCommand(command.trim());
      setCommand("");
    }
  };

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("en-US", { hour12: false }) + "." + date.getMilliseconds().toString().padStart(3, "0");
  };

  const levelTabs = [
    { id: "all", label: "All" },
    { id: "log", label: "Log" },
    { id: "info", label: "Info" },
    { id: "warn", label: "Warn" },
    { id: "error", label: "Error" },
    { id: "debug", label: "Debug" },
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
            icon={paused ? Play : Pause}
            size="sm"
            onClick={() => setPaused(!paused)}
            tooltip={paused ? "Resume" : "Pause"}
          />
          <IconButton
            icon={Download}
            size="sm"
            onClick={onExport}
            tooltip="Export logs"
            disabled={!onExport}
          />
          <IconButton
            icon={Trash2}
            size="sm"
            onClick={onClear}
            tooltip="Clear logs"
            disabled={!onClear}
          />
        </PageActions>
      </PageHeader>

      <Toolbar>
        <Tabs
          items={levelTabs}
          value={levelFilter}
          onChange={(v) => setLevelFilter(v as LogLevel | "all")}
          size="sm"
          variant="pills"
        />
        <ToolbarSpacer />
        <ToolbarSearch value={search} onChange={setSearch} placeholder="Filter logs..." />
        <ToolbarCount total={logs.length} filtered={filteredLogs.length} />
      </Toolbar>

      <LogContainer ref={logContainerRef}>
        {filteredLogs.length === 0 ? (
          <Flex $direction="column" $align="center" $justify="center" style={{ height: "100%", padding: 24 }}>
            <Terminal size={32} color={theme.colors.text.muted} />
            <Text $color="muted" style={{ marginTop: 8 }}>No logs to display</Text>
          </Flex>
        ) : (
          filteredLogs.map((log) => (
            <LogLine key={log.id} $level={log.level}>
              <LogTimestamp>{formatTimestamp(log.timestamp)}</LogTimestamp>
              <LogLevel $level={log.level}>[{log.level}]</LogLevel>
              <LogMessage>{log.message}</LogMessage>
            </LogLine>
          ))
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
