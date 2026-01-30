import { useEffect, useState, useCallback, useMemo } from 'react';
import { Global } from '@emotion/react';
import { Group, Panel, Separator, type PanelSize } from 'react-resizable-panels';
import styled from '@emotion/styled';

import { globalStyles, theme } from './styles';
import {
  LayoutContainer,
  MainArea,
  Sidebar,
  StatusBar,
  Navbar,
} from './components/layout';
import type { TabId } from './components/layout/Sidebar';
import { TabPages } from './pages/TabPages';
import { AlertContainer, CommandPalette, type CommandItem } from './components/ui';
import { LibraryPanel } from './components/panels/LibraryPanel';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';

import { useFridaStore } from './features/frida';
import { useUIStore } from './stores/uiStore';
import { useLayoutStore } from './stores/layoutStore';
import { useLibraryStore } from './stores/libraryStore';
import { useGlobalShortcuts } from './hooks/useKeyboardShortcuts';
import { setTabSwitchCallback } from './stores/actionStore';

// Styled components for the new layout
const ContentWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`;

const MainPanelGroup = styled(Group)`
  flex: 1;
`;

const VerticalPanelGroup = styled(Group)`
  height: 100%;
`;

const MainContent = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const HorizontalResizeHandle = styled(Separator)`
  width: 1px;
  cursor: col-resize;
  background: ${theme.colors.border.primary};
  transition: background ${theme.transition.fast};
  position: relative;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    right: -3px;
    z-index: 10;
  }

  &:hover,
  &[data-resize-handle-active] {
    background: ${theme.colors.accent.primary};
  }
`;

const VerticalResizeHandle = styled(Separator)`
  height: 1px;
  cursor: row-resize;
  background: ${theme.colors.border.primary};
  transition: background ${theme.transition.fast};
  position: relative;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: -3px;
    bottom: -3px;
    z-index: 10;
  }

  &:hover,
  &[data-resize-handle-active] {
    background: ${theme.colors.accent.primary};
  }
`;

const SidePanelWrapper = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  background: ${theme.colors.bg.secondary};
  border-left: 1px solid ${theme.colors.border.primary};
`;

const BottomPanelWrapper = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  background: ${theme.colors.bg.secondary};
  border-top: 1px solid ${theme.colors.border.primary};
`;

const BottomPanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  background: ${theme.colors.bg.tertiary};
  border-bottom: 1px solid ${theme.colors.border.primary};
  min-height: 28px;
`;

const BottomPanelTitle = styled.span`
  font-size: ${theme.fontSize.xs};
  font-weight: ${theme.fontWeight.medium};
  color: ${theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const BottomPanelContent = styled.div`
  flex: 1;
  overflow: auto;
