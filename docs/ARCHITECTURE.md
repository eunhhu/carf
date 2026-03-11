# CARF — Architecture Document

> 시스템 아키텍처, 레이어 설계, 데이터 플로우, 모듈 구조

## 1. 시스템 아키텍처

### 1.1 3-Layer 구조

CARF는 **Frontend → Backend → Agent** 3개 레이어로 구성된다.
각 레이어는 명확한 책임을 가지며 정의된 프로토콜로만 통신한다.

```
┌─────────────────────────────────────────────────────────────┐
│                        CARF Host                             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                 Layer 1: Frontend                       │  │
│  │                                                         │  │
│  │  SolidJS + solid-ui + Tailwind CSS                      │  │
│  │                                                         │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │  │
│  │  │ Device   │ │ Process  │ │ Session  │ │ Analysis  │  │  │
│  │  │ Panel    │ │ Panel    │ │ Manager  │ │ Views     │  │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │  │
│  │       │             │            │              │        │  │
│  │  ─────┴─────────────┴────────────┴──────────────┴────── │  │
│  │                    Signal Store Layer                     │  │
│  │        (SolidJS createSignal / createStore)              │  │
│  └──────────────────────┬─────────────────────────────────┘  │
│                         │ Tauri IPC (invoke / listen)         │
│  ┌──────────────────────▼─────────────────────────────────┐  │
│  │                 Layer 2: Backend (Rust)                  │  │
│  │                                                         │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐  │  │
│  │  │ Commands     │ │ Services     │ │ State          │  │  │
│  │  │ (IPC 핸들러)  │ │ (비즈니스)    │ │ (Tauri State)  │  │  │
│  │  └──────┬───────┘ └──────┬───────┘ └────────────────┘  │  │
│  │         │                │                              │  │
│  │  ┌──────▼────────────────▼──────────────────────────┐   │  │
│  │  │              Frida Service                        │   │  │
│  │  │  DeviceManager · Session Pool · Script Loader     │   │  │
│  │  └──────────────────────┬───────────────────────────┘   │  │
│  └─────────────────────────┼───────────────────────────────┘  │
│                            │ Frida Protocol (USB/TCP/Local)    │
└────────────────────────────┼──────────────────────────────────┘
                             │
              ┌──────────────▼──────────────────┐
              │      Target Device / Process     │
              │                                  │
              │  ┌────────────────────────────┐  │
              │  │     Layer 3: Agent          │  │
              │  │     (CARF Std Script)       │  │
              │  │                             │  │
              │  │  ┌───────┐  ┌───────────┐  │  │
              │  │  │  JS   │  │ RustModule │  │  │
              │  │  │ Layer │  │  Layer     │  │  │
              │  │  └───┬───┘  └─────┬─────┘  │  │
              │  │      └──────┬─────┘        │  │
              │  │        RPC exports          │  │
              │  └────────────────────────────┘  │
              └──────────────────────────────────┘
```

### 1.2 레이어 간 통신

| 경로 | 프로토콜 | 방향 | 설명 |
|------|----------|------|------|
| Frontend → Backend | Tauri `invoke()` | Request/Response | 커맨드 호출 |
| Backend → Frontend | Tauri `emit()` / `listen()` | Push | 이벤트 스트리밍 |
| Backend → Agent | `Script.exports.call()` | Request/Response | RPC 호출 |
| Agent → Backend | `send()` / `on('message')` | Push | 이벤트/데이터 전달 |
| Frontend ↔ Backend | Tauri Event Channel | Bidirectional | 실시간 스트림 |

---

## 2. Frontend Architecture

### 2.1 기술 구성

```
SolidJS (UI 프레임워크)
├── solid-ui (컴포넌트 라이브러리, shadcn/ui 포트)
│   ├── Kobalte (접근성 프리미티브)
│   └── corvu (고급 UI 프리미티브)
├── Tailwind CSS v4 (스타일링)
├── HugeIcons (아이콘)
├── solid-motionone (애니메이션)
└── @tauri-apps/api (IPC)
```

### 2.2 상태 관리

SolidJS의 네이티브 반응성 시스템을 직접 활용한다. 별도 상태 관리 라이브러리 없이
`createSignal`, `createStore`, `createResource`로 구성한다.

#### Store 구조

```
stores/
├── device.store.ts      # 디바이스 목록, 선택 상태, 연결 상태
├── process.store.ts     # 프로세스/앱 목록, 필터, 즐겨찾기
├── session.store.ts     # 활성 세션, 세션 상태 + 멀티 세션 지원 (Map<sessionId, StoreBundle>)
├── console.store.ts     # 콘솔 메시지, 필터
├── ui.store.ts          # 레이아웃, 테마, 모달 상태
├── settings.store.ts    # 앱 설정 (persist, + 패널 크기 localStorage 영속화)
├── module.store.ts      # Session-scoped: 로드된 모듈 캐시, 선택 상태
├── thread.store.ts      # Session-scoped: 스레드 목록, 자동 갱신 주기
├── memory.store.ts      # Session-scoped: 메모리 범위, hex view 상태, 검색 결과
├── java.store.ts        # Session-scoped: 클래스 트리, 메서드, 인스턴스
├── objc.store.ts        # Session-scoped: 클래스 목록, 메서드, 인스턴스
├── native.store.ts      # Session-scoped: Interceptor 후킹, Stalker 상태, 함수 호출
├── hooks.store.ts       # Session-scoped: 통합 후크 레지스트리 (SSOT)
├── script.store.ts      # Session-scoped: 에디터 상태, 로드된 스크립트
├── pinboard.store.ts    # Session-scoped: 핀 아이템, localStorage 영속화
├── callgraph.store.ts   # Session-scoped: Stalker 캡처 데이터 → 그래프 구조
├── network.store.ts     # Session-scoped: 캡처된 HTTP 요청
└── filesystem.store.ts  # Session-scoped: 파일 트리, 열린 파일
```

