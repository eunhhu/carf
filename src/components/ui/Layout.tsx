import styled from "@emotion/styled";
import { theme } from "../../styles";

// ============================================================================
// Page Layout
// ============================================================================

export const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: ${theme.colors.bg.secondary};
  overflow: hidden;
`;

export const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.bg.tertiary};
  border-bottom: 1px solid ${theme.colors.border.primary};
  min-height: 40px;
  flex-shrink: 0;
`;

export const PageTitle = styled.h1`
  font-size: ${theme.fontSize.lg};
  font-weight: 600;
  color: ${theme.colors.text.primary};
  margin: 0;
`;

export const PageActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
`;

export const PageContent = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${theme.spacing.md};
`;

export const PageToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.bg.tertiary};
  border-bottom: 1px solid ${theme.colors.border.primary};
  flex-shrink: 0;
`;

// ============================================================================
// Split Layout
// ============================================================================

export const SplitContainer = styled.div<{ $direction?: "horizontal" | "vertical" }>`
  display: flex;
  flex-direction: ${({ $direction = "horizontal" }) =>
    $direction === "horizontal" ? "row" : "column"};
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

export const SplitPane = styled.div<{ $size?: string; $minSize?: string }>`
  display: flex;
  flex-direction: column;
  ${({ $size }) => ($size ? `flex: 0 0 ${$size};` : "flex: 1;")}
  ${({ $minSize }) => $minSize && `min-width: ${$minSize}; min-height: ${$minSize};`}
  overflow: hidden;
`;

export const SplitDivider = styled.div<{ $direction?: "horizontal" | "vertical" }>`
  flex-shrink: 0;
  background: ${theme.colors.border.primary};
  ${({ $direction = "horizontal" }) =>
    $direction === "horizontal"
      ? `width: 1px; cursor: col-resize;`
      : `height: 1px; cursor: row-resize;`}

  &:hover {
    background: ${theme.colors.accent.primary};
  }
`;

// ============================================================================
// Card
// ============================================================================

export const Card = styled.div<{ $padding?: string }>`
  background: ${theme.colors.bg.tertiary};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.lg};
  padding: ${({ $padding }) => $padding || theme.spacing.md};
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.spacing.md};
`;

export const CardTitle = styled.h3`
  font-size: ${theme.fontSize.md};
  font-weight: 600;
  color: ${theme.colors.text.primary};
  margin: 0;
`;

export const CardContent = styled.div``;

// ============================================================================
// Section
// ============================================================================

export const Section = styled.section<{ $gap?: string }>`
  display: flex;
  flex-direction: column;
  gap: ${({ $gap }) => $gap || theme.spacing.md};
`;

export const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const SectionTitle = styled.h2`
  font-size: ${theme.fontSize.sm};
  font-weight: 600;
  color: ${theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
`;

// ============================================================================
// Flex utilities
// ============================================================================

export const Flex = styled.div<{
  $direction?: "row" | "column";
  $align?: "start" | "center" | "end" | "stretch";
  $justify?: "start" | "center" | "end" | "between" | "around";
  $gap?: string;
  $wrap?: boolean;
}>`
  display: flex;
  flex-direction: ${({ $direction = "row" }) => $direction};
  align-items: ${({ $align = "stretch" }) =>
    $align === "start" ? "flex-start" : $align === "end" ? "flex-end" : $align};
  justify-content: ${({ $justify = "start" }) =>
    $justify === "start"
      ? "flex-start"
      : $justify === "end"
      ? "flex-end"
      : $justify === "between"
      ? "space-between"
      : $justify === "around"
      ? "space-around"
      : $justify};
  gap: ${({ $gap }) => $gap || "0"};
  ${({ $wrap }) => $wrap && "flex-wrap: wrap;"}
`;

export const Spacer = styled.div`
  flex: 1;
`;

// ============================================================================
// Grid
// ============================================================================

