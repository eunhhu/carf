import { useState } from 'react';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Code, 
  Play, 
  Crosshair, 
  FileCode, 
  Search,
  Zap,
} from 'lucide-react';
import { theme } from '../../styles';
import { PanelContainer, PanelContent, PanelSection, PanelSectionTitle } from '../common/Panel';
import { Button } from '../common/Button';
import { Input, InputGroup, Label, InputRow } from '../common/Input';

// Styled components
const TabContainer = styled.div`
  display: flex;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.sm};
  background: ${theme.colors.bg.tertiary};
  border-bottom: 1px solid ${theme.colors.border.primary};
`;

const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  background: ${({ $active }) => $active ? theme.colors.accent.muted : 'transparent'};
  color: ${({ $active }) => $active ? theme.colors.accent.primary : theme.colors.text.muted};
  border: none;
  border-radius: ${theme.borderRadius.md};
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
  transition: all ${theme.transition.fast};

  &:hover {
    background: ${({ $active }) => $active ? theme.colors.accent.muted : theme.colors.bg.hover};
    color: ${({ $active }) => $active ? theme.colors.accent.primary : theme.colors.text.primary};
  }
`;

const Card = styled.div`
  padding: ${theme.spacing.md};
  background: ${theme.colors.bg.tertiary};
  border-radius: ${theme.borderRadius.md};
  border: 1px solid ${theme.colors.border.primary};
  margin-bottom: ${theme.spacing.md};
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

const DisasmView = styled.div`
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: ${theme.fontSize.xs};
  background: ${theme.colors.bg.primary};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.md};
  overflow: auto;
  max-height: 400px;
`;

const DisasmRow = styled.div<{ $isFirst?: boolean }>`
  display: grid;
  grid-template-columns: 120px 100px 80px 1fr;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border-bottom: 1px solid ${theme.colors.border.primary};
  background: ${({ $isFirst }) => $isFirst ? 'rgba(10, 132, 255, 0.1)' : 'transparent'};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${theme.colors.bg.hover};
  }
`;

const DisasmAddress = styled.span`
  color: ${theme.colors.text.accent};
`;

const DisasmBytes = styled.span`
  color: ${theme.colors.text.muted};
  font-size: 10px;
`;

const DisasmMnemonic = styled.span`
  color: ${theme.colors.status.success};
  font-weight: 500;
`;

const DisasmOperands = styled.span`
  color: ${theme.colors.text.primary};
`;

const ResultBox = styled.div`
  padding: ${theme.spacing.md};
  background: ${theme.colors.bg.primary};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.md};
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: ${theme.fontSize.sm};
  word-break: break-all;
  max-height: 200px;
  overflow: auto;
`;

const FunctionInfoGrid = styled.div`
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: ${theme.spacing.xs} ${theme.spacing.md};
  font-size: ${theme.fontSize.sm};
`;

const InfoLabel = styled.span`
  color: ${theme.colors.text.muted};
`;

const InfoValue = styled.span`
  color: ${theme.colors.text.primary};
  font-family: 'SF Mono', 'Consolas', monospace;
`;

const HookList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
`;

const HookItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.bg.primary};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.sm};
`;

const HookTarget = styled.span`
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.accent};
`;

const HookBadge = styled.span`
  padding: 2px 8px;
  background: ${theme.colors.status.success};
  color: white;
  border-radius: ${theme.borderRadius.full};
  font-size: ${theme.fontSize.xs};
`;

const PlaceholderMessage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 150px;
  color: ${theme.colors.text.muted};
  text-align: center;
  gap: ${theme.spacing.sm};
`;

const ArgInputRow = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
  margin-bottom: ${theme.spacing.xs};
`;

const SmallInput = styled(Input)`
  flex: 1;
`;

const RemoveButton = styled.button`
  padding: ${theme.spacing.xs};
  background: transparent;
  border: none;
  color: ${theme.colors.status.error};
  cursor: pointer;
  
  &:hover {
    color: ${theme.colors.text.primary};
  }
`;

type TabType = 'disasm' | 'call' | 'hook' | 'info';

type NativeAdvancedPanelProps = {
  hasSession: boolean;
  onRpcCall: (method: string, params?: unknown) => Promise<unknown>;
};

