import { useState } from 'react';
import styled from '@emotion/styled';
import { Layers, Pause, RefreshCw } from 'lucide-react';
import { theme } from '../../styles';
import { PanelContainer, PanelContent, PanelSection, PanelSectionTitle } from '../common/Panel';
import { Button } from '../common/Button';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell, EmptyState } from '../common/Table';
import { Toolbar } from '../common/Toolbar';

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

type Thread = {
  id: number;
  state: string;
  context?: {
    pc: string;
    sp: string;
  };
};

type ThreadPanelProps = {
  hasSession: boolean;
  onRpcCall: (method: string, params?: unknown) => Promise<unknown>;
};

export function ThreadPanel({ hasSession, onRpcCall }: ThreadPanelProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<number | null>(null);
  const [backtrace, setBacktrace] = useState<Array<{ address: string; symbol?: string }>>([]);
  const [loading, setLoading] = useState(false);

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
      const result = await onRpcCall('get_backtrace', { thread_id: threadId });
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
          Enumerate Threads
        </Button>
      </Toolbar>

      <PanelContent>
        <PanelSection>
          <PanelSectionTitle>Threads</PanelSectionTitle>
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
              Click "Enumerate Threads" to list process threads
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
      </PanelContent>
    </PanelContainer>
  );
}
