import { useEffect, useState, useCallback } from 'react';
import { Global } from '@emotion/react';
import { GitBranch, Apple, Coffee } from 'lucide-react';

import { globalStyles } from './styles';
import {
  LayoutContainer,
  MainArea,
  ContentArea,
  Sidebar,
  StatusBar,
} from './components/layout';
import type { TabId } from './components/layout';
import {
  AttachPanel,
  NativePanel,
  MemoryPanel,
  MethodsPanel,
  ThreadPanel,
  ConsolePanel,
  SettingsPanel,
  PlaceholderPanel,
} from './components/panels';

import { useFridaStore } from './features/frida';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('attach');

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
    loadDefaultScript,
    unloadScript,
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
  }, [attachedSessionId, activeTab]);

  const hasSession = attachedSessionId !== null;
  const hasScript = loadedScriptId !== null;

  // Handle device change
  const handleDeviceChange = useCallback((deviceId: string) => {
    clearError();
    setSelectedDeviceId(deviceId);
  }, [clearError, setSelectedDeviceId]);

  // Handle attach
  const handleAttach = useCallback(async (pid: number) => {
    clearError();
    await attach(pid);
  }, [clearError, attach]);

  // Handle detach
  const handleDetach = useCallback(async () => {
    clearError();
    await detach();
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

  // Render active panel
  const renderPanel = () => {
    switch (activeTab) {
      case 'attach':
        return (
          <AttachPanel
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
            onLoadScript={loadDefaultScript}
            onUnloadScript={unloadScript}
          />
        );

      case 'native':
        return <NativePanel hasSession={hasScript} onRpcCall={handleRpcCall} />;

      case 'memory':
        return <MemoryPanel hasSession={hasScript} onRpcCall={handleRpcCall} />;

      case 'methods':
        return <MethodsPanel hasSession={hasScript} onRpcCall={handleRpcCall} />;

      case 'thread':
        return <ThreadPanel hasSession={hasScript} onRpcCall={handleRpcCall} />;

      case 'objc':
        return (
          <PlaceholderPanel
            title="Objective-C Runtime"
            description="Explore Objective-C classes, methods, and runtime information."
            icon={<GitBranch size={48} strokeWidth={1} />}
          />
        );

      case 'swift':
        return (
          <PlaceholderPanel
            title="Swift Runtime"
            description="Inspect Swift types, protocols, and metadata."
            icon={<Apple size={48} strokeWidth={1} />}
          />
        );

      case 'java':
        return (
          <PlaceholderPanel
            title="Java/Android Runtime"
            description="Browse Java classes, hook methods, and trace execution."
            icon={<Coffee size={48} strokeWidth={1} />}
          />
        );

      case 'console':
        return <ConsolePanel />;

      case 'settings':
        return <SettingsPanel fridaVersion={fridaVersion} />;

      default:
        return <PlaceholderPanel title="Unknown Tab" />;
    }
  };

  return (
    <>
      <Global styles={globalStyles} />
      <LayoutContainer>
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
