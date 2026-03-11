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

Attach/Spawn 성공 후 표시되는 메인 분석 화면. IDE-Hybrid 3+1 Pane 레이아웃.

##### 레이아웃 구조

```
┌─ Session Tabs (브라우저 탭 패턴, 최대 5개 동시 세션) ─────────────┐
├────────┬─────────────────────────────┬────────────────────────────┤
│        │  Session Toolbar            │                            │
│  Nav   │  (detach, pause, resume,    │                            │
│  Bar   │   scripts, pin...)         │   Inspector Panel          │
│ (48px  ├─────────────────────────────┤   (토글 가능, 기본 320px,    │
│  icon  │                             │    corvu Resizable)        │
│  rail) │   Main Content              │                            │
│        │   (선택된 탭 콘텐츠)          │   - 선택 항목 상세 정보      │
│        │                             │   - 컨텍스트별 액션 패널      │
│        │                             │   - 프로퍼티 에디터          │
│        │                             │                            │
├────────┴─────────────────────────────┴────────────────────────────┤
│ Console Panel (하단 고정, 리사이즈/접기 가능, 모든 탭 공유)           │
│   [Console] [Hook Events] [System] [Timeline]                     │
└──────────────────────────────────────────────────────────────────┘
```

**레이아웃 구성 요소:**

| 영역 | 설명 |
|------|------|
| **Session Tabs** | 상단 브라우저 탭 패턴. 최대 5개 동시 세션. 탭에 세션 상태(attached/detached/crashed) 표시 |
| **Left NavBar** | 48px 아이콘 레일. 13개 탭 아이콘 + 구분선 + 설정. 활성 탭 하이라이트 |
| **Center Main Content** | 선택된 탭의 메인 콘텐츠 영역. 탭별 고유 레이아웃 |
| **Right Inspector Panel** | 토글 가능 (기본 숨김). 기본 320px, corvu Resizable로 너비 조절. 선택 항목의 상세 정보/액션 표시 |
| **Bottom Console Panel** | 모든 탭에서 공유되는 하단 고정 패널. 리사이즈/접기 가능. 기본 높이 200px |

##### 탭 구성 (13개)

| # | 탭 | 우선순위 | 아이콘 | 핵심 차별점 |
|---|-----|---------|--------|-----------|
| 1 | Console | P0 | Terminal | REPL + 구조화된 이벤트 뷰어 |
| 2 | Modules | P0 | Package | 10K+ 모듈 가상 스크롤 |
| 3 | Threads | P0 | CPU | Stalker 통합 + 레지스터 컨텍스트 |
| 4 | Memory | P1 | Chip | Access Monitor 히트맵 |
| 5 | Java | P1 | Coffee | Heap 인스턴스 브라우저 |
| 6 | ObjC | P1 | Apple | Heap 인스턴스 브라우저 |
| 7 | Native | P1 | Binary | Inline Stalker + 함수 호출기 |
| 8 | Script | P1 | Code | 템플릿 라이브러리 + 핫 리로드 |
| 9 | Hooks Manager | P1 | Hook | 통합 훅 관리 + Export/Import |
| 10 | Pinboard | P1 | Pin | 크로스탭 캐싱 스토리지 |
| 11 | Call Graph | P2 | Graph | Stalker 시각화 (시장 유일) |
| 12 | Network Monitor | P2 | Globe | SSL 자동 우회 + HTTP 뷰어 |
| 13 | File Explorer | P2 | Folder | SQLite 브라우저 + Prefs 에디터 |

##### 탭별 상세

**1. Console (P0)**
- **레이아웃**: REPL 입력 상단, 구조화된 로그 스트림 하단
- **데이터 소스**: `send()`/`recv()` 메시지, `console.log`, RPC 응답
- **핵심 기능**: JavaScript REPL (자동완성, 히스토리), 메시지 타입별 필터링 (log/warning/error/send), JSON 자동 포맷팅, 타임스탬프 표시
- **Inspector**: 선택한 메시지의 상세 페이로드 표시, 바이너리 데이터 hex 뷰

**2. Modules (P0)**
- **레이아웃**: 좌측 모듈 리스트 (가상 스크롤), 우측 상세 (exports/imports/symbols)
- **데이터 소스**: `Process.enumerateModules()`, `Module.enumerateExports/Imports/Symbols()`
- **핵심 기능**: 10,000+ 모듈 가상 스크롤, 이름/주소 검색, export 타입별 필터 (function/variable), 주소 클릭 시 Memory 탭 이동
- **Inspector**: 모듈 상세 정보 (base, size, path), 선택 export/import 시그니처

