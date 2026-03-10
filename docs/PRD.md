# CARF — Product Requirements Document

> Cross-platform Application Runtime Framework
> Frida 기반 동적 분석 GUI 툴

## 1. 제품 비전

CARF는 **모바일/데스크톱 애플리케이션의 런타임 동적 분석**을 위한 통합 GUI 도구다.
Frida의 강력한 계측(instrumentation) 엔진 위에 직관적인 시각적 인터페이스를 제공하여,
**입문자부터 전문 보안 연구원까지** 누구나 복잡한 동적 분석 작업을 효율적으로 수행할 수 있게 한다.

### 핵심 가치

| 가치 | 설명 |
|------|------|
| **접근성** | CLI 없이도 Frida의 모든 기능을 GUI로 활용 |
| **확장성** | 플러그인/스크립트 시스템으로 무한 확장 |
| **성능** | RustModule 기반 고성능 계측, SolidJS 반응형 UI |
| **통합성** | 디바이스 관리 → 프로세스 분석 → 결과 내보내기까지 원스톱 |

---

## 2. 타겟 사용자

### 2.1 페르소나

**초급 — 앱 분석 입문자**
- 앱의 내부 동작을 이해하고 싶은 개발자/학생
- Frida CLI에 익숙하지 않음
- 기대: 클릭 몇 번으로 프로세스 attach, 함수 후킹, 메모리 확인

**중급 — CTF 플레이어 / 앱 테스터**
- Frida 스크립트를 어느 정도 작성 가능
- 반복 분석 작업을 자동화하고 싶음
- 기대: 커스텀 스크립트 로드, 결과 필터링, 세션 저장/복원

**고급 — 보안 연구원 / 리버스 엔지니어**
- 복잡한 후킹 체인, 퍼징, 바이너리 분석 수행
- 기대: RustModule 기반 고성능 콜백, 멀티 디바이스, 배치 자동화

### 2.2 지원 플랫폼

| 분석 대상(Target) | 지원 |
|---|---|
| Android (ARM, ARM64, x86, x86_64) | ✅ 1순위 |
| iOS (ARM64) | ✅ 1순위 |
| macOS (ARM64, x86_64) | ✅ |
| Linux (x86_64, ARM64) | ✅ |
| Windows (x86, x86_64) | ✅ |

| CARF 호스트(Host) | 지원 |
|---|---|
| macOS | ✅ 1순위 |
| Linux | ✅ |
| Windows | ✅ |

---

## 3. 기술 스택

### 3.1 아키텍처 개요

```
┌─────────────────────────────────────────────────┐
│                   CARF Host                      │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │           Frontend (SolidJS)              │    │
│  │  solid-ui + Tailwind + HugeIcons + Motion │    │
│  └──────────────┬───────────────────────────┘    │
│                 │ Tauri IPC                       │
│  ┌──────────────▼───────────────────────────┐    │
│  │           Backend (Rust/Tauri 2)           │    │
│  │  frida-rust · adb · device management     │    │
│  └──────────────┬───────────────────────────┘    │
│                 │ Frida Protocol                  │
└─────────────────┼────────────────────────────────┘
                  │
    ┌─────────────▼─────────────────┐
    │       Target Device/Process    │
    │                                │
    │  ┌──────────────────────────┐  │
    │  │   CARF Std Script        │  │
    │  │   (RustModule + JS)      │  │
    │  └──────────────────────────┘  │
    └────────────────────────────────┘
```

### 3.2 기술 선택

| 레이어 | 기술 | 선택 이유 |
|--------|------|----------|
| **UI 프레임워크** | SolidJS | 진정한 반응성, 가상 DOM 없는 성능, 작은 번들 |
| **컴포넌트** | solid-ui (shadcn/ui 포트) | Kobalte + corvu 기반, 접근성, copy-paste 철학 |
| **스타일링** | Tailwind CSS | 유틸리티 기반 빠른 개발, 일관된 디자인 시스템 |
| **아이콘** | HugeIcons | 46,000+ 아이콘, 다양한 스타일, 트리셰이킹 |
| **애니메이션** | solid-motionone | SolidJS 네이티브 애니메이션, 하드웨어 가속 |
| **데스크톱 런타임** | Tauri 2 | Rust 기반 경량 런타임, 네이티브 API 접근 |
| **계측 엔진** | Frida (frida-rust) | 업계 표준 동적 분석 프레임워크 |
| **고성능 콜백** | Frida RustModule | V8 오버헤드 없는 네이티브 성능 |
| **Android 연결** | adb crate | USB/WiFi 디바이스 관리, 앱 설치/실행 |
| **패키지 매니저** | bun | 빠른 설치, 네이티브 TS 지원 |

