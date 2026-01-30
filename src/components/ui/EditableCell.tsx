import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type FocusEvent,
} from 'react';
import styled from '@emotion/styled';
import { Loader2 } from 'lucide-react';
import { theme } from '../../styles';

// ============================================================================
// Types
// ============================================================================

export interface EditableCellProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  onCancel?: () => void;
  placeholder?: string;
  disabled?: boolean;
  monospace?: boolean;
  highlight?: boolean;
  selectOnFocus?: boolean;
  validateOnBlur?: boolean;
  validate?: (value: string) => boolean | string; // true = valid, string = error message
  format?: (value: string) => string; // Format display value
}

// ============================================================================
// Styles
// ============================================================================

const CellContainer = styled.div<{ $highlight: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 4px;
  border-radius: ${theme.borderRadius.sm};
  cursor: pointer;

  ${({ $highlight }) =>
    $highlight &&
    `
    background: ${theme.colors.accent.muted}15;
  `}

  &:hover:not([data-editing="true"]) {
    background: ${theme.colors.bg.hover};
  }
`;

const DisplayValue = styled.span<{ $monospace: boolean; $placeholder: boolean }>`
  font-family: ${({ $monospace }) =>
    $monospace ? '"SF Mono", "Consolas", monospace' : 'inherit'};
  font-size: ${theme.fontSize.sm};
  color: ${({ $placeholder }) =>
    $placeholder ? theme.colors.text.muted : theme.colors.text.primary};
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EditInput = styled.input<{ $monospace: boolean; $error: boolean }>`
  width: 100%;
  height: 24px;
  padding: 2px 4px;
  font-family: ${({ $monospace }) =>
    $monospace ? '"SF Mono", "Consolas", monospace' : 'inherit'};
  font-size: ${theme.fontSize.sm};
  background: ${theme.colors.bg.primary};
  border: 1px solid
    ${({ $error }) =>
      $error ? theme.colors.status.error : theme.colors.border.focus};
  border-radius: ${theme.borderRadius.sm};
  color: ${theme.colors.text.primary};
  outline: none;

  &:focus {
    border-color: ${({ $error }) =>
      $error ? theme.colors.status.error : theme.colors.accent.primary};
    box-shadow: 0 0 0 2px
      ${({ $error }) =>
        $error
          ? `${theme.colors.status.error}30`
          : `${theme.colors.accent.primary}30`};
  }
`;

const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.bg.primary}dd;
  border-radius: ${theme.borderRadius.sm};
`;

const SpinnerWrapper = styled.span`
  display: inline-flex;
  animation: spin 1s linear infinite;
  color: ${theme.colors.accent.primary};

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const ErrorTooltip = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  padding: 4px 8px;
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.primary};
  background: ${theme.colors.status.error};
  border-radius: ${theme.borderRadius.sm};
  white-space: nowrap;
  z-index: 10;
`;

// ============================================================================
// Component
// ============================================================================

export function EditableCell({
  value,
  onSave,
  onCancel,
  placeholder = 'Click to edit',
  disabled = false,
  monospace = true,
  highlight = false,
  selectOnFocus = true,
  validateOnBlur = true,
  validate,
  format,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update editValue when external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (selectOnFocus) {
        inputRef.current.select();
      }
    }
  }, [isEditing, selectOnFocus]);

  const validateValue = useCallback(
    (val: string): boolean => {
      if (!validate) return true;
      const result = validate(val);
      if (result === true) {
        setError(null);
        return true;
      }
      setError(typeof result === 'string' ? result : 'Invalid value');
      return false;
    },
    [validate]
  );

  const handleSave = useCallback(async () => {
    if (editValue === value) {
      setIsEditing(false);
      setError(null);
      return;
    }

    if (!validateValue(editValue)) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [editValue, value, onSave, validateValue]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue(value);
    setError(null);
    onCancel?.();
  }, [value, onCancel]);

  const handleDoubleClick = useCallback(() => {
    if (disabled || isSaving) return;
    setIsEditing(true);
  }, [disabled, isSaving]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  const handleBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      // Prevent blur when clicking inside the cell
      if (
        e.relatedTarget &&
        e.currentTarget.parentElement?.contains(e.relatedTarget as Node)
      ) {
        return;
      }

      if (validateOnBlur) {
        if (editValue !== value) {
          handleSave();
        } else {
          handleCancel();
        }
      }
    },
    [validateOnBlur, editValue, value, handleSave, handleCancel]
  );

  const displayValue = format ? format(value) : value;

  return (
    <CellContainer
      $highlight={highlight}
      data-editing={isEditing}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <>
          <EditInput
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              if (error) validateValue(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            $monospace={monospace}
            $error={!!error}
            disabled={isSaving}
          />
          {error && <ErrorTooltip>{error}</ErrorTooltip>}
        </>
      ) : (
        <DisplayValue
          $monospace={monospace}
          $placeholder={!value}
          title={value || placeholder}
        >
          {displayValue || placeholder}
        </DisplayValue>
      )}
      {isSaving && (
        <LoadingOverlay>
          <SpinnerWrapper>
            <Loader2 size={14} />
          </SpinnerWrapper>
        </LoadingOverlay>
      )}
    </CellContainer>
  );
}

// ============================================================================
// Specialized variants
// ============================================================================

export interface EditableNumberCellProps
  extends Omit<EditableCellProps, 'validate' | 'format'> {
  min?: number;
  max?: number;
  integer?: boolean;
  hex?: boolean;
}

export function EditableNumberCell({
  min,
  max,
  integer = false,
  hex = false,
  ...props
}: EditableNumberCellProps) {
  const validate = useCallback(
    (val: string): boolean | string => {
      if (!val) return 'Value is required';

      let num: number;
      if (hex) {
        // Allow with or without 0x prefix
        const cleanVal = val.replace(/^0x/i, '');
        num = parseInt(cleanVal, 16);
        if (isNaN(num)) return 'Invalid hex number';
      } else {
        num = parseFloat(val);
        if (isNaN(num)) return 'Invalid number';
      }

      if (integer && !Number.isInteger(num)) return 'Must be an integer';
      if (min !== undefined && num < min) return `Minimum value is ${min}`;
      if (max !== undefined && num > max) return `Maximum value is ${max}`;

      return true;
    },
    [hex, integer, min, max]
  );

  const format = useCallback(
    (val: string): string => {
      if (!val) return '';
      if (hex) {
        const num = parseInt(val.replace(/^0x/i, ''), 16);
        if (!isNaN(num)) {
          return '0x' + num.toString(16).toUpperCase();
        }
      }
      return val;
    },
    [hex]
  );

  return <EditableCell {...props} validate={validate} format={format} />;
}

export interface EditableAddressCellProps
  extends Omit<EditableCellProps, 'validate' | 'format' | 'monospace'> {}

export function EditableAddressCell(props: EditableAddressCellProps) {
  const validate = useCallback((val: string): boolean | string => {
    if (!val) return 'Address is required';
    // Allow 0x prefix or just hex digits
    const cleanVal = val.replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]+$/.test(cleanVal)) return 'Invalid hex address';
    return true;
  }, []);

  const format = useCallback((val: string): string => {
    if (!val) return '';
    const cleanVal = val.replace(/^0x/i, '');
    return '0x' + cleanVal.toUpperCase();
  }, []);

  return (
    <EditableCell
      {...props}
      validate={validate}
      format={format}
      monospace={true}
    />
  );
}
