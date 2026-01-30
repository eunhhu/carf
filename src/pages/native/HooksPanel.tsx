import { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { Anchor, Plus, Trash2, Play, Pause, ListTree, X } from 'lucide-react';
import { theme } from '../../styles';
import {
  useHookStore,
  selectAllHooks,
  selectFilteredCallLogs,
  type HookEntry,
} from '../../stores/hookStore';
import { agentRpc } from '../../features/frida';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  EmptyState,
} from '../../components/ui/Table';
import {
  Toolbar,
  ToolbarSpacer,
} from '../../components/ui/Toolbar';
import { Button, IconButton } from '../../components/ui/Button';
import { Input, Select, Label, FormRow } from '../../components/ui/Input';
import { Flex, Text, Badge, Card } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';

// ============================================================================
// Types
// ============================================================================

interface HooksPanelProps {
  onRpcCall: (method: string, params?: unknown) => Promise<unknown>;
}

// ============================================================================
// Styles
// ============================================================================

const CallLogContainer = styled.div`
  max-height: 300px;
  overflow: auto;
  background: ${theme.colors.bg.primary};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.md};
  margin-top: ${theme.spacing.md};
`;

const CallLogEntry = styled.div<{ $type: 'enter' | 'leave' }>`
  display: flex;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  font-family: "SF Mono", "Consolas", monospace;
  font-size: ${theme.fontSize.xs};
  border-bottom: 1px solid ${theme.colors.border.primary};
  color: ${({ $type }) =>
    $type === 'enter' ? theme.colors.status.success : theme.colors.status.warning};

  &:last-child {
    border-bottom: none;
  }
`;

const LogTimestamp = styled.span`
  color: ${theme.colors.text.muted};
  min-width: 90px;
`;

const LogTarget = styled.span`
  color: ${theme.colors.text.accent};
  min-width: 120px;
`;

