import { type ReactNode } from "react";
import styled from "@emotion/styled";
import { Search, RefreshCw, Filter, ArrowUpDown } from "lucide-react";
import { theme } from "../../styles";
import { IconButton } from "./Button";
import { IconInput } from "./Input";

// ============================================================================
// Types
// ============================================================================

export interface ToolbarProps {
  children?: ReactNode;
}

export interface ToolbarSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface ToolbarCountProps {
  total: number;
  filtered?: number;
}

// ============================================================================
// Styles
// ============================================================================

const ToolbarContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.bg.tertiary};
  border-bottom: 1px solid ${theme.colors.border.primary};
  flex-shrink: 0;
`;

const ToolbarGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
`;

const ToolbarSpacer = styled.div`
  flex: 1;
`;

const CountBadge = styled.span`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
  padding: 0 ${theme.spacing.sm};
`;

// ============================================================================
// Components
// ============================================================================

export function Toolbar({ children }: ToolbarProps) {
  return <ToolbarContainer>{children}</ToolbarContainer>;
}

export function ToolbarSearch({ value, onChange, placeholder = "Search..." }: ToolbarSearchProps) {
  return (
    <IconInput
      icon={Search}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputSize="sm"
      style={{ maxWidth: 240 }}
    />
  );
}

export function ToolbarCount({ total, filtered }: ToolbarCountProps) {
  return (
    <CountBadge>
      {filtered !== undefined && filtered !== total ? `${filtered} / ${total}` : total}
    </CountBadge>
  );
}

export function ToolbarRefreshButton({
  onClick,
  loading = false,
}: {
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <IconButton
      icon={RefreshCw}
      size="sm"
      onClick={onClick}
      disabled={loading}
      tooltip="Refresh"
      style={loading ? { animation: "spin 1s linear infinite" } : undefined}
    />
  );
}

export function ToolbarFilterButton({ onClick }: { onClick: () => void }) {
  return <IconButton icon={Filter} size="sm" onClick={onClick} tooltip="Filter" />;
}

export function ToolbarSortButton({ onClick }: { onClick: () => void }) {
  return <IconButton icon={ArrowUpDown} size="sm" onClick={onClick} tooltip="Sort" />;
}

// Re-export for convenience
export { ToolbarGroup, ToolbarSpacer };
