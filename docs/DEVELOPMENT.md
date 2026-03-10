# CARF — 개발 가이드

> 개발 환경 설정, 빌드, 코드 컨벤션, 디자인 시스템, 테스트, 디버깅, 배포

---

## 1. 개발 환경 설정

### 1.1 필수 도구

| 도구 | 용도 | 최소 버전 |
|------|------|----------|
| **bun** | 패키지 매니저, 프론트엔드 런타임 | 1.x |
| **Rust toolchain** | 백엔드 빌드 (rustup으로 설치) | stable 1.77+ |
| **Tauri CLI** | Tauri 앱 빌드/실행 | 2.x |
| **frida-tools** | Frida CLI 도구 (frida, frida-ps 등) | 17.x |
| **frida-compile** | Agent 스크립트 번들링 | 17.x |
| **ADB** | Android 디바이스 관리 | Android SDK Platform Tools 35+ |
| **Xcode** | macOS/iOS 타겟 빌드 시 필요 | 15+ (macOS만 해당) |

### 1.2 설치 순서

#### macOS

```bash
# 1. Homebrew (없으면 설치)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. bun
curl -fsSL https://bun.sh/install | bash

# 3. Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# 4. Tauri 시스템 의존성 (macOS는 Xcode Command Line Tools 필요)
xcode-select --install

# 5. Tauri CLI
cargo install tauri-cli --version "^2"

# 6. Frida 도구
pip3 install frida-tools
bun add -g frida-compile

# 7. ADB (Android 분석 시)
brew install android-platform-tools

# 8. (선택) Xcode — iOS 타겟 또는 macOS 네이티브 빌드 시
#    App Store에서 Xcode 설치 후:
sudo xcodebuild -license accept
```

#### Linux (Ubuntu/Debian)

```bash
# 1. 시스템 의존성
sudo apt update
sudo apt install -y \
  build-essential curl wget file \
  libssl-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev libwebkit2gtk-4.1-dev \
  patchelf

# 2. bun
curl -fsSL https://bun.sh/install | bash

# 3. Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# 4. Tauri CLI
cargo install tauri-cli --version "^2"

# 5. Frida 도구
pip3 install frida-tools
bun add -g frida-compile

# 6. ADB (Android 분석 시)
sudo apt install -y adb
```

#### Windows

```powershell
# 1. Visual Studio Build Tools 설치
#    https://visualstudio.microsoft.com/visual-cpp-build-tools/
#    "C++ 빌드 도구" 워크로드 선택

# 2. WebView2 런타임 (Windows 10 이하)
#    https://developer.microsoft.com/en-us/microsoft-edge/webview2/

# 3. bun
powershell -c "irm bun.sh/install.ps1 | iex"

# 4. Rust toolchain
#    https://rustup.rs 에서 rustup-init.exe 다운로드 실행

# 5. Tauri CLI
cargo install tauri-cli --version "^2"

# 6. Frida 도구
pip install frida-tools
bun add -g frida-compile

# 7. ADB (Android 분석 시)
#    https://developer.android.com/tools/releases/platform-tools
#    다운로드 후 PATH에 추가
```

### 1.3 프로젝트 클론 & 초기 설정

```bash
# 저장소 클론
git clone https://github.com/<org>/carf.git
cd carf

# 프론트엔드 의존성 설치
bun install

# Rust 의존성 빌드 (최초 빌드는 frida-rust 다운로드로 시간 소요)
cd src-tauri && cargo build
cd ..

# Agent 스크립트 컴파일
bun run compile:agent

# 정상 동작 확인
bun run tauri dev
```

> **참고**: 최초 `cargo build` 시 `frida-rust`가 Frida devkit을 자동 다운로드한다.
> 네트워크 환경에 따라 5~10분 소요될 수 있다.

### 1.4 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `RUST_LOG` | Rust 로그 레벨 | `info` |
| `TAURI_DEBUG` | Tauri 디버그 모드 | 개발 시 자동 설정 |

```bash
# 상세 로그 활성화 예시
RUST_LOG=debug bun run tauri dev
```

---

## 2. 프로젝트 구조