#### Store 설계 패턴

```typescript
// 예시: device.store.ts
import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";

interface DeviceState {
  devices: DeviceInfo[];
  selectedId: string | null;
  loading: boolean;
}

const [state, setState] = createStore<DeviceState>({
  devices: [],
  selectedId: null,
  loading: false,
});

// 파생 시그널 (computed)
const selectedDevice = () =>
  state.devices.find((d) => d.id === state.selectedId) ?? null;

// 액션
async function refreshDevices() {
  setState("loading", true);
  const devices = await invoke<DeviceInfo[]>("list_devices");
  setState({ devices, loading: false });
}

function selectDevice(id: string) {
  setState("selectedId", id);
}

export { state as deviceState, selectedDevice, refreshDevices, selectDevice };
```

#### Session-Scoped Store 패턴

각 세션은 독립적인 스토어 인스턴스 번들을 가진다. 세션 간 상태 오염을 방지하고,
세션 전환 시 즉시 해당 세션의 상태를 복원할 수 있다.

```typescript
// Session-scoped store 패턴
// 각 세션은 자체 독립 스토어 인스턴스를 보유
type SessionStoreBundle = {
  console: ConsoleState;
  modules: ModuleState;
  threads: ThreadState;
  memory: MemoryState;
  java: JavaState;
  objc: ObjCState;
  native: NativeState;
  hooks: HooksState;
  script: ScriptState;
  pinboard: PinboardState;
  callgraph: CallGraphState;
  network: NetworkState;
  filesystem: FilesystemState;
};

// Map<sessionId, SessionStoreBundle>
const [sessionStores, setSessionStores] = createStore<Record<string, SessionStoreBundle>>({});

// 세션 생성 시 번들 초기화
function initSessionStore(sessionId: string) {
  setSessionStores(sessionId, createDefaultStoreBundle());
}

// 세션 종료 시 번들 정리
function destroySessionStore(sessionId: string) {
  setSessionStores(produce((stores) => delete stores[sessionId]));
}

// 현재 활성 세션의 스토어 접근
const activeStore = () => sessionStores[activeSessionId()];
```

### 2.3 Tauri IPC 래퍼

모든 Tauri 호출은 `lib/tauri.ts`를 통해 타입 안전하게 수행한다.

```typescript
// lib/tauri.ts
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";

const IS_TAURI = typeof window !== "undefined" && "__TAURI__" in window;

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!IS_TAURI) {
    console.warn(`[CARF] Tauri invoke '${cmd}' called outside Tauri environment`);
    throw new Error(`Tauri not available: ${cmd}`);
  }
  return tauriInvoke<T>(cmd, args);
}

export function listen<T>(event: string, handler: (payload: T) => void) {
  if (!IS_TAURI) return () => {};
  return tauriListen<T>(event, (e) => handler(e.payload));
}
```

### 2.4 라우팅 & 화면 구조

SPA 단일 페이지. 라우터 없이 상태 기반으로 화면 전환한다.

```
App
├── DeviceView          ← 디바이스 미선택 시
│   ├── DevicePanel
│   └── (빈 메인 영역)
│
├── ProcessView         ← 디바이스 선택, 세션 없을 때
│   ├── DevicePanel (축소)
│   ├── ProcessPanel
│   └── AttachModal (조건부)
│
└── SessionView         ← 활성 세션 있을 때 (IDE-Hybrid 레이아웃)
    ├── SessionTabBar          ← 멀티 세션 탭 (최대 5개, 브라우저 탭 패턴)
    ├── SessionToolbar         ← Back, ProcessInfo, Pause/Resume, Reload, Detach
    ├── Resizable(horizontal)
    │   ├── NavBar (48px 아이콘 레일)  ← 13개 탭 아이콘, 활성 인디케이터
    │   ├── MainContent              ← 선택된 탭 콘텐츠
    │   └── InspectorPanel (320px)   ← 컨텍스트 의존 상세 패널, 토글 가능
    └── ConsolePanel (하단)        ← 모든 탭에서 공유, 리사이즈/접기 가능
        ├── Console 서브탭
        ├── Hook Events 서브탭
        ├── System 서브탭
        └── Timeline 서브탭
```

### 2.5 컴포넌트 컨벤션

```typescript
// 1. 파일명: PascalCase.tsx
// 2. named export만 사용
// 3. Props는 interface로 정의
// 4. solid-ui 컴포넌트 활용

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";

interface ProcessItemProps {
  process: ProcessInfo;
  onAttach: (pid: number) => void;
  onSpawn: (identifier: string) => void;
}

export function ProcessItem(props: ProcessItemProps) {
  return (
    <div class="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 rounded-md">
      <span class="text-sm font-mono text-muted-foreground w-16">
        {props.process.pid}
      </span>
      <span class="text-sm flex-1 truncate">{props.process.name}</span>
      <div class="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => props.onAttach(props.process.pid)}>
          Attach
        </Button>
        <Button size="sm" variant="ghost" onClick={() => props.onSpawn(props.process.identifier)}>
          Spawn
        </Button>
      </div>
    </div>
  );
}
```

### 2.6 크로스 탭 내비게이션

SessionView 내에서 탭 간 컨텍스트를 유지하며 이동할 수 있는 내비게이션 시스템.
예를 들어 Modules 탭에서 특정 함수 주소를 클릭하면 Memory 탭의 해당 주소로 이동하거나,
Native 탭에서 해당 함수에 Interceptor를 설정할 수 있다.

