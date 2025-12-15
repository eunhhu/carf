import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import { theme } from '../../styles';

// Panel container with header
export const PanelContainer = styled(motion.div)`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: ${theme.colors.bg.secondary};
  overflow: hidden;
`;

export const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.bg.tertiary};
  border-bottom: 1px solid ${theme.colors.border.primary};
  min-height: 35px;
`;

export const PanelTitle = styled.h2`
  font-size: ${theme.fontSize.sm};
  font-weight: 600;
  color: ${theme.colors.text.primary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

export const PanelActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
`;

export const PanelContent = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${theme.spacing.sm};
  scrollbar-gutter: stable;
  min-width: 0;
`;

export const PanelSection = styled.div`
  margin-bottom: ${theme.spacing.md};
`;

export const PanelSectionTitle = styled.h3`
  font-size: ${theme.fontSize.xs};
  font-weight: 600;
  color: ${theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: ${theme.spacing.sm};
`;
