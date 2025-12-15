import styled from '@emotion/styled';
import { theme } from '../../styles';
import carfLogo from '../../assets/carf.svg';

const NavbarContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 44px;
  padding: 0 ${theme.spacing.lg};
  background: rgba(28, 28, 30, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid ${theme.colors.border.primary};
  flex-shrink: 0;
  -webkit-app-region: drag;
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.lg};
  -webkit-app-region: no-drag;
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  color: ${theme.colors.text.primary};
  font-weight: ${theme.fontWeight.semibold};
  font-size: ${theme.fontSize.md};
`;

const BrandLogo = styled.img`
  width: 24px;
  height: 24px;
`;

const AttachedBadge = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: 6px ${theme.spacing.md};
  background: rgba(48, 209, 88, 0.15);
  border-radius: ${theme.borderRadius.full};
  font-size: ${theme.fontSize.sm};
`;

const PulseDot = styled.div`
  width: 8px;
  height: 8px;
  background: ${theme.colors.status.success};
  border-radius: 50%;
  box-shadow: 0 0 8px ${theme.colors.status.success};
  animation: pulse 2s infinite;
  
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(0.9); }
  }
`;

const ProcessName = styled.span`
  font-weight: ${theme.fontWeight.medium};
  color: ${theme.colors.text.primary};
`;

const ProcessPid = styled.span`
  color: ${theme.colors.text.muted};
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: ${theme.fontSize.xs};
`;

const DeviceName = styled.span`
  color: ${theme.colors.text.muted};
  font-size: ${theme.fontSize.xs};
`;

const Separator = styled.span`
  color: ${theme.colors.border.secondary};
  margin: 0 2px;
`;

const DetachButton = styled.button`
  padding: 4px 10px;
  background: rgba(255, 69, 58, 0.15);
  border: none;
  border-radius: ${theme.borderRadius.full};
  color: ${theme.colors.status.error};
  font-size: ${theme.fontSize.xs};
  font-weight: ${theme.fontWeight.medium};
  cursor: pointer;
  margin-left: ${theme.spacing.sm};
  transition: all ${theme.transition.fast};
  
  &:hover {
    background: rgba(255, 69, 58, 0.25);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  -webkit-app-region: no-drag;
`;

const StatusText = styled.span`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
`;

type NavbarProps = {
  processName: string | null;
  processPid: number | null;
  deviceName: string | null;
  scriptId: number | null;
  busy: boolean;
  onDetach: () => void;
};

export function Navbar({
  processName,
  processPid,
  deviceName,
  scriptId,
  busy,
  onDetach,
}: NavbarProps) {
  const isAttached = processName !== null && processPid !== null;

  return (
    <NavbarContainer>
      <LeftSection>
        <Brand>
          <BrandLogo src={carfLogo} alt="CARF" />
          <span>CARF</span>
        </Brand>
      </LeftSection>

      <RightSection>
        {!isAttached ? (
          <StatusText>Not Connected</StatusText>
        ) : (
          <AttachedBadge>
            <PulseDot />
            <ProcessName>{processName}</ProcessName>
            <ProcessPid>({processPid})</ProcessPid>
            {deviceName && (
              <>
                <Separator>•</Separator>
                <DeviceName>{deviceName}</DeviceName>
              </>
            )}
            {scriptId !== null && (
              <>
                <Separator>•</Separator>
                <DeviceName>Script #{scriptId}</DeviceName>
              </>
            )}
            <DetachButton onClick={onDetach} disabled={busy}>
              Detach
            </DetachButton>
          </AttachedBadge>
        )}
      </RightSection>
    </NavbarContainer>
  );
}