```typescript
// 크로스 탭 내비게이션
interface NavigateOptions {
  tab: TabId;
  context?: Record<string, unknown>;
}

type TabId =
  | "console"
  | "modules"
  | "threads"
  | "memory"
  | "java"
  | "objc"
  | "native"
  | "script"
  | "hooks"
  | "pinboard"
  | "callgraph"
  | "network"
  | "files";

function navigateTo(options: NavigateOptions): void;

// 사용 예시:
// Modules 탭에서 함수 주소 클릭 → Memory 탭의 해당 주소로 이동
// navigateTo({ tab: "memory", context: { address: "0x7fff..." } })
//
// Modules 탭에서 함수 → Native 탭에서 후킹 설정
// navigateTo({ tab: "native", context: { address: "0x7fff...", action: "hook" } })
//
// Java 탭에서 메서드 → Hooks 탭에서 후크 상세 확인
// navigateTo({ tab: "hooks", context: { hookId: "hook-123" } })
```

### 2.7 핀 시스템

분석 중 중요한 항목(모듈, 주소, 함수, 스레드, 클래스, 후크)을 핀으로 고정하여
Pinboard 탭에서 통합 관리한다. 핀은 세션 스코프이며 localStorage에 영속화된다.

```typescript
interface PinItem {
  id: string;
  type: "module" | "address" | "function" | "thread" | "class" | "hook";
  name: string;
  address: string | null;
  source: TabId;               // 핀이 생성된 원본 탭
  tags: string[];              // 사용자 태그 (필터링용)
  memo: string;                // 사용자 메모
  metadata: Record<string, unknown>;  // 타입별 추가 데이터
  pinnedAt: number;            // 핀 생성 타임스탬프
}

// Pinboard 기능:
// - 모든 탭에서 항목 우클릭 또는 핀 아이콘으로 핀 추가
// - Pinboard 탭에서 태그/타입별 필터링
// - 핀 클릭 시 원본 탭으로 크로스 탭 내비게이션
// - 메모 추가/수정으로 분석 노트 기록
// - localStorage 영속화로 세션 재접속 시 복원
```

---

## 3. Backend Architecture (Rust/Tauri 2)

### 3.1 모듈 구조

```
src-tauri/src/
├── main.rs                    # 엔트리포인트
├── lib.rs                     # Tauri 앱 빌더, 플러그인 등록
├── error.rs                   # 통합 에러 타입 (thiserror)
│
├── commands/                  # Tauri IPC 커맨드 (thin layer)
│   ├── mod.rs
│   ├── device.rs              # 디바이스 관련 커맨드
│   ├── process.rs             # 프로세스 관련 커맨드
│   ├── session.rs             # 세션 관련 커맨드
│   ├── agent.rs               # Agent RPC 프록시 커맨드
│   └── adb.rs                 # ADB 관련 커맨드
│
├── services/                  # 비즈니스 로직
│   ├── mod.rs
│   ├── frida.rs               # Frida DeviceManager 래퍼
│   ├── session_manager.rs     # 세션 풀 관리
│   ├── script_loader.rs       # Agent 스크립트 로드/관리
│   └── adb.rs                 # ADB 디바이스 관리
│
└── state/                     # Tauri 앱 상태
    └── mod.rs                 # AppState 정의
```

### 3.2 Frida Service 설계

Frida 서비스는 앱의 핵심이다. `DeviceManager`를 싱글턴으로 유지하고
모든 디바이스/세션 작업을 중앙 관리한다.

```rust
// services/frida.rs (개념 설계)

use frida::{DeviceManager, Device, Session, Script, Frida};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct FridaService {
    frida: Arc<Frida>,
    device_manager: Arc<DeviceManager>,
    sessions: Arc<RwLock<HashMap<String, SessionHandle>>>,
}

pub struct SessionHandle {
    pub session: Session,
    pub script: Option<Script>,
    pub device_id: String,
    pub pid: u32,
    pub created_at: Instant,
}

impl FridaService {
    pub fn new() -> Result<Self> { ... }

    // 디바이스
    pub async fn list_devices(&self) -> Result<Vec<DeviceInfo>> { ... }
    pub async fn add_remote_device(&self, address: &str) -> Result<DeviceInfo> { ... }
    pub async fn remove_remote_device(&self, address: &str) -> Result<()> { ... }

    // 프로세스
    pub async fn list_processes(&self, device_id: &str) -> Result<Vec<ProcessInfo>> { ... }
    pub async fn list_applications(&self, device_id: &str) -> Result<Vec<AppInfo>> { ... }

    // 세션
    pub async fn spawn(&self, device_id: &str, opts: SpawnOptions) -> Result<SessionId> { ... }
    pub async fn attach(&self, device_id: &str, opts: AttachOptions) -> Result<SessionId> { ... }
    pub async fn detach(&self, session_id: &str) -> Result<()> { ... }
    pub async fn resume(&self, session_id: &str) -> Result<()> { ... }

    // Agent RPC 프록시
    pub async fn rpc_call(
        &self,
        session_id: &str,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value> { ... }
}
```

### 3.3 Command 레이어

Commands는 **thin adapter**다. 비즈니스 로직 없이 IPC ↔ Service를 연결만 한다.

```rust
// commands/device.rs

use tauri::State;
use crate::services::frida::FridaService;
use crate::error::AppError;

#[tauri::command]
pub async fn list_devices(
    frida: State<'_, FridaService>,
) -> Result<Vec<DeviceInfo>, AppError> {
    frida.list_devices().await
}

#[tauri::command]
pub async fn add_remote_device(
    frida: State<'_, FridaService>,
    address: String,
) -> Result<DeviceInfo, AppError> {
    frida.add_remote_device(&address).await
}
```

