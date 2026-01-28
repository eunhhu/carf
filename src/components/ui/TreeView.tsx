import { useState, useCallback, useMemo, type ReactNode } from 'react';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Folder, FolderOpen, File } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { theme } from '../../styles';

// Types
export interface TreeNode {
  id: string;
  label: string;
  icon?: LucideIcon;
  children?: TreeNode[];
  data?: unknown;
  expandable?: boolean;
  selectable?: boolean;
  disabled?: boolean;
}

interface TreeViewProps {
  nodes: TreeNode[];
  selectedIds?: string[];
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  onSelect?: (id: string, node: TreeNode) => void;
  onExpand?: (id: string, expanded: boolean) => void;
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void;
  onDoubleClick?: (node: TreeNode) => void;
  renderNode?: (node: TreeNode, isSelected: boolean, isExpanded: boolean) => ReactNode;
  indent?: number;
  showIcons?: boolean;
  multiSelect?: boolean;
}

// Styled components
const TreeContainer = styled.div`
  display: flex;
  flex-direction: column;
  font-size: ${theme.fontSize.sm};
  user-select: none;
`;

const TreeItemRow = styled.div<{
  $depth: number;
  $selected?: boolean;
  $disabled?: boolean;
}>`
  display: flex;
  align-items: center;
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  padding-left: ${({ $depth }) => `calc(${theme.spacing.sm} + ${$depth * 16}px)`};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  background: ${({ $selected }) =>
    $selected ? theme.colors.bg.selection : 'transparent'};
  color: ${({ $disabled }) =>
    $disabled ? theme.colors.text.muted : theme.colors.text.primary};
  transition: background ${theme.transition.fast};
  border-radius: ${theme.borderRadius.sm};
  margin: 1px 0;

  &:hover {
    background: ${({ $selected, $disabled }) =>
      $disabled
        ? 'transparent'
        : $selected
        ? theme.colors.bg.selection
        : theme.colors.bg.hover};
  }
`;

const ExpandIcon = styled.span<{ $expanded?: boolean; $visible?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-right: ${theme.spacing.xs};
  color: ${theme.colors.text.muted};
  visibility: ${({ $visible }) => ($visible ? 'visible' : 'hidden')};
  transition: transform ${theme.transition.fast};
  transform: ${({ $expanded }) => ($expanded ? 'rotate(90deg)' : 'rotate(0deg)')};
`;

const NodeIcon = styled.span<{ $color?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-right: ${theme.spacing.sm};
  color: ${({ $color }) => $color || theme.colors.text.muted};
`;

const NodeLabel = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ChildrenContainer = styled(motion.div)`
  overflow: hidden;
`;

// Tree Item Component
interface TreeItemProps {
  node: TreeNode;
  depth: number;
  selectedIds: string[];
  expandedIds: Set<string>;
  onSelect: (id: string, node: TreeNode) => void;
  onToggleExpand: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void;
  onDoubleClick?: (node: TreeNode) => void;
  renderNode?: (node: TreeNode, isSelected: boolean, isExpanded: boolean) => ReactNode;
  showIcons: boolean;
}

function TreeItem({
  node,
  depth,
  selectedIds,
  expandedIds,
  onSelect,
  onToggleExpand,
  onContextMenu,
  onDoubleClick,
  renderNode,
  showIcons,
}: TreeItemProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpandable = node.expandable !== false && hasChildren;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedIds.includes(node.id);
  const isSelectable = node.selectable !== false;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.disabled) return;

    if (isSelectable) {
      onSelect(node.id, node);
    }

    if (isExpandable && e.detail === 1) {
      // Single click - just select, don't expand
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.disabled) return;

    if (isExpandable) {
      onToggleExpand(node.id);
    }

    onDoubleClick?.(node);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExpandable) {
      onToggleExpand(node.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    onContextMenu?.(e, node);
  };

  // Determine icon
  const getIcon = () => {
    if (node.icon) {
      return node.icon;
    }
    if (hasChildren) {
      return isExpanded ? FolderOpen : Folder;
    }
    return File;
  };

  const Icon = getIcon();

  return (
    <div>
      <TreeItemRow
        $depth={depth}
        $selected={isSelected}
        $disabled={node.disabled}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        <ExpandIcon
          $expanded={isExpanded}
          $visible={isExpandable}
          onClick={handleExpandClick}
        >
          <ChevronRight size={14} />
        </ExpandIcon>

        {showIcons && (
          <NodeIcon>
            <Icon size={14} />
          </NodeIcon>
        )}

        {renderNode ? (
          renderNode(node, isSelected, isExpanded)
        ) : (
          <NodeLabel>{node.label}</NodeLabel>
        )}
      </TreeItemRow>

      <AnimatePresence initial={false}>
        {isExpanded && hasChildren && (
          <ChildrenContainer
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {node.children!.map((child) => (
              <TreeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedIds={selectedIds}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onToggleExpand={onToggleExpand}
                onContextMenu={onContextMenu}
                onDoubleClick={onDoubleClick}
                renderNode={renderNode}
                showIcons={showIcons}
              />
            ))}
          </ChildrenContainer>
        )}
      </AnimatePresence>
    </div>
  );
}

