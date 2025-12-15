import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { useAlertStore, type AlertType } from '../../stores/alertStore';
import { theme } from '../../styles';

const Container = styled.div`
  position: fixed;
  top: ${theme.spacing.lg};
  right: ${theme.spacing.lg};
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
  max-width: 400px;
  pointer-events: none;
`;

const AlertItem = styled(motion.div)<{ $type: AlertType }>`
  display: flex;
  align-items: flex-start;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.md};
  background: ${({ $type }) => {
    switch ($type) {
      case 'error': return 'rgba(255, 59, 48, 0.95)';
      case 'warning': return 'rgba(255, 149, 0, 0.95)';
      case 'success': return 'rgba(52, 199, 89, 0.95)';
      default: return 'rgba(0, 122, 255, 0.95)';
    }
  }};
  border-radius: ${theme.borderRadius.lg};
  box-shadow: ${theme.shadow.lg};
  pointer-events: auto;
  backdrop-filter: blur(10px);
  color: white;
`;

const IconWrapper = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
`;

const Content = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.semibold};
  line-height: 1.4;
`;

const Message = styled.div`
  font-size: ${theme.fontSize.xs};
  opacity: 0.9;
  margin-top: ${theme.spacing.xs};
  line-height: 1.4;
  word-break: break-word;
`;

const CloseButton = styled.button`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: ${theme.borderRadius.sm};
  color: white;
  cursor: pointer;
  transition: background ${theme.transition.fast};
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const ProgressBar = styled(motion.div)<{ $type: AlertType }>`
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 0 0 ${theme.borderRadius.lg} ${theme.borderRadius.lg};
`;

const AlertWrapper = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: ${theme.borderRadius.lg};
`;

function getIcon(type: AlertType) {
  switch (type) {
    case 'error': return <AlertCircle size={20} />;
    case 'warning': return <AlertTriangle size={20} />;
    case 'success': return <CheckCircle size={20} />;
    default: return <Info size={20} />;
  }
}

export function AlertContainer() {
  const { alerts, removeAlert } = useAlertStore();

  return (
    <Container>
      <AnimatePresence mode="popLayout">
        {alerts.map((alert) => (
          <AlertWrapper key={alert.id}>
            <AlertItem
              $type={alert.type}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              layout
            >
              <IconWrapper>
                {getIcon(alert.type)}
              </IconWrapper>
              <Content>
                <Title>{alert.title}</Title>
                {alert.message && <Message>{alert.message}</Message>}
              </Content>
              <CloseButton onClick={() => removeAlert(alert.id)}>
                <X size={14} />
              </CloseButton>
            </AlertItem>
            {alert.duration && alert.duration > 0 && (
              <ProgressBar
                $type={alert.type}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: alert.duration / 1000, ease: 'linear' }}
              />
            )}
          </AlertWrapper>
        ))}
      </AnimatePresence>
    </Container>
  );
}