### 3.4 이벤트 시스템

Backend에서 Frontend로의 실시간 이벤트는 Tauri Event를 사용한다.

```rust
// 이벤트 정의
pub mod events {
    // Device
    pub const DEVICE_ADDED: &str = "carf://device/added";
    pub const DEVICE_REMOVED: &str = "carf://device/removed";
    pub const DEVICE_CHANGED: &str = "carf://device/changed";

    // Session
    pub const SESSION_DETACHED: &str = "carf://session/detached";

    // Agent
    pub const AGENT_MESSAGE: &str = "carf://agent/message";
    pub const AGENT_LOG: &str = "carf://agent/log";

    // Process
    pub const PROCESS_CRASHED: &str = "carf://process/crashed";
    pub const CHILD_ADDED: &str = "carf://child/added";

    // Hook
    pub const HOOK_EVENT: &str = "carf://hook/event";

    // Scan
    pub const SCAN_PROGRESS: &str = "carf://scan/progress";
    pub const SCAN_RESULT: &str = "carf://scan/result";

    // Observer (Agent → Backend 중계)
    pub const THREAD_ADDED: &str = "carf://thread/added";
    pub const THREAD_REMOVED: &str = "carf://thread/removed";
    pub const THREAD_RENAMED: &str = "carf://thread/renamed";
    pub const MODULE_LOADED: &str = "carf://module/loaded";
    pub const MODULE_UNLOADED: &str = "carf://module/unloaded";

    // Stalker / Network / Memory Monitor
    pub const STALKER_EVENT: &str = "carf://stalker/event";
    pub const NETWORK_REQUEST: &str = "carf://network/request";
    pub const MEMORY_ACCESS: &str = "carf://memory/access";
}

// 이벤트 발행
fn setup_device_events(app: &AppHandle, dm: &DeviceManager) {
    dm.on_added(|device| {
        app.emit(events::DEVICE_ADDED, DeviceInfo::from(device)).ok();
    });
    dm.on_removed(|device| {
        app.emit(events::DEVICE_REMOVED, device.id()).ok();
    });
}
```

### 3.5 에러 처리

모든 에러는 `AppError` enum으로 통합하고, Frontend에는 사용자 친화적 메시지만 전달한다.

```rust
// error.rs
use thiserror::Error;
use serde::Serialize;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Device not found: {0}")]
    DeviceNotFound(String),

    #[error("Failed to attach: {0}")]
    AttachFailed(String),

    #[error("Session expired: {0}")]
    SessionExpired(String),

    #[error("Agent RPC error: {0}")]
    AgentRpcError(String),

    #[error("ADB error: {0}")]
    AdbError(String),

    #[error("Internal error")]
    Internal(#[from] anyhow::Error),
}

// Tauri IPC 직렬화
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        serializer.serialize_str(&self.to_string())
    }
}
```

### 3.6 App State

```rust
// state/mod.rs
use crate::services::{frida::FridaService, adb::AdbService};

pub struct AppState {
    pub frida: FridaService,
    pub adb: AdbService,
}

// lib.rs
pub fn run() {
    let app_state = AppState::new().expect("Failed to initialize");

    tauri::Builder::default()
        .manage(app_state.frida)
        .manage(app_state.adb)
        .invoke_handler(tauri::generate_handler![
            commands::device::list_devices,
            commands::device::add_remote_device,
            commands::device::remove_remote_device,
            commands::process::list_processes,
            commands::process::list_applications,
            commands::process::kill_process,
            commands::session::spawn_and_attach,
            commands::session::attach,
            commands::session::detach,
            commands::session::resume,
            commands::agent::rpc_call,
            commands::adb::adb_devices,
            commands::adb::adb_push_frida_server,
            commands::adb::adb_start_frida_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 4. Agent Architecture (CARF Std Script)

### 4.1 개요

CARF Std Script는 대상 프로세스에 주입되어 실행되는 Frida 스크립트다.
Host(Tauri Backend)와 RPC로 통신하며, 성능 크리티컬 로직은 RustModule로 구현한다.

### 4.2 모듈 구조

```
src-agent/src/
├── index.ts                  # 엔트리포인트, 16개 모듈 side-effect import
├── bridges.ts                # 런타임 브릿지 (Java, ObjC, Swift)
│
├── rpc/
│   ├── router.ts             # registerHandler/createRpcExports
│   ├── types.ts              # RpcHandler, RpcResponse, AgentEvent
│   └── protocol.ts           # emitLog/emitHookEvent/emitStalkerEvent 등
│
├── runtime/
│   └── frida-compat.ts       # Frida v17 호환성 래퍼
│
├── types/
│   ├── frida-rpc.d.ts        # rpc.exports 타입
│   └── bridges.d.ts          # frida-*-bridge 모듈 선언
│
├── modules/                  # 기능 모듈 (16개, ~102 RPC 핸들러)
│   │
│   │  ── Core ──
│   ├── process.ts      [ 4]  # 프로세스 정보, 메모리 범위
│   ├── module.ts       [10]  # Exports/Imports/Symbols, Observer, Sections, Version
│   ├── thread.ts       [ 6]  # 열거, 백트레이스, Observer, runOnThread
│   │
│   │  ── Memory ──
│   ├── memory.ts       [10]  # Read/Write/Scan/Patch/Protect/Alloc/Dump/Compare
│   ├── monitor.ts      [ 4]  # MemoryAccessMonitor (접근 감시)
│   │
│   │  ── Runtime Bridges ──
│   ├── java.ts         [14]  # 클래스/메서드/필드, Heap 검색, ClassLoader
│   ├── objc.ts         [ 8]  # 클래스/메서드, 인스턴스 검색
│   ├── swift.ts        [ 8]  # 모듈/타입 열거, Demangle, 후킹
│   ├── il2cpp.ts       [11]  # Unity IL2CPP, 도메인/클래스, 메타데이터 덤프
│   ├── native.ts       [ 5]  # Interceptor 후킹, NativeFunction 호출
│   │
│   │  ── Tracing ──
│   ├── stalker.ts      [ 4]  # 코드 트레이싱, Summary/Sampling 모드
│   │
│   │  ── I/O ──
│   ├── network.ts      [ 3]  # SSL/HTTP 캡처, Java 네트워크 후킹
│   ├── filesystem.ts   [ 4]  # 디렉토리 탐색, File I/O, SQLite
│   ├── console.ts      [ 1]  # REPL evaluate
│   │
│   │  ── Security & Utility ──
│   ├── resolver.ts     [ 5]  # ApiResolver, DebugSymbol, Export 룩업
│   └── antidetect.ts   [ 7]  # Cloak API, SSL/Root Bypass
│
└── rust/                     # RustModule 소스 (Phase 5)
    ├── scanner.rs            # 고속 메모리 패턴 스캔
    ├── hooks.rs              # Interceptor onEnter/onLeave 핫 콜백
    └── stalker_cb.rs         # Stalker transform 콜백
