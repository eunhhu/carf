# Frida 개요 및 v17 변경사항

## 1. Frida란?

Frida는 **동적 계측(dynamic instrumentation) 프레임워크**로, 실행 중인 프로세스에 JavaScript 코드를 주입하여 함수 호출을 가로채고, 메모리를 읽고 쓰고, 런타임 동작을 수정할 수 있다.

### 지원 플랫폼

| 플랫폼 | 아키텍처 |
|--------|----------|
| Windows | ia32, x64, arm64 |
| macOS | x64, arm64 |
| Linux | ia32, x64, arm, arm64 |
| iOS | arm64 |
| Android | arm, arm64, x86, x86_64 |
| FreeBSD | x86, x64 |
| QNX | arm |

### 런타임 엔진

- **V8**: Google의 고성능 JavaScript 엔진. JIT 컴파일로 최적화된 성능 제공.
- **QuickJS**: 경량 JavaScript 엔진. JIT이 제한된 환경(iOS 등)에서 사용.

---

## 2. 동작 모드

Frida는 세 가지 동작 모드를 지원한다. CARF는 주로 **Injected** 모드를 사용하며, 제한된 환경에서는 **Embedded(Gadget)** 모드를 활용한다.

### 2.1 Injected (가장 일반적)

frida-core가 GumJS를 공유 라이브러리로 패키징하여 대상 프로세스에 주입하고, 양방향 통신 채널을 수립한다.

**spawn 모드**: 새 프로세스를 생성한 뒤 진입점에서 일시 정지시키고, 에이전트를 주입한 후 실행을 재개한다.

```
Host                          Target Process
┌──────────┐   spawn/inject   ┌──────────────┐
│ frida-   │ ──────────────→  │  GumJS       │
│ core     │ ←─────────────── │  (Agent)     │
│          │   message channel│              │
└──────────┘                  └──────────────┘
```

**attach 모드**: 이미 실행 중인 프로세스에 에이전트를 주입한다. 프로세스를 중단하지 않고 주입이 이루어진다.

### 2.2 Embedded (Gadget)

frida-gadget 공유 라이브러리를 앱 바이너리에 직접 포함시키는 방식이다. jailed iOS, 루팅되지 않은 Android 등 frida-server를 실행할 수 없는 제한된 환경에서 사용한다.

**설정 파일** (`.config`):

```json
{
  "interaction": {
    "type": "listen",
    "address": "0.0.0.0",
    "port": 27042,
    "on_load": "wait"
  },
  "runtime": "qjs",
  "teardown": "minimal",
  "on_change": "reload"
}
```

| 설정 | 설명 |
|------|------|
| `interaction.type` | `listen` (대기), `connect` (역연결), `script` (스크립트 직접 실행), `script-directory` (디렉토리 감시) |
| `runtime` | `qjs` (QuickJS) 또는 `v8` |
| `teardown` | `minimal` (최소 정리) 또는 `full` (전체 정리) |
| `on_change` | `reload` 설정 시 스크립트 변경 감지 후 자동 재로드 |

### 2.3 Preloaded

운영체제의 라이브러리 프리로드 메커니즘을 이용하여 gadget을 로드한다. 별도의 호스트 프로세스 없이 자율적으로 스크립트를 실행한다.

- **Linux**: `LD_PRELOAD=./frida-gadget.so ./target`
- **macOS**: `DYLD_INSERT_LIBRARIES=./frida-gadget.dylib ./target`

---

## 3. Frida 17.0.0 Breaking Changes (2025-05-17)

Frida 17은 모듈화, 레거시 API 정리, 빌드 성능 개선을 중심으로 한 메이저 업데이트이다. CARF 프로젝트에서 반드시 인지해야 할 변경사항을 정리한다.

### 3.1 런타임 브릿지 언번들링

`frida-objc-bridge`, `frida-swift-bridge`, `frida-java-bridge`가 GumJS에서 분리되었다. 더 이상 자동으로 `ObjC`, `Java`, `Swift` 전역 객체가 제공되지 않는다.

