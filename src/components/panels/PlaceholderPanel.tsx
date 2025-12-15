import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';
import { theme } from '../../styles';
import { PanelContainer, PanelContent } from '../common/Panel';

const PlaceholderContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${theme.colors.text.muted};
  text-align: center;
  gap: ${theme.spacing.md};
`;

const Title = styled.h2`
  font-size: ${theme.fontSize.lg};
  font-weight: 600;
  color: ${theme.colors.text.secondary};
`;

const Description = styled.p`
  font-size: ${theme.fontSize.sm};
  max-width: 300px;
`;

type PlaceholderPanelProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
};

export function PlaceholderPanel({ 
  title, 
  description = 'This feature is coming soon.',
  icon 
}: PlaceholderPanelProps) {
  return (
    <PanelContainer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <PanelContent>
        <PlaceholderContent>
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          >
            {icon || <Construction size={48} strokeWidth={1} />}
          </motion.div>
          <Title>{title}</Title>
          <Description>{description}</Description>
        </PlaceholderContent>
      </PanelContent>
    </PanelContainer>
  );
}