```

### 4.3 RPC Router

```typescript
// rpc/router.ts
type RpcHandler = (params: unknown) => unknown | Promise<unknown>;

const handlers = new Map<string, RpcHandler>();

export function registerHandler(method: string, handler: RpcHandler): void {
  if (handlers.has(method)) {
    throw new Error(`RPC handler already registered: ${method}`);
  }
  handlers.set(method, handler);
}

export function createRpcExports(): Record<string, (...args: unknown[]) => unknown> {
  // 각 핸들러를 try-catch + JSON 직렬화로 래핑
  // 응답 형식: { success: true, data } | { success: false, error }
  // 비동기 핸들러 자동 지원
}
```

```typescript
// index.ts — Side-effect import 패턴
import "./bridges";                    // 런타임 브릿지 초기화
import { createRpcExports } from "./rpc/router";

// 16개 모듈 — import만으로 registerHandler() 호출됨
import "./modules/process";
import "./modules/module";
import "./modules/thread";
import "./modules/memory";
import "./modules/java";
import "./modules/objc";
import "./modules/native";
import "./modules/swift";
import "./modules/il2cpp";
import "./modules/stalker";
import "./modules/network";
import "./modules/filesystem";
import "./modules/console";
import "./modules/monitor";
import "./modules/resolver";
import "./modules/antidetect";

// RPC 노출 — 등록된 ~102개 핸들러가 자동으로 포함
rpc.exports = createRpcExports();
```

### 4.4 JS ↔ RustModule 경계

> **현재 상태**: Agent 모듈은 100% JavaScript/TypeScript로 구현됨.
> RustModule은 Phase 5에서 핫 콜백(Interceptor onEnter/onLeave, Stalker transform)을
> 마이그레이션할 때 도입 예정.

```typescript
// 현재 구현 패턴 — modules/memory.ts (실제 코드 예시)

import { registerHandler } from "../rpc/router";
import { emitEvent } from "../rpc/protocol";

// 각 핸들러를 registerHandler()로 직접 등록 (side-effect)
registerHandler("readMemory", (params: { address: string; size: number }) => {
  const p = ptr(params.address);
  const bytes = p.readByteArray(params.size);    // v17 인스턴스 메서드
  return { address: params.address, size: params.size, data: bytes };
});

registerHandler("patchMemory", (params: { address: string; bytes: string }) => {
  const target = ptr(params.address);
  const patch = hexToBytes(params.bytes);
  // Memory.patchCode: 임시 writable 매핑 + cache flush 자동 처리
  Memory.patchCode(target, patch.length, (code) => {
    code.writeByteArray(patch);
  });
  return { patched: true, address: params.address, size: patch.length };
});

registerHandler("scanMemory", (params) => {
  // Frida 내장 Memory.scanSync() 사용 (JS 레벨)
  // Phase 5에서 대용량(>1MB) 스캔은 RustModule로 마이그레이션 예정
  const results = Memory.scanSync(base, size, params.pattern);
  return results;
});
```

**Phase 5 마이그레이션 계획:**

| 현재 (JS) | Phase 5 (RustModule) | 예상 개선 |
|-----------|---------------------|----------|
| Interceptor 콜백 (~1000ns) | RustModule 콜백 (~100ns) | 10x |
| Memory.scanSync (JS) | fast_scan (Rust) | 5-10x |
| Stalker callout (JS) | Stalker callout (Rust) | 10x |

### 4.5 이벤트 프로토콜

Agent → Host 방향의 이벤트는 `send()`를 통해 구조화된 메시지로 전달한다.
`rpc/protocol.ts`에 이벤트 타입별 전용 이미터 함수가 정의되어 있다.

**기본 프로토콜:**

```typescript
// rpc/protocol.ts
interface AgentEvent {
  type: string;
  timestamp: number;     // Date.now()
  data: unknown;
}

