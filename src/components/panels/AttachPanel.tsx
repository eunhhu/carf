import { useState, useMemo } from 'react';
import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import { 
  Play, 
  Search, 
  RefreshCw, 
  Smartphone, 
  Monitor, 
  Usb, 
  Wifi,
  Cpu,
  ChevronRight,
  Settings2,
} from 'lucide-react';
import { theme } from '../../styles';
import type { DeviceInfo, ProcessInfo } from '../../features/frida/types';

// Layout
const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: ${theme.colors.bg.primary};
  color: ${theme.colors.text.secondary};
  overflow: hidden;
`;

const MainContent = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`;

// Sidebar - Devices Panel (fixed width to prevent resize issues)
const DevicesSidebar = styled.div`
  width: 280px;
  min-width: 280px;
  max-width: 280px;
  background: ${theme.colors.bg.secondary};
  border-right: 1px solid ${theme.colors.border.primary};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
`;

const SidebarHeader = styled.div`
  padding: ${theme.spacing.md};
  border-bottom: 1px solid ${theme.colors.border.primary};
`;

const SectionLabel = styled.div`
  font-size: ${theme.fontSize.xs};
  font-weight: ${theme.fontWeight.semibold};
  color: ${theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: ${theme.spacing.sm};
`;

const SearchRow = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
`;

const SearchInputWrapper = styled.div`
  position: relative;
  flex: 1;
`;

const SearchIcon = styled(Search)`
  position: absolute;
  left: ${theme.spacing.sm};
  top: 50%;
  transform: translateY(-50%);
  color: ${theme.colors.text.muted};
  pointer-events: none;
`;

const SearchInput = styled.input`
  width: 100%;
  background: ${theme.colors.bg.input};
  color: ${theme.colors.text.primary};
  border: 1px solid ${theme.colors.border.secondary};
  border-radius: ${theme.borderRadius.md};
  padding: ${theme.spacing.sm} ${theme.spacing.sm} ${theme.spacing.sm} 28px;
  font-size: ${theme.fontSize.sm};
  transition: border-color ${theme.transition.fast};
  
  &::placeholder {
    color: ${theme.colors.text.muted};
  }
  
  &:focus {
    outline: none;
    border-color: ${theme.colors.accent.primary};
  }
