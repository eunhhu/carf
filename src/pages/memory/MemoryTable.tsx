import { useState, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { useShallow } from 'zustand/react/shallow';
import {
  Plus,
  Trash2,
  Snowflake,
  Sun,
  RefreshCw,
  Settings2,
  Bookmark,
} from 'lucide-react';
import { theme } from '../../styles';
import {
  useMemoryStore,
  type MemoryValueType,
  type MemoryTableEntry,
  VALUE_TYPE_LABELS,
} from '../../stores/memoryStore';
import { useLibraryStore } from '../../stores/libraryStore';
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
  ToolbarSearch,
} from '../../components/ui/Toolbar';
import { Button, IconButton } from '../../components/ui/Button';
import { Input, Select, Label, FormRow } from '../../components/ui/Input';
import { Flex, Text } from '../../components/ui/Layout';
import { EditableCell } from '../../components/ui/EditableCell';
import { Modal } from '../../components/ui/Modal';

// ============================================================================
// Types
// ============================================================================

interface MemoryTableProps {
  onRpcCall: (method: string, params?: unknown) => Promise<unknown>;
}

// ============================================================================
// Styles
// ============================================================================

const FreezeIconWrapper = styled.span<{ $active: boolean }>`
  cursor: pointer;
  display: inline-flex;
  color: ${({ $active }) =>
    $active ? theme.colors.accent.primary : theme.colors.text.muted};
  transition: color ${theme.transition.fast};

  &:hover {
    color: ${({ $active }) =>
      $active ? theme.colors.accent.secondary : theme.colors.text.primary};
  }
`;

const ValueCell = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  padding: 2px 4px;
  border-radius: ${theme.borderRadius.sm};
  font-family: "SF Mono", "Consolas", monospace;
  font-size: ${theme.fontSize.xs};
  background: ${({ $selected }) =>
    $selected ? `${theme.colors.accent.primary}20` : 'transparent'};
  cursor: pointer;
  min-width: 60px;

  &:hover {
    background: ${theme.colors.bg.hover};
  }
`;

const AddressCell = styled.span`
  font-family: "SF Mono", "Consolas", monospace;
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.accent};
`;

const ColumnToggle = styled.label`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  cursor: pointer;
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.secondary};

  input {
    accent-color: ${theme.colors.accent.primary};
  }
`;

const SettingsPanel = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm};
  background: ${theme.colors.bg.tertiary};
  border-radius: ${theme.borderRadius.md};
  margin-bottom: ${theme.spacing.md};
`;

// ============================================================================
// Component
// ============================================================================

