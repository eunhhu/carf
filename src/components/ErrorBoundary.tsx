import { Component, type ReactNode } from 'react';
import styled from '@emotion/styled';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { theme } from '../styles';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: ${theme.spacing.xl};
  background: ${theme.colors.bg.primary};
  color: ${theme.colors.text.primary};
`;

const ErrorIcon = styled.div`
  color: ${theme.colors.status.error};
  margin-bottom: ${theme.spacing.md};
`;

const ErrorTitle = styled.h2`
  font-size: ${theme.fontSize.lg};
  font-weight: ${theme.fontWeight.semibold};
  margin: 0 0 ${theme.spacing.sm} 0;
  color: ${theme.colors.text.primary};
`;

const ErrorMessage = styled.p`
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.secondary};
  margin: 0 0 ${theme.spacing.md} 0;
  text-align: center;
  max-width: 400px;
`;

const ErrorDetails = styled.pre`
  font-size: ${theme.fontSize.xs};
  font-family: "SF Mono", "Consolas", monospace;
  background: ${theme.colors.bg.tertiary};
  border: 1px solid ${theme.colors.border.primary};
  border-radius: ${theme.borderRadius.md};
  padding: ${theme.spacing.md};
  margin: 0 0 ${theme.spacing.md} 0;
  max-width: 600px;
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  color: ${theme.colors.status.error};
`;

const ReloadButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.accent.primary};
  color: white;
  border: none;
  border-radius: ${theme.borderRadius.md};
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
  transition: background ${theme.transition.fast};

  &:hover {
    background: ${theme.colors.accent.secondary};
  }
`;

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorContainer>
          <ErrorIcon>
            <AlertTriangle size={48} />
          </ErrorIcon>
          <ErrorTitle>Something went wrong</ErrorTitle>
          <ErrorMessage>
            An unexpected error occurred. This might be due to a disconnected session
            or an internal error.
          </ErrorMessage>
          {this.state.error && (
            <ErrorDetails>
              {this.state.error.message}
              {this.state.errorInfo?.componentStack && (
                <>
                  {'\n\nComponent Stack:'}
                  {this.state.errorInfo.componentStack}
                </>
              )}
            </ErrorDetails>
          )}
          <ReloadButton onClick={this.handleReload}>
            <RefreshCw size={16} />
            Reload Application
          </ReloadButton>
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
}
