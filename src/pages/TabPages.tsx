import type { TabId } from '../components/layout';
import type { DeviceInfo, ProcessInfo } from '../features/frida/types';

import { AttachPage } from './attach';
import { NativePage } from './native';
import { MemoryPage } from './memory';
import { MethodsPage } from './methods';
import { ThreadPage } from './thread';
import { ObjcPage } from './objc';
import { SwiftPage } from './swift';
import { JavaPage } from './java';
import { ConsolePage } from './console';
import { SettingsPage } from './settings';

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
  onResume: (pid: number) => void;
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
  onResume,
  onKill,
  hasScript,
  onRpcCall,
  fridaVersion,
}: TabPagesProps) {
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
          onResume={onResume}
          onKill={onKill}
        />
      );

    case 'native':
      return <NativePage hasSession={hasScript} onRpcCall={onRpcCall} />;

    case 'memory':
      return <MemoryPage hasSession={hasScript} onRpcCall={onRpcCall} />;

    case 'methods':
      return <MethodsPage hasSession={hasScript} onRpcCall={onRpcCall} />;

    case 'thread':
      return <ThreadPage hasSession={hasScript} onRpcCall={onRpcCall} />;

    case 'objc':
      return <ObjcPage hasSession={hasScript} onRpcCall={onRpcCall} />;

    case 'swift':
      return <SwiftPage hasSession={hasScript} onRpcCall={onRpcCall} />;

    case 'java':
      return <JavaPage hasSession={hasScript} onRpcCall={onRpcCall} />;

    case 'console':
      return <ConsolePage />;

    case 'settings':
      return <SettingsPage fridaVersion={fridaVersion} />;

    default:
      return <ConsolePage />;
  }
}