### 3.3 디자인 시스템

**Carbon + Apple + OpenAI 스타일 하이브리드 (solid-ui 기반)**

- **컴포넌트**: solid-ui (shadcn/ui SolidJS 포트) 기반 — Kobalte(접근성) + corvu(고급 UI)
- **레이아웃**: Carbon Design의 구조적 그리드와 정보 밀도
- **인터랙션**: Apple HIG의 부드러운 전환과 직관적 조작감
- **미학**: OpenAI 스타일의 미니멀하고 세련된 비주얼
- **테마**: Dark mode 기본, Light mode 지원 (solid-ui CSS 변수 기반)
- **타이포그래피**: Inter (UI) + JetBrains Mono (코드/데이터)
- **색상**: 중립 회색 기반, 액센트 컬러로 상태 표현

---

## 4. 사용자 플로우

### 4.1 메인 플로우

```
[앱 시작]
    │
    ▼
[Device Panel] ─── 디바이스 목록 표시
    │                 ├─ Local device
    │                 ├─ USB devices (with ADB info)
    │                 └─ Remote devices (IP:port)
    │
    │  디바이스 선택
    ▼
[Process Panel] ─── 프로세스/앱 목록
    │                 ├─ Running processes
    │                 ├─ Installed apps (Android/iOS)
    │                 └─ 검색/필터
    │
    │  프로세스 선택 → 컨텍스트 메뉴 / 액션 버튼
    ▼
[Attach Modal] ─── 접근 옵션 설정
    │                 ├─ Mode: Spawn / Attach
    │                 ├─ Frida options (realm, runtime, etc.)
    │                 ├─ Spawn options (argv, envp, stdio, cwd)
    │                 ├─ Auto-resume toggle
    │                 ├─ Script 선택 (CARF Std + 사용자 스크립트)
    │                 └─ Advanced options
    │
    │  연결 실행
    ▼
[Session View] ─── 분석 워크스페이스
                      ├─ Console (로그/출력)
                      ├─ Modules (로드된 모듈)
                      ├─ Memory (메모리 뷰어)
                      ├─ Hooks (인터셉터 관리)
                      ├─ Threads (스레드 목록)
                      ├─ Java / ObjC / Native 탭
                      └─ Script Editor
```

### 4.2 화면별 상세

#### 4.2.1 Device Panel

디바이스 연결 상태를 실시간으로 표시하고 관리하는 메인 진입점.

**표시 정보:**
- 디바이스 이름, 타입 (Local / USB / Remote)
- OS 종류 및 버전 (Android 14, iOS 17.2, macOS 15 등)
- 아키텍처 (arm64, x86_64 등)
- 연결 상태 (Connected / Disconnected / Pairing)
- 디바이스 아이콘 (타입별 구분)

**기능:**
- USB 디바이스 자동 감지 (frida DeviceManager 이벤트)
- Remote 디바이스 추가/제거 (IP:port 입력)
- ADB 통합:
  - 디바이스 pairing (WiFi ADB)
  - frida-server 자동 push & 실행
  - 앱 설치 (APK drag & drop)
  - Shell 명령 실행
- 디바이스별 상세 정보 확장 패널

**Frida API 매핑:**
```
DeviceManager.enumerateDevices() → 디바이스 목록
DeviceManager.added / removed   → 실시간 업데이트
Device.id, name, type, icon     → 표시 정보
```

#### 4.2.2 Process Panel

선택된 디바이스의 실행 중인 프로세스 및 설치된 앱 목록.

**표시 정보:**
- PID, 프로세스 이름, 아이콘
- 앱 식별자 (com.example.app)
- 프로세스 상태

**기능:**
- 실시간 프로세스 목록 갱신
- 이름/PID/패키지명으로 검색 및 필터
- 즐겨찾기 (자주 분석하는 앱 고정)
- 프로세스 항목에 인라인 액션 버튼:
  - ▶ Spawn (새로 시작)
  - 🔗 Attach (기존 프로세스에 연결)
  - ⏹ Kill (프로세스 종료)
