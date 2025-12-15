import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import { theme } from '../../styles';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const getVariantStyles = (variant: ButtonVariant) => {
  switch (variant) {
    case 'primary':
      return `
        background: ${theme.colors.accent.primary};
        color: white;
        &:hover:not(:disabled) { background: ${theme.colors.accent.hover}; }
      `;
    case 'secondary':
      return `
        background: ${theme.colors.bg.hover};
        color: ${theme.colors.text.primary};
        border: 1px solid ${theme.colors.border.secondary};
        &:hover:not(:disabled) { background: ${theme.colors.bg.tertiary}; }
      `;
    case 'ghost':
      return `
        background: transparent;
        color: ${theme.colors.text.secondary};
        &:hover:not(:disabled) { 
          background: ${theme.colors.bg.hover};
          color: ${theme.colors.text.primary};
        }
      `;
    case 'danger':
      return `
        background: ${theme.colors.status.error};
        color: white;
        &:hover:not(:disabled) { opacity: 0.9; }
      `;
  }
};

const getSizeStyles = (size: ButtonSize) => {
  switch (size) {
    case 'sm':
      return `
        padding: ${theme.spacing.xs} ${theme.spacing.sm};
        font-size: ${theme.fontSize.xs};
      `;
    case 'md':
      return `
        padding: ${theme.spacing.sm} ${theme.spacing.md};
        font-size: ${theme.fontSize.sm};
      `;
    case 'lg':
      return `
        padding: ${theme.spacing.md} ${theme.spacing.lg};
        font-size: ${theme.fontSize.md};
      `;
  }
};

export const Button = styled(motion.button)<{
  $variant?: ButtonVariant;
  $size?: ButtonSize;
  $fullWidth?: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.xs};
  border-radius: ${theme.borderRadius.md};
  font-weight: 500;
  transition: all ${theme.transition.fast};
  white-space: nowrap;
  
  ${({ $variant = 'secondary' }) => getVariantStyles($variant)}
  ${({ $size = 'md' }) => getSizeStyles($size)}
  ${({ $fullWidth }) => $fullWidth && 'width: 100%;'}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const IconButton = styled(motion.button)<{ $size?: ButtonSize }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: ${theme.colors.text.secondary};
  border-radius: ${theme.borderRadius.sm};
  transition: all ${theme.transition.fast};
  
  ${({ $size = 'md' }) => {
    switch ($size) {
      case 'sm': return 'width: 20px; height: 20px;';
      case 'md': return 'width: 24px; height: 24px;';
      case 'lg': return 'width: 32px; height: 32px;';
    }
  }}
  
  &:hover:not(:disabled) {
    background: ${theme.colors.bg.hover};
    color: ${theme.colors.text.primary};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
