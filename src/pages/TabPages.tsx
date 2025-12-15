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
  const sessionKey = scriptId ?? sessionId ?? "no-session";

  return (
    <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          display: activeTab === 'attach' ? 'flex' : 'none',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <AttachPage
          key={`attach-${sessionKey}`}
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
      </div>

      <div
        style={{
          display: activeTab === 'native' ? 'flex' : 'none',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <NativePage key={`native-${sessionKey}`} hasSession={hasScript} onRpcCall={onRpcCall} />
      </div>

      <div
        style={{
          display: activeTab === 'memory' ? 'flex' : 'none',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <MemoryPage key={`memory-${sessionKey}`} hasSession={hasScript} onRpcCall={onRpcCall} />
      </div>

      <div
        style={{
          display: activeTab === 'methods' ? 'flex' : 'none',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <MethodsPage key={`methods-${sessionKey}`} hasSession={hasScript} onRpcCall={onRpcCall} />
      </div>

      <div
        style={{
          display: activeTab === 'thread' ? 'flex' : 'none',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <ThreadPage key={`thread-${sessionKey}`} hasSession={hasScript} onRpcCall={onRpcCall} />
      </div>

      <div
        style={{
          display: activeTab === 'objc' ? 'flex' : 'none',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <ObjcPage key={`objc-${sessionKey}`} hasSession={hasScript} onRpcCall={onRpcCall} />
      </div>

      <div
        style={{
          display: activeTab === 'swift' ? 'flex' : 'none',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <SwiftPage key={`swift-${sessionKey}`} hasSession={hasScript} onRpcCall={onRpcCall} />
      </div>

      <div
        style={{
          display: activeTab === 'java' ? 'flex' : 'none',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <JavaPage key={`java-${sessionKey}`} hasSession={hasScript} onRpcCall={onRpcCall} />
      </div>

      <div
        style={{
          display: activeTab === 'console' ? 'flex' : 'none',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <ConsolePage key={`console-${sessionKey}`} />
      </div>

      <div
        style={{
          display: activeTab === 'settings' ? 'flex' : 'none',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <SettingsPage key={`settings-${sessionKey}`} fridaVersion={fridaVersion} />
      </div>
    </div>
  );
}
