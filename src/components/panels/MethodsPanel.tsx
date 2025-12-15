import { useState } from 'react';
import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import { Code, Play, Plus, Trash2 } from 'lucide-react';
import { theme } from '../../styles';
import { PanelContainer, PanelContent, PanelSection, PanelSectionTitle } from '../common/Panel';
import { Button, IconButton } from '../common/Button';
import { Input, InputGroup, Label, InputRow } from '../common/Input';

const HookList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
`;

const HookItem = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.md};
  background: ${theme.colors.bg.tertiary};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.md};
`;

const HookInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
`;

const HookTarget = styled.span`
  font-family: 'Consolas', monospace;
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.success};
`;

const HookType = styled.span`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
`;

const HookStatus = styled.span<{ $active: boolean }>`
  font-size: ${theme.fontSize.xs};
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  background: ${({ $active }) => ($active ? theme.colors.status.success : theme.colors.bg.hover)};
  color: ${({ $active }) => ($active ? 'white' : theme.colors.text.muted)};
  border-radius: ${theme.borderRadius.sm};
`;

const RpcSection = styled.div`
  padding: ${theme.spacing.md};
  background: ${theme.colors.bg.tertiary};
  border-radius: ${theme.borderRadius.md};
  border: 1px solid ${theme.colors.border.primary};
`;

const CodeEditor = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: ${theme.spacing.md};
  background: ${theme.colors.bg.primary};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.md};
  color: ${theme.colors.text.primary};
  font-family: 'Consolas', monospace;
  font-size: ${theme.fontSize.sm};
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: ${theme.colors.border.focus};
  }
`;

const ResultOutput = styled.pre`
  padding: ${theme.spacing.md};
  background: ${theme.colors.bg.primary};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.md};
  font-family: 'Consolas', monospace;
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.accent};
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
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

type Hook = {
  id: string;
  target: string;
  type: 'native' | 'java' | 'objc';
  active: boolean;
};

type MethodsPanelProps = {
  hasSession: boolean;
  onRpcCall: (method: string, params?: unknown) => Promise<unknown>;
};

export function MethodsPanel({ hasSession, onRpcCall }: MethodsPanelProps) {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [newHookTarget, setNewHookTarget] = useState('');
  const [rpcMethod, setRpcMethod] = useState('');
  const [rpcParams, setRpcParams] = useState('{}');
  const [rpcResult, setRpcResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAddHook = async () => {
    if (!newHookTarget) return;
    const newHook: Hook = {
      id: Date.now().toString(),
      target: newHookTarget,
      type: 'native',
      active: true,
    };
    setHooks([...hooks, newHook]);
    setNewHookTarget('');
    
    // TODO: Actually create hook via RPC
    try {
      await onRpcCall('hook_native', { target: newHookTarget });
    } catch (e) {
      console.error('Failed to create hook:', e);
    }
  };

  const handleRemoveHook = async (id: string) => {
    const hook = hooks.find((h) => h.id === id);
    if (hook) {
      try {
        await onRpcCall('unhook', { target: hook.target });
      } catch (e) {
        console.error('Failed to remove hook:', e);
      }
    }
    setHooks(hooks.filter((h) => h.id !== id));
  };

  const handleRpcCall = async () => {
    if (!rpcMethod) return;
    setLoading(true);
    setRpcResult(null);
    try {
      let params: unknown = undefined;
      if (rpcParams.trim()) {
        params = JSON.parse(rpcParams);
      }
      const result = await onRpcCall(rpcMethod, params);
      setRpcResult(JSON.stringify(result, null, 2));
    } catch (e) {
      setRpcResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!hasSession) {
    return (
      <PanelContainer>
        <PanelContent>
          <PlaceholderMessage>
            <Code size={48} strokeWidth={1} />
            <span>Attach to a process to manage hooks and RPC</span>
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
      <PanelContent>
        {/* RPC Console */}
        <PanelSection>
          <PanelSectionTitle>RPC Console</PanelSectionTitle>
          <RpcSection>
            <InputRow>
              <InputGroup style={{ flex: 1 }}>
                <Label>Method</Label>
                <Input
                  value={rpcMethod}
                  onChange={(e) => setRpcMethod(e.target.value)}
                  placeholder="get_arch"
                />
              </InputGroup>
            </InputRow>
            <InputGroup style={{ marginTop: theme.spacing.sm }}>
              <Label>Parameters (JSON)</Label>
              <CodeEditor
                value={rpcParams}
                onChange={(e) => setRpcParams(e.target.value)}
                placeholder='{"key": "value"}'
              />
            </InputGroup>
            <Button
              $variant="primary"
              $size="sm"
              onClick={handleRpcCall}
              disabled={loading || !rpcMethod}
              style={{ marginTop: theme.spacing.md }}
            >
              <Play size={14} />
              Execute
            </Button>
            {rpcResult && (
              <ResultOutput style={{ marginTop: theme.spacing.md }}>
                {rpcResult}
              </ResultOutput>
            )}
          </RpcSection>
        </PanelSection>

        {/* Hooks */}
        <PanelSection>
          <PanelSectionTitle>Active Hooks</PanelSectionTitle>
          <InputRow style={{ marginBottom: theme.spacing.md }}>
            <Input
              value={newHookTarget}
              onChange={(e) => setNewHookTarget(e.target.value)}
              placeholder="Module!Function or 0x12345678"
              style={{ flex: 1 }}
            />
            <Button
              $variant="primary"
              $size="sm"
              onClick={handleAddHook}
              disabled={!newHookTarget}
            >
              <Plus size={14} />
              Add Hook
            </Button>
          </InputRow>
          
          <HookList>
            {hooks.map((hook) => (
              <HookItem
                key={hook.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <HookInfo>
                  <HookTarget>{hook.target}</HookTarget>
                  <HookType>{hook.type}</HookType>
                </HookInfo>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                  <HookStatus $active={hook.active}>
                    {hook.active ? 'Active' : 'Inactive'}
                  </HookStatus>
                  <IconButton
                    $size="sm"
                    onClick={() => handleRemoveHook(hook.id)}
                    title="Remove hook"
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </HookItem>
            ))}
            {hooks.length === 0 && (
              <PlaceholderMessage style={{ height: 100 }}>
                No active hooks. Add a hook target above.
              </PlaceholderMessage>
            )}
          </HookList>
        </PanelSection>
      </PanelContent>
    </PanelContainer>
  );
}
