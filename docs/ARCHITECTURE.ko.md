# CARF 아키텍처

이 문서는 CARF의 시스템 아키텍처를 설명합니다.

[English](ARCHITECTURE.md)

## 개요

CARF는 3계층 아키텍처로 구성됩니다:

1. **Frontend (React)** - 사용자 인터페이스
2. **Backend (Tauri/Rust)** - 시스템 통합 및 Frida 관리
3. **Agent (TypeScript)** - 타겟 프로세스 내 실행 코드

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CARF Application                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    React Frontend                               │ │
│  │                                                                  │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │ │
│  │  │  Pages   │  │Components│  │  Stores  │  │  Hooks   │       │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │ │
│  │       │              │             │             │              │ │
│  │       └──────────────┴──────┬──────┴─────────────┘              │ │
│  │                             │                                    │ │
│  │                    ┌────────▼────────┐                          │ │
│  │                    │ features/frida  │                          │ │
│  │                    │  - store.ts     │                          │ │
│  │                    │  - backendApi   │                          │ │
│  │                    │  - agentRpc     │                          │ │
│  │                    │  - events       │                          │ │
│  │                    └────────┬────────┘                          │ │
│  │                             │                                    │ │
│  └─────────────────────────────┼────────────────────────────────────┘ │
│                                │                                      │
│                     Tauri IPC  │  invoke() / listen()                │
│                                │                                      │
│  ┌─────────────────────────────▼────────────────────────────────────┐ │
│  │                    Tauri Backend (Rust)                          │ │
│  │                                                                  │ │
│  │  ┌──────────────────┐    ┌──────────────────────────────────┐  │ │
│  │  │     Commands     │    │          FridaService            │  │ │
│  │  │  - frida_*       │───▶│  - DeviceManager                 │  │ │
│  │  │  - library_*     │    │  - SessionManager                │  │ │
│  │  └──────────────────┘    │  - ScriptManager                 │  │ │
│  │                          └──────────────┬───────────────────┘  │ │
│  │                                         │                       │ │
│  └─────────────────────────────────────────┼───────────────────────┘ │
│                                            │                         │
│                          frida-rust        │                         │
│                                            │                         │
└────────────────────────────────────────────┼─────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Target Process                                  │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Frida Agent (JS)                             │ │
│  │                                                                  │ │
│  │  ┌──────────────┐    ┌───────────────────────────────────────┐ │ │
│  │  │  RPC Router  │───▶│            Method Handlers            │ │ │
│  │  │              │    │  - native (modules, exports, hooks)   │ │ │
│  │  │ carf:request │    │  - memory (read, write, scan)         │ │ │
│  │  │ carf:response│    │  - objc (classes, methods)            │ │ │
│  │  │ carf:event   │    │  - java (classes, methods)            │ │ │
│  │  │              │    │  - thread (enumerate, context)        │ │ │
│  │  └──────────────┘    └───────────────────────────────────────┘ │ │
│  │                                                                  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Frontend 아키텍처

### 디렉토리 구조

