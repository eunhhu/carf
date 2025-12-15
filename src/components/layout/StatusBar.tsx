import styled from '@emotion/styled';
import { theme } from '../../styles';

const StatusBarContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: ${theme.statusBar.height};
  padding: 0 ${theme.spacing.lg};
  background: ${theme.colors.bg.secondary};
  border-top: 1px solid ${theme.colors.border.primary};
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
`;

const StatusSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.lg};
`;

const StatusItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
`;

const StatusValue = styled.span`
  color: ${theme.colors.text.primary};
`;

const StatusIndicator = styled.span<{ $status: 'idle' | 'ready' | 'busy' }>`
  color: ${({ $status }) => {
    switch ($status) {
      case 'ready': return theme.colors.status.success;
      case 'busy': return theme.colors.status.warning;
      default: return theme.colors.text.muted;
    }
  }};
`;

type StatusBarProps = {
  fridaVersion: string | null;
  deviceCount: number;
  processCount: number;
  sessionId: number | null;
  scriptId: number | null;
  busy: boolean;
};

export function StatusBar({
  fridaVersion,
  deviceCount,
  processCount,
  sessionId,
  busy,
}: StatusBarProps) {
  const isConnected = sessionId !== null;
  const status = busy ? 'busy' : isConnected ? 'ready' : 'idle';

  return (
    <StatusBarContainer>
      <StatusSection>
        <StatusItem>
          Devices: <StatusValue>{deviceCount}</StatusValue>
        </StatusItem>
        <StatusItem>
          Processes: <StatusValue>{processCount}</StatusValue>
        </StatusItem>
      </StatusSection>

      <StatusSection>
        <StatusIndicator $status={status}>
          {busy ? 'Working...' : isConnected ? 'Ready' : 'Idle'}
        </StatusIndicator>
        {fridaVersion && (
          <StatusItem>
            Frida <StatusValue>{fridaVersion}</StatusValue>
          </StatusItem>
        )}
      </StatusSection>
    </StatusBarContainer>
  );
}
