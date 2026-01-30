import styled from '@emotion/styled';
import { Panel, Group as PanelGroup, Separator } from 'react-resizable-panels';
import { theme } from '../../styles';

// Re-export base components
export { Panel, PanelGroup, Separator };

// Styled Panel Group - use inline style instead of styled(PanelGroup) to avoid Emotion issues
export const StyledPanelGroup = PanelGroup;

// Use inline styles for resize handles to avoid styled(Separator) issues
export const horizontalResizeHandleStyles = {
  width: 1,
  background: theme.colors.border.primary,
  flexShrink: 0,
  cursor: 'col-resize' as const,
};

export const verticalResizeHandleStyles = {
  height: 1,
  background: theme.colors.border.primary,
  flexShrink: 0,
  cursor: 'row-resize' as const,
};

// Wrapper components for styled resize handles (using styled.div instead of styled(Separator))
export const HorizontalResizeHandle = styled.div`
  width: 1px;
  background: ${theme.colors.border.primary};
  transition: background ${theme.transition.fast}, width ${theme.transition.fast};
  position: relative;
  flex-shrink: 0;
  cursor: col-resize;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    right: -3px;
    z-index: 10;
  }

  &:hover {
    background: ${theme.colors.accent.primary};
    width: 2px;
  }
`;

export const VerticalResizeHandle = styled.div`
  height: 1px;
  background: ${theme.colors.border.primary};
  transition: background ${theme.transition.fast}, height ${theme.transition.fast};
  position: relative;
  flex-shrink: 0;
  cursor: row-resize;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: -3px;
    bottom: -3px;
    z-index: 10;
  }

  &:hover {
    background: ${theme.colors.accent.primary};
    height: 2px;
  }
`;

// Panel content wrapper with proper overflow handling
export const PanelContent = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

// Collapsible panel header (for bottom/side panels)
export const PanelHeader = styled.div<{ $collapsed?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  background: ${theme.colors.bg.tertiary};
  border-bottom: 1px solid ${theme.colors.border.primary};
  min-height: 32px;
  flex-shrink: 0;
  cursor: ${({ $collapsed }) => ($collapsed ? 'pointer' : 'default')};
  user-select: none;

  &:hover {
    background: ${({ $collapsed }) =>
      $collapsed ? theme.colors.bg.hover : theme.colors.bg.tertiary};
  }
`;

export const PanelTitle = styled.span`
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  color: ${theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

export const PanelActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
`;

// Side panel wrapper (for Library, Properties)
export const SidePanel = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${theme.colors.bg.secondary};
  border-left: 1px solid ${theme.colors.border.primary};
`;

// Bottom panel wrapper (for Console)
export const BottomPanel = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${theme.colors.bg.secondary};
  border-top: 1px solid ${theme.colors.border.primary};
`;