`;

function AppContent() {
  const { activeTab, setActiveTab, resetPanelStates } = useUIStore();
  const {
    rightPanelOpen,
    rightPanelSize,
    setRightPanelSize,
    toggleRightPanel,
    bottomPanelOpen,
    bottomPanelSize,
    setBottomPanelSize,
    toggleBottomPanel,
    openCommandPalette,
  } = useLayoutStore();

  const [attachedProcessInfo, setAttachedProcessInfo] = useState<{
    name: string;
    pid: number;
    deviceName: string;
  } | null>(null);

  const {
    busy,
    version: fridaVersion,
    devices,
    selectedDeviceId,
    processes,
    attachedSessionId,
    loadedScriptId,
    init,
    clearError,
    setSelectedDeviceId,
    refreshDevices,
    refreshProcesses,
    attach,
    detach,
    spawn,
    kill,
    agentRequest,
  } = useFridaStore();

  // Initialize Frida and Library on mount
  useEffect(() => {
    init().catch(console.error);
  }, [init]);

  // Connect action store's tab switch callback
  useEffect(() => {
    setTabSwitchCallback(setActiveTab);
  }, [setActiveTab]);

  const { loadLibrary, initialized: libraryInitialized } = useLibraryStore();
  useEffect(() => {
    if (!libraryInitialized) {
      loadLibrary().catch(console.error);
    }
  }, [libraryInitialized, loadLibrary]);

  // Refresh processes when device changes
  useEffect(() => {
    if (selectedDeviceId) {
      refreshProcesses(selectedDeviceId).catch(console.error);
    }
  }, [selectedDeviceId, refreshProcesses]);

  // Auto-switch to attach tab when session is lost
  useEffect(() => {
    if (
      attachedSessionId === null &&
      activeTab !== 'attach' &&
      activeTab !== 'console' &&
      activeTab !== 'settings'
    ) {
      setActiveTab('attach');
    }
  }, [attachedSessionId, activeTab, setActiveTab]);

  // Clear UI state when session/script is detached
  useEffect(() => {
    if (attachedSessionId === null) {
      setAttachedProcessInfo(null);
      resetPanelStates();
    }
  }, [attachedSessionId, resetPanelStates]);

  const hasSession = attachedSessionId !== null;
  const hasScript = loadedScriptId !== null;

  // Handlers
  const handleDeviceChange = useCallback(
    (deviceId: string) => {
      clearError();
      setSelectedDeviceId(deviceId);
    },
    [clearError, setSelectedDeviceId]
  );

  const handleAttach = useCallback(
    async (pid: number) => {
      clearError();
      const process = processes.find((p) => p.pid === pid);
      const device = devices.find((d) => d.id === selectedDeviceId);

      try {
        await attach(pid);

        if (process && device) {
          setAttachedProcessInfo({
            name: process.name,
            pid: process.pid,
            deviceName: device.name,
          });
        }
      } catch (err) {
        // Error is already handled by withErrorHandling in the store
        // Just log it here to prevent unhandled promise rejection
        console.error('Attach failed:', err);
      }
    },
    [clearError, attach, processes, devices, selectedDeviceId]
  );

  const handleDetach = useCallback(async () => {
    clearError();
    await detach();
    setAttachedProcessInfo(null);
  }, [clearError, detach]);

  const handleSpawn = useCallback(
    async (program: string, argv: string[] | null): Promise<number | null> => {
      clearError();
      const pid = await spawn(program, argv);
      if (pid) {
        await refreshProcesses();
      }
      return pid;
    },
    [clearError, spawn, refreshProcesses]
  );

  const handleRpcCall = useCallback(
    async (method: string, params?: unknown): Promise<unknown> => {
      if (!hasScript) {
        throw new Error('No script loaded');
      }
      return await agentRequest(method, params);
    },
    [hasScript, agentRequest]
  );

  // Handle panel resize
  const handleBottomPanelResize = useCallback(
    (panelSize: PanelSize) => {
      setBottomPanelSize(panelSize.asPercentage);
    },
    [setBottomPanelSize]
  );

  const handleRightPanelResize = useCallback(
    (panelSize: PanelSize) => {
      setRightPanelSize(panelSize.asPercentage);
    },
    [setRightPanelSize]
  );

  // Handle tab switch with proper type
  const handleSwitchTab = useCallback(
    (tab: string) => {
      setActiveTab(tab as TabId);
    },
    [setActiveTab]
  );

  // Global keyboard shortcuts
  useGlobalShortcuts({
    onOpenCommandPalette: openCommandPalette,
    onOpenSettings: () => setActiveTab('settings'),
    onToggleLibrary: toggleRightPanel,
    onToggleConsole: toggleBottomPanel,
    onSwitchTab: handleSwitchTab,
  });

  // Command palette commands
  const commands: CommandItem[] = useMemo(
    () => [
      // Navigation
      {
        id: 'nav:attach',
        title: 'Go to Attach',
        category: 'Navigation',
        action: () => setActiveTab('attach'),
        keywords: ['device', 'process', 'connect'],
      },
      {
        id: 'nav:native',
        title: 'Go to Native',
        category: 'Navigation',
        action: () => setActiveTab('native'),
        keywords: ['module', 'export', 'import', 'symbol'],
      },
      {
        id: 'nav:memory',
        title: 'Go to Memory',
        category: 'Navigation',
        action: () => setActiveTab('memory'),
        keywords: ['hex', 'read', 'write', 'scan'],
      },
      {
        id: 'nav:methods',
        title: 'Go to Methods',
        category: 'Navigation',
        action: () => setActiveTab('methods'),
        keywords: ['rpc', 'call', 'function'],
      },
      {
        id: 'nav:thread',
        title: 'Go to Thread',
        category: 'Navigation',
        action: () => setActiveTab('thread'),
        keywords: ['backtrace', 'stack', 'cpu'],
      },
      {
        id: 'nav:objc',
        title: 'Go to ObjC',
        category: 'Navigation',
        action: () => setActiveTab('objc'),
        keywords: ['objective-c', 'ios', 'class'],
      },
      {
        id: 'nav:java',
        title: 'Go to Java',
        category: 'Navigation',
        action: () => setActiveTab('java'),
        keywords: ['android', 'class', 'method'],
      },
      {
        id: 'nav:console',
        title: 'Go to Console',
        category: 'Navigation',
        action: () => setActiveTab('console'),
        keywords: ['log', 'output', 'debug'],
      },
      {
        id: 'nav:settings',
        title: 'Go to Settings',
        shortcut: 'mod+,',
        category: 'Navigation',
        action: () => setActiveTab('settings'),
        keywords: ['preferences', 'config'],
      },
      // Actions
      {
        id: 'action:detach',
        title: 'Detach from Process',
        category: 'Actions',
        action: handleDetach,
        keywords: ['disconnect', 'close'],
      },
      {
        id: 'action:refresh-devices',
        title: 'Refresh Devices',
        category: 'Actions',
        action: refreshDevices,
        keywords: ['reload', 'update'],
      },
      {
        id: 'action:refresh-processes',
        title: 'Refresh Processes',
        category: 'Actions',
        action: () => refreshProcesses(),
        keywords: ['reload', 'update'],
      },
      // Library
      {
        id: 'library:toggle',
        title: 'Toggle Library Panel',
        shortcut: 'mod+shift+l',
        category: 'Library',
        action: toggleRightPanel,
        keywords: ['sidebar', 'saved'],
      },
      // Tools
      {
        id: 'tool:console',
        title: 'Toggle Console Panel',
        shortcut: 'mod+`',
        category: 'Tools',
        action: toggleBottomPanel,
        keywords: ['log', 'output'],
      },
    ],
    [
      setActiveTab,
      handleDetach,
      refreshDevices,
      refreshProcesses,
      toggleRightPanel,
      toggleBottomPanel,
    ]
  );

  return (
    <>
      <Global styles={globalStyles} />
      <AlertContainer />
      <CommandPalette commands={commands} />

      <LayoutContainer>
        <Navbar
          processName={attachedProcessInfo?.name ?? null}
          processPid={attachedProcessInfo?.pid ?? null}
          deviceName={attachedProcessInfo?.deviceName ?? null}
          scriptId={loadedScriptId}
          busy={busy}
          onDetach={handleDetach}
        />

        <MainArea>
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            hasSession={hasSession}
            onToggleLibrary={toggleRightPanel}
            libraryOpen={rightPanelOpen}
          />

          <ContentWrapper>
            <MainPanelGroup orientation="horizontal">
              {/* Main content + bottom panel */}
              <Panel id="main-content" minSize={50}>
                <VerticalPanelGroup orientation="vertical">
                  {/* Main tab content */}
                  <Panel id="tab-content" minSize={30}>
                    <MainContent>
                      <TabPages
                        activeTab={activeTab}
                        devices={devices}
                        processes={processes}
                        selectedDeviceId={selectedDeviceId}
                        sessionId={attachedSessionId}
                        scriptId={loadedScriptId}
                        busy={busy}
                        onDeviceChange={handleDeviceChange}
                        onRefreshDevices={refreshDevices}
                        onRefreshProcesses={() => refreshProcesses()}
                        onAttach={handleAttach}
                        onDetach={handleDetach}
                        onSpawn={handleSpawn}
                        onKill={kill}
                        hasScript={hasScript}
                        onRpcCall={handleRpcCall}
                        fridaVersion={fridaVersion}
                      />
                    </MainContent>
                  </Panel>

                  {/* Bottom panel (Console) */}
                  {bottomPanelOpen && (
                    <>
                      <VerticalResizeHandle />
                      <Panel
                        id="console-panel"
                        defaultSize={bottomPanelSize}
                        minSize={15}
                        maxSize={60}
                        onResize={handleBottomPanelResize}
                      >
                        <BottomPanelWrapper>
                          <BottomPanelHeader>
                            <BottomPanelTitle>Console</BottomPanelTitle>
                          </BottomPanelHeader>
                          <BottomPanelContent>
                            {/* Console content will be rendered by TabPages when console is selected */}
                            <div style={{ padding: theme.spacing.md, color: theme.colors.text.muted, fontSize: theme.fontSize.sm }}>
                              Console output will appear here when attached to a process.
                            </div>
                          </BottomPanelContent>
                        </BottomPanelWrapper>
                      </Panel>
                    </>
                  )}
                </VerticalPanelGroup>
              </Panel>

              {/* Right panel (Library) */}
              {rightPanelOpen && (
                <>
                  <HorizontalResizeHandle />
                  <Panel
                    id="library-panel"
                    defaultSize={rightPanelSize}
                    minSize="250px"
                    maxSize="500px"
                    onResize={handleRightPanelResize}
                  >
                    <SidePanelWrapper>
                      <LibraryPanel />
                    </SidePanelWrapper>
                  </Panel>
                </>
              )}
            </MainPanelGroup>
          </ContentWrapper>
        </MainArea>

        <StatusBar
          fridaVersion={fridaVersion}
          deviceCount={devices.length}
          processCount={processes.length}
          sessionId={attachedSessionId}
          scriptId={loadedScriptId}
          busy={busy}
        />
      </LayoutContainer>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