const LogData = styled.span`
  color: ${theme.colors.text.secondary};
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// ============================================================================
// Component
// ============================================================================

export function HooksPanel({ onRpcCall }: HooksPanelProps) {
  const {
    hooks,
    showCallLogs,
    addHook,
    removeHook,
    setEnabled,
    addCallLog,
    clearCallLogs,
    setShowCallLogs,
    setError,
  } = useHookStore();

  const allHooks = useHookStore(selectAllHooks);
  const callLogs = useHookStore(selectFilteredCallLogs);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTarget, setNewTarget] = useState('');
  const [newTargetType, setNewTargetType] = useState<'symbol' | 'address'>('symbol');
  const [newOnEnter, setNewOnEnter] = useState(true);
  const [newOnLeave, setNewOnLeave] = useState(true);
  const [loading, setLoading] = useState(false);

  // Subscribe to interceptor events
  useEffect(() => {
    const unsubscribe = agentRpc.onEvent((evt) => {
      if (evt.event === 'interceptor_enter' || evt.event === 'interceptor_leave') {
        const hookId = String(evt.hookId ?? '');
        if (!hookId) return;

        addCallLog({
          hookId,
          type: evt.event === 'interceptor_enter' ? 'enter' : 'leave',
          timestamp: Date.now(),
          threadId: typeof evt.threadId === 'number' ? evt.threadId : 0,
          args: evt.args as string[] | undefined,
          retval: evt.retval as string | undefined,
        });
      }
    });

    return () => unsubscribe();
  }, [addCallLog]);

  // Add a new hook
  const handleAddHook = useCallback(async () => {
    if (!newTarget) return;

    setLoading(true);
    try {
      // Call interceptor_attach on the agent
      const res = await onRpcCall('interceptor_attach', {
        target: newTarget,
        onEnter: newOnEnter,
        onLeave: newOnLeave,
      });

      const payload = res as {
        hookId: string;
        target: string;
        resolved?: string;
        moduleName?: string;
        symbolName?: string;
      };

      // Add to store
      addHook({
        target: newTarget,
        targetResolved: payload.resolved || payload.target,
        moduleName: payload.moduleName,
        symbolName: payload.symbolName,
        enabled: true,
        onEnter: newOnEnter,
        onLeave: newOnLeave,
      });

      // Reset form
      setNewTarget('');
      setShowAddModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [newTarget, newOnEnter, newOnLeave, onRpcCall, addHook, setError]);

  // Remove a hook
  const handleRemoveHook = useCallback(
    async (hook: HookEntry) => {
      setLoading(true);
      try {
        await onRpcCall('interceptor_detach', { hookId: hook.id });
        removeHook(hook.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [onRpcCall, removeHook, setError]
  );

  // Toggle hook enabled/disabled
  const handleToggleEnabled = useCallback(
    async (hook: HookEntry) => {
      setLoading(true);
      try {
        if (hook.enabled) {
          // Disable by detaching
          await onRpcCall('interceptor_detach', { hookId: hook.id });
        } else {
          // Re-enable by re-attaching
          await onRpcCall('interceptor_attach', {
            target: hook.target,
            onEnter: hook.onEnter,
            onLeave: hook.onLeave,
          });
        }
        setEnabled(hook.id, !hook.enabled);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [onRpcCall, setEnabled, setError]
  );

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
  };

  return (
    <>
      {/* Add Hook Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Hook"
        size="sm"
      >
        <FormRow style={{ marginBottom: 12 }}>
          <div style={{ width: 100 }}>
            <Label>Type</Label>
            <Select
              value={newTargetType}
              onChange={(e) => setNewTargetType(e.target.value as 'symbol' | 'address')}
              inputSize="sm"
            >
              <option value="symbol">Symbol</option>
              <option value="address">Address</option>
            </Select>
          </div>
          <div style={{ flex: 1 }}>
            <Label>{newTargetType === 'symbol' ? 'Symbol Name' : 'Address'}</Label>
            <Input
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder={newTargetType === 'symbol' ? 'e.g., malloc' : '0x...'}
              inputSize="sm"
            />
          </div>
        </FormRow>
        <FormRow style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={newOnEnter}
              onChange={(e) => setNewOnEnter(e.target.checked)}
            />
            <Text $size="sm">onEnter</Text>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={newOnLeave}
              onChange={(e) => setNewOnLeave(e.target.checked)}
            />
            <Text $size="sm">onLeave</Text>
          </label>
        </FormRow>
        <Flex $justify="end" $gap="8px">
          <Button variant="ghost" onClick={() => setShowAddModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAddHook}
            disabled={!newTarget || loading}
          >
            Add Hook
          </Button>
        </Flex>
      </Modal>

      {/* Toolbar */}
      <Toolbar>
        <Button
          size="sm"
          variant="primary"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={14} style={{ marginRight: 4 }} />
          Add Hook
        </Button>
        <ToolbarSpacer />
        <Button
          size="sm"
          variant={showCallLogs ? 'primary' : 'ghost'}
          onClick={() => setShowCallLogs(!showCallLogs)}
        >
          <ListTree size={14} style={{ marginRight: 4 }} />
          Call Log
          {callLogs.length > 0 && (
            <Badge $variant="default" style={{ marginLeft: 4 }}>
              {callLogs.length}
            </Badge>
          )}
        </Button>
        {showCallLogs && (
          <IconButton icon={X} size="sm" onClick={clearCallLogs} />
        )}
      </Toolbar>

      {/* Hooks Table */}
      {allHooks.length === 0 ? (
        <EmptyState>
          <Anchor size={32} />
          <Text $color="muted">No hooks active</Text>
          <Text $size="xs" $color="muted">
            Click "Add Hook" or right-click an export to hook a function
          </Text>
        </EmptyState>
      ) : (
        <Table size="sm" hoverable>
          <TableHead>
            <TableRow>
              <TableHeader width="200px">Target</TableHeader>
              <TableHeader width="120px">Module</TableHeader>
              <TableHeader width="80px" align="right">Calls</TableHeader>
              <TableHeader width="80px">Status</TableHeader>
              <TableHeader width="100px" align="center">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {allHooks.map((hook) => (
              <TableRow key={hook.id}>
                <TableCell mono truncate>
                  {hook.symbolName || hook.targetResolved}
                </TableCell>
                <TableCell truncate>
                  {hook.moduleName || '-'}
                </TableCell>
                <TableCell align="right" mono>
                  {hook.callCount}
                </TableCell>
                <TableCell>
                  <Badge $variant={hook.enabled ? 'success' : 'default'}>
                    {hook.enabled ? 'Active' : 'Paused'}
                  </Badge>
                </TableCell>
                <TableCell align="center">
                  <Flex $justify="center" $gap="4px">
                    <IconButton
                      icon={hook.enabled ? Pause : Play}
                      size="sm"
                      onClick={() => handleToggleEnabled(hook)}
                    />
                    <IconButton
                      icon={Trash2}
                      size="sm"
                      onClick={() => handleRemoveHook(hook)}
                    />
                  </Flex>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Call Log */}
      {showCallLogs && (
        <Card style={{ marginTop: theme.spacing.md }}>
          <Text $weight="semibold" style={{ marginBottom: theme.spacing.sm }}>
            Call Log ({callLogs.length} entries)
          </Text>
          {callLogs.length === 0 ? (
            <Text $color="muted" $size="sm">
              No calls logged yet. Hook a function and wait for it to be called.
            </Text>
          ) : (
            <CallLogContainer>
              {callLogs.map((log) => {
                const hook = hooks[log.hookId];
                return (
                  <CallLogEntry key={log.id} $type={log.type}>
                    <LogTimestamp>{formatTimestamp(log.timestamp)}</LogTimestamp>
                    <Badge $variant={log.type === 'enter' ? 'success' : 'warning'} style={{ minWidth: 50 }}>
                      {log.type}
                    </Badge>
                    <LogTarget>
                      {hook?.symbolName || hook?.target || log.hookId}
                    </LogTarget>
                    <LogData>
                      {log.type === 'enter' && log.args
                        ? `args: [${log.args.join(', ')}]`
                        : log.type === 'leave' && log.retval
                        ? `ret: ${log.retval}`
                        : ''}
                    </LogData>
                    <Text $size="xs" $color="muted">
                      T:{log.threadId}
                    </Text>
                  </CallLogEntry>
                );
              })}
            </CallLogContainer>
          )}
        </Card>
      )}
    </>
  );
}