**이전 (v16)**: 스크립트에서 바로 `Java.perform(...)` 사용 가능.

**현재 (v17)**: ESM `import`로 명시적 포함 필요.

```typescript
// frida-compile로 번들링 시
import { Java } from "frida-java-bridge";
import { ObjC } from "frida-objc-bridge";

Java.perform(() => {
  const Activity = Java.use("android.app.Activity");
  // ...
});
```

> **CARF 영향**: `src-frida/`에서 `frida-compile`로 에이전트를 빌드할 때 브릿지를 명시적으로 import해야 한다. `package.json`에 `frida-java-bridge`, `frida-objc-bridge` 의존성이 필요하다.

### 3.2 레거시 열거 API 제거

콜백 기반 열거 API가 완전히 제거되었다. 배열을 반환하는 동기식 API만 사용 가능하다.

```javascript
// v16 (제거됨)
Process.enumerateModules({
  onMatch(module) { console.log(module.name); },
  onComplete() { }
});

// v17 (현재)
for (const module of Process.enumerateModules()) {
  console.log(module.name);
}
```

이 패턴은 모든 `enumerate*` 메서드에 동일하게 적용된다:
- `Process.enumerateModules()`
- `Process.enumerateThreads()`
- `Module.enumerateExports()`
- `Module.enumerateImports()`
- `Module.enumerateSymbols()`
- `Module.enumerateRanges()`
- `Memory.scanSync()` (콜백 기반 `Memory.scan()`은 유지)

### 3.3 Memory 정적 메서드 제거

`Memory.readU32()`, `Memory.writeU32()` 등 정적 메서드가 제거되었다. `NativePointer` 인스턴스 메서드를 사용해야 한다.

```javascript
// v16 (제거됨)
const val = Memory.readU32(addr);
Memory.writeU32(addr, 42);

// v17 (현재) — 체이닝 가능
const val = addr.readU32();
addr.writeU32(42);

// 체이닝 예시
const buf = addr
  .writeU32(0x1234)
  .add(4)
  .writeU32(0x5678);
```

**제거된 메서드 목록**:

| 제거된 정적 메서드 | 대체 인스턴스 메서드 |
|-------------------|---------------------|
| `Memory.readU8(addr)` | `addr.readU8()` |
| `Memory.readS8(addr)` | `addr.readS8()` |
| `Memory.readU16(addr)` | `addr.readU16()` |
| `Memory.readS16(addr)` | `addr.readS16()` |
| `Memory.readU32(addr)` | `addr.readU32()` |
| `Memory.readS32(addr)` | `addr.readS32()` |
| `Memory.readU64(addr)` | `addr.readU64()` |
| `Memory.readS64(addr)` | `addr.readS64()` |
| `Memory.readFloat(addr)` | `addr.readFloat()` |
| `Memory.readDouble(addr)` | `addr.readDouble()` |
| `Memory.readByteArray(addr, len)` | `addr.readByteArray(len)` |
| `Memory.readUtf8String(addr)` | `addr.readUtf8String()` |
| `Memory.readUtf16String(addr)` | `addr.readUtf16String()` |
| `Memory.writeU8(addr, val)` | `addr.writeU8(val)` |
| `Memory.writeU32(addr, val)` | `addr.writeU32(val)` |
| `Memory.writeUtf8String(addr, str)` | `addr.writeUtf8String(str)` |

### 3.4 Module 정적 메서드 제거

`Module` 클래스의 정적 편의 메서드가 제거되었다. `Process.getModuleByName()`을 통해 모듈 인스턴스를 얻은 후 인스턴스 메서드를 사용해야 한다.

```javascript
// v16 (제거됨)
const base = Module.findBaseAddress('libc.so');
const open = Module.getExportByName('libc.so', 'open');
const sym  = Module.findSymbolByName(null, 'open');

// v17 (현재)
const libc = Process.getModuleByName('libc.so');
const base = libc.base;
const open = libc.getExportByName('open');

// 전역 심볼 검색 (모듈 지정 없이)
const sym = Module.getGlobalExportByName('open');
```