**3. Threads (P0)**
- **레이아웃**: 스레드 리스트 + 선택 스레드 스택 트레이스
- **데이터 소스**: `Process.enumerateThreads()`, `Thread.backtrace()`
- **핵심 기능**: 스레드 상태 표시 (running/waiting/stopped), 레지스터 컨텍스트 표시 (PC, SP, LR 등), 스택 프레임 심볼 해석, Stalker 연동 (스레드 단위 트레이싱 시작/중지)
- **Inspector**: 전체 레지스터 뷰, 스택 프레임 상세

**4. Memory (P1)**
- **레이아웃**: 메모리 맵 상단, hex 에디터 하단
- **데이터 소스**: `Process.enumerateRanges()`, `Memory.read/write*()`
- **핵심 기능**: 메모리 범위 필터 (protection 기반), 패턴/값 검색 (RustModule 고속 스캔), hex 에디터 (읽기/쓰기), Access Monitor 히트맵 (MemoryAccessMonitor 기반 접근 빈도 시각화)
- **Inspector**: 선택 주소의 모듈/심볼 정보, 메모리 보호 속성 변경

**5. Java (P1)**
- **레이아웃**: 클래스 트리 좌측, 메서드/필드 리스트 우측
- **데이터 소스**: `Java.enumerateLoadedClasses()`, `Java.use()`, `Java.choose()`
- **핵심 기능**: 클래스 계층 트리 탐색, 메서드/필드 열거, 원클릭 메서드 후킹, Heap 인스턴스 브라우저 (`Java.choose()`로 런타임 인스턴스 검색/조작), 오버로드 메서드 구분
- **Inspector**: 클래스/메서드 시그니처, 후킹 옵션 설정, 인스턴스 필드 값 편집

**6. ObjC (P1)**
- **레이아웃**: 클래스 리스트 좌측, 메서드(+/-) 리스트 우측
- **데이터 소스**: `ObjC.enumerateLoadedClasses()`, `ObjC.classes[]`
- **핵심 기능**: 클래스/프로토콜 탐색, 인스턴스/클래스 메서드 열거, 원클릭 메서드 후킹, Heap 인스턴스 브라우저 (`ObjC.choose()`로 런타임 인스턴스 검색/조작), 프로토콜 필터링
- **Inspector**: 메서드 시그니처 (타입 인코딩 해석), 후킹 옵션 설정, 인스턴스 ivar 값 편집

**7. Native (P1)**
- **레이아웃**: 함수 리스트/검색 상단, 후킹 설정/결과 하단
- **데이터 소스**: Module exports, 사용자 지정 주소, `Interceptor`, `Stalker`
- **핵심 기능**: 주소/심볼 기반 함수 후킹 (Interceptor), Inline Stalker (함수 단위 instruction 트레이싱), 함수 호출기 (`NativeFunction`으로 인자 지정 후 직접 호출), 리턴값/인자 변조
- **Inspector**: 함수 시그니처 편집, onEnter/onLeave 콜백 설정, Stalker 이벤트 상세

**8. Script (P1)**
- **레이아웃**: 에디터 (Monaco) 전체 너비, 하단 실행 결과
- **데이터 소스**: 로컬 파일시스템, 내장 템플릿
- **핵심 기능**: Monaco 에디터 (TypeScript 지원, Frida API 자동완성), 템플릿 라이브러리 (SSL Pinning Bypass, Root Detection 등 프리셋), 핫 리로드 (저장 시 자동 reload), 멀티 스크립트 탭
- **Inspector**: 스크립트 메타데이터, 실행 상태, 에러 로그

**9. Hooks Manager (P1)**
- **레이아웃**: 훅 리스트 테이블 (전체 너비)
- **데이터 소스**: 모든 탭에서 생성된 훅의 통합 저장소
- **핵심 기능**: 전체 활성 훅 목록 (Java/ObjC/Native 통합), 훅별 활성화/비활성화 토글, 훅 설정 Export/Import (JSON), 훅 그룹핑 (태그 기반), 히트 카운트 표시
- **Inspector**: 훅 상세 설정 (콜백 코드, 조건, 로깅 옵션)

**10. Pinboard (P1)**
- **레이아웃**: 핀 아이템 그리드/리스트 뷰 전환
- **데이터 소스**: 사용자가 다른 탭에서 핀한 항목
- **핵심 기능**: 크로스탭 캐싱 스토리지 (분석 중 중요 항목을 핀하여 빠른 접근), PinItem 타입 6종 지원 (아래 Pinboard 시스템 참조), 태그/메모 기능, Export/Import
- **Inspector**: 핀 항목의 원본 데이터 상세, 메모 편집