export function NativeAdvancedPanel({ hasSession, onRpcCall }: NativeAdvancedPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('disasm');
  const [loading, setLoading] = useState(false);

  // Disassembly state
  const [disasmAddress, setDisasmAddress] = useState('');
  const [disasmCount, setDisasmCount] = useState('20');
  const [disasmResult, setDisasmResult] = useState<{
    instructions: Array<{
      address: string;
      mnemonic: string;
      opStr: string;
      bytes: string;
    }>;
  } | null>(null);

  // Function call state
  const [callAddress, setCallAddress] = useState('');
  const [callReturnType, setCallReturnType] = useState('pointer');
  const [callArgTypes, setCallArgTypes] = useState<string[]>([]);
  const [callArgs, setCallArgs] = useState<string[]>([]);
  const [callResult, setCallResult] = useState<string | null>(null);

  // Hook state
  const [hookTarget, setHookTarget] = useState('');
  const [activeHooks, setActiveHooks] = useState<Array<{ id: string; target: string }>>([]);

  // Function info state
  const [infoAddress, setInfoAddress] = useState('');
  const [functionInfo, setFunctionInfo] = useState<{
    address: string;
    name: string | null;
    moduleName: string | null;
    offset: number | null;
    protection: string | null;
    instructions: Array<{ address: string; mnemonic: string; opStr: string }>;
  } | null>(null);

  // Disassemble handler
  const handleDisassemble = async () => {
    if (!disasmAddress) return;
    setLoading(true);
    try {
      const result = await onRpcCall('disassemble', {
        address: disasmAddress,
        count: parseInt(disasmCount, 10),
      });
      setDisasmResult(result as typeof disasmResult);
    } catch (e) {
      console.error('Disassemble failed:', e);
    } finally {
      setLoading(false);
    }
  };

  // Function call handler
  const handleCallFunction = async () => {
    if (!callAddress) return;
    setLoading(true);
    try {
      const result = await onRpcCall('call_function', {
        address: callAddress,
        returnType: callReturnType,
        argTypes: callArgTypes,
        args: callArgs.map((a) => {
          // Try to parse as number if not hex address
          if (!a.startsWith('0x') && !isNaN(Number(a))) {
            return Number(a);
          }
          return a;
        }),
      });
      const data = result as { result: string };
      setCallResult(data.result);
    } catch (e) {
      console.error('Function call failed:', e);
      setCallResult(`Error: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // Hook handler
  const handleAttachHook = async () => {
    if (!hookTarget) return;
    setLoading(true);
    try {
      const result = await onRpcCall('interceptor_attach', {
        target: hookTarget,
        onEnter: true,
        onLeave: true,
      });
      const data = result as { id: string; target: string };
      setActiveHooks([...activeHooks, { id: data.id, target: data.target }]);
      setHookTarget('');
    } catch (e) {
      console.error('Hook attach failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDetachHook = async (id: string) => {
    setLoading(true);
    try {
      await onRpcCall('interceptor_detach', { id });
      setActiveHooks(activeHooks.filter((h) => h.id !== id));
    } catch (e) {
      console.error('Hook detach failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDetachAllHooks = async () => {
    setLoading(true);
    try {
      await onRpcCall('interceptor_detach_all');
      setActiveHooks([]);
    } catch (e) {
      console.error('Detach all failed:', e);
    } finally {
      setLoading(false);
    }
  };

  // Function info handler
  const handleGetFunctionInfo = async () => {
    if (!infoAddress) return;
    setLoading(true);
    try {
      const result = await onRpcCall('get_function_info', { address: infoAddress });
      setFunctionInfo(result as typeof functionInfo);
    } catch (e) {
      console.error('Get function info failed:', e);
    } finally {
      setLoading(false);
    }
  };

  // Add/remove arg helpers
  const addArg = () => {
    setCallArgTypes([...callArgTypes, 'pointer']);
    setCallArgs([...callArgs, '']);
  };

  const removeArg = (index: number) => {
    setCallArgTypes(callArgTypes.filter((_, i) => i !== index));
    setCallArgs(callArgs.filter((_, i) => i !== index));
  };

  const updateArgType = (index: number, type: string) => {
    const newTypes = [...callArgTypes];
    newTypes[index] = type;
    setCallArgTypes(newTypes);
  };

  const updateArgValue = (index: number, value: string) => {
    const newArgs = [...callArgs];
    newArgs[index] = value;
    setCallArgs(newArgs);
  };

  if (!hasSession) {
    return (
      <PanelContainer>
        <PanelContent>
          <PlaceholderMessage>
            <Code size={48} strokeWidth={1} />
            <span>Attach to a process to use advanced native features</span>
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
      <TabContainer>
        <Tab $active={activeTab === 'disasm'} onClick={() => setActiveTab('disasm')}>
          <FileCode size={14} />
          Disassembly
        </Tab>
        <Tab $active={activeTab === 'call'} onClick={() => setActiveTab('call')}>
          <Play size={14} />
          Call Function
        </Tab>
        <Tab $active={activeTab === 'hook'} onClick={() => setActiveTab('hook')}>
          <Crosshair size={14} />
          Hooks
        </Tab>
        <Tab $active={activeTab === 'info'} onClick={() => setActiveTab('info')}>
          <Search size={14} />
          Function Info
        </Tab>
      </TabContainer>

      <PanelContent>
        <AnimatePresence mode="wait">
          {/* Disassembly Tab */}
          {activeTab === 'disasm' && (
            <motion.div
              key="disasm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card>
                <CardTitle>
                  <FileCode size={16} />
                  Disassemble Address
                </CardTitle>
                <InputGroup>
                  <Label>Address</Label>
                  <InputRow>
                    <Input
                      value={disasmAddress}
                      onChange={(e) => setDisasmAddress(e.target.value)}
                      placeholder="0x7fff12340000 or symbol name"
                    />
                    <Input
                      value={disasmCount}
                      onChange={(e) => setDisasmCount(e.target.value)}
                      placeholder="Count"
                      style={{ width: 80 }}
                    />
                    <Button
                      $variant="primary"
                      $size="sm"
                      onClick={handleDisassemble}
                      disabled={loading || !disasmAddress}
                    >
                      Disasm
                    </Button>
                  </InputRow>
                </InputGroup>
              </Card>

              {disasmResult && disasmResult.instructions.length > 0 && (
                <DisasmView>
                  {disasmResult.instructions.map((insn, i) => (
                    <DisasmRow key={i} $isFirst={i === 0}>
                      <DisasmAddress>{insn.address}</DisasmAddress>
                      <DisasmBytes>{insn.bytes}</DisasmBytes>
                      <DisasmMnemonic>{insn.mnemonic}</DisasmMnemonic>
                      <DisasmOperands>{insn.opStr}</DisasmOperands>
                    </DisasmRow>
                  ))}
                </DisasmView>
              )}
            </motion.div>
          )}

          {/* Call Function Tab */}
          {activeTab === 'call' && (
            <motion.div
              key="call"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card>
                <CardTitle>
                  <Play size={16} />
                  Call Native Function
                </CardTitle>
                <InputGroup>
                  <Label>Function Address</Label>
                  <Input
                    value={callAddress}
                    onChange={(e) => setCallAddress(e.target.value)}
                    placeholder="0x7fff12340000"
                  />
                </InputGroup>
                <InputGroup style={{ marginTop: theme.spacing.sm }}>
                  <Label>Return Type</Label>
                  <Input
                    value={callReturnType}
                    onChange={(e) => setCallReturnType(e.target.value)}
                    placeholder="pointer, int, void, etc."
                    style={{ width: 150 }}
                  />
                </InputGroup>

                <PanelSectionTitle style={{ marginTop: theme.spacing.md }}>
                  Arguments
                </PanelSectionTitle>
                {callArgTypes.map((type, i) => (
                  <ArgInputRow key={i}>
                    <SmallInput
                      value={type}
                      onChange={(e) => updateArgType(i, e.target.value)}
                      placeholder="Type (pointer, int...)"
                      style={{ width: 120 }}
                    />
                    <SmallInput
                      value={callArgs[i] || ''}
                      onChange={(e) => updateArgValue(i, e.target.value)}
                      placeholder="Value (0x... or number)"
                    />
                    <RemoveButton onClick={() => removeArg(i)}>✕</RemoveButton>
                  </ArgInputRow>
                ))}
                <Button $variant="ghost" $size="sm" onClick={addArg}>
                  + Add Argument
                </Button>

                <div style={{ marginTop: theme.spacing.md }}>
                  <Button
                    $variant="danger"
                    $size="sm"
                    onClick={handleCallFunction}
                    disabled={loading || !callAddress}
                  >
                    <Zap size={14} />
                    Execute Call
                  </Button>
                </div>
              </Card>

              {callResult !== null && (
                <Card>
                  <CardTitle>Result</CardTitle>
                  <ResultBox>{callResult}</ResultBox>
                </Card>
              )}
            </motion.div>
          )}

          {/* Hooks Tab */}
          {activeTab === 'hook' && (
            <motion.div
              key="hook"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card>
                <CardTitle>
                  <Crosshair size={16} />
                  Attach Interceptor
                </CardTitle>
                <InputGroup>
                  <Label>Target (address or symbol)</Label>
                  <InputRow>
                    <Input
                      value={hookTarget}
                      onChange={(e) => setHookTarget(e.target.value)}
                      placeholder="0x7fff12340000 or malloc"
                    />
                    <Button
                      $variant="primary"
                      $size="sm"
                      onClick={handleAttachHook}
                      disabled={loading || !hookTarget}
                    >
                      Attach
                    </Button>
                  </InputRow>
                </InputGroup>
              </Card>

              <PanelSection>
                <PanelSectionTitle>
                  Active Hooks ({activeHooks.length})
                  {activeHooks.length > 0 && (
                    <Button
                      $variant="ghost"
                      $size="sm"
                      onClick={handleDetachAllHooks}
                      style={{ marginLeft: 'auto' }}
                    >
                      Detach All
                    </Button>
                  )}
                </PanelSectionTitle>
                <HookList>
                  {activeHooks.map((hook) => (
                    <HookItem key={hook.id}>
                      <div>
                        <HookTarget>{hook.target}</HookTarget>
                        <HookBadge style={{ marginLeft: theme.spacing.sm }}>Active</HookBadge>
                      </div>
                      <Button
                        $variant="ghost"
                        $size="sm"
                        onClick={() => handleDetachHook(hook.id)}
                      >
                        Detach
                      </Button>
                    </HookItem>
                  ))}
                  {activeHooks.length === 0 && (
                    <PlaceholderMessage style={{ height: 80 }}>
                      No active hooks
                    </PlaceholderMessage>
                  )}
                </HookList>
              </PanelSection>
            </motion.div>
          )}

          {/* Function Info Tab */}
          {activeTab === 'info' && (
            <motion.div
              key="info"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card>
                <CardTitle>
                  <Search size={16} />
                  Get Function Info
                </CardTitle>
                <InputGroup>
                  <Label>Address</Label>
                  <InputRow>
                    <Input
                      value={infoAddress}
                      onChange={(e) => setInfoAddress(e.target.value)}
                      placeholder="0x7fff12340000"
                    />
                    <Button
                      $variant="primary"
                      $size="sm"
                      onClick={handleGetFunctionInfo}
                      disabled={loading || !infoAddress}
                    >
                      Analyze
                    </Button>
                  </InputRow>
                </InputGroup>
              </Card>

              {functionInfo && (
                <Card>
                  <CardTitle>Function Details</CardTitle>
                  <FunctionInfoGrid>
                    <InfoLabel>Address:</InfoLabel>
                    <InfoValue>{functionInfo.address}</InfoValue>
                    
                    <InfoLabel>Name:</InfoLabel>
                    <InfoValue>{functionInfo.name || '(unknown)'}</InfoValue>
                    
                    <InfoLabel>Module:</InfoLabel>
                    <InfoValue>{functionInfo.moduleName || '(unknown)'}</InfoValue>
                    
                    <InfoLabel>Offset:</InfoLabel>
                    <InfoValue>
                      {functionInfo.offset !== null ? `0x${functionInfo.offset.toString(16)}` : '-'}
                    </InfoValue>
                    
                    <InfoLabel>Protection:</InfoLabel>
                    <InfoValue>{functionInfo.protection || '-'}</InfoValue>
                  </FunctionInfoGrid>

                  {functionInfo.instructions.length > 0 && (
                    <>
                      <PanelSectionTitle style={{ marginTop: theme.spacing.md }}>
                        First Instructions
                      </PanelSectionTitle>
                      <DisasmView style={{ maxHeight: 150 }}>
                        {functionInfo.instructions.map((insn, i) => (
                          <DisasmRow key={i} $isFirst={i === 0}>
                            <DisasmAddress>{insn.address}</DisasmAddress>
                            <DisasmBytes></DisasmBytes>
                            <DisasmMnemonic>{insn.mnemonic}</DisasmMnemonic>
                            <DisasmOperands>{insn.opStr}</DisasmOperands>
                          </DisasmRow>
                        ))}
                      </DisasmView>
                    </>
                  )}
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </PanelContent>
    </PanelContainer>
  );
}