`;

const IconBtn = styled(motion.button)`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid ${theme.colors.border.secondary};
  border-radius: ${theme.borderRadius.md};
  color: ${theme.colors.text.secondary};
  cursor: pointer;
  transition: all ${theme.transition.fast};
  
  &:hover:not(:disabled) {
    background: ${theme.colors.bg.tertiary};
    color: ${theme.colors.text.primary};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const DeviceList = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const DeviceItem = styled(motion.button)<{ $selected: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.md};
  background: transparent;
  border: none;
  border-bottom: 1px solid ${theme.colors.border.primary};
  border-left: 2px solid ${({ $selected }) => $selected ? theme.colors.accent.primary : 'transparent'};
  cursor: pointer;
  transition: all ${theme.transition.fast};
  text-align: left;
  
  ${({ $selected }) => $selected && `
    background: ${theme.colors.accent.muted};
  `}
  
  &:hover {
    background: ${theme.colors.bg.tertiary};
  }
`;

const DeviceIcon = styled.div<{ $selected: boolean }>`
  color: ${({ $selected }) => $selected ? theme.colors.accent.primary : theme.colors.text.muted};
`;

const DeviceInfo_ = styled.div`
  flex: 1;
  min-width: 0;
`;

const DeviceName = styled.div<{ $selected: boolean }>`
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  color: ${({ $selected }) => $selected ? theme.colors.text.primary : theme.colors.text.secondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DeviceType = styled.div`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
  text-transform: capitalize;
`;

// Main Panel - Processes
const ProcessPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: ${theme.colors.bg.primary};
  overflow: hidden;
`;

const ProcessHeader = styled.div`
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  border-bottom: 1px solid ${theme.colors.border.primary};
  background: ${theme.colors.bg.secondary};
`;

const ProcessHeaderTitle = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.spacing.sm};
`;

const ProcessTitle = styled.span`
  font-size: ${theme.fontSize.xs};
  font-weight: ${theme.fontWeight.semibold};
  color: ${theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const OptionsBtn = styled(motion.button)<{ $active: boolean }>`
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  font-size: ${theme.fontSize.xs};
  border-radius: ${theme.borderRadius.md};
  border: 1px solid ${({ $active }) => $active ? theme.colors.accent.primary : theme.colors.border.secondary};
  background: ${({ $active }) => $active ? theme.colors.accent.primary : 'transparent'};
  color: ${({ $active }) => $active ? 'white' : theme.colors.text.secondary};
  cursor: pointer;
  transition: all ${theme.transition.fast};
  
  &:hover {
    background: ${({ $active }) => $active ? theme.colors.accent.hover : theme.colors.bg.tertiary};
  }
`;

const OptionsPanel = styled(motion.div)`
  margin-top: ${theme.spacing.md};
  padding: ${theme.spacing.md};
  background: ${theme.colors.bg.input};
  border: 1px solid ${theme.colors.border.secondary};
  border-radius: ${theme.borderRadius.md};
`;

const OptionRow = styled.label`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.secondary};
  cursor: pointer;
  margin-bottom: ${theme.spacing.sm};
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const Checkbox = styled.input`
  width: 14px;
  height: 14px;
  accent-color: ${theme.colors.accent.primary};
`;

const ProcessTable = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${theme.fontSize.sm};
`;

const TableHead = styled.thead`
  position: sticky;
  top: 0;
  background: ${theme.colors.bg.secondary};
  border-bottom: 1px solid ${theme.colors.border.primary};
  z-index: 1;
`;

const Th = styled.th<{ $align?: 'left' | 'right' }>`
  text-align: ${({ $align = 'left' }) => $align};
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  font-size: ${theme.fontSize.xs};
  font-weight: ${theme.fontWeight.semibold};
  color: ${theme.colors.text.muted};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const Tr = styled(motion.tr)<{ $selected?: boolean; $attached?: boolean }>`
  border-bottom: 1px solid ${theme.colors.border.primary};
  cursor: pointer;
  transition: background ${theme.transition.fast};
  
  ${({ $selected }) => $selected && `
    background: ${theme.colors.bg.tertiary};
  `}
  
  ${({ $attached }) => $attached && `
    background: ${theme.colors.status.successBg};
  `}
  
  &:hover {
    background: ${theme.colors.bg.secondary};
  }
`;

const Td = styled.td<{ $mono?: boolean; $align?: 'left' | 'right' }>`
  text-align: ${({ $align = 'left' }) => $align};
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  color: ${theme.colors.text.primary};
  
  ${({ $mono }) => $mono && `
    font-family: 'SF Mono', 'Consolas', monospace;
    color: ${theme.colors.text.muted};
  `}
`;

const AttachBtn = styled(motion.button)`
  display: inline-flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  background: ${theme.colors.accent.primary};
  color: white;
  border: none;
  border-radius: ${theme.borderRadius.md};
  font-size: ${theme.fontSize.xs};
  font-weight: ${theme.fontWeight.medium};
  cursor: pointer;
  transition: background ${theme.transition.fast};
  
  &:hover {
    background: ${theme.colors.accent.hover};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const AttachedBadge = styled.span`
  font-size: ${theme.fontSize.xs};
  font-weight: ${theme.fontWeight.semibold};
  color: ${theme.colors.status.success};
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${theme.colors.text.muted};
  text-align: center;
  padding: ${theme.spacing.xxl};
`;

const EmptyIcon = styled.div`
  opacity: 0.3;
  margin-bottom: ${theme.spacing.lg};
`;

// Attached Process Banner
const AttachedBanner = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.status.successBg};
  border: 1px solid ${theme.colors.status.success};
  border-radius: ${theme.borderRadius.md};
  margin: ${theme.spacing.md};
`;

const PulseDot = styled.div`
  width: 8px;
  height: 8px;
  background: ${theme.colors.status.success};
  border-radius: 50%;
  animation: pulse 2s infinite;
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const AttachedName = styled.span`
  font-weight: ${theme.fontWeight.medium};
  color: ${theme.colors.status.success};
`;

const AttachedPid = styled.span`
  color: ${theme.colors.text.muted};
  font-family: 'SF Mono', 'Consolas', monospace;
`;

const DetachBtn = styled.button`
  margin-left: auto;
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  background: transparent;
  border: none;
  color: ${theme.colors.status.error};
  font-size: ${theme.fontSize.xs};
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
  }