export function MemoryTable({ onRpcCall }: MemoryTableProps) {
  const {
    entries,
    entryOrder,
    selectedIds,
    visibleColumns,
    searchQuery,
    showOnlyFrozen,
    showOnlyWatched,
    addEntry,
    removeEntry,
    removeEntries,
    updateValues,
    updatePrimaryType,
    updateDescription,
    setFrozen,
    updateFreezeValue,
    select,
    clearSelection,
    setSearchQuery,
    setColumnVisible,
  } = useMemoryStore(
    useShallow((s) => ({
      entries: s.entries,
      entryOrder: s.entryOrder,
      selectedIds: s.selectedIds,
      visibleColumns: s.visibleColumns,
      searchQuery: s.searchQuery,
      showOnlyFrozen: s.showOnlyFrozen,
      showOnlyWatched: s.showOnlyWatched,
      addEntry: s.addEntry,
      removeEntry: s.removeEntry,
      removeEntries: s.removeEntries,
      updateValues: s.updateValues,
      updatePrimaryType: s.updatePrimaryType,
      updateDescription: s.updateDescription,
      setFrozen: s.setFrozen,
      updateFreezeValue: s.updateFreezeValue,
      select: s.select,
      clearSelection: s.clearSelection,
      setSearchQuery: s.setSearchQuery,
      setColumnVisible: s.setColumnVisible,
    }))
  );

  // Compute filtered entries and visible column types with memoization
  const filteredEntries = useMemo((): MemoryTableEntry[] => {
    let result = entryOrder.map((id) => entries[id]).filter(Boolean);
    if (showOnlyFrozen) result = result.filter((e) => e.frozen);
    if (showOnlyWatched) result = result.filter((e) => e.watched);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.address.toLowerCase().includes(query) ||
          e.description.toLowerCase().includes(query) ||
          e.module?.toLowerCase().includes(query)
      );
    }
    return result;
  }, [entries, entryOrder, showOnlyFrozen, showOnlyWatched, searchQuery]);

  const visibleColumnTypes = useMemo((): MemoryValueType[] => {
    return (Object.entries(visibleColumns) as [MemoryValueType, boolean][])
      .filter(([, visible]) => visible)
      .map(([type]) => type);
  }, [visibleColumns]);

  const [showSettings, setShowSettings] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newType, setNewType] = useState<MemoryValueType>('u32');
  const [newDescription, setNewDescription] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Add entry from modal
  const handleAddEntry = useCallback(() => {
    if (!newAddress) return;
    addEntry(newAddress, newType, newDescription || newAddress);
    setNewAddress('');
    setNewDescription('');
    setShowAddModal(false);
  }, [newAddress, newType, newDescription, addEntry]);

  // Remove selected entries
  const handleRemoveSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    removeEntries(selectedIds);
    clearSelection();
  }, [selectedIds, removeEntries, clearSelection]);

  // Refresh all values
  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const entriesArray = Object.values(entries);
      await Promise.all(
        entriesArray.map(async (entry) => {
          const values: Partial<Record<MemoryValueType, string>> = {};

          // Read all visible types for each entry
          for (const vt of visibleColumnTypes) {
            try {
              const res = await onRpcCall('read_int', {
                address: entry.address,
                type: vt,
              });
              const payload = res as { value?: string };
              values[vt] = payload.value ?? '';
            } catch {
              values[vt] = '???';
            }
          }

          updateValues(entry.id, values);
        })
      );
    } finally {
      setRefreshing(false);
    }
  }, [entries, visibleColumnTypes, onRpcCall, updateValues]);

  // Toggle freeze for an entry
  const handleToggleFreeze = useCallback(
    async (entry: MemoryTableEntry) => {
      if (entry.frozen && entry.freezeId) {
        // Unfreeze
        try {
          await onRpcCall('memory_freeze_remove', { freezeId: entry.freezeId });
          setFrozen(entry.id, false);
        } catch (err) {
          console.error('Failed to unfreeze:', err);
        }
      } else {
        // Freeze with current value of primary type
        const currentValue = entry.values[entry.primaryType] || '0';
        try {
          const res = await onRpcCall('memory_freeze_add', {
            address: entry.address,
            valueType: entry.primaryType,
            value: currentValue,
            intervalMs: 100,
          });
          const payload = res as { freezeId: string };
          setFrozen(entry.id, true, payload.freezeId, currentValue);
        } catch (err) {
          console.error('Failed to freeze:', err);
        }
      }
    },
    [onRpcCall, setFrozen]
  );

  // Freeze all entries
  const handleFreezeAll = useCallback(async () => {
    const unfrozen = Object.values(entries).filter((e) => !e.frozen);
    for (const entry of unfrozen) {
      await handleToggleFreeze(entry);
    }
  }, [entries, handleToggleFreeze]);

  // Unfreeze all entries
  const handleUnfreezeAll = useCallback(async () => {
    const frozen = Object.values(entries).filter((e) => e.frozen);
    for (const entry of frozen) {
      await handleToggleFreeze(entry);
    }
  }, [entries, handleToggleFreeze]);

  // Edit value inline
  const handleEditValue = useCallback(
    async (entry: MemoryTableEntry, valueType: MemoryValueType, newValue: string) => {
      // Write the value
      await onRpcCall('write_int', {
        address: entry.address,
        type: valueType,
        value: newValue,
      });

      // Update local state
      updateValues(entry.id, { [valueType]: newValue });

      // If frozen and this is the primary type, update freeze value
      if (entry.frozen && valueType === entry.primaryType && entry.freezeId) {
        await onRpcCall('memory_freeze_update', {
          freezeId: entry.freezeId,
          value: newValue,
        });
        updateFreezeValue(entry.id, newValue);
      }
    },
    [onRpcCall, updateValues, updateFreezeValue]
  );

  // Add to library
  const handleAddToLibrary = useCallback(
    (entry: MemoryTableEntry) => {
      useLibraryStore.getState().addEntry({
        type: 'address',
        name: entry.description || entry.address,
        address: entry.address,
        module: entry.module,
        folderId: null,
        tags: ['memory'],
        starred: false,
        metadata: {
          valueType: entry.primaryType,
          offset: entry.offset,
        },
      });
    },
    []
  );

  // Row click handler
  const handleRowClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      select(id, e.metaKey || e.ctrlKey);
    },
    [select]
  );

  // Determine if a value type column is the primary (selected) one for an entry
  const isPrimaryType = (entry: MemoryTableEntry, vt: MemoryValueType) =>
    entry.primaryType === vt;

  const columnTypeOptions: MemoryValueType[] = [
    'u8',
    's8',
    'u16',
    's16',
    'u32',
    's32',
    'u64',
    's64',
    'float',
    'double',
  ];

  return (
    <>
      {/* Add Entry Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Memory Entry"
        size="sm"
      >
        <FormRow style={{ marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <Label>Address</Label>
            <Input
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="0x..."
              inputSize="sm"
            />
          </div>
        </FormRow>
        <FormRow style={{ marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <Label>Primary Type</Label>
            <Select
              value={newType}
              onChange={(e) => setNewType(e.target.value as MemoryValueType)}
              inputSize="sm"
            >
              {columnTypeOptions.map((vt) => (
                <option key={vt} value={vt}>
                  {VALUE_TYPE_LABELS[vt]}
                </option>
              ))}
            </Select>
          </div>
        </FormRow>
        <FormRow style={{ marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <Label>Description (optional)</Label>
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="e.g., Player HP"
              inputSize="sm"
            />
          </div>
        </FormRow>
        <Flex $justify="end" $gap="8px">
          <Button variant="ghost" onClick={() => setShowAddModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAddEntry} disabled={!newAddress}>
            Add
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
          Add
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRemoveSelected}
          disabled={selectedIds.length === 0}
        >
          <Trash2 size={14} style={{ marginRight: 4 }} />
          Remove
        </Button>
        <Button size="sm" variant="ghost" onClick={handleFreezeAll}>
          <Snowflake size={14} style={{ marginRight: 4 }} />
          Freeze All
        </Button>
        <Button size="sm" variant="ghost" onClick={handleUnfreezeAll}>
          <Sun size={14} style={{ marginRight: 4 }} />
          Unfreeze All
        </Button>
        <ToolbarSpacer />
        <ToolbarSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Filter..."
        />
        <IconButton
          icon={RefreshCw}
          onClick={handleRefreshAll}
          disabled={refreshing}
        />
        <IconButton
          icon={Settings2}
          onClick={() => setShowSettings(!showSettings)}
        />
      </Toolbar>

      {/* Column Settings */}
      {showSettings && (
        <SettingsPanel>
          <Text $size="xs" $weight="semibold" style={{ width: '100%' }}>
            Visible Columns:
          </Text>
          {columnTypeOptions.map((vt) => (
            <ColumnToggle key={vt}>
              <input
                type="checkbox"
                checked={visibleColumns[vt] ?? false}
                onChange={(e) => setColumnVisible(vt, e.target.checked)}
              />
              {VALUE_TYPE_LABELS[vt]}
            </ColumnToggle>
          ))}
        </SettingsPanel>
      )}

      {/* Table */}
      {filteredEntries.length === 0 ? (
        <EmptyState>
          <Snowflake size={32} />
          <Text $color="muted">No memory entries</Text>
          <Text $size="xs" $color="muted">
            Click "Add" to add addresses from scan results
          </Text>
        </EmptyState>
      ) : (
        <Table size="sm" hoverable>
          <TableHead>
            <TableRow>
              <TableHeader width="32px"></TableHeader>
              <TableHeader width="140px">Address</TableHeader>
              {visibleColumnTypes.map((vt) => (
                <TableHeader key={vt} width="90px" align="right">
                  {VALUE_TYPE_LABELS[vt].split(' ')[0]}
                </TableHeader>
              ))}
              <TableHeader>Description</TableHeader>
              <TableHeader width="80px" align="center">
                Actions
              </TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEntries.map((entry) => (
              <TableRow
                key={entry.id}
                selected={selectedIds.includes(entry.id)}
                onClick={(e) => handleRowClick(e, entry.id)}
              >
                <TableCell align="center">
                  <FreezeIconWrapper
                    $active={entry.frozen}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFreeze(entry);
                    }}
                  >
                    <Snowflake size={14} />
                  </FreezeIconWrapper>
                </TableCell>
                <TableCell>
                  <AddressCell>{entry.address}</AddressCell>
                </TableCell>
                {visibleColumnTypes.map((vt) => (
                  <TableCell key={vt} align="right">
                    <ValueCell
                      $selected={isPrimaryType(entry, vt)}
                      onClick={(e) => {
                        e.stopPropagation();
                        updatePrimaryType(entry.id, vt);
                      }}
                      title={`Click to set as primary type. Double-click to edit.`}
                    >
                      <EditableCell
                        value={entry.values[vt] || ''}
                        onSave={(val) => handleEditValue(entry, vt, val)}
                        placeholder="-"
                        monospace
                        highlight={isPrimaryType(entry, vt)}
                      />
                    </ValueCell>
                  </TableCell>
                ))}
                <TableCell>
                  <EditableCell
                    value={entry.description}
                    onSave={(val) => updateDescription(entry.id, val)}
                    placeholder="Click to add description"
                    monospace={false}
                  />
                </TableCell>
                <TableCell align="center">
                  <Flex $justify="center" $gap="4px">
                    <IconButton
                      icon={Bookmark}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToLibrary(entry);
                      }}
                      title="Add to Library"
                    />
                    <IconButton
                      icon={Trash2}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeEntry(entry.id);
                      }}
                      title="Remove"
                    />
                  </Flex>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
