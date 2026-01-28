# CARF Architecture

이 문서는 CARF의 시스템 아키텍처를 설명합니다.

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
├── App.tsx              # 메인 앱 컴포넌트, 레이아웃
├── main.tsx             # 엔트리포인트
├── components/
│   ├── layout/          # 레이아웃 컴포넌트
│   │   ├── LayoutContainer.tsx
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   └── StatusBar.tsx
│   ├── panels/          # 패널 컴포넌트
│   │   └── LibraryPanel.tsx
│   └── ui/              # 공통 UI 컴포넌트
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
│   └── ThemeContext.tsx # 테마 컨텍스트
├── features/
│   └── frida/           # Frida 통합 모듈
│       ├── store.ts     # Frida 상태 (Zustand)
│       ├── backendApi.ts # Tauri IPC 래퍼
│       ├── agentRpc.ts  # Agent RPC 클라이언트
│       ├── events.ts    # 이벤트 리스너
│       └── types.ts     # 타입 정의
├── hooks/
│   ├── useAgentRpc.ts   # Agent RPC 훅
│   └── useKeyboardShortcuts.ts
├── pages/               # 페이지 컴포넌트
│   ├── attach/          # 프로세스 연결
│   ├── console/         # 콘솔 로그
│   ├── java/            # Java 탐색
│   ├── memory/          # 메모리 분석
│   ├── methods/         # 메소드 탐색
│   ├── native/          # Native 탐색
│   ├── objc/            # Objective-C 탐색
│   ├── settings/        # 설정
│   ├── swift/           # Swift 탐색
│   └── thread/          # 스레드 분석
├── stores/              # Zustand 스토어
│   ├── alertStore.ts    # 알림 상태
│   ├── consoleStore.ts  # 콘솔 상태
│   ├── layoutStore.ts   # 레이아웃 상태
│   ├── libraryStore.ts  # 라이브러리 상태
│   ├── settingsStore.ts # 설정 상태
│   └── uiStore.ts       # UI 상태
└── styles/
    ├── theme.ts         # 테마 정의
    └── global.ts        # 글로벌 스타일
```

### 상태 관리 (Zustand)

```typescript
// 스토어별 책임

// fridaStore - Frida 세션/스크립트 상태
useFridaStore: {
  devices, processes, selectedDeviceId,
  attachedSessionId, loadedScriptId,
  init, attach, detach, spawn, kill,
  agentRequest
}

// layoutStore - 레이아웃 상태
useLayoutStore: {
  rightPanelOpen, rightPanelSize,
  bottomPanelOpen, bottomPanelSize,
  commandPaletteOpen
}

// libraryStore - 라이브러리 항목
useLibraryStore: {
  entries, folders, selectedIds,
  addEntry, removeEntry, toggleStar,
  loadLibrary, saveLibrary
}

// settingsStore - 사용자 설정
useSettingsStore: {
  theme, fontSize, rpcTimeout,
  setTheme, setFontSize, resetSettings
}

// consoleStore - 콘솔 로그
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
├── main.rs              # 엔트리포인트
├── lib.rs               # 앱 설정, 커맨드 등록
├── commands/
│   ├── mod.rs           # 커맨드 모듈
│   ├── frida.rs         # Frida 커맨드
│   └── library.rs       # 라이브러리 커맨드
├── frida_service.rs     # Frida 서비스
├── input_service.rs     # 입력 서비스
├── error.rs             # 에러 타입
└── services/
    └── mod.rs
```

### Tauri 커맨드

```rust
// Frida 커맨드
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

// 라이브러리 커맨드
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
├── index.ts             # 엔트리포인트
├── rpc/
│   └── router.ts        # RPC 라우터
├── methods/
│   ├── index.ts         # 메소드 export
│   ├── native.ts        # Native 메소드
│   ├── memory.ts        # Memory 메소드
│   ├── objc.ts          # Objective-C 메소드
│   ├── java.ts          # Java 메소드
│   └── thread.ts        # Thread 메소드
└── dist/
    └── index.js         # 컴파일된 에이전트
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
// Native 메소드
native.listModules()
native.listExports(moduleName)
native.listImports(moduleName)
native.findExportByName(moduleName, exportName)

// Memory 메소드
memory.read(address, size)
memory.write(address, bytes)
memory.scan(pattern, ranges)
memory.protect(address, size, protection)

// ObjC 메소드
objc.available()
objc.listClasses()
objc.listMethods(className)
objc.hook(className, methodName, callbacks)

// Java 메소드
java.available()
java.listClasses()
java.listMethods(className)
java.hook(className, methodName, callbacks)

// Thread 메소드
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

1. **Tauri Security**
   - CSP (Content Security Policy) 설정
   - 파일 시스템 접근 제한
   - IPC 커맨드 권한 관리

2. **Agent Security**
   - 타겟 프로세스 내 실행되므로 주의 필요
   - 민감한 데이터 로깅 방지
   - 안전한 메모리 접근

3. **User Data**
   - 라이브러리 데이터는 로컬 파일에 저장
   - 설정은 LocalStorage에 저장
   - 원격 전송 없음
