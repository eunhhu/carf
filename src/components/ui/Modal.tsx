import { type ReactNode, useEffect, useCallback } from "react";
import styled from "@emotion/styled";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { theme } from "../../styles";
import { IconButton } from "./Button";

// ============================================================================
// Types
// ============================================================================

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
}

// ============================================================================
// Styles
// ============================================================================

const sizeStyles: Record<string, string> = {
  sm: "max-width: 400px;",
  md: "max-width: 560px;",
  lg: "max-width: 720px;",
  xl: "max-width: 960px;",
  full: "max-width: calc(100vw - 48px); max-height: calc(100vh - 48px);",
};

const Overlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: ${theme.spacing.lg};
`;

const ModalContainer = styled(motion.div)<{ $size: string }>`
  background: ${theme.colors.bg.secondary};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.xl};
  width: 100%;
  ${({ $size }) => sizeStyles[$size]}
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: ${theme.shadow.lg};
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  border-bottom: 1px solid ${theme.colors.border.primary};
  flex-shrink: 0;
`;

const ModalTitle = styled.h2`
  font-size: ${theme.fontSize.lg};
  font-weight: 600;
  color: ${theme.colors.text.primary};
  margin: 0;
`;

const ModalBody = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${theme.spacing.lg};
`;

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  border-top: 1px solid ${theme.colors.border.primary};
  flex-shrink: 0;
`;

// ============================================================================
// Component
// ============================================================================

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  closeOnOverlay = true,
  closeOnEscape = true,
  showCloseButton = true,
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape) {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  return (
    <AnimatePresence>
      {open && (
        <Overlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeOnOverlay ? onClose : undefined}
        >
          <ModalContainer
            $size={size}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || showCloseButton) && (
              <ModalHeader>
                {title && <ModalTitle>{title}</ModalTitle>}
                {showCloseButton && (
                  <IconButton icon={X} size="sm" onClick={onClose} tooltip="Close" />
                )}
              </ModalHeader>
            )}
            <ModalBody>{children}</ModalBody>
          </ModalContainer>
        </Overlay>
      )}
    </AnimatePresence>
  );
}

// Export sub-components for custom layouts
Modal.Header = ModalHeader;
Modal.Title = ModalTitle;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