**11. Call Graph (P2)**
- **레이아웃**: 그래프 캔버스 (전체 영역), 좌측 제어 패널
- **데이터 소스**: `Stalker` 이벤트 (call/ret/exec)
- **핵심 기능**: Stalker 수집 데이터를 방향 그래프로 시각화, 노드 = 함수, 엣지 = 호출 관계, 줌/팬/필터, 호출 빈도 히트맵, 시장에서 유일한 GUI 기반 Stalker 시각화
- **Inspector**: 선택 노드(함수)의 상세 정보, 호출 횟수, 연결된 모듈

**12. Network Monitor (P2)**
- **레이아웃**: 요청 리스트 상단, 요청/응답 상세 하단
- **데이터 소스**: `send()`/`recv()` + SSL 바이패스 스크립트, socket API 후킹
- **핵심 기능**: HTTP/HTTPS 요청 캡처, SSL Pinning 자동 우회 (인증서 검증 후킹), 요청/응답 헤더/바디 표시, JSON 자동 포맷팅, URL/메서드 필터링
- **Inspector**: 요청/응답 전체 상세, 바이너리 바디 hex 뷰, cURL 커맨드 복사

**13. File Explorer (P2)**
- **레이아웃**: 파일 트리 좌측, 파일 뷰어/에디터 우측
- **데이터 소스**: `Frida File API` + 에이전트 측 파일 열거
- **핵심 기능**: 대상 프로세스 샌드박스 파일 탐색, SQLite 데이터베이스 브라우저 (테이블/쿼리), SharedPreferences / NSUserDefaults 에디터, 파일 다운로드/업로드
- **Inspector**: 파일 메타데이터 (크기, 권한, 수정일), 바이너리 파일 hex 프리뷰

##### Console Panel (하단 공유 패널)

모든 탭에서 공유되는 하단 고정 패널. 세션 전체의 이벤트/로그를 실시간 표시.

**서브탭:**

| 서브탭 | 설명 |
|--------|------|
| **Console** | `console.log`/`warn`/`error` 출력, 간단한 REPL 입력 |
| **Hook Events** | 활성 훅의 onEnter/onLeave 이벤트 스트림 (인자, 리턴값, 스택) |
| **System** | 세션 상태 변경, 에러, 디바이스 이벤트 등 시스템 메시지 |
| **Timeline** | 이벤트 타임라인 (시간순 정렬, 타입별 필터, 시각적 타임라인 바) |

**버퍼 설정:**
- 기본: 10,000 메시지
- 설정 가능 범위: 1,000 ~ 100,000
- 버퍼 초과 시 FIFO 방식으로 오래된 메시지 제거
- 일시정지(pause) 기능으로 스크롤 락

##### Pinboard 시스템

분석 중 중요 항목을 크로스탭으로 캐싱하여 빠른 접근을 제공하는 시스템.

**PinItem 타입 (6종):**

| 타입 | 설명 | 핀 소스 탭 |
|------|------|-----------|
| **Module** | 모듈 정보 (이름, base, size, path) | Modules |
| **Address** | 메모리 주소 + 컨텍스트 (심볼, 모듈 오프셋) | Memory, Modules |
| **Function** | 함수 정보 (주소, 심볼, 시그니처) | Modules, Native |
| **Thread** | 스레드 정보 (ID, 상태, 스택) | Threads |
| **Class** | Java/ObjC 클래스 정보 | Java, ObjC |
| **Hook** | 훅 설정 스냅샷 | Hooks Manager, Java, ObjC, Native |

**기능:**
- **클릭 → 이동**: 핀 아이템 클릭 시 해당 탭으로 자동 이동 + 항목 포커스
- **우클릭 컨텍스트 메뉴**: 이동, 복사, 태그 편집, 메모 추가, 삭제
- **태그**: 사용자 정의 태그로 핀 아이템 분류
- **메모**: 각 핀 아이템에 자유 텍스트 메모 첨부
- **Export/Import**: 핀보드 전체를 JSON으로 내보내기/가져오기 (팀 공유, 분석 기록)

##### 크로스탭 네비게이션

탭 간 데이터 연동을 위한 `navigateTo()` 함수 기반 네비게이션 시스템.

```typescript
// 크로스탭 이동 예시
navigateTo("memory", { address: "0x7fff12340000" })    // Memory 탭으로 이동 + 주소 포커스
navigateTo("modules", { module: "libc.so" })            // Modules 탭으로 이동 + 모듈 선택
navigateTo("native", { address: "0x7fff12345678", action: "hook" })  // Native 탭 + 즉시 후킹
navigateTo("java", { className: "com.example.MainActivity" })       // Java 탭 + 클래스 선택
```

