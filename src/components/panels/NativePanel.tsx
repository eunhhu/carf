import { useState } from 'react';
import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import { Cpu } from 'lucide-react';
import { theme } from '../../styles';
import { PanelContainer, PanelContent, PanelSection, PanelSectionTitle } from '../common/Panel';
import { Button } from '../common/Button';
import { Toolbar } from '../common/Toolbar';

const ModuleList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
`;

const ModuleItem = styled(motion.div)<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${({ $selected }) => ($selected ? theme.colors.bg.selection : theme.colors.bg.tertiary)};
  border-radius: ${theme.borderRadius.sm};
  cursor: pointer;
  
  &:hover {
    background: ${({ $selected }) => ($selected ? theme.colors.bg.selection : theme.colors.bg.hover)};
  }
`;

const ModuleName = styled.span`
  font-family: 'Consolas', monospace;
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.primary};
`;

const ModuleBase = styled.span`
  font-family: 'Consolas', monospace;
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.accent};
`;

const ModuleSize = styled.span`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
`;

const ExportList = styled.div`
  max-height: 300px;
  overflow: auto;
  background: ${theme.colors.bg.primary};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.md};
`;

const ExportItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border-bottom: 1px solid ${theme.colors.border.primary};
  font-size: ${theme.fontSize.xs};
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: ${theme.colors.bg.hover};
  }
`;

const ExportName = styled.span`
  font-family: 'Consolas', monospace;
  color: ${theme.colors.text.success};
`;

const ExportAddress = styled.span`
  font-family: 'Consolas', monospace;
  color: ${theme.colors.text.accent};
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

type NativePanelProps = {
  hasSession: boolean;
  onRpcCall: (method: string, params?: unknown) => Promise<unknown>;
};

export function NativePanel({ hasSession, onRpcCall }: NativePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [modules, setModules] = useState<Array<{ name: string; base: string; size: number }>>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [exports, setExports] = useState<Array<{ name: string; address: string }>>([]);
  const [loading, setLoading] = useState(false);

  const handleEnumerateModules = async () => {
    setLoading(true);
    try {
      const result = await onRpcCall('enumerate_modules');
      if (Array.isArray(result)) {
        setModules(result);
      }
    } catch (e) {
      console.error('Failed to enumerate modules:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectModule = async (moduleName: string) => {
    setSelectedModule(moduleName);
    setLoading(true);
    try {
      const result = await onRpcCall('enumerate_exports', { module: moduleName });
      if (Array.isArray(result)) {
        setExports(result);
      }
    } catch (e) {
      console.error('Failed to enumerate exports:', e);
      setExports([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredModules = modules.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!hasSession) {
    return (
      <PanelContainer>
        <PanelContent>
          <PlaceholderMessage>
            <Cpu size={48} strokeWidth={1} />
            <span>Attach to a process to view native modules</span>
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
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Filter modules..."
        onRefresh={handleEnumerateModules}
        refreshing={loading}
        totalCount={modules.length}
        filteredCount={filteredModules.length}
      >
        <Button $variant="primary" $size="sm" onClick={handleEnumerateModules} disabled={loading}>
          Enumerate Modules
        </Button>
      </Toolbar>

      <PanelContent>
        <PanelSection>
          <PanelSectionTitle>Loaded Modules</PanelSectionTitle>
          <ModuleList>
            {filteredModules.map((m) => (
              <ModuleItem
                key={m.name}
                $selected={selectedModule === m.name}
                onClick={() => handleSelectModule(m.name)}
                whileHover={{ x: 2 }}
              >
                <div>
                  <ModuleName>{m.name}</ModuleName>
                  <br />
                  <ModuleBase>{m.base}</ModuleBase>
                </div>
                <ModuleSize>{(m.size / 1024).toFixed(1)} KB</ModuleSize>
              </ModuleItem>
            ))}
            {filteredModules.length === 0 && modules.length === 0 && (
              <PlaceholderMessage style={{ height: 100 }}>
                Click "Enumerate Modules" to list loaded modules
              </PlaceholderMessage>
            )}
          </ModuleList>
        </PanelSection>

        {selectedModule && (
          <PanelSection>
            <PanelSectionTitle>Exports: {selectedModule}</PanelSectionTitle>
            <ExportList>
              {exports.map((e, i) => (
                <ExportItem key={i}>
                  <ExportName>{e.name}</ExportName>
                  <ExportAddress>{e.address}</ExportAddress>
                </ExportItem>
              ))}
              {exports.length === 0 && (
                <PlaceholderMessage style={{ height: 100 }}>
                  No exports found or still loading...
                </PlaceholderMessage>
              )}
            </ExportList>
          </PanelSection>
        )}
      </PanelContent>
    </PanelContainer>
  );
}