```
src/
├── App.tsx              # Main app component, layout
├── main.tsx             # Entry point
├── components/
│   ├── layout/          # Layout components
│   │   ├── LayoutContainer.tsx
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   └── StatusBar.tsx
│   ├── panels/          # Panel components
│   │   └── LibraryPanel.tsx
│   └── ui/              # Common UI components
│       ├── Button.tsx
│       ├── CommandPalette.tsx
│       ├── ContextMenu.tsx
│       ├── Input.tsx
│       ├── Layout.tsx
│       ├── ResizablePanel.tsx
│       ├── Tabs.tsx
│       ├── Toolbar.tsx
│       └── TreeView.tsx
├── contexts/
│   └── ThemeContext.tsx # Theme context
├── features/
│   └── frida/           # Frida integration module
│       ├── store.ts     # Frida state (Zustand)
│       ├── backendApi.ts # Tauri IPC wrapper
│       ├── agentRpc.ts  # Agent RPC client
│       ├── events.ts    # Event listeners
│       └── types.ts     # Type definitions
├── hooks/
│   ├── useAgentRpc.ts   # Agent RPC hook
│   └── useKeyboardShortcuts.ts
├── pages/               # Page components
│   ├── attach/          # Process attachment
│   ├── console/         # Console logs
│   ├── java/            # Java exploration
│   ├── memory/          # Memory analysis
│   ├── methods/         # Method exploration
│   ├── native/          # Native exploration
│   ├── objc/            # Objective-C exploration
│   ├── settings/        # Settings
│   ├── swift/           # Swift exploration
│   └── thread/          # Thread analysis
├── stores/              # Zustand stores
│   ├── alertStore.ts    # Alert state
│   ├── consoleStore.ts  # Console state
│   ├── layoutStore.ts   # Layout state
│   ├── libraryStore.ts  # Library state
│   ├── settingsStore.ts # Settings state
│   └── uiStore.ts       # UI state
└── styles/
    ├── theme.ts         # Theme definitions
    └── global.ts        # Global styles
```

### 상태 관리 (Zustand)

```typescript
// 스토어별 책임

// fridaStore - Frida session/script state
useFridaStore: {
  devices, processes, selectedDeviceId,
  attachedSessionId, loadedScriptId,
  init, attach, detach, spawn, kill,
  agentRequest
}

// layoutStore - Layout state
useLayoutStore: {
  rightPanelOpen, rightPanelSize,
  bottomPanelOpen, bottomPanelSize,
  commandPaletteOpen
}

// libraryStore - Library items
useLibraryStore: {
  entries, folders, selectedIds,
  addEntry, removeEntry, toggleStar,
  loadLibrary, saveLibrary
}

// settingsStore - User settings
useSettingsStore: {
  theme, fontSize, rpcTimeout,
  setTheme, setFontSize, resetSettings
}

// consoleStore - Console logs
useConsoleStore: {
  logs, isPaused, filter,
  addLog, clear, exportLogs
}
```

### 컴포넌트 구조

```
App.tsx
├── ThemeProvider
│   └── AppContent
│       ├── Global (Emotion)
│       ├── AlertContainer
│       ├── CommandPalette
│       └── LayoutContainer
│           ├── Navbar
│           ├── MainArea
│           │   ├── Sidebar
│           │   └── ContentWrapper
│           │       └── MainPanelGroup (resizable)
│           │           ├── Panel (main content)
│           │           │   └── VerticalPanelGroup
│           │           │       ├── Panel (tab pages)
│           │           │       │   └── TabPages
│           │           │       └── Panel (console)
│           │           └── Panel (library)
│           │               └── LibraryPanel
│           └── StatusBar
```

## Backend 아키텍처 (Rust)

### 디렉토리 구조

```
src-tauri/src/
├── main.rs              # Entry point
├── lib.rs               # App setup, command registration
├── commands/
│   ├── mod.rs           # Command module
│   ├── frida.rs         # Frida commands
│   └── library.rs       # Library commands
├── frida_service.rs     # Frida service
├── input_service.rs     # Input service
├── error.rs             # Error types
└── services/
    └── mod.rs
```

### Tauri 커맨드

```rust
// Frida commands
#[tauri::command]
pub fn frida_version() -> Result<String, String>;

#[tauri::command]
pub fn frida_list_devices() -> Result<Vec<DeviceInfo>, String>;

#[tauri::command]
pub fn frida_list_processes(device_id: String) -> Result<Vec<ProcessInfo>, String>;

#[tauri::command]
pub fn frida_attach(device_id: String, pid: u32) -> Result<SessionInfo, String>;

#[tauri::command]
pub fn frida_detach(session_id: u32) -> Result<(), String>;

#[tauri::command]
pub fn frida_spawn(device_id: String, program: String, argv: Option<Vec<String>>) -> Result<u32, String>;

#[tauri::command]
pub fn frida_script_post(script_id: u32, message: Value, data: Option<Vec<u8>>) -> Result<(), String>;

// Library commands
#[tauri::command]
pub fn load_library() -> Result<String, String>;

#[tauri::command]
pub fn save_library(data: String) -> Result<(), String>;
```

