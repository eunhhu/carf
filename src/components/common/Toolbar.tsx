import styled from '@emotion/styled';
import { Search, RefreshCw, Filter, ArrowUpDown } from 'lucide-react';
import { theme } from '../../styles';
import { IconButton } from './Button';
import { Input } from './Input';

const ToolbarContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.bg.tertiary};
  border-bottom: 1px solid ${theme.colors.border.primary};
`;

const SearchWrapper = styled.div`
  position: relative;
  flex: 1;
  max-width: 300px;
`;

const SearchIcon = styled(Search)`
  position: absolute;
  left: ${theme.spacing.sm};
  top: 50%;
  transform: translateY(-50%);
  color: ${theme.colors.text.muted};
  pointer-events: none;
`;

const SearchInputStyled = styled(Input)`
  padding-left: 32px;
  height: 28px;
  font-size: ${theme.fontSize.xs};
`;

const ToolbarActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
`;

const CountBadge = styled.span`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
  margin-left: ${theme.spacing.sm};
`;

type ToolbarProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onRefresh?: () => void;
  onFilter?: () => void;
  onSort?: () => void;
  totalCount?: number;
  filteredCount?: number;
  refreshing?: boolean;
  children?: React.ReactNode;
};

export function Toolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  onRefresh,
  onFilter,
  onSort,
  totalCount,
  filteredCount,
  refreshing,
  children,
}: ToolbarProps) {
  return (
    <ToolbarContainer>
      {onSearchChange !== undefined && (
        <SearchWrapper>
          <SearchIcon size={14} />
          <SearchInputStyled
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </SearchWrapper>
      )}

      {totalCount !== undefined && (
        <CountBadge>
          {filteredCount !== undefined && filteredCount !== totalCount
            ? `${filteredCount} / ${totalCount}`
            : totalCount}
        </CountBadge>
      )}

      <ToolbarActions>
        {children}
        
        {onFilter && (
          <IconButton $size="sm" onClick={onFilter} title="Filter">
            <Filter size={14} />
          </IconButton>
        )}

        {onSort && (
          <IconButton $size="sm" onClick={onSort} title="Sort">
            <ArrowUpDown size={14} />
          </IconButton>
        )}

        {onRefresh && (
          <IconButton
            $size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh"
            animate={refreshing ? { rotate: 360 } : {}}
            transition={refreshing ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}
          >
            <RefreshCw size={14} />
          </IconButton>
        )}
      </ToolbarActions>
    </ToolbarContainer>
  );
}