**사용 예:**
- Modules 탭에서 export 주소 클릭 → Memory 탭에서 해당 주소 표시
- Threads 탭에서 스택 프레임 클릭 → Modules 탭에서 해당 모듈+오프셋 표시
- Pinboard에서 핀 아이템 클릭 → 원본 탭으로 이동 + 항목 하이라이트
- Hook Events에서 이벤트 클릭 → Hooks Manager에서 해당 훅 선택

##### 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| `Cmd/Ctrl + 1~9` | 탭 1~9 전환 |
| `Cmd/Ctrl + 0` | 탭 10 이상 전환 (Pinboard) |
| `Cmd/Ctrl + \`` | Console Panel 토글 (접기/펴기) |
| `Cmd/Ctrl + B` | Inspector Panel 토글 |
| `Cmd/Ctrl + K` | 글로벌 검색 (Command Palette) |
| `Cmd/Ctrl + P` | 선택 항목 Pinboard에 추가 |
| `Cmd/Ctrl + Shift + P` | Pinboard 탭으로 이동 |
| `Cmd/Ctrl + F` | 현재 탭 내 검색 |
| `Cmd/Ctrl + W` | 현재 세션 탭 닫기 (detach 확인) |
| `Cmd/Ctrl + Shift + E` | Script 에디터 포커스 |
| `Cmd/Ctrl + Enter` | REPL / Script 실행 |
| `Escape` | Inspector/Console 패널 닫기 |

---

## 5. CARF Std Script

### 5.1 개요

CARF Std Script는 모든 세션에 기본 로드되는 계측 스크립트.
Frida의 V8 JavaScript 런타임 위에서 동작하되, **성능 크리티컬한 로직은 RustModule로 구현**한다.

### 5.2 아키텍처

```
CARF Std Script (16 모듈, ~102 RPC 핸들러)
├── JS Layer (V8 Runtime)
│   │
│   ├── Infrastructure
│   │   ├── RPC Router           ← registerHandler() 기반 메서드 라우팅
│   │   ├── Event Protocol       ← emitLog/emitHookEvent/emitStalkerEvent 등
│   │   ├── Runtime Bridges      ← frida-java-bridge, frida-objc-bridge, frida-swift-bridge
│   │   └── Frida Compat Layer   ← v17 API 호환성 래퍼
│   │
│   ├── Core (3 모듈, 20 핸들러)
│   │   ├── Process              ← 프로세스 정보, 메모리 범위
│   │   ├── Module               ← Exports/Imports/Symbols, Observer, Sections
│   │   └── Thread               ← 열거, 백트레이스, Observer, runOnThread
│   │
│   ├── Memory (2 모듈, 14 핸들러)
│   │   ├── Memory               ← Read/Write/Scan/Patch/Protect/Alloc/Dump
│   │   └── Monitor              ← MemoryAccessMonitor (접근 감시)
│   │
│   ├── Runtime Bridges (5 모듈, 46 핸들러)
│   │   ├── Java                 ← 클래스/메서드/필드, Heap 검색, ClassLoader
│   │   ├── ObjC                 ← 클래스/메서드, 인스턴스 검색
│   │   ├── Swift                ← 모듈/타입 열거, Demangle, 후킹
│   │   ├── IL2CPP               ← Unity 런타임, 메타데이터 덤프
│   │   └── Native               ← Interceptor 후킹, NativeFunction 호출
│   │
│   ├── Tracing (1 모듈, 4 핸들러)
│   │   └── Stalker              ← 코드 트레이싱, Summary/Sampling 모드
│   │
│   ├── I/O (3 모듈, 8 핸들러)
│   │   ├── Network              ← SSL/HTTP 캡처, Java 네트워크 후킹
│   │   ├── Filesystem           ← 디렉토리 탐색, File I/O, SQLite
│   │   └── Console              ← REPL evaluate
│   │
│   └── Security & Utility (2 모듈, 12 핸들러)
│       ├── AntiDetect           ← Cloak API, SSL Bypass, Root Bypass
│       └── Resolver             ← ApiResolver, DebugSymbol, Export 룩업
│
└── RustModule Layer (Native) — Phase 5 예정
    ├── Memory Scanner           ← 고속 메모리 패턴 스캔
    ├── Interceptor Hooks        ← 핫 콜백 (onEnter/onLeave)
    ├── Stalker Callbacks        ← 코드 트레이싱 콜백
    └── Fuzzer Engine            ← 타이트 루프 퍼징
```

> **현재 상태**: Agent 모듈은 100% JavaScript/TypeScript로 구현됨. RustModule은 Phase 5에서 핫 콜백 마이그레이션 예정.

### 5.3 RustModule 활용 전략

#### 성능 티어

