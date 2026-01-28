import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { theme } from '../../styles';

// Types
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  children?: ContextMenuItem[];
  onSelect?: () => void;
}

export interface ContextMenuSeparator {
  type: 'separator';
}

export type ContextMenuItemOrSeparator = ContextMenuItem | ContextMenuSeparator;

function isSeparator(item: ContextMenuItemOrSeparator): item is ContextMenuSeparator {
  return 'type' in item && item.type === 'separator';
}

// Styled components
const MenuOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
`;

const MenuContainer = styled(motion.div)`
  position: fixed;
  min-width: 200px;
  max-width: 300px;
  background: ${theme.colors.bg.elevated};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.lg};
  box-shadow: ${theme.shadow.lg};
  padding: ${theme.spacing.xs} 0;
  z-index: 1001;
  overflow: hidden;
`;

const MenuItem = styled.button<{ $danger?: boolean; $disabled?: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: transparent;
  border: none;
  color: ${({ $danger, $disabled }) =>
    $disabled
      ? theme.colors.text.muted
      : $danger
      ? theme.colors.status.error
      : theme.colors.text.primary};
  font-size: ${theme.fontSize.sm};
  text-align: left;
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  transition: background ${theme.transition.fast};
  gap: ${theme.spacing.sm};

  &:hover:not(:disabled) {
    background: ${({ $danger }) =>
      $danger ? theme.colors.status.errorBg : theme.colors.bg.hover};
  }

  &:focus {
    outline: none;
    background: ${theme.colors.bg.hover};
  }
`;

const MenuItemIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
`;

const MenuItemLabel = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MenuItemShortcut = styled.span`
  color: ${theme.colors.text.muted};
  font-size: ${theme.fontSize.xs};
  margin-left: ${theme.spacing.md};
  flex-shrink: 0;
`;

const MenuItemArrow = styled.span`
  display: flex;
  align-items: center;
  color: ${theme.colors.text.muted};
  margin-left: ${theme.spacing.sm};
`;

const Separator = styled.div`
  height: 1px;
  background: ${theme.colors.border.primary};
  margin: ${theme.spacing.xs} 0;
`;

// Hook for managing context menu state
export function useContextMenu() {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [targetData, setTargetData] = useState<unknown>(null);

  const show = useCallback((e: React.MouseEvent, data?: unknown) => {
    e.preventDefault();
    e.stopPropagation();
    setPosition({ x: e.clientX, y: e.clientY });
    setTargetData(data ?? null);
  }, []);

  const hide = useCallback(() => {
    setPosition(null);
    setTargetData(null);
  }, []);

  return { position, targetData, show, hide, isOpen: position !== null };
}

// Context Menu Component
interface ContextMenuProps {
  items: ContextMenuItemOrSeparator[];
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [submenuPosition, setSubmenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  // Adjust position to fit in viewport
  useEffect(() => {
    if (!position || !menuRef.current) {
      setAdjustedPosition(position);
      return;
    }

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = position.x;
    let y = position.y;

    // Adjust horizontal position
    if (x + rect.width > viewportWidth - 10) {
      x = viewportWidth - rect.width - 10;
    }

    // Adjust vertical position
    if (y + rect.height > viewportHeight - 10) {
      y = viewportHeight - rect.height - 10;
    }

    setAdjustedPosition({ x: Math.max(10, x), y: Math.max(10, y) });
  }, [position]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle item click
  const handleItemClick = (item: ContextMenuItem) => {
    if (item.disabled) return;
    if (item.children && item.children.length > 0) return; // Don't close for submenus

    item.onSelect?.();
    onClose();
  };

  // Handle submenu hover
  const handleSubmenuHover = (
    item: ContextMenuItem,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (!item.children || item.children.length === 0) {
      setActiveSubmenu(null);
      setSubmenuPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setActiveSubmenu(item.id);
    setSubmenuPosition({
      x: rect.right,
      y: rect.top,
    });
  };

  if (!position) return null;

  const activeSubmenuItem = items.find(
    (item) => !isSeparator(item) && item.id === activeSubmenu
  ) as ContextMenuItem | undefined;

  return createPortal(
    <>
      <MenuOverlay onClick={onClose} onContextMenu={(e) => e.preventDefault()} />
      <AnimatePresence>
        <MenuContainer
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          style={{
            left: adjustedPosition?.x ?? position.x,
            top: adjustedPosition?.y ?? position.y,
          }}
        >
          {items.map((item, index) => {
            if (isSeparator(item)) {
              return <Separator key={`sep-${index}`} />;
            }

            const hasSubmenu = item.children && item.children.length > 0;
            const Icon = item.icon;

            return (
              <MenuItem
                key={item.id}
                $danger={item.danger}
                $disabled={item.disabled}
                disabled={item.disabled}
                onClick={() => handleItemClick(item)}
                onMouseEnter={(e) => handleSubmenuHover(item, e)}
              >
                <MenuItemIcon>{Icon && <Icon size={14} />}</MenuItemIcon>
                <MenuItemLabel>{item.label}</MenuItemLabel>
                {item.shortcut && <MenuItemShortcut>{item.shortcut}</MenuItemShortcut>}
                {hasSubmenu && (
                  <MenuItemArrow>
                    <ChevronRight size={14} />
                  </MenuItemArrow>
                )}
              </MenuItem>
            );
          })}
        </MenuContainer>

        {/* Submenu */}
        {activeSubmenuItem && submenuPosition && (
          <ContextMenu
            items={activeSubmenuItem.children!}
            position={submenuPosition}
            onClose={onClose}
          />
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}

// Wrapper component for easy usage
interface ContextMenuTriggerProps {
  items: ContextMenuItemOrSeparator[];
  children: ReactNode;
  disabled?: boolean;
  onContextMenu?: (data: unknown) => ContextMenuItemOrSeparator[];
}

export function ContextMenuTrigger({
  items,
  children,
  disabled,
  onContextMenu,
}: ContextMenuTriggerProps) {
  const { position, show, hide, targetData } = useContextMenu();

  const handleContextMenu = (e: React.MouseEvent) => {
    if (disabled) return;
    show(e);
  };

  const menuItems = onContextMenu ? onContextMenu(targetData) : items;

  return (
    <>
      <div onContextMenu={handleContextMenu} style={{ display: 'contents' }}>
        {children}
      </div>
      <ContextMenu items={menuItems} position={position} onClose={hide} />
    </>
  );
}