function emitEvent(type: string, data: unknown): void {
  send({ type, timestamp: Date.now(), data });
}
```

**전용 이미터 함수:**

| 함수 | 이벤트 타입 | 소스 모듈 | 설명 |
|------|-----------|----------|------|
| `emitLog(level, message, data?)` | `console/message` | console, antidetect | 로그 메시지 (level, source, content) |
| `emitHookEvent(hookId, type, details)` | `hook/event` | java, objc, native, swift, il2cpp | 후킹 트리거 (args, retval, backtrace) |
| `emitStalkerEvent(events)` | `stalker/event` | stalker | Stalker 추적 이벤트 배치 |
| `emitNetworkRequest(request)` | `network/request` | network | HTTP/HTTPS 요청 캡처 |
| `emitMemoryAccess(access)` | `memory/access` | monitor | 메모리 접근 감시 이벤트 |
| `emitEvent(type, data)` | 범용 | memory (scan) | 범용 이벤트 (scan/progress, scan/result) |

**Observer 이벤트 (직접 send()):**

| 이벤트 | 소스 모듈 | 설명 |
|--------|----------|------|
| `carf://thread/added` | thread | 스레드 생성 |
| `carf://thread/removed` | thread | 스레드 종료 |
| `carf://thread/renamed` | thread | 스레드 이름 변경 |
| `carf://module/loaded` | module | 모듈 로드 |
| `carf://module/unloaded` | module | 모듈 언로드 |

### 4.6 Runtime Bridge 추상화

Frida v17에서 Java, ObjC, Swift 런타임이 전역 변수에서 제거되어 별도 패키지로 분리되었다.
`bridges.ts`에서 이를 추상화한다.

```typescript
// bridges.ts
import JavaBridge from "frida-java-bridge";
import ObjCBridge from "frida-objc-bridge";

// globalThis에 있으면 사용, 없으면 패키지에서 import
export const JavaRuntime = globalScope.Java ?? JavaBridge;
export const ObjCRuntime = globalScope.ObjC ?? ObjCBridge;

// Swift는 플랫폼에 따라 사용 불가할 수 있음 (try-catch)
export const SwiftRuntime: SwiftBridgeApi | null = loadSwiftBridge();
```

**Swift Bridge 인터페이스:**

```typescript
interface SwiftBridgeApi {
  available: boolean;
  api: Record<string, unknown>;
  modules: { enumerate(): SwiftModule[] };
  demangle(symbol: string): string;
  enumerateTypesSync(module: string): SwiftTypeDescriptor[];
}
```

### 4.7 Frida API 호환성 레이어

`runtime/frida-compat.ts`는 Frida v17에서 제거된 정적 메서드에 대한 래퍼를 제공한다.

```typescript
// runtime/frida-compat.ts

// Module.findExportByName(mod, sym) 대체
export function findExportByName(moduleName: string | null, symbolName: string): NativePointer | null {
  if (moduleName) {
    const mod = Process.findModuleByName(moduleName);
    return mod ? mod.findExportByName(symbolName) : null;
  }
  return Module.findGlobalExportByName(symbolName);
}

// Memory.readByteArray(addr, len) 대체
export function readByteArray(address: NativePointerValue, length: number): ArrayBuffer | null {
  return ptr(address).readByteArray(length);
}

// Memory.writeByteArray(addr, val) 대체
export function writeByteArray(address: NativePointerValue, value: ArrayBuffer | Uint8Array | number[]): void {
  ptr(address).writeByteArray(value);
}
```

---

## 5. 데이터 플로우

### 5.1 디바이스 열거

```
Frontend                    Backend                     System
   │                           │                           │
   │  invoke("list_devices")   │                           │
   │ ─────────────────────────>│                           │
   │                           │  DeviceManager            │
   │                           │  .enumerate_devices()     │
   │                           │ ─────────────────────────>│
   │                           │<─────────────────────────│
   │                           │  [Device { id, name,      │
   │                           │    type, icon }]           │
   │<─────────────────────────│                           │
   │  DeviceInfo[]             │                           │
   │  → setState(devices)      │                           │
   │                           │                           │
   │  listen("carf://device/added")                        │
   │<══════════════════════════│  (DeviceManager callback) │
   │  DeviceInfo               │                           │
   │  → setState(devices, push)│                           │
```

### 5.2 Attach 플로우

```
Frontend                    Backend                        Target
   │                           │                              │
   │  invoke("attach", {       │                              │
   │    deviceId, pid, opts })  │                              │
   │ ─────────────────────────>│                              │
   │                           │  device.attach(pid, opts)    │
   │                           │ ────────────────────────────>│
   │                           │<────────────────────────────│
   │                           │  Session                     │
   │                           │                              │
   │                           │  session.create_script(      │
   │                           │    carf_std_script)           │
   │                           │ ────────────────────────────>│
   │                           │<────────────────────────────│
   │                           │  Script                      │
   │                           │                              │
   │                           │  script.load()               │
   │                           │ ────────────────────────────>│
   │                           │                              │ ← Agent 초기화
   │                           │                              │   RPC exports 등록
   │                           │                              │   RustModule 컴파일
   │                           │                              │
   │                           │  script.exports.ping()       │
   │                           │ ────────────────────────────>│
   │                           │<──────────── true ──────────│
   │                           │                              │
   │<─────────────────────────│                              │
   │  SessionInfo { id, pid,   │                              │
   │    status: "active" }     │                              │
   │  → setState(sessions)     │                              │
```

### 5.3 Spawn 플로우

```
Frontend                    Backend                        Target
   │                           │                              │
   │  invoke("spawn_and_attach", {                            │
   │    deviceId, identifier,  │                              │
   │    spawnOpts, scriptPath })│                              │
   │ ─────────────────────────>│                              │
   │                           │  device.spawn(id, opts)      │
   │                           │ ────────────────────────────>│
   │                           │<──────── pid ───────────────│
   │                           │                              │ ← 프로세스 생성 (suspended)
   │                           │  device.attach(pid)          │
   │                           │ ────────────────────────────>│
   │                           │<────────────────────────────│
   │                           │                              │
   │                           │  session.create_script(src)  │
   │                           │  script.load()               │
   │                           │ ────────────────────────────>│
   │                           │                              │ ← Agent 로드
   │                           │                              │
   │                           │  if (autoResume) {           │
   │                           │    device.resume(pid)        │
   │                           │ ────────────────────────────>│
   │                           │  }                           │ ← 프로세스 실행 시작
   │                           │                              │
   │<─────────────────────────│                              │
   │  SessionInfo              │                              │
```

