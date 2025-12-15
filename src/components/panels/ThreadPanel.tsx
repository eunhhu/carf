import { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  Pause,
  RefreshCw,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  AlertTriangle,
  Activity,
  Target,
  Crosshair,
} from 'lucide-react';
import { theme } from '../../styles';
import { PanelContainer, PanelContent, PanelSection, PanelSectionTitle } from '../common/Panel';
import { Button, IconButton } from '../common/Button';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell, EmptyState } from '../common/Table';
import { Toolbar } from '../common/Toolbar';
import { Input } from '../common/Input';
import { useUIStore } from '../../stores/uiStore';
import { useConsoleStore } from '../../stores/consoleStore';
import { agentRpc } from '../../features/frida/agentRpc';

const ThreadStatusBadge = styled.span<{ $state: string }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  font-size: ${theme.fontSize.xs};
  border-radius: ${theme.borderRadius.sm};
  background: ${({ $state }) => {
    switch ($state) {
      case 'running': return theme.colors.status.success;
      case 'waiting': return theme.colors.status.warning;
      case 'stopped': return theme.colors.status.error;
      default: return theme.colors.bg.hover;
    }
  }};
  color: white;
`;

const BacktraceView = styled.div`
  background: ${theme.colors.bg.primary};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.md};
  padding: ${theme.spacing.md};
  max-height: 300px;
  overflow: auto;
`;

const BacktraceFrame = styled.div`
  display: flex;
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.xs} 0;
  border-bottom: 1px solid ${theme.colors.border.primary};
  font-size: ${theme.fontSize.xs};
  
  &:last-child {
    border-bottom: none;
  }
`;

const FrameIndex = styled.span`
  color: ${theme.colors.text.muted};
  min-width: 24px;
`;

const FrameAddress = styled.span`
  font-family: 'Consolas', monospace;
  color: ${theme.colors.text.accent};
`;

const FrameSymbol = styled.span`
  font-family: 'Consolas', monospace;
  color: ${theme.colors.text.success};
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

const ObserverCard = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${({ $active }) => $active ? `${theme.colors.status.success}10` : theme.colors.bg.secondary};
  border: 1px solid ${({ $active }) => $active ? theme.colors.status.success : theme.colors.border.primary};
  border-radius: ${theme.borderRadius.md};
  margin-bottom: ${theme.spacing.sm};
`;

const ObserverInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ObserverTitle = styled.span`
  font-weight: 500;
  font-size: ${theme.fontSize.sm};
`;

const ObserverDescription = styled.span`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
`;

const StatusDot = styled.span<{ $active: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $active }) => $active ? theme.colors.status.success : theme.colors.text.muted};
  margin-right: ${theme.spacing.xs};
`;

const FormRow = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
  align-items: flex-end;
  margin-bottom: ${theme.spacing.sm};
`;

const FormField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
`;

const FormLabel = styled.label`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
`;

const EventList = styled.div`
  max-height: 200px;
  overflow: auto;
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.sm};
  background: ${theme.colors.bg.primary};
`;

const EventItem = styled(motion.div)<{ $type: string }>`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border-bottom: 1px solid ${theme.colors.border.primary};
  font-size: ${theme.fontSize.xs};

  &:last-child {
    border-bottom: none;
  }

  color: ${({ $type }) => {
    if ($type.includes('added')) return theme.colors.status.success;
    if ($type.includes('removed')) return theme.colors.status.error;
    return theme.colors.text.primary;
  }};
`;

type TabId = 'threads' | 'observers' | 'breakpoints' | 'exceptions';

type Breakpoint = {
  id: number;
  address: string;
  type: 'breakpoint' | 'watchpoint';
  conditions?: string;
  size?: number;
  enabled: boolean;
};

type ObserverEvent = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: Date;
};

type ThreadPanelProps = {
  hasSession: boolean;
  onRpcCall: (method: string, params?: unknown) => Promise<unknown>;
};