**제거된 메서드 매핑**:

| 제거된 정적 메서드 | 대체 방법 |
|-------------------|-----------|
| `Module.findBaseAddress(name)` | `Process.getModuleByName(name).base` |
| `Module.getExportByName(mod, name)` | `Process.getModuleByName(mod).getExportByName(name)` |
| `Module.findExportByName(mod, name)` | `Process.findModuleByName(mod)?.getExportByName(name)` |
| `Module.findSymbolByName(null, name)` | `Module.getGlobalExportByName(name)` |
| `Module.enumerateExportsSync(name)` | `Process.getModuleByName(name).enumerateExports()` |
| `Module.enumerateImportsSync(name)` | `Process.getModuleByName(name).enumerateImports()` |

### 3.5 빌드 성능 향상

| 항목 | v16 | v17 |
|------|-----|-----|
| 빌드 시간 (Linux i9-12900K) | 24초 | 6초 |
| Node.js/npm 의존성 | 필요 | 불필요 |
| 컴파일러 백엔드 | TypeScript compiler API | ESBuild + typescript-go (v17.1.0+) |

---

## 4. v17 주요 릴리스 타임라인

### 17.1.0 (2025-06-05) — 컴파일러 혁신

Frida 내장 컴파일러가 ESBuild + typescript-go 기반으로 전환되어 빌드 성능이 대폭 향상되었다.

- **ESBuild + typescript-go 전환**: 기존 TypeScript compiler API 대비 수십 배 빠른 번들링
- **출력/번들 포맷 설정**: 컴파일러에 output format, bundle format 옵션 추가
- **타입 체크 비활성화 옵션**: 빠른 반복 개발 시 타입 체크를 건너뛸 수 있음
- **Windows ARM64 바이너리 지원**
- **`Module.enumerateSections()`**: Windows 대상에서 PE 섹션 열거 지원
- **`Module.enumerateImports()`**: `slot` 파라미터 노출로 IAT 주소 직접 접근
- **Interceptor 싱글턴 메모리 누수 수정**

### 17.2.0 (2025-06-18) — PackageManager API

Frida 에코시스템에 패키지 관리 기능이 도입되었다.

- **`Frida.PackageManager`**: npm 레지스트리에서 Frida 패키지 검색/설치를 위한 프로그래밍 API
- **`frida-pm` CLI**: `frida-pm search <query>`, `frida-pm install <package>` 명령어
- **Python/C/Node.js 바인딩**: 각 언어에서 프로그래밍 방식으로 패키지 관리 가능
- **`install-progress` 이벤트**: 설치 진행률 추적

```python
# Python 예시
pm = frida.get_package_manager()
pm.on("install-progress", on_progress)
pm.install("frida-trace-helpers")
```

### 17.2.12 (2025-07-18) — Bare-metal & Memory

운영체제 없이 실행되는 베어메탈 환경 지원과 메모리 관련 기능이 강화되었다.

- **베어메탈 OS 지원**: 운영체제 없이 Frida 에이전트 실행 가능
- **APRR 지원**: ARM64의 Apple Page Protection Layer 대응
- **`Memory.protect()`**: 메모리 페이지의 보호 속성(rwx) 변경 API 추가
- **Buffer read/write 메서드 확장**: ArrayBuffer 기반 효율적 데이터 처리

### 17.2.14 (2025-07-24) — Android 개선

- **`Module.getVersion()`**: 모듈의 버전 정보 조회 (ELF, PE 등에서 추출)
- **ART offset 감지 개선**: Android Runtime 내부 구조체 오프셋 자동 감지 정확도 향상
- **ThreadCountCloaker 누수 수정**: 스레드 수 은닉 기능의 메모리 누수 해결