| Tier | 기술 | 콜백 지연 | 용도 |
|------|-----|----------|------|
| **Native** | RustModule | ~100ns | 핫 콜백, 대용량 스캔, 퍼징 루프 |
| **Bridge** | CModule (C) | ~200ns | 단순 GumAPI 헬퍼 (레거시, CARF 미사용) |
| **Script** | JS (V8) | ~1000ns | RPC 라우팅, 런타임 API, 열거 작업 |

> CARF는 **RustModule 전용** 전략. CModule은 사용하지 않는다.
> 현재 Agent는 100% JS로 구현되어 있으며, Phase 5에서 핫 경로를 RustModule로 마이그레이션한다.

**JS에서 처리하는 것 (현재 전체):**
- RPC 라우팅, 메시지 전달
- Java/ObjC/Swift 런타임 API 호출 (Frida JS API 필수)
- 일회성 열거 작업 (enumerateModules, enumerateClasses 등)
- UI 이벤트 처리
- Interceptor/Stalker 콜백 (프로토타이핑 단계)

**RustModule에서 처리할 것 (Phase 5 마이그레이션 대상):**
- 고빈도 Interceptor onEnter/onLeave 콜백
- Stalker transform/callout 콜백
- 메모리 스캔/패치 (대용량 범위, >1MB)
- 퍼징 루프 (tight loop 함수 호출)
- 데이터 인코딩/디코딩 (base64, hex 등)

### 5.4 RPC 프로토콜

Host(Tauri) ↔ Script 간 통신은 Frida의 RPC 메커니즘 사용.
모든 RPC 응답은 `{ success: boolean, data?: unknown, error?: string }` 형태로 래핑된다.