- 우클릭 컨텍스트 메뉴에 동일 액션 + 추가 옵션

**Frida API 매핑:**
```
Device.enumerateProcesses()      → 프로세스 목록
Device.enumerateApplications()   → 앱 목록 (Android/iOS)
Device.getProcess()              → 특정 프로세스 조회
Device.kill()                    → 프로세스 종료
```

#### 4.2.3 Attach/Spawn Modal

프로세스 연결 전 모든 옵션을 설정하는 모달 다이얼로그.

**공통 옵션:**
| 옵션 | 설명 | 기본값 |
|------|------|--------|
| Mode | Spawn / Attach | 컨텍스트에 따라 |
| Realm | Native / Emulated | Native |
| Runtime | QJS / V8 | V8 |
| Persist Timeout | 세션 유지 시간 (초) | 0 |
| Enable Child Gating | 자식 프로세스 게이팅 | false |

**Spawn 전용 옵션:**
| 옵션 | 설명 | 기본값 |
|------|------|--------|
| Identifier | 앱 번들/패키지 ID | 선택한 앱 |
| Arguments (argv) | 실행 인수 | [] |
| Environment (envp) | 환경 변수 | {} |
| Working Directory (cwd) | 작업 디렉토리 | - |
| Stdio | inherit / pipe | inherit |
| Auto Resume | 즉시 resume 여부 | true |
| Startup Script | 시작 시 로드할 스크립트 | CARF Std |

**Attach 전용 옵션:**
| 옵션 | 설명 | 기본값 |
|------|------|--------|
| Target | PID 또는 프로세스 이름 | 선택한 프로세스 |
| Script | 로드할 스크립트 | CARF Std |

**스크립트 선택:**
- CARF Std Script (항상 기본 로드)
- 사용자 스크립트 (파일 선택 또는 최근 목록)
- 스크립트 프리셋 (저장된 설정 조합)

**Frida API 매핑:**
```
Device.spawn(program, opts)      → 프로세스 생성
Device.resume(pid)               → spawn 후 재개
Device.attach(target, opts)      → 프로세스 연결
Session.createScript(source)     → 스크립트 로드
Session.enableChildGating()      → 자식 프로세스 게이팅
```

#### 4.2.4 Session View (분석 워크스페이스)

Attach/Spawn 성공 후 표시되는 메인 분석 화면. IDE 스타일 레이아웃.

**레이아웃:**
```
┌──────────────────────────────────────────────┐
│ Session Toolbar (detach, pause, scripts...)  │
├────────┬─────────────────────┬───────────────┤
│        │                     │               │
│  Nav   │   Main Content      │  Inspector    │
│  Bar   │   (탭 기반)          │  (상세 정보)   │
│        │                     │               │
├────────┴─────────────────────┴───────────────┤
│ Console / Output Panel                       │
└──────────────────────────────────────────────┘
```

**탭 구성 (Phase 1 — Base Setup):**

| 탭 | 기능 | 우선순위 |
|----|------|---------|
| Console | 로그 출력, send/recv 메시지, REPL | P0 |
| Modules | 로드된 모듈, exports, imports, symbols | P0 |
| Threads | 스레드 목록, 스택 트레이스 | P0 |
| Memory | 메모리 맵, 읽기/쓰기, 검색 | P1 |
| Java | Java 클래스/메서드 탐색, 후킹 | P1 |
| ObjC | ObjC 클래스/메서드 탐색, 후킹 | P1 |
| Native | Native 함수, Interceptor, Stalker | P1 |
| Script | 스크립트 에디터, 실시간 로드/언로드 | P1 |

---

## 5. CARF Std Script

### 5.1 개요

CARF Std Script는 모든 세션에 기본 로드되는 계측 스크립트.
Frida의 V8 JavaScript 런타임 위에서 동작하되, **성능 크리티컬한 로직은 RustModule로 구현**한다.

### 5.2 아키텍처

```
CARF Std Script
├── JS Layer (V8 Runtime)
│   ├── RPC Router          ← Host(Tauri)와 통신
│   ├── Module Manager      ← 모듈 열거/감시
│   ├── Java Bridge         ← Java.perform() 래핑
│   ├── ObjC Bridge         ← ObjC API 래핑
│   └── Event Emitter       ← send() 기반 이벤트
│
└── RustModule Layer (Native)
    ├── Memory Scanner      ← 고속 메모리 패턴 스캔
    ├── Interceptor Hooks   ← 핫 콜백 (onEnter/onLeave)
    ├── Stalker Callbacks   ← 코드 트레이싱 콜백
    └── Fuzzer Engine       ← 타이트 루프 퍼징
```