### 17.2.15 (2025-08-02) — 플랫폼 확장

- **iOS 26 듀얼 매핑 지원**: 코드/데이터 영역의 듀얼 매핑 아키텍처 대응
- **visionOS 예비 지원**: Apple Vision Pro 타겟 초기 지원
- **FreeBSD x86 지원**: FreeBSD 32비트 아키텍처 추가
- **NEON 레지스터 지원**: ARM NEON(SIMD) 레지스터 읽기/쓰기

### 17.3.0 (2025-09-15) — 베어본 & iOS

iOS 인젝션 안정성과 연결 신뢰성이 개선되었다.

- **XNU 인젝션 기본 지원**: iOS 14 QEMU 환경에서 테스트 검증된 안정적 주입
- **Fruity 터널 타임아웃 시 usbmux 폴백**: USB 연결 실패 시 자동 폴백
- **CoreDevice 페어링 FIFO 매칭 개선**: 다중 디바이스 환경에서의 페어링 안정성

### 17.4.0 (2025-10-12) — Simmy (시뮬레이터)

Apple 시뮬레이터에서 Frida를 네이티브로 사용할 수 있게 되었다.

- **Apple 시뮬레이터 백엔드**: `CoreSimulator.framework` 통합
- **시뮬레이터 spawn**: 시뮬레이터에서 앱을 spawn하고 프로세스 계측 가능
- **iOS 18 `dyld_sim` 조기 계측**: 시뮬레이터 환경에서 dyld 초기화 단계 계측
- **fruity auto-unpair**: `InvalidHostID` 에러 시 자동 재페어링

```python
# 시뮬레이터에서 앱 계측
device = frida.get_device("simmy:iPhone 16 Pro")
pid = device.spawn(["com.example.app"])
session = device.attach(pid)
```

### 17.5.0 (2025-11-04) — 컴파일러 & Swift

- **Compiler에 `platform`/`externals` 옵션**: 빌드 대상 플랫폼 지정, 외부 모듈 제외
- **Darwin 공유 캐시 직접 파싱**: `dyld shared cache`를 직접 분석하여 시스템 라이브러리 심볼 해석 속도 향상
- **Simmy spawn에 argv/env 전달**: 시뮬레이터 앱 실행 시 인자와 환경변수 설정
- **Swift 바인딩 async/await 현대화**: Swift concurrency 모델 적용

### 17.6.0 (2026-01-18) — Zymbiote (Android 혁신)

Android 계측 아키텍처가 근본적으로 재설계되었다. Zygote/system_server에 대한 침습적 계측을 완전히 제거하여 탐지 회피와 안정성이 크게 향상되었다.

```
기존 (v16)                              Zymbiote (v17.6)
┌──────────────┐                        ┌──────────────┐
│ frida-server │                        │ frida-server │
│              │                        │              │
│ ┌──────────┐ │  침습적 후킹           │ ┌──────────┐ │  920B 페이로드
│ │ Zygote   │ │  (인라인 후킹,         │ │ Zymbiote │ │  (JNI 포인터 스왑,
│ │ hooking  │ │   Java bridge 주입)    │ │          │ │   ptrace 미사용)
│ └──────────┘ │                        │ └──────────┘ │
└──────────────┘                        └──────────────┘
  - RASP 탐지 취약                        - RASP 탐지 회피
  - Java bridge 의존                     - Java bridge 비의존
  - ptrace 오버헤드                       - /proc/$pid/mem 사용
```

**핵심 변경사항**:

| 항목 | 기존 | Zymbiote |
|------|------|----------|
| Zygote 후킹 | 인라인 후킹 (침습적) | 920바이트 경량 페이로드 |
| 네이티브 메서드 후킹 | 인라인 후킹 | JNI 네이티브 메서드 포인터 스왑 |
| 메모리 스캔 | ptrace 기반 | `/proc/$pid/mem` 직접 접근 |
| frida-core 통신 | TCP/pipe | abstract UNIX 소켓 역연결 |
| spawn gating | ptrace | SIGSTOP 시그널 |
| RASP 탐지 | 자식 프로세스에 흔적 남음 | 자식 프로세스에 흔적 없음 |
| Java bridge | 필수 의존 | 의존성 제거 |