```typescript
// 16개 모듈, ~102개 RPC 핸들러 (상세 명세는 API.md 참조)

// ── Core ──
// process (4): ping, getProcessInfo, enumerateModules, enumerateRanges
// module (10): getModuleExports, getModuleImports, getModuleSymbols,
//              findModuleByAddress, findModuleByName,
//              startModuleObserver, stopModuleObserver,
//              enumerateModuleSections, getModuleVersion, enumerateModuleDependencies
// thread (6): enumerateThreads, getBacktrace, getThreadBacktrace,
//             startThreadObserver, stopThreadObserver, runOnThread

// ── Memory ──
// memory (10): readMemory, writeMemory, scanMemory, protectMemory,
//              patchMemory, queryMemoryProtection, allocateMemory,
//              dumpMemoryRange, compareMemory, enumerateMallocRanges
// monitor (4): startMemoryMonitor, stopMemoryMonitor,
//              getMemoryMonitorStatus, drainMonitorEvents

// ── Runtime Bridges ──
// java (14): isJavaAvailable, getAndroidPackageName, enumerateJavaClasses,
//            getJavaMethods, getJavaFields, hookJavaMethod, unhookJavaMethod,
//            chooseJavaInstances, listJavaHooks, setJavaHookActive,
//            enumerateJavaClassLoaders, getJavaStackTrace, searchJavaHeap, callJavaMethod
// objc (8): isObjcAvailable, enumerateObjcClasses, getObjcMethods,
//           hookObjcMethod, unhookObjcMethod, chooseObjcInstances,
//           listObjcHooks, setObjcHookActive
// swift (8): isSwiftAvailable, enumerateSwiftModules, demangleSwiftSymbol,
//            enumerateSwiftTypes, hookSwiftFunction, unhookSwiftFunction,
//            listSwiftHooks, setSwiftHookActive
// il2cpp (11): isIl2cppAvailable, getIl2cppInfo, enumerateIl2cppDomains,
//              enumerateIl2cppClasses, getIl2cppClassMethods, getIl2cppClassFields,
//              hookIl2cppMethod, unhookIl2cppMethod, dumpIl2cppMetadata,
//              listIl2cppHooks, setIl2cppHookActive
// native (5): hookFunction, unhookFunction, callFunction,
//             setNativeHookActive, listHooks

// ── Tracing ──
// stalker (4): startStalker, stopStalker, getStalkerEvents, listStalkerSessions

// ── I/O ──
// network (3): startNetworkCapture, stopNetworkCapture, isNetworkCaptureActive
// filesystem (4): listDirectory, readFile, sqliteQuery, sqliteTables
// console (1): evaluate

// ── Security & Utility ──
// antidetect (7): cloakThread, uncloakThread, cloakRange, uncloakRange,
//                 getCloakStatus, bypassSslPinning, bypassRootDetection
// resolver (5): resolveApi, resolveSymbol, findSymbolByName,
//               resolveModuleExport, getGlobalExport
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
│   │   ├── console/              # 콘솔/로그 + REPL
│   │   ├── module/               # 모듈 탐색
│   │   ├── thread/               # 스레드 분석
│   │   ├── memory/               # 메모리 분석
│   │   ├── java/                 # Java 런타임
│   │   ├── objc/                 # ObjC 런타임
│   │   ├── native/               # Native 분석
│   │   ├── script/               # 스크립트 에디터
│   │   ├── hooks-manager/        # 통합 훅 관리
│   │   ├── pinboard/             # 크로스탭 캐싱 스토리지
│   │   ├── call-graph/           # Stalker 시각화
│   │   ├── network/              # 네트워크 모니터
│   │   └── file-explorer/        # 파일 탐색기
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
│   │   ├── index.ts              # 엔트리포인트, 16개 모듈 side-effect import
│   │   ├── bridges.ts            # 런타임 브릿지 (Java, ObjC, Swift)
│   │   ├── rpc/                  # RPC 인프라
│   │   │   ├── router.ts         # registerHandler/createRpcExports
│   │   │   ├── protocol.ts       # emitLog/emitHookEvent/emitStalkerEvent 등
│   │   │   └── types.ts          # RpcHandler, AgentEvent 타입
│   │   ├── runtime/
│   │   │   └── frida-compat.ts   # Frida v17 호환성 래퍼
│   │   ├── types/
│   │   │   ├── frida-rpc.d.ts    # rpc.exports 타입
│   │   │   └── bridges.d.ts      # frida-*-bridge 모듈 선언
│   │   ├── modules/              # 기능 모듈 (16개)
│   │   │   ├── process.ts        # Core: 프로세스 정보, 범위
│   │   │   ├── module.ts         # Core: 모듈 탐색, Observer, Sections
│   │   │   ├── thread.ts         # Core: 스레드 열거, Observer, runOnThread
│   │   │   ├── memory.ts         # Memory: R/W/Scan/Patch/Protect/Alloc
│   │   │   ├── monitor.ts        # Memory: MemoryAccessMonitor
│   │   │   ├── java.ts           # Runtime: Java 클래스/메서드/Heap
│   │   │   ├── objc.ts           # Runtime: ObjC 클래스/메서드/인스턴스
│   │   │   ├── swift.ts          # Runtime: Swift 모듈/타입/Demangle
│   │   │   ├── il2cpp.ts         # Runtime: Unity IL2CPP 메타데이터
│   │   │   ├── native.ts         # Runtime: Interceptor/NativeFunction
│   │   │   ├── stalker.ts        # Tracing: 코드 트레이싱
│   │   │   ├── network.ts        # I/O: SSL/HTTP 캡처
│   │   │   ├── filesystem.ts     # I/O: 파일 탐색, SQLite
│   │   │   ├── console.ts        # I/O: REPL evaluate
│   │   │   ├── resolver.ts       # Utility: ApiResolver, DebugSymbol
│   │   │   └── antidetect.ts     # Security: Cloak, SSL/Root Bypass
│   │   └── rust/                 # RustModule 소스 (Phase 5)
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

### Phase 0 — Foundation ✅
- [x] 기존 코드베이스 삭제
- [x] PRD 작성
- [x] 아키텍처 문서
- [x] API 명세
- [x] 개발 환경 가이드
- [x] 프로젝트 스캐폴딩 (SolidJS + Tauri 2 + Tailwind)

### Phase 1 — Device & Process Management ✅
- [x] 디바이스 열거 및 실시간 감지
- [x] ADB 통합 (디바이스 정보, frida-server 관리)
- [x] 프로세스/앱 목록
- [x] Attach/Spawn 모달 (전체 옵션)
- [x] 세션 생명주기 관리

### Phase 2 — CARF Std Script + Session View Base (P0 탭) ✅
- [x] RPC 라우터 구현 (registerHandler 패턴, 16개 모듈 등록)
- [x] Session View IDE-Hybrid 레이아웃 (NavBar, Inspector, Console Panel)
- [x] Console 탭 (REPL evaluate, 구조화된 이벤트 뷰어)
- [x] Modules 탭 (10K+ 가상 스크롤, exports/imports/symbols + Observer + Sections)
- [x] Threads 탭 (스택 트레이스, 레지스터 컨텍스트 + Observer + runOnThread)
- [x] Console Panel (서브탭: Console, Hook Events, System, Timeline)
- [x] 크로스탭 네비게이션 (`navigateTo()`)
- [x] 키보드 단축키 시스템

### Phase 3 — Analysis Features (P1 탭) — Agent 구현 완료
- [x] Memory Agent (read/write/scan/patch/protect/alloc/dump/compare/mallocRanges)
- [x] Memory Monitor Agent (MemoryAccessMonitor 기반 접근 감시)
- [x] Java Agent (14 핸들러: 클래스/메서드/필드, Heap 검색, ClassLoader, StackTrace)
- [x] ObjC Agent (8 핸들러: 클래스/메서드, 인스턴스 검색)
- [x] Native Agent (5 핸들러: Interceptor, NativeFunction 호출)
- [x] Hooks Manager Agent (통합 훅 관리: Java/ObjC/Native/Swift/IL2CPP)
- [ ] Memory 탭 UI (hex 에디터, 패턴/값 검색, Access Monitor 히트맵)
- [ ] Java 탭 UI (클래스/메서드 탐색, 후킹, Heap 인스턴스 브라우저)
- [ ] ObjC 탭 UI (클래스/메서드 탐색, 후킹, Heap 인스턴스 브라우저)
- [ ] Native 탭 UI (Interceptor, Inline Stalker, 함수 호출기)
- [ ] Script 탭 (Monaco 에디터, 템플릿 라이브러리, 핫 리로드)
- [ ] Pinboard 탭 (크로스탭 캐싱, 6종 PinItem, 태그/메모)

### Phase 4 — Advanced Features (P2 탭 + 확장) — Agent 구현 완료
- [x] Stalker Agent (4 핸들러: follow/unfollow, Summary/Sampling 모드)
- [x] Network Agent (3 핸들러: SSL/HTTP 캡처, Java 네트워크 후킹)
- [x] Filesystem Agent (4 핸들러: 디렉토리 탐색, File I/O, SQLite)
- [ ] Call Graph 탭 UI (Stalker 시각화, 방향 그래프)
- [ ] Network Monitor 탭 UI (SSL 자동 우회, HTTP 뷰어)
- [ ] File Explorer 탭 UI (SQLite 브라우저, Prefs 에디터)
- [ ] 디컴파일러 연동
- [ ] 덤프 (DEX, SO, dylib)
- [ ] 분석 결과 내보내기 (JSON, HTML 리포트)

### Phase 5 — Advanced Runtime & Security
- [x] Swift Agent (8 핸들러: 모듈/타입 열거, Demangle, 후킹)
- [x] IL2CPP Agent (11 핸들러: Unity 런타임, 도메인/클래스/메서드, 메타데이터 덤프)
- [x] Anti-Detection Agent (7 핸들러: Cloak API, SSL Bypass, Root Detection Bypass)
- [x] Symbol Resolver Agent (5 핸들러: ApiResolver, DebugSymbol, Export 룩업)
- [x] Frida v17 호환성 레이어 (bridges.ts, frida-compat.ts)
- [x] Thread/Module Observer (실시간 추가/제거/이름변경 감시)
- [ ] Swift 탭 UI (Swift 모듈/타입 탐색, Demangle, 후킹)
- [ ] IL2CPP 탭 UI (Unity 클래스/메서드 탐색, 메타데이터 덤프)
- [ ] Anti-Detection 대시보드 UI
- [ ] RustModule 기반 고성능 콜백 전환
- [ ] 퍼징 엔진
- [ ] 플러그인 시스템
- [ ] 세션 저장/복원
- [ ] 멀티 디바이스 동시 분석

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
const rm = new RustModule(`
    use std::os::raw::c_char;

    #[no_mangle]
    pub extern "C" fn process_data(data: *const c_char) -> i32 {
        // 고성능 로직
        0
    }