### 이벤트

```rust
// Backend → Frontend 이벤트
"frida_session_attached"  // 세션 연결됨
"frida_session_detached"  // 세션 해제됨
"frida_script_message"    // 스크립트 메시지
```

## Agent 아키텍처 (TypeScript)

### 디렉토리 구조

```
src-frida/
├── index.ts             # Entry point
├── rpc/
│   └── router.ts        # RPC router
├── methods/
│   ├── index.ts         # Method exports
│   ├── native.ts        # Native methods
│   ├── memory.ts        # Memory methods
│   ├── objc.ts          # Objective-C methods
│   ├── java.ts          # Java methods
│   └── thread.ts        # Thread methods
└── dist/
    └── index.js         # Compiled agent
```

### RPC 프로토콜

```typescript
// Request (Frontend → Agent)
{
  type: "carf:request",
  payload: {
    id: number,
    method: string,
    params: unknown
  }
}

// Response (Agent → Frontend)
{
  type: "carf:response",
  payload: {
    id: number,
    result: "ok" | "error",
    returns: unknown
  }
}

// Event (Agent → Frontend)
{
  type: "carf:event",
  payload: {
    event: string,
    ...data
  }
}
```

### 메소드 카테고리

```typescript
// Native methods
native.listModules()
native.listExports(moduleName)
native.listImports(moduleName)
native.findExportByName(moduleName, exportName)

// Memory methods
memory.read(address, size)
memory.write(address, bytes)
memory.scan(pattern, ranges)
memory.protect(address, size, protection)

// ObjC methods
objc.available()
objc.listClasses()
objc.listMethods(className)
objc.hook(className, methodName, callbacks)

// Java methods
java.available()
java.listClasses()
java.listMethods(className)
java.hook(className, methodName, callbacks)

// Thread methods
thread.enumerate()
thread.getContext(threadId)
thread.setContext(threadId, context)
thread.backtrace(threadId)
```

## 데이터 흐름

### 프로세스 연결 흐름

```
1. User clicks "Attach"
   │
   ▼
2. AttachPage calls useFridaStore.attach(pid)
   │
   ▼
3. store.attach() calls fridaBackendApi.attach()
   │
   ▼
4. Tauri invokes frida_attach command
   │
   ▼
5. FridaService.attach() creates session via frida-rust
   │
   ▼
6. Backend emits "frida_session_attached" event
   │
   ▼
7. events.ts receives event, updates store
   │
   ▼
8. UI re-renders with new session state
```

### RPC 호출 흐름

```
1. Page calls useFridaStore.agentRequest(method, params)
   │
   ▼
2. agentRpc.request() creates request with unique ID
   │
   ▼
3. fridaBackendApi.scriptPost() sends message to backend
   │
   ▼
4. Backend forwards message to Frida script
   │
   ▼
5. Agent's RPC router dispatches to method handler
   │
   ▼
6. Handler executes and returns result
   │
   ▼
7. Agent sends carf:response message
   │
   ▼
8. Backend emits "frida_script_message" event
   │
   ▼
9. agentRpc resolves promise with result
   │
   ▼
10. Page receives data and updates UI
```

## 보안 고려사항

1. **Tauri 보안**
   - CSP (Content Security Policy) 설정
   - 파일 시스템 접근 제한
   - IPC 커맨드 권한 관리

2. **Agent 보안**
   - 타겟 프로세스 내 실행되므로 주의 필요
   - 민감한 데이터 로깅 방지
   - 안전한 메모리 접근

3. **사용자 데이터**
   - 라이브러리 데이터는 로컬 파일에 저장
   - 설정은 LocalStorage에 저장
   - 원격 전송 없음