### 5.3 RustModule 활용 전략

**JS에서 처리하는 것:**
- RPC 라우팅, 메시지 전달
- Java/ObjC 런타임 API 호출 (Frida JS API 필수)
- 일회성 열거 작업 (enumerateModules, enumerateClasses 등)
- UI 이벤트 처리

**RustModule에서 처리하는 것:**
- 고빈도 Interceptor onEnter/onLeave 콜백
- Stalker transform/callout 콜백
- 메모리 스캔/패치 (대용량 범위)
- 퍼징 루프 (tight loop 함수 호출)
- 데이터 인코딩/디코딩 (base64, hex 등)

### 5.4 RPC 프로토콜

Host(Tauri) ↔ Script 간 통신은 Frida의 RPC 메커니즘 사용.

```typescript
// Script 측 (exports)
rpc.exports = {
  // 모듈
  enumerateModules(): ModuleInfo[]
  getModuleExports(name: string): ExportInfo[]
  getModuleImports(name: string): ImportInfo[]

  // 메모리
  readMemory(address: string, size: number): ArrayBuffer
  writeMemory(address: string, data: ArrayBuffer): void
  scanMemory(pattern: string, ranges?: string): ScanResult[]

  // 스레드
  enumerateThreads(): ThreadInfo[]
  getBacktrace(threadId: number): BacktraceFrame[]

  // Java
  enumerateJavaClasses(filter?: string): string[]
  getJavaMethods(className: string): MethodInfo[]
  hookJavaMethod(className: string, method: string, options?: HookOptions): void

  // ObjC
  enumerateObjcClasses(filter?: string): string[]
  getObjcMethods(className: string): MethodInfo[]
  hookObjcMethod(selector: string, options?: HookOptions): void

  // Native
  hookFunction(address: string, options?: HookOptions): void
  callFunction(address: string, retType: string, argTypes: string[], args: any[]): any

  // 제어
  ping(): boolean
  getStatus(): SessionStatus
}
```

---

## 6. 디렉토리 구조 (계획)

```
carf/
├── docs/                         # 문서
│   ├── PRD.md                    # 제품 요구사항 (이 문서)
│   ├── ARCHITECTURE.md           # 아키텍처 상세
│   ├── API.md                    # API 명세
│   └── DEVELOPMENT.md            # 개발 가이드
│
├── src/                          # SolidJS 프론트엔드
│   ├── app.tsx                   # 앱 루트
│   ├── index.tsx                 # 엔트리포인트
│   ├── index.css                 # Tailwind 진입점
│   │
│   ├── components/               # 공용 UI 컴포넌트
│   │   ├── ui/                   # 기본 요소 (Button, Input, Modal 등)
│   │   └── layout/               # 레이아웃 (Shell, Sidebar, Toolbar)
│   │
│   ├── features/                 # 기능 모듈 (도메인별)
│   │   ├── device/               # 디바이스 관리
│   │   │   ├── DevicePanel.tsx
│   │   │   ├── device.store.ts
│   │   │   └── device.types.ts
│   │   ├── process/              # 프로세스 관리
│   │   ├── session/              # 세션 관리 (attach/spawn)
│   │   ├── console/              # 콘솔/로그
│   │   ├── memory/               # 메모리 분석
│   │   ├── hooks/                # Interceptor 관리
│   │   ├── java/                 # Java 런타임
│   │   ├── objc/                 # ObjC 런타임
│   │   ├── native/               # Native 분석
│   │   ├── thread/               # 스레드 분석
│   │   ├── module/               # 모듈 탐색
│   │   └── script/               # 스크립트 에디터
│   │
│   ├── lib/                      # 유틸리티, 헬퍼
│   │   ├── tauri.ts              # Tauri IPC 래퍼
│   │   └── format.ts             # 포맷팅 유틸
│   │
│   └── styles/                   # 글로벌 스타일, 테마 토큰
│
├── src-tauri/                    # Tauri 2 백엔드 (Rust)
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── commands/             # Tauri IPC 커맨드
│   │   │   ├── mod.rs
│   │   │   ├── device.rs         # 디바이스 관리 커맨드
│   │   │   ├── process.rs        # 프로세스 관리 커맨드
│   │   │   ├── session.rs        # 세션 관리 커맨드
│   │   │   └── adb.rs            # ADB 커맨드
│   │   ├── services/             # 비즈니스 로직
│   │   │   ├── mod.rs
│   │   │   ├── frida.rs          # Frida 서비스 (DeviceManager, Session)
│   │   │   ├── adb.rs            # ADB 서비스
│   │   │   └── script.rs         # 스크립트 관리
│   │   ├── state/                # 앱 상태 관리
│   │   │   └── mod.rs
│   │   └── error.rs              # 에러 타입
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src-agent/                    # CARF Std Script (Frida Agent)
│   ├── src/
│   │   ├── index.ts              # 엔트리포인트
│   │   ├── rpc/                  # RPC 라우터
│   │   │   ├── router.ts
│   │   │   ├── handlers.ts
│   │   │   └── types.ts
│   │   ├── modules/              # 기능 모듈
│   │   │   ├── memory.ts
│   │   │   ├── java.ts
│   │   │   ├── objc.ts
│   │   │   ├── native.ts
│   │   │   ├── thread.ts
│   │   │   └── module.ts
│   │   └── rust/                 # RustModule 소스
│   │       ├── scanner.rs        # 메모리 스캐너
│   │       ├── interceptor.rs    # 핫 콜백
│   │       └── stalker.rs        # Stalker 콜백
│   └── tsconfig.json
│
├── package.json
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
├── CLAUDE.md
└── README.md
```

