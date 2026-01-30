import { useState, useMemo } from "react";
import { Square, RefreshCw, Search, Zap } from "lucide-react";
import {
  PageContainer,
  PageHeader,
  PageTitle,
  PageContent,
  Flex,
  Section,
  Badge,
  Text,
  Spinner,
} from "../../components/ui/Layout";
import {
  Toolbar,
  ToolbarSearch,
  ToolbarCount,
  ToolbarGroup,
  ToolbarSpacer,
} from "../../components/ui/Toolbar";
import { Button, IconButton } from "../../components/ui/Button";
import { Select, FormGroup, Label } from "../../components/ui/Input";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  EmptyState,
} from "../../components/ui/Table";

// ============================================================================
// Types
// ============================================================================

export type DeviceInfo = {
  id: string;
  name: string;
  device_type: string;
};

export type ProcessInfo = {
  pid: number;
  name: string;
};

export interface AttachPageProps {
  devices: DeviceInfo[];
  processes: ProcessInfo[];
  selectedDeviceId: string;
  sessionId: number | null;
  scriptId: number | null;
  busy: boolean;
  onDeviceChange: (deviceId: string) => void;
  onRefreshDevices: () => void;
  onRefreshProcesses: () => void;
  onAttach: (pid: number) => void;
  onDetach: () => void;
  onSpawn: (program: string, argv: string[] | null) => Promise<number | null>;
  onKill: (pid: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function AttachPage({
  devices,
  processes,
  selectedDeviceId,
  sessionId,
  scriptId,
  busy,
  onDeviceChange,
  onRefreshDevices,
  onRefreshProcesses,
  onAttach,
  onDetach,
  onSpawn: _onSpawn, // TODO: implement spawn UI
  onKill,
}: AttachPageProps) {
  const [search, setSearch] = useState("");
  const [selectedPid, setSelectedPid] = useState<number | null>(null);

  const isAttached = sessionId !== null;

  const filteredProcesses = useMemo(() => {
    if (!search) return processes;
    const lower = search.toLowerCase();
    return processes.filter(
      (p) => p.name.toLowerCase().includes(lower) || p.pid.toString().includes(lower)
    );
  }, [processes, search]);

  const handleAttach = () => {
    if (selectedPid !== null) {
      onAttach(selectedPid);
    }
  };

  const handleRowClick = (pid: number) => {
    setSelectedPid(pid);
  };

  const handleRowDoubleClick = (pid: number) => {
    if (!isAttached) {
      onAttach(pid);
    }
  };

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>Attach to Process</PageTitle>
        {isAttached && (
          <Badge $variant="success">
            Session #{sessionId} {scriptId && `/ Script #${scriptId}`}
          </Badge>
        )}
      </PageHeader>

      {/* Device Selection */}
      <Section style={{ padding: "12px 16px", background: "var(--bg-tertiary)" }}>
        <Flex $gap="12px" $align="end">
          <FormGroup style={{ flex: 1, maxWidth: 300 }}>
            <Label>Device</Label>
            <Select
              value={selectedDeviceId}
              onChange={(e) => onDeviceChange(e.target.value)}
              disabled={busy || isAttached}
            >
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} ({device.device_type})
                </option>
              ))}
            </Select>
          </FormGroup>
          <IconButton
            icon={RefreshCw}
            onClick={onRefreshDevices}
            disabled={busy}
            tooltip="Refresh devices"
          />
          {isAttached ? (
            <Button variant="danger" onClick={onDetach} disabled={busy} leftIcon={Square}>
              Detach
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleAttach}
              disabled={busy || selectedPid === null}
              leftIcon={Zap}
            >
              Attach
            </Button>
          )}
        </Flex>
      </Section>

      {/* Process List Toolbar */}
      <Toolbar>
        <ToolbarSearch value={search} onChange={setSearch} placeholder="Filter processes..." />
        <ToolbarCount total={processes.length} filtered={filteredProcesses.length} />
        <ToolbarSpacer />
        <ToolbarGroup>
          <IconButton
            icon={RefreshCw}
            size="sm"
            onClick={onRefreshProcesses}
            disabled={busy}
            tooltip="Refresh processes"
          />
        </ToolbarGroup>
      </Toolbar>

      {/* Process Table */}
      <PageContent style={{ padding: 0 }}>
        {busy && processes.length === 0 ? (
          <EmptyState>
            <Spinner />
            <Text $color="muted">Loading processes...</Text>
          </EmptyState>
        ) : filteredProcesses.length === 0 ? (
          <EmptyState>
            <Search size={32} />
            <Text $color="muted">No processes found</Text>
          </EmptyState>
        ) : (
          <Table size="sm" hoverable>
            <TableHead>
              <TableRow>
                <TableHeader width="80px" align="right">
                  PID
                </TableHeader>
                <TableHeader>Name</TableHeader>
                <TableHeader width="100px" align="center">
                  Actions
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProcesses.map((process) => (
                <TableRow
                  key={process.pid}
                  selected={selectedPid === process.pid}
                  clickable
                  onClick={() => handleRowClick(process.pid)}
                  onDoubleClick={() => handleRowDoubleClick(process.pid)}
                >
                  <TableCell align="right" mono>
                    {process.pid}
                  </TableCell>
                  <TableCell>{process.name}</TableCell>
                  <TableCell align="center">
                      <IconButton
                        icon={Square}
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onKill(process.pid);
                        }}
                        tooltip="Kill"
                        disabled={busy}
                      />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </PageContent>
    </PageContainer>
  );
}