`;

// Helper to get device icon
function getDeviceIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'local': return Monitor;
    case 'usb': return Usb;
    case 'remote': return Wifi;
    default: return Smartphone;
  }
}

type AttachPanelProps = {
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
  onResume: (pid: number) => void;
  onKill: (pid: number) => void;
};

export function AttachPanel({
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
}: AttachPanelProps) {
  const [deviceSearch, setDeviceSearch] = useState('');
  const [processSearch, setProcessSearch] = useState('');
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState({
    spawn: false,
    persist: false,
    realm: 'native',
  });

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);
  const isAttached = sessionId !== null;
  
  // Find attached process info
  const attachedProcess = isAttached && selectedPid 
    ? processes.find(p => p.pid === selectedPid)
    : null;

  const filteredDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(d => 
      d.name.toLowerCase().includes(q) || d.device_type.toLowerCase().includes(q)
    );
  }, [deviceSearch, devices]);

  const filteredProcesses = useMemo(() => {
    const q = processSearch.trim().toLowerCase();
    if (!q) return processes;
    return processes.filter(p => 
      `${p.pid} ${p.name}`.toLowerCase().includes(q)
    );
  }, [processSearch, processes]);

  const handleAttach = (pid: number) => {
    setSelectedPid(pid);
    onAttach(pid);
  };

  return (
    <Container>
      <MainContent>
        {/* Devices Sidebar */}
        <DevicesSidebar>
          <SidebarHeader>
            <SectionLabel>Devices</SectionLabel>
            <SearchRow>
              <SearchInputWrapper>
                <SearchIcon size={14} />
                <SearchInput
                  type="text"
                  placeholder="Search devices..."
                  value={deviceSearch}
                  onChange={(e) => setDeviceSearch(e.target.value)}
                />
              </SearchInputWrapper>
              <IconBtn
                onClick={onRefreshDevices}
                disabled={busy}
                whileTap={{ scale: 0.95 }}
                title="Refresh devices"
              >
                <RefreshCw size={14} />
              </IconBtn>
            </SearchRow>
          </SidebarHeader>

          <DeviceList>
            {filteredDevices.map((device) => {
              const Icon = getDeviceIcon(device.device_type);
              const isSelected = selectedDeviceId === device.id;
              return (
                <DeviceItem
                  key={device.id}
                  $selected={isSelected}
                  onClick={() => onDeviceChange(device.id)}
                  whileTap={{ scale: 0.98 }}
                >
                  <DeviceIcon $selected={isSelected}>
                    <Icon size={16} />
                  </DeviceIcon>
                  <DeviceInfo_>
                    <DeviceName $selected={isSelected}>{device.name}</DeviceName>
                    <DeviceType>{device.device_type}</DeviceType>
                  </DeviceInfo_>
                  {isSelected && <ChevronRight size={14} color={theme.colors.text.muted} />}
                </DeviceItem>
              );
            })}
          </DeviceList>
        </DevicesSidebar>

        {/* Processes Panel */}
        <ProcessPanel>
          {selectedDevice ? (
            <>
              {/* Attached Banner - simplified, script managed automatically */}
              {isAttached && attachedProcess && (
                <AttachedBanner
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <PulseDot />
                  <AttachedName>{attachedProcess.name}</AttachedName>
                  <AttachedPid>({attachedProcess.pid})</AttachedPid>
                  <span style={{ color: theme.colors.text.muted }}>•</span>
                  <span style={{ color: theme.colors.text.muted, fontSize: theme.fontSize.xs }}>
                    {selectedDevice.name}
                  </span>
                  {scriptId !== null && (
                    <>
                      <span style={{ color: theme.colors.text.muted }}>•</span>
                      <span style={{ color: theme.colors.accent.primary, fontSize: theme.fontSize.xs }}>
                        Agent Ready
                      </span>
                    </>
                  )}
                  <DetachBtn onClick={onDetach} disabled={busy}>
                    Detach
                  </DetachBtn>
                </AttachedBanner>
              )}

              <ProcessHeader>
                <ProcessHeaderTitle>
                  <ProcessTitle>Processes - {selectedDevice.name}</ProcessTitle>
                </ProcessHeaderTitle>
                <SearchRow>
                  <SearchInputWrapper>
                    <SearchIcon size={14} />
                    <SearchInput
                      type="text"
                      placeholder="Search by name or PID..."
                      value={processSearch}
                      onChange={(e) => setProcessSearch(e.target.value)}
                    />
                  </SearchInputWrapper>
                  <IconBtn
                    onClick={onRefreshProcesses}
                    disabled={busy}
                    whileTap={{ scale: 0.95 }}
                    title="Refresh processes"
                  >
                    <RefreshCw size={14} />
                  </IconBtn>
                  <OptionsBtn
                    $active={showOptions}
                    onClick={() => setShowOptions(!showOptions)}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Settings2 size={12} style={{ marginRight: 4 }} />
                    Options
                  </OptionsBtn>
                </SearchRow>

                {showOptions && (
                  <OptionsPanel
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <SectionLabel style={{ marginBottom: theme.spacing.sm }}>Attach Options</SectionLabel>
                    <OptionRow>
                      <Checkbox
                        type="checkbox"
                        checked={options.spawn}
                        onChange={(e) => setOptions({ ...options, spawn: e.target.checked })}
                      />
                      <span>Spawn mode</span>
                    </OptionRow>
                    <OptionRow>
                      <Checkbox
                        type="checkbox"
                        checked={options.persist}
                        onChange={(e) => setOptions({ ...options, persist: e.target.checked })}
                      />
                      <span>Persist across restarts</span>
                    </OptionRow>
                    <OptionRow>
                      <span>Realm:</span>
                      <select
                        value={options.realm}
                        onChange={(e) => setOptions({ ...options, realm: e.target.value })}
                        style={{
                          background: theme.colors.bg.secondary,
                          color: theme.colors.text.primary,
                          border: `1px solid ${theme.colors.border.secondary}`,
                          borderRadius: theme.borderRadius.sm,
                          padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                          fontSize: theme.fontSize.xs,
                          marginLeft: theme.spacing.sm,
                        }}
                      >
                        <option value="native">Native</option>
                        <option value="emulated">Emulated</option>
                      </select>
                    </OptionRow>
                  </OptionsPanel>
                )}
              </ProcessHeader>

              <ProcessTable>
                <Table>
                  <TableHead>
                    <tr>
                      <Th>PID</Th>
                      <Th>Process Name</Th>
                      <Th $align="right">Action</Th>
                    </tr>
                  </TableHead>
                  <tbody>
                    {filteredProcesses.map((process) => {
                      const isSelected = selectedPid === process.pid;
                      const isProcessAttached = isAttached && selectedPid === process.pid;
                      return (
                        <Tr
                          key={process.pid}
                          $selected={isSelected}
                          $attached={isProcessAttached}
                          onClick={() => setSelectedPid(process.pid)}
                          whileTap={{ scale: 0.995 }}
                        >
                          <Td $mono>{process.pid}</Td>
                          <Td>{process.name}</Td>
                          <Td $align="right">
                            {isProcessAttached ? (
                              <AttachedBadge>ATTACHED</AttachedBadge>
                            ) : isSelected && !isAttached ? (
                              <AttachBtn
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAttach(process.pid);
                                }}
                                disabled={busy}
                                whileTap={{ scale: 0.95 }}
                              >
                                <Play size={12} />
                                Attach
                              </AttachBtn>
                            ) : null}
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>

                {filteredProcesses.length === 0 && (
                  <EmptyState>
                    <EmptyIcon>
                      <Cpu size={48} />
                    </EmptyIcon>
                    <p>No processes found</p>
                  </EmptyState>
                )}
              </ProcessTable>
            </>
          ) : (
            <EmptyState>
              <EmptyIcon>
                <Cpu size={48} />
              </EmptyIcon>
              <p>Select a device to view processes</p>
            </EmptyState>
          )}
        </ProcessPanel>
      </MainContent>
    </Container>
  );
}
