import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Command,
  ArrowRight,
  Cpu,
  Database,
  Settings,
  Terminal,
  LayoutGrid,
  BookOpen,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { theme } from '../../styles';
import { useLayoutStore } from '../../stores/layoutStore';

// Types
export interface CommandItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  icon?: LucideIcon;
  shortcut?: string;
  keywords?: string[];
  action: () => void | Promise<void>;
}

// Category icons
const categoryIcons: Record<string, LucideIcon> = {
  Navigation: LayoutGrid,
  Memory: Database,
  Native: Cpu,
  Actions: ArrowRight,
  Tools: Terminal,
  Settings: Settings,
  Library: BookOpen,
};

// Styled components
const Overlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
`;

const Container = styled(motion.div)`
  width: 560px;
  max-width: 90vw;
  max-height: 70vh;
  background: ${theme.colors.bg.elevated};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.xl};
  box-shadow: ${theme.shadow.lg};
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const SearchWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.md};
  border-bottom: 1px solid ${theme.colors.border.primary};
`;

const SearchIcon = styled.span`
  display: flex;
  align-items: center;
  color: ${theme.colors.text.muted};
`;

const SearchInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: ${theme.colors.text.primary};
  font-size: ${theme.fontSize.lg};

  &::placeholder {
    color: ${theme.colors.text.muted};
  }
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: ${theme.colors.bg.tertiary};
  border: none;
  border-radius: ${theme.borderRadius.sm};
  color: ${theme.colors.text.muted};
  cursor: pointer;
  transition: all ${theme.transition.fast};

  &:hover {
    background: ${theme.colors.bg.hover};
    color: ${theme.colors.text.primary};
  }
`;

const ResultsWrapper = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${theme.spacing.sm} 0;
`;

const CategoryHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  color: ${theme.colors.text.muted};
  font-size: ${theme.fontSize.xs};
  font-weight: ${theme.fontWeight.medium};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ResultItem = styled.div<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  cursor: pointer;
  background: ${({ $selected }) =>
    $selected ? theme.colors.bg.selection : 'transparent'};
  transition: background ${theme.transition.fast};

  &:hover {
    background: ${({ $selected }) =>
      $selected ? theme.colors.bg.selection : theme.colors.bg.hover};
  }
`;

const ResultIcon = styled.span<{ $color?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${theme.borderRadius.md};
  background: ${theme.colors.bg.tertiary};
  color: ${({ $color }) => $color || theme.colors.text.muted};
  flex-shrink: 0;
`;

const ResultContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ResultTitle = styled.div`
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.primary};
`;

const ResultDescription = styled.div`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ResultShortcut = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
`;

const KeyBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 ${theme.spacing.xs};
  background: ${theme.colors.bg.tertiary};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.sm};
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
  font-family: 'SF Mono', monospace;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing.xxl};
  color: ${theme.colors.text.muted};
  text-align: center;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-top: 1px solid ${theme.colors.border.primary};
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
`;