`, {
    notify: notifyPtr           // JS → Rust 심볼 전달
}, {
    dependencies: ['base64 = "0.22.1"']  // Cargo 의존성
});

const process_data = new NativeFunction(rm.process_data, 'int', ['pointer']);
```

---

### Frida v17 Breaking Changes

CARF는 Frida 17.x를 타겟으로 한다. v17에서 제거된 레거시 API에 대한 대응이 필요하다.

**Runtime Bridge 언번들링:**
- `Java`, `ObjC`, `Swift`가 전역 변수에서 제거됨
- ESM import 필요: `frida-java-bridge`, `frida-objc-bridge`, `frida-swift-bridge`
- CARF 대응: `bridges.ts`에서 `globalThis` 폴백 + 패키지 import

**정적 메서드 제거:**
- `Memory.readU32(addr)` → `addr.readU32()` (인스턴스 메서드)
- `Module.findBaseAddress(name)` → `Process.getModuleByName(name).base`
- `Module.findExportByName(mod, sym)` → `module.getExportByName(sym)`
- CARF 대응: `runtime/frida-compat.ts` 호환성 래퍼

**열거 API 변경:**
- 콜백 기반 `enumerate*({ onMatch, onComplete })` → 배열 반환 `enumerate*()` → `T[]`
- CARF Agent는 v17 배열 방식만 사용

---

### Advanced Process/Thread API

