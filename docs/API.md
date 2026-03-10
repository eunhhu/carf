# CARF — API Specification

> Tauri IPC Commands, Events, Agent RPC Methods 전체 명세

---

## 목차

1. [개요](#1-개요)
2. [Tauri IPC Commands](#2-tauri-ipc-commands)
   - 2.1 [Device Commands](#21-device-commands)
   - 2.2 [Process Commands](#22-process-commands)
   - 2.3 [Session Commands](#23-session-commands)
   - 2.4 [Agent RPC Proxy](#24-agent-rpc-proxy)
   - 2.5 [ADB Commands](#25-adb-commands)
3. [Tauri Events (Backend → Frontend)](#3-tauri-events)
4. [Agent RPC Methods](#4-agent-rpc-methods)
   - 4.1 [Process / Module](#41-process--module)
   - 4.2 [Thread](#42-thread)
   - 4.3 [Memory](#43-memory)
   - 4.4 [Java](#44-java)
   - 4.5 [ObjC](#45-objc)
   - 4.6 [Native](#46-native)
   - 4.7 [Stalker](#47-stalker)
   - 4.8 [Hook Management](#48-hook-management)
5. [Type Definitions](#5-type-definitions)
6. [Error Codes](#6-error-codes)

---

## 1. 개요

CARF는 3-Layer 구조로 통신한다.

```
Frontend (SolidJS)  ──Tauri IPC──>  Backend (Rust/Tauri 2)  ──Frida RPC──>  Agent (CARF Std Script)
```

| 통신 경로 | 프로토콜 | 방향 | 설명 |
|-----------|----------|------|------|
| Frontend → Backend | `invoke(cmd, args)` | Request / Response | IPC 커맨드 호출 |
| Backend → Frontend | `emit(event, payload)` | Push | 이벤트 스트리밍 |
| Backend → Agent | `script.exports.call(method, params)` | Request / Response | Agent RPC 호출 |
| Agent → Backend | `send(message)` | Push | 이벤트/데이터 전달 |

### 호출 규칙

- 모든 IPC 커맨드는 `async`이며, `Result<T, AppError>`를 반환한다.
- Frontend에서는 `lib/tauri.ts`의 `invoke<T>()` 래퍼를 통해 호출한다.
- Agent RPC는 반드시 `rpc_call` 프록시 커맨드를 통해 호출한다 (Frontend → Backend → Agent).
- 이벤트 이름은 `carf://` 접두어를 사용한다.

---

## 2. Tauri IPC Commands

### 2.1 Device Commands

#### `list_devices`

연결된 모든 Frida 디바이스 목록을 반환한다.

| 항목 | 값 |
|------|-----|
| **Command** | `list_devices` |
| **Parameters** | 없음 |
| **Returns** | `DeviceInfo[]` |

```typescript
// Frontend 호출 예시
const devices = await invoke<DeviceInfo[]>("list_devices");
```

```json
// 응답 예시
[
  {
    "id": "local",
    "name": "Local System",
    "type": "local",
    "icon": null,
    "os": { "platform": "macos", "version": "15.3" },
    "arch": "arm64",
    "status": "connected"
  },
  {
    "id": "emulator-5554",
    "name": "Android Emulator 5554",
    "type": "usb",
    "icon": null,
    "os": { "platform": "android", "version": "14" },
    "arch": "x86_64",
    "status": "connected"
  }
]
```

---

#### `add_remote_device`

원격 Frida 디바이스를 추가한다.

| 항목 | 값 |
|------|-----|
| **Command** | `add_remote_device` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `DeviceInfo` |
| **Errors** | `CONNECTION_FAILED`, `INVALID_ADDRESS` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `address` | `string` | Y | 원격 디바이스 주소 (`host:port` 형식) |

```typescript
const device = await invoke<DeviceInfo>("add_remote_device", {
  address: "192.168.1.100:27042"
});
```

---

#### `remove_remote_device`

등록된 원격 Frida 디바이스를 제거한다.

| 항목 | 값 |
|------|-----|
| **Command** | `remove_remote_device` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |
| **Errors** | `DEVICE_NOT_FOUND` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `address` | `string` | Y | 제거할 원격 디바이스 주소 |

```typescript
await invoke("remove_remote_device", { address: "192.168.1.100:27042" });
```

---

#### `get_device_info`

특정 디바이스의 상세 정보를 조회한다.

| 항목 | 값 |
|------|-----|
| **Command** | `get_device_info` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `DeviceDetailInfo` |
| **Errors** | `DEVICE_NOT_FOUND` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `device_id` | `string` | Y | 디바이스 ID |

```typescript
const detail = await invoke<DeviceDetailInfo>("get_device_info", {
  device_id: "emulator-5554"
});
```

```json
// 응답 예시
{
  "id": "emulator-5554",
  "name": "Android Emulator 5554",
  "type": "usb",
  "icon": null,
  "os": { "platform": "android", "version": "14" },
  "arch": "arm64",
  "status": "connected",
  "params": {
    "host": "localhost",
    "port": 5554
  }
}
```

---

### 2.2 Process Commands

#### `list_processes`

지정 디바이스의 실행 중인 프로세스 목록을 반환한다.

| 항목 | 값 |
|------|-----|
| **Command** | `list_processes` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `ProcessInfo[]` |
| **Errors** | `DEVICE_NOT_FOUND`, `DEVICE_DISCONNECTED` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `device_id` | `string` | Y | 디바이스 ID |

```typescript
const processes = await invoke<ProcessInfo[]>("list_processes", {
  device_id: "local"
});
```

```json
// 응답 예시
[
  {
    "pid": 1234,
    "name": "com.example.app",
    "identifier": "com.example.app",
    "icon": "iVBORw0KGgo..."
  },
  {
    "pid": 5678,
    "name": "zygote64",
    "identifier": null,
    "icon": null
  }
]
```

---

#### `list_applications`

지정 디바이스에 설치된 애플리케이션 목록을 반환한다.

| 항목 | 값 |
|------|-----|
| **Command** | `list_applications` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `AppInfo[]` |
| **Errors** | `DEVICE_NOT_FOUND`, `DEVICE_DISCONNECTED` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `device_id` | `string` | Y | 디바이스 ID |

```typescript
const apps = await invoke<AppInfo[]>("list_applications", {
  device_id: "emulator-5554"
});
```

```json
// 응답 예시
[
  {
    "identifier": "com.example.app",
    "name": "Example App",
    "pid": 1234,
    "icon": "iVBORw0KGgo..."
  },
  {
    "identifier": "com.android.settings",
    "name": "Settings",
    "pid": null,
    "icon": "iVBORw0KGgo..."
  }
]
```

---

#### `kill_process`

지정 디바이스에서 프로세스를 종료한다.

| 항목 | 값 |
|------|-----|
| **Command** | `kill_process` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |
| **Errors** | `DEVICE_NOT_FOUND`, `PROCESS_NOT_FOUND` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `device_id` | `string` | Y | 디바이스 ID |
| `pid` | `number` | Y | 프로세스 ID |

```typescript
await invoke("kill_process", { device_id: "local", pid: 1234 });
```

---

### 2.3 Session Commands

#### `spawn_and_attach`

앱을 spawn 하고 세션에 attach 한다. 스크립트를 로드한 후 선택적으로 resume 한다.

| 항목 | 값 |
|------|-----|
| **Command** | `spawn_and_attach` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `SessionInfo` |
| **Errors** | `DEVICE_NOT_FOUND`, `SPAWN_FAILED`, `ATTACH_FAILED`, `SCRIPT_LOAD_FAILED` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `device_id` | `string` | Y | 디바이스 ID |
| `identifier` | `string` | Y | 앱 번들/패키지 ID |
| `options` | `SpawnOptions` | N | spawn 옵션 |

```typescript
const session = await invoke<SessionInfo>("spawn_and_attach", {
  device_id: "emulator-5554",
  identifier: "com.example.app",
  options: {
    argv: [],
    envp: {},
    stdio: "inherit",
    autoResume: true
  }
});
```

```json
// 응답 예시
{
  "id": "sess_a1b2c3d4",
  "deviceId": "emulator-5554",
  "pid": 12345,
  "processName": "com.example.app",
  "status": "active",
  "mode": "spawn",
  "createdAt": 1741564800000
}
```

---

#### `attach`

실행 중인 프로세스에 attach 한다.

| 항목 | 값 |
|------|-----|
| **Command** | `attach` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `SessionInfo` |
| **Errors** | `DEVICE_NOT_FOUND`, `ATTACH_FAILED`, `PROCESS_NOT_FOUND`, `SCRIPT_LOAD_FAILED` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `device_id` | `string` | Y | 디바이스 ID |
| `target` | `number \| string` | Y | PID 또는 프로세스 이름 |
| `options` | `AttachOptions` | N | attach 옵션 |

```typescript
const session = await invoke<SessionInfo>("attach", {
  device_id: "local",
  target: 1234,
  options: {
    realm: "native",
    runtime: "v8",
    enableChildGating: false
  }
});
```

---

#### `detach`

세션을 분리한다.

| 항목 | 값 |
|------|-----|
| **Command** | `detach` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |
| **Errors** | `SESSION_NOT_FOUND`, `SESSION_EXPIRED` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `session_id` | `string` | Y | 세션 ID |

```typescript
await invoke("detach", { session_id: "sess_a1b2c3d4" });
```

---

#### `resume`

spawn 후 일시정지된 프로세스를 재개한다.

| 항목 | 값 |
|------|-----|
| **Command** | `resume` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |
| **Errors** | `SESSION_NOT_FOUND`, `SESSION_EXPIRED` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `session_id` | `string` | Y | 세션 ID |

```typescript
await invoke("resume", { session_id: "sess_a1b2c3d4" });
```

---

#### `list_sessions`

현재 활성 세션 목록을 반환한다.

| 항목 | 값 |
|------|-----|
| **Command** | `list_sessions` |
| **Parameters** | 없음 |
| **Returns** | `SessionInfo[]` |

```typescript
const sessions = await invoke<SessionInfo[]>("list_sessions");
```

---

### 2.4 Agent RPC Proxy

#### `rpc_call`

활성 세션의 Agent 스크립트에 RPC 메서드를 호출한다.
Frontend에서 Agent의 모든 기능은 이 프록시를 통해 접근한다.

| 항목 | 값 |
|------|-----|
| **Command** | `rpc_call` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `unknown` (메서드에 따라 다름) |
| **Errors** | `SESSION_NOT_FOUND`, `SESSION_EXPIRED`, `AGENT_RPC_ERROR`, `AGENT_METHOD_NOT_FOUND` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `session_id` | `string` | Y | 세션 ID |
| `method` | `string` | Y | RPC 메서드 이름 |
| `params` | `unknown` | N | 메서드 파라미터 (JSON 직렬화 가능한 값) |

```typescript
// 모듈 열거 예시
const modules = await invoke<ModuleInfo[]>("rpc_call", {
  session_id: "sess_a1b2c3d4",
  method: "enumerateModules",
  params: {}
});

// Java 클래스 열거 예시
const classes = await invoke<string[]>("rpc_call", {
  session_id: "sess_a1b2c3d4",
  method: "enumerateJavaClasses",
  params: { filter: "com.example" }
});
```

---

### 2.5 ADB Commands

#### `adb_devices`

ADB로 연결된 Android 디바이스 목록을 반환한다.

| 항목 | 값 |
|------|-----|
| **Command** | `adb_devices` |
| **Parameters** | 없음 |
| **Returns** | `AdbDevice[]` |
| **Errors** | `ADB_NOT_FOUND`, `ADB_ERROR` |

```typescript
const devices = await invoke<AdbDevice[]>("adb_devices");
```

```json
// 응답 예시
[
  {
    "serial": "emulator-5554",
    "state": "device",
    "model": "Pixel_7_Pro",
    "product": "panther",
    "transportId": 1
  }
]
```

---

#### `adb_device_props`

ADB 디바이스의 상세 속성(getprop)을 조회한다.

| 항목 | 값 |
|------|-----|
| **Command** | `adb_device_props` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `DeviceProps` |
| **Errors** | `ADB_DEVICE_NOT_FOUND`, `ADB_ERROR` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `serial` | `string` | Y | ADB 디바이스 시리얼 |

```typescript
const props = await invoke<DeviceProps>("adb_device_props", {
  serial: "emulator-5554"
});
```

```json
// 응답 예시
{
  "model": "Pixel 7 Pro",
  "manufacturer": "Google",
  "androidVersion": "14",
  "sdkVersion": 34,
  "abi": "arm64-v8a",
  "securityPatch": "2025-12-01",
  "buildId": "AP3A.241205.015",
  "isRooted": true,
  "selinuxStatus": "Permissive"
}
```

---

#### `adb_push_frida_server`

frida-server 바이너리를 디바이스에 push 한다.

| 항목 | 값 |
|------|-----|
| **Command** | `adb_push_frida_server` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |
| **Errors** | `ADB_DEVICE_NOT_FOUND`, `ADB_PUSH_FAILED`, `ADB_ERROR` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `serial` | `string` | Y | ADB 디바이스 시리얼 |
| `version` | `string` | Y | frida-server 버전 (예: `"17.0.5"`) |
| `arch` | `string` | Y | 아키텍처 (예: `"arm64"`, `"x86_64"`) |

```typescript
await invoke("adb_push_frida_server", {
  serial: "emulator-5554",
  version: "17.0.5",
  arch: "arm64"
});
```

---

#### `adb_start_frida_server`

디바이스에서 frida-server를 시작한다.

| 항목 | 값 |
|------|-----|
| **Command** | `adb_start_frida_server` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |
| **Errors** | `ADB_DEVICE_NOT_FOUND`, `ADB_ROOT_REQUIRED`, `ADB_ERROR` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `serial` | `string` | Y | ADB 디바이스 시리얼 |

```typescript
await invoke("adb_start_frida_server", { serial: "emulator-5554" });
```

---

#### `adb_stop_frida_server`

디바이스에서 frida-server를 종료한다.

| 항목 | 값 |
|------|-----|
| **Command** | `adb_stop_frida_server` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |
| **Errors** | `ADB_DEVICE_NOT_FOUND`, `ADB_ERROR` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `serial` | `string` | Y | ADB 디바이스 시리얼 |

```typescript
await invoke("adb_stop_frida_server", { serial: "emulator-5554" });
```

---

#### `adb_is_frida_running`

디바이스에서 frida-server가 실행 중인지 확인한다.

| 항목 | 값 |
|------|-----|
| **Command** | `adb_is_frida_running` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `boolean` |
| **Errors** | `ADB_DEVICE_NOT_FOUND`, `ADB_ERROR` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `serial` | `string` | Y | ADB 디바이스 시리얼 |

```typescript
const running = await invoke<boolean>("adb_is_frida_running", {
  serial: "emulator-5554"
});
```

---

#### `adb_shell`

디바이스에서 셸 명령을 실행한다.

| 항목 | 값 |
|------|-----|
| **Command** | `adb_shell` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `string` (명령 출력) |
| **Errors** | `ADB_DEVICE_NOT_FOUND`, `ADB_SHELL_FAILED`, `ADB_ERROR` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `serial` | `string` | Y | ADB 디바이스 시리얼 |
| `command` | `string` | Y | 실행할 셸 명령 |

```typescript
const output = await invoke<string>("adb_shell", {
  serial: "emulator-5554",
  command: "getprop ro.build.version.release"
});
// output: "14"
```

---

#### `adb_install_apk`

디바이스에 APK를 설치한다.

| 항목 | 값 |
|------|-----|
| **Command** | `adb_install_apk` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |
| **Errors** | `ADB_DEVICE_NOT_FOUND`, `ADB_INSTALL_FAILED`, `FILE_NOT_FOUND`, `ADB_ERROR` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `serial` | `string` | Y | ADB 디바이스 시리얼 |
| `path` | `string` | Y | 호스트의 APK 파일 경로 |

```typescript
await invoke("adb_install_apk", {
  serial: "emulator-5554",
  path: "/Users/user/Downloads/target.apk"
});
```

---

#### `adb_pair`

WiFi ADB 페어링을 수행한다.

| 항목 | 값 |
|------|-----|
| **Command** | `adb_pair` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |
| **Errors** | `ADB_PAIR_FAILED`, `ADB_ERROR` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `address` | `string` | Y | 페어링 주소 (`host:port`) |
| `code` | `string` | Y | 6자리 페어링 코드 |

```typescript
await invoke("adb_pair", {
  address: "192.168.1.100:37247",
  code: "123456"
});
```

---

#### `adb_connect`

WiFi ADB 연결을 수행한다.

| 항목 | 값 |
|------|-----|
| **Command** | `adb_connect` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |
| **Errors** | `ADB_CONNECT_FAILED`, `ADB_ERROR` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `address` | `string` | Y | 연결 주소 (`host:port`) |

```typescript
await invoke("adb_connect", { address: "192.168.1.100:5555" });
```

---

## 3. Tauri Events

Backend에서 Frontend로 실시간 push 되는 이벤트 목록.
Frontend에서는 `listen<T>(event, handler)` 래퍼를 통해 구독한다.

```typescript
// 구독 예시
import { listen } from "~/lib/tauri";

const unlisten = listen<DeviceInfo>("carf://device/added", (device) => {
  console.log("Device added:", device.name);
});

// 구독 해제
unlisten();
```

### 3.1 Device Events

#### `carf://device/added`

새 디바이스가 연결되었을 때 발행된다.

| 항목 | 값 |
|------|-----|
| **Event** | `carf://device/added` |
| **Payload** | `DeviceInfo` |
| **발행 조건** | USB 디바이스 연결, 원격 디바이스 추가 |

```json
// payload 예시
{
  "id": "abc123",
  "name": "iPhone 15 Pro",
  "type": "usb",
  "icon": null,
  "os": { "platform": "ios", "version": "17.4" },
  "arch": "arm64",
  "status": "connected"
}
```

---

#### `carf://device/removed`

디바이스 연결이 해제되었을 때 발행된다.

| 항목 | 값 |
|------|-----|
| **Event** | `carf://device/removed` |
| **Payload** | `string` (device_id) |
| **발행 조건** | USB 디바이스 분리, 원격 디바이스 제거 |

```json
// payload 예시
"abc123"
```

---

#### `carf://device/changed`

디바이스 상태가 변경되었을 때 발행된다.

| 항목 | 값 |
|------|-----|
| **Event** | `carf://device/changed` |
| **Payload** | `DeviceInfo` |
| **발행 조건** | 디바이스 속성 변경 (이름, 상태 등) |

---

### 3.2 Session Events

#### `carf://session/detached`

세션이 분리되었을 때 발행된다.

| 항목 | 값 |
|------|-----|
| **Event** | `carf://session/detached` |
| **Payload** | `SessionDetachedEvent` |
| **발행 조건** | 사용자 detach, 대상 프로세스 종료, 연결 끊김 |

```json
// payload 예시
{
  "sessionId": "sess_a1b2c3d4",
  "reason": "process_terminated"
}
```

`reason` 값:

| 값 | 설명 |
|----|------|
| `"application_requested"` | 사용자가 detach 요청 |
| `"process_replaced"` | 프로세스가 exec()로 교체됨 |
| `"process_terminated"` | 대상 프로세스 종료 |
| `"connection_terminated"` | 디바이스 연결 끊김 |
| `"device_lost"` | 디바이스 분실 |

---

### 3.3 Agent Events

#### `carf://agent/message`

Agent에서 `send()`로 전송된 콘솔 메시지를 수신한다.

| 항목 | 값 |
|------|-----|
| **Event** | `carf://agent/message` |
| **Payload** | `ConsoleMessage` |
| **발행 조건** | Agent 스크립트에서 `console.log()`, `send()` 호출 |

```json
// payload 예시
{
  "id": "msg_001",
  "timestamp": 1741564800000,
  "level": "log",
  "source": "agent",
  "content": "Hooked open() at 0x7fff12345678",
  "data": null
}
```

---

#### `carf://agent/log`

Agent의 구조화된 로그 메시지를 수신한다.

| 항목 | 값 |
|------|-----|
| **Event** | `carf://agent/log` |
| **Payload** | `AgentLogEvent` |
| **발행 조건** | Agent 내부 로깅 |

```json
// payload 예시
{
  "sessionId": "sess_a1b2c3d4",
  "level": "info",
  "content": "Java runtime detected, VM version: 11.0.20"
}
```

---

### 3.4 Process Events

#### `carf://process/crashed`

대상 프로세스가 크래시 했을 때 발행된다.

| 항목 | 값 |
|------|-----|
| **Event** | `carf://process/crashed` |
| **Payload** | `ProcessCrashedEvent` |
| **발행 조건** | 대상 프로세스 비정상 종료 |

```json
// payload 예시
{
  "sessionId": "sess_a1b2c3d4",
  "crashReport": {
    "summary": "SIGSEGV at 0x0000000000000000",
    "report": "Thread 1 crashed with SIGSEGV...",
    "parameters": {
      "signal": "SIGSEGV",
      "address": "0x0000000000000000"
    }
  }
}
```

---

#### `carf://child/added`

Child gating이 활성화된 상태에서 자식 프로세스가 생성되었을 때 발행된다.

| 항목 | 값 |
|------|-----|
| **Event** | `carf://child/added` |
| **Payload** | `ChildAddedEvent` |
| **발행 조건** | `enableChildGating: true`인 세션에서 fork/exec 발생 |

```json
// payload 예시
{
  "sessionId": "sess_a1b2c3d4",
  "childPid": 56789
}
```

---

### 3.5 Hook Events

#### `carf://hook/event`

훅 트리거 이벤트를 수신한다.

| 항목 | 값 |
|------|-----|
| **Event** | `carf://hook/event` |
| **Payload** | `HookEvent` |
| **발행 조건** | Interceptor onEnter/onLeave, Java/ObjC 메서드 후킹 트리거 |

```json
// payload 예시 (Native Interceptor)
{
  "hookId": "hook_001",
  "type": "enter",
  "timestamp": 1741564800123,
  "threadId": 12345,
  "target": "open",
  "address": "0x7fff20345678",
  "args": ["/data/data/com.example/files/config.json", 0],
  "retval": null,
  "backtrace": [
    {
      "address": "0x7fff20345678",
      "moduleName": "libc.so",
      "symbolName": "open",
      "fileName": null,
      "lineNumber": null
    }
  ]
}
```

```json
// payload 예시 (Java Hook)
{
  "hookId": "hook_002",
  "type": "enter",
  "timestamp": 1741564800456,
  "threadId": 12345,
  "target": "com.example.Crypto.decrypt",
  "address": null,
  "args": ["encrypted_data", "secret_key"],
  "retval": null,
  "backtrace": []
}
```

---

### 3.6 Scan Events

#### `carf://scan/progress`

메모리 스캔 진행률을 수신한다.

| 항목 | 값 |
|------|-----|
| **Event** | `carf://scan/progress` |
| **Payload** | `ScanProgressEvent` |
| **발행 조건** | 대용량 메모리 스캔 진행 중 |

```json
// payload 예시
{
  "sessionId": "sess_a1b2c3d4",
  "progress": 67,
  "total": 100
}
```

---

#### `carf://scan/result`

메모리 스캔 결과를 수신한다.

| 항목 | 값 |
|------|-----|
| **Event** | `carf://scan/result` |
| **Payload** | `ScanResult` |
| **발행 조건** | 메모리 스캔 매치 발견 |

```json
// payload 예시
{
  "address": "0x7a1234500",
  "size": 16,
  "moduleName": "libexample.so",
  "offset": 4096,
  "value": "48 65 6C 6C 6F 20 57 6F 72 6C 64"
}
```

---

## 4. Agent RPC Methods

Agent RPC 메서드는 `rpc_call` 프록시를 통해 호출한다.
모든 메서드는 대상 프로세스 내 Agent 스크립트에서 실행된다.

```typescript
// 호출 패턴
const result = await invoke<ReturnType>("rpc_call", {
  session_id: "sess_a1b2c3d4",
  method: "methodName",
  params: { /* 메서드 파라미터 */ }
});
```

### 4.1 Process / Module

#### `ping`

Agent 스크립트의 연결 상태를 확인한다.

| 항목 | 값 |
|------|-----|
| **Method** | `ping` |
| **Parameters** | 없음 |
| **Returns** | `boolean` |

```typescript
const alive = await invoke<boolean>("rpc_call", {
  session_id: sid,
  method: "ping"
});
// true
```

---

#### `getStatus`

현재 세션의 상태 정보를 반환한다.

| 항목 | 값 |
|------|-----|
| **Method** | `getStatus` |
| **Parameters** | 없음 |
| **Returns** | `SessionStatus` |

```json
// 응답 예시
{
  "arch": "arm64",
  "platform": "linux",
  "pid": 12345,
  "mainModule": "com.example.app",
  "runtime": "v8",
  "hooks": 3,
  "uptime": 120000
}
```

---

#### `enumerateModules`

로드된 모든 모듈(공유 라이브러리)을 열거한다.

| 항목 | 값 |
|------|-----|
| **Method** | `enumerateModules` |
| **Parameters** | 없음 |
| **Returns** | `ModuleInfo[]` |

```json
// 응답 예시
[
  {
    "name": "libc.so",
    "base": "0x7fff20000000",
    "size": 1048576,
    "path": "/apex/com.android.runtime/lib64/bionic/libc.so"
  },
  {
    "name": "libexample.so",
    "base": "0x7a12340000",
    "size": 65536,
    "path": "/data/app/com.example.app/lib/arm64/libexample.so"
  }
]
```

---

#### `getModuleExports`

지정 모듈의 export 심볼 목록을 반환한다.

| 항목 | 값 |
|------|-----|
| **Method** | `getModuleExports` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `ExportInfo[]` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `moduleName` | `string` | Y | 모듈 이름 |

```typescript
const exports = await invoke<ExportInfo[]>("rpc_call", {
  session_id: sid,
  method: "getModuleExports",
  params: { moduleName: "libc.so" }
});
```

```json
// 응답 예시
[
  { "name": "open", "address": "0x7fff20345678", "type": "function" },
  { "name": "read", "address": "0x7fff20345780", "type": "function" },
  { "name": "environ", "address": "0x7fff20500000", "type": "variable" }
]
```

---

#### `getModuleImports`

지정 모듈의 import 심볼 목록을 반환한다.

| 항목 | 값 |
|------|-----|
| **Method** | `getModuleImports` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `ImportInfo[]` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `moduleName` | `string` | Y | 모듈 이름 |

```json
// 응답 예시
[
  {
    "name": "malloc",
    "address": "0x7fff20100000",
    "module": "libc.so",
    "type": "function"
  }
]
```

---

#### `getModuleSymbols`

지정 모듈의 전체 심볼 테이블을 반환한다.

| 항목 | 값 |
|------|-----|
| **Method** | `getModuleSymbols` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `SymbolInfo[]` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `moduleName` | `string` | Y | 모듈 이름 |

```json
// 응답 예시
[
  {
    "name": "_ZN7example8functionEv",
    "address": "0x7a12345000",
    "type": "function",
    "isGlobal": true,
    "section": {
      "id": ".text",
      "protection": "r-x"
    }
  }
]
```

---

#### `enumerateRanges`

지정된 보호 속성과 일치하는 메모리 범위를 열거한다.

| 항목 | 값 |
|------|-----|
| **Method** | `enumerateRanges` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `RangeInfo[]` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `protection` | `string` | Y | 보호 속성 필터 (예: `"r-x"`, `"rw-"`, `"rwx"`) |

```typescript
const ranges = await invoke<RangeInfo[]>("rpc_call", {
  session_id: sid,
  method: "enumerateRanges",
  params: { protection: "r-x" }
});
```

```json
// 응답 예시
[
  {
    "base": "0x7fff20000000",
    "size": 1048576,
    "protection": "r-x",
    "file": {
      "path": "/apex/com.android.runtime/lib64/bionic/libc.so",
      "offset": 0,
      "size": 1048576
    }
  }
]
```

---

### 4.2 Thread

#### `enumerateThreads`

프로세스의 모든 스레드를 열거한다.

| 항목 | 값 |
|------|-----|
| **Method** | `enumerateThreads` |
| **Parameters** | 없음 |
| **Returns** | `ThreadInfo[]` |

```json
// 응답 예시
[
  { "id": 12345, "name": "main", "state": "running" },
  { "id": 12346, "name": "GC Thread", "state": "waiting" },
  { "id": 12347, "name": "Binder:12345_1", "state": "waiting" }
]
```

---

#### `getBacktrace`

지정 스레드의 스택 백트레이스를 반환한다.

| 항목 | 값 |
|------|-----|
| **Method** | `getBacktrace` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `BacktraceFrame[]` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `threadId` | `number` | Y | 스레드 ID |

```json
// 응답 예시
[
  {
    "address": "0x7fff20345678",
    "moduleName": "libc.so",
    "symbolName": "__ioctl",
    "fileName": null,
    "lineNumber": null
  },
  {
    "address": "0x7fff30123456",
    "moduleName": "libbinder.so",
    "symbolName": "IPCThreadState::talkWithDriver",
    "fileName": null,
    "lineNumber": null
  }
]
```

---

### 4.3 Memory

#### `readMemory`

지정된 주소에서 메모리를 읽는다.

| 항목 | 값 |
|------|-----|
| **Method** | `readMemory` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `string` (base64 인코딩된 바이너리 데이터) |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `address` | `string` | Y | 읽을 주소 (hex, 예: `"0x7fff20000000"`) |
| `size` | `number` | Y | 읽을 바이트 수 |

```typescript
const data = await invoke<string>("rpc_call", {
  session_id: sid,
  method: "readMemory",
  params: { address: "0x7fff20000000", size: 256 }
});
// data: base64 인코딩 문자열
```

---

#### `writeMemory`

지정된 주소에 데이터를 쓴다.

| 항목 | 값 |
|------|-----|
| **Method** | `writeMemory` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `address` | `string` | Y | 쓸 주소 (hex) |
| `data` | `number[]` | Y | 쓸 바이트 배열 |

```typescript
await invoke("rpc_call", {
  session_id: sid,
  method: "writeMemory",
  params: {
    address: "0x7a12345000",
    data: [0x90, 0x90, 0x90, 0x90]  // NOP sled
  }
});
```

---

#### `scanMemory`

메모리에서 패턴을 검색한다. 범위가 큰 경우 RustModule 기반 고속 스캐너를 사용한다.

| 항목 | 값 |
|------|-----|
| **Method** | `scanMemory` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `ScanResult[]` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `pattern` | `string` | Y | 검색 패턴 (Frida 패턴 형식, 예: `"48 65 6C 6C ?? 20"`) |
| `ranges` | `string` | N | 검색 범위 보호 속성 (예: `"r--"`, 기본: 읽기 가능 전체) |
| `base` | `string` | N | 검색 시작 주소 (hex) |
| `size` | `number` | N | 검색 범위 크기 (바이트) |

```typescript
const results = await invoke<ScanResult[]>("rpc_call", {
  session_id: sid,
  method: "scanMemory",
  params: {
    pattern: "48 65 6C 6C 6F",
    ranges: "r--"
  }
});
```

```json
// 응답 예시
[
  {
    "address": "0x7a12345100",
    "size": 5,
    "moduleName": "libexample.so",
    "offset": 4352,
    "value": "48 65 6C 6C 6F"
  }
]
```

---

#### `protectMemory`

메모리 보호 속성을 변경한다.

| 항목 | 값 |
|------|-----|
| **Method** | `protectMemory` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `boolean` (성공 여부) |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `address` | `string` | Y | 대상 주소 (hex) |
| `size` | `number` | Y | 범위 크기 (바이트) |
| `protection` | `string` | Y | 새 보호 속성 (예: `"rwx"`, `"r-x"`) |

```typescript
const success = await invoke<boolean>("rpc_call", {
  session_id: sid,
  method: "protectMemory",
  params: {
    address: "0x7a12345000",
    size: 4096,
    protection: "rwx"
  }
});
```

---

### 4.4 Java

#### `isJavaAvailable`

Java 런타임(ART/Dalvik)이 사용 가능한지 확인한다.

| 항목 | 값 |
|------|-----|
| **Method** | `isJavaAvailable` |
| **Parameters** | 없음 |
| **Returns** | `boolean` |

```typescript
const available = await invoke<boolean>("rpc_call", {
  session_id: sid,
  method: "isJavaAvailable"
});
```

---

#### `enumerateJavaClasses`

로드된 Java 클래스를 열거한다.

| 항목 | 값 |
|------|-----|
| **Method** | `enumerateJavaClasses` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `string[]` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `filter` | `string` | N | 클래스명 필터 (부분 문자열 매칭) |

```typescript
const classes = await invoke<string[]>("rpc_call", {
  session_id: sid,
  method: "enumerateJavaClasses",
  params: { filter: "com.example" }
});
// ["com.example.app.MainActivity", "com.example.app.Crypto", ...]
```

---

#### `getJavaClassMethods`

지정 Java 클래스의 메서드 목록을 반환한다.

| 항목 | 값 |
|------|-----|
| **Method** | `getJavaClassMethods` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `JavaMethodInfo[]` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `className` | `string` | Y | 완전한 Java 클래스명 |

```json
// 응답 예시
[
  {
    "name": "decrypt",
    "returnType": "java.lang.String",
    "argumentTypes": ["java.lang.String", "java.lang.String"],
    "isStatic": false,
    "modifiers": ["public"]
  },
  {
    "name": "encrypt",
    "returnType": "byte[]",
    "argumentTypes": ["byte[]"],
    "isStatic": true,
    "modifiers": ["public", "static"]
  }
]
```

---

#### `getJavaClassFields`

지정 Java 클래스의 필드 목록을 반환한다.

| 항목 | 값 |
|------|-----|
| **Method** | `getJavaClassFields` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `JavaFieldInfo[]` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `className` | `string` | Y | 완전한 Java 클래스명 |

```json
// 응답 예시
[
  {
    "name": "SECRET_KEY",
    "type": "java.lang.String",
    "isStatic": true,
    "value": null
  },
  {
    "name": "mContext",
    "type": "android.content.Context",
    "isStatic": false,
    "value": null
  }
]
```

---

#### `hookJavaMethod`

Java 메서드에 훅을 설치한다.

| 항목 | 값 |
|------|-----|
| **Method** | `hookJavaMethod` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `string` (hookId) |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `className` | `string` | Y | Java 클래스명 |
| `methodName` | `string` | Y | 메서드 이름 |
| `overloadIndex` | `number` | N | 오버로드 인덱스 (생략 시 모든 오버로드) |
| `options` | `HookOptions` | N | 훅 옵션 |

```typescript
const hookId = await invoke<string>("rpc_call", {
  session_id: sid,
  method: "hookJavaMethod",
  params: {
    className: "com.example.app.Crypto",
    methodName: "decrypt",
    options: {
      captureArgs: true,
      captureRetval: true,
      captureBacktrace: false
    }
  }
});
// hookId: "hook_java_001"
```

---

#### `unhookJavaMethod`

Java 메서드 훅을 제거한다.

| 항목 | 값 |
|------|-----|
| **Method** | `unhookJavaMethod` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `hookId` | `string` | Y | 제거할 훅 ID |

```typescript
await invoke("rpc_call", {
  session_id: sid,
  method: "unhookJavaMethod",
  params: { hookId: "hook_java_001" }
});
```

---

### 4.5 ObjC

#### `isObjcAvailable`

Objective-C 런타임이 사용 가능한지 확인한다.

| 항목 | 값 |
|------|-----|
| **Method** | `isObjcAvailable` |
| **Parameters** | 없음 |
| **Returns** | `boolean` |

---

#### `enumerateObjcClasses`

로드된 Objective-C 클래스를 열거한다.

| 항목 | 값 |
|------|-----|
| **Method** | `enumerateObjcClasses` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `string[]` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `filter` | `string` | N | 클래스명 필터 (부분 문자열 매칭) |

```typescript
const classes = await invoke<string[]>("rpc_call", {
  session_id: sid,
  method: "enumerateObjcClasses",
  params: { filter: "NSURL" }
});
// ["NSURLSession", "NSURLRequest", "NSURLResponse", ...]
```

---

#### `getObjcClassMethods`

지정 Objective-C 클래스의 메서드 목록을 반환한다.

| 항목 | 값 |
|------|-----|
| **Method** | `getObjcClassMethods` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `ObjcMethodInfo[]` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `className` | `string` | Y | ObjC 클래스명 |

```json
// 응답 예시
[
  {
    "selector": "- dataTaskWithRequest:completionHandler:",
    "returnType": "NSURLSessionDataTask *",
    "argumentTypes": ["NSURLRequest *", "@?<void, NSData *, NSURLResponse *, NSError *>"],
    "isClassMethod": false
  },
  {
    "selector": "+ sharedSession",
    "returnType": "NSURLSession *",
    "argumentTypes": [],
    "isClassMethod": true
  }
]
```

---

#### `hookObjcMethod`

Objective-C 메서드에 훅을 설치한다.

| 항목 | 값 |
|------|-----|
| **Method** | `hookObjcMethod` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `string` (hookId) |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `selector` | `string` | Y | ObjC 메서드 셀렉터 (예: `"-[NSURLSession dataTaskWithRequest:completionHandler:]"`) |
| `options` | `HookOptions` | N | 훅 옵션 |

```typescript
const hookId = await invoke<string>("rpc_call", {
  session_id: sid,
  method: "hookObjcMethod",
  params: {
    selector: "-[NSURLSession dataTaskWithRequest:completionHandler:]",
    options: {
      captureArgs: true,
      captureRetval: true,
      captureBacktrace: true
    }
  }
});
```

---

#### `unhookObjcMethod`

Objective-C 메서드 훅을 제거한다.

| 항목 | 값 |
|------|-----|
| **Method** | `unhookObjcMethod` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `hookId` | `string` | Y | 제거할 훅 ID |

---

### 4.6 Native

#### `hookFunction`

Native 함수에 Interceptor 훅을 설치한다.

| 항목 | 값 |
|------|-----|
| **Method** | `hookFunction` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `string` (hookId) |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `address` | `string` | Y | 함수 주소 (hex) 또는 `"module!export"` 형식 |
| `options` | `HookOptions` | N | 훅 옵션 |

```typescript
// 주소로 훅
const hookId = await invoke<string>("rpc_call", {
  session_id: sid,
  method: "hookFunction",
  params: {
    address: "0x7fff20345678",
    options: {
      captureArgs: true,
      captureRetval: true,
      captureBacktrace: true,
      argTypes: ["pointer", "int"],
      retType: "int"
    }
  }
});

// 모듈!심볼 형식으로 훅
const hookId2 = await invoke<string>("rpc_call", {
  session_id: sid,
  method: "hookFunction",
  params: {
    address: "libc.so!open",
    options: { captureArgs: true }
  }
});
```

---

#### `unhookFunction`

Native 함수 훅을 제거한다.

| 항목 | 값 |
|------|-----|
| **Method** | `unhookFunction` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `hookId` | `string` | Y | 제거할 훅 ID |

---

#### `callFunction`

Native 함수를 직접 호출한다.

| 항목 | 값 |
|------|-----|
| **Method** | `callFunction` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `unknown` (반환 타입에 따라 다름) |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `address` | `string` | Y | 함수 주소 (hex) |
| `retType` | `string` | Y | 반환 타입 (NativeFunction 규약) |
| `argTypes` | `string[]` | Y | 인수 타입 배열 |
| `args` | `unknown[]` | Y | 인수 값 배열 |

유효한 타입 문자열:

| 타입 | 설명 |
|------|------|
| `"void"` | void |
| `"int"` | int |
| `"uint"` | unsigned int |
| `"long"` | long |
| `"ulong"` | unsigned long |
| `"int8"` | int8_t |
| `"uint8"` | uint8_t |
| `"int16"` | int16_t |
| `"uint16"` | uint16_t |
| `"int32"` | int32_t |
| `"uint32"` | uint32_t |
| `"int64"` | int64_t |
| `"uint64"` | uint64_t |
| `"float"` | float |
| `"double"` | double |
| `"pointer"` | NativePointer |
| `"size_t"` | size_t |
| `"ssize_t"` | ssize_t |
| `"bool"` | bool |

```typescript
// strlen("hello") 호출 예시
const len = await invoke<number>("rpc_call", {
  session_id: sid,
  method: "callFunction",
  params: {
    address: "0x7fff20345000",
    retType: "int",
    argTypes: ["pointer"],
    args: ["0x7a12340000"]
  }
});
```

---

#### `resolveExport`

모듈의 export 심볼 주소를 resolve 한다.

| 항목 | 값 |
|------|-----|
| **Method** | `resolveExport` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `string` (주소, hex) |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `moduleName` | `string` | Y | 모듈 이름 |
| `exportName` | `string` | Y | export 심볼 이름 |

```typescript
const addr = await invoke<string>("rpc_call", {
  session_id: sid,
  method: "resolveExport",
  params: { moduleName: "libc.so", exportName: "open" }
});
// "0x7fff20345678"
```

---

#### `findSymbol`

전체 로드된 모듈에서 심볼을 검색한다.

| 항목 | 값 |
|------|-----|
| **Method** | `findSymbol` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `SymbolInfo[]` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `query` | `string` | Y | 심볼 검색어 (부분 문자열 매칭) |

```typescript
const symbols = await invoke<SymbolInfo[]>("rpc_call", {
  session_id: sid,
  method: "findSymbol",
  params: { query: "SSL_read" }
});
```

---

### 4.7 Stalker

#### `startStalker`

지정 스레드에 대해 코드 트레이싱(Stalker)을 시작한다.

| 항목 | 값 |
|------|-----|
| **Method** | `startStalker` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `threadId` | `number` | Y | 트레이싱할 스레드 ID |
| `options` | `StalkerOptions` | N | Stalker 옵션 |

```typescript
await invoke("rpc_call", {
  session_id: sid,
  method: "startStalker",
  params: {
    threadId: 12345,
    options: {
      events: {
        call: true,
        ret: false,
        exec: false,
        block: false,
        compile: false
      },
      onReceive: true
    }
  }
});
```

---

#### `stopStalker`

지정 스레드의 Stalker 트레이싱을 중지한다.

| 항목 | 값 |
|------|-----|
| **Method** | `stopStalker` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `threadId` | `number` | Y | 중지할 스레드 ID |

---

### 4.8 Hook Management

#### `listHooks`

현재 설치된 모든 훅 목록을 반환한다.

| 항목 | 값 |
|------|-----|
| **Method** | `listHooks` |
| **Parameters** | 없음 |
| **Returns** | `HookInfo[]` |

```json
// 응답 예시
[
  {
    "id": "hook_001",
    "target": "open",
    "address": "0x7fff20345678",
    "type": "interceptor",
    "active": true
  },
  {
    "id": "hook_java_001",
    "target": "com.example.Crypto.decrypt",
    "address": null,
    "type": "java",
    "active": true
  },
  {
    "id": "hook_objc_001",
    "target": "-[NSURLSession dataTaskWithRequest:completionHandler:]",
    "address": "0x7fff30456789",
    "type": "objc",
    "active": false
  }
]
```

---

#### `enableHook`

비활성화된 훅을 활성화한다.

| 항목 | 값 |
|------|-----|
| **Method** | `enableHook` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `hookId` | `string` | Y | 활성화할 훅 ID |

---

#### `disableHook`

훅을 비활성화한다 (제거하지 않고 일시 중지).

| 항목 | 값 |
|------|-----|
| **Method** | `disableHook` |
| **Parameters** | 아래 표 참조 |
| **Returns** | `void` |

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `hookId` | `string` | Y | 비활성화할 훅 ID |

---

#### `removeAllHooks`

설치된 모든 훅을 제거한다.

| 항목 | 값 |
|------|-----|
| **Method** | `removeAllHooks` |
| **Parameters** | 없음 |
| **Returns** | `void` |

```typescript
await invoke("rpc_call", {
  session_id: sid,
  method: "removeAllHooks"
});
```

---

## 5. Type Definitions

Frontend와 Backend 간에 공유되는 모든 타입 정의.

### 5.1 Device Types

```typescript
/** Frida 디바이스 정보 */
interface DeviceInfo {
  /** 디바이스 고유 ID */
  id: string;
  /** 디바이스 표시 이름 */
  name: string;
  /** 연결 타입 */
  type: "local" | "usb" | "remote";
  /** 디바이스 아이콘 (base64 PNG, nullable) */
  icon: string | null;
  /** OS 정보 (nullable) */
  os: OsInfo | null;
  /** CPU 아키텍처 (nullable) */
  arch: string | null;
  /** 연결 상태 */
  status: "connected" | "disconnected" | "pairing";
}

/** 디바이스 상세 정보 (get_device_info 응답) */
interface DeviceDetailInfo extends DeviceInfo {
  /** 디바이스 고유 파라미터 */
  params: Record<string, unknown>;
}

/** OS 정보 */
interface OsInfo {
  /** 플랫폼 */
  platform: "android" | "ios" | "macos" | "linux" | "windows";
  /** OS 버전 문자열 */
  version: string;
}
```

### 5.2 Process Types

```typescript
/** 프로세스 정보 */
interface ProcessInfo {
  /** 프로세스 ID */
  pid: number;
  /** 프로세스 이름 */
  name: string;
  /** 앱 식별자 (패키지/번들 ID, nullable) */
  identifier: string | null;
  /** 프로세스 아이콘 (base64 PNG, nullable) */
  icon: string | null;
}

/** 애플리케이션 정보 */
interface AppInfo {
  /** 앱 번들/패키지 ID */
  identifier: string;
  /** 앱 표시 이름 */
  name: string;
  /** 실행 중인 경우 PID (nullable) */
  pid: number | null;
  /** 앱 아이콘 (base64 PNG, nullable) */
  icon: string | null;
}
```

### 5.3 Session Types

```typescript
/** 세션 정보 */
interface SessionInfo {
  /** 세션 고유 ID */
  id: string;
  /** 연결된 디바이스 ID */
  deviceId: string;
  /** 대상 프로세스 ID */
  pid: number;
  /** 대상 프로세스 이름 */
  processName: string;
  /** 세션 상태 */
  status: "active" | "detached" | "crashed";
  /** 연결 모드 */
  mode: "spawn" | "attach";
  /** 생성 시각 (Unix timestamp, ms) */
  createdAt: number;
}

/** 세션 상태 정보 (Agent getStatus 응답) */
interface SessionStatus {
  /** CPU 아키텍처 */
  arch: "arm" | "arm64" | "ia32" | "x64";
  /** 플랫폼 */
  platform: "linux" | "darwin" | "windows" | "freebsd" | "qnx";
  /** 프로세스 ID */
  pid: number;
  /** 메인 모듈 이름 */
  mainModule: string;
  /** JS 런타임 */
  runtime: "qjs" | "v8";
  /** 활성 훅 수 */
  hooks: number;
  /** 세션 업타임 (ms) */
  uptime: number;
}
```

### 5.4 Options Types

```typescript
/** Spawn 옵션 */
interface SpawnOptions {
  /** 실행 인수 */
  argv?: string[];
  /** 환경 변수 */
  envp?: Record<string, string>;
  /** 작업 디렉토리 */
  cwd?: string;
  /** 표준 입출력 모드 */
  stdio?: "inherit" | "pipe";
  /** spawn 후 자동 resume 여부 (기본: true) */
  autoResume?: boolean;
}

/** Attach 옵션 */
interface AttachOptions {
  /** 실행 영역 */
  realm?: "native" | "emulated";
  /** 세션 유지 시간 (초, 기본: 0 = 무제한) */
  persistTimeout?: number;
  /** JS 런타임 */
  runtime?: "qjs" | "v8";
  /** 자식 프로세스 게이팅 활성화 */
  enableChildGating?: boolean;
}

/** 훅 옵션 */
interface HookOptions {
  /** 인수 캡처 여부 (기본: true) */
  captureArgs?: boolean;
  /** 반환값 캡처 여부 (기본: true) */
  captureRetval?: boolean;
  /** 백트레이스 캡처 여부 (기본: false) */
  captureBacktrace?: boolean;
  /** 인수 타입 힌트 (Native Interceptor 전용) */
  argTypes?: string[];
  /** 반환 타입 힌트 (Native Interceptor 전용) */
  retType?: string;
}

/** Stalker 옵션 */
interface StalkerOptions {
  /** 캡처할 이벤트 종류 */
  events?: {
    call?: boolean;
    ret?: boolean;
    exec?: boolean;
    block?: boolean;
    compile?: boolean;
  };
  /** 이벤트 수신 활성화 */
  onReceive?: boolean;
}
```

### 5.5 Module / Symbol Types

```typescript
/** 모듈 정보 */
interface ModuleInfo {
  /** 모듈 이름 (예: "libc.so") */
  name: string;
  /** 베이스 주소 (hex) */
  base: string;
  /** 모듈 크기 (바이트) */
  size: number;
  /** 파일 시스템 경로 */
  path: string;
}

/** Export 심볼 정보 */
interface ExportInfo {
  /** 심볼 이름 */
  name: string;
  /** 주소 (hex) */
  address: string;
  /** 심볼 타입 */
  type: "function" | "variable";
}

/** Import 심볼 정보 */
interface ImportInfo {
  /** 심볼 이름 */
  name: string;
  /** 주소 (hex) */
  address: string;
  /** import 소스 모듈 */
  module: string;
  /** 심볼 타입 */
  type: "function" | "variable";
}

/** 심볼 정보 (심볼 테이블) */
interface SymbolInfo {
  /** 심볼 이름 */
  name: string;
  /** 주소 (hex) */
  address: string;
  /** 심볼 타입 */
  type: "function" | "variable" | "unknown";
  /** 전역 심볼 여부 */
  isGlobal: boolean;
  /** 섹션 정보 (nullable) */
  section: SectionInfo | null;
}

/** 섹션 정보 */
interface SectionInfo {
  /** 섹션 ID (예: ".text", ".data") */
  id: string;
  /** 보호 속성 (예: "r-x") */
  protection: string;
}
```

### 5.6 Thread Types

```typescript
/** 스레드 정보 */
interface ThreadInfo {
  /** 스레드 ID */
  id: number;
  /** 스레드 이름 (nullable) */
  name: string | null;
  /** 스레드 상태 */
  state: "running" | "stopped" | "waiting" | "uninterruptible" | "halted";
}

/** 백트레이스 프레임 */
interface BacktraceFrame {
  /** 명령 포인터 주소 (hex) */
  address: string;
  /** 모듈 이름 (nullable) */
  moduleName: string | null;
  /** 심볼 이름 (nullable) */
  symbolName: string | null;
  /** 소스 파일 이름 (nullable) */
  fileName: string | null;
  /** 소스 라인 번호 (nullable) */
  lineNumber: number | null;
}
```

### 5.7 Memory Types

```typescript
/** 메모리 범위 정보 */
interface RangeInfo {
  /** 시작 주소 (hex) */
  base: string;
  /** 범위 크기 (바이트) */
  size: number;
  /** 보호 속성 (예: "r-x", "rw-", "rwx") */
  protection: string;
  /** 매핑된 파일 정보 (nullable) */
  file: FileMapping | null;
}

/** 파일 매핑 정보 */
interface FileMapping {
  /** 파일 경로 */
  path: string;
  /** 파일 내 오프셋 */
  offset: number;
  /** 매핑 크기 */
  size: number;
}

/** 메모리 스캔 결과 */
interface ScanResult {
  /** 매치 주소 (hex) */
  address: string;
  /** 매치 크기 (바이트) */
  size: number;
  /** 속한 모듈 이름 (nullable) */
  moduleName: string | null;
  /** 모듈 내 오프셋 (nullable) */
  offset: number | null;
  /** 매치된 값 (hex 문자열) */
  value: string;
}
```

### 5.8 Hook Types

```typescript
/** 훅 정보 */
interface HookInfo {
  /** 훅 고유 ID */
  id: string;
  /** 훅 대상 (함수명, 셀렉터, 또는 주소) */
  target: string;
  /** 대상 주소 (hex, Java 훅은 null) */
  address: string | null;
  /** 훅 유형 */
  type: "interceptor" | "java" | "objc";
  /** 활성 상태 */
  active: boolean;
}

/** 훅 이벤트 (carf://hook/event 페이로드) */
interface HookEvent {
  /** 훅 ID */
  hookId: string;
  /** 이벤트 유형 */
  type: "enter" | "leave";
  /** 타임스탬프 (Unix ms) */
  timestamp: number;
  /** 발생 스레드 ID */
  threadId: number;
  /** 훅 대상 이름 */
  target: string;
  /** 대상 주소 (hex, nullable) */
  address: string | null;
  /** 함수 인수 (nullable) */
  args: unknown[] | null;
  /** 반환값 (leave 이벤트에서만, nullable) */
  retval: unknown | null;
  /** 백트레이스 (nullable) */
  backtrace: BacktraceFrame[] | null;
}
```

### 5.9 Java / ObjC Types

```typescript
/** Java 메서드 정보 */
interface JavaMethodInfo {
  /** 메서드 이름 */
  name: string;
  /** 반환 타입 */
  returnType: string;
  /** 인수 타입 배열 */
  argumentTypes: string[];
  /** static 메서드 여부 */
  isStatic: boolean;
  /** 접근 제어자 */
  modifiers: string[];
}

/** Java 필드 정보 */
interface JavaFieldInfo {
  /** 필드 이름 */
  name: string;
  /** 필드 타입 */
  type: string;
  /** static 필드 여부 */
  isStatic: boolean;
  /** 필드 값 (읽을 수 있는 경우, nullable) */
  value: unknown | null;
}

/** ObjC 메서드 정보 */
interface ObjcMethodInfo {
  /** 메서드 셀렉터 (예: "- initWithFrame:") */
  selector: string;
  /** 반환 타입 */
  returnType: string;
  /** 인수 타입 배열 */
  argumentTypes: string[];
  /** 클래스 메서드 여부 (+ vs -) */
  isClassMethod: boolean;
}
```

### 5.10 ADB Types

```typescript
/** ADB 디바이스 정보 */
interface AdbDevice {
  /** 디바이스 시리얼 (예: "emulator-5554", "192.168.1.100:5555") */
  serial: string;
  /** 연결 상태 */
  state: "device" | "offline" | "unauthorized" | "no permissions";
  /** 디바이스 모델 (nullable) */
  model: string | null;
  /** 디바이스 프로덕트 이름 (nullable) */
  product: string | null;
  /** transport ID (nullable) */
  transportId: number | null;
}

/** Android 디바이스 속성 */
interface DeviceProps {
  /** 디바이스 모델 (ro.product.model) */
  model: string;
  /** 제조사 (ro.product.manufacturer) */
  manufacturer: string;
  /** Android 버전 (ro.build.version.release) */
  androidVersion: string;
  /** SDK 버전 (ro.build.version.sdk) */
  sdkVersion: number;
  /** CPU ABI (ro.product.cpu.abi) */
  abi: string;
  /** 보안 패치 수준 (ro.build.version.security_patch) */
  securityPatch: string;
  /** 빌드 ID (ro.build.display.id) */
  buildId: string;
  /** 루팅 여부 (su 존재) */
  isRooted: boolean;
  /** SELinux 상태 */
  selinuxStatus: "Enforcing" | "Permissive" | "Disabled";
}
```

### 5.11 Event Payload Types

```typescript
/** 콘솔 메시지 */
interface ConsoleMessage {
  /** 메시지 고유 ID */
  id: string;
  /** 타임스탬프 (Unix ms) */
  timestamp: number;
  /** 로그 레벨 */
  level: "log" | "warn" | "error" | "info" | "debug";
  /** 메시지 소스 */
  source: "agent" | "system" | "user";
  /** 메시지 내용 */
  content: string;
  /** 추가 데이터 (nullable) */
  data: unknown | null;
}

/** 세션 분리 이벤트 */
interface SessionDetachedEvent {
  /** 세션 ID */
  sessionId: string;
  /** 분리 사유 */
  reason:
    | "application_requested"
    | "process_replaced"
    | "process_terminated"
    | "connection_terminated"
    | "device_lost";
}

/** Agent 로그 이벤트 */
interface AgentLogEvent {
  /** 세션 ID */
  sessionId: string;
  /** 로그 레벨 */
  level: "debug" | "info" | "warn" | "error";
  /** 로그 내용 */
  content: string;
}

/** 프로세스 크래시 이벤트 */
interface ProcessCrashedEvent {
  /** 세션 ID */
  sessionId: string;
  /** 크래시 리포트 */
  crashReport: CrashReport;
}

/** 크래시 리포트 */
interface CrashReport {
  /** 크래시 요약 */
  summary: string;
  /** 상세 리포트 */
  report: string;
  /** 크래시 파라미터 */
  parameters: Record<string, string>;
}

/** 자식 프로세스 추가 이벤트 */
interface ChildAddedEvent {
  /** 부모 세션 ID */
  sessionId: string;
  /** 자식 프로세스 PID */
  childPid: number;
}

/** 스캔 진행률 이벤트 */
interface ScanProgressEvent {
  /** 세션 ID */
  sessionId: string;
  /** 현재 진행률 (0-100) */
  progress: number;
  /** 전체 범위 */
  total: number;
}
```

---

## 6. Error Codes

### 6.1 에러 응답 형식

모든 IPC 커맨드 에러는 `AppError` 문자열로 직렬화되어 반환된다.
Frontend에서는 에러 코드를 파싱하여 사용자 친화적 메시지를 표시한다.

```typescript
// Frontend 에러 처리 패턴
try {
  await invoke("list_devices");
} catch (error) {
  const parsed = parseError(error as string);
  showToast({ level: "error", message: getUserMessage(parsed.code) });
}
```

### 6.2 에러 코드 정의

```typescript
/** CARF 에러 코드 */
enum CarfErrorCode {
  // ─── Device (1xxx) ───
  /** 디바이스를 찾을 수 없음 */
  DEVICE_NOT_FOUND = 1001,
  /** 디바이스 연결이 끊어짐 */
  DEVICE_DISCONNECTED = 1002,
  /** 원격 디바이스 연결 실패 */
  CONNECTION_FAILED = 1003,
  /** 유효하지 않은 디바이스 주소 */
  INVALID_ADDRESS = 1004,

  // ─── Process (2xxx) ───
  /** 프로세스를 찾을 수 없음 */
  PROCESS_NOT_FOUND = 2001,
  /** 프로세스가 이미 종료됨 */
  PROCESS_TERMINATED = 2002,

  // ─── Session (3xxx) ───
  /** 세션을 찾을 수 없음 */
  SESSION_NOT_FOUND = 3001,
  /** 세션이 만료됨 */
  SESSION_EXPIRED = 3002,
  /** Spawn 실패 */
  SPAWN_FAILED = 3003,
  /** Attach 실패 */
  ATTACH_FAILED = 3004,
  /** 스크립트 로드 실패 */
  SCRIPT_LOAD_FAILED = 3005,

  // ─── Agent RPC (4xxx) ───
  /** Agent RPC 호출 에러 */
  AGENT_RPC_ERROR = 4001,
  /** Agent 메서드를 찾을 수 없음 */
  AGENT_METHOD_NOT_FOUND = 4002,
  /** Agent 응답 타임아웃 */
  AGENT_TIMEOUT = 4003,
  /** Agent 스크립트가 로드되지 않음 */
  AGENT_NOT_LOADED = 4004,

  // ─── ADB (5xxx) ───
  /** ADB 바이너리를 찾을 수 없음 */
  ADB_NOT_FOUND = 5001,
  /** ADB 디바이스를 찾을 수 없음 */
  ADB_DEVICE_NOT_FOUND = 5002,
  /** ADB 일반 에러 */
  ADB_ERROR = 5003,
  /** 파일 push 실패 */
  ADB_PUSH_FAILED = 5004,
  /** root 권한 필요 */
  ADB_ROOT_REQUIRED = 5005,
  /** 셸 명령 실행 실패 */
  ADB_SHELL_FAILED = 5006,
  /** APK 설치 실패 */
  ADB_INSTALL_FAILED = 5007,
  /** WiFi ADB 페어링 실패 */
  ADB_PAIR_FAILED = 5008,
  /** WiFi ADB 연결 실패 */
  ADB_CONNECT_FAILED = 5009,
  /** 파일을 찾을 수 없음 */
  FILE_NOT_FOUND = 5010,

  // ─── Memory (6xxx) ───
  /** 메모리 접근 위반 */
  MEMORY_ACCESS_VIOLATION = 6001,
  /** 유효하지 않은 주소 형식 */
  INVALID_ADDRESS_FORMAT = 6002,
  /** 메모리 보호 변경 실패 */
  MEMORY_PROTECTION_FAILED = 6003,

  // ─── Hook (7xxx) ───
  /** 훅 설치 실패 */
  HOOK_FAILED = 7001,
  /** 훅을 찾을 수 없음 */
  HOOK_NOT_FOUND = 7002,
  /** 이미 훅이 설치된 대상 */
  HOOK_ALREADY_EXISTS = 7003,

  // ─── Internal (9xxx) ───
  /** 내부 서버 에러 */
  INTERNAL_ERROR = 9001,
  /** 직렬화/역직렬화 에러 */
  SERIALIZATION_ERROR = 9002,
}
```

### 6.3 에러 코드 상세

| 코드 | 이름 | 설명 | 사용자 메시지 |
|------|------|------|--------------|
| 1001 | `DEVICE_NOT_FOUND` | 지정 ID의 디바이스가 존재하지 않음 | 디바이스를 찾을 수 없습니다. |
| 1002 | `DEVICE_DISCONNECTED` | 디바이스 연결이 끊어진 상태 | 디바이스 연결이 끊어졌습니다. |
| 1003 | `CONNECTION_FAILED` | 원격 디바이스 연결 시도 실패 | 원격 디바이스에 연결할 수 없습니다. |
| 1004 | `INVALID_ADDRESS` | 유효하지 않은 주소 형식 | 주소 형식이 올바르지 않습니다. (host:port) |
| 2001 | `PROCESS_NOT_FOUND` | 지정 PID의 프로세스가 존재하지 않음 | 프로세스를 찾을 수 없습니다. |
| 2002 | `PROCESS_TERMINATED` | 프로세스가 이미 종료됨 | 프로세스가 이미 종료되었습니다. |
| 3001 | `SESSION_NOT_FOUND` | 지정 ID의 세션이 존재하지 않음 | 세션을 찾을 수 없습니다. |
| 3002 | `SESSION_EXPIRED` | 세션이 만료되어 사용할 수 없음 | 세션이 만료되었습니다. 다시 연결하세요. |
| 3003 | `SPAWN_FAILED` | 앱 spawn 실패 | 앱을 시작할 수 없습니다. |
| 3004 | `ATTACH_FAILED` | 프로세스 attach 실패 | 프로세스에 연결할 수 없습니다. |
| 3005 | `SCRIPT_LOAD_FAILED` | Agent 스크립트 로드 실패 | 스크립트를 로드할 수 없습니다. |
| 4001 | `AGENT_RPC_ERROR` | Agent RPC 호출 중 에러 발생 | Agent 통신 오류가 발생했습니다. |
| 4002 | `AGENT_METHOD_NOT_FOUND` | 요청한 RPC 메서드가 Agent에 없음 | 요청한 기능을 찾을 수 없습니다. |
| 4003 | `AGENT_TIMEOUT` | Agent 응답 대기 시간 초과 | Agent 응답 시간이 초과되었습니다. |
| 4004 | `AGENT_NOT_LOADED` | Agent 스크립트가 아직 로드되지 않음 | Agent가 아직 준비되지 않았습니다. |
| 5001 | `ADB_NOT_FOUND` | 시스템 PATH에 adb가 없음 | ADB를 찾을 수 없습니다. PATH를 확인하세요. |
| 5002 | `ADB_DEVICE_NOT_FOUND` | 지정 시리얼의 ADB 디바이스가 없음 | ADB 디바이스를 찾을 수 없습니다. |
| 5003 | `ADB_ERROR` | ADB 명령 실행 중 에러 | ADB 오류가 발생했습니다. |
| 5004 | `ADB_PUSH_FAILED` | 파일 push 작업 실패 | 파일 전송에 실패했습니다. |
| 5005 | `ADB_ROOT_REQUIRED` | root 권한이 필요한 작업 | root 권한이 필요합니다. |
| 5006 | `ADB_SHELL_FAILED` | 셸 명령 실행 실패 | 셸 명령 실행에 실패했습니다. |
| 5007 | `ADB_INSTALL_FAILED` | APK 설치 실패 | APK 설치에 실패했습니다. |
| 5008 | `ADB_PAIR_FAILED` | WiFi ADB 페어링 실패 | 페어링에 실패했습니다. 코드를 확인하세요. |
| 5009 | `ADB_CONNECT_FAILED` | WiFi ADB 연결 실패 | 연결에 실패했습니다. 주소를 확인하세요. |
| 5010 | `FILE_NOT_FOUND` | 지정 경로에 파일이 없음 | 파일을 찾을 수 없습니다. |
| 6001 | `MEMORY_ACCESS_VIOLATION` | 메모리 읽기/쓰기 권한 없음 | 메모리에 접근할 수 없습니다. |
| 6002 | `INVALID_ADDRESS_FORMAT` | 주소 형식이 올바르지 않음 | 유효하지 않은 주소 형식입니다. |
| 6003 | `MEMORY_PROTECTION_FAILED` | 메모리 보호 속성 변경 실패 | 메모리 보호 설정을 변경할 수 없습니다. |
| 7001 | `HOOK_FAILED` | 훅 설치 실패 | 훅을 설치할 수 없습니다. |
| 7002 | `HOOK_NOT_FOUND` | 지정 ID의 훅이 없음 | 훅을 찾을 수 없습니다. |
| 7003 | `HOOK_ALREADY_EXISTS` | 동일 대상에 이미 훅이 설치됨 | 이미 훅이 설치된 대상입니다. |
| 9001 | `INTERNAL_ERROR` | 예상치 못한 내부 에러 | 내부 오류가 발생했습니다. |
| 9002 | `SERIALIZATION_ERROR` | 데이터 직렬화/역직렬화 실패 | 데이터 처리 중 오류가 발생했습니다. |

### 6.4 Rust 에러 타입 (Backend)

```rust
// src-tauri/src/error.rs

use thiserror::Error;
use serde::Serialize;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("[1001] Device not found: {0}")]
    DeviceNotFound(String),

    #[error("[1002] Device disconnected: {0}")]
    DeviceDisconnected(String),

    #[error("[1003] Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("[1004] Invalid address: {0}")]
    InvalidAddress(String),

    #[error("[2001] Process not found: pid={0}")]
    ProcessNotFound(u32),

    #[error("[2002] Process terminated: pid={0}")]
    ProcessTerminated(u32),

    #[error("[3001] Session not found: {0}")]
    SessionNotFound(String),

    #[error("[3002] Session expired: {0}")]
    SessionExpired(String),

    #[error("[3003] Spawn failed: {0}")]
    SpawnFailed(String),

    #[error("[3004] Attach failed: {0}")]
    AttachFailed(String),

    #[error("[3005] Script load failed: {0}")]
    ScriptLoadFailed(String),

    #[error("[4001] Agent RPC error: {0}")]
    AgentRpcError(String),

    #[error("[4002] Agent method not found: {0}")]
    AgentMethodNotFound(String),

    #[error("[4003] Agent timeout")]
    AgentTimeout,

    #[error("[4004] Agent not loaded: {0}")]
    AgentNotLoaded(String),

    #[error("[5001] ADB not found")]
    AdbNotFound,

    #[error("[5002] ADB device not found: {0}")]
    AdbDeviceNotFound(String),

    #[error("[5003] ADB error: {0}")]
    AdbError(String),

    #[error("[5004] ADB push failed: {0}")]
    AdbPushFailed(String),

    #[error("[5005] ADB root required")]
    AdbRootRequired,

    #[error("[5006] ADB shell failed: {0}")]
    AdbShellFailed(String),

    #[error("[5007] ADB install failed: {0}")]
    AdbInstallFailed(String),

    #[error("[5008] ADB pair failed: {0}")]
    AdbPairFailed(String),

    #[error("[5009] ADB connect failed: {0}")]
    AdbConnectFailed(String),

    #[error("[5010] File not found: {0}")]
    FileNotFound(String),

    #[error("[9001] Internal error")]
    Internal(#[from] anyhow::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
```

### 6.5 Frontend 에러 파서

```typescript
// lib/error.ts

interface ParsedError {
  code: number;
  message: string;
}

/** 에러 문자열에서 에러 코드와 메시지를 파싱한다 */
export function parseError(error: string): ParsedError {
  const match = error.match(/^\[(\d+)\]\s*(.+)$/);
  if (match) {
    return { code: parseInt(match[1]), message: match[2] };
  }
  return { code: 9001, message: error };
}

/** 에러 코드에 대응하는 사용자 친화적 한국어 메시지를 반환한다 */
export function getUserMessage(code: number): string {
  const messages: Record<number, string> = {
    1001: "디바이스를 찾을 수 없습니다.",
    1002: "디바이스 연결이 끊어졌습니다.",
    1003: "원격 디바이스에 연결할 수 없습니다.",
    1004: "주소 형식이 올바르지 않습니다.",
    2001: "프로세스를 찾을 수 없습니다.",
    2002: "프로세스가 이미 종료되었습니다.",
    3001: "세션을 찾을 수 없습니다.",
    3002: "세션이 만료되었습니다. 다시 연결하세요.",
    3003: "앱을 시작할 수 없습니다.",
    3004: "프로세스에 연결할 수 없습니다.",
    3005: "스크립트를 로드할 수 없습니다.",
    4001: "Agent 통신 오류가 발생했습니다.",
    4002: "요청한 기능을 찾을 수 없습니다.",
    4003: "Agent 응답 시간이 초과되었습니다.",
    4004: "Agent가 아직 준비되지 않았습니다.",
    5001: "ADB를 찾을 수 없습니다. PATH를 확인하세요.",
    5002: "ADB 디바이스를 찾을 수 없습니다.",
    5003: "ADB 오류가 발생했습니다.",
    9001: "내부 오류가 발생했습니다.",
  };
  return messages[code] ?? "알 수 없는 오류가 발생했습니다.";
}
```

---

*Last updated: 2026-03-10*
*Version: 2.0.0-alpha*