export function ThreadPanel({ hasSession, onRpcCall }: ThreadPanelProps) {
  // Use Zustand store for state persistence across tab switches
  const {
    threadPanel: { threads, selectedThread, backtrace },
    setThreads,
    setSelectedThread,
    setBacktrace,
  } = useUIStore();

  const { log } = useConsoleStore();
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('threads');

  // Observer states
  const [threadObserverActive, setThreadObserverActive] = useState(false);
  const [moduleObserverActive, setModuleObserverActive] = useState(false);
  const [exceptionHandlerActive, setExceptionHandlerActive] = useState(false);
  const [observerEvents, setObserverEvents] = useState<ObserverEvent[]>([]);

  // Breakpoint states
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [newBpAddress, setNewBpAddress] = useState('');
  const [newWpAddress, setNewWpAddress] = useState('');
  const [newWpSize, setNewWpSize] = useState('4');
  const [newWpConditions, setNewWpConditions] = useState<'r' | 'w' | 'rw'>('rw');

  // Subscribe to observer events
  useEffect(() => {
    const unsubscribe = agentRpc.onEvent((payload) => {
      const eventType = payload.event;
      if (
        eventType === 'thread_added' ||
        eventType === 'thread_removed' ||
        eventType === 'thread_renamed' ||
        eventType === 'module_added' ||
        eventType === 'module_removed' ||
        eventType === 'native_exception'
      ) {
        const newEvent: ObserverEvent = {
          id: `${Date.now()}-${Math.random()}`,
          type: eventType,
          data: payload,
          timestamp: new Date(),
        };
        setObserverEvents((prev) => [...prev.slice(-99), newEvent]);
        log('event', eventType, { data: payload });
      }
    });
    return unsubscribe;
  }, [log]);

  const handleEnumerateThreads = async () => {
    setLoading(true);
    try {
      const result = await onRpcCall('enumerate_threads');
      if (Array.isArray(result)) {
        setThreads(result);
      }
    } catch (e) {
      console.error('Failed to enumerate threads:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectThread = async (threadId: number) => {
    setSelectedThread(threadId);
    setLoading(true);
    try {
      // Note: Agent expects 'threadId' not 'thread_id'
      const result = await onRpcCall('get_backtrace', { threadId });
      if (Array.isArray(result)) {
        setBacktrace(result);
      }
    } catch (e) {
      console.error('Failed to get backtrace:', e);
      setBacktrace([]);
    } finally {
      setLoading(false);
    }
  };

  // Observer handlers
  const handleToggleThreadObserver = async () => {
    setLoading(true);
    try {
      if (threadObserverActive) {
        await onRpcCall('detach_thread_observer');
        setThreadObserverActive(false);
      } else {
        await onRpcCall('attach_thread_observer');
        setThreadObserverActive(true);
      }
    } catch (e) {
      console.error('Failed to toggle thread observer:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleModuleObserver = async () => {
    setLoading(true);
    try {
      if (moduleObserverActive) {
        await onRpcCall('detach_module_observer');
        setModuleObserverActive(false);
      } else {
        await onRpcCall('attach_module_observer');
        setModuleObserverActive(true);
      }
    } catch (e) {
      console.error('Failed to toggle module observer:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExceptionHandler = async () => {
    setLoading(true);
    try {
      if (!exceptionHandlerActive) {
        await onRpcCall('set_exception_handler');
        setExceptionHandlerActive(true);
      }
      // Note: Exception handler cannot be unset once installed
    } catch (e) {
      console.error('Failed to set exception handler:', e);
    } finally {
      setLoading(false);
    }
  };

  // Breakpoint handlers
  const handleAddBreakpoint = async () => {
    if (!newBpAddress.trim()) return;
    const id = breakpoints.length;
    try {
      await onRpcCall('set_hardware_breakpoint', { id, address: newBpAddress });
      setBreakpoints((prev) => [...prev, {
        id,
        address: newBpAddress,
        type: 'breakpoint',
        enabled: true,
      }]);
      setNewBpAddress('');
    } catch (e) {
      console.error('Failed to add breakpoint:', e);
    }
  };

  const handleAddWatchpoint = async () => {
    if (!newWpAddress.trim()) return;
    const id = breakpoints.length;
    try {
      await onRpcCall('set_hardware_watchpoint', {
        id,
        address: newWpAddress,
        size: parseInt(newWpSize, 10),
        conditions: newWpConditions,
      });
      setBreakpoints((prev) => [...prev, {
        id,
        address: newWpAddress,
        type: 'watchpoint',
        size: parseInt(newWpSize, 10),
        conditions: newWpConditions,
        enabled: true,
      }]);
      setNewWpAddress('');
    } catch (e) {
      console.error('Failed to add watchpoint:', e);
    }
  };

  const handleRemoveBreakpoint = async (bp: Breakpoint) => {
    try {
      if (bp.type === 'breakpoint') {
        await onRpcCall('unset_hardware_breakpoint', { id: bp.id });
      } else {
        await onRpcCall('unset_hardware_watchpoint', { id: bp.id });
      }
      setBreakpoints((prev) => prev.filter((b) => b.id !== bp.id));
    } catch (e) {
      console.error('Failed to remove breakpoint:', e);
    }
  };

  const clearEvents = () => setObserverEvents([]);

  if (!hasSession) {
    return (
      <PanelContainer>
        <PanelContent>
          <PlaceholderMessage>
            <Layers size={48} strokeWidth={1} />
            <span>Attach to a process to view threads</span>
          </PlaceholderMessage>
        </PanelContent>
      </PanelContainer>
    );
  }

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'threads':
        return (
          <>
            <PanelSection>
              <PanelSectionTitle>Threads ({threads.length})</PanelSectionTitle>
              <Table>
                <TableHead>
                  <tr>
                    <TableHeader $width="80px">ID</TableHeader>
                    <TableHeader $width="100px">State</TableHeader>
                    <TableHeader>PC</TableHeader>
                    <TableHeader $width="100px">Actions</TableHeader>
                  </tr>
                </TableHead>
                <TableBody>
                  {threads.map((t) => (
                    <TableRow
                      key={t.id}
                      $clickable
                      $selected={selectedThread === t.id}
                      onClick={() => handleSelectThread(t.id)}
                    >
                      <TableCell $mono>{t.id}</TableCell>
                      <TableCell>
                        <ThreadStatusBadge $state={t.state}>
                          {t.state}
                        </ThreadStatusBadge>
                      </TableCell>
                      <TableCell $mono>{t.context?.pc || '-'}</TableCell>
                      <TableCell>
                        <Button $variant="ghost" $size="sm">
                          <Pause size={12} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {threads.length === 0 && (
                <EmptyState>
                  Click refresh to enumerate threads
                </EmptyState>
              )}
            </PanelSection>

            {selectedThread !== null && (
              <PanelSection>
                <PanelSectionTitle>Backtrace: Thread #{selectedThread}</PanelSectionTitle>
                <BacktraceView>
                  {backtrace.map((frame, i) => (
                    <BacktraceFrame key={i}>
                      <FrameIndex>#{i}</FrameIndex>
                      <FrameAddress>{frame.address}</FrameAddress>
                      {frame.symbol && <FrameSymbol>{frame.symbol}</FrameSymbol>}
                    </BacktraceFrame>
                  ))}
                  {backtrace.length === 0 && (
                    <PlaceholderMessage style={{ height: 100 }}>
                      No backtrace available
                    </PlaceholderMessage>
                  )}
                </BacktraceView>
              </PanelSection>
            )}
          </>
        );

      case 'observers':
        return (
          <>
            <PanelSection>
              <PanelSectionTitle>Process Observers</PanelSectionTitle>
              
              <ObserverCard $active={threadObserverActive}>
                <ObserverInfo>
                  <ObserverTitle>
                    <StatusDot $active={threadObserverActive} />
                    Thread Observer
                  </ObserverTitle>
                  <ObserverDescription>
                    Monitor thread creation, termination, and renaming
                  </ObserverDescription>
                </ObserverInfo>
                <Button
                  $variant={threadObserverActive ? 'danger' : 'primary'}
                  $size="sm"
                  onClick={handleToggleThreadObserver}
                  disabled={loading}
                >
                  {threadObserverActive ? <EyeOff size={14} /> : <Eye size={14} />}
                  {threadObserverActive ? 'Stop' : 'Start'}
                </Button>
              </ObserverCard>

              <ObserverCard $active={moduleObserverActive}>
                <ObserverInfo>
                  <ObserverTitle>
                    <StatusDot $active={moduleObserverActive} />
                    Module Observer
                  </ObserverTitle>
                  <ObserverDescription>
                    Monitor module loading and unloading
                  </ObserverDescription>
                </ObserverInfo>
                <Button
                  $variant={moduleObserverActive ? 'danger' : 'primary'}
                  $size="sm"
                  onClick={handleToggleModuleObserver}
                  disabled={loading}
                >
                  {moduleObserverActive ? <EyeOff size={14} /> : <Eye size={14} />}
                  {moduleObserverActive ? 'Stop' : 'Start'}
                </Button>
              </ObserverCard>

              <ObserverCard $active={exceptionHandlerActive}>
                <ObserverInfo>
                  <ObserverTitle>
                    <StatusDot $active={exceptionHandlerActive} />
                    Exception Handler
                  </ObserverTitle>
                  <ObserverDescription>
                    Capture native exceptions (cannot be disabled once enabled)
                  </ObserverDescription>
                </ObserverInfo>
                <Button
                  $variant={exceptionHandlerActive ? 'secondary' : 'primary'}
                  $size="sm"
                  onClick={handleToggleExceptionHandler}
                  disabled={loading || exceptionHandlerActive}
                >
                  <AlertTriangle size={14} />
                  {exceptionHandlerActive ? 'Active' : 'Enable'}
                </Button>
              </ObserverCard>
            </PanelSection>

            <PanelSection>
              <PanelSectionTitle>
                Events ({observerEvents.length})
                {observerEvents.length > 0 && (
                  <IconButton $size="sm" onClick={clearEvents} style={{ marginLeft: 'auto' }}>
                    <Trash2 size={12} />
                  </IconButton>
                )}
              </PanelSectionTitle>
              <EventList>
                <AnimatePresence>
                  {observerEvents.length > 0 ? (
                    observerEvents.slice().reverse().map((evt) => (
                      <EventItem
                        key={evt.id}
                        $type={evt.type}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        <Activity size={12} />
                        <span style={{ fontWeight: 500 }}>{evt.type}</span>
                        <span style={{ color: theme.colors.text.muted }}>
                          {JSON.stringify(evt.data).slice(0, 60)}...
                        </span>
                      </EventItem>
                    ))
                  ) : (
                    <EmptyState style={{ padding: theme.spacing.md }}>
                      No events yet. Start an observer to capture events.
                    </EmptyState>
                  )}
                </AnimatePresence>
              </EventList>
            </PanelSection>
          </>
        );

      case 'breakpoints':
        return (
          <>
            <PanelSection>
              <PanelSectionTitle>
                <Target size={14} />
                Hardware Breakpoints
              </PanelSectionTitle>
              <FormRow>
                <FormField>
                  <FormLabel>Address</FormLabel>
                  <Input
                    value={newBpAddress}
                    onChange={(e) => setNewBpAddress(e.target.value)}
                    placeholder="0x..."
                    style={{ fontFamily: 'Consolas, monospace' }}
                  />
                </FormField>
                <Button $variant="primary" $size="sm" onClick={handleAddBreakpoint}>
                  <Plus size={14} />
                  Add
                </Button>
              </FormRow>
            </PanelSection>

            <PanelSection>
              <PanelSectionTitle>
                <Crosshair size={14} />
                Hardware Watchpoints
              </PanelSectionTitle>
              <FormRow>
                <FormField>
                  <FormLabel>Address</FormLabel>
                  <Input
                    value={newWpAddress}
                    onChange={(e) => setNewWpAddress(e.target.value)}
                    placeholder="0x..."
                    style={{ fontFamily: 'Consolas, monospace' }}
                  />
                </FormField>
                <FormField style={{ maxWidth: 80 }}>
                  <FormLabel>Size</FormLabel>
                  <Input
                    type="number"
                    value={newWpSize}
                    onChange={(e) => setNewWpSize(e.target.value)}
                    min={1}
                    max={8}
                  />
                </FormField>
                <FormField style={{ maxWidth: 80 }}>
                  <FormLabel>Mode</FormLabel>
                  <select
                    value={newWpConditions}
                    onChange={(e) => setNewWpConditions(e.target.value as 'r' | 'w' | 'rw')}
                    style={{
                      padding: '6px 8px',
                      background: theme.colors.bg.secondary,
                      border: `1px solid ${theme.colors.border.primary}`,
                      borderRadius: theme.borderRadius.sm,
                      color: theme.colors.text.primary,
                      fontSize: theme.fontSize.sm,
                    }}
                  >
                    <option value="r">Read</option>
                    <option value="w">Write</option>
                    <option value="rw">R/W</option>
                  </select>
                </FormField>
                <Button $variant="primary" $size="sm" onClick={handleAddWatchpoint}>
                  <Plus size={14} />
                  Add
                </Button>
              </FormRow>
            </PanelSection>

            <PanelSection>
              <PanelSectionTitle>Active ({breakpoints.length})</PanelSectionTitle>
              <Table>
                <TableHead>
                  <tr>
                    <TableHeader $width="60px">ID</TableHeader>
                    <TableHeader $width="100px">Type</TableHeader>
                    <TableHeader>Address</TableHeader>
                    <TableHeader $width="80px">Mode</TableHeader>
                    <TableHeader $width="60px">Actions</TableHeader>
                  </tr>
                </TableHead>
                <TableBody>
                  {breakpoints.map((bp) => (
                    <TableRow key={bp.id}>
                      <TableCell>{bp.id}</TableCell>
                      <TableCell>
                        {bp.type === 'breakpoint' ? (
                          <span style={{ color: theme.colors.status.error }}>
                            <Target size={12} /> BP
                          </span>
                        ) : (
                          <span style={{ color: theme.colors.status.warning }}>
                            <Crosshair size={12} /> WP
                          </span>
                        )}
                      </TableCell>
                      <TableCell $mono>{bp.address}</TableCell>
                      <TableCell>{bp.conditions || '-'}</TableCell>
                      <TableCell>
                        <IconButton $size="sm" onClick={() => handleRemoveBreakpoint(bp)}>
                          <Trash2 size={12} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {breakpoints.length === 0 && (
                <EmptyState>
                  No breakpoints or watchpoints set
                </EmptyState>
              )}
            </PanelSection>
          </>
        );

      case 'exceptions':
        return (
          <PanelSection>
            <PanelSectionTitle>
              <AlertTriangle size={14} />
              Exception Events
            </PanelSectionTitle>
            <EventList style={{ maxHeight: 400 }}>
              {observerEvents.filter((e) => e.type === 'native_exception').length > 0 ? (
                observerEvents
                  .filter((e) => e.type === 'native_exception')
                  .slice()
                  .reverse()
                  .map((evt) => (
                    <EventItem key={evt.id} $type={evt.type}>
                      <AlertTriangle size={12} />
                      <span style={{ fontWeight: 500 }}>
                        {(evt.data as { type?: string }).type || 'exception'}
                      </span>
                      <span style={{ fontFamily: 'Consolas, monospace', color: theme.colors.text.accent }}>
                        {(evt.data as { address?: string }).address}
                      </span>
                    </EventItem>
                  ))
              ) : (
                <EmptyState style={{ padding: theme.spacing.md }}>
                  {exceptionHandlerActive
                    ? 'No exceptions captured yet'
                    : 'Enable exception handler in Observers tab to capture exceptions'}
                </EmptyState>
              )}
            </EventList>
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
      <Toolbar
        onRefresh={handleEnumerateThreads}
        refreshing={loading}
        totalCount={threads.length}
      >
        <Button $variant="primary" $size="sm" onClick={handleEnumerateThreads} disabled={loading}>
          <RefreshCw size={14} />
          Refresh
        </Button>
      </Toolbar>

      <TabContainer>
        <Tab $active={activeTab === 'threads'} onClick={() => setActiveTab('threads')}>
          <Layers size={12} />
          Threads
        </Tab>
        <Tab $active={activeTab === 'observers'} onClick={() => setActiveTab('observers')}>
          <Eye size={12} />
          Observers
        </Tab>
        <Tab $active={activeTab === 'breakpoints'} onClick={() => setActiveTab('breakpoints')}>
          <Target size={12} />
          Breakpoints
        </Tab>
        <Tab $active={activeTab === 'exceptions'} onClick={() => setActiveTab('exceptions')}>
          <AlertTriangle size={12} />
          Exceptions
        </Tab>
      </TabContainer>

      <PanelContent>
        {renderTabContent()}
      </PanelContent>
    </PanelContainer>
  );
}
