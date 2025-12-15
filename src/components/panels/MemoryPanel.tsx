import { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Search,
  Download,
  Upload,
  Eye,
  EyeOff,
  Play,
  Square,
  Trash2,
  Activity,
  Loader,
  MapPin,
} from 'lucide-react';
import { theme } from '../../styles';
import { PanelContainer, PanelContent, PanelSection, PanelSectionTitle } from '../common/Panel';
import { Button, IconButton } from '../common/Button';
import { Input, InputGroup, Label, InputRow } from '../common/Input';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell, EmptyState } from '../common/Table';
import { useUIStore } from '../../stores/uiStore';
import { useConsoleStore } from '../../stores/consoleStore';
import { agentRpc } from '../../features/frida/agentRpc';

const MemoryGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.spacing.md};
`;

const MemoryCard = styled.div`
  padding: ${theme.spacing.md};
  background: ${theme.colors.bg.tertiary};
  border-radius: ${theme.borderRadius.md};
  border: 1px solid ${theme.colors.border.primary};
`;

const CardTitle = styled.h4`
  font-size: ${theme.fontSize.sm};
  font-weight: 600;
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.md};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
`;

const HexView = styled.pre`
  font-family: 'Consolas', monospace;
  font-size: ${theme.fontSize.xs};
  line-height: 1.6;
  background: ${theme.colors.bg.primary};
  padding: ${theme.spacing.md};
  border-radius: ${theme.borderRadius.md};
  overflow: auto;
  max-height: 300px;
  color: ${theme.colors.text.primary};
  white-space: pre;
`;


const ResultBox = styled.div`
  padding: ${theme.spacing.md};
  background: ${theme.colors.bg.primary};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.md};
  font-family: 'Consolas', monospace;
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.accent};
  word-break: break-all;
`;

const PlaceholderMessage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: ${theme.colors.text.muted};
  text-align: center;
  gap: ${theme.spacing.sm};
`;

const TabContainer = styled.div`
  display: flex;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  background: ${theme.colors.bg.tertiary};
  border-bottom: 1px solid ${theme.colors.border.primary};
`;

const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border: none;
  background: ${({ $active }) => $active ? theme.colors.bg.secondary : 'transparent'};
  color: ${({ $active }) => $active ? theme.colors.text.primary : theme.colors.text.muted};
  border-radius: ${theme.borderRadius.sm};
  font-size: ${theme.fontSize.xs};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: ${theme.colors.bg.hover};
    color: ${theme.colors.text.primary};
  }
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 4px;
  background: ${theme.colors.bg.secondary};
  border-radius: 2px;
  overflow: hidden;
  margin: ${theme.spacing.sm} 0;
`;

const ProgressFill = styled(motion.div)`
  height: 100%;
  background: ${theme.colors.accent.primary};
  border-radius: 2px;
`;

const ScanStatus = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm};
  background: ${theme.colors.bg.secondary};
  border-radius: ${theme.borderRadius.sm};
  font-size: ${theme.fontSize.xs};
  margin-bottom: ${theme.spacing.sm};
`;

const MatchList = styled.div`
  max-height: 300px;
  overflow: auto;
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.sm};
  background: ${theme.colors.bg.primary};
`;

const MatchItem = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border-bottom: 1px solid ${theme.colors.border.primary};
  font-family: 'Consolas', monospace;
  font-size: ${theme.fontSize.xs};
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${theme.colors.bg.hover};
  }
`;

const MonitorCard = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${({ $active }) => $active ? `${theme.colors.status.success}10` : theme.colors.bg.secondary};
  border: 1px solid ${({ $active }) => $active ? theme.colors.status.success : theme.colors.border.primary};
  border-radius: ${theme.borderRadius.md};
  margin-bottom: ${theme.spacing.sm};
`;

const AccessEventList = styled.div`
  max-height: 250px;
  overflow: auto;
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.sm};
  background: ${theme.colors.bg.primary};
`;

const AccessEvent = styled(motion.div)<{ $operation: string }>`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border-bottom: 1px solid ${theme.colors.border.primary};
  font-size: ${theme.fontSize.xs};

  &:last-child {
    border-bottom: none;
  }

  color: ${({ $operation }) => {
    if ($operation === 'read') return theme.colors.status.success;
    if ($operation === 'write') return theme.colors.status.error;
    return theme.colors.text.primary;
  }};
`;

type TabId = 'read-write' | 'scan' | 'monitor' | 'ranges';

type ScanMatch = {
  address: string;
  size: number;
  matchIndex: number;
};

type AccessEventData = {
  id: string;
  operation: string;
  from: string;
  address: string;
  timestamp: Date;
};

