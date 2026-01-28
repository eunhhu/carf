import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import {
  Monitor,
  Cpu,
  Database,
  Code,
  Layers,
  GitBranch,
  Coffee,
  Apple,
  Terminal,
  Settings,
  BookOpen,
  PanelRightClose,
} from 'lucide-react';
import { theme } from '../../styles';

// Tab definitions
export type TabId = 'attach' | 'native' | 'memory' | 'methods' | 'thread' | 'objc' | 'swift' | 'java' | 'console' | 'settings';

type TabDef = {
  id: TabId;
  icon: React.ReactNode;
  label: string;
  requiresSession: boolean;
};

export const TABS: TabDef[] = [
  { id: 'attach', icon: <Monitor size={18} />, label: 'Attach', requiresSession: false },
  { id: 'native', icon: <Cpu size={18} />, label: 'Native', requiresSession: true },
  { id: 'memory', icon: <Database size={18} />, label: 'Memory', requiresSession: true },
  { id: 'methods', icon: <Code size={18} />, label: 'Methods', requiresSession: true },
  { id: 'thread', icon: <Layers size={18} />, label: 'Thread', requiresSession: true },
  { id: 'objc', icon: <GitBranch size={18} />, label: 'Obj-C', requiresSession: true },
  { id: 'swift', icon: <Apple size={18} />, label: 'Swift', requiresSession: true },
  { id: 'java', icon: <Coffee size={18} />, label: 'Java', requiresSession: true },
  { id: 'console', icon: <Terminal size={18} />, label: 'Console', requiresSession: false },
  { id: 'settings', icon: <Settings size={18} />, label: 'Settings', requiresSession: false },
];

// Styled components
const SidebarContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: ${theme.sidebar.width};
  background: ${theme.colors.bg.secondary};
  border-right: 1px solid ${theme.colors.border.primary};
`;

const TabList = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: ${theme.spacing.sm} 0;
`;

const TabButton = styled(motion.button)<{ $active: boolean; $disabled: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 44px;
  color: ${({ $active, $disabled }) =>
    $disabled
      ? theme.colors.text.muted
      : $active
        ? theme.colors.accent.primary
        : theme.colors.text.muted};
  background: ${({ $active }) => $active ? theme.colors.accent.muted : 'transparent'};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.3 : 1)};
  transition: all ${theme.transition.fast};
  border: none;

  &:hover:not(:disabled) {
    color: ${({ $disabled, $active }) => 
      $disabled ? theme.colors.text.muted : 
      $active ? theme.colors.accent.primary : theme.colors.text.primary};
    background: ${({ $active }) => $active ? theme.colors.accent.muted : theme.colors.bg.tertiary};
  }

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 3px;
    border-radius: 0 2px 2px 0;
    background: ${({ $active }) => ($active ? theme.colors.accent.primary : 'transparent')};
    transition: background ${theme.transition.fast};
  }
`;

const BottomTabs = styled.div`
  border-top: 1px solid ${theme.colors.border.primary};
  padding: ${theme.spacing.sm} 0;
`;

const PanelToggle = styled(motion.button)<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 44px;
  color: ${({ $active }) => ($active ? theme.colors.accent.primary : theme.colors.text.muted)};
  background: ${({ $active }) => ($active ? theme.colors.accent.muted : 'transparent')};
  cursor: pointer;
  transition: all ${theme.transition.fast};
  border: none;

  &:hover {
    color: ${({ $active }) => ($active ? theme.colors.accent.primary : theme.colors.text.primary)};
    background: ${({ $active }) => ($active ? theme.colors.accent.muted : theme.colors.bg.tertiary)};
  }
`;

type SidebarProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasSession: boolean;
  onToggleLibrary?: () => void;
  libraryOpen?: boolean;
};

export function Sidebar({ activeTab, onTabChange, hasSession, onToggleLibrary, libraryOpen }: SidebarProps) {
  const mainTabs = TABS.filter((t) => t.id !== 'console' && t.id !== 'settings');
  const bottomTabs = TABS.filter((t) => t.id === 'console' || t.id === 'settings');

  return (
    <SidebarContainer>
      <TabList>
        {mainTabs.map((tab) => {
          const disabled = tab.requiresSession && !hasSession;
          return (
            <TabItem
              key={tab.id}
              tab={tab}
              active={activeTab === tab.id}
              disabled={disabled}
              onClick={() => !disabled && onTabChange(tab.id)}
            />
          );
        })}
      </TabList>
      <BottomTabs>
        {/* Library panel toggle */}
        {onToggleLibrary && (
          <PanelToggle
            $active={!!libraryOpen}
            onClick={onToggleLibrary}
            whileTap={{ scale: 0.95 }}
            title={libraryOpen ? 'Hide Library' : 'Show Library'}
          >
            {libraryOpen ? <PanelRightClose size={18} /> : <BookOpen size={18} />}
          </PanelToggle>
        )}
        {bottomTabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            active={activeTab === tab.id}
            disabled={false}
            onClick={() => onTabChange(tab.id)}
          />
        ))}
      </BottomTabs>
    </SidebarContainer>
  );
}

type TabItemProps = {
  tab: TabDef;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
};

function TabItem({ tab, active, disabled, onClick }: TabItemProps) {
  return (
    <TabButton
      $active={active}
      $disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? {} : { scale: 0.95 }}
      title={tab.label}
    >
      {tab.icon}
    </TabButton>
  );
}