```
carf/
├── docs/                         # 문서
│   ├── PRD.md                    # 제품 요구사항
│   ├── ARCHITECTURE.md           # 아키텍처 상세
│   └── DEVELOPMENT.md            # 개발 가이드 (이 문서)
│
├── src/                          # SolidJS 프론트엔드
│   ├── app.tsx                   # 앱 루트 컴포넌트
│   ├── index.tsx                 # 엔트리포인트
│   ├── index.css                 # Tailwind CSS 진입점
│   │
│   ├── components/               # 공용 UI 컴포넌트
│   │   ├── ui/                   # 기본 요소 (solid-ui: Button, Input, Dialog 등)
│   │   └── layout/               # 레이아웃 (Shell, Sidebar, Toolbar)
│   │
│   ├── features/                 # 기능 모듈 (도메인별 코로케이션)
│   │   ├── device/               # 디바이스 관리
│   │   │   ├── DevicePanel.tsx   #   컴포넌트
│   │   │   ├── device.store.ts   #   상태 관리
│   │   │   └── device.types.ts   #   타입 정의
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
│   │   ├── tauri.ts              # Tauri IPC 래퍼 (invoke, listen)
│   │   ├── types.ts              # 공유 타입 정의
│   │   └── format.ts             # 포맷팅 유틸 (주소, 크기 등)
│   │
│   └── styles/                   # 글로벌 스타일, 테마 토큰
│
├── src-tauri/                    # Tauri 2 백엔드 (Rust)
│   ├── src/
│   │   ├── main.rs               # 엔트리포인트
│   │   ├── lib.rs                # Tauri 앱 빌더, 플러그인 등록
│   │   ├── error.rs              # 통합 에러 타입 (thiserror)
│   │   ├── commands/             # Tauri IPC 커맨드 (thin adapter)
│   │   │   ├── mod.rs
│   │   │   ├── device.rs         # 디바이스 커맨드
│   │   │   ├── process.rs        # 프로세스 커맨드
│   │   │   ├── session.rs        # 세션 커맨드
│   │   │   ├── agent.rs          # Agent RPC 프록시
│   │   │   └── adb.rs            # ADB 커맨드
│   │   ├── services/             # 비즈니스 로직
│   │   │   ├── mod.rs
│   │   │   ├── frida.rs          # Frida DeviceManager 래퍼
│   │   │   ├── session_manager.rs # 세션 풀 관리
│   │   │   ├── script_loader.rs  # Agent 스크립트 로드
│   │   │   └── adb.rs            # ADB 디바이스 관리
│   │   └── state/                # Tauri 앱 상태
│   │       └── mod.rs            # AppState 정의
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src-agent/                    # CARF Std Script (Frida Agent)
│   ├── src/
│   │   ├── index.ts              # 엔트리포인트, RPC exports 등록
│   │   ├── rpc/                  # RPC 라우터
│   │   │   ├── router.ts         # 메서드명 → 핸들러 라우팅
│   │   │   ├── protocol.ts       # send/recv 프로토콜 래퍼
│   │   │   └── types.ts          # RPC 타입 정의
│   │   ├── modules/              # 기능 모듈
│   │   │   ├── process.ts        # Process 정보 (modules, threads, ranges)
│   │   │   ├── memory.ts         # 메모리 읽기/쓰기/검색
│   │   │   ├── java.ts           # Java 런타임
│   │   │   ├── objc.ts           # ObjC 런타임
│   │   │   ├── native.ts         # Native 함수 (Interceptor)
│   │   │   ├── stalker.ts        # Stalker (코드 트레이싱)
│   │   │   └── module.ts         # Module 탐색
│   │   └── rust/                 # RustModule 소스 (.rs 파일)
│   │       ├── scanner.rs        # 고속 메모리 패턴 스캔
│   │       ├── interceptor.rs    # Interceptor 핫 콜백
│   │       └── stalker.rs        # Stalker transform 콜백
│   └── tsconfig.json
│
├── assets/                       # 정적 에셋 (아이콘 등)
├── package.json
├── tailwind.config.ts
├── vite.config.ts
└── tsconfig.json
```

### 레이어 간 관계

```
┌─────────────────────────────────┐
│  src/ (SolidJS Frontend)        │
│  - UI 렌더링, 사용자 상호작용       │
│  - Signal/Store 기반 상태 관리     │
└──────────┬──────────────────────┘
           │ Tauri IPC (invoke / listen)
┌──────────▼──────────────────────┐
│  src-tauri/ (Rust Backend)      │
│  - Frida DeviceManager 관리      │
│  - 세션 풀, 스크립트 로더          │
│  - ADB 통합                     │
└──────────┬──────────────────────┘
           │ Frida Protocol (USB/TCP/Local)
┌──────────▼──────────────────────┐
│  src-agent/ (CARF Std Script)   │
│  - 대상 프로세스 내 실행            │
│  - RPC exports 제공              │
│  - RustModule로 고성능 처리        │
└─────────────────────────────────┘
```

---

## 3. 개발 워크플로우

### 3.1 빌드 커맨드

| 커맨드 | 설명 | 용도 |
|--------|------|------|
| `bun run dev` | Vite dev server (브라우저 모드) | UI 개발 |
| `bun run tauri dev` | Tauri 전체 개발 (Frontend + Backend) | 통합 테스트 |
| `bun run compile:agent` | Frida Agent 스크립트 컴파일 | Agent 변경 시 |
| `bun run compile:agent -- --watch` | Agent 스크립트 감시 모드 | Agent 개발 시 |
| `bun run build` | 프론트엔드 프로덕션 빌드 | CI/CD |
| `bun run tauri build` | 전체 프로덕션 빌드 (앱 패키징) | 릴리스 |

### 3.2 개발 모드

CARF는 3개 레이어가 독립적이므로 각각 별도로 개발할 수 있다.

#### Browser 모드 (UI 개발)

Tauri 없이 브라우저에서 프론트엔드만 개발한다. Frida API 호출은 fallback 처리된다.