type MemoryPanelProps = {
  hasSession: boolean;
  onRpcCall: (method: string, params?: unknown) => Promise<unknown>;
};

export function MemoryPanel({ hasSession, onRpcCall }: MemoryPanelProps) {
  // Use Zustand store for state persistence across tab switches
  const {
    memoryPanel: {
      readAddress,
      readSize,
      hexDump,
      writeAddress,
      writeValue,
      searchPattern,
      searchResults,
    },
    setMemoryReadAddress,
    setMemoryReadSize,
    setMemoryHexDump,
    setMemoryWriteAddress,
    setMemoryWriteValue,
    setMemorySearchPattern,
    setMemorySearchResults,
  } = useUIStore();

  const { log } = useConsoleStore();
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('read-write');

  // Async scan state
  const [scanRunning, setScanRunning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMatches, setScanMatches] = useState<ScanMatch[]>([]);
  const [asyncPattern, setAsyncPattern] = useState('');

  // Memory access monitor state
  const [monitorEnabled, setMonitorEnabled] = useState(false);
  const [monitorRangeBase, setMonitorRangeBase] = useState('');
  const [monitorRangeSize, setMonitorRangeSize] = useState('4096');
  const [accessEvents, setAccessEvents] = useState<AccessEventData[]>([]);

  // Ranges state
  const [ranges, setRanges] = useState<{ base: string; size: number; protection: string }[]>([]);
  const [rangeProtection, setRangeProtection] = useState('r--');

  // Subscribe to scan and monitor events
  useEffect(() => {
    const unsubscribe = agentRpc.onEvent((payload) => {
      const eventType = payload.event;

      if (eventType === 'memory_scan_match') {
        const match = payload as unknown as { address: string; size: number; matchIndex: number };
        setScanMatches((prev) => [...prev, {
          address: match.address,
          size: match.size,
          matchIndex: match.matchIndex,
        }]);
      } else if (eventType === 'memory_scan_progress') {
        const progress = (payload as unknown as { progress: number }).progress;
        setScanProgress(progress);
      } else if (eventType === 'memory_scan_complete') {
        setScanRunning(false);
        setScanProgress(100);
        log('success', `Scan complete: ${(payload as unknown as { totalMatches: number }).totalMatches} matches`);
      } else if (eventType === 'memory_access') {
        const access = payload as unknown as { operation: string; from: string; address: string };
        setAccessEvents((prev) => [...prev.slice(-99), {
          id: `${Date.now()}-${Math.random()}`,
          operation: access.operation,
          from: access.from,
          address: access.address,
          timestamp: new Date(),
        }]);
      }
    });
    return unsubscribe;
  }, [log]);

  const handleRead = async () => {
    if (!readAddress) return;
    setLoading(true);
    try {
      const result = await onRpcCall('read_memory', {
        address: readAddress,
        size: parseInt(readSize, 10),
      });
      if (typeof result === 'string') {
        setMemoryHexDump(result);
      } else if (result && typeof result === 'object' && 'hex' in result) {
        setMemoryHexDump((result as { hex: string }).hex);
      }
    } catch (e) {
      console.error('Failed to read memory:', e);
      setMemoryHexDump('Error reading memory');
    } finally {
      setLoading(false);
    }
  };

  const handleWrite = async () => {
    if (!writeAddress || !writeValue) return;
    setLoading(true);
    try {
      await onRpcCall('write_memory', {
        address: writeAddress,
        bytes: writeValue,
      });
    } catch (e) {
      console.error('Failed to write memory:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchPattern) return;
    setLoading(true);
    try {
      const result = await onRpcCall('search_memory', {
        pattern: searchPattern,
      });
      // Agent returns { pattern, results, count } object
      if (result && typeof result === 'object' && 'results' in result) {
        const data = result as { results: string[] };
        setMemorySearchResults(data.results);
      } else if (Array.isArray(result)) {
        setMemorySearchResults(result.map(String));
      }
    } catch (e) {
      console.error('Failed to search memory:', e);
    } finally {
      setLoading(false);
    }
  };

  // Async scan handlers
  const handleStartAsyncScan = async () => {
    if (!asyncPattern.trim()) return;
    setScanMatches([]);
    setScanProgress(0);
    setScanRunning(true);
    try {
      await onRpcCall('memory_scan_async', { pattern: asyncPattern });
    } catch (e) {
      console.error('Failed to start async scan:', e);
      setScanRunning(false);
    }
  };

  const handleStopAsyncScan = async () => {
    try {
      await onRpcCall('memory_scan_abort');
      setScanRunning(false);
    } catch (e) {
      console.error('Failed to stop scan:', e);
    }
  };

  // Memory access monitor handlers
  const handleEnableMonitor = async () => {
    if (!monitorRangeBase.trim()) return;
    try {
      await onRpcCall('memory_access_monitor_enable', {
        ranges: [{ base: monitorRangeBase, size: parseInt(monitorRangeSize, 10) }],
      });
      setMonitorEnabled(true);
    } catch (e) {
      console.error('Failed to enable monitor:', e);
    }
  };

  const handleDisableMonitor = async () => {
    try {
      await onRpcCall('memory_access_monitor_disable');
      setMonitorEnabled(false);
    } catch (e) {
      console.error('Failed to disable monitor:', e);
    }
  };

  // Ranges handler
  const handleEnumerateRanges = async () => {
    setLoading(true);
    try {
      const result = await onRpcCall('process_enumerate_ranges', { protection: rangeProtection });
      if (Array.isArray(result)) {
        setRanges(result as { base: string; size: number; protection: string }[]);
      }
    } catch (e) {
      console.error('Failed to enumerate ranges:', e);
    } finally {
      setLoading(false);
    }
  };

  // Jump to address in read view
  const handleJumpToAddress = useCallback((address: string) => {
    setMemoryReadAddress(address);
    setActiveTab('read-write');
  }, [setMemoryReadAddress]);

  if (!hasSession) {
    return (
      <PanelContainer>
        <PanelContent>
          <PlaceholderMessage>
            <Database size={48} strokeWidth={1} />
            <span>Attach to a process to access memory</span>
          </PlaceholderMessage>
        </PanelContent>
      </PanelContainer>
    );
  }

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'read-write':
        return (
          <>
            <MemoryGrid>
              {/* Read Memory */}
              <MemoryCard>
                <CardTitle>
                  <Download size={16} />
                  Read Memory
                </CardTitle>
                <InputGroup>
                  <Label>Address</Label>
                  <Input
                    value={readAddress}
                    onChange={(e) => setMemoryReadAddress(e.target.value)}
                    placeholder="0x7fff12340000"
                  />
                </InputGroup>
                <InputGroup style={{ marginTop: theme.spacing.sm }}>
                  <Label>Size (bytes)</Label>
                  <InputRow>
                    <Input
                      value={readSize}
                      onChange={(e) => setMemoryReadSize(e.target.value)}
                      placeholder="64"
                      style={{ width: 100 }}
                    />
                    <Button
                      $variant="primary"
                      $size="sm"
                      onClick={handleRead}
                      disabled={loading || !readAddress}
                    >
                      Read
                    </Button>
                  </InputRow>
                </InputGroup>
                {hexDump && (
                  <HexView style={{ marginTop: theme.spacing.md }}>
                    {hexDump}
                  </HexView>
                )}
              </MemoryCard>

              {/* Write Memory */}
              <MemoryCard>
                <CardTitle>
                  <Upload size={16} />
                  Write Memory
                </CardTitle>
                <InputGroup>
                  <Label>Address</Label>
                  <Input
                    value={writeAddress}
                    onChange={(e) => setMemoryWriteAddress(e.target.value)}
                    placeholder="0x7fff12340000"
                  />
                </InputGroup>
                <InputGroup style={{ marginTop: theme.spacing.sm }}>
                  <Label>Bytes (hex)</Label>
                  <Input
                    value={writeValue}
                    onChange={(e) => setMemoryWriteValue(e.target.value)}
                    placeholder="90 90 90 90"
                  />
                </InputGroup>
                <Button
                  $variant="danger"
                  $size="sm"
                  onClick={handleWrite}
                  disabled={loading || !writeAddress || !writeValue}
                  style={{ marginTop: theme.spacing.md }}
                >
                  Write
                </Button>
              </MemoryCard>
            </MemoryGrid>

            {/* Quick Search */}
            <PanelSection style={{ marginTop: theme.spacing.md }}>
              <PanelSectionTitle>Quick Search (Sync)</PanelSectionTitle>
              <MemoryCard>
                <InputGroup>
                  <Label>Pattern</Label>
                  <InputRow>
                    <Input
                      value={searchPattern}
                      onChange={(e) => setMemorySearchPattern(e.target.value)}
                      placeholder='48 8B ?? ??'
                      style={{ flex: 1 }}
                    />
                    <Button
                      $variant="primary"
                      $size="sm"
                      onClick={handleSearch}
                      disabled={loading || !searchPattern}
                    >
                      <Search size={14} />
                      Search
                    </Button>
                  </InputRow>
                </InputGroup>
                {searchResults.length > 0 && (
                  <ResultBox style={{ marginTop: theme.spacing.md }}>
                    {searchResults.slice(0, 20).map((r, i) => (
                      <div
                        key={i}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleJumpToAddress(r)}
                      >
                        {r}
                      </div>
                    ))}
                    {searchResults.length > 20 && (
                      <div style={{ color: theme.colors.text.muted }}>
                        ...and {searchResults.length - 20} more
                      </div>
                    )}
                  </ResultBox>
                )}
              </MemoryCard>
            </PanelSection>
          </>
        );

      case 'scan':
        return (
          <PanelSection>
            <PanelSectionTitle>
              <Search size={14} />
              Async Memory Scan (Streaming)
            </PanelSectionTitle>
            <MemoryCard>
              <InputGroup>
                <Label>Pattern (Frida format: "48 8B ?? ??")</Label>
                <InputRow>
                  <Input
                    value={asyncPattern}
                    onChange={(e) => setAsyncPattern(e.target.value)}
                    placeholder='48 8B ?? ?? or 00 00 00 00 ?? 13 37'
                    style={{ flex: 1 }}
                    disabled={scanRunning}
                  />
                  {scanRunning ? (
                    <Button $variant="danger" $size="sm" onClick={handleStopAsyncScan}>
                      <Square size={14} />
                      Stop
                    </Button>
                  ) : (
                    <Button
                      $variant="primary"
                      $size="sm"
                      onClick={handleStartAsyncScan}
                      disabled={!asyncPattern.trim()}
                    >
                      <Play size={14} />
                      Start
                    </Button>
                  )}
                </InputRow>
              </InputGroup>

              {scanRunning && (
                <>
                  <ScanStatus>
                    <Loader size={14} className="animate-spin" />
                    Scanning... {scanProgress}%
                  </ScanStatus>
                  <ProgressBar>
                    <ProgressFill
                      initial={{ width: 0 }}
                      animate={{ width: `${scanProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </ProgressBar>
                </>
              )}

              <PanelSectionTitle style={{ marginTop: theme.spacing.md }}>
                Matches ({scanMatches.length})
                {scanMatches.length > 0 && (
                  <IconButton $size="sm" onClick={() => setScanMatches([])} style={{ marginLeft: 'auto' }}>
                    <Trash2 size={12} />
                  </IconButton>
                )}
              </PanelSectionTitle>
              <MatchList>
                <AnimatePresence>
                  {scanMatches.length > 0 ? (
                    scanMatches.slice(0, 100).map((match) => (
                      <MatchItem
                        key={match.matchIndex}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => handleJumpToAddress(match.address)}
                      >
                        <MapPin size={12} />
                        <span style={{ color: theme.colors.text.accent }}>{match.address}</span>
                        <span style={{ color: theme.colors.text.muted }}>({match.size} bytes)</span>
                      </MatchItem>
                    ))
                  ) : (
                    <EmptyState style={{ padding: theme.spacing.md }}>
                      {scanRunning ? 'Scanning...' : 'No matches yet. Start a scan.'}
                    </EmptyState>
                  )}
                </AnimatePresence>
              </MatchList>
            </MemoryCard>
          </PanelSection>
        );

      case 'monitor':
        return (
          <PanelSection>
            <PanelSectionTitle>
              <Eye size={14} />
              Memory Access Monitor
            </PanelSectionTitle>

            <MonitorCard $active={monitorEnabled}>
              <div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  {monitorEnabled ? 'Monitor Active' : 'Monitor Disabled'}
                </div>
                <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.text.muted }}>
                  Tracks read/write access to specified memory ranges
                </div>
              </div>
              {monitorEnabled ? (
                <Button $variant="danger" $size="sm" onClick={handleDisableMonitor}>
                  <EyeOff size={14} />
                  Disable
                </Button>
              ) : (
                <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'flex-end' }}>
                  <InputGroup style={{ marginBottom: 0 }}>
                    <Label>Base Address</Label>
                    <Input
                      value={monitorRangeBase}
                      onChange={(e) => setMonitorRangeBase(e.target.value)}
                      placeholder="0x..."
                      style={{ width: 150, fontFamily: 'Consolas, monospace' }}
                    />
                  </InputGroup>
                  <InputGroup style={{ marginBottom: 0 }}>
                    <Label>Size</Label>
                    <Input
                      type="number"
                      value={monitorRangeSize}
                      onChange={(e) => setMonitorRangeSize(e.target.value)}
                      style={{ width: 80 }}
                    />
                  </InputGroup>
                  <Button
                    $variant="primary"
                    $size="sm"
                    onClick={handleEnableMonitor}
                    disabled={!monitorRangeBase.trim()}
                  >
                    <Eye size={14} />
                    Enable
                  </Button>
                </div>
              )}
            </MonitorCard>

            <PanelSectionTitle>
              Access Events ({accessEvents.length})
              {accessEvents.length > 0 && (
                <IconButton $size="sm" onClick={() => setAccessEvents([])} style={{ marginLeft: 'auto' }}>
                  <Trash2 size={12} />
                </IconButton>
              )}
            </PanelSectionTitle>
            <AccessEventList>
              <AnimatePresence>
                {accessEvents.length > 0 ? (
                  accessEvents.slice().reverse().map((evt) => (
                    <AccessEvent
                      key={evt.id}
                      $operation={evt.operation}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <Activity size={12} />
                      <span style={{ fontWeight: 500, textTransform: 'uppercase' }}>
                        {evt.operation}
                      </span>
                      <span style={{ fontFamily: 'Consolas, monospace' }}>
                        {evt.address}
                      </span>
                      <span style={{ color: theme.colors.text.muted }}>
                        from {evt.from}
                      </span>
                    </AccessEvent>
                  ))
                ) : (
                  <EmptyState style={{ padding: theme.spacing.md }}>
                    {monitorEnabled ? 'Waiting for memory access...' : 'Enable monitor to capture events'}
                  </EmptyState>
                )}
              </AnimatePresence>
            </AccessEventList>
          </PanelSection>
        );

      case 'ranges':
        return (
          <PanelSection>
            <PanelSectionTitle>
              <Database size={14} />
              Memory Ranges
            </PanelSectionTitle>
            <MemoryCard>
              <InputRow>
                <InputGroup style={{ marginBottom: 0, flex: 1 }}>
                  <Label>Protection Filter</Label>
                  <select
                    value={rangeProtection}
                    onChange={(e) => setRangeProtection(e.target.value)}
                    style={{
                      padding: '6px 8px',
                      background: theme.colors.bg.secondary,
                      border: `1px solid ${theme.colors.border.primary}`,
                      borderRadius: theme.borderRadius.sm,
                      color: theme.colors.text.primary,
                      fontSize: theme.fontSize.sm,
                    }}
                  >
                    <option value="r--">Readable (r--)</option>
                    <option value="rw-">Read/Write (rw-)</option>
                    <option value="r-x">Read/Execute (r-x)</option>
                    <option value="rwx">All (rwx)</option>
                  </select>
                </InputGroup>
                <Button $variant="primary" $size="sm" onClick={handleEnumerateRanges} disabled={loading}>
                  Enumerate
                </Button>
              </InputRow>
            </MemoryCard>

            <Table style={{ marginTop: theme.spacing.md }}>
              <TableHead>
                <tr>
                  <TableHeader>Base</TableHeader>
                  <TableHeader $width="100px">Size</TableHeader>
                  <TableHeader $width="80px">Prot</TableHeader>
                  <TableHeader $width="60px">Actions</TableHeader>
                </tr>
              </TableHead>
              <TableBody>
                {ranges.slice(0, 100).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell $mono>{r.base}</TableCell>
                    <TableCell>{(r.size / 1024).toFixed(1)} KB</TableCell>
                    <TableCell $mono>{r.protection}</TableCell>
                    <TableCell>
                      <IconButton $size="sm" onClick={() => handleJumpToAddress(r.base)}>
                        <Download size={12} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {ranges.length === 0 && (
              <EmptyState>
                Click "Enumerate" to list memory ranges
              </EmptyState>
            )}
            {ranges.length > 100 && (
              <div style={{ textAlign: 'center', padding: theme.spacing.sm, color: theme.colors.text.muted }}>
                Showing 100 of {ranges.length} ranges
              </div>
            )}
          </PanelSection>
        );

      default:
        return null;
    }
  };

  return (
    <PanelContainer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <TabContainer>
        <Tab $active={activeTab === 'read-write'} onClick={() => setActiveTab('read-write')}>
          <Database size={12} />
          Read/Write
        </Tab>
        <Tab $active={activeTab === 'scan'} onClick={() => setActiveTab('scan')}>
          <Search size={12} />
          Async Scan
        </Tab>
        <Tab $active={activeTab === 'monitor'} onClick={() => setActiveTab('monitor')}>
          <Eye size={12} />
          Monitor
        </Tab>
        <Tab $active={activeTab === 'ranges'} onClick={() => setActiveTab('ranges')}>
          <MapPin size={12} />
          Ranges
        </Tab>
      </TabContainer>

      <PanelContent>
        {renderTabContent()}
      </PanelContent>
    </PanelContainer>
  );
}
