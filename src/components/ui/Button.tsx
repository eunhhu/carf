import { forwardRef, type ReactNode } from "react";
import styled from "@emotion/styled";
import { motion, type HTMLMotionProps } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { theme } from "../../styles";

// ============================================================================
// Types
// ============================================================================

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "size"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  children?: ReactNode;
}

export interface IconButtonProps extends Omit<HTMLMotionProps<"button">, "size"> {
  icon: LucideIcon;
  size?: ButtonSize;
  variant?: ButtonVariant;
  tooltip?: string;
  loading?: boolean;
}

// ============================================================================
// Styles
// ============================================================================

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    background: ${theme.colors.accent.primary};
    color: white;
    &:hover:not(:disabled) { background: ${theme.colors.accent.hover}; }
  `,
  secondary: `
    background: ${theme.colors.bg.tertiary};
    color: ${theme.colors.text.primary};
    border: 1px solid ${theme.colors.border.primary};
    &:hover:not(:disabled) { background: ${theme.colors.bg.hover}; }
  `,
  ghost: `
    background: transparent;
    color: ${theme.colors.text.secondary};
    &:hover:not(:disabled) { 
      background: ${theme.colors.bg.hover};
      color: ${theme.colors.text.primary};
    }
  `,
  danger: `
    background: ${theme.colors.status.error};
    color: white;
    &:hover:not(:disabled) { opacity: 0.9; }
  `,
  success: `
    background: ${theme.colors.status.success};
    color: white;
    &:hover:not(:disabled) { opacity: 0.9; }
  `,
};

const sizeStyles: Record<ButtonSize, { padding: string; fontSize: string; height: string }> = {
  xs: { padding: "2px 6px", fontSize: theme.fontSize.xs, height: "22px" },
  sm: { padding: "4px 8px", fontSize: theme.fontSize.xs, height: "26px" },
  md: { padding: "6px 12px", fontSize: theme.fontSize.sm, height: "32px" },
  lg: { padding: "8px 16px", fontSize: theme.fontSize.md, height: "38px" },
};

const iconSizes: Record<ButtonSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
};

const StyledButton = styled(motion.button)<{
  $variant: ButtonVariant;
  $size: ButtonSize;
  $fullWidth: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.xs};
  border: none;
  border-radius: ${theme.borderRadius.md};
  font-weight: 500;
  cursor: pointer;
  transition: all ${theme.transition.fast};
  white-space: nowrap;
  height: ${({ $size }) => sizeStyles[$size].height};
  padding: ${({ $size }) => sizeStyles[$size].padding};
  font-size: ${({ $size }) => sizeStyles[$size].fontSize};
  width: ${({ $fullWidth }) => ($fullWidth ? "100%" : "auto")};
  ${({ $variant }) => variantStyles[$variant]}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.accent.primary};
    outline-offset: 2px;
  }
`;

const StyledIconButton = styled(motion.button)<{
  $variant: ButtonVariant;
  $size: ButtonSize;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: ${theme.borderRadius.sm};
  cursor: pointer;
  transition: all ${theme.transition.fast};
  width: ${({ $size }) => sizeStyles[$size].height};
  height: ${({ $size }) => sizeStyles[$size].height};
  padding: 0;
  ${({ $variant }) => variantStyles[$variant]}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.accent.primary};
    outline-offset: 2px;
  }
`;

// ============================================================================
// Components
// ============================================================================

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      fullWidth = false,
      loading = false,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const iconSize = iconSizes[size];

    return (
      <StyledButton
        ref={ref}
        $variant={variant}
        $size={size}
        $fullWidth={fullWidth}
        disabled={disabled || loading}
        whileTap={{ scale: 0.98 }}
        {...props}
      >
        {LeftIcon && <LeftIcon size={iconSize} />}
        {children}
        {RightIcon && <RightIcon size={iconSize} />}
      </StyledButton>
    );
  }
);

Button.displayName = "Button";

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon: Icon,
      size = "md",
      variant = "ghost",
      tooltip,
      loading = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const iconSize = iconSizes[size];

    return (
      <StyledIconButton
        ref={ref}
        $variant={variant}
        $size={size}
        disabled={disabled || loading}
        title={tooltip}
        whileTap={{ scale: 0.95 }}
        {...props}
      >
        <Icon size={iconSize} />
      </StyledIconButton>
    );
  }
);

IconButton.displayName = "IconButton";