---

## 7. 비기능 요구사항

### 7.1 성능

| 항목 | 목표 |
|------|------|
| 앱 시작 → 디바이스 목록 | < 1초 |
| 프로세스 목록 로드 | < 500ms |
| Attach/Spawn → 세션 활성화 | < 2초 |
| 대용량 모듈 목록 렌더링 (10,000+) | 가상 스크롤, 60fps |
| 메모리 스캔 (100MB) | RustModule 기반 < 3초 |
| Interceptor 콜백 오버헤드 | RustModule 기반 < 1μs |

### 7.2 안정성

- Session detach 시 graceful 복구
- 대상 프로세스 크래시 시 세션 자동 정리
- 디바이스 연결 해제 시 상태 동기화
- 에러 발생 시 사용자 친화적 메시지 (스택 트레이스 노출 금지)

### 7.3 보안

- 네트워크 통신 (Remote device) 시 TLS 지원
- 사용자 스크립트 샌드박싱 (향후)
- 민감 정보 (API 키, 토큰) 로그 노출 금지

### 7.4 접근성

- 키보드 네비게이션 완전 지원
- 스크린 리더 호환 (ARIA)
- 고대비 모드 지원

---

## 8. 마일스톤

### Phase 0 — Foundation (현재)
- [x] 기존 코드베이스 삭제
- [ ] PRD 작성
- [ ] 아키텍처 문서
- [ ] API 명세
- [ ] 개발 환경 가이드
- [ ] 프로젝트 스캐폴딩 (SolidJS + Tauri 2 + Tailwind)

### Phase 1 — Device & Process Management
- [ ] 디바이스 열거 및 실시간 감지
- [ ] ADB 통합 (디바이스 정보, frida-server 관리)
- [ ] 프로세스/앱 목록
- [ ] Attach/Spawn 모달 (전체 옵션)
- [ ] 세션 생명주기 관리

### Phase 2 — CARF Std Script (Base)
- [ ] RPC 라우터 구현
- [ ] 모듈 열거
- [ ] 스레드 열거 및 백트레이스
- [ ] 기본 메모리 읽기/쓰기
- [ ] Console (send/recv, REPL)

### Phase 3 — Analysis Features
- [ ] Java 런타임 탐색 및 후킹
- [ ] ObjC 런타임 탐색 및 후킹
- [ ] Native 함수 Interceptor
- [ ] 메모리 스캔 (패턴, 값)
- [ ] Stalker (코드 트레이싱)

