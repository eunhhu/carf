import { useEffect, useState, useCallback } from 'react';
import { Global } from '@emotion/react';

import { globalStyles } from './styles';
import {
  LayoutContainer,
  MainArea,
  ContentArea,
  Sidebar,
  StatusBar,
  Navbar,
} from './components/layout';
import { TabPages } from './pages/TabPages';
import { AlertContainer } from './components/ui';

import { useFridaStore } from './features/frida';
import { useUIStore } from './stores/uiStore';

function App() {
  // Use Zustand for tab state persistence
  const { activeTab, setActiveTab, resetPanelStates } = useUIStore();
  // Track attached process info for navbar display
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
    resume,
    kill,
    agentRequest,
  } = useFridaStore();

  // Initialize Frida on mount
  useEffect(() => {
    init().catch(console.error);
  }, [init]);

  // Refresh processes when device changes
  useEffect(() => {
    if (selectedDeviceId) {
      refreshProcesses(selectedDeviceId).catch(console.error);
    }
  }, [selectedDeviceId, refreshProcesses]);

  // Auto-switch to attach tab when session is lost
  useEffect(() => {
    if (attachedSessionId === null && activeTab !== 'attach' && activeTab !== 'console' && activeTab !== 'settings') {
      setActiveTab('attach');
    }
  }, [attachedSessionId, activeTab, setActiveTab]);

  // Clear UI state when session/script is detached unexpectedly
  useEffect(() => {
    if (attachedSessionId === null) {
      setAttachedProcessInfo(null);
      resetPanelStates();
    }
  }, [attachedSessionId, resetPanelStates]);

  const hasSession = attachedSessionId !== null;
  const hasScript = loadedScriptId !== null;

  // Handle device change
  const handleDeviceChange = useCallback((deviceId: string) => {
    clearError();
    setSelectedDeviceId(deviceId);
  }, [clearError, setSelectedDeviceId]);

  // Handle attach - also store process info for navbar
  const handleAttach = useCallback(async (pid: number) => {
    clearError();
    const process = processes.find(p => p.pid === pid);
    const device = devices.find(d => d.id === selectedDeviceId);
    
    await attach(pid);
    
    if (process && device) {
      setAttachedProcessInfo({
        name: process.name,
        pid: process.pid,
        deviceName: device.name,
      });
    }
  }, [clearError, attach, processes, devices, selectedDeviceId]);

  // Handle detach - clear process info
  const handleDetach = useCallback(async () => {
    clearError();
    await detach();
    setAttachedProcessInfo(null);
  }, [clearError, detach]);

  // Handle spawn
  const handleSpawn = useCallback(async (program: string, argv: string[] | null): Promise<number | null> => {
    clearError();
    const pid = await spawn(program, argv);
    if (pid) {
      await refreshProcesses();
    }
    return pid;
  }, [clearError, spawn, refreshProcesses]);

  // Handle RPC call
  const handleRpcCall = useCallback(async (method: string, params?: unknown): Promise<unknown> => {
    if (!hasScript) {
      throw new Error('No script loaded');
    }
    return await agentRequest(method, params);
  }, [hasScript, agentRequest]);

  // Render active tab page (migrated to src/pages/*)
  const renderPanel = () => (
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
      onResume={resume}
      onKill={kill}
      hasScript={hasScript}
      onRpcCall={handleRpcCall}
      fridaVersion={fridaVersion}
    />
  );

  return (
    <>
      <Global styles={globalStyles} />
      <AlertContainer />
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
          />
          <ContentArea>
            {renderPanel()}
          </ContentArea>
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

export default App;
