import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import styled from '@emotion/styled';
import {
  Search,
  Star,
  Trash2,
  Download,
  Upload,
  Copy,
  Tag,
  Bookmark,
  Code,
  Database,
  Hash,
  Box,
  Eye,
  Anchor,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { theme } from '../../styles';
import { IconButton } from '../ui/Button';
import { IconInput } from '../ui/Input';
import { ContextMenu, useContextMenu, type ContextMenuItemOrSeparator } from '../ui/ContextMenu';
import {
  useLibraryStore,
  type LibraryEntry,
  type LibraryEntryType,
} from '../../stores/libraryStore';
import {
  PanelHeader,
  PanelTitle,
  PanelActions,
} from '../ui/ResizablePanel';

// Type icons
const typeIcons: Record<LibraryEntryType, LucideIcon> = {
  function: Code,
  address: Hash,
  class: Box,
  symbol: Tag,
  module: Database,
  method: Code,
  memory_region: Database,
  watch: Eye,
  hook: Anchor,
};

// Styled components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${theme.colors.bg.secondary};
`;

const SearchBar = styled.div`
  padding: ${theme.spacing.sm};
  border-bottom: 1px solid ${theme.colors.border.primary};
`;

const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border-bottom: 1px solid ${theme.colors.border.primary};
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 0;
  }
`;

const FilterChip = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  padding: 2px ${theme.spacing.sm};
  background: ${({ $active }) =>
    $active ? theme.colors.accent.muted : 'transparent'};
  border: 1px solid
    ${({ $active }) =>
      $active ? theme.colors.accent.primary : theme.colors.border.primary};
  border-radius: ${theme.borderRadius.full};
  color: ${({ $active }) =>
    $active ? theme.colors.accent.primary : theme.colors.text.secondary};
  font-size: ${theme.fontSize.xs};
  cursor: pointer;
  white-space: nowrap;
  transition: all ${theme.transition.fast};

  &:hover {
    background: ${({ $active }) =>
      $active ? theme.colors.accent.muted : theme.colors.bg.hover};
  }
`;

const Content = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${theme.spacing.xs};
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: ${theme.spacing.xl};
  color: ${theme.colors.text.muted};
  text-align: center;
`;

const EmptyIcon = styled.div`
  margin-bottom: ${theme.spacing.md};
  opacity: 0.5;
`;

const EmptyText = styled.p`
  font-size: ${theme.fontSize.sm};
  margin: 0 0 ${theme.spacing.md};
`;

const EntryItem = styled.div<{ $selected?: boolean; $starred?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm};
  background: ${({ $selected }) =>
    $selected ? theme.colors.bg.selection : 'transparent'};
  border-radius: ${theme.borderRadius.md};
  cursor: pointer;
  transition: background ${theme.transition.fast};

  &:hover {
    background: ${({ $selected }) =>
      $selected ? theme.colors.bg.selection : theme.colors.bg.hover};
  }
`;

const EntryIcon = styled.span<{ $color?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: ${theme.borderRadius.sm};
  background: ${theme.colors.bg.tertiary};
  color: ${({ $color }) => $color || theme.colors.text.muted};
  flex-shrink: 0;
`;

const EntryInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const EntryName = styled.div`
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EntryMeta = styled.div`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'SF Mono', monospace;
`;

const StarButton = styled.button<{ $starred?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: transparent;
  border: none;
  color: ${({ $starred }) =>
    $starred ? theme.colors.status.warning : theme.colors.text.muted};
  cursor: pointer;
  opacity: ${({ $starred }) => ($starred ? 1 : 0)};
  transition: all ${theme.transition.fast};

  ${EntryItem}:hover & {
    opacity: 1;
  }

  &:hover {
    color: ${theme.colors.status.warning};
  }
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border-top: 1px solid ${theme.colors.border.primary};
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
`;

// Main component
export function LibraryPanel() {
  // Get individual state slices to avoid unnecessary re-renders
  const entries = useLibraryStore((state) => state.entries);
  const selectedIds = useLibraryStore((state) => state.selectedIds);
  const searchQuery = useLibraryStore((state) => state.searchQuery);
  const filterType = useLibraryStore((state) => state.filterType);
  const loading = useLibraryStore((state) => state.loading);
  const initialized = useLibraryStore((state) => state.initialized);
  const sortBy = useLibraryStore((state) => state.sortBy);
  const sortOrder = useLibraryStore((state) => state.sortOrder);
  const loadLibrary = useLibraryStore((state) => state.loadLibrary);
  const setSearchQuery = useLibraryStore((state) => state.setSearchQuery);
  const setFilterType = useLibraryStore((state) => state.setFilterType);
  const select = useLibraryStore((state) => state.select);
  const toggleStar = useLibraryStore((state) => state.toggleStar);
  const removeEntry = useLibraryStore((state) => state.removeEntry);
  const exportEntries = useLibraryStore((state) => state.exportEntries);
  const importEntries = useLibraryStore((state) => state.importEntries);

  // Compute filtered entries locally to avoid selector causing re-renders
  const filteredEntries = useMemo(() => {
    let result = Object.values(entries);

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter((e) => e.type === filterType);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.address?.toLowerCase().includes(query) ||
          e.module?.toLowerCase().includes(query) ||
          e.tags.some((t) => t.toLowerCase().includes(query)) ||
          e.notes?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
        case 'createdAt':
          cmp = a.createdAt - b.createdAt;
          break;
        case 'updatedAt':
          cmp = a.updatedAt - b.updatedAt;
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [entries, filterType, searchQuery, sortBy, sortOrder]);

  const { position, show: showContextMenu, hide: hideContextMenu } = useContextMenu();
  const [contextEntry, setContextEntry] = useState<LibraryEntry | null>(null);
  const loadLibraryRef = useRef(false);

  // Load library on mount (only once)
  useEffect(() => {
    if (!initialized && !loadLibraryRef.current) {
      loadLibraryRef.current = true;
      loadLibrary();
    }
  }, [initialized, loadLibrary]);

  // Filter types for chips
  const filterTypes: Array<{ type: LibraryEntryType | 'all'; label: string }> = [
    { type: 'all', label: 'All' },
    { type: 'function', label: 'Functions' },
    { type: 'address', label: 'Addresses' },
    { type: 'module', label: 'Modules' },
    { type: 'class', label: 'Classes' },
    { type: 'symbol', label: 'Symbols' },
  ];

  // Context menu items
  const getContextMenuItems = useCallback(
    (entry: LibraryEntry): ContextMenuItemOrSeparator[] => [
      {
        id: 'copy-address',
        label: 'Copy Address',
        icon: Copy,
        disabled: !entry.address,
        onSelect: () => {
          if (entry.address) {
            navigator.clipboard.writeText(entry.address);
          }
        },
      },
      {
        id: 'copy-name',
        label: 'Copy Name',
        icon: Copy,
        onSelect: () => {
          navigator.clipboard.writeText(entry.name);
        },
      },
      { type: 'separator' },
      {
        id: 'star',
        label: entry.starred ? 'Remove Star' : 'Add Star',
        icon: Star,
        onSelect: () => toggleStar(entry.id),
      },
      { type: 'separator' },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        danger: true,
        onSelect: () => removeEntry(entry.id),
      },
    ],
    [toggleStar, removeEntry]
  );

  // Handle entry click
  const handleEntryClick = (entry: LibraryEntry, e: React.MouseEvent) => {
    select(entry.id, e.metaKey || e.ctrlKey);
  };

  // Handle entry context menu
  const handleEntryContextMenu = (entry: LibraryEntry, e: React.MouseEvent) => {
    e.preventDefault();
    setContextEntry(entry);
    showContextMenu(e);
  };

  // Handle export
  const handleExport = () => {
    const data = exportEntries();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carf-library-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle import
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        const count = importEntries(text);
        console.log(`Imported ${count} entries`);
      }
    };
    input.click();
  };

  const entryCount = Object.keys(entries).length;

  return (
    <Container>
      <PanelHeader>
        <PanelTitle>Library</PanelTitle>
        <PanelActions>
          <IconButton
            icon={Download}
            size="xs"
            title="Export"
            onClick={handleExport}
            disabled={entryCount === 0}
          />
          <IconButton icon={Upload} size="xs" title="Import" onClick={handleImport} />
        </PanelActions>
      </PanelHeader>

      <SearchBar>
        <IconInput
          placeholder="Search library..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={Search}
          inputSize="sm"
        />
      </SearchBar>

      <FilterBar>
        {filterTypes.map(({ type, label }) => (
          <FilterChip
            key={type}
            $active={filterType === type}
            onClick={() => setFilterType(type)}
          >
            {label}
          </FilterChip>
        ))}
      </FilterBar>

      <Content>
        {loading ? (
          <EmptyState>
            <EmptyText>Loading...</EmptyText>
          </EmptyState>
        ) : filteredEntries.length === 0 ? (
          <EmptyState>
            <EmptyIcon>
              <Bookmark size={32} />
            </EmptyIcon>
            <EmptyText>
              {searchQuery || filterType !== 'all'
                ? 'No matching entries'
                : 'No saved entries yet'}
            </EmptyText>
            {!searchQuery && filterType === 'all' && (
              <EmptyText style={{ fontSize: theme.fontSize.xs }}>
                Right-click on items in other tabs to add them to your library
              </EmptyText>
            )}
          </EmptyState>
        ) : (
          filteredEntries.map((entry) => {
            const Icon = typeIcons[entry.type] || Hash;
            const isSelected = selectedIds.includes(entry.id);

            return (
              <EntryItem
                key={entry.id}
                $selected={isSelected}
                $starred={entry.starred}
                onClick={(e) => handleEntryClick(entry, e)}
                onContextMenu={(e) => handleEntryContextMenu(entry, e)}
              >
                <EntryIcon>
                  <Icon size={14} />
                </EntryIcon>
                <EntryInfo>
                  <EntryName>{entry.name}</EntryName>
                  {entry.address && <EntryMeta>{entry.address}</EntryMeta>}
                  {entry.module && !entry.address && (
                    <EntryMeta>{entry.module}</EntryMeta>
                  )}
                </EntryInfo>
                <StarButton
                  $starred={entry.starred}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStar(entry.id);
                  }}
                  title={entry.starred ? 'Remove star' : 'Add star'}
                >
                  <Star size={12} fill={entry.starred ? 'currentColor' : 'none'} />
                </StarButton>
              </EntryItem>
            );
          })
        )}
      </Content>

      <Footer>
        <span>{filteredEntries.length} items</span>
        {selectedIds.length > 0 && <span>{selectedIds.length} selected</span>}
      </Footer>

      {/* Context Menu */}
      {contextEntry && (
        <ContextMenu
          items={getContextMenuItems(contextEntry)}
          position={position}
          onClose={() => {
            hideContextMenu();
            setContextEntry(null);
          }}
        />
      )}
    </Container>
  );
}
