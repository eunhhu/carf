# Process, Module, Thread API 레퍼런스

> Frida JavaScript API 중 프로세스 정보 조회, 모듈 탐색, 스레드 제어에 관한 완전한 레퍼런스.
> Frida 17.x 기준으로 작성되었으며, 16.x 이하에서 deprecated된 정적 메서드는 별도 표기한다.

---

## 목차

1. [Process API](#1-process-api)
   - 1.1 [프로퍼티](#11-프로퍼티)
   - 1.2 [디렉토리 정보](#12-디렉토리-정보)
   - 1.3 [디버거 감지](#13-디버거-감지)
   - 1.4 [스레드 관리](#14-스레드-관리)
   - 1.5 [모듈 탐색](#15-모듈-탐색)
   - 1.6 [메모리 범위 열거](#16-메모리-범위-열거)
   - 1.7 [예외 처리](#17-예외-처리)
2. [Module API](#2-module-api)
   - 2.1 [프로퍼티](#21-프로퍼티)
   - 2.2 [초기화](#22-초기화)
   - 2.3 [Import / Export 열거](#23-import--export-열거)
   - 2.4 [심볼 열거](#24-심볼-열거)
   - 2.5 [섹션 및 의존성](#25-섹션-및-의존성)
   - 2.6 [Export / Symbol 조회](#26-export--symbol-조회)
   - 2.7 [글로벌 Export 조회](#27-글로벌-export-조회)
   - 2.8 [동적 모듈 로드](#28-동적-모듈-로드)
   - 2.9 [ModuleMap](#29-modulemap)
3. [Thread API](#3-thread-api)
   - 3.1 [프로퍼티](#31-프로퍼티)
   - 3.2 [하드웨어 브레이크포인트](#32-하드웨어-브레이크포인트)
   - 3.3 [하드웨어 워치포인트](#33-하드웨어-워치포인트)
   - 3.4 [백트레이스](#34-백트레이스)
   - 3.5 [슬립](#35-슬립)
4. [실전 활용 패턴](#4-실전-활용-패턴)
   - 4.1 [모듈 로드 감시 후 후킹](#41-모듈-로드-감시-후-후킹)
   - 4.2 [메모리 보호 변경 후 패치](#42-메모리-보호-변경-후-패치)
   - 4.3 [스레드별 백트레이스 수집](#43-스레드별-백트레이스-수집)
   - 4.4 [하드웨어 워치포인트로 메모리 접근 감시](#44-하드웨어-워치포인트로-메모리-접근-감시)
   - 4.5 [프로세스 메모리 맵 덤프](#45-프로세스-메모리-맵-덤프)
   - 4.6 [특정 모듈의 함수 테이블 추출](#46-특정-모듈의-함수-테이블-추출)
   - 4.7 [ModuleMap을 활용한 고속 주소 분류](#47-modulemap을-활용한-고속-주소-분류)
   - 4.8 [스레드 옵저버를 활용한 안티디버깅 우회](#48-스레드-옵저버를-활용한-안티디버깅-우회)
5. [주의사항 및 트러블슈팅](#5-주의사항-및-트러블슈팅)

---

## 1. Process API

`Process` 객체는 Frida가 attach한 대상 프로세스에 대한 전역 정보를 제공한다.
별도의 인스턴스 생성 없이 글로벌 `Process`로 직접 접근한다.

### 1.1 프로퍼티

| 프로퍼티 | 타입 | 설명 |
|----------|------|------|
| `Process.id` | `number` | 프로세스 ID (PID) |
| `Process.arch` | `string` | CPU 아키텍처: `'ia32'`, `'x64'`, `'arm'`, `'arm64'` |
| `Process.platform` | `string` | OS 플랫폼: `'windows'`, `'darwin'`, `'linux'`, `'freebsd'`, `'qnx'`, `'barebone'` |
| `Process.pageSize` | `number` | 가상 메모리 페이지 크기 (바이트). 일반적으로 4096 |
| `Process.pointerSize` | `number` | 포인터 크기 (바이트). 32비트 = 4, 64비트 = 8 |
| `Process.codeSigningPolicy` | `string` | `'optional'` 또는 `'required'`. iOS 등 코드 서명이 필수인 환경에서 `'required'` 반환 |
| `Process.mainModule` | `Module` | 메인 실행 파일(바이너리)에 해당하는 Module 객체 |

```javascript
// 기본 프로세스 정보 출력
console.log(`PID: ${Process.id}`);
console.log(`Arch: ${Process.arch}`);        // 'arm64'
console.log(`Platform: ${Process.platform}`); // 'darwin'
console.log(`Page Size: ${Process.pageSize}`); // 16384 (Apple Silicon)
console.log(`Pointer Size: ${Process.pointerSize}`); // 8
console.log(`Code Signing: ${Process.codeSigningPolicy}`); // 'required' (iOS)
console.log(`Main Module: ${Process.mainModule.name}`); // 'target-app'
```

```javascript
// 아키텍처에 따른 조건 분기
if (Process.arch === 'arm64') {
    console.log('ARM64 환경 — ADRP/LDR 패턴 사용');
} else if (Process.arch === 'x64') {
    console.log('x64 환경 — RIP-relative 주소 계산 사용');
}
```

```javascript
// 코드 서명 정책에 따른 메모리 패치 전략
if (Process.codeSigningPolicy === 'required') {
    // iOS/tvOS: 직접 코드 패치 불가, Interceptor 사용 필수
    console.log('코드 서명 필수 — Interceptor.replace() 사용');
} else {
    // Android/Linux/macOS: Memory.patchCode()로 직접 패치 가능
    console.log('직접 패치 가능');
}
```

#### `Process.mainModule` 활용

메인 모듈은 ASLR 기반 주소 계산의 기준점이 된다.

```javascript
const main = Process.mainModule;
console.log(`Name: ${main.name}`);
console.log(`Base: ${main.base}`);   // ASLR 적용된 베이스 주소
console.log(`Size: ${main.size}`);
console.log(`Path: ${main.path}`);

// IDA/Ghidra 오프셋을 런타임 주소로 변환
const idaBase = ptr('0x100000000'); // IDA 기본 베이스
const idaOffset = ptr('0x100001234');
const runtime = main.base.add(idaOffset.sub(idaBase));
console.log(`Runtime address: ${runtime}`);
```

---

### 1.2 디렉토리 정보

| 메서드 | 반환 타입 | 설명 |
|--------|----------|------|
| `Process.getCurrentDir()` | `string` | 현재 작업 디렉토리 |
| `Process.getHomeDir()` | `string` | 사용자 홈 디렉토리 |
| `Process.getTmpDir()` | `string` | 임시 파일 디렉토리 |

```javascript
console.log(`CWD: ${Process.getCurrentDir()}`);   // '/data/data/com.target.app'
console.log(`Home: ${Process.getHomeDir()}`);      // '/root' 또는 '/var/mobile'
console.log(`Tmp: ${Process.getTmpDir()}`);        // '/tmp'

// 분석 결과를 임시 파일로 저장
const tmpDir = Process.getTmpDir();
const dumpPath = `${tmpDir}/carf-dump-${Process.id}.bin`;
```

---

### 1.3 디버거 감지

| 메서드 | 반환 타입 | 설명 |
|--------|----------|------|
| `Process.isDebuggerAttached()` | `boolean` | 네이티브 디버거(lldb, gdb 등) 연결 여부 |

```javascript
if (Process.isDebuggerAttached()) {
    console.log('[!] 디버거 감지됨');
} else {
    console.log('[*] 디버거 미연결');
}
```

```javascript
// 안티디버깅 우회: ptrace 후킹과 함께 사용
Interceptor.replace(
    Module.getGlobalExportByName('ptrace'),
    new NativeCallback(function (request, pid, addr, data) {
        // PT_DENY_ATTACH(31) 요청 무시
        if (request === 31) {
            console.log('[*] ptrace PT_DENY_ATTACH 우회');
            return 0;
        }
        return this.originalPtrace(request, pid, addr, data);
    }, 'int', ['int', 'int', 'pointer', 'pointer'])
);
```

---

### 1.4 스레드 관리

#### `Process.getCurrentThreadId()`

현재 실행 중인 스레드의 OS 스레드 ID를 반환한다.

```javascript
const tid = Process.getCurrentThreadId();
console.log(`현재 스레드 ID: ${tid}`);
```

#### `Process.enumerateThreads()`

프로세스의 모든 스레드 목록을 반환한다. 각 요소는 Thread 객체이다.

**반환 타입**: `Thread[]`

```javascript
const threads = Process.enumerateThreads();
console.log(`총 ${threads.length}개 스레드 발견`);

threads.forEach((thread) => {
    console.log(JSON.stringify({
        id: thread.id,
        name: thread.name,
        state: thread.state,
        pc: thread.context.pc,
        sp: thread.context.sp,
    }));
});
```

```javascript
// 특정 상태의 스레드만 필터링
const runningThreads = Process.enumerateThreads()
    .filter(t => t.state === 'running');
console.log(`실행 중인 스레드: ${runningThreads.length}개`);

const waitingThreads = Process.enumerateThreads()
    .filter(t => t.state === 'waiting');
console.log(`대기 중인 스레드: ${waitingThreads.length}개`);
```

#### `Process.attachThreadObserver(callbacks)`

스레드 생성/소멸/이름 변경을 실시간으로 모니터링한다.

**파라미터**: 콜백 객체
- `onAdded(thread: Thread)` — 스레드 생성 시 호출. 최초 attach 시 기존 스레드에 대해서도 한 번씩 호출됨.
- `onRemoved(thread: Thread)` — 스레드 종료 시 호출.
- `onRenamed(thread: Thread, previousName: string)` — 스레드 이름 변경 시 호출.

**반환 타입**: `Observer` (`.detach()` 메서드 보유)

```javascript
const observer = Process.attachThreadObserver({
    onAdded(thread) {
        console.log(`[+] 스레드 생성: id=${thread.id}, name=${thread.name}, state=${thread.state}`);

        if (thread.entrypoint) {
            console.log(`    entrypoint: ${thread.entrypoint.routine}`);
            const mod = Process.findModuleByAddress(thread.entrypoint.routine);
            if (mod) {
                const offset = thread.entrypoint.routine.sub(mod.base);
                console.log(`    → ${mod.name}+${offset}`);
            }
        }
    },
    onRemoved(thread) {
        console.log(`[-] 스레드 종료: id=${thread.id}, name=${thread.name}`);
    },
    onRenamed(thread, previousName) {
        console.log(`[~] 스레드 이름 변경: id=${thread.id}, "${previousName}" → "${thread.name}"`);
    }
});

// 옵저버 해제
// observer.detach();
```

#### `Process.runOnThread(threadId, callback)`

특정 스레드의 컨텍스트에서 JavaScript 함수를 실행한다. `Promise`를 반환하며, 콜백의 반환값으로 resolve된다.

**파라미터**:
- `threadId: number` — 대상 스레드 ID
- `callback: () => any` — 해당 스레드에서 실행할 함수

**반환 타입**: `Promise<any>`

> **경고**: 대상 스레드가 non-reentrant 코드(예: malloc 내부, 커널 시스템 콜 대기 등)를 실행 중일 때 호출하면 데드락이나 크래시가 발생할 수 있다.

```javascript
// 메인 스레드에서 특정 함수 호출
const mainThread = Process.enumerateThreads()[0];

Process.runOnThread(mainThread.id, () => {
    console.log(`[*] 스레드 ${Process.getCurrentThreadId()}에서 실행 중`);
    return 42;
}).then((result) => {
    console.log(`결과: ${result}`); // 42
});
```

```javascript
// 모든 스레드에서 TLS 값 읽기
async function readTlsFromAllThreads(tlsAddr) {
    const threads = Process.enumerateThreads();

    for (const thread of threads) {
        try {
            const value = await Process.runOnThread(thread.id, () => {
                return Memory.readPointer(tlsAddr);
            });
            console.log(`Thread ${thread.id}: TLS = ${value}`);
        } catch (e) {
            console.log(`Thread ${thread.id}: 접근 실패 — ${e.message}`);
        }
    }
}
```

---

### 1.5 모듈 탐색

#### 주소 기반 조회

| 메서드 | 반환 타입 | 실패 시 |
|--------|----------|---------|
| `Process.findModuleByAddress(address)` | `Module \| null` | `null` 반환 |
| `Process.getModuleByAddress(address)` | `Module` | 예외 throw |

```javascript
const addr = ptr('0x7fff12345678');

// find — null 반환 (안전)
const mod1 = Process.findModuleByAddress(addr);
if (mod1 !== null) {
    console.log(`${addr} → ${mod1.name}+${addr.sub(mod1.base)}`);
} else {
    console.log(`${addr}: 모듈에 속하지 않는 주소`);
}

// get — 예외 throw (확신이 있을 때)
try {
    const mod2 = Process.getModuleByAddress(addr);
    console.log(`모듈: ${mod2.name}`);
} catch (e) {
    console.log(`주소 조회 실패: ${e.message}`);
}
```

#### 이름 기반 조회

| 메서드 | 반환 타입 | 실패 시 |
|--------|----------|---------|
| `Process.findModuleByName(name)` | `Module \| null` | `null` 반환 |
| `Process.getModuleByName(name)` | `Module` | 예외 throw |

```javascript
// 라이브러리 이름으로 조회
const libc = Process.findModuleByName('libc.so');
if (libc) {
    console.log(`libc base: ${libc.base}, size: ${libc.size}`);
}

// iOS 시스템 프레임워크 조회
const foundation = Process.findModuleByName('Foundation');
if (foundation) {
    console.log(`Foundation: ${foundation.path}`);
    // /System/Library/Frameworks/Foundation.framework/Foundation
}

// Android에서 앱 네이티브 라이브러리 조회
const nativeLib = Process.findModuleByName('libnative-lib.so');
if (nativeLib) {
    const jniOnLoad = nativeLib.findExportByName('JNI_OnLoad');
    if (jniOnLoad) {
        console.log(`JNI_OnLoad: ${jniOnLoad}`);
    }
}
```

#### `Process.enumerateModules()`

로드된 모든 모듈을 열거한다.

**반환 타입**: `Module[]`

```javascript
const modules = Process.enumerateModules();
console.log(`로드된 모듈: ${modules.length}개`);

// 테이블 형태로 출력
modules.forEach((m) => {
    const sizeKB = (m.size / 1024).toFixed(1);
    console.log(`  ${m.base}  ${sizeKB.padStart(8)}KB  ${m.name}`);
});
```

```javascript
// 특정 패턴으로 모듈 필터링
const appModules = Process.enumerateModules()
    .filter(m => m.path.includes('/data/app/'));
console.log(`앱 모듈: ${appModules.map(m => m.name).join(', ')}`);

// 가장 큰 모듈 찾기
const largest = Process.enumerateModules()
    .sort((a, b) => b.size - a.size)[0];
console.log(`가장 큰 모듈: ${largest.name} (${(largest.size / 1024 / 1024).toFixed(2)}MB)`);
```

#### `Process.attachModuleObserver(callbacks)`

모듈 로드/언로드를 실시간으로 감시한다. `dlopen()` 후킹 대비 안정적이고 확실한 방법이다.

**콜백**:
- `onAdded(module: Module)` — 모듈 로드 시 호출
- `onRemoved(module: Module)` — 모듈 언로드 시 호출

**반환 타입**: `Observer` (`.detach()` 메서드 보유)

```javascript
const moduleObserver = Process.attachModuleObserver({
    onAdded(module) {
        console.log(`[+] 모듈 로드: ${module.name}`);
        console.log(`    Base: ${module.base}`);
        console.log(`    Size: ${module.size}`);
        console.log(`    Path: ${module.path}`);
    },
    onRemoved(module) {
        console.log(`[-] 모듈 언로드: ${module.name}`);
    }
});
```

```javascript
// 지연 로딩 라이브러리 후킹 (가장 흔한 활용 패턴)
function hookWhenLoaded(moduleName, setupHooks) {
    // 이미 로드되어 있으면 즉시 후킹
    const existing = Process.findModuleByName(moduleName);
    if (existing) {
        console.log(`[*] ${moduleName} 이미 로드됨 — 즉시 후킹`);
        setupHooks(existing);
        return;
    }

    // 아직 로드되지 않았으면 옵저버로 대기
    console.log(`[*] ${moduleName} 로드 대기 중...`);
    const obs = Process.attachModuleObserver({
        onAdded(module) {
            if (module.name === moduleName) {
                console.log(`[*] ${moduleName} 로드 감지 — 후킹 시작`);
                setupHooks(module);
                obs.detach(); // 옵저버 해제
            }
        },
        onRemoved(module) {}
    });
}

// 사용 예시
hookWhenLoaded('libssl.so', (mod) => {
    const SSL_read = mod.getExportByName('SSL_read');
    Interceptor.attach(SSL_read, {
        onEnter(args) {
            this.buf = args[1];
            this.size = args[2].toInt32();
        },
        onLeave(retval) {
            const bytesRead = retval.toInt32();
            if (bytesRead > 0) {
                console.log(`SSL_read: ${bytesRead} bytes`);
                console.log(hexdump(this.buf, { length: Math.min(bytesRead, 256) }));
            }
        }
    });
});
```

---

### 1.6 메모리 범위 열거

#### 주소 기반 범위 조회

| 메서드 | 반환 타입 | 실패 시 |
|--------|----------|---------|
| `Process.findRangeByAddress(address)` | `Range \| null` | `null` 반환 |
| `Process.getRangeByAddress(address)` | `Range` | 예외 throw |

**Range 객체 구조**:

| 필드 | 타입 | 설명 |
|------|------|------|
| `base` | `NativePointer` | 범위 시작 주소 |
| `size` | `number` | 범위 크기 (바이트) |
| `protection` | `string` | 보호 속성: `'rwx'`, `'r-x'`, `'rw-'`, `'r--'`, `'---'` 등 |
| `file` | `object \| undefined` | 파일 매핑 정보 (있는 경우) |
| `file.path` | `string` | 매핑된 파일 경로 |
| `file.offset` | `number` | 파일 내 오프셋 |
| `file.size` | `number` | 매핑 크기 |

```javascript
const addr = ptr('0x7fff12345000');
const range = Process.findRangeByAddress(addr);
if (range) {
    console.log(`Base: ${range.base}`);
    console.log(`Size: ${range.size}`);
    console.log(`Protection: ${range.protection}`);
    if (range.file) {
        console.log(`File: ${range.file.path} (offset: ${range.file.offset})`);
    }
}
```

#### `Process.enumerateRanges(protection | specifier)`

메모리 보호 속성으로 필터링하여 범위를 열거한다.

**파라미터**:
- 문자열: `'rwx'`, `'r-x'`, `'rw-'`, `'r--'` 등 — 최소 보호 속성 필터
- 또는 specifier 객체: `{ protection: string, coalesce: boolean }`

**protection 문자열 의미**:
- `'rwx'` — 읽기+쓰기+실행이 **모두** 가능한 범위
- `'r-x'` — 읽기+실행이 가능한 범위 (쓰기는 상관없음)
- `'rw-'` — 읽기+쓰기가 가능한 범위 (실행은 상관없음)
- `'r--'` — 최소 읽기 가능한 모든 범위

**coalesce 옵션**:
- `true` — 인접한 동일 보호 속성의 범위를 하나로 병합
- `false` (기본) — 각 범위를 개별적으로 반환

```javascript
// 실행 가능한 모든 메모리 범위
const execRanges = Process.enumerateRanges('r-x');
console.log(`실행 가능 범위: ${execRanges.length}개`);
execRanges.forEach((r) => {
    console.log(`  ${r.base}-${r.base.add(r.size)}  ${r.protection}  ${r.file ? r.file.path : '(anonymous)'}`);
});
```

```javascript
// RWX 범위 탐지 (보안 분석 / 패커 감지)
const rwxRanges = Process.enumerateRanges('rwx');
if (rwxRanges.length > 0) {
    console.log(`[!] RWX 범위 ${rwxRanges.length}개 발견 — JIT 또는 패커 가능성`);
    rwxRanges.forEach((r) => {
        console.log(`  ${r.base}  size=${r.size}  ${r.file ? r.file.path : 'anonymous'}`);
    });
}
```

```javascript
// coalesce 옵션으로 범위 병합
const coalesced = Process.enumerateRanges({ protection: 'rw-', coalesce: true });
const individual = Process.enumerateRanges({ protection: 'rw-', coalesce: false });
console.log(`병합: ${coalesced.length}개 / 개별: ${individual.length}개`);
```

```javascript
// 특정 모듈의 쓰기 가능 범위만 찾기
const targetMod = Process.getModuleByName('libtarget.so');
const modEnd = targetMod.base.add(targetMod.size);

const writableInTarget = Process.enumerateRanges('rw-').filter((r) => {
    return r.base.compare(targetMod.base) >= 0 && r.base.compare(modEnd) < 0;
});
console.log(`${targetMod.name} 내 쓰기 가능 범위: ${writableInTarget.length}개`);
```

#### `Process.enumerateMallocRanges()`

시스템 힙 할당자(malloc)가 관리하는 범위를 열거한다.

**반환 타입**: `Range[]` (enumerateRanges와 동일한 구조)

> **참고**: 시스템 힙에 알려진 할당만 반환한다. 커스텀 할당자(jemalloc의 일부 모드 등)의 범위는 포함되지 않을 수 있다.

```javascript
const mallocRanges = Process.enumerateMallocRanges();
console.log(`힙 범위: ${mallocRanges.length}개`);

let totalHeap = 0;
mallocRanges.forEach((r) => {
    totalHeap += r.size;
});
console.log(`총 힙 크기: ${(totalHeap / 1024 / 1024).toFixed(2)}MB`);
```

---

### 1.7 예외 처리

#### `Process.setExceptionHandler(callback)`

프로세스 전역 네이티브 예외 핸들러를 설치한다. 하드웨어 브레이크포인트/워치포인트와 함께 사용하는 것이 일반적이다.

**파라미터**: `callback(details: ExceptionDetails) => boolean | void`

**ExceptionDetails 구조**:

| 필드 | 타입 | 설명 |
|------|------|------|
| `type` | `string` | 예외 종류 (아래 표 참조) |
| `address` | `NativePointer` | 예외 발생 주소 |
| `memory` | `object \| undefined` | 메모리 접근 예외의 경우 추가 정보 |
| `memory.operation` | `string` | `'read'`, `'write'`, `'execute'` |
| `memory.address` | `NativePointer` | 접근 대상 메모리 주소 |
| `context` | `object` | CPU 레지스터 컨텍스트 (`pc`, `sp` 등). **값을 변경하면 복귀 시 반영됨** |
| `nativeContext` | `NativePointer` | OS/아키텍처별 네이티브 컨텍스트 구조체 포인터 |

**예외 타입 (`type` 값)**:

| 값 | 설명 |
|----|------|
| `'abort'` | 프로세스 중단 시그널 |
| `'access-violation'` | 잘못된 메모리 접근 (SIGSEGV/SIGBUS) |
| `'guard-page'` | 가드 페이지 접근 |
| `'illegal-instruction'` | 잘못된 명령어 |
| `'stack-overflow'` | 스택 오버플로우 |
| `'arithmetic'` | 산술 오류 (0으로 나누기 등) |
| `'breakpoint'` | 소프트웨어/하드웨어 브레이크포인트 |
| `'single-step'` | 싱글 스텝 실행 |
| `'system'` | 시스템 예외 |

**반환값**:
- `true` 반환 — 예외가 처리됨. 시스템 핸들러로 전달하지 않음.
- `false` 또는 미반환 — 예외를 시스템 기본 핸들러로 전달.

```javascript
// 기본적인 예외 핸들러
Process.setExceptionHandler((details) => {
    console.log(`[!] 예외 발생: ${details.type}`);
    console.log(`    주소: ${details.address}`);
    console.log(`    PC: ${details.context.pc}`);
    console.log(`    SP: ${details.context.sp}`);

    if (details.memory) {
        console.log(`    메모리 ${details.memory.operation}: ${details.memory.address}`);
    }

    // 백트레이스 출력
    const bt = Thread.backtrace(details.context, Backtracer.ACCURATE);
    console.log(`    백트레이스:`);
    bt.forEach((frame) => {
        const mod = Process.findModuleByAddress(frame);
        if (mod) {
            console.log(`      ${frame} — ${mod.name}+${frame.sub(mod.base)}`);
        } else {
            console.log(`      ${frame}`);
        }
    });

    return false; // 시스템 핸들러로 전달
});
```

```javascript
// 하드웨어 브레이크포인트와 함께 사용
Process.setExceptionHandler((details) => {
    if (details.type === 'breakpoint') {
        console.log(`[BP] Hit at ${details.address}`);

        // PC를 다음 명령어로 이동 (ARM64: 4바이트)
        if (Process.arch === 'arm64') {
            details.context.pc = details.address.add(4);
        }
        return true; // 예외 처리됨
    }
    return false;
});

// 특정 주소에 하드웨어 브레이크포인트 설정
const targetAddr = Module.getGlobalExportByName('open');
const threads = Process.enumerateThreads();
threads[0].setHardwareBreakpoint(0, targetAddr);
```

---

## 2. Module API

`Module` 객체는 로드된 공유 라이브러리 또는 실행 파일 하나를 나타낸다.
`Process.findModuleByName()`, `Process.enumerateModules()` 등을 통해 획득한다.

### 2.1 프로퍼티

| 프로퍼티 | 타입 | 설명 |
|----------|------|------|
| `name` | `string` | 모듈의 정식 이름 (예: `'libc.so'`, `'Foundation'`) |
| `base` | `NativePointer` | 모듈 메모리 베이스 주소 |
| `size` | `number` | 모듈 크기 (바이트) |
| `path` | `string` | 파일 시스템 전체 경로 |

```javascript
const mod = Process.getModuleByName('libc.so');
console.log(`Name: ${mod.name}`);     // 'libc.so'
console.log(`Base: ${mod.base}`);     // '0x7f8a12340000'
console.log(`Size: ${mod.size}`);     // 1048576
console.log(`Path: ${mod.path}`);     // '/apex/com.android.runtime/lib64/bionic/libc.so'

// 주소가 모듈 범위 내인지 확인
function isInModule(address, module) {
    return address.compare(module.base) >= 0
        && address.compare(module.base.add(module.size)) < 0;
}
```

---

### 2.2 초기화

#### `module.ensureInitialized()`

모듈의 초기화 루틴(constructor, +load 등)이 완료되었음을 보장한다. 모듈이 로드된 직후 내부 초기화가 아직 끝나지 않은 상태에서 후킹하면 크래시가 발생할 수 있으므로, 이 메서드를 먼저 호출한다.

**반환 타입**: `void`

```javascript
Process.attachModuleObserver({
    onAdded(module) {
        if (module.name === 'libtarget.so') {
            // 초기화 완료 보장 후 후킹
            module.ensureInitialized();

            const func = module.getExportByName('target_function');
            Interceptor.attach(func, {
                onEnter(args) {
                    console.log('target_function 호출됨');
                }
            });
        }
    },
    onRemoved() {}
});
```

```javascript
// ObjC 클래스 접근 전 프레임워크 초기화 보장 (iOS)
const uikit = Process.getModuleByName('UIKit');
uikit.ensureInitialized();
// 이후 ObjC.classes.UIView 등 접근 가능
```

---

### 2.3 Import / Export 열거

#### `module.enumerateImports()`

모듈이 다른 모듈에서 가져오는 심볼(import) 목록을 반환한다.

**반환 타입**: `ImportInfo[]`

| 필드 | 타입 | 설명 |
|------|------|------|
| `type` | `string` | `'function'` 또는 `'variable'` |
| `name` | `string` | import 이름 |
| `module` | `string \| undefined` | 원본 모듈 이름 |
| `address` | `NativePointer \| undefined` | 해석된 절대 주소 |
| `slot` | `NativePointer \| undefined` | GOT/IAT 슬롯 주소 (import 테이블 내 저장 위치) |

```javascript
const mod = Process.getModuleByName('libtarget.so');
const imports = mod.enumerateImports();

console.log(`${mod.name}의 import: ${imports.length}개`);
imports.forEach((imp) => {
    console.log(`  [${imp.type}] ${imp.name} from ${imp.module || '?'} @ ${imp.address}`);
});
```

```javascript
// 특정 함수의 GOT 슬롯 찾기 (GOT hooking용)
function findGotSlot(moduleName, functionName) {
    const mod = Process.getModuleByName(moduleName);
    const imp = mod.enumerateImports().find(i => i.name === functionName);
    if (imp && imp.slot) {
        console.log(`${functionName} GOT slot: ${imp.slot}`);
        console.log(`현재 값: ${Memory.readPointer(imp.slot)}`);
        return imp.slot;
    }
    return null;
}

// GOT hooking 예시
const gotSlot = findGotSlot('libtarget.so', 'strcmp');
if (gotSlot) {
    const original = Memory.readPointer(gotSlot);
    const hook = new NativeCallback(function (s1, s2) {
        const str1 = s1.readUtf8String();
        const str2 = s2.readUtf8String();
        console.log(`strcmp("${str1}", "${str2}")`);
        return new NativeFunction(original, 'int', ['pointer', 'pointer'])(s1, s2);
    }, 'int', ['pointer', 'pointer']);
    Memory.writePointer(gotSlot, hook);
}
```

#### `module.enumerateExports()`

모듈이 외부에 공개하는 심볼(export) 목록을 반환한다.

**반환 타입**: `ExportInfo[]`

| 필드 | 타입 | 설명 |
|------|------|------|
| `type` | `string` | `'function'` 또는 `'variable'` |
| `name` | `string` | export 이름 |
| `address` | `NativePointer` | 절대 주소 |

```javascript
const libc = Process.getModuleByName('libc.so');
const exports = libc.enumerateExports();
console.log(`libc exports: ${exports.length}개`);

// 함수 export만 필터
const functions = exports.filter(e => e.type === 'function');
console.log(`함수: ${functions.length}개`);

// 'open'으로 시작하는 export
const openFuncs = exports.filter(e => e.name.startsWith('open'));
openFuncs.forEach(e => console.log(`  ${e.name} @ ${e.address}`));
```

```javascript
// 모듈의 모든 export를 JSON으로 덤프
function dumpExports(moduleName) {
    const mod = Process.getModuleByName(moduleName);
    const exports = mod.enumerateExports();

    const result = exports.map(e => ({
        name: e.name,
        type: e.type,
        offset: `0x${e.address.sub(mod.base).toString(16)}`
    }));

    send({ type: 'exports', module: moduleName, data: result });
}
```

---

### 2.4 심볼 열거

#### `module.enumerateSymbols()`

모듈의 심볼 테이블 전체를 열거한다. `enumerateExports()`보다 더 많은 심볼(비공개 심볼 포함)을 반환한다.

**지원 플랫폼**: macOS/iOS (Mach-O), Linux/Android (ELF). Windows에서는 export만 반환.

**반환 타입**: `SymbolInfo[]`

| 필드 | 타입 | 설명 |
|------|------|------|
| `isGlobal` | `boolean` | 전역 심볼 여부 |
| `type` | `string` | 심볼 타입 (아래 참조) |
| `section` | `object` | `{ id: string, protection: string }` |
| `name` | `string` | 심볼 이름 |
| `address` | `NativePointer` | 절대 주소 |
| `size` | `number \| undefined` | 심볼 크기 (바이트, 알 수 있는 경우) |

**심볼 타입 (Mach-O)**:
`'unknown'`, `'section'`, `'undefined'`, `'absolute'`, `'prebound-undefined'`, `'indirect'`

**심볼 타입 (ELF)**:
`'unknown'`, `'object'`, `'function'`, `'section'`, `'file'`, `'common'`, `'tls'`

```javascript
const mod = Process.getModuleByName('libtarget.so');
const symbols = mod.enumerateSymbols();
console.log(`심볼 수: ${symbols.length}`);

// 함수 심볼만 필터
const funcSymbols = symbols.filter(s => s.type === 'function');
console.log(`함수 심볼: ${funcSymbols.length}개`);

// 비공개(로컬) 함수 심볼 찾기 — export에는 없지만 심볼 테이블에 있는 것들
funcSymbols
    .filter(s => !s.isGlobal)
    .forEach(s => {
        console.log(`  [local] ${s.name} @ ${s.address} (size: ${s.size || '?'})`);
    });
```

```javascript
// strip되지 않은 바이너리에서 내부 함수 후킹
function hookInternalFunction(moduleName, symbolName) {
    const mod = Process.getModuleByName(moduleName);
    const sym = mod.enumerateSymbols().find(s => s.name === symbolName);

    if (!sym) {
        console.log(`심볼 '${symbolName}' 없음 (stripped?)`);
        return null;
    }

    console.log(`${symbolName} @ ${sym.address} (global: ${sym.isGlobal})`);
    return Interceptor.attach(sym.address, {
        onEnter(args) {
            console.log(`${symbolName} 호출됨`);
        }
    });
}
```

```javascript
// C++ 맹글링된 심볼 검색
const cppSymbols = mod.enumerateSymbols()
    .filter(s => s.name.startsWith('_Z'))  // Itanium ABI 맹글링 접두사
    .map(s => ({
        mangled: s.name,
        demangled: DebugSymbol.fromAddress(s.address).name || s.name,
        address: s.address
    }));

cppSymbols.forEach(s => {
    console.log(`  ${s.demangled} (${s.mangled}) @ ${s.address}`);
});
```

---

### 2.5 섹션 및 의존성

#### `module.enumerateSections()`

모듈의 섹션 정보를 열거한다.

**반환 타입**: `SectionInfo[]`

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `string` | 섹션 ID (r2 스타일, 예: `'0.text'`) |
| `name` | `string` | 섹션 이름 (예: `'.text'`, `'.rodata'`) |
| `address` | `NativePointer` | 섹션 시작 주소 |
| `size` | `number` | 섹션 크기 (바이트) |

```javascript
const mod = Process.getModuleByName('libtarget.so');
const sections = mod.enumerateSections();

sections.forEach((sec) => {
    console.log(`  ${sec.name.padEnd(20)} ${sec.address}  size=${sec.size}`);
});

// .rodata 섹션에서 문자열 검색
const rodata = sections.find(s => s.name === '.rodata');
if (rodata) {
    console.log(`rodata: ${rodata.address} ~ ${rodata.address.add(rodata.size)}`);
    // Memory.scanSync로 패턴 검색 가능
}
```

#### `module.enumerateDependencies()`

모듈이 의존하는 다른 모듈 목록을 반환한다.

**반환 타입**: `DependencyInfo[]`

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | `string` | 의존 모듈 이름 |
| `type` | `string` | 의존 유형: `'regular'`, `'weak'`, `'reexport'`, `'upward'` |

```javascript
const mod = Process.getModuleByName('libtarget.so');
const deps = mod.enumerateDependencies();

console.log(`${mod.name}의 의존성:`);
deps.forEach((dep) => {
    console.log(`  [${dep.type}] ${dep.name}`);
});
```

```javascript
// 의존성 트리 재귀적으로 탐색
function buildDependencyTree(moduleName, visited = new Set()) {
    if (visited.has(moduleName)) return null;
    visited.add(moduleName);

    const mod = Process.findModuleByName(moduleName);
    if (!mod) return { name: moduleName, loaded: false, deps: [] };

    const deps = mod.enumerateDependencies();
    return {
        name: moduleName,
        loaded: true,
        deps: deps.map(d => buildDependencyTree(d.name, visited)).filter(Boolean)
    };
}

const tree = buildDependencyTree('libtarget.so');
send({ type: 'dependency-tree', data: tree });
```

---

### 2.6 Export / Symbol 조회

단일 export/symbol을 이름으로 직접 조회한다. `enumerateExports()`/`enumerateSymbols()`보다 훨씬 빠르다.

| 메서드 | 반환 타입 | 실패 시 |
|--------|----------|---------|
| `module.findExportByName(name)` | `NativePointer \| null` | `null` 반환 |
| `module.getExportByName(name)` | `NativePointer` | 예외 throw |
| `module.findSymbolByName(name)` | `NativePointer \| null` | `null` 반환 |
| `module.getSymbolByName(name)` | `NativePointer` | 예외 throw |

```javascript
const libc = Process.getModuleByName('libc.so');

// Export 조회 (공개 API)
const openAddr = libc.findExportByName('open');
console.log(`open: ${openAddr}`);  // NativePointer 또는 null

const mallocAddr = libc.getExportByName('malloc');  // 없으면 throw
console.log(`malloc: ${mallocAddr}`);

// Symbol 조회 (비공개 심볼 포함)
const internalFunc = libc.findSymbolByName('__libc_init');
if (internalFunc) {
    console.log(`__libc_init: ${internalFunc}`);
}
```

```javascript
// 여러 함수를 한번에 조회하는 유틸리티
function resolveExports(moduleName, functionNames) {
    const mod = Process.getModuleByName(moduleName);
    const resolved = {};

    for (const name of functionNames) {
        const addr = mod.findExportByName(name);
        if (addr) {
            resolved[name] = addr;
        } else {
            console.warn(`[!] ${moduleName}!${name} not found`);
        }
    }

    return resolved;
}

const libcFuncs = resolveExports('libc.so', [
    'open', 'close', 'read', 'write',
    'malloc', 'free', 'mmap', 'mprotect'
]);
```

---

### 2.7 글로벌 Export 조회

#### `Module.findGlobalExportByName(name)` / `Module.getGlobalExportByName(name)`

**모든 로드된 모듈**에서 해당 이름의 export를 검색한다. 모듈 이름을 모를 때 유용하지만, 전체 모듈을 순회하므로 비용이 크다.

| 메서드 | 반환 타입 | 실패 시 |
|--------|----------|---------|
| `Module.findGlobalExportByName(name)` | `NativePointer \| null` | `null` 반환 |
| `Module.getGlobalExportByName(name)` | `NativePointer` | 예외 throw |

> **Frida 17.0+**: `Module.findExportByName(null, name)` 정적 메서드가 제거됨. 대신 `Module.findGlobalExportByName(name)` 또는 인스턴스의 `module.findExportByName(name)` 사용 필수.

```javascript
// 모듈을 모를 때 전역 검색
const sslRead = Module.findGlobalExportByName('SSL_read');
if (sslRead) {
    const mod = Process.findModuleByAddress(sslRead);
    console.log(`SSL_read: ${sslRead} (${mod ? mod.name : 'unknown'})`);
}
```

```javascript
// Frida 16.x → 17.x 마이그레이션 예시
// 구버전 (16.x, deprecated):
// Module.findExportByName(null, 'open')  // 정적 메서드에 null 전달

// 신버전 (17.x):
Module.findGlobalExportByName('open')     // 전용 글로벌 검색 메서드
// 또는
Process.getModuleByName('libc.so').findExportByName('open')  // 인스턴스 메서드
```

---

### 2.8 동적 모듈 로드

#### `Module.load(path)`

파일 시스템에서 공유 라이브러리를 동적으로 로드한다.

**파라미터**: `path: string` — 모듈 파일 경로
**반환 타입**: `Module` — 로드된 모듈 객체
**실패 시**: 예외 throw

```javascript
// 커스텀 라이브러리 로드
try {
    const myLib = Module.load('/data/local/tmp/libpayload.so');
    console.log(`로드 성공: ${myLib.name} @ ${myLib.base}`);

    const init = myLib.findExportByName('payload_init');
    if (init) {
        new NativeFunction(init, 'int', [])();
        console.log('payload_init() 호출 완료');
    }
} catch (e) {
    console.log(`로드 실패: ${e.message}`);
}
```

```javascript
// frida-gadget을 통한 모듈 주입 후 초기화
const gadget = Module.load('/tmp/frida-agent.so');
gadget.ensureInitialized();
const setup = new NativeFunction(gadget.getExportByName('agent_setup'), 'void', []);
setup();
```

---

### 2.9 ModuleMap

`ModuleMap`은 주소-모듈 매핑을 캐싱하여 고속 조회를 제공한다. `Process.findModuleByAddress()`를 반복 호출하는 것보다 훨씬 빠르다.

#### 생성자

```javascript
new ModuleMap([filter])
```

- `filter` (선택): `(module: Module) => boolean` — `true`를 반환하는 모듈만 포함
- 생성 시점의 모듈 상태를 스냅샷으로 저장. 이후 변경은 `update()` 호출 필요

#### 메서드

| 메서드 | 반환 타입 | 설명 |
|--------|----------|------|
| `has(address)` | `boolean` | 주소가 맵에 포함된 모듈 범위 내인지 확인 |
| `find(address)` | `Module \| null` | 주소에 해당하는 모듈 반환 |
| `get(address)` | `Module` | 주소에 해당하는 모듈 반환 (없으면 throw) |
| `findName(address)` | `string \| null` | 주소에 해당하는 모듈 이름 반환 |
| `getName(address)` | `string` | 주소에 해당하는 모듈 이름 반환 (없으면 throw) |
| `findPath(address)` | `string \| null` | 주소에 해당하는 모듈 경로 반환 |
| `getPath(address)` | `string` | 주소에 해당하는 모듈 경로 반환 (없으면 throw) |
| `update()` | `void` | 모듈 맵을 현재 상태로 갱신 |
| `values()` | `Module[]` | 맵에 포함된 모든 모듈 배열 복사본 반환 |

```javascript
// 전체 모듈 맵
const allModules = new ModuleMap();

// 주소 조회
const addr = ptr('0x7fff12345678');
if (allModules.has(addr)) {
    console.log(`${addr} → ${allModules.findName(addr)}`);
} else {
    console.log(`${addr}: 모듈 외부 (힙, 스택, anonymous 등)`);
}
```

```javascript
// 필터를 사용한 앱 모듈만 포함하는 맵
const appModuleMap = new ModuleMap((module) => {
    return module.path.includes('/data/app/')      // Android 앱 라이브러리
        || module.path.includes('/data/data/');     // 앱 데이터 디렉토리
});

console.log(`앱 모듈 수: ${appModuleMap.values().length}`);
```

```javascript
// Stalker/Interceptor에서 고속 주소 분류
const moduleMap = new ModuleMap();

Interceptor.attach(targetFunc, {
    onEnter(args) {
        // 반환 주소로 caller 모듈 식별
        const retAddr = this.returnAddress;
        const callerModule = moduleMap.findName(retAddr);
        console.log(`호출자: ${callerModule || 'unknown'}`);
    }
});
```

```javascript
// 주기적으로 맵 갱신 (dlopen이 빈번한 경우)
const dynamicMap = new ModuleMap();

setInterval(() => {
    dynamicMap.update();
}, 5000); // 5초마다 갱신

// 또는 모듈 옵저버와 연동
const mapObserver = Process.attachModuleObserver({
    onAdded(module) {
        dynamicMap.update();
        console.log(`맵 갱신: ${module.name} 추가됨 (총 ${dynamicMap.values().length}개)`);
    },
    onRemoved(module) {
        dynamicMap.update();
    }
});
```

```javascript
// 시스템 모듈만 제외하는 맵 (앱 분석용)
const nonSystemMap = new ModuleMap((m) => {
    const systemPaths = ['/system/', '/apex/', '/vendor/', '/lib/', '/usr/lib/'];
    return !systemPaths.some(p => m.path.startsWith(p));
});

console.log('비시스템 모듈:');
nonSystemMap.values().forEach(m => {
    console.log(`  ${m.name} — ${m.path}`);
});
```

---

## 3. Thread API

`Thread` 객체는 프로세스 내의 개별 스레드를 나타낸다.
`Process.enumerateThreads()` 또는 스레드 옵저버 콜백을 통해 획득한다.

### 3.1 프로퍼티

| 프로퍼티 | 타입 | 설명 |
|----------|------|------|
| `id` | `number` | OS 스레드 ID (TID) |
| `name` | `string \| null` | 스레드 이름. 이름이 설정되지 않은 경우 `null` |
| `state` | `string` | 스레드 상태 (아래 표 참조) |
| `context` | `object` | CPU 레지스터 스냅샷 |
| `entrypoint` | `object \| undefined` | 스레드 시작 정보 (알 수 있는 경우) |

**스레드 상태 (`state` 값)**:

| 값 | 설명 |
|----|------|
| `'running'` | 현재 CPU에서 실행 중 |
| `'stopped'` | 시그널에 의해 중지됨 |
| `'waiting'` | 대기 중 (sleep, I/O, lock 등) |
| `'uninterruptible'` | 인터럽트 불가 대기 (커널 I/O 등) |
| `'halted'` | 종료됨 |

**context 객체**:

공통 키: `pc` (Program Counter), `sp` (Stack Pointer)

아키텍처별 추가 키:

| 아키텍처 | 추가 레지스터 |
|----------|-------------|
| `ia32` | `eax`, `ecx`, `edx`, `ebx`, `esp`, `ebp`, `esi`, `edi`, `eip` |
| `x64` | `rax`, `rcx`, `rdx`, `rbx`, `rsp`, `rbp`, `rsi`, `rdi`, `r8`~`r15`, `rip` |
| `arm` | `r0`~`r12`, `sp`, `lr`, `pc`, `cpsr` |
| `arm64` | `x0`~`x28`, `fp`, `lr`, `sp`, `pc`, `nzcv` |

> **중요**: context 값은 **쓰기 가능**하다. 예외 핸들러 내에서 context 값을 변경하면 복귀 시 해당 레지스터에 반영된다.

**entrypoint 객체**:

| 필드 | 타입 | 설명 |
|------|------|------|
| `routine` | `NativePointer` | 스레드 시작 함수 주소 |
| `parameter` | `NativePointer \| undefined` | 시작 함수에 전달된 파라미터 |

```javascript
const threads = Process.enumerateThreads();

threads.forEach((t) => {
    console.log(`--- Thread ${t.id} ---`);
    console.log(`  Name: ${t.name || '(unnamed)'}`);
    console.log(`  State: ${t.state}`);
    console.log(`  PC: ${t.context.pc}`);
    console.log(`  SP: ${t.context.sp}`);

    if (Process.arch === 'arm64') {
        console.log(`  LR: ${t.context.lr}`);
        console.log(`  FP: ${t.context.fp}`);
        console.log(`  x0: ${t.context.x0}`);
    }

    if (t.entrypoint) {
        console.log(`  Entry routine: ${t.entrypoint.routine}`);
        const mod = Process.findModuleByAddress(t.entrypoint.routine);
        if (mod) {
            console.log(`  Entry module: ${mod.name}+${t.entrypoint.routine.sub(mod.base)}`);
        }
    }
});
```

```javascript
// 스레드의 현재 실행 위치를 모듈+오프셋으로 해석
function resolveAddress(addr) {
    const mod = Process.findModuleByAddress(addr);
    if (mod) {
        return `${mod.name}!+0x${addr.sub(mod.base).toString(16)}`;
    }
    const dbg = DebugSymbol.fromAddress(addr);
    if (dbg.name) {
        return `${dbg.moduleName}!${dbg.name}+0x${addr.sub(dbg.address).toString(16)}`;
    }
    return addr.toString();
}

Process.enumerateThreads().forEach((t) => {
    console.log(`Thread ${t.id}: PC=${resolveAddress(t.context.pc)}`);
});
```

---

### 3.2 하드웨어 브레이크포인트

CPU의 디버그 레지스터를 사용하는 하드웨어 브레이크포인트. 소프트웨어 브레이크포인트(`0xCC` / `BRK`)와 달리 코드를 수정하지 않으므로, 자기 수정 코드나 무결성 검사를 우회할 수 있다.

#### `thread.setHardwareBreakpoint(id, address)`

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `number` | 브레이크포인트 슬롯 번호 (0부터 시작, 최대 3~4개) |
| `address` | `NativePointer` | 브레이크할 주소 |

#### `thread.unsetHardwareBreakpoint(id)`

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `number` | 해제할 브레이크포인트 슬롯 번호 |

> **참고**: `Process.setExceptionHandler()`와 반드시 함께 사용해야 한다. 하드웨어 브레이크포인트가 트리거되면 `'breakpoint'` 타입의 예외가 발생하고, 핸들러에서 이를 처리해야 한다.

> **슬롯 수 제한**: ARM/ARM64는 최대 4개, x86/x64는 최대 4개 (DR0~DR3). 슬롯을 초과하면 예외 발생.

```javascript
// 코드 무결성 검사를 우회하면서 특정 주소 모니터링
const targetAddr = Process.getModuleByName('libtarget.so')
    .getExportByName('verify_license');

// 1. 예외 핸들러 등록
Process.setExceptionHandler((details) => {
    if (details.type === 'breakpoint' && details.address.equals(targetAddr)) {
        console.log('[BP] verify_license 호출됨');
        console.log(`  Caller: ${details.context.lr || details.context.sp}`);

        // ARM64: x0 = 첫 번째 인자
        if (Process.arch === 'arm64') {
            console.log(`  arg0 (x0): ${details.context.x0}`);
        }

        return true; // 예외 처리됨 — 실행 계속
    }
    return false;
});

// 2. 하드웨어 브레이크포인트 설정
const threads = Process.enumerateThreads();
threads.forEach((t) => {
    t.setHardwareBreakpoint(0, targetAddr);
});

// 해제
// threads.forEach(t => t.unsetHardwareBreakpoint(0));
```

```javascript
// 여러 함수에 동시에 하드웨어 브레이크포인트 설정
const breakpoints = [
    { id: 0, name: 'func_a', addr: null },
    { id: 1, name: 'func_b', addr: null },
    { id: 2, name: 'func_c', addr: null },
];

const mod = Process.getModuleByName('libtarget.so');
breakpoints.forEach(bp => {
    bp.addr = mod.getExportByName(bp.name);
});

Process.setExceptionHandler((details) => {
    if (details.type === 'breakpoint') {
        const hit = breakpoints.find(bp => bp.addr.equals(details.address));
        if (hit) {
            console.log(`[BP#${hit.id}] ${hit.name} @ ${hit.addr}`);
            return true;
        }
    }
    return false;
});

const mainThread = Process.enumerateThreads()[0];
breakpoints.forEach(bp => {
    mainThread.setHardwareBreakpoint(bp.id, bp.addr);
});
```

---

### 3.3 하드웨어 워치포인트

메모리 읽기/쓰기를 하드웨어 레벨에서 감시한다. 특정 메모리 주소에 누가, 언제 접근하는지 추적하는 데 핵심적이다.

#### `thread.setHardwareWatchpoint(id, address, size, conditions)`

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `number` | 워치포인트 슬롯 번호 |
| `address` | `NativePointer` | 감시할 메모리 주소 |
| `size` | `number` | 감시 영역 크기 (바이트). 보통 1, 2, 4, 8 |
| `conditions` | `string` | 감시 조건: `'r'` (읽기), `'w'` (쓰기), `'rw'` (읽기+쓰기) |

#### `thread.unsetHardwareWatchpoint(id)`

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `id` | `number` | 해제할 워치포인트 슬롯 번호 |

> **예외 핸들러 필수**: 워치포인트 트리거 시 `'single-step'` 또는 `'breakpoint'` 타입의 예외가 발생한다.

> **size 제약**: 아키텍처에 따라 지원되는 크기가 다르다. ARM64는 최대 8바이트, x86은 1/2/4 바이트만 지원.

```javascript
// 특정 전역 변수의 쓰기 감시
const globalVar = Process.getModuleByName('libtarget.so')
    .getExportByName('g_important_value');

console.log(`감시 대상: ${globalVar}`);
console.log(`현재 값: ${Memory.readInt(globalVar)}`);

Process.setExceptionHandler((details) => {
    if (details.type === 'breakpoint' || details.type === 'single-step') {
        if (details.memory && details.memory.address.equals(globalVar)) {
            console.log(`[WP] g_important_value ${details.memory.operation}`);
            console.log(`  PC: ${details.address}`);
            console.log(`  새 값: ${Memory.readInt(globalVar)}`);

            // 백트레이스로 호출 경로 확인
            const bt = Thread.backtrace(details.context, Backtracer.ACCURATE);
            console.log('  콜스택:');
            bt.forEach(frame => {
                const mod = Process.findModuleByAddress(frame);
                const name = mod ? `${mod.name}+0x${frame.sub(mod.base).toString(16)}` : frame.toString();
                console.log(`    ${name}`);
            });

            return true;
        }
    }
    return false;
});

const threads = Process.enumerateThreads();
threads.forEach(t => {
    t.setHardwareWatchpoint(0, globalVar, 4, 'w'); // 4바이트 쓰기 감시
});
```

```javascript
// 구조체 필드 접근 감시
const structBase = ptr('0x12345678');
const fieldOffset = 0x20; // 감시할 필드의 오프셋
const fieldAddr = structBase.add(fieldOffset);

Process.setExceptionHandler((details) => {
    if (details.memory) {
        console.log(`구조체 필드 ${details.memory.operation} @ PC=${details.address}`);
        return true;
    }
    return false;
});

Process.enumerateThreads()[0].setHardwareWatchpoint(0, fieldAddr, 8, 'rw');
```

---

### 3.4 백트레이스

#### `Thread.backtrace([context, backtracer])`

현재 또는 지정된 컨텍스트에서의 콜스택을 반환한다.

**파라미터**:
- `context` (선택): CPU 컨텍스트 객체. Interceptor의 `this.context` 또는 예외 핸들러의 `details.context` 전달.
- `backtracer` (선택): 백트레이서 알고리즘
  - `Backtracer.ACCURATE` (기본) — 프레임 포인터 기반. 정확하지만 FPO(Frame Pointer Omission) 바이너리에서 실패할 수 있음.
  - `Backtracer.FUZZY` — 스택 스캔 기반. 부정확할 수 있지만 FPO에서도 동작.

**반환 타입**: `NativePointer[]` — 최대 **16 프레임** (조정 불가)

```javascript
// Interceptor에서 콜스택 출력 (가장 흔한 사용 패턴)
Interceptor.attach(Module.getGlobalExportByName('open'), {
    onEnter(args) {
        const path = args[0].readUtf8String();
        console.log(`open("${path}")`);

        // this.context를 전달해야 정확한 백트레이스를 얻는다
        const bt = Thread.backtrace(this.context, Backtracer.ACCURATE);
        console.log('콜스택:');
        bt.forEach((frame, i) => {
            const sym = DebugSymbol.fromAddress(frame);
            console.log(`  #${i} ${frame} ${sym}`);
        });
    }
});
```

```javascript
// ACCURATE vs FUZZY 비교
function printBacktrace(context) {
    console.log('=== ACCURATE ===');
    Thread.backtrace(context, Backtracer.ACCURATE).forEach((frame, i) => {
        console.log(`  #${i} ${DebugSymbol.fromAddress(frame)}`);
    });

    console.log('=== FUZZY ===');
    Thread.backtrace(context, Backtracer.FUZZY).forEach((frame, i) => {
        console.log(`  #${i} ${DebugSymbol.fromAddress(frame)}`);
    });
}
```

```javascript
// ModuleMap과 함께 사용하여 고속 모듈 분류
const moduleMap = new ModuleMap();

function formatBacktrace(context) {
    return Thread.backtrace(context, Backtracer.ACCURATE)
        .map((frame) => {
            const modName = moduleMap.findName(frame);
            if (modName) {
                const mod = moduleMap.find(frame);
                const offset = frame.sub(mod.base);
                return `${modName}+0x${offset.toString(16)}`;
            }
            return frame.toString();
        });
}

// Interceptor에서 사용
Interceptor.attach(targetFunc, {
    onEnter(args) {
        const bt = formatBacktrace(this.context);
        console.log(`호출: ${bt.join(' ← ')}`);
    }
});
```

```javascript
// 컨텍스트 없이 호출 (현재 위치의 백트레이스)
const bt = Thread.backtrace();
console.log('현재 위치 콜스택:');
bt.forEach((frame, i) => {
    console.log(`  #${i} ${frame}`);
});
```

---

### 3.5 슬립

#### `Thread.sleep(delay)`

현재 스레드의 실행을 지정된 시간만큼 일시 중지한다.

**파라미터**: `delay: number` — 초 단위 (부동소수점 지원)

```javascript
// 0.1초 대기
Thread.sleep(0.1);

// 50ms 대기
Thread.sleep(0.05);

// 2초 대기
Thread.sleep(2);
```

```javascript
// 폴링 루프에서 사용
function waitForModule(moduleName, timeoutSec) {
    const start = Date.now();
    while (Date.now() - start < timeoutSec * 1000) {
        const mod = Process.findModuleByName(moduleName);
        if (mod) {
            console.log(`${moduleName} 로드됨: ${mod.base}`);
            return mod;
        }
        Thread.sleep(0.1); // 100ms 간격으로 폴링
    }
    console.log(`${moduleName} 타임아웃 (${timeoutSec}초)`);
    return null;
}
```

> **권장**: 모듈 로드 대기에는 `Thread.sleep()` 폴링보다 `Process.attachModuleObserver()`를 사용하는 것이 더 효율적이고 정확하다.

---

## 4. 실전 활용 패턴

### 4.1 모듈 로드 감시 후 후킹

가장 일반적인 Frida 사용 패턴. 앱이 지연 로딩하는 네이티브 라이브러리를 감지하고 즉시 후킹한다.

```javascript
// 범용 모듈 로드 후킹 프레임워크
class ModuleHooker {
    constructor() {
        this.pending = new Map(); // moduleName → hookSetup[]
        this.observer = null;
    }

    addHook(moduleName, hookSetup) {
        if (!this.pending.has(moduleName)) {
            this.pending.set(moduleName, []);
        }
        this.pending.get(moduleName).push(hookSetup);
    }

    start() {
        // 이미 로드된 모듈 처리
        for (const [moduleName, hooks] of this.pending) {
            const mod = Process.findModuleByName(moduleName);
            if (mod) {
                console.log(`[*] ${moduleName} 이미 로드됨`);
                hooks.forEach(h => h(mod));
                this.pending.delete(moduleName);
            }
        }

        // 아직 로드되지 않은 모듈 감시
        if (this.pending.size > 0) {
            this.observer = Process.attachModuleObserver({
                onAdded: (module) => {
                    const hooks = this.pending.get(module.name);
                    if (hooks) {
                        console.log(`[*] ${module.name} 로드 감지`);
                        module.ensureInitialized();
                        hooks.forEach(h => h(module));
                        this.pending.delete(module.name);

                        if (this.pending.size === 0) {
                            console.log('[*] 모든 대상 모듈 후킹 완료, 옵저버 해제');
                            this.observer.detach();
                        }
                    }
                },
                onRemoved: () => {}
            });
        }
    }
}

// 사용 예시
const hooker = new ModuleHooker();

hooker.addHook('libssl.so', (mod) => {
    Interceptor.attach(mod.getExportByName('SSL_write'), {
        onEnter(args) {
            const buf = args[1];
            const len = args[2].toInt32();
            console.log(`SSL_write(${len} bytes)`);
            if (len > 0 && len < 4096) {
                console.log(hexdump(buf, { length: len }));
            }
        }
    });
});

hooker.addHook('libtarget.so', (mod) => {
    Interceptor.attach(mod.getExportByName('check_root'), {
        onLeave(retval) {
            console.log(`check_root() → ${retval} (패치: 0)`);
            retval.replace(0);
        }
    });
});

hooker.start();
```

---

### 4.2 메모리 보호 변경 후 패치

코드 영역에 직접 바이트를 쓸 때는 `Memory.patchCode()`를 사용한다. 이 함수는 보호 속성을 일시적으로 변경하고 CPU 캐시를 플러시한다.

```javascript
// ARM64: 함수의 첫 명령어를 NOP으로 패치
function nopFunction(address, instructionCount) {
    if (Process.codeSigningPolicy === 'required') {
        console.log('[!] 코드 서명 필수 환경 — 직접 패치 불가');
        return false;
    }

    const nopArm64 = [0x1f, 0x20, 0x03, 0xd5]; // NOP (ARM64)
    const patchSize = instructionCount * 4;

    Memory.patchCode(address, patchSize, (code) => {
        for (let i = 0; i < instructionCount; i++) {
            code.add(i * 4).writeByteArray(nopArm64);
        }
    });

    console.log(`[*] ${address}: ${instructionCount}개 명령어 NOP 패치 완료`);
    return true;
}

// 사용
const checkAddr = Process.getModuleByName('libtarget.so')
    .getExportByName('integrity_check');
nopFunction(checkAddr, 1); // 첫 명령어를 NOP으로
```

```javascript
// 함수의 반환값을 항상 특정 값으로 패치 (ARM64)
function patchReturnValue(address, returnValue) {
    Memory.patchCode(address, 8, (code) => {
        if (Process.arch === 'arm64') {
            // MOV X0, #returnValue
            const imm16 = returnValue & 0xFFFF;
            const movz = (0xD2800000 | (imm16 << 5) | 0); // MOVZ X0, #imm
            code.writeU32(movz);
            // RET
            code.add(4).writeU32(0xD65F03C0);
        }
    });
    console.log(`[*] ${address}: return ${returnValue}으로 패치`);
}
```

```javascript
// 메모리 보호 속성 확인 후 안전하게 패치
function safePatch(address, data) {
    const range = Process.findRangeByAddress(address);
    if (!range) {
        console.log(`[!] ${address}: 유효하지 않은 주소`);
        return false;
    }

    console.log(`현재 보호: ${range.protection}`);

    if (range.protection.indexOf('w') === -1) {
        console.log('쓰기 불가 — Memory.patchCode() 사용');
        Memory.patchCode(address, data.length, (code) => {
            code.writeByteArray(data);
        });
    } else {
        console.log('쓰기 가능 — 직접 쓰기');
        address.writeByteArray(data);
    }

    return true;
}
```

---

### 4.3 스레드별 백트레이스 수집

모든 스레드의 현재 위치와 콜스택을 스냅샷으로 캡처한다. 데드락 분석, 스레드 프로파일링에 유용하다.

```javascript
// 전체 스레드 스냅샷 수집
function captureThreadSnapshot() {
    const moduleMap = new ModuleMap();
    const threads = Process.enumerateThreads();
    const snapshot = [];

    threads.forEach((thread) => {
        const info = {
            id: thread.id,
            name: thread.name || '(unnamed)',
            state: thread.state,
            pc: thread.context.pc.toString(),
            pcModule: moduleMap.findName(thread.context.pc) || 'unknown',
            backtrace: []
        };

        try {
            const bt = Thread.backtrace(thread.context, Backtracer.ACCURATE);
            info.backtrace = bt.map((frame) => {
                const mod = moduleMap.find(frame);
                if (mod) {
                    return {
                        address: frame.toString(),
                        module: mod.name,
                        offset: `0x${frame.sub(mod.base).toString(16)}`
                    };
                }
                return { address: frame.toString(), module: null, offset: null };
            });
        } catch (e) {
            info.backtrace = [{ error: e.message }];
        }

        snapshot.push(info);
    });

    return snapshot;
}

// 호출
const snap = captureThreadSnapshot();
send({ type: 'thread-snapshot', data: snap });
```

```javascript
// 주기적 스레드 프로파일링
let profilingInterval = null;

rpc.exports = {
    startProfiling(intervalMs) {
        profilingInterval = setInterval(() => {
            const snap = captureThreadSnapshot();
            send({ type: 'profile-sample', timestamp: Date.now(), data: snap });
        }, intervalMs);
    },

    stopProfiling() {
        if (profilingInterval) {
            clearInterval(profilingInterval);
            profilingInterval = null;
        }
    }
};
```

---

### 4.4 하드웨어 워치포인트로 메모리 접근 감시

특정 메모리 주소를 누가, 어떤 코드에서 읽고 쓰는지 추적한다.

```javascript
// 메모리 워치 유틸리티
function watchMemory(address, size, conditions, label) {
    const moduleMap = new ModuleMap();

    Process.setExceptionHandler((details) => {
        if (details.memory) {
            const watchedAddr = ptr(address.toString());
            const accessAddr = details.memory.address;

            // 감시 범위 내 접근인지 확인
            if (accessAddr.compare(watchedAddr) >= 0
                && accessAddr.compare(watchedAddr.add(size)) < 0) {

                const pcMod = moduleMap.findName(details.address);
                const pcOffset = pcMod
                    ? `${pcMod}+0x${details.address.sub(moduleMap.find(details.address).base).toString(16)}`
                    : details.address.toString();

                console.log(`[Watch:${label}] ${details.memory.operation.toUpperCase()} @ ${accessAddr}`);
                console.log(`  PC: ${pcOffset}`);
                console.log(`  값: ${Memory.readByteArray(watchedAddr, size)}`);

                // 콜스택
                const bt = Thread.backtrace(details.context, Backtracer.ACCURATE);
                bt.slice(0, 5).forEach((frame, i) => {
                    const name = moduleMap.findName(frame);
                    console.log(`  #${i} ${name || frame}`);
                });

                return true;
            }
        }
        return false;
    });

    // 모든 스레드에 워치포인트 설정
    const threads = Process.enumerateThreads();
    threads.forEach(t => {
        try {
            t.setHardwareWatchpoint(0, address, size, conditions);
        } catch (e) {
            // 일부 스레드는 설정 실패할 수 있음
        }
    });

    console.log(`[*] 워치포인트 설정: ${address} (${size}B, ${conditions})`);
}

// 사용: 전역 변수 쓰기 감시
const gFlag = Process.getModuleByName('libtarget.so')
    .getExportByName('g_is_rooted');
watchMemory(gFlag, 4, 'w', 'root_flag');
```

---

### 4.5 프로세스 메모리 맵 덤프

`/proc/self/maps` 스타일의 메모리 맵을 Frida API로 생성한다.

```javascript
function dumpMemoryMap() {
    const ranges = Process.enumerateRanges({ protection: '---', coalesce: false });

    console.log('=== Memory Map ===');
    console.log(`${'Start'.padEnd(18)} ${'End'.padEnd(18)} ${'Size'.padStart(10)} Prot  File`);
    console.log('-'.repeat(80));

    // 모든 읽기 가능 범위 (최소 조건)
    const allRanges = Process.enumerateRanges('r--');

    allRanges.forEach((r) => {
        const start = r.base.toString();
        const end = r.base.add(r.size).toString();
        const sizeStr = r.size >= 1024 * 1024
            ? `${(r.size / 1024 / 1024).toFixed(1)}MB`
            : `${(r.size / 1024).toFixed(1)}KB`;
        const file = r.file ? r.file.path : '';

        console.log(`${start.padEnd(18)} ${end.padEnd(18)} ${sizeStr.padStart(10)} ${r.protection}  ${file}`);
    });
}

dumpMemoryMap();
```

```javascript
// 메모리 통계 요약
function memoryStats() {
    const ranges = Process.enumerateRanges('r--');

    const stats = {
        total: 0,
        executable: 0,
        writable: 0,
        rwx: 0,
        fileBackedCount: 0,
        anonymousCount: 0,
    };

    ranges.forEach(r => {
        stats.total += r.size;
        if (r.protection.includes('x')) stats.executable += r.size;
        if (r.protection.includes('w')) stats.writable += r.size;
        if (r.protection === 'rwx') stats.rwx += r.size;
        if (r.file) stats.fileBackedCount++; else stats.anonymousCount++;
    });

    const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)}MB`;

    console.log('=== 메모리 통계 ===');
    console.log(`  전체 매핑: ${mb(stats.total)}`);
    console.log(`  실행 가능: ${mb(stats.executable)}`);
    console.log(`  쓰기 가능: ${mb(stats.writable)}`);
    console.log(`  RWX: ${mb(stats.rwx)}${stats.rwx > 0 ? ' [!]' : ''}`);
    console.log(`  파일 매핑: ${stats.fileBackedCount}개`);
    console.log(`  익명 매핑: ${stats.anonymousCount}개`);
}
```

---

### 4.6 특정 모듈의 함수 테이블 추출

리버스 엔지니어링을 위해 모듈의 export, symbol, import를 종합적으로 추출한다.

```javascript
function extractFunctionTable(moduleName) {
    const mod = Process.getModuleByName(moduleName);
    const result = {
        module: {
            name: mod.name,
            base: mod.base.toString(),
            size: mod.size,
            path: mod.path
        },
        exports: [],
        symbols: [],
        imports: []
    };

    // Exports
    mod.enumerateExports().forEach(e => {
        result.exports.push({
            name: e.name,
            type: e.type,
            offset: `0x${e.address.sub(mod.base).toString(16)}`
        });
    });

    // Symbols (export에 없는 것만)
    const exportNames = new Set(result.exports.map(e => e.name));
    try {
        mod.enumerateSymbols()
            .filter(s => s.type === 'function' && !exportNames.has(s.name))
            .forEach(s => {
                result.symbols.push({
                    name: s.name,
                    isGlobal: s.isGlobal,
                    offset: `0x${s.address.sub(mod.base).toString(16)}`,
                    size: s.size || 0
                });
            });
    } catch (e) {
        result.symbols = [{ error: 'enumerateSymbols not supported' }];
    }

    // Imports
    mod.enumerateImports().forEach(i => {
        result.imports.push({
            name: i.name,
            type: i.type,
            module: i.module || 'unknown',
            address: i.address ? i.address.toString() : null
        });
    });

    console.log(`${moduleName}: ${result.exports.length} exports, ` +
                `${result.symbols.length} symbols, ${result.imports.length} imports`);

    return result;
}

const table = extractFunctionTable('libtarget.so');
send({ type: 'function-table', data: table });
```

---

### 4.7 ModuleMap을 활용한 고속 주소 분류

Stalker 등에서 대량의 주소를 빠르게 모듈별로 분류할 때 사용한다.

```javascript
// Stalker 이벤트에서 모듈별 실행 빈도 분석
function analyzeExecution(targetTid) {
    const moduleMap = new ModuleMap();
    const hitCount = {};

    Stalker.follow(targetTid, {
        events: { call: true },
        onReceive(events) {
            const parsed = Stalker.parse(events, { stringify: false, annotate: false });

            parsed.forEach(([type, from, to]) => {
                const modName = moduleMap.findName(to) || 'unknown';
                hitCount[modName] = (hitCount[modName] || 0) + 1;
            });
        }
    });

    // 10초 후 결과 출력
    setTimeout(() => {
        Stalker.unfollow(targetTid);

        const sorted = Object.entries(hitCount)
            .sort((a, b) => b[1] - a[1]);

        console.log('=== 모듈별 호출 빈도 ===');
        sorted.forEach(([name, count]) => {
            console.log(`  ${name}: ${count}회`);
        });
    }, 10000);
}
```

```javascript
// 특정 모듈 내부 호출만 추적하는 필터링된 ModuleMap
const targetOnly = new ModuleMap((m) => m.name === 'libtarget.so');

Interceptor.attach(someFunc, {
    onEnter(args) {
        const caller = this.returnAddress;
        if (targetOnly.has(caller)) {
            console.log('libtarget.so 내부에서 호출됨');
        } else {
            console.log(`외부 모듈에서 호출됨: ${new ModuleMap().findName(caller)}`);
        }
    }
});
```

---

### 4.8 스레드 옵저버를 활용한 안티디버깅 우회

일부 앱은 별도 스레드를 생성하여 디버거를 감지한다. 스레드 옵저버로 이를 탐지하고 무력화한다.

```javascript
// 안티디버깅 스레드 감지 및 중지
const suspiciousNames = ['anti-debug', 'integrity', 'monitor', 'watchdog'];

Process.attachThreadObserver({
    onAdded(thread) {
        // 스레드 이름으로 감지
        if (thread.name && suspiciousNames.some(n =>
            thread.name.toLowerCase().includes(n))) {
            console.log(`[!] 의심 스레드 감지: ${thread.name} (id=${thread.id})`);
        }

        // 엔트리포인트로 감지
        if (thread.entrypoint) {
            const mod = Process.findModuleByAddress(thread.entrypoint.routine);
            if (mod && mod.name === 'libtarget.so') {
                const offset = thread.entrypoint.routine.sub(mod.base);
                console.log(`[*] libtarget.so 스레드 생성: offset=0x${offset.toString(16)}`);

                // 알려진 안티디버깅 스레드 오프셋이면 후킹
                const knownAntiDebugOffsets = [0x1234, 0x5678];
                if (knownAntiDebugOffsets.includes(offset.toInt32())) {
                    console.log('[*] 안티디버깅 스레드 — 엔트리포인트 패치');
                    // 스레드 시작 함수를 즉시 리턴하도록 패치
                    Interceptor.replace(thread.entrypoint.routine,
                        new NativeCallback(() => {
                            console.log('[*] 안티디버깅 스레드 무력화됨');
                            return 0;
                        }, 'pointer', ['pointer']));
                }
            }
        }
    },
    onRemoved(thread) {},
    onRenamed(thread, prev) {
        console.log(`[*] 스레드 이름 변경: "${prev}" → "${thread.name}"`);
    }
});
```

---

## 5. 주의사항 및 트러블슈팅

### API 동작 관련

| 주제 | 내용 |
|------|------|
| `runOnThread` 위험성 | 대상 스레드가 malloc, syscall 등 non-reentrant 코드를 실행 중이면 데드락 또는 크래시가 발생한다. 스레드 상태가 `'waiting'`일 때만 비교적 안전하다. |
| `enumerateRanges`의 `coalesce` | `true`로 설정하면 인접한 동일 보호 속성의 범위를 병합한다. 정확한 개별 범위가 필요하면 `false` (기본값) 사용. |
| `enumerateMallocRanges` 한계 | 시스템 malloc이 관리하는 범위만 반환한다. jemalloc, tcmalloc, 커스텀 할당자의 내부 블록은 반영되지 않을 수 있다. |
| `setExceptionHandler` 전역성 | 프로세스당 하나의 핸들러만 설정 가능하다. 여러 번 호출하면 마지막 핸들러가 이전 것을 덮어쓴다. |
| `enumerateSymbols` 플랫폼 | macOS/iOS (Mach-O)와 Linux/Android (ELF)에서만 비공개 심볼을 열거할 수 있다. Windows에서는 export만 반환. |
| `ensureInitialized` 타이밍 | 모듈 옵저버의 `onAdded` 콜백에서 후킹 전에 반드시 호출하여 초기화 완료를 보장해야 한다. |

### Frida 17.0 마이그레이션

Frida 17.0에서 `Module`의 정적 메서드 일부가 제거되었다.

| 제거된 코드 (16.x) | 대체 코드 (17.x) |
|---------------------|-------------------|
| `Module.findExportByName(null, 'open')` | `Module.findGlobalExportByName('open')` |
| `Module.findExportByName('libc.so', 'open')` | `Process.getModuleByName('libc.so').findExportByName('open')` |
| `Module.enumerateExports('libc.so')` | `Process.getModuleByName('libc.so').enumerateExports()` |
| `Module.enumerateImports('libc.so')` | `Process.getModuleByName('libc.so').enumerateImports()` |
| `Module.findBaseAddress('libc.so')` | `Process.getModuleByName('libc.so').base` |

### 하드웨어 브레이크포인트/워치포인트

| 주제 | 내용 |
|------|------|
| 슬롯 수 제한 | ARM/ARM64, x86/x64 모두 최대 **4개** 슬롯 (0~3). 초과 시 예외 발생. |
| 워치포인트 size | 주소와 size는 자연 정렬(naturally aligned)이어야 한다. 예: 4바이트 워치포인트는 4바이트 정렬 주소에만 설정 가능. |
| 예외 핸들러 필수 | 하드웨어 BP/WP 트리거 시 예외가 발생하므로, 미리 `setExceptionHandler`를 등록하지 않으면 프로세스가 크래시한다. |
| 새 스레드 반영 | 기존 스레드에만 설정된다. 이후 생성되는 스레드에는 자동 적용되지 않으므로, `attachThreadObserver`와 함께 사용해야 한다. |

### 성능 팁

| 주제 | 권장사항 |
|------|---------|
| 모듈 조회 반복 | `Process.findModuleByAddress()`를 반복 호출하지 말고 `ModuleMap`을 사용. 수십~수백 배 빠르다. |
| Export 조회 | `enumerateExports()` 전체 열거보다 `findExportByName()` 단건 조회가 훨씬 빠르다. |
| 백트레이스 | `Backtracer.ACCURATE`가 기본이며 대부분의 경우 충분하다. `FUZZY`는 FPO 바이너리에서만 사용. |
| 스레드 열거 | `enumerateThreads()`는 모든 스레드를 중지시키고 컨텍스트를 읽는다. 빈번하게 호출하면 성능에 영향을 준다. |
| ModuleMap 갱신 | 모듈 로드/언로드가 빈번하면 `attachModuleObserver`의 콜백에서 `update()`를 호출하여 맵을 동기화. |

### 일반적인 에러와 해결책

| 에러 메시지 | 원인 | 해결 |
|------------|------|------|
| `Error: unable to find module 'xxx'` | 모듈이 아직 로드되지 않음 | `attachModuleObserver`로 로드 대기 |
| `Error: access violation accessing 0x...` | 잘못된 메모리 주소 접근 | `findRangeByAddress`로 유효성 확인 |
| `Error: this.context is not available` | Interceptor 콜백 외부에서 접근 | `onEnter`/`onLeave` 내부에서만 사용 |
| `Error: invalid hardware breakpoint id` | 슬롯 번호 초과 (4개 제한) | 사용하지 않는 슬롯 해제 후 재사용 |
| `Error: unable to set watchpoint` | 정렬되지 않은 주소 또는 지원되지 않는 크기 | 주소를 자연 정렬하고 size를 1/2/4/8로 조정 |

---

> **참고 문서**: [Frida JavaScript API 공식 문서](https://frida.re/docs/javascript-api/)