---

## 5. CARF에서의 활용 전략

### 5.1 백엔드 (src-tauri, Rust)

CARF의 Tauri 백엔드는 `frida-rust` 크레이트를 통해 Frida와 통신한다.

```
┌─────────────────────────────────────────────────┐
│ CARF Tauri Backend (Rust)                       │
│                                                 │
│  DeviceManager → Device → Session → Script      │
│       │             │         │         │       │
│   enumerate()   attach()   create()   load()    │
│   add_remote()  spawn()              on_msg()   │
└─────────────────────────────────────────────────┘
```

- **frida-rust 0.17.x** 사용 (Frida 17.x 호환)
- `DeviceManager`: 로컬/USB/원격 디바이스 열거 및 관리
- `Device`: 프로세스 열거, attach/spawn
- `Session`: 스크립트 생성, detach 이벤트 처리
- `Script`: 에이전트 로드, 메시지 수신/발신

### 5.2 에이전트 (src-frida, TypeScript)

에이전트 스크립트는 TypeScript로 작성하고 `frida-compile`로 번들링한다.

```
src-frida/
├── index.ts              # 엔트리포인트 (RPC 라우터)
├── methods/              # RPC 메서드 구현
│   ├── native.ts         # Native 계측 (Interceptor, Module 등)
│   ├── java.ts           # Java 계측 (frida-java-bridge)
│   ├── objc.ts           # ObjC 계측 (frida-objc-bridge)
│   └── memory.ts         # 메모리 읽기/쓰기/스캔
└── rpc/                  # RPC 프로토콜 정의
```

**브릿지 임포트** (v17 필수):

```typescript
// src-frida/methods/java.ts
import { Java } from "frida-java-bridge";

export function enumerateLoadedClasses(): string[] {
  const classes: string[] = [];
  Java.perform(() => {
    Java.enumerateLoadedClasses({
      onMatch(name) { classes.push(name); },
      onComplete() { }
    });
  });
  return classes;
}
```

```typescript
// src-frida/methods/objc.ts
import { ObjC } from "frida-objc-bridge";

export function enumerateClasses(): string[] {
  return ObjC.enumerateLoadedClasses();
}
```

### 5.3 빌드 파이프라인

```bash
# 에이전트 컴파일
bun run compile:tools
# 내부적으로: frida-compile src-frida/index.ts -o src-tauri/resources/agent.js

# Tauri 개발 서버
bun run tauri dev
```

### 5.4 주의사항

1. **버전 일치**: frida-server 버전과 frida-rust 크레이트 버전이 반드시 일치해야 한다. 버전 불일치 시 세션 수립 실패 또는 예기치 않은 크래시가 발생한다.

2. **레거시 API 금지**: v17에서 제거된 API(`Memory.readU32()`, `Module.findBaseAddress()`, 콜백 기반 열거 등)는 사용하지 않는다. 에이전트 코드 작성 시 반드시 v17 API를 사용해야 한다.

3. **브릿지 명시적 import**: `Java`, `ObjC`, `Swift` 전역 객체는 자동으로 제공되지 않는다. `frida-java-bridge`, `frida-objc-bridge` 등을 `import`로 명시적으로 포함해야 한다.

4. **RustModule 고성능 콜백**: 성능이 중요한 콜백(Interceptor의 `onEnter`/`onLeave` 등)은 `CModule` 또는 `RustModule`로 구현하여 JavaScript 오버헤드를 제거할 수 있다.

5. **브라우저 환경 폴백**: CARF는 브라우저에서도 UI를 테스트할 수 있으므로, Tauri API 호출 시 반드시 `isTauri()` 체크 후 적절한 폴백을 제공해야 한다.
