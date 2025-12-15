import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import { theme } from '../../styles';

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${theme.fontSize.sm};
`;

export const TableHead = styled.thead`
  position: sticky;
  top: 0;
  background: ${theme.colors.bg.tertiary};
  z-index: 1;
`;

export const TableBody = styled.tbody``;

export const TableRow = styled(motion.tr)<{ $clickable?: boolean; $selected?: boolean }>`
  border-bottom: 1px solid ${theme.colors.border.primary};
  background: ${({ $selected }) => ($selected ? theme.colors.bg.selection : 'transparent')};
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  
  &:hover {
    background: ${({ $selected }) =>
      $selected ? theme.colors.bg.selection : theme.colors.bg.hover};
  }
`;

export const TableHeader = styled.th<{ $width?: string; $align?: 'left' | 'center' | 'right' }>`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  text-align: ${({ $align = 'left' }) => $align};
  font-weight: 600;
  color: ${theme.colors.text.secondary};
  text-transform: uppercase;
  font-size: ${theme.fontSize.xs};
  letter-spacing: 0.5px;
  white-space: nowrap;
  ${({ $width }) => $width && `width: ${$width};`}
`;

export const TableCell = styled.td<{ $mono?: boolean; $align?: 'left' | 'center' | 'right' }>`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  text-align: ${({ $align = 'left' }) => $align};
  color: ${theme.colors.text.primary};
  ${({ $mono }) => $mono && `font-family: 'Consolas', 'Monaco', monospace;`}
`;

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
`;
