import { useState } from 'react';
import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import { theme } from '../../styles';
import { PanelContainer, PanelContent, PanelSection, PanelSectionTitle } from '../common/Panel';
import carfLogo from '../../assets/carf.svg';

const SettingsCard = styled.div`
  padding: ${theme.spacing.md};
  background: ${theme.colors.bg.tertiary};
  border-radius: ${theme.borderRadius.md};
  border: 1px solid ${theme.colors.border.primary};
  margin-bottom: ${theme.spacing.md};
`;

const SettingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.sm} 0;
  border-bottom: 1px solid ${theme.colors.border.primary};
  
  &:last-child {
    border-bottom: none;
  }
`;

const SettingLabel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
`;

const SettingTitle = styled.span`
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.primary};
`;

const SettingDescription = styled.span`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.text.muted};
`;

const Toggle = styled(motion.button)<{ $active: boolean }>`
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: ${({ $active }) => ($active ? theme.colors.accent.primary : theme.colors.bg.hover)};
  position: relative;
  cursor: pointer;
  transition: background ${theme.transition.fast};
  
  &::after {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: white;
    top: 2px;
    left: ${({ $active }) => ($active ? '20px' : '2px')};
    transition: left ${theme.transition.fast};
  }
`;

const AboutSection = styled.div`
  text-align: center;
  padding: ${theme.spacing.xl};
`;

const AppLogo = styled.img`
  width: 48px;
  height: 48px;
`;

const AppName = styled.h1`
  font-size: ${theme.fontSize.xl};
  font-weight: 700;
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.xs};
`;

const AppVersion = styled.span`
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.muted};
`;

const AppDescription = styled.p`
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.text.secondary};
  margin-top: ${theme.spacing.md};
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
`;

type SettingsPanelProps = {
  fridaVersion: string | null;
};

export function SettingsPanel({ fridaVersion }: SettingsPanelProps) {
  const [autoLoadScript, setAutoLoadScript] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [debugMode, setDebugMode] = useState(false);

  return (
    <PanelContainer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <PanelContent>
        {/* About */}
        <PanelSection>
          <AboutSection>
            <AppLogo src={carfLogo} alt="CARF" />
            <AppName>CARF</AppName>
            <AppVersion>v0.1.0</AppVersion>
            <AppDescription>
              Cross-platform Application Research Framework
              <br />
              Powered by Frida {fridaVersion || 'N/A'}
            </AppDescription>
          </AboutSection>
        </PanelSection>

        {/* General Settings */}
        <PanelSection>
          <PanelSectionTitle>General</PanelSectionTitle>
          <SettingsCard>
            <SettingRow>
              <SettingLabel>
                <SettingTitle>Auto-load Script</SettingTitle>
                <SettingDescription>Automatically load default script on attach</SettingDescription>
              </SettingLabel>
              <Toggle
                $active={autoLoadScript}
                onClick={() => setAutoLoadScript(!autoLoadScript)}
                whileTap={{ scale: 0.95 }}
              />
            </SettingRow>

            <SettingRow>
              <SettingLabel>
                <SettingTitle>Dark Mode</SettingTitle>
                <SettingDescription>Use dark theme (only dark mode available)</SettingDescription>
              </SettingLabel>
              <Toggle
                $active={darkMode}
                onClick={() => setDarkMode(!darkMode)}
                whileTap={{ scale: 0.95 }}
              />
            </SettingRow>

            <SettingRow>
              <SettingLabel>
                <SettingTitle>Debug Mode</SettingTitle>
                <SettingDescription>Show verbose logging in console</SettingDescription>
              </SettingLabel>
              <Toggle
                $active={debugMode}
                onClick={() => setDebugMode(!debugMode)}
                whileTap={{ scale: 0.95 }}
              />
            </SettingRow>
          </SettingsCard>
        </PanelSection>

        {/* System Info */}
        <PanelSection>
          <PanelSectionTitle>System Information</PanelSectionTitle>
          <SettingsCard>
            <SettingRow>
              <SettingLabel>
                <SettingTitle>Frida Core Version</SettingTitle>
              </SettingLabel>
              <span style={{ fontFamily: 'Consolas', color: theme.colors.text.accent }}>
                {fridaVersion || 'Loading...'}
              </span>
            </SettingRow>
            <SettingRow>
              <SettingLabel>
                <SettingTitle>Platform</SettingTitle>
              </SettingLabel>
              <span style={{ fontFamily: 'Consolas', color: theme.colors.text.accent }}>
                {navigator.platform}
              </span>
            </SettingRow>
          </SettingsCard>
        </PanelSection>
      </PanelContent>
    </PanelContainer>
  );
}
