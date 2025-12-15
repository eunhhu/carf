import { type ReactNode, type HTMLAttributes } from "react";
import styled from "@emotion/styled";
import { theme } from "../../styles";

// ============================================================================
// Types
// ============================================================================

export type TableSize = "sm" | "md" | "lg";

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  size?: TableSize;
  striped?: boolean;
  hoverable?: boolean;
  children: ReactNode;
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  clickable?: boolean;
  children: ReactNode;
}

export interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right";
  width?: string;
  mono?: boolean;
  truncate?: boolean;
  children?: ReactNode;
}

export interface TableHeaderProps extends TableCellProps {
  sortable?: boolean;
  sorted?: "asc" | "desc" | null;
  onSort?: () => void;
}

// ============================================================================
// Styles
// ============================================================================

const sizeStyles: Record<TableSize, { padding: string; fontSize: string }> = {
  sm: { padding: "4px 8px", fontSize: theme.fontSize.xs },
  md: { padding: "8px 12px", fontSize: theme.fontSize.sm },
  lg: { padding: "12px 16px", fontSize: theme.fontSize.md },
};

const StyledTable = styled.table<{ $size: TableSize; $striped: boolean }>`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ $size }) => sizeStyles[$size].fontSize};

  ${({ $striped }) =>
    $striped &&
    `
    tbody tr:nth-of-type(odd) {
      background: ${theme.colors.bg.tertiary};
    }
  `}
`;

const StyledTableHead = styled.thead`
  position: sticky;
  top: 0;
  background: ${theme.colors.bg.tertiary};
  z-index: 1;
`;

const StyledTableBody = styled.tbody``;

const StyledTableRow = styled.tr<{
  $selected: boolean;
  $clickable: boolean;
  $hoverable: boolean;
}>`
  border-bottom: 1px solid ${theme.colors.border.primary};
  background: ${({ $selected }) => ($selected ? theme.colors.bg.selection : "transparent")};
  cursor: ${({ $clickable }) => ($clickable ? "pointer" : "default")};

  ${({ $hoverable, $selected }) =>
    $hoverable &&
    `
    &:hover {
      background: ${$selected ? theme.colors.bg.selection : theme.colors.bg.hover};
    }
  `}
`;

const StyledTableHeader = styled.th<{
  $size: TableSize;
  $align: "left" | "center" | "right";
  $width?: string;
  $sortable: boolean;
}>`
  padding: ${({ $size }) => sizeStyles[$size].padding};
  text-align: ${({ $align }) => $align};
  font-weight: 600;
  color: ${theme.colors.text.secondary};
  text-transform: uppercase;
  font-size: ${theme.fontSize.xs};
  letter-spacing: 0.5px;
  white-space: nowrap;
  ${({ $width }) => $width && `width: ${$width};`}
  ${({ $sortable }) => $sortable && "cursor: pointer; user-select: none;"}

  &:hover {
    ${({ $sortable }) => $sortable && `color: ${theme.colors.text.primary};`}
  }
`;

const StyledTableCell = styled.td<{
  $size: TableSize;
  $align: "left" | "center" | "right";
  $width?: string;
  $mono: boolean;
  $truncate: boolean;
}>`
  padding: ${({ $size }) => sizeStyles[$size].padding};
  text-align: ${({ $align }) => $align};
  color: ${theme.colors.text.primary};
  ${({ $width }) => $width && `width: ${$width};`}
  ${({ $mono }) => $mono && `font-family: 'SF Mono', 'Consolas', monospace;`}
  ${({ $truncate }) =>
    $truncate &&
    `
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `}
`;

const SortIndicator = styled.span<{ $sorted: "asc" | "desc" | null }>`
  margin-left: 4px;
  opacity: ${({ $sorted }) => ($sorted ? 1 : 0.3)};
  
  &::after {
    content: "${({ $sorted }) => ($sorted === "asc" ? "↑" : $sorted === "desc" ? "↓" : "↕")}";
  }
`;

// ============================================================================
// Context for size propagation
// ============================================================================

import { createContext, useContext } from "react";

const TableContext = createContext<{ size: TableSize; hoverable: boolean }>({
  size: "md",
  hoverable: true,
});

// ============================================================================
// Components
// ============================================================================

export function Table({
  size = "md",
  striped = false,
  hoverable = true,
  children,
  ...props
}: TableProps) {
  return (
    <TableContext.Provider value={{ size, hoverable }}>
      <StyledTable $size={size} $striped={striped} {...props}>
        {children}
      </StyledTable>
    </TableContext.Provider>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <StyledTableHead>{children}</StyledTableHead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <StyledTableBody>{children}</StyledTableBody>;
}

export function TableRow({
  selected = false,
  clickable = false,
  children,
  ...props
}: TableRowProps) {
  const { hoverable } = useContext(TableContext);

  return (
    <StyledTableRow
      $selected={selected}
      $clickable={clickable}
      $hoverable={hoverable}
      {...props}
    >
      {children}
    </StyledTableRow>
  );
}

export function TableHeader({
  align = "left",
  width,
  sortable = false,
  sorted = null,
  onSort,
  children,
  ...props
}: TableHeaderProps) {
  const { size } = useContext(TableContext);

  return (
    <StyledTableHeader
      $size={size}
      $align={align}
      $width={width}
      $sortable={sortable}
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      {children}
      {sortable && <SortIndicator $sorted={sorted} />}
    </StyledTableHeader>
  );
}

export function TableCell({
  align = "left",
  width,
  mono = false,
  truncate = false,
  children,
  ...props
}: TableCellProps) {
  const { size } = useContext(TableContext);

  return (
    <StyledTableCell
      $size={size}
      $align={align}
      $width={width}
      $mono={mono}
      $truncate={truncate}
      {...props}
    >
      {children}
    </StyledTableCell>
  );
}

// ============================================================================
// Utility components
// ============================================================================

export const TableActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
`;

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing.xl};
  color: ${theme.colors.text.muted};
  text-align: center;
  gap: ${theme.spacing.sm};
`;
