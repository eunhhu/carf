import styled from "@emotion/styled";
import { motion, AnimatePresence } from "framer-motion";
import { X, Info, CheckCircle, AlertTriangle, AlertCircle } from "lucide-react";
import { theme } from "../../styles";
import { useAlertStore, type AlertType } from "../../stores/alertStore";

// ============================================================================
// Styles
// ============================================================================

const Container = styled.div`
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 400px;
`;

const AlertItem = styled(motion.div)<{ $type: AlertType }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: ${theme.colors.bg.elevated};
  border: 1px solid ${({ $type }) => {
    switch ($type) {
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
  border-radius: ${theme.borderRadius.lg};
  box-shadow: ${theme.shadow.lg};
`;

const IconWrapper = styled.div<{ $type: AlertType }>`
  flex-shrink: 0;
  color: ${({ $type }) => {
    switch ($type) {
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

const Content = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-size: ${theme.fontSize.sm};
  font-weight: 600;
  color: ${theme.colors.text.primary};
`;

const Message = styled.div`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.secondary};
  margin-top: 4px;
`;

const CloseButton = styled.button`
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: ${theme.colors.text.muted};
  transition: color ${theme.transition.fast};

  &:hover {
    color: ${theme.colors.text.primary};
  }
`;

// ============================================================================
// Component
// ============================================================================

function getIcon(type: AlertType) {
  switch (type) {
    case "success":
      return CheckCircle;
    case "warning":
      return AlertTriangle;
    case "error":
      return AlertCircle;
    default:
      return Info;
  }
}

export function AlertContainer() {
  const { alerts, removeAlert } = useAlertStore();

  return (
    <Container>
      <AnimatePresence>
        {alerts.map((alert) => {
          const Icon = getIcon(alert.type);
          return (
            <AlertItem
              key={alert.id}
              $type={alert.type}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <IconWrapper $type={alert.type}>
                <Icon size={18} />
              </IconWrapper>
              <Content>
                <Title>{alert.title}</Title>
                {alert.message && <Message>{alert.message}</Message>}
              </Content>
              <CloseButton onClick={() => removeAlert(alert.id)}>
                <X size={16} />
              </CloseButton>
            </AlertItem>
          );
        })}
      </AnimatePresence>
    </Container>
  );
}
