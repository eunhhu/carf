import { useState } from 'react';
import styled from '@emotion/styled';
import { Database, Search, Download, Upload } from 'lucide-react';
import { theme } from '../../styles';
import { PanelContainer, PanelContent, PanelSection, PanelSectionTitle } from '../common/Panel';
import { Button } from '../common/Button';
import { Input, InputGroup, Label, InputRow } from '../common/Input';

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

type MemoryPanelProps = {
  hasSession: boolean;
  onRpcCall: (method: string, params?: unknown) => Promise<unknown>;
};

export function MemoryPanel({ hasSession, onRpcCall }: MemoryPanelProps) {
  const [readAddress, setReadAddress] = useState('');
  const [readSize, setReadSize] = useState('64');
  const [hexDump, setHexDump] = useState<string | null>(null);
  
  const [writeAddress, setWriteAddress] = useState('');
  const [writeValue, setWriteValue] = useState('');
  
  const [searchPattern, setSearchPattern] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);

  const handleRead = async () => {
    if (!readAddress) return;
    setLoading(true);
    try {
      const result = await onRpcCall('read_memory', {
        address: readAddress,
        size: parseInt(readSize, 10),
      });
      if (typeof result === 'string') {
        setHexDump(result);
      } else if (result && typeof result === 'object' && 'hex' in result) {
        setHexDump((result as { hex: string }).hex);
      }
    } catch (e) {
      console.error('Failed to read memory:', e);
      setHexDump('Error reading memory');
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
      if (Array.isArray(result)) {
        setSearchResults(result.map(String));
      }
    } catch (e) {
      console.error('Failed to search memory:', e);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <PanelContainer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <PanelContent>
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
                onChange={(e) => setReadAddress(e.target.value)}
                placeholder="0x7fff12340000"
              />
            </InputGroup>
            <InputGroup style={{ marginTop: theme.spacing.sm }}>
              <Label>Size (bytes)</Label>
              <InputRow>
                <Input
                  value={readSize}
                  onChange={(e) => setReadSize(e.target.value)}
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
                onChange={(e) => setWriteAddress(e.target.value)}
                placeholder="0x7fff12340000"
              />
            </InputGroup>
            <InputGroup style={{ marginTop: theme.spacing.sm }}>
              <Label>Bytes (hex)</Label>
              <Input
                value={writeValue}
                onChange={(e) => setWriteValue(e.target.value)}
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

        {/* Memory Search */}
        <PanelSection style={{ marginTop: theme.spacing.md }}>
          <PanelSectionTitle>Memory Search</PanelSectionTitle>
          <MemoryCard>
            <InputGroup>
              <Label>Pattern (hex or string)</Label>
              <InputRow>
                <Input
                  value={searchPattern}
                  onChange={(e) => setSearchPattern(e.target.value)}
                  placeholder='48 8B ?? ?? or "hello"'
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
                {searchResults.map((r, i) => (
                  <div key={i}>{r}</div>
                ))}
              </ResultBox>
            )}
          </MemoryCard>
        </PanelSection>
      </PanelContent>
    </PanelContainer>
  );
}
