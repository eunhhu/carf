import styled from '@emotion/styled';
import { theme } from '../../styles';

// Main layout container
export const LayoutContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: ${theme.colors.bg.primary};
  overflow: hidden;
`;

export const MainArea = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`;

export const ContentArea = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`;
