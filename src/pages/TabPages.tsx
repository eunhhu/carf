import { lazy, Suspense, useMemo } from 'react';
import type { TabId } from '../components/layout';
import type { DeviceInfo, ProcessInfo } from '../features/frida/types';
import { Spinner, Text } from '../components/ui/Layout';
import { EmptyState } from '../components/ui/Table';

import { AttachPage } from './attach';
import { SettingsPage } from './settings';

// Lazy load heavy pages to improve tab switching performance
const NativePage = lazy(() => import('./native').then(m => ({ default: m.NativePage })));
const MemoryPage = lazy(() => import('./memory').then(m => ({ default: m.MemoryPage })));
const MethodsPage = lazy(() => import('./methods').then(m => ({ default: m.MethodsPage })));
const ThreadPage = lazy(() => import('./thread').then(m => ({ default: m.ThreadPage })));
const ObjcPage = lazy(() => import('./objc').then(m => ({ default: m.ObjcPage })));
const SwiftPage = lazy(() => import('./swift').then(m => ({ default: m.SwiftPage })));
const JavaPage = lazy(() => import('./java').then(m => ({ default: m.JavaPage })));
const ConsolePage = lazy(() => import('./console').then(m => ({ default: m.ConsolePage })));

// Loading fallback
function PageLoader() {
  return (
    <EmptyState style={{ height: '100%' }}>
      <Spinner />
      <Text $color="muted">Loading...</Text>
    </EmptyState>
  );
}

type TabPagesProps = {
  activeTab: TabId;

  // Attach
  devices: DeviceInfo[];
  processes: ProcessInfo[];
  selectedDeviceId: string;
  sessionId: number | null;
  scriptId: number | null;
  busy: boolean;
  onDeviceChange: (deviceId: string) => void;
  onRefreshDevices: () => void;
  onRefreshProcesses: () => void;
  onAttach: (pid: number) => void;
  onDetach: () => void;
  onSpawn: (program: string, argv: string[] | null) => Promise<number | null>;
  onKill: (pid: number) => void;

  // RPC
  hasScript: boolean;
  onRpcCall: (method: string, params?: unknown) => Promise<unknown>;

  // Settings
  fridaVersion: string;
};

export function TabPages({
  activeTab,
  devices,
  processes,
  selectedDeviceId,
  sessionId,
  scriptId,
  busy,
  onDeviceChange,
  onRefreshDevices,
  onRefreshProcesses,
  onAttach,
  onDetach,
  onSpawn,
  onKill,
  hasScript,
  onRpcCall,
  fridaVersion,
}: TabPagesProps) {
  const containerStyle = useMemo(() => ({
    display: 'flex',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  }), []);

  // Render only the active tab for better performance
  const renderContent = () => {
    switch (activeTab) {
      case 'attach':
        return (
          <AttachPage
            devices={devices}
            processes={processes}
            selectedDeviceId={selectedDeviceId}
            sessionId={sessionId}
            scriptId={scriptId}
            busy={busy}
            onDeviceChange={onDeviceChange}
            onRefreshDevices={onRefreshDevices}
            onRefreshProcesses={onRefreshProcesses}
            onAttach={onAttach}
            onDetach={onDetach}
            onSpawn={onSpawn}
            onKill={onKill}
          />
        );

      case 'native':
        return (
          <Suspense fallback={<PageLoader />}>
            <NativePage hasSession={hasScript} onRpcCall={onRpcCall} />
          </Suspense>
        );

      case 'memory':
        return (
          <Suspense fallback={<PageLoader />}>
            <MemoryPage hasSession={hasScript} onRpcCall={onRpcCall} />
          </Suspense>
        );

      case 'methods':
        return (
          <Suspense fallback={<PageLoader />}>
            <MethodsPage hasSession={hasScript} onRpcCall={onRpcCall} />
          </Suspense>
        );

      case 'thread':
        return (
          <Suspense fallback={<PageLoader />}>
            <ThreadPage hasSession={hasScript} onRpcCall={onRpcCall} />
          </Suspense>
        );

      case 'objc':
        return (
          <Suspense fallback={<PageLoader />}>
            <ObjcPage hasSession={hasScript} onRpcCall={onRpcCall} />
          </Suspense>
        );

      case 'swift':
        return (
          <Suspense fallback={<PageLoader />}>
            <SwiftPage hasSession={hasScript} onRpcCall={onRpcCall} />
          </Suspense>
        );

      case 'java':
        return (
          <Suspense fallback={<PageLoader />}>
            <JavaPage hasSession={hasScript} onRpcCall={onRpcCall} />
          </Suspense>
        );

      case 'console':
        return (
          <Suspense fallback={<PageLoader />}>
            <ConsolePage />
          </Suspense>
        );

      case 'settings':
        return <SettingsPage fridaVersion={fridaVersion} />;

      default:
        return null;
    }
  };

  return (
    <div style={containerStyle}>
      {renderContent()}
    </div>
  );
}