### 5.4 Agent RPC 호출

```
Frontend                    Backend                        Agent
   │                           │                              │
   │  invoke("rpc_call", {     │                              │
   │    sessionId,             │                              │
   │    method: "enumerateJavaClasses",                       │
   │    params: { filter: "com.example" }                     │
   │  })                       │                              │
   │ ─────────────────────────>│                              │
   │                           │  script.exports              │
   │                           │    .enumerateJavaClasses(    │
   │                           │      { filter })             │
   │                           │ ────────────────────────────>│
   │                           │                              │ ← Java.perform()
   │                           │                              │   Java.enumerateLoadedClasses()
   │                           │<──── string[] ──────────────│
   │<─────────────────────────│                              │
   │  string[]                 │                              │
```

---

## 6. ADB 통합

### 6.1 ADB Service

Android 디바이스 관리를 위한 ADB 통합 레이어.

```rust
// services/adb.rs (개념 설계)

pub struct AdbService {
    adb_path: PathBuf,  // adb 바이너리 경로
}

impl AdbService {
    /// ADB 디바이스 목록 (serial, state, model, product)
    pub async fn list_devices(&self) -> Result<Vec<AdbDevice>> { ... }

    /// 디바이스 상세 정보 (getprop)
    pub async fn get_device_props(&self, serial: &str) -> Result<DeviceProps> { ... }

    /// frida-server 바이너리를 디바이스에 push
    pub async fn push_frida_server(&self, serial: &str, version: &str, arch: &str) -> Result<()> { ... }

    /// frida-server 시작 (root 권한)
    pub async fn start_frida_server(&self, serial: &str) -> Result<()> { ... }

    /// frida-server 상태 확인
    pub async fn is_frida_server_running(&self, serial: &str) -> Result<bool> { ... }

    /// 파일 push (APK 설치 등)
    pub async fn push_file(&self, serial: &str, local: &Path, remote: &str) -> Result<()> { ... }

    /// 셸 명령 실행
    pub async fn shell(&self, serial: &str, command: &str) -> Result<String> { ... }

    /// 앱 설치
    pub async fn install_apk(&self, serial: &str, apk_path: &Path) -> Result<()> { ... }

    /// WiFi ADB pairing
    pub async fn pair(&self, address: &str, code: &str) -> Result<()> { ... }

    /// WiFi ADB connect
    pub async fn connect(&self, address: &str) -> Result<()> { ... }
}
```

### 6.2 DeviceProps (Android 디바이스 상세)

```rust
pub struct DeviceProps {
    pub model: String,           // ro.product.model
    pub manufacturer: String,    // ro.product.manufacturer
    pub android_version: String, // ro.build.version.release
    pub sdk_version: u32,        // ro.build.version.sdk
    pub abi: String,             // ro.product.cpu.abi (arm64-v8a 등)
    pub security_patch: String,  // ro.build.version.security_patch
    pub build_id: String,        // ro.build.display.id
    pub is_rooted: bool,         // su 존재 여부
    pub selinux_status: String,  // Enforcing / Permissive
}
```

---

## 7. 타입 시스템

### 7.1 공유 타입 (Frontend ↔ Backend)

Frontend와 Backend 간에 공유되는 IPC 타입 정의.

```typescript
// src/lib/types.ts

// ─── Device ───
interface DeviceInfo {
  id: string;
  name: string;
  type: "local" | "usb" | "remote";
  icon: string | null;         // base64 encoded
  os: OsInfo | null;
  arch: string | null;
  status: "connected" | "disconnected" | "pairing";
}

interface OsInfo {
  platform: "android" | "ios" | "macos" | "linux" | "windows";
  version: string;
}

// ─── Process ───
interface ProcessInfo {
  pid: number;
  name: string;
  identifier: string | null;   // 패키지/번들 ID
  icon: string | null;         // base64 encoded (small icon)
}

interface AppInfo {
  identifier: string;          // com.example.app
  name: string;
  pid: number | null;          // 실행 중이면 PID
  icon: string | null;
}

// ─── Session ───
interface SessionInfo {
  id: string;
  deviceId: string;
  pid: number;
  processName: string;
  status: "active" | "detached" | "crashed";
  mode: "spawn" | "attach";
  createdAt: number;
}

// ─── Spawn/Attach Options ───
interface SpawnOptions {
  identifier: string;
  argv?: string[];
  envp?: Record<string, string>;
  cwd?: string;
  stdio?: "inherit" | "pipe";
  autoResume?: boolean;
  scriptPath?: string;
}

interface AttachOptions {
  target: number | string;     // PID or process name
  realm?: "native" | "emulated";
  persistTimeout?: number;
  runtime?: "qjs" | "v8";
  enableChildGating?: boolean;
  scriptPath?: string;
}

// ─── Agent RPC ───
interface RpcRequest {
  sessionId: string;
  method: string;
  params?: unknown;
}

// ─── Module ───
interface ModuleInfo {
  name: string;
  base: string;                // hex address
  size: number;
  path: string;
}

interface ExportInfo {
  name: string;
  address: string;
  type: "function" | "variable";
}

interface ImportInfo {
  name: string;
  address: string;
  module: string;
  type: "function" | "variable";
}

// ─── Thread ───
interface ThreadInfo {
  id: number;
  name: string | null;
  state: "running" | "stopped" | "waiting" | "uninterruptible" | "halted";
}

interface BacktraceFrame {
  address: string;
  moduleName: string | null;
  symbolName: string | null;
  fileName: string | null;
  lineNumber: number | null;
}

// ─── Hook ───
interface HookInfo {
  id: string;
  target: string;              // 함수 이름 또는 주소
  address: string;
  type: "interceptor" | "java" | "objc";
  active: boolean;
}

// ─── Console ───
interface ConsoleMessage {
  id: string;
  timestamp: number;
  level: "log" | "warn" | "error" | "info" | "debug";
  source: "agent" | "system" | "user";
  content: string;
  data?: unknown;
}
```

