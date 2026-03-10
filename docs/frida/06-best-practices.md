# Best Practices & 실전 패턴

> Frida 스크립트 작성 시 반드시 알아야 할 베스트 프랙티스, 성능 최적화 팁, 흔한 실수와 해결 방법을 정리한 종합 가이드.
> Frida 17.x 기준으로 작성되었으며, CARF 프로젝트의 에이전트 설계 패턴도 포함한다.

---

## 목차

1. [메모리 관리](#1-메모리-관리)
   - 1.1 [GC와 NativePointer 수명](#11-gc와-nativepointer-수명)
   - 1.2 [Interceptor 콜백 내 메모리 할당](#12-interceptor-콜백-내-메모리-할당)
   - 1.3 [장기 참조와 전역 할당](#13-장기-참조와-전역-할당)
   - 1.4 [대용량 데이터 읽기/쓰기](#14-대용량-데이터-읽기쓰기)
   - 1.5 [ArrayBuffer와 NativePointer 변환](#15-arraybuffer와-nativepointer-변환)
2. [성능 최적화](#2-성능-최적화)
   - 2.1 [인수 캐싱](#21-인수-캐싱)
   - 2.2 [콜백 오버헤드 최소화](#22-콜백-오버헤드-최소화)
   - 2.3 [send() 배치 처리](#23-send-배치-처리)
   - 2.4 [Stalker 성능 튜닝](#24-stalker-성능-튜닝)
   - 2.5 [CModule/RustModule 활용](#25-cmodulerustmodule-활용)
   - 2.6 [ApiResolver 캐싱](#26-apiresolver-캐싱)
   - 2.7 [문자열 비교 최적화](#27-문자열-비교-최적화)
3. [에러 처리와 방어적 프로그래밍](#3-에러-처리와-방어적-프로그래밍)
   - 3.1 [안전한 메모리 접근](#31-안전한-메모리-접근)
   - 3.2 [플랫폼 및 런타임 체크](#32-플랫폼-및-런타임-체크)
   - 3.3 [모듈 존재 확인과 지연 후킹](#33-모듈-존재-확인과-지연-후킹)
   - 3.4 [RPC 에러 전파 패턴](#34-rpc-에러-전파-패턴)
   - 3.5 [Java.perform 내 예외 처리](#35-javaperform-내-예외-처리)
   - 3.6 [NativeFunction 호출 안전성](#36-nativefunction-호출-안전성)
4. [안티 탐지와 스텔스](#4-안티-탐지와-스텔스)
   - 4.1 [Cloak API 활용](#41-cloak-api-활용)
   - 4.2 [frida-server 은닉](#42-frida-server-은닉)
   - 4.3 [메모리 아티팩트 최소화](#43-메모리-아티팩트-최소화)
   - 4.4 [Zymbiote (Android)](#44-zymbiote-android)
   - 4.5 [일반적인 탐지 벡터](#45-일반적인-탐지-벡터)
5. [디버깅 패턴](#5-디버깅-패턴)
   - 5.1 [백트레이스 수집](#51-백트레이스-수집)
   - 5.2 [Hexdump 활용](#52-hexdump-활용)
   - 5.3 [Java 스택 트레이스](#53-java-스택-트레이스)
   - 5.4 [ObjC 메서드 트레이싱](#54-objc-메서드-트레이싱)
   - 5.5 [조건부 로깅](#55-조건부-로깅)
   - 5.6 [DebugSymbol 활용](#56-debugsymbol-활용)
6. [모듈 로드 타이밍](#6-모듈-로드-타이밍)
   - 6.1 [Spawn 모드 조기 계측](#61-spawn-모드-조기-계측)
   - 6.2 [Java 클래스 로딩 대기](#62-java-클래스-로딩-대기)
   - 6.3 [동적 라이브러리 로드 감시](#63-동적-라이브러리-로드-감시)
   - 6.4 [초기화 순서 제어](#64-초기화-순서-제어)
7. [CARF 에이전트 설계 패턴](#7-carf-에이전트-설계-패턴)
   - 7.1 [RPC 모듈화](#71-rpc-모듈화)
   - 7.2 [점진적 성능 최적화 전략](#72-점진적-성능-최적화-전략)
   - 7.3 [구조화된 이벤트 프로토콜](#73-구조화된-이벤트-프로토콜)
   - 7.4 [상태 관리와 정리(cleanup)](#74-상태-관리와-정리cleanup)
   - 7.5 [에러 경계 패턴](#75-에러-경계-패턴)
8. [버전 호환성](#8-버전-호환성)
   - 8.1 [v17 마이그레이션 체크리스트](#81-v17-마이그레이션-체크리스트)
   - 8.2 [frida-server 버전 매칭](#82-frida-server-버전-매칭)
   - 8.3 [브릿지 라이브러리 버전 관리](#83-브릿지-라이브러리-버전-관리)
9. [흔한 실수와 트러블슈팅](#9-흔한-실수와-트러블슈팅)
   - 9.1 [크래시 유발 패턴](#91-크래시-유발-패턴)
   - 9.2 [데드락 유발 패턴](#92-데드락-유발-패턴)
   - 9.3 [메모리 누수 패턴](#93-메모리-누수-패턴)
   - 9.4 [플랫폼별 함정](#94-플랫폼별-함정)
   - 9.5 [트러블슈팅 체크리스트](#95-트러블슈팅-체크리스트)

---

## 1. 메모리 관리

Frida 스크립트에서 메모리 관리는 가장 중요한 기초 지식이다. JavaScript의 가비지 컬렉터(GC)와 네이티브 메모리의 상호작용을 올바르게 이해하지 못하면 크래시, 데이터 손상, 불안정한 동작을 야기한다.

### 1.1 GC와 NativePointer 수명

`Memory.alloc()`, `Memory.allocUtf8String()` 등이 반환하는 `NativePointer`는 **JavaScript GC에 의해 관리**된다. GC가 해당 `NativePointer` 객체를 수거하면, 연결된 네이티브 메모리도 함께 해제된다.

**핵심 규칙:** 네이티브 메모리를 사용하는 동안 반드시 `NativePointer` 참조를 유지해야 한다.

```javascript
// BAD — GC에 의해 언제든 해제될 수 있음
function hookWithBadAlloc() {
  const target = Module.getExportByName(null, 'open');
  Interceptor.attach(target, {
    onEnter(args) {
      const newPath = Memory.allocUtf8String('/dev/null');
      args[0] = newPath; // newPath가 GC되면 args[0]은 dangling pointer!
    }
  });
}

// GOOD — this에 저장하여 onLeave까지 수명 보장
function hookWithGoodAlloc() {
  const target = Module.getExportByName(null, 'open');
  Interceptor.attach(target, {
    onEnter(args) {
      this.newPath = Memory.allocUtf8String('/dev/null');
      args[0] = this.newPath;
    }
  });
}
```

### 1.2 Interceptor 콜백 내 메모리 할당

`Interceptor.attach()`의 콜백 내에서 `Memory.alloc()`을 사용할 때의 주의점:

| 시나리오 | 저장 위치 | 안전성 |
|----------|-----------|--------|
| `onEnter`에서 할당 → `onEnter`에서만 사용 | 로컬 변수 | 안전 (같은 스코프 내) |
| `onEnter`에서 할당 → `args[]`에 대입 | `this`에 저장 필수 | `this` 없으면 위험 |
| `onEnter`에서 할당 → `onLeave`에서 사용 | `this`에 저장 필수 | `this` 없으면 위험 |
| 전역에서 할당 → 콜백 내에서 참조 | 전역/모듈 변수 | 안전 |

```javascript
// onEnter → onLeave 간 데이터 전달
Interceptor.attach(target, {
  onEnter(args) {
    // onLeave에서 접근하려면 반드시 this에 저장
    this.fd = args[0].toInt32();
    this.buf = args[1];
    this.size = args[2].toInt32();
  },
  onLeave(retval) {
    if (retval.toInt32() > 0) {
      // this를 통해 안전하게 접근
      console.log(`read(${this.fd}) → ${retval.toInt32()} bytes`);
      console.log(hexdump(this.buf, { length: Math.min(this.size, 64) }));
    }
  }
});
```

### 1.3 장기 참조와 전역 할당

스크립트 생존 기간 동안 유지되어야 하는 메모리는 모듈/전역 수준에서 할당한다.

```javascript
// 전역 버퍼 — 스크립트 언로드 전까지 유지
const sharedBuffer = Memory.alloc(4096);
const hookFlag = Memory.alloc(4); // CModule과 공유하는 플래그

// NativeCallback도 GC 대상이므로 전역에 유지
const myCallback = new NativeCallback((arg) => {
  console.log('called with', arg);
}, 'void', ['int']);

// BAD — 즉시 GC될 수 있음
function registerCallback() {
  const cb = new NativeCallback(() => {}, 'void', []);
  someNativeFunction(cb); // cb가 GC되면 크래시!
}

// GOOD — 전역에 유지
const persistentCallbacks = [];
function registerCallback() {
  const cb = new NativeCallback(() => {}, 'void', []);
  persistentCallbacks.push(cb); // 참조 유지
  someNativeFunction(cb);
}
```

### 1.4 대용량 데이터 읽기/쓰기

```javascript
// BAD — 1바이트씩 읽기 (극도로 비효율적)
function readBytesOneByOne(addr, size) {
  const result = [];
  for (let i = 0; i < size; i++) {
    result.push(addr.add(i).readU8());
  }
  return result;
}

// GOOD — readByteArray()로 한 번에 읽기
function readBytesEfficient(addr, size) {
  return addr.readByteArray(size);
}

// GOOD — 필요한 크기만 읽기
function peekHeader(addr) {
  // 전체 버퍼가 아닌 헤더 부분만 읽기
  return addr.readByteArray(16);
}
```

### 1.5 ArrayBuffer와 NativePointer 변환

```javascript
// NativePointer → ArrayBuffer (복사)
const data = ptr(0x1000).readByteArray(256);

// ArrayBuffer → NativePointer (래핑, 복사 없음)
const wrapped = ArrayBuffer.wrap(ptr(0x1000), 256);

// ArrayBuffer → NativePointer 주소 추출
const addr = ArrayBuffer.unwrap(wrapped); // NativePointer 반환

// 주의: wrap()으로 생성한 ArrayBuffer는 원본 메모리를 직접 참조
// 원본이 해제되면 접근 시 크래시 위험
```

---

## 2. 성능 최적화

핫 패스(hot path)에서의 Frida 콜백은 대상 프로세스의 성능에 직접 영향을 준다. 특히 초당 수천~수만 번 호출되는 함수를 후킹할 때 최적화는 필수이다.

### 2.1 인수 캐싱

`args[]` 배열 접근은 매번 네이티브 컨텍스트에서 값을 읽어오므로, 여러 번 사용할 때는 로컬 변수에 캐싱한다.

```javascript
// BAD — args[0]을 여러 번 접근 (매번 네이티브 → JS 변환)
Interceptor.attach(target, {
  onEnter(args) {
    if (args[0].readUtf8String(4) === 'HTTP') {
      console.log(args[0].readUtf8String());
      send({ type: 'http', data: args[0].readByteArray(256) });
    }
  }
});

// GOOD — 로컬 변수에 캐시
Interceptor.attach(target, {
  onEnter(args) {
    const buf = args[0];
    const header = buf.readUtf8String(4);
    if (header === 'HTTP') {
      console.log(buf.readUtf8String());
      send({ type: 'http', data: buf.readByteArray(256) });
    }
  }
});
```

### 2.2 콜백 오버헤드 최소화

| 콜백 구성 | 대략적 오버헤드 (ARM64 기준) | 비고 |
|-----------|----------------------------|------|
| `onEnter`만 | ~6 μs | 가장 가벼움 |
| `onEnter` + `onLeave` | ~11 μs | 반환값 필요 시만 사용 |
| `replace()` (NativeCallback) | ~8 μs | 함수 전체 교체 |
| `replaceFast()` | ~2 μs | CModule 필요 |
| CModule 콜백 (`attach` + C) | ~1 μs | 최고 성능 |

```javascript
// BAD — 불필요한 onLeave
Interceptor.attach(target, {
  onEnter(args) {
    console.log('called:', args[0].readUtf8String());
  },
  onLeave(retval) {
    // 아무것도 안 함 — 불필요한 오버헤드
  }
});

// GOOD — onLeave 생략
Interceptor.attach(target, {
  onEnter(args) {
    console.log('called:', args[0].readUtf8String());
  }
});
```

**핫 함수에 CModule 콜백 사용:**

```javascript
// 초당 10만+ 호출되는 함수에는 CModule 콜백 사용
const cm = new CModule(`
  #include <gum/guminterceptor.h>
  #include <stdio.h>

  static int callCount = 0;

  void onEnter(GumInvocationContext * ic) {
    callCount++;
  }

  int getCount(void) {
    return callCount;
  }
`);

Interceptor.attach(target, cm);

// 주기적으로 집계 확인
setInterval(() => {
  const count = new NativeFunction(cm.getCount, 'int', [])();
  send({ type: 'stats', count });
}, 1000);
```

### 2.3 send() 배치 처리

`send()`는 메시지를 호스트로 전송하는 IPC 호출이므로, 빈번한 호출은 심각한 병목이 된다.

```javascript
// BAD — 매 호출마다 send() (IPC 오버헤드)
Interceptor.attach(target, {
  onEnter(args) {
    send({ type: 'call', target: 'open', path: args[0].readUtf8String() });
  }
});

// GOOD — 배치로 모아서 전송
const batch = [];
const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 500;

function flushBatch() {
  if (batch.length > 0) {
    send({ type: 'calls', data: batch.splice(0) });
  }
}

// 크기 기반 플러시
Interceptor.attach(target, {
  onEnter(args) {
    batch.push({
      ts: Date.now(),
      target: 'open',
      path: args[0].readUtf8String()
    });
    if (batch.length >= BATCH_SIZE) {
      flushBatch();
    }
  }
});

// 시간 기반 플러시 (잔여 데이터 처리)
setInterval(flushBatch, FLUSH_INTERVAL_MS);
```

### 2.4 Stalker 성능 튜닝

Stalker는 가장 무거운 API이므로 최적화가 필수이다.

```javascript
// 1. exclude()로 시스템 라이브러리 제외 (필수!)
// 시스템 라이브러리까지 트레이싱하면 성능이 극도로 저하됨
for (const m of Process.enumerateModules()) {
  if (m.name !== 'target.so' && m.name !== 'libcrypto.so') {
    Stalker.exclude(m);
  }
}

// 2. onCallSummary > onReceive (집계된 결과가 더 효율적)
Stalker.follow(threadId, {
  events: { call: true },
  // BAD — 모든 이벤트를 개별 처리
  // onReceive(events) { ... }

  // GOOD — 호출 빈도를 집계하여 전달
  onCallSummary(summary) {
    // summary: { '0x7fff1234': 42, '0x7fff5678': 17, ... }
    send({ type: 'call-summary', data: summary });
  }
});

// 3. 커버리지 분석 시 compile > exec (훨씬 가벼움)
Stalker.follow(threadId, {
  events: { compile: true }, // exec 대신 compile 사용
  onReceive(events) {
    const parsed = Stalker.parse(events, { annotate: true, stringify: true });
    // compile 이벤트는 블록이 최초 컴파일될 때만 발생 → 이벤트 수 적음
    send({ type: 'coverage', blocks: parsed });
  }
});
```

### 2.5 CModule/RustModule 활용

성능이 중요한 콜백은 C/Rust로 작성하여 JS 오버헤드를 제거한다.

```javascript
// 성능 비교:
// JS 콜백:     ~6 μs/call
// CModule 콜백: ~1 μs/call (약 6배 빠름)

// 패턴: JS로 프로토타이핑 → 성능 이슈 확인 → CModule로 전환
const scanner = new CModule(`
  #include <gum/gumprocess.h>
  #include <string.h>

  void scan_for_pattern(const guint8 * base, gsize size,
                        const guint8 * pattern, gsize pattern_size,
                        GumMemoryRange * results, gint * count) {
    *count = 0;
    for (gsize i = 0; i <= size - pattern_size; i++) {
      if (memcmp(base + i, pattern, pattern_size) == 0) {
        results[*count].base_address = (GumAddress)(base + i);
        results[*count].size = pattern_size;
        (*count)++;
        if (*count >= 1024) break;
      }
    }
  }
`);
```

### 2.6 ApiResolver 캐싱

`ApiResolver`는 생성 비용이 높으므로 재사용한다.

```javascript
// BAD — 매번 새로 생성
function findExport(pattern) {
  const resolver = new ApiResolver('module');
  return resolver.enumerateMatches(pattern);
}

// GOOD — 한 번 생성하여 재사용
const moduleResolver = new ApiResolver('module');

function findExport(pattern) {
  return moduleResolver.enumerateMatches(pattern);
}

// 여러 타입의 resolver 캐싱
const resolvers = {
  module: new ApiResolver('module'),
  objc: ObjC.available ? new ApiResolver('objc') : null,
  swift: null, // 필요 시 생성
};
```

### 2.7 문자열 비교 최적화

```javascript
// BAD — 매번 전체 문자열을 읽어서 비교
Interceptor.attach(openAddr, {
  onEnter(args) {
    const path = args[0].readUtf8String();
    if (path && path.startsWith('/data/data/com.target')) {
      // ...
    }
  }
});

// GOOD — 접두사 길이만 읽어서 비교 (짧은 문자열 비교)
const PREFIX = '/data/data/com.target';
Interceptor.attach(openAddr, {
  onEnter(args) {
    try {
      const prefix = args[0].readUtf8String(PREFIX.length);
      if (prefix === PREFIX) {
        const fullPath = args[0].readUtf8String();
        // ...
      }
    } catch (e) {
      // 잘못된 포인터 무시
    }
  }
});
```

---

## 3. 에러 처리와 방어적 프로그래밍

Frida 스크립트는 미지의 바이너리를 계측하므로, 예상치 못한 상황에 대한 방어가 필수이다. 처리되지 않은 예외는 스크립트를 종료시키거나 대상 프로세스를 크래시시킨다.

### 3.1 안전한 메모리 접근

```javascript
// BAD — 잘못된 주소 접근 시 크래시
const value = ptr(0x1000).readU32();

// GOOD — try-catch로 보호
function safeReadU32(addr) {
  try {
    return addr.readU32();
  } catch (e) {
    return null; // 잘못된 주소 또는 접근 권한 없음
  }
}

// GOOD — 문자열 읽기 (길이 제한 포함)
function safeReadString(addr, maxLength = 256) {
  if (addr.isNull()) return null;
  try {
    return addr.readUtf8String(maxLength);
  } catch (e) {
    try {
      return addr.readCString(maxLength);
    } catch (e2) {
      return `<unreadable @ ${addr}>`;
    }
  }
}

// GOOD — 포인터 유효성 사전 검증
function isReadable(addr, size) {
  try {
    Memory.queryProtection(addr);
    return true;
  } catch (e) {
    return false;
  }
}
```

### 3.2 플랫폼 및 런타임 체크

```javascript
// 플랫폼별 분기
function getPlatformApis() {
  const apis = {};

  if (Process.platform === 'linux' || Process.platform === 'darwin') {
    apis.open = Module.getExportByName(null, 'open');
    apis.close = Module.getExportByName(null, 'close');
  } else if (Process.platform === 'windows') {
    apis.CreateFileW = Module.getExportByName('kernel32.dll', 'CreateFileW');
    apis.CloseHandle = Module.getExportByName('kernel32.dll', 'CloseHandle');
  }

  return apis;
}

// 런타임별 API 체크
if (Java.available) {
  Java.perform(() => {
    // Android Java API 사용
  });
} else if (ObjC.available) {
  // iOS/macOS ObjC API 사용
} else {
  // 네이티브 전용 환경
}

// 아키텍처별 분기
const NOP = {
  'arm64': [0x1f, 0x20, 0x03, 0xd5],
  'arm':   [0x00, 0x00, 0xa0, 0xe1],
  'x64':   [0x90],
  'ia32':  [0x90],
}[Process.arch];
```

### 3.3 모듈 존재 확인과 지연 후킹

```javascript
// BAD — 모듈이 없으면 예외 발생
const base = Process.getModuleByName('target.so').base;

// GOOD — findModuleByName()으로 안전하게 조회
function hookModule(moduleName, exportName, callbacks) {
  const m = Process.findModuleByName(moduleName);

  if (m !== null) {
    // 이미 로드됨 — 즉시 후킹
    const target = m.getExportByName(exportName);
    if (target) {
      Interceptor.attach(target, callbacks);
      console.log(`[+] Hooked ${moduleName}!${exportName}`);
      return true;
    }
  }

  // 아직 로드되지 않음 — 모듈 로드 감시
  console.log(`[*] Waiting for ${moduleName} to load...`);
  Process.attachModuleObserver({
    onAdded(module) {
      if (module.name === moduleName) {
        const target = module.findExportByName(exportName);
        if (target) {
          Interceptor.attach(target, callbacks);
          console.log(`[+] Hooked ${moduleName}!${exportName} (delayed)`);
        }
      }
    },
    onRemoved(module) {
      if (module.name === moduleName) {
        console.log(`[-] Module ${moduleName} unloaded`);
      }
    }
  });
  return false;
}
```

### 3.4 RPC 에러 전파 패턴

호스트(CARF 백엔드)와의 RPC 통신에서 에러를 구조화하여 전달한다.

```javascript
// 일관된 RPC 응답 형식
rpc.exports = {
  readMemory(address, size) {
    try {
      const addr = ptr(address);
      const data = addr.readByteArray(size);
      return { success: true, data };
    } catch (e) {
      return {
        success: false,
        error: {
          type: 'MemoryAccessError',
          message: e.message,
          address,
          size
        }
      };
    }
  },

  hookFunction(moduleName, exportName) {
    try {
      const m = Process.findModuleByName(moduleName);
      if (!m) {
        return {
          success: false,
          error: { type: 'ModuleNotFound', message: `Module '${moduleName}' not found` }
        };
      }
      const target = m.findExportByName(exportName);
      if (!target) {
        return {
          success: false,
          error: { type: 'ExportNotFound', message: `Export '${exportName}' not found in '${moduleName}'` }
        };
      }
      // 후킹 로직...
      return { success: true, address: target.toString() };
    } catch (e) {
      return {
        success: false,
        error: { type: 'UnexpectedError', message: e.message }
      };
    }
  }
};
```

### 3.5 Java.perform 내 예외 처리

```javascript
// BAD — 예외가 Java.perform 밖으로 전파되어 스크립트 종료 가능
Java.perform(() => {
  const cls = Java.use('com.nonexistent.Class'); // 클래스 없으면 예외!
});

// GOOD — 내부에서 예외 처리
Java.perform(() => {
  try {
    const cls = Java.use('com.target.SensitiveClass');
    cls.checkSignature.implementation = function () {
      return true;
    };
    console.log('[+] Signature check bypassed');
  } catch (e) {
    console.log(`[-] Failed to hook: ${e.message}`);
    // 클래스가 아직 로드되지 않았을 수 있음 → 클래스 로더 탐색 시도
  }
});
```

### 3.6 NativeFunction 호출 안전성

```javascript
// BAD — 시그니처 불일치 시 크래시 또는 정의되지 않은 동작
const badFunc = new NativeFunction(addr, 'int', ['pointer']);
badFunc(ptr(0)); // 실제로 3개 인수를 받는 함수라면?

// GOOD — 정확한 시그니처 확인 후 호출
// 1. 디스어셈블이나 문서로 시그니처 확인
// 2. 호출 규약 명시
const func = new NativeFunction(addr, 'int', ['pointer', 'int', 'pointer'], {
  abi: 'default',    // 또는 'stdcall' (Windows), 'sysv' (Linux x64)
  exceptions: 'propagate' // 'steal' 또는 'propagate'
});

// 3. try-catch로 호출 보호
try {
  const result = func(arg0, arg1, arg2);
} catch (e) {
  console.log(`Native call failed: ${e.message}`);
}
```

---

## 4. 안티 탐지와 스텔스

보안이 강화된 앱(루팅 탐지, 무결성 검사 등)을 분석할 때 Frida의 존재를 숨겨야 하는 상황에서의 기법들이다.

### 4.1 Cloak API 활용

`Cloak`은 Frida가 사용하는 리소스(스레드, 파일 디스크립터, 메모리 범위)를 대상 프로세스의 열거 API로부터 숨긴다.

```javascript
// Frida 스레드 숨기기
const fridaThreadId = Process.getCurrentThreadId();
Cloak.addThread(fridaThreadId);

// 파일 디스크립터 숨기기
Cloak.addFileDescriptor(fd);

// 메모리 범위 숨기기
Cloak.addRange({ base: ptr(0x7000), size: 0x1000 });

// 숨기기 해제
Cloak.removeThread(fridaThreadId);
```

### 4.2 frida-server 은닉

| 탐지 벡터 | 대응 방법 |
|-----------|-----------|
| 프로세스명 `frida-server` | 실행 파일명 변경 (`cp frida-server custom-daemon`) |
| 기본 포트 27042 | `-l 0.0.0.0:12345` 옵션으로 포트 변경 |
| `/tmp/frida-*` 파일 | `FRIDA_TMPDIR` 환경변수로 경로 변경 |
| D-Bus 통신 | gadget 모드 사용 (서버 불필요) |
| `/proc/self/maps`에 frida 문자열 | Cloak.addRange()로 범위 숨기기 |

```bash
# frida-server 은닉 실행 예시
cp frida-server /data/local/tmp/svc-daemon
chmod 755 /data/local/tmp/svc-daemon
FRIDA_TMPDIR=/data/local/tmp/.cache /data/local/tmp/svc-daemon -l 127.0.0.1:9999 &
```

### 4.3 메모리 아티팩트 최소화

```javascript
// 메모리 내 Frida 관련 문자열을 검색하는 탐지 우회
// 1. frida-agent 모듈 숨기기
for (const m of Process.enumerateModules()) {
  if (m.path.includes('frida')) {
    Cloak.addRange({ base: m.base, size: m.size });
  }
}

// 2. /proc/self/maps 읽기를 후킹하여 frida 관련 줄 제거
// (Linux/Android에서 흔한 탐지 패턴)
Interceptor.attach(Module.getExportByName(null, 'open'), {
  onEnter(args) {
    const path = args[0].readUtf8String();
    if (path && path.includes('/proc/') && path.includes('/maps')) {
      this.isMapsRead = true;
    }
  },
  onLeave(retval) {
    if (this.isMapsRead) {
      // maps 파일의 fd를 기록하여 read() 후킹에서 필터링
      this.mapsFd = retval.toInt32();
    }
  }
});
```

### 4.4 Zymbiote (Android)

Frida 17.6.0+에서 도입된 Zymbiote는 Android 환경에서 탐지를 크게 어렵게 만든다.

**Zymbiote의 장점:**

| 특성 | 설명 |
|------|------|
| ptrace 흔적 없음 | attach 방식이 아닌 프로세스 초기화 단계에서 주입 |
| 자식 프로세스 아티팩트 없음 | `fork()` 후에도 아티팩트가 전파되지 않음 |
| 경량 페이로드 | 최소한의 메모리 풋프린트 |

> **참고:** Zymbiote는 루팅된 Android 디바이스에서 frida-server의 특수 페이로드로 동작한다. 사용 방법은 Frida 공식 문서를 참조.

### 4.5 일반적인 탐지 벡터

앱이 Frida를 탐지하는 일반적인 방법과 대응 전략:

| 탐지 방법 | 탐지 원리 | 대응 전략 |
|-----------|-----------|-----------|
| 포트 스캔 | 27042 포트 연결 시도 | 포트 변경 |
| `/proc/self/maps` 검사 | frida-agent 매핑 확인 | Cloak 또는 maps 후킹 |
| `pthread_create` 감시 | 비정상 스레드 생성 감시 | Cloak.addThread() |
| 인라인 후킹 감지 | 함수 프롤로그 무결성 확인 | 탐지 함수 자체를 먼저 후킹 |
| `dlopen` 감시 | frida 관련 라이브러리 로드 감시 | gadget 모드 또는 이름 변경 |
| 환경 변수 검사 | `FRIDA_*` 환경변수 확인 | 환경변수 설정하지 않거나 후킹 |
| 타이밍 검사 | 후킹으로 인한 지연 시간 측정 | CModule 콜백으로 오버헤드 최소화 |

---

## 5. 디버깅 패턴

### 5.1 백트레이스 수집

함수가 어디서 호출되었는지 추적하는 가장 기본적인 디버깅 기법이다.

```javascript
// 기본 백트레이스
Interceptor.attach(target, {
  onEnter(args) {
    console.log('=== Backtrace ===');
    console.log(
      Thread.backtrace(this.context, Backtracer.ACCURATE)
        .map(DebugSymbol.fromAddress)
        .join('\n')
    );
  }
});

// 모듈 이름 포함 포맷팅
function formatBacktrace(context) {
  return Thread.backtrace(context, Backtracer.ACCURATE)
    .map(addr => {
      const sym = DebugSymbol.fromAddress(addr);
      const m = Process.findModuleByAddress(addr);
      const moduleName = m ? m.name : 'unknown';
      const offset = m ? `+0x${addr.sub(m.base).toString(16)}` : '';
      return `  ${addr} ${moduleName}${offset} (${sym})`;
    })
    .join('\n');
}

// 조건부 백트레이스 (특정 조건일 때만 수집)
Interceptor.attach(mallocAddr, {
  onEnter(args) {
    const size = args[0].toInt32();
    if (size > 1024 * 1024) { // 1MB 이상 할당 시에만
      console.log(`Large malloc(${size}):`);
      console.log(formatBacktrace(this.context));
    }
  }
});
```

### 5.2 Hexdump 활용

```javascript
// 기본 hexdump
console.log(hexdump(ptr(0x1000), {
  offset: 0,
  length: 128,
  header: true,
  ansi: true  // 터미널 색상 출력 (CARF 콘솔에서는 false 권장)
}));

// 구조체 시각화 헬퍼
function dumpStruct(addr, fields) {
  let offset = 0;
  console.log(`Struct at ${addr}:`);
  for (const [name, type, size] of fields) {
    const fieldAddr = addr.add(offset);
    let value;
    switch (type) {
      case 'u32': value = `0x${fieldAddr.readU32().toString(16)}`; break;
      case 'u64': value = `0x${fieldAddr.readU64().toString(16)}`; break;
      case 'ptr': value = fieldAddr.readPointer().toString(); break;
      case 'str': value = safeReadString(fieldAddr.readPointer()); break;
      default: value = hexdump(fieldAddr, { length: size, header: false });
    }
    console.log(`  +0x${offset.toString(16).padStart(4, '0')} ${name}: ${value}`);
    offset += size;
  }
}

// 사용 예시
dumpStruct(structAddr, [
  ['magic',   'u32', 4],
  ['version', 'u32', 4],
  ['name',    'str', 8],  // pointer to string
  ['data',    'ptr', 8],
]);
```

### 5.3 Java 스택 트레이스

```javascript
Java.perform(() => {
  // 방법 1: Exception 객체 활용
  function javaBacktrace() {
    const Exception = Java.use('java.lang.Exception');
    const trace = Exception.$new().getStackTrace();
    return trace.map(frame => `  ${frame.toString()}`).join('\n');
  }

  // 방법 2: Log.getStackTraceString 활용
  function javaBacktraceString() {
    const Log = Java.use('android.util.Log');
    const Exception = Java.use('java.lang.Exception');
    return Log.getStackTraceString(Exception.$new());
  }

  // 사용
  const Activity = Java.use('android.app.Activity');
  Activity.onCreate.implementation = function (bundle) {
    console.log(`[*] Activity.onCreate called from:\n${javaBacktrace()}`);
    this.onCreate(bundle);
  };
});
```

### 5.4 ObjC 메서드 트레이싱

```javascript
if (ObjC.available) {
  // 특정 클래스의 모든 메서드 트레이싱
  function traceObjCClass(className) {
    const cls = ObjC.classes[className];
    if (!cls) {
      console.log(`Class ${className} not found`);
      return;
    }

    const methods = cls.$ownMethods;
    methods.forEach(methodName => {
      try {
        const impl = cls[methodName].implementation;
        Interceptor.attach(impl, {
          onEnter(args) {
            // args[0] = self, args[1] = _cmd
            const sel = ObjC.selectorAsString(args[1]);
            console.log(`[${className} ${sel}]`);
          }
        });
      } catch (e) {
        // 일부 메서드는 후킹 불가
      }
    });
    console.log(`[+] Tracing ${methods.length} methods of ${className}`);
  }

  // ApiResolver로 패턴 매칭 트레이싱
  function traceObjCPattern(pattern) {
    const resolver = new ApiResolver('objc');
    const matches = resolver.enumerateMatches(pattern);
    matches.forEach(match => {
      Interceptor.attach(match.address, {
        onEnter(args) {
          console.log(`[*] ${match.name}`);
        }
      });
    });
    console.log(`[+] Tracing ${matches.length} methods matching '${pattern}'`);
  }

  // 사용
  traceObjCClass('NSURLSession');
  traceObjCPattern('-[NSURL* *password*]');
}
```

### 5.5 조건부 로깅

프로덕션 스크립트에서는 로깅 수준을 제어할 수 있어야 한다.

```javascript
// 로깅 레벨
const LogLevel = { NONE: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5 };
let currentLogLevel = LogLevel.INFO;

function log(level, tag, message) {
  if (level <= currentLogLevel) {
    const prefix = ['', 'E', 'W', 'I', 'D', 'T'][level];
    const timestamp = Date.now();
    send({ type: 'log', level: prefix, tag, message, timestamp });
  }
}

// RPC로 로그 레벨 동적 변경
rpc.exports = {
  setLogLevel(level) {
    currentLogLevel = level;
    return { success: true, level };
  }
};

// 사용
log(LogLevel.INFO, 'hook', 'Interceptor attached');
log(LogLevel.DEBUG, 'hook', `args[0] = ${args[0]}`);
log(LogLevel.TRACE, 'hook', hexdump(args[0], { length: 32 }));
```

### 5.6 DebugSymbol 활용

```javascript
// 주소에서 심볼 정보 조회
const sym = DebugSymbol.fromAddress(addr);
console.log(sym.toString());
// 예: "0x7fff1234 libsystem_c.dylib!open+0x18"

// 개별 필드 접근
console.log(`Module: ${sym.moduleName}`);
console.log(`Function: ${sym.name}`);
console.log(`File: ${sym.fileName}:${sym.lineNumber}`);

// 심볼 이름으로 주소 조회
const addr = DebugSymbol.fromName('open');

// 함수 이름으로 주소 조회 (여러 결과 가능)
const results = DebugSymbol.findFunctionsNamed('open');
const resultsMatching = DebugSymbol.findFunctionsMatching('*SSL*read*');
```

---

## 6. 모듈 로드 타이밍

Frida가 프로세스에 attach하는 시점에 따라 대상 모듈이 이미 로드되어 있을 수도 있고, 아직 로드되지 않았을 수도 있다. 이를 올바르게 처리하는 것이 안정적인 스크립트의 핵심이다.

### 6.1 Spawn 모드 조기 계측

`frida -f <app>` (spawn 모드)에서는 프로세스 초기화 단계에서 스크립트가 주입되므로, 대부분의 라이브러리가 아직 로드되지 않은 상태이다.

```javascript
// spawn 모드에서 동적 라이브러리 로드 대기
function waitAndHook(moduleName, hooks) {
  // 이미 로드되었는지 확인
  const existing = Process.findModuleByName(moduleName);
  if (existing) {
    applyHooks(existing, hooks);
    return;
  }

  // 모듈 로드 감시
  Process.attachModuleObserver({
    onAdded(module) {
      if (module.name === moduleName || module.path.includes(moduleName)) {
        console.log(`[+] Module loaded: ${module.name} @ ${module.base}`);
        applyHooks(module, hooks);
      }
    },
    onRemoved(module) {}
  });
}

function applyHooks(module, hooks) {
  for (const [exportName, callbacks] of Object.entries(hooks)) {
    const target = module.findExportByName(exportName);
    if (target) {
      Interceptor.attach(target, callbacks);
      console.log(`  [+] Hooked ${module.name}!${exportName}`);
    } else {
      console.log(`  [-] Export not found: ${exportName}`);
    }
  }
}

// 사용
waitAndHook('libssl.so', {
  'SSL_read': {
    onEnter(args) { this.buf = args[1]; this.size = args[2].toInt32(); },
    onLeave(retval) {
      const n = retval.toInt32();
      if (n > 0) console.log(hexdump(this.buf, { length: n }));
    }
  },
  'SSL_write': {
    onEnter(args) {
      console.log(hexdump(args[1], { length: args[2].toInt32() }));
    }
  }
});
```

### 6.2 Java 클래스 로딩 대기

Android에서 앱의 클래스는 여러 클래스 로더에 분산되어 있을 수 있다.

```javascript
Java.perform(() => {
  // 방법 1: 직접 클래스 접근 시도 → 실패 시 클래스 로더 열거
  function findAndHookClass(className, methodName, impl) {
    try {
      const cls = Java.use(className);
      cls[methodName].implementation = impl;
      console.log(`[+] Hooked ${className}.${methodName}`);
      return true;
    } catch (e) {
      console.log(`[*] ${className} not found in default loader, searching...`);
    }

    // 모든 클래스 로더 탐색
    Java.enumerateClassLoaders({
      onMatch(loader) {
        try {
          const factory = Java.ClassFactory.get(loader);
          const cls = factory.use(className);
          cls[methodName].implementation = impl;
          console.log(`[+] Hooked ${className}.${methodName} (via ${loader})`);
          return 'stop'; // 찾았으면 중단
        } catch (e) {
          // 이 로더에는 해당 클래스 없음 — 다음 로더 시도
        }
      },
      onComplete() {
        console.log(`[-] ${className} not found in any class loader`);
      }
    });
  }

  // 방법 2: 클래스 로드 이벤트 감시 (Frida 17.x)
  // Java.classFactory.loader를 주기적으로 변경하며 시도
  function waitForClass(className, callback) {
    const timer = setInterval(() => {
      try {
        const cls = Java.use(className);
        clearInterval(timer);
        callback(cls);
      } catch (e) {
        // 아직 로드되지 않음 — 재시도
      }
    }, 100);
  }

  waitForClass('com.target.SecretManager', (cls) => {
    cls.getSecret.implementation = function () {
      const result = this.getSecret();
      console.log(`[*] Secret: ${result}`);
      return result;
    };
  });
});
```

### 6.3 동적 라이브러리 로드 감시

`dlopen`/`LoadLibrary`를 후킹하여 라이브러리 로드 시점을 정확히 포착한다.

```javascript
// Linux/Android: dlopen 후킹
const dlopen = Module.getExportByName(null, 'dlopen');
const android_dlopen_ext = Module.findExportByName(null, 'android_dlopen_ext');

function hookDlopen(addr, name) {
  Interceptor.attach(addr, {
    onEnter(args) {
      this.path = args[0].isNull() ? null : args[0].readCString();
    },
    onLeave(retval) {
      if (this.path && !retval.isNull()) {
        console.log(`[dlopen] ${this.path} → ${retval}`);
        // 여기서 로드된 모듈 후킹
        if (this.path.includes('target')) {
          const m = Process.findModuleByName(this.path.split('/').pop());
          if (m) hookTargetModule(m);
        }
      }
    }
  });
}

hookDlopen(dlopen, 'dlopen');
if (android_dlopen_ext) {
  hookDlopen(android_dlopen_ext, 'android_dlopen_ext');
}
```

### 6.4 초기화 순서 제어

복잡한 스크립트에서 후킹 순서가 중요할 때의 패턴:

```javascript
// 의존성 있는 초기화를 순서대로 수행
async function initialize() {
  // 1단계: 코어 라이브러리 후킹
  await hookCoreLibraries();

  // 2단계: 모듈 로드 후 타겟 후킹
  await new Promise((resolve) => {
    waitAndHook('libtarget.so', {
      'init': {
        onLeave() {
          console.log('[+] Target initialized');
          resolve();
        }
      }
    });
  });

  // 3단계: 타겟 초기화 후 추가 후킹
  hookTargetInternals();
}

// 주의: 최상위 스코프에서 async/await 사용
initialize().catch(e => {
  console.log(`[-] Initialization failed: ${e.message}`);
});
```

---

## 7. CARF 에이전트 설계 패턴

CARF 프로젝트에서 Frida 에이전트를 작성할 때 따라야 하는 설계 패턴과 규칙.

### 7.1 RPC 모듈화

기능별로 모듈을 분리하고, 중앙 라우터에서 등록하는 패턴:

```javascript
// methods/memory.ts — 메모리 관련 RPC 메서드
const memoryModule = {
  register(reg) {
    reg('memory:read', this.readMemory.bind(this));
    reg('memory:write', this.writeMemory.bind(this));
    reg('memory:scan', this.scanMemory.bind(this));
    reg('memory:protect', this.queryProtection.bind(this));
  },

  readMemory(params) {
    const { address, size } = params;
    const addr = ptr(address);
    return { data: addr.readByteArray(size) };
  },

  writeMemory(params) {
    const { address, data } = params;
    const addr = ptr(address);
    addr.writeByteArray(data);
    return { written: data.byteLength };
  },

  scanMemory(params) {
    const { address, size, pattern } = params;
    const results = Memory.scanSync(ptr(address), size, pattern);
    return {
      matches: results.map(r => ({
        address: r.address.toString(),
        size: r.size
      }))
    };
  },

  queryProtection(params) {
    const { address } = params;
    return Memory.queryProtection(ptr(address));
  }
};

// methods/interceptor.ts — 후킹 관련 RPC 메서드
const interceptorModule = {
  register(reg) {
    reg('hook:attach', this.attachHook.bind(this));
    reg('hook:detach', this.detachHook.bind(this));
    reg('hook:list', this.listHooks.bind(this));
  },
  // ...
};

// rpc/router.ts — 중앙 라우터
const methods = {};

function reg(name, handler) {
  methods[name] = handler;
}

// 모듈 등록
memoryModule.register(reg);
interceptorModule.register(reg);

// RPC 진입점
rpc.exports = {
  dispatch(method, params) {
    const handler = methods[method];
    if (!handler) {
      return { success: false, error: { type: 'MethodNotFound', message: `Unknown method: ${method}` } };
    }
    try {
      const result = handler(params);
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: { type: 'ExecutionError', message: e.message, stack: e.stack } };
    }
  }
};
```

### 7.2 점진적 성능 최적화 전략

프로토타이핑에서 프로덕션까지 단계별 최적화 전략:

```javascript
// ── 1단계: JavaScript로 프로토타입 ──
// 빠른 개발, 디버깅 용이, 성능은 차선
function scanMemoryJS(base, size, pattern) {
  return Memory.scanSync(base, size, pattern);
}

// ── 2단계: 성능 병목 확인 후 CModule/RustModule 도입 ──
// 핫 패스만 네이티브로 전환
const cm = new CModule(`
  #include <gum/gummemoryscan.h>
  // 최적화된 C 구현
`);

function scanMemoryNative(base, size, pattern) {
  // CModule의 함수를 NativeFunction으로 호출
  return nativeScan(base, size, pattern);
}

// ── 3단계: 크기/빈도에 따라 자동 선택 ──
function scanMemory(base, size, pattern) {
  // 1MB 이상이면 네이티브 스캐너 사용
  if (size > 1024 * 1024) {
    return scanMemoryNative(base, size, pattern);
  }
  return scanMemoryJS(base, size, pattern);
}
```

### 7.3 구조화된 이벤트 프로토콜

호스트(CARF UI)와 에이전트 간의 일관된 이벤트 통신:

```javascript
// 이벤트 타입 정의
const EventType = {
  // 후킹 이벤트
  HOOK_ENTER: 'hook:enter',
  HOOK_LEAVE: 'hook:leave',
  HOOK_ERROR: 'hook:error',

  // 모듈 이벤트
  MODULE_LOADED: 'module:loaded',
  MODULE_REMOVED: 'module:removed',

  // 스캔 이벤트
  SCAN_MATCH: 'scan:match',
  SCAN_COMPLETE: 'scan:complete',

  // 시스템 이벤트
  AGENT_READY: 'agent:ready',
  AGENT_ERROR: 'agent:error',
};

// 구조화된 이벤트 전송
function emit(type, data) {
  send({
    type,
    timestamp: Date.now(),
    threadId: Process.getCurrentThreadId(),
    data
  });
}

// 사용 예시
emit(EventType.HOOK_ENTER, {
  target: 'open',
  args: { path: args[0].readUtf8String(), flags: args[1].toInt32() }
});

emit(EventType.MODULE_LOADED, {
  name: module.name,
  base: module.base.toString(),
  size: module.size,
  path: module.path
});

emit(EventType.SCAN_MATCH, {
  address: addr.toString(),
  pattern,
  preview: hexdump(addr, { length: 16, header: false })
});
```

### 7.4 상태 관리와 정리(cleanup)

리소스 누수를 방지하기 위한 체계적인 정리 패턴:

```javascript
// 활성 리스너/리소스 추적
const activeListeners = new Map();
const activeTimers = new Set();
const allocatedBuffers = [];

// 후킹 등록과 추적
function trackedAttach(id, target, callbacks) {
  const listener = Interceptor.attach(target, callbacks);
  activeListeners.set(id, listener);
  return listener;
}

// 후킹 해제
function trackedDetach(id) {
  const listener = activeListeners.get(id);
  if (listener) {
    listener.detach();
    activeListeners.delete(id);
  }
}

// 타이머 등록과 추적
function trackedInterval(callback, ms) {
  const id = setInterval(callback, ms);
  activeTimers.add(id);
  return id;
}

// 전체 정리
function cleanup() {
  // 모든 리스너 해제
  for (const [id, listener] of activeListeners) {
    listener.detach();
  }
  activeListeners.clear();

  // 모든 타이머 해제
  for (const id of activeTimers) {
    clearInterval(id);
  }
  activeTimers.clear();

  // Interceptor 전체 해제 (안전장치)
  Interceptor.detachAll();

  console.log('[*] Cleanup complete');
}

// RPC로 정리 호출 가능
rpc.exports = {
  cleanup() {
    cleanup();
    return { success: true };
  }
};
```

### 7.5 에러 경계 패턴

개별 후킹의 실패가 전체 스크립트에 영향을 주지 않도록 격리:

```javascript
// 에러 경계로 감싼 후킹
function safeAttach(name, target, callbacks) {
  try {
    const wrappedCallbacks = {};

    if (callbacks.onEnter) {
      const originalOnEnter = callbacks.onEnter;
      wrappedCallbacks.onEnter = function (args) {
        try {
          originalOnEnter.call(this, args);
        } catch (e) {
          emit(EventType.HOOK_ERROR, {
            hook: name,
            phase: 'onEnter',
            error: e.message,
            stack: e.stack
          });
        }
      };
    }

    if (callbacks.onLeave) {
      const originalOnLeave = callbacks.onLeave;
      wrappedCallbacks.onLeave = function (retval) {
        try {
          originalOnLeave.call(this, retval);
        } catch (e) {
          emit(EventType.HOOK_ERROR, {
            hook: name,
            phase: 'onLeave',
            error: e.message,
            stack: e.stack
          });
        }
      };
    }

    return Interceptor.attach(target, wrappedCallbacks);
  } catch (e) {
    emit(EventType.HOOK_ERROR, {
      hook: name,
      phase: 'attach',
      error: e.message
    });
    return null;
  }
}

// 사용
safeAttach('open', Module.getExportByName(null, 'open'), {
  onEnter(args) {
    // 여기서 예외가 발생해도 스크립트는 계속 동작
    console.log(args[0].readUtf8String());
  }
});
```

---

## 8. 버전 호환성

### 8.1 v17 마이그레이션 체크리스트

Frida 16.x에서 17.x로 업그레이드할 때 확인해야 할 변경사항:

| 항목 | v16 (deprecated) | v17 (현재) |
|------|-------------------|-----------|
| 메모리 읽기 | `Memory.readU32(addr)` | `addr.readU32()` |
| 모듈 기본 주소 | `Module.findBaseAddress('name')` | `Process.findModuleByName('name').base` |
| Export 조회 | `Module.getExportByName('mod', 'func')` | `Process.getModuleByName('mod').getExportByName('func')` |
| 열거 API | 콜백 기반 (`onMatch`/`onComplete`) | `for...of` 루프 또는 `enumerateXxxSync()` |
| Java bridge | 자동 포함 | `import 'frida-java-bridge'` 명시 필요 |
| ObjC bridge | 자동 포함 | `import 'frida-objc-bridge'` 명시 필요 |
| 모듈 옵저버 | `Module.ensureInitialized()` + 폴링 | `Process.attachModuleObserver()` |

**마이그레이션 코드 예시:**

```javascript
// v16 (deprecated)
const base = Module.findBaseAddress('target.so');
const exports = Module.enumerateExportsSync('target.so');
Memory.readByteArray(base, 16);

// v17
const m = Process.findModuleByName('target.so');
const base = m.base;
const exports = m.enumerateExports();
base.readByteArray(16);
```

```javascript
// v16: 콜백 기반 열거
Module.enumerateExports('target.so', {
  onMatch(exp) {
    console.log(exp.name);
  },
  onComplete() {
    console.log('done');
  }
});

// v17: for...of 루프
for (const exp of Process.getModuleByName('target.so').enumerateExports()) {
  console.log(exp.name);
}
```

### 8.2 frida-server 버전 매칭

호스트 측의 Frida 바인딩(frida-rust, frida-node, frida-python)과 디바이스 측의 frida-server 버전이 **정확히 일치**해야 한다.

| 상황 | 결과 |
|------|------|
| 버전 완전 일치 (예: 17.0.5 ↔ 17.0.5) | 정상 동작 |
| 마이너 버전 불일치 (예: 17.0.5 ↔ 17.0.3) | 대부분 동작하나 불안정 가능 |
| 메이저 버전 불일치 (예: 17.x ↔ 16.x) | 호환 불가, 연결 실패 |

```javascript
// 에이전트 내에서 버전 확인
rpc.exports = {
  getAgentInfo() {
    return {
      fridaVersion: Frida.version,
      heapSize: Frida.heapSize,
      arch: Process.arch,
      platform: Process.platform,
      pid: Process.id
    };
  }
};
```

> **CARF 권장사항:** 세션 연결 시 호스트와 에이전트의 `Frida.version`을 비교하여 불일치 시 경고를 표시하는 것을 권장한다.

### 8.3 브릿지 라이브러리 버전 관리

`frida-java-bridge`와 `frida-objc-bridge`는 Frida 코어와 별도로 버전이 관리된다.

```json
// package.json (frida-compile 사용 시)
{
  "dependencies": {
    "@anthropic-ai/sdk": "...",
    "frida-java-bridge": "^7.0.0",
    "frida-objc-bridge": "^3.0.0"
  }
}
```

```javascript
// 에이전트 진입점에서 명시적 import
import 'frida-java-bridge';
import 'frida-objc-bridge';

// 이후 Java.available, ObjC.available 등 사용 가능
```

---

## 9. 흔한 실수와 트러블슈팅

### 9.1 크래시 유발 패턴

| 패턴 | 원인 | 해결 |
|------|------|------|
| GC된 NativePointer 사용 | `Memory.alloc()` 반환값이 수거됨 | `this` 또는 전역에 참조 유지 |
| 잘못된 NativeFunction 시그니처 | 인수 개수/타입 불일치 | 디스어셈블로 시그니처 확인 |
| NULL 포인터 역참조 | `args[N]`이 NULL일 수 있음 | `isNull()` 체크 후 접근 |
| 스택 오버플로우 | 재귀 후킹 (후킹된 함수 내에서 같은 함수 호출) | 재진입 가드 사용 |
| Thread-unsafe 접근 | 멀티스레드 환경에서 공유 자원 동시 접근 | 최소한의 공유 상태 유지 |

**재진입 가드 패턴:**

```javascript
// BAD — 재귀 호출 시 무한 루프
const sendAddr = Module.getExportByName(null, 'send');
Interceptor.attach(sendAddr, {
  onEnter(args) {
    // send()를 로깅하려고 하면...
    // console.log도 내부적으로 send()를 호출하여 무한 재귀!
    console.log('send called');
  }
});

// GOOD — 스레드별 재진입 가드
const inHook = new Map(); // threadId → boolean

Interceptor.attach(sendAddr, {
  onEnter(args) {
    const tid = Process.getCurrentThreadId();
    if (inHook.get(tid)) return; // 재진입 방지
    inHook.set(tid, true);

    try {
      // 안전하게 로깅
      send({ type: 'send-call', fd: args[0].toInt32() });
    } finally {
      inHook.set(tid, false);
    }
  }
});
```

### 9.2 데드락 유발 패턴

```javascript
// BAD — Interceptor 콜백 내에서 동기 RPC 호출
Interceptor.attach(target, {
  onEnter(args) {
    // recv()로 호스트 응답 대기 → 콜백이 블록됨 → 대상 프로세스 멈춤
    recv('config', (msg) => {
      this.config = msg;
    });
    // 이 시점에 config가 아직 없을 수 있음!
  }
});

// GOOD — 비동기 패턴 또는 사전 캐시
let config = null;

// 사전에 설정 로드
recv('config', (msg) => {
  config = msg.payload;
});

Interceptor.attach(target, {
  onEnter(args) {
    if (config) {
      // 이미 로드된 설정 사용
    }
  }
});
```

```javascript
// BAD — Java.perform 내에서 네이티브 락을 잡은 채로 Java 호출
// → ART VM의 내부 락과 충돌 가능

// GOOD — Java.scheduleOnMainThread 사용 (UI 스레드 필요 시)
Java.perform(() => {
  Java.scheduleOnMainThread(() => {
    // UI 관련 Java 코드는 여기서 실행
  });
});
```

### 9.3 메모리 누수 패턴

```javascript
// BAD — 매 호출마다 배열에 추가하고 제거하지 않음
const allCalls = [];
Interceptor.attach(target, {
  onEnter(args) {
    allCalls.push({ ts: Date.now(), arg: args[0].toString() });
    // allCalls가 무한히 커짐!
  }
});

// GOOD — 크기 제한된 링 버퍼
class RingBuffer {
  constructor(maxSize) {
    this.buffer = new Array(maxSize);
    this.maxSize = maxSize;
    this.index = 0;
    this.count = 0;
  }

  push(item) {
    this.buffer[this.index] = item;
    this.index = (this.index + 1) % this.maxSize;
    if (this.count < this.maxSize) this.count++;
  }

  toArray() {
    if (this.count < this.maxSize) {
      return this.buffer.slice(0, this.count);
    }
    return [...this.buffer.slice(this.index), ...this.buffer.slice(0, this.index)];
  }
}

const recentCalls = new RingBuffer(1000);
Interceptor.attach(target, {
  onEnter(args) {
    recentCalls.push({ ts: Date.now(), arg: args[0].toString() });
  }
});
```

### 9.4 플랫폼별 함정

#### Android

| 함정 | 설명 | 대응 |
|------|------|------|
| SELinux 차단 | `frida-server`가 특정 프로세스에 attach 불가 | `setenforce 0` 또는 Magisk 정책 |
| zygote fork | `spawn` 시 zygote에서 fork된 프로세스 | `--realm=emulated` 또는 app 시작 후 attach |
| ART 최적화 | 메서드가 인라인/AOT 컴파일됨 | `Java.deoptimizeEverything()` |
| 32/64비트 혼합 | 32비트 앱에 64비트 frida-server | 올바른 아키텍처의 frida-server 사용 |
| `android_dlopen_ext` | 일부 Android 버전에서 `dlopen` 대신 사용 | 두 함수 모두 후킹 |

#### iOS

| 함정 | 설명 | 대응 |
|------|------|------|
| 코드 서명 (`required`) | `Memory.patchCode()` 필요 | 직접 메모리 쓰기 불가, patchCode 사용 |
| App Transport Security | HTTPS 후킹 시 인증서 제한 | SSL 핀닝 우회 먼저 적용 |
| Objective-C 블록 | 클로저 호출 규약이 다름 | `ObjC.Block` API 사용 |
| Swift 네임 맹글링 | 함수 이름이 복잡하게 변환됨 | `DebugSymbol.findFunctionsMatching()` 활용 |

#### Windows

| 함정 | 설명 | 대응 |
|------|------|------|
| ASLR | 모듈 기본 주소가 매번 변경 | `Module.getExportByName()` 또는 패턴 스캔 사용 |
| DEP | 데이터 영역 실행 불가 | `Memory.patchCode()` 사용 |
| 유니코드 | Windows API는 Wide String(`W` 접미사) 사용 | `readUtf16String()` 사용 |
| 호출 규약 | `stdcall`, `fastcall` 등 다양 | `NativeFunction`에 `abi` 명시 |

### 9.5 트러블슈팅 체크리스트

스크립트가 기대대로 동작하지 않을 때 확인할 사항:

**연결 문제:**

- [ ] frida-server가 실행 중인가?
- [ ] 호스트와 frida-server의 버전이 일치하는가?
- [ ] 올바른 아키텍처(arm/arm64/x86/x64)의 frida-server인가?
- [ ] USB 연결 또는 네트워크 포트가 올바른가?
- [ ] SELinux(Android) 또는 SIP(macOS)가 차단하고 있지 않은가?

**후킹 실패:**

- [ ] 대상 모듈이 로드되었는가? (`Process.findModuleByName()`)
- [ ] Export 이름이 정확한가? (`Module.enumerateExports()`로 확인)
- [ ] 인라인/AOT 최적화로 함수가 제거되지 않았는가?
- [ ] 함수 주소가 유효한 코드 영역인가?
- [ ] Thumb 모드(ARM)에서 주소의 최하위 비트가 올바른가?

**크래시 디버깅:**

- [ ] `NativePointer` 참조가 GC되지 않았는가?
- [ ] `NativeFunction` 시그니처가 정확한가?
- [ ] 재진입(reentrancy) 문제가 있는가?
- [ ] 멀티스레드 경합 조건이 있는가?
- [ ] NULL 포인터를 역참조하고 있지 않은가?

**성능 문제:**

- [ ] 핫 함수에 JS 콜백을 사용하고 있지 않은가? → CModule 전환
- [ ] `send()`를 배치 처리하고 있는가?
- [ ] Stalker에서 시스템 라이브러리를 `exclude()`했는가?
- [ ] 불필요한 `onLeave` 콜백이 있지 않은가?
- [ ] 문자열 읽기를 최소화하고 있는가?

---

> **참고 문서:**
> - [01-process-module-thread.md](01-process-module-thread.md) — Process, Module, Thread API
> - [02-memory.md](02-memory.md) — Memory API
> - [03-interceptor.md](03-interceptor.md) — Interceptor API
> - [04-stalker.md](04-stalker.md) — Stalker (코드 트레이싱)
> - [05-java-objc.md](05-java-objc.md) — Java / ObjC 런타임 API