### Phase 4 — Advanced (향후)
- [ ] RustModule 기반 고성능 콜백 전환
- [ ] 퍼징 엔진
- [ ] 디컴파일러 연동
- [ ] 덤프 (DEX, SO, dylib)
- [ ] 스크립트 에디터 (Monaco)
- [ ] 플러그인 시스템
- [ ] 세션 저장/복원
- [ ] 멀티 디바이스 동시 분석
- [ ] 분석 결과 내보내기 (JSON, HTML 리포트)

---

## 9. 제약사항 및 의존성

### 9.1 외부 의존성

| 의존성 | 버전 | 비고 |
|--------|------|------|
| Frida | 17.x | frida-rust 0.17.x, frida-node 최신 |
| Tauri | 2.x | Stable |
| SolidJS | 1.9+ | Stable |
| solid-ui | 최신 | shadcn/ui SolidJS 포트 (Kobalte + corvu) |
| Tailwind CSS | 4.x | v4 신규 엔진 |
| bun | 1.x | 패키지 매니저 + 런타임 |

### 9.2 제약사항

- **frida-server 필수**: USB/Remote 디바이스 분석 시 대상 디바이스에 frida-server 실행 필요
- **루팅/탈옥**: Android 루팅 또는 iOS 탈옥 환경 필요 (Gadget 모드 제외)
- **ADB**: Android 디바이스 관리 시 호스트에 ADB 설치 필요
- **Frida 버전 호환**: 호스트의 frida-rust와 대상의 frida-server 버전 일치 필요

---

## 10. 성공 지표

| 지표 | 목표 |
|------|------|
| 디바이스 연결 → 첫 후킹까지 | < 30초 (초급자 기준) |
| 동시 활성 세션 수 | 최소 5개 |
| 크래시 없는 연속 분석 시간 | > 4시간 |
| 번들 크기 (프론트엔드) | < 500KB gzipped |
| 메모리 사용량 (유휴) | < 150MB |

---

## 부록 A: Frida API 참조 요약

### Device Management (frida-rust / frida-node)

```
DeviceManager
├── enumerateDevices() → Device[]
├── addRemoteDevice(address, opts?) → Device
├── removeRemoteDevice(address)
├── on('added', callback)
├── on('removed', callback)
└── on('changed', callback)

Device
├── id, name, type, icon
├── enumerateProcesses(opts?) → Process[]
├── enumerateApplications(opts?) → Application[]
├── getProcess(name) → Process
├── spawn(program, opts?) → pid
├── resume(pid)
├── kill(pid)
├── attach(target, opts?) → Session
├── input(pid, data)
└── on('child-added', callback)

Session
├── pid, persistTimeout
├── createScript(source, opts?) → Script
├── createScriptFromBytes(bytes, opts?) → Script
├── compileScript(source, opts?) → bytes
├── enableChildGating()
├── disableChildGating()
├── detach()
├── on('detached', callback)
└── on('child-added', callback)

Script
├── load()
├── unload()
├── eternalize()
├── post(message, data?)
├── enableDebugger(port?)
├── disableDebugger()
├── on('message', callback)
└── on('destroyed', callback)
```

### Spawn Options

```typescript
interface SpawnOptions {
  argv?: string[];           // 실행 인수
  envp?: Record<string, string>;  // 환경 변수
  env?: Record<string, string>;   // 환경 변수 (delta)
  cwd?: string;              // 작업 디렉토리
  stdio?: 'inherit' | 'pipe'; // 표준 입출력
  aux?: Record<string, any>; // 플랫폼별 추가 옵션
}
```

### Session/Attach Options

```typescript
interface SessionOptions {
  realm?: 'native' | 'emulated';  // 실행 영역
  persistTimeout?: number;         // 세션 유지 시간
}

interface ScriptOptions {
  name?: string;                   // 스크립트 이름
  runtime?: 'qjs' | 'v8';         // JS 런타임
}
```

### RustModule

```typescript
// RustModule 생성
const rm = new RustModule(`
    use std::os::raw::c_char;

    #[no_mangle]
    pub extern "C" fn process(data: *const c_char) -> i32 {
        // 고성능 로직
        0
    }
`, {
    // JS → Rust 심볼 전달
    notify: notifyPtr
}, {
    // Cargo 의존성
    dependencies: ['base64 = "0.22.1"']
});

// NativeFunction으로 호출
const process = new NativeFunction(rm.process, 'int', ['pointer']);
```

---

*Last updated: 2026-03-10*
*Version: 2.0.0-alpha*
