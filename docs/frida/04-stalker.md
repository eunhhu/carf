# Stalker (코드 트레이싱) 레퍼런스

> Frida Stalker는 동적 바이너리 계측(DBI) 기반의 코드 트레이싱 엔진이다. 실행 중인 스레드의 모든 제어 흐름을 실시간으로 관찰하고 조작할 수 있다.

---

## 목차

1. [개요](#1-개요)
2. [동작 원리](#2-동작-원리)
3. [API 레퍼런스](#3-api-레퍼런스)
4. [Transform 콜백](#4-transform-콜백)
5. [이벤트 시스템](#5-이벤트-시스템)
6. [아키텍처별 Writer/Relocator](#6-아키텍처별-writerrelocator)
7. [성능 최적화](#7-성능-최적화)
8. [실전 활용 패턴](#8-실전-활용-패턴)
9. [CModule/RustModule 연동](#9-cmodulerustmodule-연동)
10. [주의사항 및 트러블슈팅](#10-주의사항-및-트러블슈팅)

---

## 1. 개요

Stalker는 Frida에 내장된 동적 코드 트레이싱 엔진으로, 대상 스레드의 모든 실행을 함수 호출(call), 반환(ret), 기본 블록(block), 개별 명령어(exec) 단위로 관찰할 수 있다.

### 1.1 핵심 특성

| 특성 | 설명 |
|------|------|
| **계측 단위** | 기본 블록(Basic Block) 단위로 복제 후 계측 |
| **지원 아키텍처** | AArch64 (ARM64), x86_64, IA-32 (x86) |
| **계측 방식** | JIT(Just-In-Time) 코드 변환 — 원본 코드를 별도 slab에 복제하고 계측 코드를 삽입 |
| **성능** | 네이티브에 가까운 속도. CModule 콜백 사용 시 오버헤드 최소화 |
| **스레드 안전성** | 스레드별 독립 추적. 여러 스레드 동시 follow 가능 |

### 1.2 Stalker vs Interceptor

| 비교 항목 | Stalker | Interceptor |
|-----------|---------|-------------|
| 관찰 범위 | 스레드의 모든 실행 흐름 | 특정 함수 진입/종료 |
| 오버헤드 | 상대적으로 높음 (전체 코드 계측) | 매우 낮음 (단일 함수 후킹) |
| 명령어 수준 접근 | 가능 (transform 콜백) | 불가 |
| 코드 변환 | 가능 (명령어 삽입/제거/변환) | 불가 |
| 사용 사례 | 코드 커버리지, 실행 경로 분석, 퍼징 | 함수 인수/반환값 모니터링, API 후킹 |

### 1.3 사용 시나리오

- **코드 커버리지 측정**: 퍼저와 연동하여 어떤 기본 블록이 실행되었는지 추적
- **함수 호출 그래프 생성**: 프로그램 전체의 호출 관계를 동적으로 수집
- **실행 경로 분석**: 특정 입력이 어떤 코드 경로를 따르는지 파악
- **자기 수정 코드(SMC) 감지**: 런타임에 코드를 변경하는 패킹/난독화 탐지
- **명령어 수준 계측**: 특정 명령어 패턴(예: 암호화 관련 명령)에 콜백 삽입

---

## 2. 동작 원리

### 2.1 기본 블록(Basic Block) 계측

Stalker는 코드를 **기본 블록** 단위로 처리한다. 기본 블록이란 분기 없이 순차적으로 실행되는 명령어의 시퀀스로, 하나의 진입점과 하나의 종료점을 가진다.

```
[원본 코드]                    [Stalker 계측 코드 (slab)]
┌─────────────┐               ┌──────────────────────┐
│ 명령어 1     │ ──복제+계측──> │ 이벤트 기록 코드       │
│ 명령어 2     │               │ 명령어 1 (재배치됨)    │
│ 명령어 3     │               │ 명령어 2 (재배치됨)    │
│ 분기 명령    │               │ 명령어 3 (재배치됨)    │
└─────────────┘               │ 분기 → Stalker 디스패처│
                               └──────────────────────┘
```

**동작 순서:**

1. Stalker가 대상 스레드의 실행을 가로챈다.
2. 현재 PC(Program Counter)에서 시작하는 기본 블록을 식별한다.
3. 해당 블록의 명령어를 slab 메모리에 복제하면서 계측 코드를 삽입한다.
4. 분기 명령은 Stalker의 디스패처로 리다이렉트하여 다음 블록도 같은 방식으로 처리한다.
5. 계측된 코드를 실행한다.

### 2.2 Slab 구조

Stalker는 계측된 코드를 저장하기 위해 **slab**이라는 대형 메모리 영역을 할당한다.

```
Slab (기본 4MB)
┌────────────────────────────────────────────────────┐
│ 헤더 (~333KB)                                       │
│ ┌──────────────────────────────────────────────┐    │
│ │ GumExecBlock 메타데이터 배열                    │    │
│ │  - real_begin / real_end (원본 코드 범위)       │    │
│ │  - code_begin / code_end (계측 코드 범위)       │    │
│ │  - real_snapshot (원본 코드 스냅샷)             │    │
│ │  - recycle_count (재사용 카운터)                │    │
│ └──────────────────────────────────────────────┘    │
│                                                     │
│ 테일 (~3.7MB)                                       │
│ ┌──────────────────────────────────────────────┐    │
│ │ 계측된 명령어들 (실제 실행되는 코드)             │    │
│ │ [Block 1 코드] [Block 2 코드] [Block 3 코드]... │    │
│ └──────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────┘
```

| 구성 요소 | 크기 | 역할 |
|-----------|------|------|
| **헤더** | ~333KB | `GumExecBlock` 메타데이터 배열. 원본-계측 코드 매핑 정보 |
| **테일** | ~3.7MB | 실제 계측된 명령어가 기록되는 영역 |
| **GumExecBlock** | 블록당 1개 | `real_begin/end` (원본 주소), `code_begin/end` (계측 코드 주소), `real_snapshot` (원본 바이트 복사본) |

slab이 가득 차면 새로운 slab이 할당된다. 오래된 slab은 `garbageCollect()`를 통해 해제할 수 있다.

### 2.3 trustThreshold와 코드 캐싱

한 번 계측된 기본 블록은 캐시되어 다음 실행 시 재사용된다. `trustThreshold`는 이 캐시의 신뢰 정책을 결정한다.

| 값 | 의미 | 사용 사례 |
|----|------|-----------|
| `-1` | 절대 신뢰하지 않음. 매번 원본과 비교하여 변경 감지 | 자기 수정 코드(SMC) 분석 |
| `0` | 즉시 신뢰. 한 번 계측 후 영구 캐시 | 일반적인 코드 트레이싱 (기본값) |
| `N` (양수) | N번 일관된 실행 후 신뢰 | SMC 의심 코드의 균형 잡힌 분석 |

```javascript
// 자기 수정 코드 감지를 위한 설정
Stalker.trustThreshold = -1;

// 일반 트레이싱 (기본값, 최고 성능)
Stalker.trustThreshold = 0;

// 3번 일관된 실행 후 신뢰
Stalker.trustThreshold = 3;
```

**동작 방식 (trustThreshold = -1일 때):**

1. 블록 실행 전, `real_snapshot`과 현재 원본 코드를 비교한다.
2. 바이트가 다르면 해당 블록을 무효화하고 다시 계측한다.
3. 이는 자기 수정 코드, JIT 컴파일러, 동적 패치를 감지할 수 있게 한다.

### 2.4 명령어 변환 파이프라인

Stalker의 명령어 변환은 세 가지 핵심 구성 요소가 파이프라인을 이루어 동작한다.

```
원본 코드 → [Relocator] → [Transformer] → [Writer] → 계측된 코드 (slab)
```

| 구성 요소 | 역할 |
|-----------|------|
| **Relocator** | 원본 명령어를 읽고, 위치 종속 명령(PC-relative 분기, 메모리 접근 등)을 새 주소에 맞게 조정 |
| **Transformer** | 사용자 정의 변환 콜백. `iterator.next()`/`iterator.keep()`을 통해 명령어를 선택적으로 유지, 제거, 변환 |
| **Writer** | 재배치된 명령어와 추가 계측 코드를 slab에 기록 |

### 2.5 Stalker 컨텍스트와 스레드

Stalker는 **스레드 단위**로 동작한다. 각 스레드는 독립적인 컨텍스트를 가지며, 여러 스레드를 동시에 추적할 수 있다.

```javascript
// 여러 스레드 동시 추적
const threads = Process.enumerateThreads();
for (const thread of threads) {
  Stalker.follow(thread.id, {
    events: { call: true },
    onReceive(events) {
      const parsed = Stalker.parse(events, { annotate: true, stringify: true });
      console.log(`Thread ${thread.id}:`, JSON.stringify(parsed));
    }
  });
}
```

---

## 3. API 레퍼런스

### 3.1 Stalker.follow([threadId, options])

지정한 스레드의 코드 실행을 추적한다.

**시그니처:**

```typescript
Stalker.follow(threadId?: ThreadId, options?: StalkerOptions): void;
```

**매개변수:**

| 매개변수 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `threadId` | `ThreadId` (number) | N | 추적할 스레드 ID. 생략 시 현재 스레드 |
| `options` | `StalkerOptions` | N | 추적 옵션 |

**StalkerOptions:**

```typescript
interface StalkerOptions {
  events?: {
    call?: boolean;     // CALL 명령어 이벤트 (기본: false)
    ret?: boolean;      // RET 명령어 이벤트 (기본: false)
    exec?: boolean;     // 모든 명령어 실행 이벤트 (기본: false)
    block?: boolean;    // 기본 블록 실행 이벤트 (기본: false)
    compile?: boolean;  // 블록 컴파일(계측) 이벤트 (기본: false)
  };

  onReceive?: (events: ArrayBuffer) => void;
  // GumEvent 바이너리 blob을 수신하는 콜백.
  // Stalker.parse()로 파싱하여 사용.
  // 이벤트는 버퍼링되어 일괄 전달됨.

  onCallSummary?: (summary: { [target: string]: number }) => void;
  // 호출 대상별 빈도를 집계하여 전달하는 콜백.
  // key: 호출 대상 주소 (hex string), value: 호출 횟수.
  // onReceive보다 효율적.

  transform?: (iterator: StalkerIterator) => void;
  // 명령어 변환 콜백. 각 기본 블록이 컴파일될 때 호출됨.
  // iterator를 통해 명령어를 순회하며 유지/변환/삽입 가능.

  data?: NativePointerValue;
  // transform 콜백에 전달할 사용자 데이터 (CModule 연동 시 사용)
}
```

**예제 - 기본 사용:**

```javascript
// 현재 스레드의 함수 호출 추적
Stalker.follow({
  events: { call: true, ret: true },

  onReceive(events) {
    const parsed = Stalker.parse(events, {
      annotate: true,
      stringify: true
    });

    for (const event of parsed) {
      console.log(JSON.stringify(event));
      // ["call", "0x7fff2034a000", "0x7fff2034b100", 3]
      // [타입,    위치,              대상,             깊이]
    }
  }
});
```

**예제 - 특정 스레드 추적:**

```javascript
// 메인 스레드 추적
const mainThread = Process.enumerateThreads()[0];

Stalker.follow(mainThread.id, {
  events: { call: true },

  onCallSummary(summary) {
    console.log('=== 호출 요약 ===');
    for (const [target, count] of Object.entries(summary)) {
      const sym = DebugSymbol.fromAddress(ptr(target));
      console.log(`  ${sym.name || target}: ${count}회`);
    }
  }
});
```

**예제 - transform 콜백으로 명령어 수준 제어:**

```javascript
Stalker.follow(Process.getCurrentThreadId(), {
  transform(iterator) {
    let instruction = iterator.next();

    const startAddress = instruction.address;

    do {
      // 특정 주소의 명령어를 NOP으로 교체
      if (instruction.address.equals(targetAddress)) {
        iterator.putNop();
        continue;
      }

      // 모든 BL(Branch with Link) 명령어에 콜백 삽입
      if (instruction.mnemonic === 'bl') {
        iterator.putCallout((context) => {
          console.log(
            `CALL at ${context.pc}` +
            ` → target in next instruction`
          );
        });
      }

      iterator.keep();
    } while ((instruction = iterator.next()) !== null);
  }
});
```

---

### 3.2 Stalker.unfollow([threadId])

추적을 중단한다.

**시그니처:**

```typescript
Stalker.unfollow(threadId?: ThreadId): void;
```

| 매개변수 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `threadId` | `ThreadId` | N | 추적을 중단할 스레드 ID. 생략 시 현재 스레드 |

```javascript
// 현재 스레드 추적 중단
Stalker.unfollow();

// 특정 스레드 추적 중단
Stalker.unfollow(threadId);
```

> **주의:** `unfollow()` 호출 후 즉시 메모리가 해제되지 않는다. 스레드가 계측 코드에서 안전하게 빠져나온 후에 해제된다. 명시적 해제가 필요하면 `Stalker.garbageCollect()`를 사용한다.

---

### 3.3 Stalker.exclude(range)

지정한 메모리 범위를 Stalker 추적에서 제외한다. 제외된 범위로 제어 흐름이 진입하면 추적이 일시 중단되고, 해당 범위에서 반환하면 추적이 재개된다.

**시그니처:**

```typescript
Stalker.exclude(range: { base: NativePointer; size: number }): void;
```

| 매개변수 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `range.base` | `NativePointer` | Y | 제외할 범위의 시작 주소 |
| `range.size` | `number` | Y | 제외할 범위의 크기 (바이트) |

```javascript
// 시스템 라이브러리 제외 (macOS)
const libSystem = Process.getModuleByName('libSystem.B.dylib');
Stalker.exclude({ base: libSystem.base, size: libSystem.size });

// libc 제외 (Linux)
const libc = Process.getModuleByName('libc.so');
Stalker.exclude({ base: libc.base, size: libc.size });

// 대상 모듈 외 모든 모듈 제외
const targetModule = Process.getModuleByName('target.so');
for (const module of Process.enumerateModules()) {
  if (module.name !== targetModule.name) {
    Stalker.exclude({ base: module.base, size: module.size });
  }
}
```

> **핵심 성능 팁:** `exclude()`는 Stalker 성능 최적화의 가장 중요한 도구다. 관심 없는 라이브러리를 제외하면 계측 오버헤드를 수십 배 줄일 수 있다. 반드시 `follow()` 호출 **이전**에 설정해야 한다.

---

### 3.4 Stalker.parse(events[, options])

`onReceive` 콜백으로 전달받은 GumEvent 바이너리 blob을 파싱한다.

**시그니처:**

```typescript
Stalker.parse(events: ArrayBuffer, options?: {
  annotate?: boolean;  // 이벤트 타입 주석 추가 (기본: true)
  stringify?: boolean; // 주소를 hex 문자열로 변환 (기본: false)
}): StalkerEventFull[] | StalkerEventBare[];
```

**반환값 형식:**

`annotate: true`일 때 (기본):

```typescript
type StalkerEventFull =
  | ['call', string | NativePointer, string | NativePointer, number]
  //  타입    위치(from)              대상(to)                  깊이
  | ['ret', string | NativePointer, string | NativePointer, number]
  //  타입   위치(from)              반환 주소(to)              깊이
  | ['exec', string | NativePointer]
  //  타입    실행 주소
  | ['block', string | NativePointer, number]
  //  타입     블록 시작 주소          블록 크기
  | ['compile', string | NativePointer, number];
  //  타입       블록 시작 주소         블록 크기
```

`annotate: false`일 때:

```typescript
type StalkerEventBare =
  | [string | NativePointer, string | NativePointer, number]  // call/ret
  | [string | NativePointer]                                    // exec
  | [string | NativePointer, number];                           // block/compile
```

**예제:**

```javascript
Stalker.follow(threadId, {
  events: { call: true, ret: true, block: true },

  onReceive(events) {
    // annotate + stringify로 가독성 높은 파싱
    const parsed = Stalker.parse(events, {
      annotate: true,
      stringify: true
    });

    for (const ev of parsed) {
      switch (ev[0]) {
        case 'call':
          console.log(`CALL: ${ev[1]} → ${ev[2]} (깊이: ${ev[3]})`);
          break;
        case 'ret':
          console.log(`RET:  ${ev[1]} → ${ev[2]} (깊이: ${ev[3]})`);
          break;
        case 'block':
          console.log(`BLOCK: ${ev[1]} (크기: ${ev[2]})`);
          break;
      }
    }
  }
});
```

---

### 3.5 Stalker.flush()

버퍼링된 이벤트를 즉시 콜백으로 전달한다.

```typescript
Stalker.flush(): void;
```

Stalker는 성능을 위해 이벤트를 버퍼에 모아두었다가 일괄 전달한다. 즉각적인 이벤트 확인이 필요할 때 사용한다.

```javascript
// 특정 시점에 버퍼 비우기
Stalker.follow(threadId, {
  events: { call: true },
  onReceive(events) {
    // 이벤트 처리
  }
});

// ... 특정 동작 수행 후 ...
Stalker.flush();  // 버퍼링된 이벤트 즉시 전달
```

---

### 3.6 Stalker.garbageCollect()

`unfollow()` 후 더 이상 사용되지 않는 slab 메모리를 해제한다.

```typescript
Stalker.garbageCollect(): void;
```

```javascript
Stalker.unfollow(threadId);

// 스레드가 계측 코드에서 빠져나올 시간을 준 후 GC 실행
setTimeout(() => {
  Stalker.garbageCollect();
}, 1000);
```

> **주의:** 스레드가 아직 계측된 코드를 실행 중일 때 GC를 호출하면 크래시가 발생할 수 있다. 충분한 시간 간격을 두거나, 안전한 시점(예: Interceptor 콜백 내)에서 호출해야 한다.

---

### 3.7 Stalker.invalidate(address) / Stalker.invalidate(threadId, address)

특정 주소를 포함하는 기본 블록의 캐시를 무효화한다. 다음 실행 시 해당 블록이 재컴파일된다.

**시그니처:**

```typescript
Stalker.invalidate(address: NativePointerValue): void;
Stalker.invalidate(threadId: ThreadId, address: NativePointerValue): void;
```

| 매개변수 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `address` | `NativePointerValue` | Y | 무효화할 블록에 포함된 주소 |
| `threadId` | `ThreadId` | N | 특정 스레드의 캐시만 무효화. 생략 시 모든 스레드 |

```javascript
// 특정 주소의 캐시 무효화 (모든 스레드)
Stalker.invalidate(ptr('0x401000'));

// 특정 스레드의 특정 블록만 무효화
Stalker.invalidate(threadId, ptr('0x401000'));
```

**`unfollow()`/`follow()` 대비 장점:**
- 추적을 중단하지 않고 특정 블록만 재컴파일할 수 있다.
- 런타임에 코드가 패치되었을 때 최소한의 비용으로 변경을 반영할 수 있다.
- `transform` 콜백의 조건을 동적으로 바꿀 때 유용하다.

```javascript
// 동적 계측 조건 변경 예제
let traceTarget = ptr('0x401000');

Stalker.follow(threadId, {
  transform(iterator) {
    let instruction = iterator.next();
    do {
      if (instruction.address.equals(traceTarget)) {
        iterator.putCallout((ctx) => {
          console.log('Hit target!', ctx.pc);
        });
      }
      iterator.keep();
    } while ((instruction = iterator.next()) !== null);
  }
});

// 나중에 다른 주소를 추적하고 싶을 때
function changeTarget(newAddr) {
  const oldTarget = traceTarget;
  traceTarget = newAddr;

  // 변경된 블록만 재컴파일
  Stalker.invalidate(threadId, oldTarget);
  Stalker.invalidate(threadId, newAddr);
}
```

---

### 3.8 Stalker.addCallProbe(address, callback[, data])

특정 주소에 **동기식** 호출 프로브를 설치한다. 해당 주소가 호출될 때마다 콜백이 실행된다.

**시그니처:**

```typescript
Stalker.addCallProbe(
  address: NativePointerValue,
  callback: StalkerCallProbeCallback | NativePointer,
  data?: NativePointerValue
): StalkerCallProbeId;

type StalkerCallProbeCallback = (args: InvocationArguments, context: CpuContext) => void;
```

| 매개변수 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `address` | `NativePointerValue` | Y | 프로브를 설치할 주소 |
| `callback` | `Function \| NativePointer` | Y | 호출 시 실행할 콜백. NativePointer를 전달하면 CModule 함수를 직접 호출 |
| `data` | `NativePointerValue` | N | 콜백에 전달할 사용자 데이터 포인터 |

**반환값:** `StalkerCallProbeId` (number) - `removeCallProbe()`에 사용할 ID

```javascript
// malloc 호출 모니터링
const mallocAddr = Module.getExportByName(null, 'malloc');

const probeId = Stalker.addCallProbe(mallocAddr, (args) => {
  const size = args[0].toUInt32();
  if (size > 1024 * 1024) {
    console.log(`Large malloc: ${size} bytes`);
    console.log(Thread.backtrace(this.context, Backtracer.ACCURATE)
      .map(DebugSymbol.fromAddress)
      .join('\n'));
  }
});

// 나중에 프로브 제거
Stalker.removeCallProbe(probeId);
```

> **Interceptor vs addCallProbe:** Stalker 컨텍스트(follow 중인 스레드)에서는 `Interceptor.attach()`가 정상 동작하지 않을 수 있다. 이런 경우 `addCallProbe()`를 대안으로 사용한다. `addCallProbe()`는 Stalker의 계측 파이프라인에 통합되어 있어 충돌 없이 동작한다.

---

### 3.9 Stalker.removeCallProbe(id)

설치된 호출 프로브를 제거한다.

```typescript
Stalker.removeCallProbe(callbackId: StalkerCallProbeId): void;
```

```javascript
const probeId = Stalker.addCallProbe(targetAddr, callback);
// ...
Stalker.removeCallProbe(probeId);
```

---

### 3.10 Stalker.trustThreshold

코드 블록 캐싱의 신뢰 임계값을 읽거나 설정한다.

```typescript
Stalker.trustThreshold: number;
```

자세한 설명은 [2.3 trustThreshold와 코드 캐싱](#23-trustthreshold와-코드-캐싱) 참조.

---

### 3.11 Stalker.queueCapacity

Stalker 이벤트 큐의 용량을 설정한다. 이벤트가 이 용량에 도달하면 `onReceive`/`onCallSummary` 콜백이 트리거된다.

```typescript
Stalker.queueCapacity: number;  // 기본값: 16384
```

```javascript
// 더 자주 콜백을 받고 싶을 때 (실시간성 향상, 성능 감소)
Stalker.queueCapacity = 1024;

// 더 적게 콜백을 받고 싶을 때 (성능 향상, 지연 증가)
Stalker.queueCapacity = 65536;
```

---

### 3.12 Stalker.queueDrainInterval

이벤트 큐를 비우는 간격을 밀리초 단위로 설정한다.

```typescript
Stalker.queueDrainInterval: number;  // 기본값: 250 (ms)
```

```javascript
// 실시간에 가까운 이벤트 수신 (오버헤드 증가)
Stalker.queueDrainInterval = 50;

// 배치 처리 최적화 (지연 증가, 오버헤드 감소)
Stalker.queueDrainInterval = 1000;
```

---

## 4. Transform 콜백

Transform 콜백은 Stalker의 가장 강력한 기능으로, 기본 블록이 컴파일(계측)될 때 각 명령어를 순회하며 유지, 제거, 변환, 또는 추가 코드를 삽입할 수 있다.

### 4.1 StalkerIterator

`transform` 콜백에 전달되는 반복자 객체다.

**메서드:**

| 메서드 | 설명 |
|--------|------|
| `next()` | 다음 명령어를 반환. 블록 끝이면 `null` |
| `keep()` | 현재 명령어를 계측 코드에 유지 (재배치 적용) |
| `putCallout(callback[, data])` | 현재 위치에 JavaScript/Native 콜백 삽입 |
| `putChainingReturn()` | 최적화된 반환 코드 삽입. `keep()` 대신 사용하여 불필요한 블록 전환을 방지 |
| `putNop()` | NOP(No Operation) 명령어 삽입 |
| `putLabel(id)` | 레이블 삽입 (Writer로 분기 대상 지정 시 사용) |

**기본 패턴:**

```javascript
Stalker.follow(threadId, {
  transform(iterator) {
    let instruction = iterator.next();

    do {
      // 명령어 검사 및 처리
      // ...

      iterator.keep();  // 명령어 유지
    } while ((instruction = iterator.next()) !== null);
  }
});
```

> **중요:** `iterator.next()`를 한 번도 호출하지 않거나, 어떤 명령어에 대해서도 `keep()`을 호출하지 않으면 해당 블록이 비어있게 되어 크래시가 발생한다.

---

### 4.2 StalkerInstruction

`iterator.next()`가 반환하는 명령어 객체다. 아키텍처에 따라 세부 타입이 다르다.

**공통 속성:**

| 속성 | 타입 | 설명 |
|------|------|------|
| `address` | `NativePointer` | 원본 코드에서의 주소 |
| `next` | `NativePointer` | 다음 명령어의 원본 주소 |
| `size` | `number` | 명령어 크기 (바이트) |
| `mnemonic` | `string` | 명령어 니모닉 (예: `'bl'`, `'ret'`, `'mov'`) |
| `opStr` | `string` | 피연산자 문자열 (예: `'x0, x1'`, `'#0x10'`) |

**아키텍처별 명령어 타입:**

```typescript
// ARM64 (AArch64)
interface StalkerArm64Instruction {
  address: NativePointer;
  next: NativePointer;
  size: number;
  mnemonic: string;
  opStr: string;
  groups: string[];  // 명령어 그룹 (예: ['branch_relative', 'call'])
}

// x86_64
interface StalkerX86Instruction {
  address: NativePointer;
  next: NativePointer;
  size: number;
  mnemonic: string;
  opStr: string;
  groups: string[];
}
```

---

### 4.3 putCallout 상세

`putCallout()`은 현재 위치에 콜백을 삽입하여, 해당 명령어가 실행될 때마다 콜백을 호출한다.

**JavaScript 콜백:**

```javascript
iterator.putCallout((context) => {
  // context: CpuContext (아키텍처별)
  // ARM64: context.x0, context.x1, ..., context.pc, context.sp, context.fp
  // x64:   context.rax, context.rbx, ..., context.rip, context.rsp

  console.log('PC:', context.pc);
  console.log('SP:', context.sp);
});
```

**CpuContext 속성 (ARM64):**

| 레지스터 | 설명 |
|----------|------|
| `pc` | 프로그램 카운터 |
| `sp` | 스택 포인터 |
| `fp` (= `x29`) | 프레임 포인터 |
| `lr` (= `x30`) | 링크 레지스터 |
| `x0` ~ `x28` | 범용 레지스터 |
| `nzcv` | 조건 플래그 |

**CpuContext 속성 (x64):**

| 레지스터 | 설명 |
|----------|------|
| `rip` | 명령어 포인터 |
| `rsp` | 스택 포인터 |
| `rbp` | 베이스 포인터 |
| `rax`, `rbx`, `rcx`, `rdx` | 범용 레지스터 |
| `rsi`, `rdi` | 인덱스 레지스터 |
| `r8` ~ `r15` | 확장 레지스터 |

**CModule 콜백 (고성능):**

```javascript
const cm = new CModule(`
#include <gum/gumstalker.h>

void on_call(GumCpuContext *cpu_context, gpointer user_data) {
  // C로 작성된 고성능 콜백
  // JavaScript 콜백 대비 수십 배 빠름
}
`);

Stalker.follow(threadId, {
  transform(iterator) {
    let instruction = iterator.next();
    do {
      if (instruction.mnemonic === 'bl') {
        // CModule 함수 포인터를 직접 전달
        iterator.putCallout(cm.on_call);
      }
      iterator.keep();
    } while ((instruction = iterator.next()) !== null);
  }
});
```

---

### 4.4 Transform 고급 패턴

#### 4.4.1 조건부 계측

```javascript
// 특정 모듈 내 코드만 계측
const targetModule = Process.getModuleByName('libcrypto.so');
const targetBase = targetModule.base;
const targetEnd = targetBase.add(targetModule.size);

Stalker.follow(threadId, {
  transform(iterator) {
    let instruction = iterator.next();
    const blockAddr = instruction.address;

    // 대상 모듈 내 블록인지 확인
    const inTarget = blockAddr.compare(targetBase) >= 0 &&
                     blockAddr.compare(targetEnd) < 0;

    do {
      if (inTarget && instruction.mnemonic === 'bl') {
        iterator.putCallout((context) => {
          const target = context.lr;  // 반환 주소
          const sym = DebugSymbol.fromAddress(context.pc);
          console.log(`[crypto] ${sym.name}: call from ${context.pc}`);
        });
      }

      iterator.keep();
    } while ((instruction = iterator.next()) !== null);
  }
});
```

#### 4.4.2 명령어 교체

```javascript
// 특정 비교 명령어를 NOP으로 교체 (패치 효과)
Stalker.follow(threadId, {
  transform(iterator) {
    let instruction = iterator.next();

    do {
      if (instruction.address.equals(patchAddress)) {
        // 원본 명령어 대신 NOP 삽입
        iterator.putNop();
        console.log(`Patched instruction at ${instruction.address}`);
      } else {
        iterator.keep();
      }
    } while ((instruction = iterator.next()) !== null);
  }
});
```

#### 4.4.3 Writer를 사용한 커스텀 명령어 삽입

`StalkerIterator`는 내부적으로 아키텍처별 Writer에 접근할 수 있다. Writer를 통해 임의의 네이티브 명령어를 삽입할 수 있다.

**ARM64 Writer 예제:**

```javascript
Stalker.follow(threadId, {
  transform(iterator) {
    let instruction = iterator.next();

    do {
      iterator.keep();

      // 특정 위치에서 레지스터 값을 메모리에 저장하는 코드 삽입
      if (instruction.address.equals(interestingAddr)) {
        // putCallout 대신 직접 네이티브 코드 삽입 (더 빠름)
        iterator.putCallout((context) => {
          // x0 레지스터 값을 공유 메모리에 기록
          Memory.writeU64(sharedBuf, context.x0.toUInt32());
        });
      }
    } while ((instruction = iterator.next()) !== null);
  }
});
```

#### 4.4.4 제어 흐름 변경

```javascript
// 특정 함수 호출을 다른 함수로 리다이렉트
const origFunc = Module.getExportByName(null, 'original_func');
const hookFunc = Module.getExportByName(null, 'hook_func');

Stalker.follow(threadId, {
  transform(iterator) {
    let instruction = iterator.next();

    do {
      // BL original_func → BL hook_func로 교체
      if (instruction.mnemonic === 'bl') {
        iterator.putCallout((context) => {
          // 다음에 실행될 call의 대상 확인
          // 필요 시 레지스터를 수정하여 흐름 변경
        });
      }

      iterator.keep();
    } while ((instruction = iterator.next()) !== null);
  }
});
```

---

## 5. 이벤트 시스템

### 5.1 이벤트 타입 상세

| 이벤트 | 활성화 | 설명 | 데이터 볼륨 | 일반적 사용 사례 |
|--------|--------|------|------------|-----------------|
| `call` | `events.call` | CALL/BL 명령어 실행 | 중간 | 함수 호출 그래프 |
| `ret` | `events.ret` | RET 명령어 실행 | 중간 | 함수 반환 추적 |
| `exec` | `events.exec` | **모든** 명령어 실행 | **극도로 높음** | 명령어 수준 디버깅 (주의 필요) |
| `block` | `events.block` | 기본 블록 실행 | 낮음 | 코드 커버리지 |
| `compile` | `events.compile` | 블록 최초 컴파일 | 매우 낮음 | 도달 가능 코드 분석 |

### 5.2 이벤트 볼륨 비교

1초간 일반적인 프로그램을 추적했을 때 예상 이벤트 수:

```
compile:  수백 ~ 수천 이벤트
block:    수천 ~ 수만 이벤트
call/ret: 수만 ~ 수십만 이벤트
exec:     수백만 ~ 수천만 이벤트  ← 주의!
```

### 5.3 onReceive vs onCallSummary

**onReceive:**
- 원시 이벤트를 ArrayBuffer로 전달
- `Stalker.parse()`로 파싱 필요
- 개별 이벤트의 순서와 위치 정보 보존
- 상세 분석에 적합

**onCallSummary:**
- 호출 대상별 빈도를 집계하여 전달
- `{ "0x7fff2034a000": 42, "0x7fff2034b100": 17 }` 형태
- 파싱 불필요, 높은 효율
- 핫스팟 분석, 프로파일링에 적합

```javascript
// onCallSummary 사용 예
Stalker.follow(threadId, {
  events: { call: true },

  onCallSummary(summary) {
    const entries = Object.entries(summary)
      .map(([addr, count]) => ({
        address: addr,
        symbol: DebugSymbol.fromAddress(ptr(addr)).toString(),
        count: count
      }))
      .sort((a, b) => b.count - a.count);

    console.log('=== Top 10 호출 함수 ===');
    entries.slice(0, 10).forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.symbol} — ${e.count}회`);
    });
  }
});
```

> **주의:** `onReceive`와 `onCallSummary`는 동시에 사용할 수 없다. 둘 중 하나만 지정해야 한다.

### 5.4 이벤트 파싱 상세

```javascript
Stalker.follow(threadId, {
  events: { call: true, ret: true, block: true, compile: true },

  onReceive(events) {
    const parsed = Stalker.parse(events, {
      annotate: true,
      stringify: true
    });

    for (const ev of parsed) {
      switch (ev[0]) {
        case 'call': {
          // ['call', from, to, depth]
          const [, from, to, depth] = ev;
          const indent = '  '.repeat(depth);
          const sym = DebugSymbol.fromAddress(ptr(to));
          console.log(`${indent}→ CALL ${sym.name || to} (from ${from})`);
          break;
        }
        case 'ret': {
          // ['ret', from, to, depth]
          const [, from, to, depth] = ev;
          const indent = '  '.repeat(depth);
          console.log(`${indent}← RET to ${to} (from ${from})`);
          break;
        }
        case 'block': {
          // ['block', begin, size]
          const [, begin, size] = ev;
          console.log(`  BLOCK: ${begin} (${size} bytes)`);
          break;
        }
        case 'compile': {
          // ['compile', begin, size]
          const [, begin, size] = ev;
          const sym = DebugSymbol.fromAddress(ptr(begin));
          console.log(`  COMPILE: ${sym} (${size} bytes)`);
          break;
        }
      }
    }
  }
});
```

---

## 6. 아키텍처별 Writer/Relocator

Transform 콜백에서 더 세밀한 제어가 필요할 때 아키텍처별 Writer와 Relocator를 직접 사용할 수 있다. `StalkerIterator`는 내부적으로 이들을 사용하지만, 고급 사용 사례에서는 직접 접근이 필요할 수 있다.

### 6.1 ARM64 (AArch64)

#### Arm64Writer 주요 메서드

```javascript
// StalkerIterator 내에서 직접 명령어 생성
Stalker.follow(threadId, {
  transform(iterator) {
    let instruction = iterator.next();

    do {
      iterator.keep();
    } while ((instruction = iterator.next()) !== null);
  }
});
```

독립적으로 `Arm64Writer`를 사용하는 경우:

```javascript
const writer = new Arm64Writer(codeAddress);

// 레지스터 간 이동
writer.putMovRegReg('x0', 'x1');

// 즉시 값 로드
writer.putLdrRegU64('x0', 0xdeadbeef);

// 함수 호출
writer.putBlImm(targetAddress);

// 분기
writer.putBImm(targetAddress);
writer.putBCondImm('eq', targetAddress);  // 조건 분기

// 스택 조작
writer.putPushRegReg('x29', 'x30');  // STP x29, x30, [sp, #-16]!
writer.putPopRegReg('x29', 'x30');   // LDP x29, x30, [sp], #16

// NOP
writer.putNop();

// 반환
writer.putRet();

// 레이블
writer.putLabel('my_label');
writer.putBImm('my_label');  // 레이블로 분기

// 메모리 접근
writer.putLdrRegRegOffset('x0', 'x1', 8);   // LDR x0, [x1, #8]
writer.putStrRegRegOffset('x0', 'x1', 8);   // STR x0, [x1, #8]

// 비교
writer.putCmpRegReg('x0', 'x1');

// 바이트 직접 기록
writer.putBytes(new Uint8Array([0x00, 0x00, 0x00, 0x00]));

writer.flush();
```

#### Arm64Relocator 주요 메서드

```javascript
const relocator = new Arm64Relocator(inputAddress, writer);

// 명령어 읽기
let count = relocator.readOne();  // 1개 명령어 읽기

// 현재 명령어 정보
const insn = relocator.input;
console.log(insn.mnemonic, insn.opStr);

// 재배치하여 출력
relocator.writeOne();  // 읽은 명령어를 writer에 출력 (재배치 적용)
relocator.writeAll();  // 남은 모든 명령어 출력

// 건너뛰기
relocator.skipOne();  // 현재 명령어를 출력하지 않고 건너뜀

relocator.dispose();
```

### 6.2 x86_64

#### X86Writer 주요 메서드

```javascript
const writer = new X86Writer(codeAddress);

// 레지스터 간 이동
writer.putMovRegReg('rax', 'rbx');

// 즉시 값
writer.putMovRegU64('rax', 0xdeadbeefcafe);
writer.putMovRegAddress('rdi', targetAddress);

// 함수 호출
writer.putCallAddress(targetAddress);
writer.putCallReg('rax');

// 스택 조작
writer.putPushReg('rbp');
writer.putPopReg('rbp');
writer.putPushU32(0x42);

// 분기
writer.putJmpAddress(targetAddress);
writer.putJmpReg('rax');
writer.putJccShortLabel('je', 'skip_label', 'no-hint');

// NOP
writer.putNop();
writer.putNopn(8);  // 8바이트 NOP

// 반환
writer.putRet();
writer.putRetImm(8);  // RET 8

// 레이블
writer.putLabel('my_label');
writer.putJmpShortLabel('my_label');

// 산술
writer.putAddRegImm('rsp', 0x28);
writer.putSubRegImm('rsp', 0x28);

// 비교/테스트
writer.putCmpRegI32('rax', 0);
writer.putTestRegReg('rax', 'rax');

// 바이트 직접 기록
writer.putBytes(new Uint8Array([0x90]));

writer.flush();
```

#### X86Relocator 주요 메서드

```javascript
const relocator = new X86Relocator(inputAddress, writer);

let count = relocator.readOne();
const insn = relocator.input;
console.log(insn.mnemonic, insn.opStr);

relocator.writeOne();
relocator.writeAll();
relocator.skipOne();

// End of Block 확인
if (relocator.eob) {
  console.log('End of basic block reached');
}

// End of Input 확인
if (relocator.eoi) {
  console.log('End of input reached');
}

relocator.dispose();
```

---

## 7. 성능 최적화

### 7.1 Stalker.exclude() 전략

가장 효과적인 성능 최적화 기법이다. 관심 없는 라이브러리를 제외하면 계측 대상 코드가 줄어들어 오버헤드가 크게 감소한다.

**전략 1: 블랙리스트 — 특정 모듈 제외**

```javascript
// 시스템 라이브러리 제외
const excludeList = [
  'libSystem.B.dylib',
  'libc++.1.dylib',
  'libobjc.A.dylib',
  'libdyld.dylib',
  'libsystem_kernel.dylib',
  'libsystem_platform.dylib',
  'libsystem_pthread.dylib',
  'libsystem_malloc.dylib',
];

for (const name of excludeList) {
  try {
    const mod = Process.getModuleByName(name);
    Stalker.exclude({ base: mod.base, size: mod.size });
  } catch (e) {
    // 해당 모듈이 로드되지 않은 경우 무시
  }
}
```

**전략 2: 화이트리스트 — 특정 모듈만 추적**

```javascript
// 대상 모듈만 추적하고 나머지 모두 제외
const targetModules = new Set(['libtarget.so', 'libcrypto.so']);

for (const mod of Process.enumerateModules()) {
  if (!targetModules.has(mod.name)) {
    Stalker.exclude({ base: mod.base, size: mod.size });
  }
}
```

**전략 3: 주소 범위 기반**

```javascript
// 특정 주소 범위만 추적
const rangeStart = ptr('0x400000');
const rangeEnd = ptr('0x500000');
const rangeSize = rangeEnd.sub(rangeStart).toUInt32();

// 전체 프로세스 메모리에서 대상 범위 외를 모두 제외
for (const mod of Process.enumerateModules()) {
  const modEnd = mod.base.add(mod.size);
  if (modEnd.compare(rangeStart) <= 0 || mod.base.compare(rangeEnd) >= 0) {
    Stalker.exclude({ base: mod.base, size: mod.size });
  }
}
```

### 7.2 이벤트 선택 최적화

```javascript
// 나쁜 예: 모든 이벤트 수집 (극도의 오버헤드)
Stalker.follow(threadId, {
  events: { call: true, ret: true, exec: true, block: true, compile: true }
  // ❌ exec 이벤트 때문에 성능 심각하게 저하
});

// 좋은 예: 필요한 이벤트만 선택
// 함수 호출 추적
Stalker.follow(threadId, {
  events: { call: true, ret: true }
});

// 코드 커버리지
Stalker.follow(threadId, {
  events: { compile: true }
  // compile 이벤트는 블록 최초 컴파일 시에만 발생 → 매우 가벼움
});

// 블록 수준 실행 추적
Stalker.follow(threadId, {
  events: { block: true }
});
```

### 7.3 CModule 콜백으로 성능 극대화

JavaScript 콜백은 JS ↔ Native 경계를 넘나드는 오버헤드가 크다. CModule을 사용하면 순수 C 코드로 콜백을 작성하여 이 오버헤드를 제거할 수 있다.

```javascript
const cm = new CModule(`
#include <gum/gumstalker.h>
#include <stdio.h>

typedef struct {
  guint64 call_count;
  guint64 block_count;
  guint64 last_call_target;
} TraceStats;

static TraceStats stats = { 0, 0, 0 };

void on_call(GumCpuContext *cpu_context, gpointer user_data) {
  stats.call_count++;
  #if defined(__aarch64__)
  stats.last_call_target = cpu_context->lr;
  #elif defined(__x86_64__)
  stats.last_call_target = cpu_context->rip;
  #endif
}

void on_block(GumCpuContext *cpu_context, gpointer user_data) {
  stats.block_count++;
}

TraceStats *get_stats(void) {
  return &stats;
}
`);

// JavaScript에서 통계 읽기
const getStats = new NativeFunction(cm.get_stats, 'pointer', []);

Stalker.follow(threadId, {
  transform(iterator) {
    let instruction = iterator.next();
    const isFirstInstruction = true;

    do {
      if (instruction.mnemonic === 'bl' || instruction.mnemonic === 'call') {
        iterator.putCallout(cm.on_call);
      }
      iterator.keep();
    } while ((instruction = iterator.next()) !== null);
  }
});

// 주기적으로 통계 확인
setInterval(() => {
  const statsPtr = getStats();
  console.log('Calls:', statsPtr.readU64().toString());
  console.log('Blocks:', statsPtr.add(8).readU64().toString());
  console.log('Last target:', ptr(statsPtr.add(16).readU64()).toString());
}, 5000);
```

### 7.4 queueCapacity와 queueDrainInterval 튜닝

```javascript
// 실시간 모니터링 (낮은 지연, 높은 오버헤드)
Stalker.queueCapacity = 512;
Stalker.queueDrainInterval = 50;

// 배치 분석 (높은 지연, 낮은 오버헤드)
Stalker.queueCapacity = 131072;
Stalker.queueDrainInterval = 1000;

// 균형 (기본값에 가까움)
Stalker.queueCapacity = 16384;
Stalker.queueDrainInterval = 250;
```

### 7.5 transform 콜백 최적화

```javascript
// 나쁜 예: 매번 심볼 검색 (느림)
Stalker.follow(threadId, {
  transform(iterator) {
    let instruction = iterator.next();
    do {
      // ❌ 매 명령어마다 심볼 검색은 극도로 느림
      const sym = DebugSymbol.fromAddress(instruction.address);
      if (sym.name === 'interesting_func') {
        iterator.putCallout(callback);
      }
      iterator.keep();
    } while ((instruction = iterator.next()) !== null);
  }
});

// 좋은 예: 주소를 미리 조회하여 비교 (빠름)
const interestingAddr = Module.getExportByName(null, 'interesting_func');

Stalker.follow(threadId, {
  transform(iterator) {
    let instruction = iterator.next();
    do {
      // ✅ 포인터 비교는 매우 빠름
      if (instruction.address.equals(interestingAddr)) {
        iterator.putCallout(callback);
      }
      iterator.keep();
    } while ((instruction = iterator.next()) !== null);
  }
});
```

---

## 8. 실전 활용 패턴

### 8.1 코드 커버리지 수집

퍼저나 테스트 프레임워크와 연동하여 어떤 코드가 실행되었는지 추적한다.

```javascript
const coverage = new Map();  // moduleBase → Set<offset>
const targetModule = Process.getModuleByName('libtarget.so');
const targetBase = targetModule.base;
const targetSize = targetModule.size;

// 대상 외 모듈 제외
for (const mod of Process.enumerateModules()) {
  if (mod.name !== targetModule.name) {
    Stalker.exclude({ base: mod.base, size: mod.size });
  }
}

Stalker.follow(Process.getCurrentThreadId(), {
  events: { compile: true },

  onReceive(events) {
    const parsed = Stalker.parse(events, {
      annotate: true,
      stringify: true
    });

    for (const ev of parsed) {
      if (ev[0] === 'compile') {
        const blockAddr = ptr(ev[1]);
        const blockSize = ev[2];

        // 대상 모듈 내 블록만 기록
        if (blockAddr.compare(targetBase) >= 0 &&
            blockAddr.compare(targetBase.add(targetSize)) < 0) {
          const offset = blockAddr.sub(targetBase).toUInt32();

          if (!coverage.has(targetModule.name)) {
            coverage.set(targetModule.name, new Set());
          }
          coverage.get(targetModule.name).add(offset);
        }
      }
    }
  }
});

// 커버리지 결과 출력
function reportCoverage() {
  Stalker.flush();
  for (const [module, offsets] of coverage) {
    console.log(`\n[${module}] ${offsets.size} blocks covered:`);
    const sorted = [...offsets].sort((a, b) => a - b);
    for (const offset of sorted) {
      const sym = DebugSymbol.fromAddress(targetBase.add(offset));
      console.log(`  0x${offset.toString(16)}: ${sym.name || '(unknown)'}`);
    }
  }
}
```

### 8.2 함수 호출 트리 생성

들여쓰기로 호출 깊이를 시각화하는 함수 호출 추적기다.

```javascript
const targetModule = Process.getModuleByName('libtarget.so');

// 시스템 라이브러리 제외로 노이즈 감소
for (const mod of Process.enumerateModules()) {
  if (mod.name !== targetModule.name) {
    Stalker.exclude({ base: mod.base, size: mod.size });
  }
}

Stalker.follow(Process.getCurrentThreadId(), {
  events: { call: true, ret: true },

  onReceive(events) {
    const parsed = Stalker.parse(events, {
      annotate: true,
      stringify: true
    });

    for (const ev of parsed) {
      const depth = ev[3] || 0;
      const indent = '│ '.repeat(depth);

      if (ev[0] === 'call') {
        const targetSym = DebugSymbol.fromAddress(ptr(ev[2]));
        const name = targetSym.name || ev[2];
        console.log(`${indent}├─→ ${name}`);
      } else if (ev[0] === 'ret') {
        const fromSym = DebugSymbol.fromAddress(ptr(ev[1]));
        const name = fromSym.name || ev[1];
        console.log(`${indent}├─← ${name}`);
      }
    }
  }
});
```

출력 예시:
```
├─→ main
│ ├─→ initialize
│ │ ├─→ load_config
│ │ ├─← load_config
│ │ ├─→ setup_handlers
│ │ ├─← setup_handlers
│ ├─← initialize
│ ├─→ process_input
│ │ ├─→ validate
│ │ ├─← validate
│ │ ├─→ transform
│ │ │ ├─→ apply_rule
│ │ │ ├─← apply_rule
│ │ ├─← transform
│ ├─← process_input
├─← main
```

### 8.3 특정 함수의 실행 경로 분석

특정 함수가 호출되었을 때, 그 내부에서 어떤 기본 블록들이 실행되는지 분석한다.

```javascript
const targetFunc = Module.getExportByName('libtarget.so', 'decrypt_message');
const targetModule = Process.getModuleByName('libtarget.so');

let isInsideTarget = false;
const executedBlocks = [];

Stalker.follow(Process.getCurrentThreadId(), {
  transform(iterator) {
    let instruction = iterator.next();
    const blockStart = instruction.address;

    // 대상 함수 진입 감지
    if (blockStart.equals(targetFunc)) {
      iterator.putCallout((context) => {
        isInsideTarget = true;
        console.log(`[*] Entering decrypt_message, arg0=${context.x0}`);
      });
    }

    do {
      // 대상 함수 내부에서 블록 실행 기록
      if (isInsideTarget) {
        if (instruction === iterator.next() || instruction.address.equals(blockStart)) {
          // 블록 첫 명령어에 콜백
        }
      }

      // RET 명령어에서 대상 함수 종료 감지
      if (instruction.mnemonic === 'ret') {
        iterator.putCallout((context) => {
          if (isInsideTarget) {
            isInsideTarget = false;
            console.log(`[*] Leaving decrypt_message, retval=${context.x0}`);
          }
        });
      }

      iterator.keep();
    } while ((instruction = iterator.next()) !== null);
  }
});
```

### 8.4 자기 수정 코드(SMC) 감지

패킹이나 난독화로 런타임에 코드를 수정하는 프로그램을 분석한다.

```javascript
// SMC 감지를 위해 매 실행마다 원본과 비교
Stalker.trustThreshold = -1;

const modifiedBlocks = new Set();

Stalker.follow(Process.getCurrentThreadId(), {
  events: { compile: true },

  onReceive(events) {
    const parsed = Stalker.parse(events, {
      annotate: true,
      stringify: true
    });

    for (const ev of parsed) {
      if (ev[0] === 'compile') {
        const addr = ev[1];
        if (modifiedBlocks.has(addr)) {
          console.log(`[SMC] Block at ${addr} was recompiled (code modified!)`);

          // 변경된 코드 덤프
          const blockAddr = ptr(addr);
          const bytes = blockAddr.readByteArray(ev[2]);
          console.log(hexdump(bytes, {
            offset: 0,
            length: ev[2],
            header: true,
            ansi: false
          }));
        }
        modifiedBlocks.add(addr);
      }
    }
  }
});
```

### 8.5 암호화 함수 입출력 캡처

암호화 라이브러리의 함수 호출과 데이터를 추적한다.

```javascript
const libcrypto = Process.getModuleByName('libcrypto.so');
const aesEncrypt = Module.getExportByName('libcrypto.so', 'AES_encrypt');
const aesDecrypt = Module.getExportByName('libcrypto.so', 'AES_decrypt');

// libcrypto만 추적
for (const mod of Process.enumerateModules()) {
  if (mod.name !== 'libcrypto.so') {
    Stalker.exclude({ base: mod.base, size: mod.size });
  }
}

const probeEncrypt = Stalker.addCallProbe(aesEncrypt, (args) => {
  const input = args[0];
  const output = args[1];
  const key = args[2];

  console.log('[AES_encrypt]');
  console.log('  Input:', hexdump(input.readByteArray(16)));
  console.log('  Key:', hexdump(key.readByteArray(16)));

  // 반환 후 출력 캡처를 위한 Interceptor (Stalker 외부에서)
  // 또는 output 주소를 기록해두고 나중에 읽기
});

const probeDecrypt = Stalker.addCallProbe(aesDecrypt, (args) => {
  const input = args[0];
  const output = args[1];
  const key = args[2];

  console.log('[AES_decrypt]');
  console.log('  Input:', hexdump(input.readByteArray(16)));
  console.log('  Key:', hexdump(key.readByteArray(16)));
});

Stalker.follow(Process.getCurrentThreadId(), {
  events: { call: true }
});
```

### 8.6 실행 시간 프로파일링

각 함수의 실행 시간을 측정한다.

```javascript
const callStack = [];
const profileData = new Map();  // address → { totalTime, callCount }

Stalker.follow(Process.getCurrentThreadId(), {
  events: { call: true, ret: true },

  onReceive(events) {
    const parsed = Stalker.parse(events, {
      annotate: true,
      stringify: true
    });

    const now = Date.now();  // 참고: 정밀 타이밍에는 부적합 (이벤트 버퍼링 때문)

    for (const ev of parsed) {
      if (ev[0] === 'call') {
        callStack.push({
          target: ev[2],
          startTime: now
        });
      } else if (ev[0] === 'ret' && callStack.length > 0) {
        const frame = callStack.pop();
        const elapsed = now - frame.startTime;

        if (!profileData.has(frame.target)) {
          profileData.set(frame.target, { totalTime: 0, callCount: 0 });
        }
        const data = profileData.get(frame.target);
        data.totalTime += elapsed;
        data.callCount++;
      }
    }
  }
});

// 프로파일 결과 출력
function printProfile() {
  Stalker.flush();

  const sorted = [...profileData.entries()]
    .sort((a, b) => b[1].totalTime - a[1].totalTime);

  console.log('\n=== 프로파일 결과 ===');
  console.log('주소              | 함수명                    | 호출수 | 총 시간(ms)');
  console.log('-'.repeat(80));

  for (const [addr, data] of sorted.slice(0, 20)) {
    const sym = DebugSymbol.fromAddress(ptr(addr));
    const name = (sym.name || '(unknown)').padEnd(25);
    console.log(
      `${addr} | ${name} | ${String(data.callCount).padStart(6)} | ${data.totalTime}`
    );
  }
}
```

### 8.7 조건부 스냅샷 (특정 조건에서만 상세 추적)

특정 함수가 특정 인수로 호출될 때만 상세 추적을 활성화하는 패턴이다.

```javascript
const targetFunc = Module.getExportByName(null, 'process_request');
let detailedTrace = false;
const traceLog = [];

Stalker.follow(Process.getCurrentThreadId(), {
  transform(iterator) {
    let instruction = iterator.next();
    const blockStart = instruction.address;

    do {
      // process_request 진입 시 인수 확인
      if (instruction.address.equals(targetFunc)) {
        iterator.putCallout((context) => {
          const requestType = context.x0.toUInt32();

          // type == 0x42일 때만 상세 추적 활성화
          if (requestType === 0x42) {
            detailedTrace = true;
            traceLog.length = 0;
            console.log('[*] Detailed trace activated for request type 0x42');
          }
        });
      }

      // 상세 추적 중일 때 모든 BL 명령어 기록
      if (instruction.mnemonic === 'bl' || instruction.mnemonic === 'call') {
        iterator.putCallout((context) => {
          if (detailedTrace) {
            traceLog.push({
              pc: context.pc.toString(),
              target: DebugSymbol.fromAddress(context.pc).name
            });
          }
        });
      }

      // RET에서 상세 추적 종료
      if (instruction.mnemonic === 'ret') {
        iterator.putCallout((context) => {
          if (detailedTrace) {
            detailedTrace = false;
            console.log(`[*] Trace complete. ${traceLog.length} calls recorded.`);
            for (const entry of traceLog) {
              console.log(`  ${entry.pc}: ${entry.target}`);
            }
          }
        });
      }

      iterator.keep();
    } while ((instruction = iterator.next()) !== null);
  }
});
```

---

## 9. CModule/RustModule 연동

### 9.1 CModule 기반 고성능 Stalker

JavaScript 콜백의 오버헤드를 제거하기 위해 CModule로 전체 Transform 로직을 작성할 수 있다.

```javascript
const cm = new CModule(`
#include <gum/gumstalker.h>
#include <gum/gummetalarray.h>
#include <string.h>

typedef struct {
  GumAddress base;
  guint64 size;
} ModuleRange;

typedef struct {
  ModuleRange target;
  guint64 block_count;
  guint64 call_count;
  GumAddress coverage[65536];
  guint32 coverage_count;
} StalkerContext;

extern void transform(GumStalkerIterator *iterator,
                       GumStalkerOutput *output,
                       gpointer user_data);

extern void on_call_probe(GumCallSite *site, gpointer user_data);

static void callout_on_block(GumCpuContext *cpu_context,
                              gpointer user_data) {
  StalkerContext *ctx = (StalkerContext *)user_data;
  ctx->block_count++;

  #if defined(__aarch64__)
  GumAddress pc = cpu_context->pc;
  #elif defined(__x86_64__)
  GumAddress pc = cpu_context->rip;
  #endif

  // 대상 모듈 내 블록이면 커버리지 기록
  if (pc >= ctx->target.base &&
      pc < ctx->target.base + ctx->target.size) {
    if (ctx->coverage_count < 65536) {
      ctx->coverage[ctx->coverage_count++] = pc;
    }
  }
}

void transform(GumStalkerIterator *iterator,
               GumStalkerOutput *output,
               gpointer user_data) {
  StalkerContext *ctx = (StalkerContext *)user_data;
  const cs_insn *insn;

  while (gum_stalker_iterator_next(iterator, &insn)) {
    // 블록 첫 명령어에 callout 삽입
    if (insn->address >= ctx->target.base &&
        insn->address < ctx->target.base + ctx->target.size) {
      gum_stalker_iterator_put_callout(iterator,
        callout_on_block, ctx, NULL);
    }

    gum_stalker_iterator_keep(iterator);
  }
}
`, {
  // 외부 심볼 매핑 (필요시)
});

// 컨텍스트 초기화
const targetMod = Process.getModuleByName('libtarget.so');
const ctxSize = 8 + 8 + 8 + 8 + (8 * 65536) + 4;
const ctx = Memory.alloc(ctxSize);
ctx.writeU64(targetMod.base.toUInt32());               // target.base
ctx.add(8).writeU64(targetMod.size);                    // target.size
ctx.add(16).writeU64(0);                                // block_count
ctx.add(24).writeU64(0);                                // call_count
// coverage 배열과 coverage_count는 0으로 초기화됨

Stalker.follow(Process.getCurrentThreadId(), {
  transform: cm.transform,
  data: ctx
});

// 결과 읽기
setInterval(() => {
  const blocks = ctx.add(16).readU64();
  const coverageCount = ctx.add(32 + 8 * 65536).readU32();
  console.log(`Blocks: ${blocks}, Coverage: ${coverageCount} unique blocks`);
}, 3000);
```

### 9.2 CModule Transform과 JavaScript 하이브리드

CModule에서 고성능 필터링을 하고, 흥미로운 이벤트만 JavaScript로 전달하는 패턴이다.

```javascript
const cm = new CModule(`
#include <gum/gumstalker.h>

extern void on_interesting_call(GumCpuContext *cpu_context, gpointer user_data);

typedef struct {
  GumAddress watch_address;
  guint64 hit_count;
} WatchPoint;

static void check_and_notify(GumCpuContext *cpu_context, gpointer user_data) {
  WatchPoint *wp = (WatchPoint *)user_data;

  #if defined(__aarch64__)
  GumAddress current_pc = cpu_context->pc;
  #elif defined(__x86_64__)
  GumAddress current_pc = cpu_context->rip;
  #endif

  if (current_pc == wp->watch_address) {
    wp->hit_count++;
    // JavaScript 콜백 호출 (비용이 크므로 조건부로만)
    on_interesting_call(cpu_context, user_data);
  }
}
`, {
  on_interesting_call: new NativeCallback((context, userData) => {
    console.log('Interesting call detected!');
    // JavaScript에서 상세 처리
  }, 'void', ['pointer', 'pointer'])
});
```

---

## 10. 주의사항 및 트러블슈팅

### 10.1 일반적인 주의사항

| 주의 사항 | 설명 | 대응 |
|-----------|------|------|
| **exec 이벤트 오버헤드** | `exec` 이벤트는 모든 명령어에 대해 발생하므로 극도의 오버헤드를 유발 | 디버깅/분석 용도로만 사용. 프로덕션에서는 `block` 또는 `compile` 사용 |
| **메모리 누수** | `follow()` 후 `unfollow()`를 호출하지 않으면 slab 메모리가 계속 증가 | 반드시 `unfollow()` + `garbageCollect()` 쌍으로 사용 |
| **Interceptor 충돌** | Stalker 컨텍스트에서 `Interceptor.attach()`가 불안정 | `Stalker.addCallProbe()` 사용 |
| **ARM64 PAC** | Pointer Authentication Code가 자동 처리됨 | 일반적으로 추가 처리 불필요 |
| **trustThreshold 트레이드오프** | 높은 값은 SMC를 놓칠 수 있고, -1은 성능 저하 | 용도에 따라 적절히 설정 |
| **exclude 범위 내부** | 제외된 범위에서는 내부 실행이 관찰 불가 | 인수/반환값은 진입/종료 시점에서 캡처 가능 |

### 10.2 자주 발생하는 문제

#### 문제 1: Stalker가 크래시를 유발하는 경우

```javascript
// ❌ 잘못된 사용: 블록에 아무 명령어도 유지하지 않음
Stalker.follow(threadId, {
  transform(iterator) {
    let instruction = iterator.next();
    do {
      // keep()을 호출하지 않으면 빈 블록이 생성 → 크래시
      // iterator.keep();  ← 이것을 빼먹음
    } while ((instruction = iterator.next()) !== null);
  }
});

// ✅ 올바른 사용: 모든 명령어를 반드시 keep() 또는 대체
Stalker.follow(threadId, {
  transform(iterator) {
    let instruction = iterator.next();
    do {
      if (shouldSkip(instruction)) {
        iterator.putNop();  // 제거하고 싶으면 NOP으로 대체
      } else {
        iterator.keep();
      }
    } while ((instruction = iterator.next()) !== null);
  }
});
```

#### 문제 2: follow 직후 이벤트가 오지 않는 경우

```javascript
// 원인: 대상 스레드가 아직 실행되지 않았거나, exclude로 모두 제외됨
// 해결: flush()로 강제 전달하거나, exclude 범위 확인

Stalker.follow(threadId, {
  events: { call: true },
  onReceive(events) {
    console.log('Events received:', events.byteLength);
  }
});

// 강제로 이벤트 비우기
setTimeout(() => {
  Stalker.flush();
}, 1000);
```

#### 문제 3: onCallSummary에 아무것도 오지 않는 경우

```javascript
// onCallSummary는 events.call이 활성화되어야 동작
Stalker.follow(threadId, {
  events: { call: true },  // ← 반드시 필요
  onCallSummary(summary) {
    console.log(JSON.stringify(summary));
  }
});
```

#### 문제 4: unfollow 후 크래시

```javascript
// ❌ 위험: unfollow 직후 GC
Stalker.unfollow(threadId);
Stalker.garbageCollect();  // 스레드가 아직 계측 코드에 있을 수 있음

// ✅ 안전: 충분한 대기 후 GC
Stalker.unfollow(threadId);
setTimeout(() => {
  Stalker.garbageCollect();
}, 1000);
```

#### 문제 5: 다중 스레드 추적 시 혼란

```javascript
// 스레드별 이벤트 구분
const threadCallbacks = {};

for (const thread of Process.enumerateThreads()) {
  const tid = thread.id;

  Stalker.follow(tid, {
    events: { call: true },
    onReceive(events) {
      const parsed = Stalker.parse(events, { annotate: true, stringify: true });
      // 각 콜백은 해당 스레드의 이벤트만 수신
      console.log(`[Thread ${tid}] ${parsed.length} events`);
    }
  });
}
```

### 10.3 디버깅 팁

```javascript
// 1. Stalker 상태 확인을 위한 compile 이벤트 활용
Stalker.follow(threadId, {
  events: { compile: true },
  onReceive(events) {
    const parsed = Stalker.parse(events, { annotate: true, stringify: true });
    for (const ev of parsed) {
      if (ev[0] === 'compile') {
        const sym = DebugSymbol.fromAddress(ptr(ev[1]));
        console.log(`[COMPILE] ${ev[1]}: ${sym} (${ev[2]} bytes)`);
      }
    }
  }
});

// 2. transform 콜백에서 블록 경계 로깅
Stalker.follow(threadId, {
  transform(iterator) {
    let instruction = iterator.next();
    const blockStart = instruction.address;
    let instrCount = 0;

    do {
      instrCount++;
      iterator.keep();
    } while ((instruction = iterator.next()) !== null);

    // 이 로그는 블록 컴파일 시에만 출력 (캐시 후에는 미출력)
    const sym = DebugSymbol.fromAddress(blockStart);
    console.log(`[BLOCK] ${blockStart} (${sym.name}): ${instrCount} instructions`);
  }
});

// 3. 특정 레지스터 값 추적
Stalker.follow(threadId, {
  transform(iterator) {
    let instruction = iterator.next();

    do {
      // 모든 BL 명령어에서 x0 (첫 번째 인수) 로깅
      if (instruction.mnemonic === 'bl') {
        const addr = instruction.address;
        iterator.putCallout((context) => {
          console.log(`[${addr}] BL with x0=${context.x0}, x1=${context.x1}`);
        });
      }

      iterator.keep();
    } while ((instruction = iterator.next()) !== null);
  }
});
```

### 10.4 플랫폼별 참고사항

#### macOS / iOS (ARM64)

```javascript
// PAC (Pointer Authentication Code) 관련
// Stalker가 자동으로 PAC을 처리하므로 별도 대응 불필요
// 그러나 수동으로 포인터를 읽을 때는 strip 필요

const rawPtr = someAddress.readPointer();
const strippedPtr = rawPtr.strip();  // PAC 비트 제거

// macOS에서 시스템 라이브러리 제외
const systemLibs = [
  'libSystem.B.dylib',
  'libc++.1.dylib',
  'libobjc.A.dylib',
  'libdispatch.dylib',
  'CoreFoundation',
];

for (const name of systemLibs) {
  try {
    const mod = Process.getModuleByName(name);
    Stalker.exclude({ base: mod.base, size: mod.size });
  } catch (e) {}
}
```

#### Android / Linux (ARM64)

```javascript
// Android에서 시스템 라이브러리 제외
const androidSystemLibs = [
  'libc.so',
  'libm.so',
  'libdl.so',
  'liblog.so',
  'libstdc++.so',
  'libart.so',        // ART 런타임
  'libandroid.so',
];

for (const name of androidSystemLibs) {
  try {
    const mod = Process.getModuleByName(name);
    Stalker.exclude({ base: mod.base, size: mod.size });
  } catch (e) {}
}

// linker 제외 (매우 중요 — 포함 시 크래시 가능성)
try {
  const linker = Process.getModuleByName('linker64');
  Stalker.exclude({ base: linker.base, size: linker.size });
} catch (e) {}
```

#### Windows (x64)

```javascript
// Windows에서 시스템 DLL 제외
const winSystemDlls = [
  'ntdll.dll',
  'kernel32.dll',
  'kernelbase.dll',
  'msvcrt.dll',
  'ucrtbase.dll',
  'advapi32.dll',
  'user32.dll',
];

for (const name of winSystemDlls) {
  try {
    const mod = Process.getModuleByName(name);
    Stalker.exclude({ base: mod.base, size: mod.size });
  } catch (e) {}
}
```

---

## 참고 자료

- [Frida 공식 문서 - Stalker](https://frida.re/docs/stalker/)
- [Frida API Reference - Stalker](https://frida.re/docs/javascript-api/#stalker)
- [Frida Gum 소스 코드 (gumstalker)](https://github.com/frida/frida-gum)
- [Anatomy of a code tracer](https://medium.com/@oleavr/anatomy-of-a-code-tracer-b081aadb0df8) — Ole Andre V. Ravnas (Frida 창시자)