```bash
bun run dev
# http://localhost:1420 에서 확인
```

- Tauri IPC 호출은 `lib/tauri.ts`의 가드에 의해 경고 로그 출력
- UI 레이아웃, 컴포넌트, 스타일링 작업에 적합
- 모의 데이터를 사용하여 각 뷰 테스트 가능

#### Tauri 모드 (전체 기능)

Frontend + Backend 전체를 실행한다. 실제 Frida 연동 테스트에 필수.

```bash
bun run tauri dev
```

- Frontend 변경: Vite HMR로 즉시 반영
- Backend(Rust) 변경: `cargo watch`가 자동 재컴파일 (tauri dev 내장)
- DevTools: WebView의 개발자 도구로 프론트엔드 디버깅

#### Agent 독립 모드 (Agent 스크립트 개발)

Frida CLI로 Agent 스크립트를 직접 테스트한다. CARF 앱 없이도 가능.

```bash
# 1. Agent 빌드
bun run compile:agent

# 2. Frida CLI로 로드 (로컬 프로세스 예시)
frida -l src-agent/dist/_agent.js <프로세스이름>

# 3. REPL에서 RPC 호출 테스트
# [REPL]> rpc.exports.ping()
# true
# [REPL]> rpc.exports.enumerateModules()
# [...]

# 4. USB 디바이스의 앱에 로드
frida -U -l src-agent/dist/_agent.js -f com.example.app
```

감시 모드로 실시간 개발:

```bash
# 터미널 1: Agent 감시 빌드
bun run compile:agent -- --watch

# 터미널 2: Frida로 로드 (스크립트 변경 시 자동 재로드)
frida -l src-agent/dist/_agent.js --auto-reload <프로세스>
```

### 3.3 핫 리로드

| 레이어 | 방식 | 설명 |
|--------|------|------|
| **Frontend** | Vite HMR | 파일 저장 시 즉시 반영, 상태 유지 |
| **Backend** | cargo watch | `tauri dev`에 내장, Rust 코드 변경 시 자동 재컴파일 및 앱 재시작 |
| **Agent** | frida-compile --watch | Agent 소스 변경 시 자동 재빌드, Frida --auto-reload와 조합 가능 |

### 3.4 일반적인 개발 사이클

```
1. 브랜치 생성      git checkout -b feature/새기능
2. 코드 작성        에디터에서 수정
3. 로컬 확인        bun run tauri dev (또는 bun run dev)
4. 테스트 실행      bun run test / cargo test
5. 커밋            git commit (컨벤셔널 커밋)
6. PR 생성         main 브랜치로 PR
```

---

## 4. 코드 컨벤션

### 4.1 TypeScript / SolidJS

#### 컴포넌트 규칙

- **함수형 컴포넌트만** 사용 (클래스 컴포넌트 금지)
- **Named export**만 사용 (`export function Component`)
- **Props**는 `interface`로 정의 (`interface ComponentProps`)
- **solid-ui** 컴포넌트를 기본 UI 요소로 활용
- **Tailwind CSS**로 스타일링 (인라인 스타일 최소화)

```typescript
// Good
import { Button } from "~/components/ui/button";

interface ProcessItemProps {
  process: ProcessInfo;
  onAttach: (pid: number) => void;
}

export function ProcessItem(props: ProcessItemProps) {
  return (
    <div class="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 rounded-md">
      <span class="text-sm font-mono text-muted-foreground w-16">
        {props.process.pid}
      </span>
      <span class="text-sm flex-1 truncate">{props.process.name}</span>
      <Button size="sm" variant="ghost" onClick={() => props.onAttach(props.process.pid)}>
        Attach
      </Button>
    </div>
  );
}
```

```typescript
// Bad - 하지 말 것
export default class ProcessItem extends Component { ... }  // 클래스 컴포넌트
export default function ProcessItem() { ... }               // default export
const style = { padding: '12px' };                          // 인라인 스타일
```

#### SolidJS 반응성 주의사항

SolidJS는 React와 다른 반응성 모델을 사용한다. 아래 패턴에 주의할 것.

```typescript
// Good - props를 함수처럼 접근 (반응성 유지)
export function Display(props: { count: number }) {
  return <span>{props.count}</span>;
}

// Bad - props 구조 분해 (반응성 소실)
export function Display({ count }: { count: number }) {
  return <span>{count}</span>;  // 업데이트되지 않음
}
```

```typescript
// Good - createMemo로 파생 값 계산
const doubled = createMemo(() => props.count * 2);

// Good - createEffect로 부수 효과
createEffect(() => {
  console.log("count changed:", props.count);
});
```

#### Import 순서