export const Grid = styled.div<{
  $columns?: number | string;
  $gap?: string;
  $minWidth?: string;
}>`
  display: grid;
  grid-template-columns: ${({ $columns, $minWidth }) =>
    typeof $columns === "number"
      ? `repeat(${$columns}, 1fr)`
      : $columns || ($minWidth ? `repeat(auto-fill, minmax(${$minWidth}, 1fr))` : "1fr")};
  gap: ${({ $gap }) => $gap || theme.spacing.md};
`;

// ============================================================================
// Scroll containers
// ============================================================================

export const ScrollArea = styled.div<{ $maxHeight?: string }>`
  overflow: auto;
  ${({ $maxHeight }) => $maxHeight && `max-height: ${$maxHeight};`}
  scrollbar-gutter: stable;
`;

export const VirtualList = styled.div`
  overflow: auto;
  height: 100%;
`;

// ============================================================================
// Divider
// ============================================================================

export const Divider = styled.hr<{ $margin?: string }>`
  border: none;
  border-top: 1px solid ${theme.colors.border.primary};
  margin: ${({ $margin }) => $margin || `${theme.spacing.md} 0`};
`;

// ============================================================================
// Text utilities
// ============================================================================

export const Text = styled.span<{
  $size?: "xs" | "sm" | "md" | "lg" | "xl";
  $color?: "primary" | "secondary" | "muted" | "accent" | "error" | "success" | "warning";
  $weight?: "normal" | "medium" | "semibold" | "bold";
  $mono?: boolean;
  $truncate?: boolean;
}>`
  font-size: ${({ $size = "md" }) => theme.fontSize[$size]};
  color: ${({ $color = "primary" }) => theme.colors.text[$color]};
  font-weight: ${({ $weight = "normal" }) => theme.fontWeight[$weight]};
  ${({ $mono }) => $mono && `font-family: 'SF Mono', 'Consolas', monospace;`}
  ${({ $truncate }) =>
    $truncate &&
    `
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `}
`;

export const Code = styled.code`
  font-family: "SF Mono", "Consolas", monospace;
  font-size: ${theme.fontSize.sm};
  background: ${theme.colors.bg.primary};
  padding: 2px 6px;
  border-radius: ${theme.borderRadius.sm};
  color: ${theme.colors.text.accent};
`;

// ============================================================================
// Status indicators
// ============================================================================

export const Badge = styled.span<{
  $variant?: "default" | "primary" | "success" | "warning" | "error";
}>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: ${theme.fontSize.xs};
  font-weight: 500;
  border-radius: ${theme.borderRadius.full};

  ${({ $variant = "default" }) => {
    switch ($variant) {
      case "primary":
        return `background: ${theme.colors.accent.muted}; color: ${theme.colors.accent.primary};`;
      case "success":
        return `background: ${theme.colors.status.successBg}; color: ${theme.colors.status.success};`;
      case "warning":
        return `background: ${theme.colors.status.warningBg}; color: ${theme.colors.status.warning};`;
      case "error":
        return `background: ${theme.colors.status.errorBg}; color: ${theme.colors.status.error};`;
      default:
        return `background: ${theme.colors.bg.tertiary}; color: ${theme.colors.text.secondary};`;
    }
  }}
`;

export const Dot = styled.span<{
  $color?: "success" | "warning" | "error" | "info";
  $size?: number;
}>`
  display: inline-block;
  width: ${({ $size = 8 }) => $size}px;
  height: ${({ $size = 8 }) => $size}px;
  border-radius: 50%;
  background: ${({ $color = "info" }) => {
    switch ($color) {
      case "success":
        return theme.colors.status.success;
      case "warning":
        return theme.colors.status.warning;
      case "error":
        return theme.colors.status.error;
      default:
        return theme.colors.status.info;
    }
  }};
`;

// ============================================================================
// Loading
// ============================================================================

export const Spinner = styled.div<{ $size?: number }>`
  width: ${({ $size = 20 }) => $size}px;
  height: ${({ $size = 20 }) => $size}px;
  border: 2px solid ${theme.colors.border.primary};
  border-top-color: ${theme.colors.accent.primary};
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

export const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10;
`;