```
Process.attachThreadObserver(callbacks) → Observer     // 스레드 추가/제거/이름변경 감시
Process.attachModuleObserver(callbacks) → Observer     // 모듈 로드/언로드 감시
Process.runOnThread(threadId, callback) → Promise      // 특정 스레드에서 코드 실행
Process.setExceptionHandler(handler)                   // 프로세스 예외 핸들러
Process.enumerateMallocRanges() → Range[]              // malloc 범위 열거
thread.setHardwareBreakpoint(slot, address)            // 하드웨어 BP (slot 0-3)
thread.setHardwareWatchpoint(slot, addr, access, size) // 하드웨어 WP
```

---

### Advanced Memory API

```
Memory.protect(address, size, protection) → boolean    // 보호 속성 변경
Memory.queryProtection(address) → string               // 보호 속성 조회 (v17.2.12+)
Memory.patchCode(address, size, patchFn)               // 안전한 코드 패칭
Memory.alloc(size, { near, maxDistance })               // 근접 할당
MemoryAccessMonitor.enable(ranges, callbacks)           // 접근 모니터링
MemoryAccessMonitor.disable()
ArrayBuffer.wrap(address, size) → ArrayBuffer          // 네이티브 메모리 뷰
```

---

### Advanced Module API (v17+)

```
module.enumerateSections() → Section[]                 // 섹션 열거 (v17.1.0+)
module.getVersion() → string | null                    // 모듈 버전 (v17.2.14+)
Module.getGlobalExportByName(name) → NativePointer     // 전역 export 검색
Module.load(path) → Module                             // 동적 모듈 로드
module.ensureInitialized()                             // 초기화 완료 대기
new ModuleMap()                                        // 효율적 주소→모듈 룩업
```

---

### Advanced Interceptor API

```
Interceptor.replace(target, replacement)               // 함수 전체 교체
Interceptor.replaceFast(target, replacement)           // 저오버헤드 교체
Interceptor.revert(target)                             // 원본 복원
Interceptor.flush()                                    // 비동기 콜백 완료 대기
// CModule/RustModule 기반 콜백: 10x 성능 향상
```

---

### Advanced Stalker API

```
Stalker.follow(threadId, {
  transform,           // 기본 블록 단위 명령 수정 콜백
  events,              // call/ret/exec/block/compile 선택
  callout,             // C 네이티브 callout
  trustThreshold,      // 검증 빈도 (0=항상)
})
Stalker.unfollow(threadId)
Stalker.garbageCollect()
// Writer: Arm64Writer, X86Writer (아키텍처별 명령 생성)
// Relocator: Arm64Relocator, X86Relocator (명령 재배치)
```

---

### Swift Runtime (frida-swift-bridge)

```
Swift.available → boolean
Swift.modules.enumerate() → SwiftModule[]
Swift.demangle(symbol) → string
Swift.enumerateTypesSync(module) → SwiftTypeDescriptor[]
// SwiftTypeDescriptor.kind: 'class' | 'struct' | 'enum' | 'protocol'
```

---

### IL2CPP Runtime (Unity)

NativeFunction 기반으로 libil2cpp.so / GameAssembly 심볼을 직접 호출:

```
il2cpp_domain_get() → Domain
il2cpp_domain_get_assemblies(domain) → Assembly[]
il2cpp_class_from_name(image, namespace, name) → Class
il2cpp_class_get_methods(klass) → Method[]
il2cpp_class_get_fields(klass) → Field[]
```

---

### ApiResolver & DebugSymbol

```
new ApiResolver('module' | 'objc' | 'swift')
  .enumerateMatches(query) → { name, address }[]

DebugSymbol.fromAddress(addr) → { address, name, moduleName, fileName, lineNumber }
DebugSymbol.findFunctionsMatching(glob) → NativePointer[]
```

---

### Cloak API (Anti-Detection)

```
Cloak.addThread(threadId) / removeThread(threadId)
Cloak.addRange({ base, size }) / removeRange({ base, size })
Cloak.hasRangeContaining(address) → boolean
```

---

### I/O API

```
// File
File.readAllBytes(path) → ArrayBuffer
File.readAllText(path) → string
File.writeAllBytes(path, buffer) / writeAllText(path, text)

// SqliteDatabase
SqliteDatabase.open(path) → db
db.prepare(sql) → Statement
stmt.bindInteger(idx, val) / bindText(idx, val) / step() → row

// Socket
Socket.listen({ port }) → listener
Socket.connect({ host, port }) → connection
```

---

### Utility API

```
new Worker(path, { onMessage }) → worker
worker.post(msg) / terminate()

new CycleSampler() / WallClockSampler() / MallocCountSampler()
sampler.sample() → count

hexdump(ptr, { offset, length, header, ansi })
```

---

*Last updated: 2026-03-11*
*Version: 2.1.0-alpha*