// Main TreeView Component
export function TreeView({
  nodes,
  selectedIds: controlledSelectedIds,
  expandedIds: controlledExpandedIds,
  defaultExpandedIds = [],
  onSelect,
  onExpand,
  onContextMenu,
  onDoubleClick,
  renderNode,
  showIcons = true,
  multiSelect = false,
}: TreeViewProps) {
  // Internal state for uncontrolled mode
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(
    new Set(defaultExpandedIds)
  );

  // Use controlled or internal state
  const selectedIds = controlledSelectedIds ?? internalSelectedIds;
  const expandedIds = useMemo(
    () => (controlledExpandedIds ? new Set(controlledExpandedIds) : internalExpandedIds),
    [controlledExpandedIds, internalExpandedIds]
  );

  const handleSelect = useCallback(
    (id: string, node: TreeNode) => {
      if (onSelect) {
        onSelect(id, node);
      } else {
        // Internal selection handling
        if (multiSelect) {
          setInternalSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
          );
        } else {
          setInternalSelectedIds([id]);
        }
      }
    },
    [onSelect, multiSelect]
  );

  const handleToggleExpand = useCallback(
    (id: string) => {
      const newExpanded = !expandedIds.has(id);

      if (onExpand) {
        onExpand(id, newExpanded);
      } else {
        // Internal expand handling
        setInternalExpandedIds((prev) => {
          const next = new Set(prev);
          if (newExpanded) {
            next.add(id);
          } else {
            next.delete(id);
          }
          return next;
        });
      }
    },
    [expandedIds, onExpand]
  );

  return (
    <TreeContainer>
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          depth={0}
          selectedIds={selectedIds}
          expandedIds={expandedIds}
          onSelect={handleSelect}
          onToggleExpand={handleToggleExpand}
          onContextMenu={onContextMenu}
          onDoubleClick={onDoubleClick}
          renderNode={renderNode}
          showIcons={showIcons}
        />
      ))}
    </TreeContainer>
  );
}

// Utility to flatten tree for searching
export function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];

  function traverse(node: TreeNode) {
    result.push(node);
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  nodes.forEach(traverse);
  return result;
}

// Utility to find node by ID
export function findNodeById(nodes: TreeNode[], id: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

// Utility to get all parent IDs of a node
export function getParentIds(nodes: TreeNode[], targetId: string): string[] {
  const parents: string[] = [];

  function traverse(node: TreeNode, path: string[]): boolean {
    if (node.id === targetId) {
      parents.push(...path);
      return true;
    }
    if (node.children) {
      for (const child of node.children) {
        if (traverse(child, [...path, node.id])) {
          return true;
        }
      }
    }
    return false;
  }

  for (const node of nodes) {
    if (traverse(node, [])) break;
  }

  return parents;
}
