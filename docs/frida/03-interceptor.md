# Interceptor API 레퍼런스

> 네이티브 함수 호출을 가로채고, 인수·반환값을 관찰·조작하며, 함수 구현 자체를 교체할 수 있는 Frida의 핵심 API

---

## 목차

1. [개요](#1-개요)
2. [Interceptor.attach()](#2-interceptorattachtarget-callbacks-data)
   - 2.1 [매개변수](#21-매개변수)
   - 2.2 [onEnter 콜백](#22-onenterargs-콜백)
   - 2.3 [onLeave 콜백](#23-onleaveretval-콜백)
   - 2.4 [반환값 — InvocationListener](#24-반환값--invocationlistener)
   - 2.5 [기본 사용 예제](#25-기본-사용-예제)
3. [C 구현 콜백 (CModule / RustModule)](#3-c-구현-콜백-cmodule--rustmodule)
4. [Interceptor.replace()](#4-interceptorreplacetarget-replacement-data)
5. [Interceptor.replaceFast()](#5-interceptorreplacefasttarget-replacement)
6. [Interceptor.revert()](#6-interceptorreverttarget)
7. [Interceptor.detachAll()](#7-interceptordetachall)
8. [Interceptor.flush()](#8-interceptorflush)
9. [Interceptor.breakpointKind](#9-interceptorbreakpointkind)
10. [성능 고려사항](#10-성능-고려사항)
11. [실전 패턴](#11-실전-패턴)
    - 11.1 [SSL 핀닝 우회](#111-ssl-핀닝-우회)
    - 11.2 [파일 접근 감시](#112-파일-접근-감시)
    - 11.3 [네트워크 요청 로깅](#113-네트워크-요청-로깅)
    - 11.4 [암호화 함수 키 추출](#114-암호화-함수-키-추출)
    - 11.5 [반환값 조작](#115-반환값-조작)
    - 11.6 [인수 교체 (문자열)](#116-인수-교체-문자열)
    - 11.7 [재귀 함수에서 this 사용](#117-재귀-함수에서-this-사용)
12. [주의사항](#12-주의사항)

---

## 1. 개요

`Interceptor`는 Frida의 Gum 엔진이 제공하는 인라인 후킹(inline hooking) API이다. 대상 함수의 프롤로그(prologue)를 트램펄린(trampoline)으로 교체하여, 함수가 호출될 때마다 사용자가 등록한 콜백을 실행한다.

### 핵심 기능

| 기능 | 메서드 | 설명 |
|------|--------|------|
| 관찰(Observe) | `attach()` | 함수 진입·반환 시점에 콜백 실행. 인수와 반환값을 읽고 쓸 수 있음 |
| 교체(Replace) | `replace()` | 함수 구현 자체를 완전히 교체 |
| 고속 교체 | `replaceFast()` | `replace()`보다 낮은 오버헤드로 함수 교체 |
| 복원(Revert) | `revert()` | `replace()`/`replaceFast()`로 교체한 함수를 원래 구현으로 복원 |
| 전체 해제 | `detachAll()` | 모든 `attach()` 리스너를 일괄 해제 |
| 즉시 적용 | `flush()` | 보류 중인 변경사항을 메모리에 즉시 기록 |

### 동작 원리

```
┌─────────────────────────────────────────────────┐
│ 원본 함수                                       │
│ ┌───────────────┐                                │
│ │ 프롤로그      │ ← Interceptor가 JMP로 교체     │
│ ├───────────────┤                                │
│ │ 함수 본문     │                                │
│ └───────────────┘                                │
└─────────────────────────────────────────────────┘

          ↓ attach() 적용 후

┌─────────────────────────────────────────────────┐
│ 원본 함수                                       │
│ ┌───────────────┐                                │
│ │ JMP trampoline│ ─────→ ┌──────────────────┐   │
│ ├───────────────┤        │ onEnter(args)    │   │
│ │ (사용 안 함)  │        │ 원본 프롤로그    │   │
│ │ 함수 본문     │ ←───── │ JMP back         │   │
│ │ ...           │        │ ...              │   │
│ │ RET           │ ─────→ │ onLeave(retval)  │   │
│ └───────────────┘        │ RET to caller    │   │
│                          └──────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 지원 아키텍처

| 아키텍처 | attach | replace | replaceFast | 비고 |
|----------|--------|---------|-------------|------|
| x86      | O      | O       | O           |      |
| x86_64   | O      | O       | O           |      |
| ARM      | O      | O       | O           | Thumb/ARM 모드 구분 필요 |
| ARM64    | O      | O       | O           |      |
| MIPS     | O      | O       | O           |      |

---

## 2. Interceptor.attach(target, callbacks[, data])

함수 호출을 가로채서 진입(onEnter)과 반환(onLeave) 시점에 콜백을 실행한다. 원본 함수는 정상적으로 실행되며, 콜백은 인수와 반환값을 관찰하거나 수정할 수 있다.

### 2.1 매개변수

#### target: NativePointer

후킹할 네이티브 함수의 주소. 일반적으로 다음 방법으로 얻는다.

```javascript
// 방법 1: 모듈 이름 + 심볼 이름
const target = Module.getExportByName('libc.so', 'open');

// 방법 2: 모듈 객체에서
const libc = Process.getModuleByName('libc.so');
const target = libc.getExportByName('read');

// 방법 3: 모듈 베이스 + 오프셋
const base = Module.getBaseAddress('libfoo.so');
const target = base.add(0x1234);

// 방법 4: DebugSymbol에서
const target = DebugSymbol.getFunctionByName('SSL_read');

// 방법 5: 패턴 스캔 결과
const matches = Memory.scan(module.base, module.size, 'FF 83 ?? 00', {
  onMatch(address, size) { /* ... */ }
});
```

**32비트 ARM 주의사항**: ARM 프로세서는 ARM 모드(32비트 명령어)와 Thumb 모드(16비트 명령어)를 지원한다. 함수 주소의 최하위 비트(LSB)가 이를 구분한다.

| LSB | 모드 | 예시 |
|-----|------|------|
| 0   | ARM  | `ptr('0x12340')` |
| 1   | Thumb | `ptr('0x12341')` |

```javascript
// Thumb 함수를 ARM으로 잘못 지정하면 크래시 발생
// Module.getExportByName()은 자동으로 올바른 LSB를 설정함

// 수동으로 오프셋을 지정할 때는 Thumb 여부를 직접 설정해야 함
const thumbFunc = base.add(0x1234).or(1);  // Thumb 모드 명시
const armFunc = base.add(0x5678);           // ARM 모드 (LSB = 0)

// IDA/Ghidra에서 가져온 주소 확인
// IDA는 보통 Thumb 함수에 +1을 포함하지 않으므로 직접 추가 필요
const idaAddr = 0xABCD;  // IDA에서 본 주소
const target = base.add(idaAddr).or(1);  // Thumb 함수라면 +1
```

#### callbacks: { onEnter?, onLeave? }

두 콜백 모두 선택적이다. 필요하지 않은 콜백은 생략하면 성능상 유리하다.

```javascript
// onEnter만 (반환값 불필요)
Interceptor.attach(target, {
  onEnter(args) {
    console.log('called with:', args[0]);
  }
});

// onLeave만 (인수 불필요)
Interceptor.attach(target, {
  onLeave(retval) {
    console.log('returned:', retval);
  }
});

// 둘 다
Interceptor.attach(target, {
  onEnter(args) { /* ... */ },
  onLeave(retval) { /* ... */ }
});
```

#### data: NativePointer (선택)

C/Rust 콜백에서 접근할 수 있는 사용자 데이터 포인터. JS 콜백에서는 사용하지 않으며, CModule/RustModule과 함께 사용한다. 자세한 내용은 [3. C 구현 콜백](#3-c-구현-콜백-cmodule--rustmodule) 참조.

---

### 2.2 onEnter(args) 콜백

함수가 호출되는 시점, 즉 함수 본문이 실행되기 직전에 호출된다.

#### args 매개변수

`args`는 함수 인수에 대한 `NativePointer` 배열이다. **읽기와 쓰기가 모두 가능**하다.

```javascript
Interceptor.attach(target, {
  onEnter(args) {
    // 읽기
    const fd = args[0].toInt32();          // int 인수
    const buf = args[1];                    // 포인터 인수
    const size = args[2].toUInt32();        // unsigned int 인수
    const str = args[0].readUtf8String();   // 문자열 포인터
    const wstr = args[0].readUtf16String(); // 와이드 문자열

    // 쓰기 (인수 교체)
    args[0] = ptr(999);                     // 첫 번째 인수를 999로 변경
    args[1] = Memory.allocUtf8String('/tmp/redirected');  // 문자열 교체
  }
});
```

**인수 인덱스와 호출 규약**: `args[n]`의 의미는 대상 플랫폼의 호출 규약(calling convention)에 따라 달라진다.

| 플랫폼 | 호출 규약 | args[0]~args[3] | args[4]~ |
|--------|-----------|-----------------|----------|
| x86_64 (System V) | rdi, rsi, rdx, rcx, r8, r9 | 레지스터 | 스택 |
| x86_64 (Windows) | rcx, rdx, r8, r9 | 레지스터 | 스택 |
| ARM64 | x0~x7 | 레지스터 | 스택 |
| ARM | r0~r3 | 레지스터 | 스택 |
| x86 (cdecl) | 모두 스택 | 스택 | 스택 |

#### this 바인딩

`onEnter`와 `onLeave`에서 `this`는 `InvocationContext` 객체로 바인딩된다. 다음 속성을 제공한다.

| 속성 | 타입 | 설명 |
|------|------|------|
| `returnAddress` | `NativePointer` | 함수를 호출한 코드의 복귀 주소 |
| `context` | `CpuContext` | 현재 CPU 레지스터 상태 (읽기/쓰기 가능) |
| `errno` | `number` | UNIX errno 값 (읽기/쓰기 가능) |
| `lastError` | `number` | Windows GetLastError() 값 (읽기/쓰기 가능) |
| `threadId` | `number` | OS 스레드 ID |
| `depth` | `number` | 다른 Interceptor 콜백 기준 호출 깊이 |

##### returnAddress

```javascript
Interceptor.attach(target, {
  onEnter(args) {
    // 이 함수를 누가 호출했는지 확인
    console.log('caller:', this.returnAddress);

    // 호출자가 속한 모듈 확인
    const module = Process.findModuleByAddress(this.returnAddress);
    if (module) {
      const offset = this.returnAddress.sub(module.base);
      console.log(`called from ${module.name} + ${offset}`);
    }

    // 콜스택 전체 확인
    console.log(Thread.backtrace(this.context, Backtracer.ACCURATE)
      .map(DebugSymbol.fromAddress)
      .join('\n'));
  }
});
```

##### context (CpuContext)

아키텍처별로 다른 레지스터 집합을 노출한다. **읽기와 쓰기가 모두 가능**하다.

```javascript
// x86_64
Interceptor.attach(target, {
  onEnter(args) {
    console.log('rax:', this.context.rax);
    console.log('rsp:', this.context.rsp);
    console.log('rip:', this.context.pc);   // pc는 모든 아키텍처에서 사용 가능

    // 레지스터 직접 수정
    this.context.rdi = ptr(0x1234);
  }
});

// ARM64
Interceptor.attach(target, {
  onEnter(args) {
    console.log('x0:', this.context.x0);
    console.log('x29 (fp):', this.context.fp);
    console.log('x30 (lr):', this.context.lr);
    console.log('sp:', this.context.sp);
    console.log('pc:', this.context.pc);
  }
});

// ARM
Interceptor.attach(target, {
  onEnter(args) {
    console.log('r0:', this.context.r0);
    console.log('lr:', this.context.lr);
    console.log('sp:', this.context.sp);
    console.log('cpsr:', this.context.cpsr);  // Thumb 모드 여부 확인
  }
});
```

**x86_64 레지스터 목록**: `rax`, `rcx`, `rdx`, `rbx`, `rsp`, `rbp`, `rsi`, `rdi`, `r8`~`r15`, `rip`

**ARM64 레지스터 목록**: `x0`~`x28`, `fp`(x29), `lr`(x30), `sp`, `pc`, `nzcv`

**ARM 레지스터 목록**: `r0`~`r12`, `sp`(r13), `lr`(r14), `pc`(r15), `cpsr`

##### errno / lastError

```javascript
// UNIX: errno 관찰 및 수정
Interceptor.attach(Module.getExportByName('libc.so', 'open'), {
  onLeave(retval) {
    if (retval.toInt32() === -1) {
      console.log('open() failed, errno:', this.errno);
      // errno를 EACCES(13)에서 0으로 바꾸고 반환값도 조작
      // (실제로 이렇게 하면 위험하지만 원리 설명 목적)
    }
  }
});

// Windows: GetLastError 관찰
Interceptor.attach(Module.getExportByName('kernel32.dll', 'CreateFileW'), {
  onLeave(retval) {
    if (retval.equals(ptr(-1))) {  // INVALID_HANDLE_VALUE
      console.log('CreateFileW failed, lastError:', this.lastError);
    }
  }
});
```

##### threadId

```javascript
Interceptor.attach(target, {
  onEnter(args) {
    console.log(`[thread ${this.threadId}] function called`);
  }
});
```

##### depth

`depth`는 현재 스레드에서 다른 Interceptor 콜백이 활성화된 수를 나타낸다. 즉, 후킹된 함수 A가 후킹된 함수 B를 호출하면, B의 `onEnter`에서 `this.depth`는 1이 된다.

```javascript
Interceptor.attach(funcA, {
  onEnter(args) {
    console.log('funcA depth:', this.depth); // 0 (최상위 호출)
  }
});

Interceptor.attach(funcB, {
  onEnter(args) {
    // funcA에서 funcB를 호출한 경우 depth는 1
    // 직접 호출된 경우 depth는 0
    console.log('funcB depth:', this.depth);
  }
});
```

##### this에 사용자 데이터 저장

`this` 객체에 임의의 속성을 추가하여 `onEnter`에서 `onLeave`로 데이터를 전달할 수 있다. **재귀 호출에서도 각 호출마다 독립적인 `this`가 생성**되므로 안전하다.

```javascript
Interceptor.attach(target, {
  onEnter(args) {
    // onLeave에서 사용할 데이터 저장
    this.path = args[0].readUtf8String();
    this.startTime = Date.now();
    this.buf = args[1];
  },
  onLeave(retval) {
    const elapsed = Date.now() - this.startTime;
    console.log(`${this.path}: ${retval.toInt32()} bytes in ${elapsed}ms`);
  }
});
```

---

### 2.3 onLeave(retval) 콜백

함수가 반환하는 시점에 호출된다. `retval`은 `InvocationReturnValue` 객체이며, `NativePointer`의 서브클래스이다.

#### retval 읽기

```javascript
Interceptor.attach(target, {
  onLeave(retval) {
    // NativePointer의 모든 메서드 사용 가능
    const intResult = retval.toInt32();
    const uintResult = retval.toUInt32();
    const ptrResult = retval;  // 그 자체가 NativePointer

    // 포인터가 가리키는 값 읽기
    if (!retval.isNull()) {
      const str = retval.readUtf8String();
      const data = retval.readByteArray(16);
    }
  }
});
```

#### retval.replace(newValue)

반환값을 교체한다. `retval`에 직접 대입하면 안 되고, 반드시 `replace()` 메서드를 사용해야 한다.

```javascript
Interceptor.attach(target, {
  onLeave(retval) {
    // 올바른 방법
    retval.replace(ptr(0));       // 반환값을 0으로 교체
    retval.replace(ptr(-1));      // 반환값을 -1로 교체
    retval.replace(ptr(42));      // 반환값을 42로 교체

    // 잘못된 방법 — 아무 효과 없음!
    // retval = ptr(0);  // ← 이렇게 하면 로컬 변수만 변경됨
  }
});
```

---

### 2.4 반환값 — InvocationListener

`Interceptor.attach()`는 `InvocationListener` 객체를 반환한다. 이 객체의 `detach()` 메서드로 후킹을 해제할 수 있다.

```javascript
const listener = Interceptor.attach(target, {
  onEnter(args) {
    console.log('called');
  }
});

// 나중에 후킹 해제
listener.detach();
```

**일회성 후킹 패턴**:

```javascript
// 함수가 한 번만 호출되면 자동 해제
const listener = Interceptor.attach(target, {
  onEnter(args) {
    console.log('first call captured!');
    listener.detach();
  }
});
```

**조건부 해제 패턴**:

```javascript
let callCount = 0;
const listener = Interceptor.attach(target, {
  onEnter(args) {
    callCount++;
    console.log(`call #${callCount}`);
    if (callCount >= 100) {
      console.log('enough data collected, detaching');
      listener.detach();
    }
  }
});
```

---

### 2.5 기본 사용 예제

#### libc read() 감시

```javascript
const readPtr = Module.getExportByName('libc.so', 'read');

Interceptor.attach(readPtr, {
  onEnter(args) {
    this.fd = args[0].toInt32();
    this.buf = args[1];
    this.count = args[2].toInt32();
  },
  onLeave(retval) {
    const bytesRead = retval.toInt32();
    if (bytesRead > 0 && this.fd > 2) {  // stdin/stdout/stderr 제외
      console.log(`read(fd=${this.fd}, count=${this.count}) => ${bytesRead}`);
      console.log(hexdump(this.buf, {
        offset: 0,
        length: Math.min(bytesRead, 128),
        header: true,
        ansi: true
      }));
    }
  }
});
```

#### malloc/free 추적

```javascript
const mallocPtr = Module.getExportByName(null, 'malloc');
const freePtr = Module.getExportByName(null, 'free');
const allocations = new Map();

Interceptor.attach(mallocPtr, {
  onEnter(args) {
    this.size = args[0].toUInt32();
  },
  onLeave(retval) {
    if (!retval.isNull()) {
      allocations.set(retval.toString(), {
        size: this.size,
        backtrace: Thread.backtrace(this.context, Backtracer.ACCURATE)
          .map(DebugSymbol.fromAddress)
      });
    }
  }
});

Interceptor.attach(freePtr, {
  onEnter(args) {
    const addr = args[0].toString();
    if (allocations.has(addr)) {
      allocations.delete(addr);
    }
  }
});

// 주기적으로 미해제 메모리 확인
setInterval(() => {
  console.log(`현재 미해제 할당: ${allocations.size}개`);
  for (const [addr, info] of allocations) {
    console.log(`  ${addr}: ${info.size} bytes`);
  }
}, 5000);
```

#### 여러 함수 동시 후킹

```javascript
const hooks = [
  { name: 'open',   module: 'libc.so' },
  { name: 'read',   module: 'libc.so' },
  { name: 'write',  module: 'libc.so' },
  { name: 'close',  module: 'libc.so' },
];

const listeners = hooks.map(({ name, module }) => {
  const addr = Module.getExportByName(module, name);
  return Interceptor.attach(addr, {
    onEnter(args) {
      console.log(`[${this.threadId}] ${name}(${args[0]}, ...)`);
    }
  });
});

// 전체 해제
function detachAll() {
  listeners.forEach(l => l.detach());
}
```

---

## 3. C 구현 콜백 (CModule / RustModule)

JavaScript 콜백은 사용하기 편리하지만, 빈번하게 호출되는 함수에서는 JS↔Native 전환 비용이 부담될 수 있다. `CModule` 또는 `RustModule`을 사용하면 콜백을 C/Rust로 구현하여 성능을 크게 개선할 수 있다.

### CModule 기본 사용

```javascript
const cm = new CModule(`
#include <gum/guminvocationlistener.h>
#include <stdio.h>

void onEnter(GumInvocationContext *ic) {
  int fd = (int) gum_invocation_context_get_nth_argument(ic, 0);
  void *buf = gum_invocation_context_get_nth_argument(ic, 1);
  size_t count = (size_t) gum_invocation_context_get_nth_argument(ic, 2);

  if (fd > 2) {
    // 빈번한 호출에서도 오버헤드 최소화
    // JS로 데이터를 보내지 않으므로 매우 빠름
  }
}

void onLeave(GumInvocationContext *ic) {
  int retval = (int) gum_invocation_context_get_return_value(ic);
  // ...
}
`);

const readPtr = Module.getExportByName('libc.so', 'read');
Interceptor.attach(readPtr, {
  onEnter: cm.onEnter,
  onLeave: cm.onLeave
});
```

### CModule에서 JS 함수 호출

C에서 필터링하고, 조건에 맞는 경우만 JS로 전달하는 하이브리드 패턴이다.

```javascript
const cm = new CModule(`
#include <gum/guminvocationlistener.h>

extern void notifyJs(int fd, int bytesRead);

void onEnter(GumInvocationContext *ic) {
  int fd = (int) gum_invocation_context_get_nth_argument(ic, 0);
  // fd를 replace data에 저장
  *((int *) gum_invocation_context_get_listener_function_invocation_data(ic)) = fd;
}

void onLeave(GumInvocationContext *ic) {
  int fd = *((int *) gum_invocation_context_get_listener_function_invocation_data(ic));
  int retval = (int) gum_invocation_context_get_return_value(ic);

  // 특정 조건에서만 JS로 알림 (예: 1024바이트 이상 읽은 경우)
  if (retval > 1024) {
    notifyJs(fd, retval);
  }
}
`, {
  notifyJs: new NativeCallback((fd, bytesRead) => {
    console.log(`large read: fd=${fd}, bytes=${bytesRead}`);
  }, 'void', ['int', 'int'])
});

Interceptor.attach(readPtr, {
  onEnter: cm.onEnter,
  onLeave: cm.onLeave
});
```

### data 매개변수 사용

`attach()`의 세 번째 인수 `data`는 C 콜백에서 `gum_invocation_context_get_listener_function_data()`로 접근할 수 있다. 여러 함수에 같은 콜백을 사용하면서 함수별 설정을 전달할 때 유용하다.

```javascript
const cm = new CModule(`
#include <gum/guminvocationlistener.h>
#include <stdio.h>

typedef struct {
  const char *name;
  int log_level;
} HookConfig;

void onEnter(GumInvocationContext *ic) {
  HookConfig *config = (HookConfig *)
    gum_invocation_context_get_listener_function_data(ic);

  if (config->log_level >= 2) {
    // verbose 로깅
  }
}
`);

// 함수별 설정 데이터 할당
const configA = Memory.alloc(Process.pointerSize * 2);
configA.writePointer(Memory.allocUtf8String('funcA'));
configA.add(Process.pointerSize).writeInt(2);

const configB = Memory.alloc(Process.pointerSize * 2);
configB.writePointer(Memory.allocUtf8String('funcB'));
configB.add(Process.pointerSize).writeInt(1);

Interceptor.attach(funcAPtr, { onEnter: cm.onEnter }, configA);
Interceptor.attach(funcBPtr, { onEnter: cm.onEnter }, configB);
```

### invocation data vs listener function data

CModule에서 사용할 수 있는 두 가지 데이터 저장소가 있다.

| API | 수명 | 용도 |
|-----|------|------|
| `gum_invocation_context_get_listener_function_data()` | `attach()` 호출 시 전달, 영구 | 함수별 고정 설정 |
| `gum_invocation_context_get_listener_function_invocation_data()` | 각 호출마다 생성/소멸 | onEnter→onLeave 데이터 전달 (JS의 `this` 역할) |

### RustModule

Rust로 콜백을 구현할 수도 있다. CModule과 동일한 인터페이스를 사용하되, Rust 소스 코드를 전달한다.

```javascript
const rm = new RustModule(`
use gum::interceptor::InvocationContext;

#[no_mangle]
pub extern "C" fn on_enter(ic: &mut InvocationContext) {
    let arg0 = ic.get_nth_argument::<usize>(0);
    // ...
}
`);

Interceptor.attach(target, { onEnter: rm.on_enter });
```

---

## 4. Interceptor.replace(target, replacement[, data])

함수의 구현을 완전히 교체한다. `attach()`와 달리 원본 함수는 실행되지 않으며, `replacement`로 제공한 함수가 대신 실행된다.

### 매개변수

| 매개변수 | 타입 | 설명 |
|----------|------|------|
| `target` | `NativePointer` | 교체할 함수의 주소 |
| `replacement` | `NativeCallback` 또는 `NativePointer` | 대체 구현 |
| `data` | `NativePointer` (선택) | C 콜백용 사용자 데이터 |

### 기본 사용

```javascript
const openPtr = Module.getExportByName('libc.so', 'open');

// 원본 함수를 호출할 수 있도록 NativeFunction으로 래핑
const openOriginal = new NativeFunction(openPtr, 'int', ['pointer', 'int', 'int']);

Interceptor.replace(openPtr, new NativeCallback((pathPtr, flags, mode) => {
  const path = pathPtr.readUtf8String();
  console.log(`open("${path}", ${flags}, ${mode})`);

  // 원본 함수 호출
  const result = openOriginal(pathPtr, flags, mode);
  console.log(`  => fd ${result}`);
  return result;
}, 'int', ['pointer', 'int', 'int']));
```

### 원본 함수 호출 시 주의사항

`replace()` 후 원본 함수를 호출하려면, **`replace()` 호출 전에** `NativeFunction`을 생성해 두거나, `Interceptor.flush()` 후에 생성해야 한다.

```javascript
// 올바른 패턴: replace() 전에 NativeFunction 생성
const originalFunc = new NativeFunction(targetPtr, 'int', ['pointer']);
Interceptor.replace(targetPtr, new NativeCallback((arg) => {
  return originalFunc(arg);  // 원본 호출
}, 'int', ['pointer']));

// 또는: flush()로 명시적 동기화
Interceptor.replace(targetPtr, new NativeCallback(...));
Interceptor.flush();
const originalFunc = new NativeFunction(targetPtr, 'int', ['pointer']);
// ← 이 시점에서 targetPtr은 이미 교체되어 있으므로,
//    originalFunc는 replacement를 가리킴. 원본 호출 불가!
// ※ 따라서 반드시 replace() 전에 NativeFunction을 만들어야 한다.
```

**중요**: `replace()` 후 `NativeFunction(targetPtr, ...)`을 새로 생성하면, 교체된 구현을 가리키게 된다. 원본을 호출하려면 반드시 교체 전에 `NativeFunction`을 준비해 두어야 한다.

### 함수 완전 차단 (원본 호출 안 함)

```javascript
const targetPtr = Module.getExportByName('libapp.so', 'check_license');

// 항상 true(1) 반환, 원본은 절대 호출되지 않음
Interceptor.replace(targetPtr, new NativeCallback(() => {
  return 1;
}, 'int', []));
```

### CModule을 사용한 replace

```javascript
const cm = new CModule(`
#include <gum/guminterceptor.h>

extern int original_open(const char *path, int flags, int mode);

int replacement_open(const char *path, int flags, int mode) {
  // 특정 파일 접근 차단
  if (strstr(path, "/proc/self/maps") != NULL) {
    return -1;  // 접근 거부
  }
  return original_open(path, flags, mode);
}
`, {
  original_open: new NativeFunction(openPtr, 'int', ['pointer', 'int', 'int'])
});

Interceptor.replace(openPtr, cm.replacement_open);
```

---

## 5. Interceptor.replaceFast(target, replacement)

`replace()`와 동일하게 함수를 교체하지만, 더 낮은 런타임 오버헤드를 제공한다. 핵심 차이점은 **반환값이 원본 함수를 호출하기 위한 `NativePointer`**라는 것이다.

### 매개변수와 반환값

| 매개변수 | 타입 | 설명 |
|----------|------|------|
| `target` | `NativePointer` | 교체할 함수의 주소 |
| `replacement` | `NativeCallback` | 대체 구현 |
| **반환값** | `NativePointer` | **원본 함수 호출용 포인터** |

### 사용법

```javascript
const targetPtr = Module.getExportByName('libc.so', 'open');

const origPtr = Interceptor.replaceFast(targetPtr, new NativeCallback((pathPtr, flags, mode) => {
  const path = pathPtr.readUtf8String();
  console.log(`open("${path}")`);

  // 반드시 origPtr로 만든 NativeFunction으로 원본 호출
  return callOriginal(pathPtr, flags, mode);
}, 'int', ['pointer', 'int', 'int']));

// origPtr을 NativeFunction으로 래핑
const callOriginal = new NativeFunction(origPtr, 'int', ['pointer', 'int', 'int']);
```

### replace() vs replaceFast() 비교

| 특성 | replace() | replaceFast() |
|------|-----------|---------------|
| 오버헤드 | 보통 | 낮음 |
| 원본 호출 방법 | 교체 전에 NativeFunction 생성 | 반환된 포인터로 NativeFunction 생성 |
| data 매개변수 | 지원 | 미지원 |
| CModule 지원 | O | O |
| revert() 지원 | O | O |

### 주의사항

`replaceFast()`가 반환한 포인터는 **반드시** 원본 함수를 호출할 때만 사용해야 한다. 이 포인터는 Gum 내부 트램펄린을 가리키며, `revert()` 후에는 무효화된다.

---

## 6. Interceptor.revert(target)

`replace()` 또는 `replaceFast()`로 교체한 함수를 원래 구현으로 복원한다.

### 사용법

```javascript
const targetPtr = Module.getExportByName('libc.so', 'open');

// 교체
Interceptor.replace(targetPtr, new NativeCallback(() => -1, 'int', ['pointer', 'int', 'int']));

// 복원
Interceptor.revert(targetPtr);
```

### 주의사항

- `attach()`로 설정한 후킹은 `revert()`로 해제할 수 없다. `attach()`의 반환값인 `InvocationListener.detach()`를 사용해야 한다.
- `revert()` 후 해당 함수에 대한 `replaceFast()`가 반환한 포인터는 무효화된다. 이 포인터로 함수를 호출하면 크래시가 발생할 수 있다.

---

## 7. Interceptor.detachAll()

`attach()`로 등록한 **모든** 리스너를 일괄 해제한다.

```javascript
// 스크립트 종료 시 정리
Script.bindWeak(globalThis, () => {
  Interceptor.detachAll();
});
```

**`replace()`/`replaceFast()`에는 영향 없음**: `detachAll()`은 `attach()` 리스너만 해제한다. 함수 교체를 복원하려면 각각 `revert()`를 호출해야 한다.

---

## 8. Interceptor.flush()

보류 중인 `attach()`/`replace()` 변경사항을 즉시 메모리에 기록한다.

### 필요한 경우

Frida는 일반적으로 JS 코드 실행이 끝난 후(이벤트 루프로 제어가 돌아갈 때) 또는 `send()` 호출 시 자동으로 flush를 수행한다. 하지만 다음 상황에서는 명시적으로 `flush()`를 호출해야 한다.

```javascript
// 상황 1: attach() 직후 NativeFunction으로 해당 함수를 직접 호출할 때
Interceptor.attach(target, {
  onEnter(args) {
    console.log('intercepted!');
  }
});
Interceptor.flush();  // ← 필수! 없으면 아래 호출이 후킹되지 않을 수 있음

const func = new NativeFunction(target, 'void', []);
func();  // 이제 'intercepted!'가 출력됨

// 상황 2: replace() 직후 교체된 함수를 호출할 때
Interceptor.replace(target, replacement);
Interceptor.flush();  // ← 필수!
// 이제 target 주소의 함수는 확실히 replacement를 실행

// 상황 3: 다른 스레드에서 이미 실행 중인 함수에 대한 후킹을 보장할 때
Interceptor.attach(busyFunc, callbacks);
Interceptor.flush();  // ← 다른 스레드에서의 다음 호출부터 확실히 후킹됨
```

### 불필요한 경우

```javascript
// send() 호출 시 자동 flush
Interceptor.attach(target, {
  onEnter(args) {
    send({ type: 'call', arg: args[0].toInt32() });
    // send() 내부에서 flush가 실행됨
  }
});

// 스크립트 초기화 완료 후 자동 flush
// rpc.exports에서 반환된 후 자동으로 flush됨
rpc.exports = {
  init() {
    Interceptor.attach(target, callbacks);
    // 이 함수 반환 후 자동 flush
  }
};
```

---

## 9. Interceptor.breakpointKind

**Barebone 백엔드 전용** 속성. `'soft'` (기본값) 또는 `'hard'`로 설정할 수 있다.

| 값 | 설명 |
|----|------|
| `'soft'` | 소프트웨어 브레이크포인트 사용 (기본값) |
| `'hard'` | 하드웨어 브레이크포인트 사용 |

```javascript
// 하드웨어 브레이크포인트로 변경
Interceptor.breakpointKind = 'hard';
```

일반적인 사용 환경(Frida의 기본 백엔드)에서는 이 속성을 변경할 필요가 없다. Barebone 백엔드는 운영 체제 없이 직접 하드웨어를 제어하는 특수 환경에서 사용된다.

---

## 10. 성능 고려사항

### 오버헤드 측정치

일반적인 환경에서의 근사 오버헤드이다. 실제 수치는 하드웨어, OS, 호출 패턴에 따라 달라진다.

| 구성 | 근사 오버헤드 (호출당) | 설명 |
|------|----------------------|------|
| `onEnter`만 | ~6 μs | 가장 가벼운 JS 콜백 |
| `onEnter` + `onLeave` | ~11 μs | 양방향 콜백 |
| CModule `onEnter`만 | ~0.5 μs | C 구현, JS 전환 없음 |
| CModule 양방향 | ~1 μs | C 구현, 양방향 |
| `replaceFast()` | ~0.1 μs | 가장 낮은 오버헤드 |
| `replace()` | ~0.3 μs | replaceFast보다 약간 높음 |

### 최적화 전략

#### 1. 불필요한 콜백 제거

```javascript
// 나쁨: onLeave를 사용하지 않지만 등록함
Interceptor.attach(target, {
  onEnter(args) {
    console.log(args[0]);
  },
  onLeave(retval) {
    // 비어 있음 — 불필요한 오버헤드
  }
});

// 좋음: 필요한 콜백만 등록
Interceptor.attach(target, {
  onEnter(args) {
    console.log(args[0]);
  }
});
```

#### 2. 빈번한 함수에는 CModule 사용

```javascript
// malloc은 초당 수만~수십만 번 호출될 수 있음
// JS 콜백은 심각한 성능 저하를 유발

// 나쁨: JS 콜백
Interceptor.attach(mallocPtr, {
  onEnter(args) {
    if (args[0].toUInt32() > 1024 * 1024) {
      send({ type: 'large-alloc', size: args[0].toUInt32() });
    }
  }
});

// 좋음: CModule로 필터링, 조건 충족 시에만 JS 호출
const cm = new CModule(`
#include <gum/guminvocationlistener.h>

extern void onLargeAlloc(size_t size);

void onEnter(GumInvocationContext *ic) {
  size_t size = (size_t) gum_invocation_context_get_nth_argument(ic, 0);
  if (size > 1024 * 1024) {
    onLargeAlloc(size);
  }
}
`, {
  onLargeAlloc: new NativeCallback((size) => {
    send({ type: 'large-alloc', size });
  }, 'void', ['size_t'])
});

Interceptor.attach(mallocPtr, { onEnter: cm.onEnter });
```

#### 3. send() 배치 처리

```javascript
// 나쁨: 매 호출마다 send()
Interceptor.attach(target, {
  onEnter(args) {
    send({ type: 'call', value: args[0].toInt32() });
  }
});

// 좋음: 버퍼에 모아서 한꺼번에 전송
const buffer = [];
const BATCH_SIZE = 100;

Interceptor.attach(target, {
  onEnter(args) {
    buffer.push(args[0].toInt32());
    if (buffer.length >= BATCH_SIZE) {
      send({ type: 'calls', values: buffer.splice(0) });
    }
  }
});

// 주기적으로 남은 데이터 전송
setInterval(() => {
  if (buffer.length > 0) {
    send({ type: 'calls', values: buffer.splice(0) });
  }
}, 1000);
```

#### 4. 문자열 읽기 최소화

```javascript
// 나쁨: 매번 문자열 읽기
Interceptor.attach(openPtr, {
  onEnter(args) {
    const path = args[0].readUtf8String();  // 매 호출마다 문자열 복사
    console.log(path);
  }
});

// 좋음: 조건부 문자열 읽기
Interceptor.attach(openPtr, {
  onEnter(args) {
    // 먼저 첫 바이트만 확인하여 관심 있는 경로인지 빠르게 판별
    const firstByte = args[0].readU8();
    if (firstByte === 0x2F) {  // '/'로 시작하는 절대 경로만
      const path = args[0].readUtf8String();
      if (path.startsWith('/data/data/')) {
        console.log('app file access:', path);
      }
    }
  }
});
```

#### 5. console.log 대신 send 사용

```javascript
// 나쁨: console.log는 내부적으로 send + 포매팅
Interceptor.attach(target, {
  onEnter(args) {
    console.log('arg0=' + args[0] + ', arg1=' + args[1]);
  }
});

// 좋음: 구조화된 데이터로 send
Interceptor.attach(target, {
  onEnter(args) {
    send({
      type: 'trace',
      fn: 'target',
      args: [args[0].toString(), args[1].toString()]
    });
  }
});
```

---

## 11. 실전 패턴

### 11.1 SSL 핀닝 우회

Android 앱의 SSL 인증서 핀닝을 무력화하는 패턴이다.

#### OkHttp3 CertificatePinner (Java 레벨)

```javascript
// Java 레벨에서의 SSL 핀닝 우회
Java.perform(() => {
  const CertificatePinner = Java.use('okhttp3.CertificatePinner');
  CertificatePinner.check.overload('java.lang.String', 'java.util.List')
    .implementation = function (hostname, peerCertificates) {
      console.log(`[SSL Pin] bypassed for: ${hostname}`);
      // 아무것도 하지 않음 — 검증 건너뜀
    };
});
```

#### 네이티브 레벨 SSL_CTX_set_verify

```javascript
// OpenSSL의 SSL_CTX_set_verify를 후킹하여 인증서 검증 콜백 무력화
const SSL_CTX_set_verify = Module.getExportByName('libssl.so', 'SSL_CTX_set_verify');

Interceptor.attach(SSL_CTX_set_verify, {
  onEnter(args) {
    // args[0] = SSL_CTX*
    // args[1] = mode (SSL_VERIFY_PEER = 0x01)
    // args[2] = verify_callback

    console.log(`SSL_CTX_set_verify mode: ${args[1].toInt32()}`);

    // mode를 SSL_VERIFY_NONE(0)으로 변경
    args[1] = ptr(0);

    // verify_callback을 NULL로 변경
    args[2] = ptr(0);
  }
});
```

#### SSL_set_verify (연결별)

```javascript
const SSL_set_verify = Module.getExportByName('libssl.so', 'SSL_set_verify');

Interceptor.replace(SSL_set_verify,
  new NativeCallback((ssl, mode, callback) => {
    console.log('[SSL] SSL_set_verify bypassed');
    // 원본 호출하되 mode=0, callback=NULL
    originalSetVerify(ssl, 0, ptr(0));
  }, 'void', ['pointer', 'int', 'pointer'])
);

const originalSetVerify = new NativeFunction(SSL_set_verify,
  'void', ['pointer', 'int', 'pointer']);
```

#### BoringSSL (Android 최신 버전)

```javascript
// Android의 BoringSSL은 libssl.so 대신 conscrypt에 내장됨
const conscrypt = Process.getModuleByName('libconscrypt_jni.so');

// SSL_CTX_set_custom_verify를 찾아서 후킹
const symbols = conscrypt.enumerateExports();
const setCustomVerify = symbols.find(s => s.name.includes('SSL_CTX_set_custom_verify'));

if (setCustomVerify) {
  Interceptor.attach(setCustomVerify.address, {
    onEnter(args) {
      // args[1] = mode, args[2] = callback
      args[1] = ptr(0);  // SSL_VERIFY_NONE
      args[2] = ptr(0);  // no callback
      console.log('[BoringSSL] custom verify bypassed');
    }
  });
}
```

---

### 11.2 파일 접근 감시

프로세스의 파일 시스템 접근을 추적하는 패턴이다.

#### 기본 파일 I/O 감시

```javascript
const openPtr = Module.getExportByName('libc.so', 'open');
const openatPtr = Module.getExportByName('libc.so', 'openat');
const readPtr = Module.getExportByName('libc.so', 'read');
const writePtr = Module.getExportByName('libc.so', 'write');
const closePtr = Module.getExportByName('libc.so', 'close');

// fd → 파일 경로 매핑 테이블
const fdMap = new Map();

Interceptor.attach(openPtr, {
  onEnter(args) {
    this.path = args[0].readUtf8String();
    this.flags = args[1].toInt32();
  },
  onLeave(retval) {
    const fd = retval.toInt32();
    if (fd >= 0) {
      fdMap.set(fd, this.path);
      const flagStr = (this.flags & 3) === 0 ? 'O_RDONLY'
                    : (this.flags & 3) === 1 ? 'O_WRONLY'
                    : 'O_RDWR';
      console.log(`open("${this.path}", ${flagStr}) => fd ${fd}`);
    }
  }
});

Interceptor.attach(openatPtr, {
  onEnter(args) {
    this.dirfd = args[0].toInt32();
    this.path = args[1].readUtf8String();
    this.flags = args[2].toInt32();
  },
  onLeave(retval) {
    const fd = retval.toInt32();
    if (fd >= 0) {
      const prefix = this.dirfd === -100 ? '' : `[dirfd=${this.dirfd}]`;
      fdMap.set(fd, this.path);
      console.log(`openat(${prefix}"${this.path}") => fd ${fd}`);
    }
  }
});

Interceptor.attach(readPtr, {
  onEnter(args) {
    this.fd = args[0].toInt32();
    this.buf = args[1];
    this.count = args[2].toInt32();
  },
  onLeave(retval) {
    const bytesRead = retval.toInt32();
    if (bytesRead > 0) {
      const path = fdMap.get(this.fd) || `fd:${this.fd}`;
      console.log(`read("${path}", ${bytesRead}/${this.count} bytes)`);
    }
  }
});

Interceptor.attach(writePtr, {
  onEnter(args) {
    const fd = args[0].toInt32();
    const count = args[2].toInt32();
    const path = fdMap.get(fd) || `fd:${fd}`;
    console.log(`write("${path}", ${count} bytes)`);

    // 쓰기 내용 미리보기 (선택)
    if (count <= 256) {
      try {
        const data = args[1].readUtf8String(count);
        console.log(`  content: ${data.substring(0, 100)}`);
      } catch (e) {
        // 바이너리 데이터 — UTF-8이 아님
      }
    }
  }
});

Interceptor.attach(closePtr, {
  onEnter(args) {
    const fd = args[0].toInt32();
    const path = fdMap.get(fd);
    if (path) {
      console.log(`close(fd=${fd}, "${path}")`);
      fdMap.delete(fd);
    }
  }
});
```

#### 특정 파일 접근 차단

```javascript
const openOriginal = new NativeFunction(openPtr, 'int', ['pointer', 'int', 'int']);

Interceptor.replace(openPtr, new NativeCallback((pathPtr, flags, mode) => {
  const path = pathPtr.readUtf8String();

  // 안티디버깅 파일 접근 차단
  const blockedPaths = [
    '/proc/self/status',
    '/proc/self/maps',
    '/proc/self/task',
    '/sys/kernel/debug',
  ];

  if (blockedPaths.some(p => path.includes(p))) {
    console.log(`[BLOCKED] open("${path}") => ENOENT`);
    return -1;  // 파일 없음으로 위장
  }

  return openOriginal(pathPtr, flags, mode);
}, 'int', ['pointer', 'int', 'int']));
```

#### 파일 내용 변조 (읽기 결과 수정)

```javascript
Interceptor.attach(readPtr, {
  onEnter(args) {
    this.fd = args[0].toInt32();
    this.buf = args[1];
  },
  onLeave(retval) {
    const bytesRead = retval.toInt32();
    const path = fdMap.get(this.fd);

    // /proc/self/status에서 TracerPid를 0으로 변조 (안티디버깅 우회)
    if (path === '/proc/self/status' && bytesRead > 0) {
      const content = this.buf.readUtf8String(bytesRead);
      const modified = content.replace(/TracerPid:\s+\d+/, 'TracerPid:\t0');
      this.buf.writeUtf8String(modified);
      console.log('[SPOOF] TracerPid set to 0');
    }
  }
});
```

---

### 11.3 네트워크 요청 로깅

#### socket/connect 기반 로깅

```javascript
const connectPtr = Module.getExportByName('libc.so', 'connect');
const sendPtr = Module.getExportByName('libc.so', 'send');
const recvPtr = Module.getExportByName('libc.so', 'recv');
const sendtoPtr = Module.getExportByName('libc.so', 'sendto');
const recvfromPtr = Module.getExportByName('libc.so', 'recvfrom');

// fd → 연결 정보 매핑
const socketMap = new Map();

Interceptor.attach(connectPtr, {
  onEnter(args) {
    this.fd = args[0].toInt32();
    this.sockaddr = args[1];
    this.addrlen = args[2].toInt32();
  },
  onLeave(retval) {
    if (retval.toInt32() === 0 || this.errno === 115 /* EINPROGRESS */) {
      const family = this.sockaddr.readU16();

      if (family === 2) {  // AF_INET
        const port = (this.sockaddr.add(2).readU8() << 8) |
                      this.sockaddr.add(3).readU8();
        const ip = [
          this.sockaddr.add(4).readU8(),
          this.sockaddr.add(5).readU8(),
          this.sockaddr.add(6).readU8(),
          this.sockaddr.add(7).readU8()
        ].join('.');

        socketMap.set(this.fd, { ip, port, family: 'IPv4' });
        console.log(`connect(fd=${this.fd}) => ${ip}:${port}`);
      } else if (family === 10) {  // AF_INET6
        const port = (this.sockaddr.add(2).readU8() << 8) |
                      this.sockaddr.add(3).readU8();
        // IPv6 주소 읽기 (16바이트)
        const addrBytes = this.sockaddr.add(8).readByteArray(16);
        socketMap.set(this.fd, { port, family: 'IPv6' });
        console.log(`connect(fd=${this.fd}) => [IPv6]:${port}`);
      }
    }
  }
});

Interceptor.attach(sendPtr, {
  onEnter(args) {
    const fd = args[0].toInt32();
    const len = args[2].toInt32();
    const info = socketMap.get(fd);

    if (info) {
      console.log(`send(${info.ip}:${info.port}, ${len} bytes)`);

      // HTTP 요청 감지
      if (len > 4) {
        try {
          const head = args[1].readUtf8String(Math.min(len, 256));
          if (head.startsWith('GET ') || head.startsWith('POST ') ||
              head.startsWith('PUT ') || head.startsWith('DELETE ')) {
            const firstLine = head.split('\r\n')[0];
            console.log(`  HTTP: ${firstLine}`);
          }
        } catch (e) { /* 바이너리 데이터 */ }
      }
    }
  }
});

Interceptor.attach(recvPtr, {
  onEnter(args) {
    this.fd = args[0].toInt32();
    this.buf = args[1];
  },
  onLeave(retval) {
    const bytesRecv = retval.toInt32();
    const info = socketMap.get(this.fd);

    if (info && bytesRecv > 0) {
      console.log(`recv(${info.ip}:${info.port}, ${bytesRecv} bytes)`);

      // HTTP 응답 감지
      try {
        const head = this.buf.readUtf8String(Math.min(bytesRecv, 256));
        if (head.startsWith('HTTP/')) {
          const statusLine = head.split('\r\n')[0];
          console.log(`  HTTP Response: ${statusLine}`);
        }
      } catch (e) { /* 바이너리 데이터 */ }
    }
  }
});
```

#### SSL_read/SSL_write 후킹 (HTTPS 트래픽)

```javascript
// 복호화된 HTTPS 트래픽을 볼 수 있음
const SSL_read = Module.getExportByName('libssl.so', 'SSL_read');
const SSL_write = Module.getExportByName('libssl.so', 'SSL_write');

Interceptor.attach(SSL_read, {
  onEnter(args) {
    this.ssl = args[0];
    this.buf = args[1];
    this.num = args[2].toInt32();
  },
  onLeave(retval) {
    const bytesRead = retval.toInt32();
    if (bytesRead > 0) {
      console.log(`\n=== SSL_read (${bytesRead} bytes) ===`);
      console.log(hexdump(this.buf, {
        length: Math.min(bytesRead, 512),
        header: true,
        ansi: false
      }));

      // 텍스트로도 출력 시도
      try {
        const text = this.buf.readUtf8String(bytesRead);
        console.log('--- text ---');
        console.log(text.substring(0, 1024));
      } catch (e) { /* 바이너리 */ }
    }
  }
});

Interceptor.attach(SSL_write, {
  onEnter(args) {
    const buf = args[1];
    const num = args[2].toInt32();

    console.log(`\n=== SSL_write (${num} bytes) ===`);
    console.log(hexdump(buf, {
      length: Math.min(num, 512),
      header: true,
      ansi: false
    }));

    try {
      const text = buf.readUtf8String(num);
      console.log('--- text ---');
      console.log(text.substring(0, 1024));
    } catch (e) { /* 바이너리 */ }
  }
});
```

---

### 11.4 암호화 함수 키 추출

#### AES 키 추출 (OpenSSL)

```javascript
// OpenSSL AES_set_encrypt_key에서 키 추출
const AES_set_encrypt_key = Module.getExportByName('libcrypto.so', 'AES_set_encrypt_key');

Interceptor.attach(AES_set_encrypt_key, {
  onEnter(args) {
    const userKey = args[0];
    const bits = args[1].toInt32();  // 128, 192, 256
    const keyLen = bits / 8;

    console.log(`AES_set_encrypt_key(bits=${bits})`);
    console.log('Key:', hexdump(userKey, { length: keyLen, header: false, ansi: false }));

    // 키를 바이트 배열로 추출
    const keyBytes = userKey.readByteArray(keyLen);
    send({ type: 'aes-key', bits, key: keyBytes });
  }
});
```

#### EVP 인터페이스 (범용 암호화)

```javascript
// EVP_CipherInit_ex — 범용 암호화 초기화
const EVP_CipherInit_ex = Module.getExportByName('libcrypto.so', 'EVP_CipherInit_ex');

Interceptor.attach(EVP_CipherInit_ex, {
  onEnter(args) {
    // args[0] = EVP_CIPHER_CTX *ctx
    // args[1] = EVP_CIPHER *type (알고리즘)
    // args[2] = ENGINE *impl
    // args[3] = unsigned char *key
    // args[4] = unsigned char *iv
    // args[5] = int enc (1=encrypt, 0=decrypt)

    const key = args[3];
    const iv = args[4];
    const enc = args[5].toInt32();

    if (!key.isNull()) {
      console.log(`EVP_CipherInit_ex(${enc ? 'ENCRYPT' : 'DECRYPT'})`);
      console.log('Key:', hexdump(key, { length: 32, header: false }));
    }
    if (!iv.isNull()) {
      console.log('IV:', hexdump(iv, { length: 16, header: false }));
    }
  }
});
```

#### Android KeyStore에서 키 추출

```javascript
Java.perform(() => {
  const SecretKeySpec = Java.use('javax.crypto.spec.SecretKeySpec');
  const Cipher = Java.use('javax.crypto.Cipher');

  // SecretKeySpec 생성 시 키 추출
  SecretKeySpec.$init.overload('[B', 'java.lang.String')
    .implementation = function (keyBytes, algorithm) {
      const key = Java.array('byte', keyBytes);
      console.log(`SecretKeySpec(algorithm=${algorithm})`);
      console.log('Key bytes:', Array.from(key).map(b =>
        ('0' + ((b & 0xff).toString(16))).slice(-2)
      ).join(' '));

      return this.$init(keyBytes, algorithm);
    };

  // Cipher.init에서 IV 추출
  Cipher.init.overload('int', 'java.security.Key', 'java.security.spec.AlgorithmParameterSpec')
    .implementation = function (opmode, key, params) {
      const mode = opmode === 1 ? 'ENCRYPT' : 'DECRYPT';
      console.log(`Cipher.init(${mode})`);

      try {
        const IvParameterSpec = Java.use('javax.crypto.spec.IvParameterSpec');
        const ivSpec = Java.cast(params, IvParameterSpec);
        const ivBytes = Java.array('byte', ivSpec.getIV());
        console.log('IV:', Array.from(ivBytes).map(b =>
          ('0' + ((b & 0xff).toString(16))).slice(-2)
        ).join(' '));
      } catch (e) {
        // IvParameterSpec이 아닌 경우
      }

      return this.init(opmode, key, params);
    };
});
```

---

### 11.5 반환값 조작

#### 루트 감지 우회

```javascript
// Android 루트 감지에서 자주 확인하는 파일
const accessPtr = Module.getExportByName('libc.so', 'access');
const accessOriginal = new NativeFunction(accessPtr, 'int', ['pointer', 'int']);

const rootIndicators = [
  '/system/app/Superuser.apk',
  '/system/xbin/su',
  '/sbin/su',
  '/data/local/su',
  '/data/local/bin/su',
  '/system/bin/su',
  '/su/bin/su',
  '/magisk',
];

Interceptor.replace(accessPtr, new NativeCallback((pathPtr, mode) => {
  const path = pathPtr.readUtf8String();

  if (rootIndicators.some(r => path.includes(r))) {
    console.log(`[ROOT HIDE] access("${path}") => -1 (ENOENT)`);
    return -1;
  }

  return accessOriginal(pathPtr, mode);
}, 'int', ['pointer', 'int']));
```

#### 시간 조작

```javascript
const timePtr = Module.getExportByName('libc.so', 'time');
const timeOriginal = new NativeFunction(timePtr, 'long', ['pointer']);

const FAKE_TIMESTAMP = 1700000000;  // 고정 시간

Interceptor.replace(timePtr, new NativeCallback((tloc) => {
  const result = ptr(FAKE_TIMESTAMP);

  if (!tloc.isNull()) {
    tloc.writeS64(FAKE_TIMESTAMP);
  }

  console.log(`time() => ${FAKE_TIMESTAMP} (spoofed)`);
  return FAKE_TIMESTAMP;
}, 'long', ['pointer']));
```

#### 조건부 반환값 변경

```javascript
// 특정 조건에서만 반환값 변경
Interceptor.attach(targetFunc, {
  onEnter(args) {
    this.shouldModify = args[0].toInt32() === 42;
  },
  onLeave(retval) {
    if (this.shouldModify) {
      const original = retval.toInt32();
      retval.replace(ptr(original * 2));  // 반환값을 두 배로
      console.log(`modified return: ${original} => ${original * 2}`);
    }
  }
});
```

#### 에러를 성공으로 변조

```javascript
// 라이선스 체크 함수가 0(실패)을 반환하면 1(성공)로 변경
Interceptor.attach(checkLicensePtr, {
  onLeave(retval) {
    const result = retval.toInt32();
    if (result === 0) {
      retval.replace(ptr(1));
      console.log('[LICENSE] check bypassed: 0 => 1');
    }
  }
});
```

---

### 11.6 인수 교체 (문자열)

#### 파일 경로 리다이렉트

```javascript
const openPtr = Module.getExportByName('libc.so', 'open');

// 메모리 누수 방지: 교체 문자열은 전역에 할당
const redirectMap = {
  '/etc/original.conf': Memory.allocUtf8String('/data/local/tmp/modified.conf'),
  '/data/data/com.app/config.xml': Memory.allocUtf8String('/data/local/tmp/fake_config.xml'),
};

Interceptor.attach(openPtr, {
  onEnter(args) {
    const path = args[0].readUtf8String();
    const redirect = redirectMap[path];
    if (redirect) {
      console.log(`[REDIRECT] "${path}" => "${redirect.readUtf8String()}"`);
      args[0] = redirect;
    }
  }
});
```

**주의**: `Memory.allocUtf8String()`을 콜백 안에서 호출하면, 할당된 메모리가 GC에 의해 수거될 수 있다. 교체할 문자열은 반드시 콜백 바깥의 변수에 참조를 유지해야 한다.

```javascript
// 나쁨: GC에 의해 문자열 메모리가 해제될 수 있음
Interceptor.attach(openPtr, {
  onEnter(args) {
    args[0] = Memory.allocUtf8String('/tmp/fake');
    // ← 이 NativePointer를 참조하는 JS 변수가 없으므로
    //    GC가 수거하면 메모리가 해제되어 크래시 발생 가능
  }
});

// 좋음: 전역 변수에 참조 유지
const fakePath = Memory.allocUtf8String('/tmp/fake');
Interceptor.attach(openPtr, {
  onEnter(args) {
    args[0] = fakePath;  // fakePath가 전역에서 참조되므로 GC 안전
  }
});
```

#### 동적 문자열 교체

```javascript
// 콜백 안에서 동적으로 문자열을 생성해야 하는 경우
// 참조를 유지할 배열 사용
const allocatedStrings = [];

Interceptor.attach(targetPtr, {
  onEnter(args) {
    const original = args[0].readUtf8String();
    const modified = original.replace('debug', 'release');

    const newStr = Memory.allocUtf8String(modified);
    allocatedStrings.push(newStr);  // GC 방지
    args[0] = newStr;

    // 배열이 너무 커지지 않도록 관리
    if (allocatedStrings.length > 1000) {
      allocatedStrings.splice(0, 500);
    }
  }
});
```

#### 와이드 문자열(UTF-16) 교체 (Windows)

```javascript
const CreateFileW = Module.getExportByName('kernel32.dll', 'CreateFileW');

const fakePathW = Memory.allocUtf16String('C:\\temp\\fake.txt');

Interceptor.attach(CreateFileW, {
  onEnter(args) {
    const path = args[0].readUtf16String();
    if (path.includes('secret.dat')) {
      console.log(`[REDIRECT] "${path}" => fake`);
      args[0] = fakePathW;
    }
  }
});
```

---

### 11.7 재귀 함수에서 this 사용

Interceptor의 `this` 컨텍스트는 각 함수 호출마다 독립적으로 생성된다. 재귀 함수에서도 `this`에 저장한 데이터가 서로 간섭하지 않는다.

#### 재귀 함수 추적

```javascript
// 재귀적 디렉토리 탐색 함수 추적
const readdirPtr = Module.getExportByName('libc.so', 'opendir');

let recursionLevel = 0;

Interceptor.attach(readdirPtr, {
  onEnter(args) {
    this.path = args[0].readUtf8String();
    this.level = recursionLevel;
    recursionLevel++;

    const indent = '  '.repeat(this.level);
    console.log(`${indent}opendir("${this.path}") [depth=${this.level}]`);
  },
  onLeave(retval) {
    recursionLevel--;

    const indent = '  '.repeat(this.level);
    if (retval.isNull()) {
      console.log(`${indent}  => NULL (failed)`);
    } else {
      console.log(`${indent}  => ${retval}`);
    }
    // this.level은 이 특정 호출에서 설정한 값
    // 재귀의 다른 레벨과 독립적
  }
});
```

#### 재귀 팩토리얼 함수 예제

```javascript
// 재귀 함수의 this가 호출별로 독립적임을 보여주는 예제
const factorialPtr = Module.getExportByName('libmath.so', 'factorial');

Interceptor.attach(factorialPtr, {
  onEnter(args) {
    this.n = args[0].toInt32();
    this.entryTime = Date.now();
    console.log(`factorial(${this.n}) entered`);
  },
  onLeave(retval) {
    const elapsed = Date.now() - this.entryTime;
    const result = retval.toInt32();
    // this.n은 이 특정 호출에서의 n 값
    // factorial(5) → factorial(4) → ... 에서
    // 각 호출의 this.n은 5, 4, 3, 2, 1로 독립적
    console.log(`factorial(${this.n}) => ${result} (${elapsed}ms)`);
  }
});

// 출력 예:
// factorial(5) entered
// factorial(4) entered
// factorial(3) entered
// factorial(2) entered
// factorial(1) entered
// factorial(1) => 1 (0ms)
// factorial(2) => 2 (0ms)
// factorial(3) => 6 (0ms)
// factorial(4) => 24 (0ms)
// factorial(5) => 120 (1ms)
```

#### 스레드 안전성과 재귀

```javascript
// this는 스레드 간에도 독립적
// 멀티스레드 + 재귀 환경에서도 안전하게 동작

const targetPtr = Module.getExportByName('libapp.so', 'process_request');

Interceptor.attach(targetPtr, {
  onEnter(args) {
    // 각 스레드의 각 호출마다 독립적인 this
    this.threadId = this.threadId;  // Interceptor가 제공하는 threadId
    this.requestId = args[0].toInt32();
    this.startTime = Date.now();

    console.log(`[T${this.threadId}] process_request(${this.requestId}) enter`);
  },
  onLeave(retval) {
    const elapsed = Date.now() - this.startTime;
    console.log(`[T${this.threadId}] process_request(${this.requestId}) => ${retval} (${elapsed}ms)`);
    // 다른 스레드의 this.requestId와 절대 충돌하지 않음
  }
});
```

---

## 12. 주의사항

### ARM 32비트에서 LSB 확인

32비트 ARM에서 함수 주소의 최하위 비트(LSB)는 ARM 모드(0)와 Thumb 모드(1)를 구분한다. 잘못된 모드로 후킹하면 프로세스가 크래시한다.

```javascript
// Module.getExportByName()은 자동으로 올바른 LSB를 설정
const funcPtr = Module.getExportByName('libc.so', 'strlen');
// ← Thumb 함수라면 주소의 LSB가 1로 설정됨

// 수동으로 오프셋을 지정할 때는 직접 LSB 설정 필요
const base = Module.getBaseAddress('libapp.so');

// IDA에서 함수가 Thumb 모드인지 확인한 후:
const thumbFunc = base.add(0x1234).or(1);   // Thumb 모드
const armFunc = base.add(0x5678);            // ARM 모드

// LSB 확인
const addr = Module.getExportByName('libc.so', 'open');
const isThumb = addr.and(1).toInt32() === 1;
console.log(`open is ${isThumb ? 'Thumb' : 'ARM'} mode`);
```

### 메모리 누수 방지

`attach()` 후 `detach()`하지 않으면 리스너가 계속 메모리를 점유하고 콜백이 실행된다.

```javascript
// 나쁨: 리스너 참조를 잃어버림
function hookTemporarily() {
  Interceptor.attach(target, {
    onEnter(args) { /* ... */ }
  });
  // 반환값(listener)을 저장하지 않아 detach 불가
}

// 좋음: 리스너 참조 유지
const listeners = [];

function hookFunction(target, callbacks) {
  const listener = Interceptor.attach(target, callbacks);
  listeners.push(listener);
  return listener;
}

function cleanup() {
  listeners.forEach(l => l.detach());
  listeners.length = 0;
  // 또는 Interceptor.detachAll() 사용
}
```

### replace 후 revert 전까지 원본 함수 사라짐

```javascript
const targetPtr = Module.getExportByName('libc.so', 'getpid');

// replace() 전에 원본 보존
const getpidOriginal = new NativeFunction(targetPtr, 'int', []);

Interceptor.replace(targetPtr, new NativeCallback(() => {
  return 9999;
}, 'int', []));

// 이 시점에서 targetPtr을 직접 호출하면 replacement가 실행됨
// 원본을 호출하려면 getpidOriginal을 사용해야 함

// 복원
Interceptor.revert(targetPtr);
// 이제 targetPtr은 다시 원본 구현을 가리킴
```

### flush() 없이 즉시 호출하면 반영되지 않을 수 있음

```javascript
Interceptor.attach(target, {
  onEnter(args) {
    console.log('hooked!');
  }
});

// 나쁨: flush() 없이 즉시 호출
const func = new NativeFunction(target, 'void', []);
func();  // 'hooked!'가 출력되지 않을 수 있음

// 좋음: flush() 후 호출
Interceptor.attach(target, {
  onEnter(args) {
    console.log('hooked!');
  }
});
Interceptor.flush();

const func = new NativeFunction(target, 'void', []);
func();  // 'hooked!'가 확실히 출력됨
```

### 재진입(Reentrancy) 주의

콜백 안에서 후킹된 다른 함수를 호출하면 재진입이 발생할 수 있다.

```javascript
// 주의: console.log() 내부에서 write()가 호출됨
// write()도 후킹되어 있으면 무한 재귀 발생 가능
Interceptor.attach(writePtr, {
  onEnter(args) {
    // console.log → write() → onEnter → console.log → ...
    console.log('write called');  // 무한 루프!
  }
});

// 해결: 재진입 방지 플래그
let inCallback = false;

Interceptor.attach(writePtr, {
  onEnter(args) {
    if (inCallback) return;  // 재진입 방지
    inCallback = true;

    console.log('write called');

    inCallback = false;
  }
});

// 또는: send()로 데이터 전송 (write를 사용하지 않는 별도 채널)
Interceptor.attach(writePtr, {
  onEnter(args) {
    send({ type: 'write', fd: args[0].toInt32() });
  }
});
```

### 다중 후킹 충돌

같은 함수에 여러 번 `attach()`하면 모든 콜백이 순서대로 실행된다. 하지만 `replace()`를 여러 번 하면 마지막 것만 유효하다.

```javascript
// attach(): 순서대로 모두 실행됨
Interceptor.attach(target, { onEnter(args) { console.log('hook A'); } });
Interceptor.attach(target, { onEnter(args) { console.log('hook B'); } });
// target 호출 시 => "hook A" 출력 후 "hook B" 출력

// replace(): 마지막 것만 유효
Interceptor.replace(target, implA);
Interceptor.replace(target, implB);
// target 호출 시 => implB만 실행됨 (implA는 무시)
```

### 예외 처리

콜백에서 발생한 예외는 Frida가 포착하여 로그에 기록하지만, 원본 함수 실행에는 영향을 주지 않는다. 그러나 `replace()`에서의 예외는 프로세스 크래시를 유발할 수 있다.

```javascript
// attach() 콜백에서의 예외: 안전 (로그만 출력)
Interceptor.attach(target, {
  onEnter(args) {
    // 예외가 발생해도 원본 함수는 정상 실행됨
    const str = args[0].readUtf8String();  // 유효하지 않은 포인터면 예외
  }
});

// replace()에서의 예외: 위험 (크래시 가능)
Interceptor.replace(target, new NativeCallback(() => {
  // 여기서 예외가 발생하면 원본 함수도 실행되지 않고
  // 호출자에게 유효하지 않은 반환값이 전달됨
  throw new Error('oops');  // 위험!
}, 'int', []));

// 안전한 replace 패턴
const originalFunc = new NativeFunction(targetPtr, 'int', ['pointer']);
Interceptor.replace(targetPtr, new NativeCallback((arg) => {
  try {
    // 커스텀 로직
    return customLogic(arg);
  } catch (e) {
    console.log('error in replacement:', e);
    // 에러 발생 시 원본 함수로 폴백
    return originalFunc(arg);
  }
}, 'int', ['pointer']));
```

### iOS 환경 특수사항

```javascript
// iOS에서는 모듈 이름에 전체 경로가 필요한 경우가 있음
// getExportByName의 첫 번째 인수를 null로 하면 모든 모듈에서 검색
const objc_msgSend = Module.getExportByName(null, 'objc_msgSend');

// dyld 공유 캐시에 있는 함수는 Module.getExportByName으로 찾을 수 있지만
// 주소가 여러 모듈에 걸쳐 있을 수 있으므로 주의
const target = Module.getExportByName('libSystem.B.dylib', 'open');
```

---

> **참고**: 이 문서의 코드 예제는 Frida 16.x 기준으로 작성되었다. 버전에 따라 API 동작이 다를 수 있으므로, 공식 문서([frida.re](https://frida.re/docs/javascript-api/#interceptor))를 함께 참고할 것을 권장한다.