const FooterHints = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
`;

const FooterHint = styled.span`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
`;

// Fuzzy search helper
function fuzzyMatch(text: string, query: string): boolean {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }

  return queryIndex === queryLower.length;
}

function scoreMatch(item: CommandItem, query: string): number {
  const queryLower = query.toLowerCase();
  let score = 0;

  // Exact title match
  if (item.title.toLowerCase() === queryLower) score += 100;
  // Title starts with query
  else if (item.title.toLowerCase().startsWith(queryLower)) score += 80;
  // Title contains query
  else if (item.title.toLowerCase().includes(queryLower)) score += 60;
  // Fuzzy match on title
  else if (fuzzyMatch(item.title, query)) score += 40;

  // Description match
  if (item.description?.toLowerCase().includes(queryLower)) score += 20;

  // Keyword match
  if (item.keywords?.some((k) => k.toLowerCase().includes(queryLower))) {
    score += 30;
  }

  // Category match
  if (item.category.toLowerCase().includes(queryLower)) score += 10;

  return score;
}

// Props
interface CommandPaletteProps {
  commands: CommandItem[];
}

export function CommandPalette({ commands }: CommandPaletteProps) {
  const { commandPaletteOpen, closeCommandPalette } = useLayoutStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Filter and sort commands
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return commands;
    }

    return commands
      .map((cmd) => ({ cmd, score: scoreMatch(cmd, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ cmd }) => cmd);
  }, [commands, query]);

  // Group by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};

    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });

    return groups;
  }, [filteredCommands]);

  // Flat list for navigation
  const flatList = useMemo(() => filteredCommands, [filteredCommands]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatList[selectedIndex]) {
            flatList[selectedIndex].action();
            closeCommandPalette();
          }
          break;
        case 'Escape':
          e.preventDefault();
          closeCommandPalette();
          break;
      }
    },
    [flatList, selectedIndex, closeCommandPalette]
  );

  // Scroll selected item into view
  useEffect(() => {
    const container = resultsRef.current;
    if (!container) return;

    const selectedElement = container.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Handle item click
  const handleItemClick = (cmd: CommandItem) => {
    cmd.action();
    closeCommandPalette();
  };

  // Parse shortcut for display
  const parseShortcut = (shortcut: string) => {
    return shortcut.split('+').map((key) => {
      switch (key.toLowerCase()) {
        case 'mod':
          return '⌘';
        case 'shift':
          return '⇧';
        case 'alt':
          return '⌥';
        case 'ctrl':
          return '⌃';
        default:
          return key.toUpperCase();
      }
    });
  };

  if (!commandPaletteOpen) return null;

  return createPortal(
    <AnimatePresence>
      <Overlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeCommandPalette}
      >
        <Container
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <SearchWrapper>
            <SearchIcon>
              <Search size={18} />
            </SearchIcon>
            <SearchInput
              ref={inputRef}
              placeholder="Type a command or search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <CloseButton onClick={closeCommandPalette}>
              <X size={14} />
            </CloseButton>
          </SearchWrapper>

          <ResultsWrapper ref={resultsRef}>
            {flatList.length === 0 ? (
              <EmptyState>
                <Command size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                <div>No commands found</div>
              </EmptyState>
            ) : (
              Object.entries(groupedCommands).map(([category, items]) => (
                <div key={category}>
                  <CategoryHeader>
                    {categoryIcons[category] &&
                      (() => {
                        const Icon = categoryIcons[category];
                        return <Icon size={12} />;
                      })()}
                    {category}
                  </CategoryHeader>
                  {items.map((cmd) => {
                    const globalIndex = flatList.indexOf(cmd);
                    const Icon = cmd.icon || Command;

                    return (
                      <ResultItem
                        key={cmd.id}
                        data-index={globalIndex}
                        $selected={globalIndex === selectedIndex}
                        onClick={() => handleItemClick(cmd)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        <ResultIcon>
                          <Icon size={16} />
                        </ResultIcon>
                        <ResultContent>
                          <ResultTitle>{cmd.title}</ResultTitle>
                          {cmd.description && (
                            <ResultDescription>{cmd.description}</ResultDescription>
                          )}
                        </ResultContent>
                        {cmd.shortcut && (
                          <ResultShortcut>
                            {parseShortcut(cmd.shortcut).map((key, i) => (
                              <KeyBadge key={i}>{key}</KeyBadge>
                            ))}
                          </ResultShortcut>
                        )}
                      </ResultItem>
                    );
                  })}
                </div>
              ))
            )}
          </ResultsWrapper>

          <Footer>
            <FooterHints>
              <FooterHint>
                <KeyBadge>↵</KeyBadge>
                <span>to select</span>
              </FooterHint>
              <FooterHint>
                <KeyBadge>↑</KeyBadge>
                <KeyBadge>↓</KeyBadge>
                <span>to navigate</span>
              </FooterHint>
              <FooterHint>
                <KeyBadge>esc</KeyBadge>
                <span>to close</span>
              </FooterHint>
            </FooterHints>
            <span>{flatList.length} commands</span>
          </Footer>
        </Container>
      </Overlay>
    </AnimatePresence>,
    document.body
  );
}