```typescript
// 1. SolidJS 코어
import { createSignal, createEffect, onMount } from "solid-js";
import { createStore } from "solid-js/store";

// 2. 서드파티 라이브러리
import { invoke } from "@tauri-apps/api/core";
import { Motion } from "solid-motionone";

// 3. 내부 컴포넌트 (UI)
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent } from "~/components/ui/dialog";

// 4. 내부 컴포넌트 (feature)
import { DevicePanel } from "~/features/device/DevicePanel";

// 5. 스토어, 훅
import { deviceState, refreshDevices } from "~/features/device/device.store";

// 6. 유틸리티, 헬퍼
import { invoke as safeInvoke } from "~/lib/tauri";
import { formatAddress } from "~/lib/format";

// 7. 타입 (type-only import)
import type { DeviceInfo, ProcessInfo } from "~/lib/types";
```

#### Store 패턴

SolidJS 네이티브 반응성을 직접 사용한다. 별도 상태 관리 라이브러리 없이 `createSignal`, `createStore`, `createResource`로 구성.

```typescript
// features/device/device.store.ts
import { createStore } from "solid-js/store";
import { invoke } from "~/lib/tauri";
import type { DeviceInfo } from "~/lib/types";

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

// 파생 시그널
const selectedDevice = () =>
  state.devices.find((d) => d.id === state.selectedId) ?? null;

// 액션
async function refreshDevices() {
  setState("loading", true);
  try {
    const devices = await invoke<DeviceInfo[]>("list_devices");
    setState({ devices, loading: false });
  } catch (e) {
    setState("loading", false);
    throw e;
  }
}

function selectDevice(id: string) {
  setState("selectedId", id);
}

export { state as deviceState, selectedDevice, refreshDevices, selectDevice };
```

#### 금지 사항

| 규칙 | 이유 |
|------|------|
| `any` 타입 사용 금지 | 명시적 타입 또는 `unknown` 사용 |
| `var` 사용 금지 | `const` / `let`만 사용 |
| 클래스 컴포넌트 금지 | 함수형 컴포넌트만 사용 |
| 인라인 스타일 최소화 | Tailwind utility classes 사용 |
| 프로덕션 코드에 `console.log` 금지 | 디버그 시에만 사용, 커밋 전 제거 |
| `default export` 금지 | `named export`만 사용 |

### 4.2 Rust

#### 모듈 구조 규칙

- **Commands**: Thin adapter 레이어. 비즈니스 로직 없이 IPC와 Service를 연결만 한다.
- **Services**: 비즈니스 로직을 담당한다. 모든 핵심 로직은 여기에 위치한다.
- **State**: Tauri 앱 상태를 정의한다.

```rust
// commands/device.rs — Good: 비즈니스 로직 없는 thin adapter
#[tauri::command]
pub async fn list_devices(
    frida: State<'_, FridaService>,
) -> Result<Vec<DeviceInfo>, AppError> {
    frida.list_devices().await
}

// commands/device.rs — Bad: 커맨드에 비즈니스 로직
#[tauri::command]
pub async fn list_devices(
    frida: State<'_, FridaService>,
) -> Result<Vec<DeviceInfo>, AppError> {
    let raw = frida.dm.enumerate_devices().await?;
    let filtered = raw.iter()
        .filter(|d| d.dtype() != DeviceType::Remote)  // 로직이 여기 있으면 안 됨
        .map(|d| DeviceInfo::from(d))
        .collect();
    Ok(filtered)
}
```

#### 에러 처리

모든 에러는 `AppError` enum으로 통합한다. `thiserror`로 정의하고 `Serialize`를 구현하여 IPC로 전달.

```rust
use thiserror::Error;
use serde::Serialize;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Device not found: {0}")]
    DeviceNotFound(String),

    #[error("Failed to attach: {0}")]
    AttachFailed(String),

    #[error("Internal error")]
    Internal(#[from] anyhow::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        serializer.serialize_str(&self.to_string())
    }
}
```

#### 네이밍 컨벤션

| 대상 | 규칙 | 예시 |
|------|------|------|
| 함수, 변수, 모듈 | `snake_case` | `list_devices`, `session_id` |
| 타입, 구조체, 열거형 | `PascalCase` | `DeviceInfo`, `AppError` |
| 상수 | `SCREAMING_SNAKE_CASE` | `MAX_SESSIONS`, `DEFAULT_TIMEOUT` |
| Tauri 이벤트 | `carf://도메인/액션` | `carf://device/added` |

### 4.3 Agent (Frida Script)

#### 모듈 패턴

각 기능은 독립적인 모듈로 분리하고, `register` 함수로 RPC 핸들러를 등록한다.

```typescript
// modules/java.ts
export const javaModule = {
  register(reg: (method: string, handler: Function) => void) {
    reg("enumerateJavaClasses", (params: { filter?: string }) => {
      return Java.perform(() => {
        const classes = Java.enumerateLoadedClassesSync();
        if (params.filter) {
          return classes.filter((c) => c.includes(params.filter!));
        }
        return classes;
      });
    });

    reg("hookJavaMethod", (params: { className: string; method: string }) => {
      // 후킹 로직
    });
  },
};
```

#### RustModule 사용 기준