---

## 8. 빌드 시스템

### 8.1 프론트엔드 빌드

```
bun + Vite
├── SolidJS (vite-plugin-solid)
├── Tailwind CSS v4 (postcss)
└── TypeScript (strict mode)
```

### 8.2 Agent 빌드

```
frida-compile
├── 입력: src-agent/src/index.ts
├── 출력: src-agent/dist/_agent.js
├── 타겟: none (Frida V8 런타임)
├── 번들: IIFE
└── 소스맵: 포함
```

Agent 빌드 결과물은 Tauri 앱에 포함(embed)되어 배포된다.
`src-tauri/`에서 빌드 시 `src-agent/dist/_agent.js`를 `include_str!()` 또는
리소스로 번들링한다.

### 8.3 백엔드 빌드

```
cargo (via tauri-cli)
├── frida-rust (with auto-download feature)
├── frida-sys (native bindings)
├── tauri 2
└── serde / serde_json / thiserror / anyhow
```

### 8.4 빌드 커맨드

```bash
# 개발
bun run dev              # Vite dev server (브라우저 모드)
bun run tauri dev        # Tauri 전체 (Frontend + Backend)
bun run compile:agent    # Agent 스크립트 컴파일

# 프로덕션
bun run build            # Frontend 빌드
bun run tauri build      # 전체 프로덕션 빌드
```

---

## 9. 보안 고려사항

### 9.1 IPC 보안

- Tauri IPC는 allowlist 기반으로 허용된 커맨드만 노출
- CSP(Content Security Policy) 설정으로 외부 리소스 로드 제한
- Agent 스크립트는 검증된 소스만 로드

### 9.2 네트워크 보안

- Remote device 연결 시 Frida의 TLS 인증서 기반 인증 지원
- ADB WiFi 연결 시 pairing 코드 기반 인증

### 9.3 데이터 보안

- 세션 데이터는 메모리에만 유지 (디스크 저장 시 사용자 명시 동의)
- 민감 정보 (키, 토큰) 로그 필터링
- 분석 결과 내보내기 시 PII 마스킹 옵션

---

## 10. 향후 확장 고려

### 10.1 플러그인 시스템 (Phase 4+)

```
plugins/
├── manifest.json         # 플러그인 메타데이터
├── agent/               # 추가 Agent 스크립트
│   └── custom-hooks.ts
├── ui/                  # 추가 UI 컴포넌트
│   └── CustomPanel.tsx
└── backend/             # 추가 Tauri 커맨드 (Rust)
    └── custom.rs
```

### 10.2 멀티 세션 (설계 완료)

멀티 세션 아키텍처는 설계가 완료되었으며, 다음과 같은 구조로 구현된다:

- **세션 탭**: 상단에 브라우저 탭 패턴으로 최대 5개 동시 세션 표시
- **독립 스토어 번들**: 각 세션은 `SessionStoreBundle`로 완전히 독립된 상태를 유지 (Section 2.2 참조)
- **세션 전환**: 탭 클릭 시 해당 세션의 스토어 번들로 즉시 전환, UI 상태 유지
- **세션 생명주기**: 생성 시 `initSessionStore()`, 종료 시 `destroySessionStore()`로 스토어 관리

#### 향후 확장 (미설계)

- 디바이스 간 세션 비교 뷰
- 동기화된 후킹 (같은 후크를 여러 디바이스에 적용)

### 10.3 협업 기능

- 분석 프로젝트 파일 (.carf) 내보내기/가져오기
- 후킹 스크립트 공유 (커뮤니티 저장소)
- 분석 리포트 생성 (HTML/PDF)

### 10.4 Swift/IL2CPP 분석 UI

Agent에 Swift(8 핸들러)와 IL2CPP(11 핸들러)가 이미 구현되어 있다.
전용 UI 탭 또는 기존 탭(Java/ObjC와 유사한 패턴) 확장이 필요하다.

- **Swift 탭**: 모듈 열거, 타입(class/struct/enum/protocol) 트리, Demangle, 후킹
- **IL2CPP 탭**: 도메인/어셈블리 탐색, 클래스/메서드/필드 열거, 메타데이터 덤프, 후킹

### 10.5 Anti-Detection 대시보드

Agent에 7개 AntiDetect 핸들러가 구현되어 있다.
통합 대시보드 UI가 필요하다.

- **Cloak 관리**: 은닉된 스레드/메모리 범위 목록, 추가/제거 UI
- **SSL Pinning Bypass**: 원클릭 활성화, 후킹된 함수 목록 표시
- **Root/Jailbreak Detection Bypass**: 원클릭 활성화, 우회 상태 모니터링

### 10.6 Symbol Resolver 패널

Agent에 5개 Resolver 핸들러가 구현되어 있다.
Inspector Panel 또는 Command Palette에 통합한다.

- **ApiResolver**: 패턴 기반 심볼 검색 (`exports:*!open*`, `-[UIView *init*]`)
- **DebugSymbol**: 주소 → 심볼 해석 (DWARF 포함)
- **Global Export 검색**: 모듈 전체에서 export 검색

---

*Last updated: 2026-03-11*
*Version: 2.1.0-alpha*
