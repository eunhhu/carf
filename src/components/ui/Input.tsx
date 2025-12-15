import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from "react";
import styled from "@emotion/styled";
import type { LucideIcon } from "lucide-react";
import { theme } from "../../styles";

// ============================================================================
// Types
// ============================================================================

export type InputSize = "sm" | "md" | "lg";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: InputSize;
  error?: boolean;
  fullWidth?: boolean;
}

export interface IconInputProps extends InputProps {
  icon: LucideIcon;
  iconPosition?: "left" | "right";
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  inputSize?: InputSize;
  error?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  inputSize?: InputSize;
  error?: boolean;
  fullWidth?: boolean;
}

// ============================================================================
// Styles
// ============================================================================

const sizeStyles: Record<InputSize, { height: string; padding: string; fontSize: string }> = {
  sm: { height: "26px", padding: "4px 8px", fontSize: theme.fontSize.xs },
  md: { height: "32px", padding: "6px 10px", fontSize: theme.fontSize.sm },
  lg: { height: "38px", padding: "8px 12px", fontSize: theme.fontSize.md },
};

const baseInputStyles = (size: InputSize, error: boolean, fullWidth: boolean) => `
  height: ${sizeStyles[size].height};
  padding: ${sizeStyles[size].padding};
  font-size: ${sizeStyles[size].fontSize};
  width: ${fullWidth ? "100%" : "auto"};
  background: ${theme.colors.bg.primary};
  border: 1px solid ${error ? theme.colors.status.error : theme.colors.border.primary};
  border-radius: ${theme.borderRadius.md};
  color: ${theme.colors.text.primary};
  transition: border-color ${theme.transition.fast};
  font-family: inherit;

  &::placeholder {
    color: ${theme.colors.text.muted};
  }

  &:focus {
    outline: none;
    border-color: ${error ? theme.colors.status.error : theme.colors.border.focus};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: ${theme.colors.bg.tertiary};
  }
`;

const StyledInput = styled.input<{
  $size: InputSize;
  $error: boolean;
  $fullWidth: boolean;
}>`
  ${({ $size, $error, $fullWidth }) => baseInputStyles($size, $error, $fullWidth)}
`;

const StyledSelect = styled.select<{
  $size: InputSize;
  $error: boolean;
  $fullWidth: boolean;
}>`
  ${({ $size, $error, $fullWidth }) => baseInputStyles($size, $error, $fullWidth)}
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238e8e93' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  padding-right: 28px;

  option {
    background: ${theme.colors.bg.secondary};
  }
`;

const StyledTextArea = styled.textarea<{
  $size: InputSize;
  $error: boolean;
  $fullWidth: boolean;
}>`
  ${({ $size, $error, $fullWidth }) => baseInputStyles($size, $error, $fullWidth)}
  height: auto;
  min-height: 80px;
  resize: vertical;
`;

const IconInputWrapper = styled.div<{ $fullWidth: boolean }>`
  position: relative;
  display: inline-flex;
  width: ${({ $fullWidth }) => ($fullWidth ? "100%" : "auto")};
`;

const IconWrapper = styled.span<{ $position: "left" | "right"; $size: InputSize }>`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${({ $position }) => ($position === "left" ? "left: 10px;" : "right: 10px;")}
  color: ${theme.colors.text.muted};
  pointer-events: none;
  display: flex;
  align-items: center;
`;

const StyledIconInput = styled(StyledInput)<{ $iconPosition: "left" | "right" }>`
  ${({ $iconPosition }) =>
    $iconPosition === "left" ? "padding-left: 32px;" : "padding-right: 32px;"}
`;

// ============================================================================
// Components
// ============================================================================

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = "md", error = false, fullWidth = true, ...props }, ref) => (
    <StyledInput
      ref={ref}
      $size={inputSize}
      $error={error}
      $fullWidth={fullWidth}
      {...props}
    />
  )
);

Input.displayName = "Input";

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(
  (
    {
      icon: Icon,
      iconPosition = "left",
      inputSize = "md",
      error = false,
      fullWidth = true,
      ...props
    },
    ref
  ) => {
    const iconSize = inputSize === "sm" ? 14 : inputSize === "md" ? 16 : 18;

    return (
      <IconInputWrapper $fullWidth={fullWidth}>
        <IconWrapper $position={iconPosition} $size={inputSize}>
          <Icon size={iconSize} />
        </IconWrapper>
        <StyledIconInput
          ref={ref}
          $size={inputSize}
          $error={error}
          $fullWidth={true}
          $iconPosition={iconPosition}
          {...props}
        />
      </IconInputWrapper>
    );
  }
);

IconInput.displayName = "IconInput";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ inputSize = "md", error = false, fullWidth = true, children, ...props }, ref) => (
    <StyledSelect
      ref={ref}
      $size={inputSize}
      $error={error}
      $fullWidth={fullWidth}
      {...props}
    >
      {children}
    </StyledSelect>
  )
);

Select.displayName = "Select";

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ inputSize = "md", error = false, fullWidth = true, ...props }, ref) => (
    <StyledTextArea
      ref={ref}
      $size={inputSize}
      $error={error}
      $fullWidth={fullWidth}
      {...props}
    />
  )
);

TextArea.displayName = "TextArea";

// ============================================================================
// Form helpers
// ============================================================================

export const FormGroup = styled.div<{ $gap?: string }>`
  display: flex;
  flex-direction: column;
  gap: ${({ $gap }) => $gap || theme.spacing.xs};
`;

export const FormRow = styled.div<{ $gap?: string }>`
  display: flex;
  align-items: center;
  gap: ${({ $gap }) => $gap || theme.spacing.sm};
`;

export const Label = styled.label<{ $required?: boolean }>`
  font-size: ${theme.fontSize.xs};
  font-weight: 500;
  color: ${theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;

  ${({ $required }) =>
    $required &&
    `
    &::after {
      content: " *";
      color: ${theme.colors.status.error};
    }
  `}
`;

export const HelpText = styled.span<{ $error?: boolean }>`
  font-size: ${theme.fontSize.xs};
  color: ${({ $error }) => ($error ? theme.colors.status.error : theme.colors.text.muted)};
`;