| JS에서 처리 | RustModule에서 처리 |
|-------------|-------------------|
| RPC 라우팅, 메시지 전달 | 고빈도 Interceptor onEnter/onLeave 콜백 |
| Java/ObjC API 호출 | Stalker transform/callout 콜백 |
| 일회성 열거 작업 | 대용량 메모리 스캔/패치 |
| UI 이벤트 처리 | 데이터 인코딩/디코딩 (base64, hex) |

#### 이벤트 프로토콜

Agent에서 Host로의 이벤트는 `send()`를 통해 구조화된 메시지로 전달한다.

```typescript
// 구조화된 이벤트 전송
function emit(type: string, data: unknown) {
  send({
    type,
    timestamp: Date.now(),
    data,
  });
}

// 사용 예시
emit("hook:enter", {
  target: "open",
  args: [path, flags],
  threadId: Process.getCurrentThreadId(),
});
```

### 4.4 Git 컨벤션

#### 브랜치 전략

```
main            # 프로덕션
develop         # 개발 통합
feature/*       # 기능 개발 (feature/device-panel)
fix/*           # 버그 수정 (fix/session-leak)
hotfix/*        # 긴급 수정
```

#### 커밋 메시지

[Conventional Commits](https://www.conventionalcommits.org/) 형식을 따른다.

```
<type>(<scope>): <description>

# type: feat, fix, docs, style, refactor, test, chore
# scope: frontend, backend, agent, build 등
```

예시:
```
feat(frontend): add DevicePanel with real-time device detection
fix(backend): resolve session leak on device disconnect
refactor(agent): extract RPC router to separate module
docs: update ARCHITECTURE.md with ADB integration
chore(build): upgrade frida-rust to 0.17.5
```

---

## 5. 디자인 가이드

### 5.1 디자인 시스템

CARF는 **Carbon + Apple + OpenAI** 하이브리드 디자인을 지향한다.

| 요소 | 영감 | 적용 |
|------|------|------|
| **구조/그리드** | Carbon Design System | 높은 정보 밀도, 구조적 레이아웃 |
| **인터랙션** | Apple HIG | 부드러운 전환, 직관적 조작감 |
| **비주얼** | OpenAI 스타일 | 미니멀, 세련된 느낌 |

#### 테마

- **Dark mode**가 기본, Light mode 지원
- solid-ui의 CSS 변수 기반 테마 시스템 사용
- Tailwind CSS v4의 테마 토큰 활용

#### 타이포그래피

| 용도 | 폰트 | 적용 |
|------|------|------|
| UI 텍스트 | **Inter** | 버튼, 라벨, 설명 등 |
| 코드/데이터 | **JetBrains Mono** | 주소, PID, 콘솔 출력, 코드 |

#### 색상 체계

- 중립 회색 기반 (배경, 테두리, 비활성 텍스트)
- 액센트 컬러로 상태 표현:

| 상태 | 색상 | 용도 |
|------|------|------|
| Primary | Blue | 주요 액션, 선택 상태 |
| Success | Green | 연결됨, 활성 |
| Warning | Amber | 주의, 보류 |
| Error | Red | 오류, 연결 끊김, 크래시 |

### 5.2 컴포넌트 라이브러리

solid-ui (shadcn/ui의 SolidJS 포트)를 기본 컴포넌트 라이브러리로 사용한다.

- **Kobalte**: 접근성 프리미티브 (Dialog, Popover, Select 등)
- **corvu**: 고급 UI 프리미티브 (Resizable, Drawer 등)

```typescript
// solid-ui 컴포넌트 사용 예시
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
```

#### 아이콘

[HugeIcons](https://hugeicons.com/)를 사용한다. 46,000+ 아이콘, 트리셰이킹 지원.

```typescript
import { DevicePhoneSmartphoneIcon } from "@hugeicons/solid/stroke/device-phone-smartphone";
import { WifiConnected01Icon } from "@hugeicons/solid/stroke/wifi-connected-01";
```

#### 애니메이션

[solid-motionone](https://motion.dev/solid)으로 SolidJS 네이티브 애니메이션을 구현한다.

```typescript
import { Motion, Presence } from "solid-motionone";

<Presence>
  <Show when={isVisible()}>
    <Motion
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div>패널 내용</div>
    </Motion>
  </Show>
</Presence>
```

### 5.3 컴포넌트 패턴

#### 페이지 레이아웃 패턴

```typescript
export function MemoryPage() {
  return (
    <div class="flex h-full flex-col">
      {/* 헤더 */}
      <div class="flex items-center justify-between border-b px-4 py-2">
        <div class="flex items-center gap-2">
          <MemoryIcon class="h-4 w-4 text-muted-foreground" />
          <h2 class="text-sm font-semibold">Memory</h2>
        </div>
        <div class="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={handleRefresh}>
            <RefreshIcon class="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div class="flex-1 overflow-auto p-4">
        {/* ... */}
      </div>
    </div>
  );
}
```

#### 리사이즈 가능한 패널 패턴

```typescript
import { Resizable, ResizableHandle, ResizablePanel } from "~/components/ui/resizable";

export function SessionView() {
  return (
    <Resizable orientation="horizontal">
      <ResizablePanel initialSize={0.7} minSize={0.3}>
        {/* 메인 컨텐츠 */}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel initialSize={0.3} minSize={0.15}>
        {/* 인스펙터 */}
      </ResizablePanel>
    </Resizable>
  );
}
```

#### 가상 스크롤 패턴

대량 데이터 (모듈 10,000+, 클래스 목록 등) 렌더링 시 가상 스크롤을 사용한다.

```typescript
import { VirtualList } from "~/components/ui/virtual-list";

export function ModuleList(props: { modules: ModuleInfo[] }) {
  return (
    <VirtualList
      items={props.modules}
      itemHeight={32}
      overscan={10}
    >
      {(module, index) => (
        <div class="flex items-center gap-2 px-3 py-1 text-sm">
          <span class="font-mono text-xs text-muted-foreground">
            {module.base}
          </span>
          <span class="truncate">{module.name}</span>
        </div>
      )}
    </VirtualList>
  );
}
```

#### 모달(Dialog) 패턴

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

export function AttachModal(props: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>Attach to Process</DialogTitle>
        </DialogHeader>

        <div class="space-y-4 py-4">
          {/* 옵션 폼 */}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={props.onClose}>Cancel</Button>
          <Button onClick={handleAttach}>Attach</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 6. 테스트

### 6.1 Frontend 테스트

**Vitest** + **@solidjs/testing-library**를 사용한다.

#### 설정

```bash
bun add -d vitest @solidjs/testing-library @testing-library/jest-dom jsdom
```

```typescript
// vite.config.ts (test 설정 추가)
export default defineConfig({
  // ...
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    transformMode: {
      web: [/\.[jt]sx?$/],
    },
  },
});
```

#### 컴포넌트 테스트

```typescript
// features/device/DevicePanel.test.tsx
import { render, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi } from "vitest";
import { DevicePanel } from "./DevicePanel";

describe("DevicePanel", () => {
  it("디바이스 목록을 렌더링한다", () => {
    const devices = [
      { id: "local", name: "Local System", type: "local" as const },
    ];
    render(() => <DevicePanel devices={devices} />);
    expect(screen.getByText("Local System")).toBeInTheDocument();
  });

  it("디바이스 선택 시 콜백을 호출한다", async () => {
    const onSelect = vi.fn();
    const devices = [{ id: "usb-1", name: "Pixel 8", type: "usb" as const }];
    render(() => <DevicePanel devices={devices} onSelect={onSelect} />);

    await screen.getByText("Pixel 8").click();
    expect(onSelect).toHaveBeenCalledWith("usb-1");
  });
});
```

#### Store 테스트

```typescript
// features/device/device.store.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Tauri invoke 모킹
vi.mock("~/lib/tauri", () => ({
  invoke: vi.fn(),
}));

import { deviceState, refreshDevices, selectDevice } from "./device.store";
import { invoke } from "~/lib/tauri";

describe("device.store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshDevices가 디바이스 목록을 갱신한다", async () => {
    const mockDevices = [
      { id: "local", name: "Local", type: "local" },
    ];
    vi.mocked(invoke).mockResolvedValue(mockDevices);

    await refreshDevices();

    expect(deviceState.devices).toEqual(mockDevices);
    expect(deviceState.loading).toBe(false);
  });

  it("selectDevice가 selectedId를 설정한다", () => {
    selectDevice("usb-1");
    expect(deviceState.selectedId).toBe("usb-1");
  });
});
```

#### 테스트 실행

```bash
# 전체 테스트
bun run test

# 감시 모드
bun run test -- --watch

# 특정 파일
bun run test -- features/device

# 커버리지
bun run test -- --coverage
```

### 6.2 Backend 테스트 (Rust)

표준 `cargo test`를 사용한다.

```rust
// services/frida.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_info_from_frida() {
        // DeviceInfo 변환 테스트
    }

    #[tokio::test]
    async fn test_session_lifecycle() {
        // 세션 생성 → 사용 → 정리 테스트
    }
}
```

```bash
# 전체 테스트
cd src-tauri && cargo test

# 특정 모듈
cargo test services::frida

# 출력 포함
cargo test -- --nocapture
```

> **참고**: Frida 서비스 통합 테스트는 실제 디바이스가 필요할 수 있다.
> 유닛 테스트에서는 Frida 호출을 trait으로 추상화하여 모킹한다.

### 6.3 Agent 테스트

Agent 스크립트는 대상 프로세스 내에서 실행되므로, 자동화 테스트보다는 수동/반자동 테스트가 주가 된다.

#### Frida CLI로 수동 테스트

```bash
# 로컬 프로세스에 Agent 로드
frida -l src-agent/dist/_agent.js <프로세스>

# REPL에서 RPC 호출
[Device]> rpc.exports.ping()
# true

[Device]> rpc.exports.getStatus()
# { arch: "arm64", platform: "darwin", pid: 1234, mainModule: "target" }

[Device]> rpc.exports.enumerateModules()
# [{ name: "libc.so", base: "0x7fff...", size: 262144, path: "/lib/..." }, ...]
```

#### Android 디바이스 테스트

```bash
# USB로 연결된 Android 디바이스에서 테스트
frida -U -l src-agent/dist/_agent.js -f com.example.target

# 특정 PID에 attach
frida -U -l src-agent/dist/_agent.js -p 1234
```

---

## 7. 디버깅

### 7.1 Frontend 디버깅

#### Browser DevTools

Tauri dev 모드에서 WebView의 개발자 도구를 사용한다.

```bash
# DevTools가 자동 열리는 Tauri dev
bun run tauri dev
```

- **Console**: 프론트엔드 로그, Tauri IPC 경고 확인
- **Network**: Tauri IPC 호출은 보이지 않으나, 외부 리소스 로드 확인
- **Elements**: DOM 구조, Tailwind 클래스 확인
- **Sources**: 브레이크포인트, 스텝 디버깅

#### SolidJS DevTools

SolidJS 전용 DevTools 브라우저 확장을 사용하면 Signal/Store 상태를 실시간으로 확인할 수 있다.

```bash
# Chrome Web Store 또는 Firefox Add-ons에서 "Solid DevTools" 설치
```

### 7.2 Backend 디버깅

#### 로그 레벨 조정

`RUST_LOG` 환경 변수로 Rust 로그 레벨을 제어한다.

```bash
# 전체 디버그 로그
RUST_LOG=debug bun run tauri dev

# 특정 모듈만 디버그
RUST_LOG=carf=debug,frida=info bun run tauri dev

# 트레이스 레벨 (매우 상세)
RUST_LOG=trace bun run tauri dev
```

로그 레벨: `error` < `warn` < `info` < `debug` < `trace`

#### Tauri 콘솔 출력

Backend의 `println!`, `eprintln!`, `log::info!` 등은 `tauri dev`를 실행한 터미널에 출력된다.

```rust
use log::{info, debug, error};

info!("Device connected: {}", device.name());
debug!("Session details: {:?}", session);
error!("Failed to attach: {}", err);
```

#### Rust 디버거

```bash
# lldb로 Tauri 앱 디버깅 (macOS)
cd src-tauri
cargo build
lldb target/debug/carf

# 또는 VSCode의 CodeLLDB 확장 사용
```

### 7.3 Agent 디버깅

#### console.log 기반 디버깅

Agent 내 `console.log`는 Frida의 `send()` 메시지로 변환되어 Host에 전달된다.
CARF 앱에서는 Console Panel에 표시된다.

```typescript
// Agent 코드 내
console.log("Hook triggered:", functionName);
console.warn("Suspicious value:", hexValue);
console.error("Failed to read memory at:", address);
```

#### Frida REPL 대화형 디버깅

```bash
# Agent를 로드하고 REPL 사용
frida -U -l src-agent/dist/_agent.js -f com.example.app

# REPL에서 실시간 코드 실행
[USB::Pixel 8::com.example.app]> Process.enumerateModules().length
42

[USB::Pixel 8::com.example.app]> Memory.readUtf8String(ptr("0x12345678"))
"Hello World"

[USB::Pixel 8::com.example.app]> Interceptor.attach(Module.findExportByName("libc.so", "open"), {
    onEnter(args) { console.log("open:", args[0].readUtf8String()); }
})
```

#### V8 Inspector 디버깅

Frida 스크립트의 V8 Inspector를 활성화하면 Chrome DevTools로 Agent 코드를 디버깅할 수 있다.

```bash
# Inspector 활성화 (포트 9229)
frida -U -l src-agent/dist/_agent.js -f com.example.app --debug

# Chrome에서 chrome://inspect 열어 연결
```

---

## 8. 배포

### 8.1 빌드 프로세스

프로덕션 빌드는 3단계로 이루어진다.

```bash
# 1. Agent 스크립트 컴파일
bun run compile:agent

# 2. 프론트엔드 빌드 + Rust 컴파일 + 패키징 (한번에)
bun run tauri build
```

`tauri build`가 내부적으로 수행하는 작업:

```
1. Vite 프로덕션 빌드 (src/ → dist/)
2. Rust 컴파일 (src-tauri/ → 릴리스 바이너리)
3. Agent 스크립트 임베딩 (_agent.js → 바이너리 리소스)
4. 플랫폼별 패키징 (.dmg, .deb, .msi 등)
```

### 8.2 플랫폼별 패키징

#### macOS

```bash
bun run tauri build
# 출력: src-tauri/target/release/bundle/
#   ├── dmg/CARF_x.x.x_aarch64.dmg      (Apple Silicon)
#   ├── dmg/CARF_x.x.x_x64.dmg          (Intel)
#   └── macos/CARF.app                    (앱 번들)
```

유니버설 바이너리 (Apple Silicon + Intel):

```bash
bun run tauri build -- --target universal-apple-darwin
```

> **참고**: macOS 배포 시 코드 서명과 공증(Notarization)이 필요하다.
> `tauri.conf.json`에서 Apple Developer 인증서 설정.

#### Linux

```bash
bun run tauri build
# 출력: src-tauri/target/release/bundle/
#   ├── deb/carf_x.x.x_amd64.deb
#   ├── rpm/carf-x.x.x-1.x86_64.rpm
#   └── appimage/carf_x.x.x_amd64.AppImage
```

#### Windows

```bash
bun run tauri build
# 출력: src-tauri/target/release/bundle/
#   ├── msi/CARF_x.x.x_x64_en-US.msi
#   └── nsis/CARF_x.x.x_x64-setup.exe
```

### 8.3 빌드 최적화

| 항목 | 설정 |
|------|------|
| 프론트엔드 번들 | Vite의 롤업 minification, 트리셰이킹 |
| Rust 최적화 | `[profile.release]` opt-level = 3, LTO = true |
| Agent 번들 | frida-compile IIFE 번들, 소스맵 제외 (프로덕션) |
| 앱 크기 | Tauri의 UPX 압축 (선택) |

```toml
# src-tauri/Cargo.toml
[profile.release]
opt-level = 3
lto = true
strip = true
codegen-units = 1
```

---

## 9. 문제 해결 (Troubleshooting)

### 빌드 관련

#### `frida-rust` 빌드 실패

```
error: failed to run custom build command for `frida-sys`
```

**원인**: Frida devkit 다운로드 실패 또는 시스템 라이브러리 누락

**해결**:
```bash
# 네트워크 확인 후 재시도
cd src-tauri && cargo clean && cargo build

# 또는 수동으로 devkit 다운로드
# https://github.com/niclas-aspect/frida-rust 참조
```

#### Tauri dev에서 프론트엔드가 안 보임

```
Error: failed to get cargo metadata
```

**해결**:
```bash
# Rust 도구 체인 확인
rustup update stable
rustup default stable

# Tauri CLI 재설치
cargo install tauri-cli --version "^2" --force
```

#### `bun install` 후 네이티브 모듈 에러

**해결**:
```bash
# lockfile 삭제 후 재설치
rm -rf node_modules bun.lockb
bun install
```

### Frida 관련

#### `Failed to attach: unable to find process`

**원인**: 대상 프로세스가 존재하지 않거나 권한 부족

**해결**:
```bash
# 프로세스 확인
frida-ps -U  # USB 디바이스
frida-ps -R  # 리모트 디바이스

# Android: frida-server가 실행 중인지 확인
adb shell "ps -A | grep frida"
```

#### `Failed to spawn: unable to access process`

**원인**: Android에서 루트 권한 없이 spawn 시도, 또는 frida-server 미실행

**해결**:
```bash
# frida-server 실행 (Android)
adb root
adb shell "chmod 755 /data/local/tmp/frida-server && /data/local/tmp/frida-server &"

# SELinux 문제 시
adb shell setenforce 0
```

#### `Script destroyed` 또는 `Session detached unexpectedly`

**원인**: 대상 프로세스 크래시, 또는 Frida 버전 불일치

**해결**:
```bash
# Frida 버전 일치 확인 (호스트 ↔ frida-server)
frida --version
adb shell "/data/local/tmp/frida-server --version"

# 버전이 다르면 frida-server 업데이트
# https://github.com/frida/frida/releases 에서 동일 버전 다운로드
```

#### Agent RPC 호출 시 타임아웃

**원인**: Agent 스크립트 로드 실패, 또는 RPC 핸들러 미등록

**해결**:
```bash
# Agent 스크립트 재컴파일
bun run compile:agent

# Frida CLI에서 직접 테스트
frida -l src-agent/dist/_agent.js <프로세스>
# REPL에서 rpc.exports.ping() 확인
```

### ADB 관련

#### `adb: device not found`

**해결**:
```bash
# USB 디버깅 활성화 확인
adb devices

# ADB 서버 재시작
adb kill-server && adb start-server

# WiFi ADB 연결
adb pair <IP>:<PORT>     # 페어링 코드 입력
adb connect <IP>:<PORT>  # 연결
```

#### `Permission denied` (frida-server)

**해결**:
```bash
# 루트 권한 확인
adb root

# frida-server 권한 설정
adb shell chmod 755 /data/local/tmp/frida-server

# Magisk 사용 시
adb shell su -c "/data/local/tmp/frida-server -D &"
```

### 개발 환경 관련

#### HMR이 작동하지 않음

**해결**:
```bash
# Vite 캐시 삭제
rm -rf node_modules/.vite

# 재시작
bun run dev
```

#### Rust 변경이 반영되지 않음 (tauri dev)

**해결**:
```bash
# cargo 캐시 정리 후 재시작
cd src-tauri && cargo clean
cd .. && bun run tauri dev
```

#### TypeScript 타입 에러가 에디터에서만 발생

**해결**:
```bash
# TypeScript 서버 재시작 (VSCode: Cmd+Shift+P → "TypeScript: Restart TS Server")
# 또는 타입 확인
bunx tsc --noEmit
```

---

*Last updated: 2026-03-10*
*Version: 2.0.0-alpha*
