# Frida Memory API 레퍼런스

> Frida의 메모리 조작 API 완전 가이드 — 할당, 읽기/쓰기, 스캔, 보호, 패치, 모니터링

---

## 목차

1. [메모리 할당](#1-메모리-할당)
   - 1.1 [Memory.alloc()](#11-memoryallocsize-options)
   - 1.2 [문자열 할당](#12-문자열-할당)
2. [메모리 복사/복제](#2-메모리-복사복제)
   - 2.1 [Memory.copy()](#21-memorycopydst-src-n)
   - 2.2 [Memory.dup()](#22-memorydupaddress-size)
3. [메모리 보호](#3-메모리-보호)
   - 3.1 [Memory.protect()](#31-memoryprotectaddress-size-protection)
   - 3.2 [Memory.queryProtection()](#32-memoryqueryprotectionaddress)
4. [코드 패치](#4-코드-패치)
   - 4.1 [Memory.patchCode()](#41-memorypatchcodeaddress-size-apply)
   - 4.2 [아키텍처별 Writer 연동](#42-아키텍처별-writer-연동)
5. [메모리 스캔](#5-메모리-스캔)
   - 5.1 [Memory.scan()](#51-memoryscanaddress-size-pattern-callbacks)
   - 5.2 [Memory.scanSync()](#52-memoryscansyncaddress-size-pattern)
   - 5.3 [대용량 스캔 전략](#53-대용량-스캔-전략)
6. [NativePointer 읽기/쓰기](#6-nativepointer-읽기쓰기)
   - 6.1 [정수 타입](#61-정수-타입)
   - 6.2 [실수 타입](#62-실수-타입)
   - 6.3 [포인터 타입](#63-포인터-타입)
   - 6.4 [바이트 배열](#64-바이트-배열)
   - 6.5 [Volatile 읽기/쓰기](#65-volatile-읽기쓰기)
   - 6.6 [문자열 읽기/쓰기](#66-문자열-읽기쓰기)
   - 6.7 [패턴 변환](#67-패턴-변환)
7. [MemoryAccessMonitor](#7-memoryaccessmonitor)
   - 7.1 [enable()](#71-enableranges-callbacks)
   - 7.2 [disable()](#72-disable)
   - 7.3 [활용 예제](#73-활용-예제)
8. [ArrayBuffer 유틸리티](#8-arraybuffer-유틸리티)
   - 8.1 [ArrayBuffer.wrap()](#81-arraybufferwrapaddress-size)
   - 8.2 [ArrayBuffer.unwrap()](#82-arraybufferunwrapbuffer)
9. [주의사항 및 베스트 프랙티스](#9-주의사항-및-베스트-프랙티스)

---

## 1. 메모리 할당

### 1.1 Memory.alloc(size[, options])

프로세스 힙에 `size` 바이트의 메모리를 할당한다. 할당된 메모리는 JavaScript의 가비지 컬렉터(GC)가 반환된 `NativePointer`를 수거할 때 자동으로 해제된다.

**시그니처:**

```typescript
Memory.alloc(size: number, options?: { near?: NativePointer; maxDistance?: number }): NativePointer
```

**파라미터:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `size` | `number` | 할당할 바이트 수 |
| `options.near` | `NativePointer` | 이 주소 근처에 할당 (선택) |
| `options.maxDistance` | `number` | `near`로부터 최대 거리 (바이트) |

**반환:** `NativePointer` — 할당된 메모리의 시작 주소

> **핵심 주의사항:** 반환된 `NativePointer`를 변수에 유지하지 않으면 GC가 수거하면서 메모리가 해제된다. 특히 `Interceptor` 콜백 내에서 할당한 메모리는 반드시 `this`에 저장해야 한다.

**기본 예제:**

```javascript
// 256바이트 버퍼 할당
const buf = Memory.alloc(256);

// 할당된 메모리에 데이터 쓰기
buf.writeU32(0xDEADBEEF);
buf.add(4).writeU32(0xCAFEBABE);

// 데이터 읽기
console.log('첫 4바이트:', buf.readU32().toString(16));       // deadbeef
console.log('다음 4바이트:', buf.add(4).readU32().toString(16)); // cafebabe
```

**near 옵션을 활용한 코드 근처 할당:**

코드 패치 시 분기(branch) 명령어의 도달 범위 내에 메모리를 할당해야 할 때 사용한다. ARM64에서 B 명령어의 도달 범위는 +/-128MB이므로, 원본 코드 근처에 할당하면 직접 분기가 가능하다.

```javascript
// 후킹 대상 함수 주소
const targetFunc = Module.getExportByName(null, 'target_function');

// targetFunc로부터 128MB 이내에 메모리 할당
const trampoline = Memory.alloc(Process.pageSize, {
  near: targetFunc,
  maxDistance: 128 * 1024 * 1024  // 128MB
});

console.log(`원본 함수: ${targetFunc}`);
console.log(`트램폴린:  ${trampoline}`);
console.log(`거리: ${trampoline.sub(targetFunc).toInt32()} 바이트`);
```

**구조체 할당 예제:**

```javascript
// C 구조체에 해당하는 메모리 할당
// struct Point { int32_t x; int32_t y; float z; };
const POINT_SIZE = 4 + 4 + 4; // 12 bytes
const point = Memory.alloc(POINT_SIZE);

point.writeS32(100);          // x = 100
point.add(4).writeS32(200);   // y = 200
point.add(8).writeFloat(3.14); // z = 3.14

console.log(`Point(${point.readS32()}, ${point.add(4).readS32()}, ${point.add(8).readFloat()})`);
// 출력: Point(100, 200, 3.140000104904175)
```

**배열 할당 예제:**

```javascript
// int32_t 배열 10개 할당
const count = 10;
const arr = Memory.alloc(count * 4);

// 값 채우기
for (let i = 0; i < count; i++) {
  arr.add(i * 4).writeS32(i * i);
}

// 값 읽기
for (let i = 0; i < count; i++) {
  console.log(`arr[${i}] = ${arr.add(i * 4).readS32()}`);
}
// arr[0] = 0, arr[1] = 1, arr[2] = 4, arr[3] = 9, ...
```

---

### 1.2 문자열 할당

문자열을 새 힙 메모리에 할당하고 해당 `NativePointer`를 반환한다. GC 동작은 `Memory.alloc()`과 동일하다.

**시그니처:**

```typescript
Memory.allocUtf8String(str: string): NativePointer    // UTF-8 인코딩
Memory.allocUtf16String(str: string): NativePointer   // UTF-16 인코딩 (Windows wchar_t)
Memory.allocAnsiString(str: string): NativePointer    // ANSI 인코딩 (Windows 전용)
```

**기본 예제:**

```javascript
// UTF-8 문자열 할당
const greeting = Memory.allocUtf8String('Hello, Frida!');
console.log(greeting.readUtf8String()); // "Hello, Frida!"

// UTF-16 문자열 할당 (Windows API에서 주로 사용)
const wideStr = Memory.allocUtf16String('Wide String');
console.log(wideStr.readUtf16String()); // "Wide String"

// 한국어 문자열
const korean = Memory.allocUtf8String('프리다 메모리 분석');
console.log(korean.readUtf8String()); // "프리다 메모리 분석"
```

**Interceptor에서 인수 교체 (가장 핵심적인 패턴):**

```javascript
// open() 시스템 콜의 파일 경로를 교체하는 예제
const openPtr = Module.getExportByName(null, 'open');

Interceptor.attach(openPtr, {
  onEnter(args) {
    const originalPath = args[0].readUtf8String();
    console.log(`[open] 원본 경로: ${originalPath}`);

    if (originalPath === '/etc/ssl/certs/ca-certificates.crt') {
      // !! 반드시 this에 저장 — 로컬 변수에만 저장하면 GC가 수거할 수 있음 !!
      this.fakePath = Memory.allocUtf8String('/tmp/fake-cert.pem');
      args[0] = this.fakePath;
      console.log(`[open] 경로 교체 → /tmp/fake-cert.pem`);
    }
  },
  onLeave(retval) {
    // onEnter에서 교체한 경우 로그
    if (this.fakePath !== undefined) {
      console.log(`[open] 반환값: ${retval}`);
    }
  }
});
```

> **흔한 실수 — GC에 의한 메모리 해제:**
>
> ```javascript
> // 잘못된 예 -- 절대 이렇게 하지 말 것!
> Interceptor.attach(openPtr, {
>   onEnter(args) {
>     const buf = Memory.allocUtf8String('/fake/path'); // 로컬 변수
>     args[0] = buf;
>     // buf는 onEnter 종료 시 GC 대상 → 대상 함수가 읽기 전에 해제될 수 있음!
>   }
> });
>
> // 올바른 예
> Interceptor.attach(openPtr, {
>   onEnter(args) {
>     this.buf = Memory.allocUtf8String('/fake/path'); // this에 저장 → onLeave까지 유지
>     args[0] = this.buf;
>   }
> });
> ```

**Windows API 후킹 — UTF-16/ANSI 예제:**

```javascript
// Windows CreateFileW (UTF-16)
const createFileW = Module.getExportByName('kernel32.dll', 'CreateFileW');

Interceptor.attach(createFileW, {
  onEnter(args) {
    const filePath = args[0].readUtf16String();
    console.log(`[CreateFileW] ${filePath}`);

    if (filePath.includes('config.dat')) {
      this.newPath = Memory.allocUtf16String('C:\\temp\\fake_config.dat');
      args[0] = this.newPath;
    }
  }
});

// Windows CreateFileA (ANSI)
const createFileA = Module.getExportByName('kernel32.dll', 'CreateFileA');

Interceptor.attach(createFileA, {
  onEnter(args) {
    const filePath = args[0].readAnsiString();
    console.log(`[CreateFileA] ${filePath}`);

    if (filePath.includes('license.key')) {
      this.newPath = Memory.allocAnsiString('C:\\temp\\fake_license.key');
      args[0] = this.newPath;
    }
  }
});
```

**여러 문자열 동시 관리:**

```javascript
// 환경 변수 조작 예제
const getenvPtr = Module.getExportByName(null, 'getenv');

// 교체할 환경 변수 맵 — 스크립트 수명 동안 유지
const envOverrides = new Map();
envOverrides.set('HOME', Memory.allocUtf8String('/fake/home'));
envOverrides.set('USER', Memory.allocUtf8String('fakeuser'));
envOverrides.set('LD_PRELOAD', Memory.allocUtf8String(''));

Interceptor.attach(getenvPtr, {
  onEnter(args) {
    this.envName = args[0].readUtf8String();
  },
  onLeave(retval) {
    if (this.envName && envOverrides.has(this.envName)) {
      retval.replace(envOverrides.get(this.envName));
      console.log(`[getenv] ${this.envName} → 교체됨`);
    }
  }
});
```

---

## 2. 메모리 복사/복제

### 2.1 Memory.copy(dst, src, n)

`src`에서 `dst`로 `n` 바이트를 복사한다. C 표준 라이브러리의 `memcpy()`와 동일하다. 메모리 영역이 겹치는 경우의 동작은 정의되지 않는다 (겹치는 경우 `memmove` 구현 필요).

**시그니처:**

```typescript
Memory.copy(dst: NativePointer, src: NativePointer, n: number | UInt64): void
```

**예제:**

```javascript
// 기본 복사
const src = Memory.alloc(16);
const dst = Memory.alloc(16);

src.writeU32(0x41424344);  // "ABCD" in ASCII
src.add(4).writeU32(0x45464748);  // "EFGH"

Memory.copy(dst, src, 8);

console.log(dst.readU32().toString(16));       // 41424344
console.log(dst.add(4).readU32().toString(16)); // 45464748
```

**모듈 코드 섹션 백업:**

```javascript
// 함수의 원본 프롤로그를 백업
const targetFunc = Module.getExportByName(null, 'important_function');
const PROLOGUE_SIZE = 16;

const backup = Memory.alloc(PROLOGUE_SIZE);
Memory.copy(backup, targetFunc, PROLOGUE_SIZE);

console.log('원본 프롤로그 백업 완료');
console.log('백업 데이터:', hexdump(backup, { length: PROLOGUE_SIZE }));

// 나중에 원본 복원
function restorePrologue() {
  Memory.protect(targetFunc, PROLOGUE_SIZE, 'rwx');
  Memory.copy(targetFunc, backup, PROLOGUE_SIZE);
  Memory.protect(targetFunc, PROLOGUE_SIZE, 'r-x');
  console.log('프롤로그 복원 완료');
}
```

**구조체 배열 복사:**

```javascript
// 구조체 배열에서 특정 항목을 추출
const ENTRY_SIZE = 24; // 하나의 구조체 크기
const entries = ptr(0x12345678); // 구조체 배열 주소 (예시)
const index = 5;

const singleEntry = Memory.alloc(ENTRY_SIZE);
Memory.copy(singleEntry, entries.add(index * ENTRY_SIZE), ENTRY_SIZE);

console.log('추출된 엔트리:', hexdump(singleEntry, { length: ENTRY_SIZE }));
```

---

### 2.2 Memory.dup(address, size)

`address`에서 시작하는 `size` 바이트를 새로 할당한 메모리에 복제한다. `Memory.alloc(size)` + `Memory.copy()` 조합과 동일하지만 더 간결하다.

**시그니처:**

```typescript
Memory.dup(address: NativePointer, size: number | UInt64): NativePointer
```

**예제:**

```javascript
// 기본 복제
const original = Memory.alloc(32);
original.writeUtf8String('Hello, Memory!');

const clone = Memory.dup(original, 32);
console.log(clone.readUtf8String()); // "Hello, Memory!"

// clone을 수정해도 original에 영향 없음
clone.writeUtf8String('Modified!');
console.log(original.readUtf8String()); // "Hello, Memory!" (원본 유지)
console.log(clone.readUtf8String());    // "Modified!"
```

**함수 후킹에서 인수 구조체 복제:**

```javascript
// connect() 시스템 콜에서 sockaddr 구조체를 복제하여 분석
const connectPtr = Module.getExportByName(null, 'connect');

Interceptor.attach(connectPtr, {
  onEnter(args) {
    const sockfd = args[0].toInt32();
    const addrPtr = args[1];
    const addrLen = args[2].toInt32();

    // sockaddr 구조체를 복제하여 안전하게 분석
    // (원본 메모리가 콜백 중 변경될 수 있으므로)
    this.addrCopy = Memory.dup(addrPtr, addrLen);
    this.addrLen = addrLen;
    this.sockfd = sockfd;

    const family = this.addrCopy.readU16();
    if (family === 2) { // AF_INET
      const port = (this.addrCopy.add(2).readU8() << 8) | this.addrCopy.add(3).readU8();
      const ip = [
        this.addrCopy.add(4).readU8(),
        this.addrCopy.add(5).readU8(),
        this.addrCopy.add(6).readU8(),
        this.addrCopy.add(7).readU8()
      ].join('.');
      console.log(`[connect] fd=${sockfd} → ${ip}:${port}`);
    }
  }
});
```

**메모리 스냅샷:**

```javascript
// 특정 메모리 영역의 스냅샷을 찍어 나중에 비교
function takeSnapshot(address, size) {
  return {
    address: address,
    size: size,
    data: Memory.dup(address, size),
    timestamp: Date.now()
  };
}

function compareSnapshots(snap1, snap2) {
  const buf1 = snap1.data.readByteArray(snap1.size);
  const buf2 = snap2.data.readByteArray(snap2.size);
  const view1 = new Uint8Array(buf1);
  const view2 = new Uint8Array(buf2);

  const diffs = [];
  for (let i = 0; i < view1.length; i++) {
    if (view1[i] !== view2[i]) {
      diffs.push({
        offset: i,
        before: view1[i],
        after: view2[i]
      });
    }
  }
  return diffs;
}

// 사용 예
const target = Module.getExportByName(null, 'global_state');
const snap1 = takeSnapshot(target, 256);

// ... 시간이 지나거나 특정 이벤트 후 ...
// const snap2 = takeSnapshot(target, 256);
// const changes = compareSnapshots(snap1, snap2);
// changes.forEach(d => console.log(`오프셋 0x${d.offset.toString(16)}: ${d.before} → ${d.after}`));
```

---

## 3. 메모리 보호

### 3.1 Memory.protect(address, size, protection)

지정된 메모리 영역의 보호 속성을 변경한다. 주소는 페이지 경계에 정렬되어야 하며, size는 페이지 크기의 배수로 올림 처리된다.

**시그니처:**

```typescript
Memory.protect(address: NativePointer, size: number | UInt64, protection: string): boolean
```

**파라미터:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `address` | `NativePointer` | 대상 메모리 시작 주소 |
| `size` | `number` | 변경할 영역 크기 (바이트) |
| `protection` | `string` | 보호 속성 문자열 |

**보호 속성 문자열:**

| 값 | 의미 | 용도 |
|----|------|------|
| `'---'` | 접근 불가 | 가드 페이지, 접근 차단 |
| `'r--'` | 읽기 전용 | 상수 데이터 |
| `'rw-'` | 읽기/쓰기 | 일반 데이터 |
| `'r-x'` | 읽기/실행 | 코드 영역 (정상 상태) |
| `'rwx'` | 읽기/쓰기/실행 | 코드 수정 시 임시 설정 |

**반환:** `boolean` — 성공 시 `true`, 실패 시 `false`

**코드 영역 수정 패턴:**

```javascript
const targetFunc = Module.getExportByName(null, 'check_license');
const patchSize = 8;

// 1. 보호 속성을 rwx로 변경
const success = Memory.protect(targetFunc, patchSize, 'rwx');
if (!success) {
  console.error('메모리 보호 변경 실패!');
  // 실패 원인: 잘못된 주소, 커널 제한 등
} else {
  // 2. 코드 수정 (ARM64: MOV W0, #1; RET)
  targetFunc.writeU32(0x52800020);      // MOV W0, #1
  targetFunc.add(4).writeU32(0xD65F03C0); // RET

  // 3. 보호 속성을 원래대로 복원
  Memory.protect(targetFunc, patchSize, 'r-x');
  console.log('패치 완료: check_license → 항상 true 반환');
}
```

**데이터 영역 보호:**

```javascript
// 특정 전역 변수를 읽기 전용으로 만들어 변조 방지
const globalScore = Module.getExportByName(null, 'player_score');
const pageSize = Process.pageSize;

// 페이지 경계로 정렬
const pageStart = globalScore.and(ptr(pageSize - 1).not());

console.log(`변수 주소: ${globalScore}`);
console.log(`페이지 시작: ${pageStart}`);
console.log(`페이지 크기: ${pageSize}`);

// 쓰기 금지 설정
Memory.protect(pageStart, pageSize, 'r--');
console.log('player_score 쓰기 보호 활성화');

// 나중에 다시 쓰기 허용
// Memory.protect(pageStart, pageSize, 'rw-');
```

**메모리 보호 속성 일괄 변경:**

```javascript
// 모듈의 모든 읽기 전용 섹션을 쓰기 가능하게 변경
function makeModuleWritable(moduleName) {
  const module = Process.getModuleByName(moduleName);
  const ranges = module.enumerateRanges('r--');

  ranges.forEach(range => {
    const newProt = range.protection.replace('-', 'w');
    Memory.protect(range.base, range.size, 'rw-');
    console.log(`${range.base}-${range.base.add(range.size)}: ${range.protection} → rw-`);
  });

  return ranges.length;
}
```

---

### 3.2 Memory.queryProtection(address)

지정된 주소의 현재 메모리 보호 속성을 조회한다.

**시그니처:**

```typescript
Memory.queryProtection(address: NativePointer): string
```

**반환:** `string` — `'r-x'`, `'rw-'`, `'---'` 등의 보호 속성 문자열

**예제:**

```javascript
// 주소의 현재 보호 상태 확인
const textSection = Module.getExportByName(null, 'main');
const prot = Memory.queryProtection(textSection);
console.log(`main 함수 보호 속성: ${prot}`);  // 보통 "r-x"

// 데이터 섹션 확인
const dataSymbol = Module.getExportByName(null, 'some_global');
if (dataSymbol) {
  console.log(`전역변수 보호 속성: ${Memory.queryProtection(dataSymbol)}`);  // 보통 "rw-"
}
```

**수정 전 보호 상태 확인 및 복원:**

```javascript
function safePatch(address, size, patchFn) {
  // 원래 보호 속성 저장
  const originalProt = Memory.queryProtection(address);
  console.log(`원래 보호 속성: ${originalProt}`);

  // 쓰기 가능하게 변경
  if (!originalProt.includes('w')) {
    Memory.protect(address, size, 'rwx');
  }

  // 패치 적용
  patchFn(address);

  // 원래 보호 속성으로 복원
  Memory.protect(address, size, originalProt);
  console.log(`보호 속성 복원: ${originalProt}`);
}

// 사용
safePatch(targetFunc, 8, (addr) => {
  addr.writeU32(0x52800020);      // MOV W0, #1
  addr.add(4).writeU32(0xD65F03C0); // RET
});
```

**모듈 메모리 맵 출력:**

```javascript
function printModuleMemoryMap(moduleName) {
  const module = Process.getModuleByName(moduleName);
  console.log(`\n=== ${moduleName} 메모리 맵 ===`);
  console.log(`기본 주소: ${module.base}`);
  console.log(`크기: ${module.size} (0x${module.size.toString(16)})`);

  const ranges = module.enumerateRanges('---');
  ranges.forEach((range, i) => {
    const end = range.base.add(range.size);
    const sizeKB = (range.size / 1024).toFixed(1);
    const file = range.file ? ` [${range.file.path}]` : '';
    console.log(`  [${i}] ${range.base}-${end}  ${range.protection}  ${sizeKB}KB${file}`);
  });
}

// 사용
printModuleMemoryMap('libc.so');
```

---

## 4. 코드 패치

### 4.1 Memory.patchCode(address, size, apply)

코드 영역을 안전하게 수정한다. 내부적으로 임시 쓰기 가능 매핑을 생성하고, `apply` 콜백에 쓰기 가능한 포인터를 전달한다. 콜백이 완료되면 원래 매핑으로 복원되며, 필요한 경우 캐시 플러시도 수행한다.

이 방식은 `Memory.protect()` + 직접 쓰기보다 안전하다. 멀티스레드 환경에서 코드를 수정할 때 경쟁 조건(race condition)을 최소화하고, iOS처럼 RWX 페이지가 금지된 환경에서도 동작한다.

**시그니처:**

```typescript
Memory.patchCode(address: NativePointer, size: number | UInt64, apply: (code: NativePointer) => void): void
```

**파라미터:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `address` | `NativePointer` | 패치할 코드의 시작 주소 |
| `size` | `number` | 패치에 사용할 최대 바이트 수 |
| `apply` | `function` | 쓰기 가능한 포인터를 받아 코드를 작성하는 콜백 |

> **중요:** `apply` 콜백에서 받는 `code` 포인터는 `address`와 다른 주소일 수 있다 (임시 매핑). 하지만 작성된 내용은 `address`에 반영된다. `Arm64Writer` 등의 Writer 클래스를 사용할 때는 `pc` 옵션으로 원래 주소를 지정해야 PC-relative 명령어가 올바르게 생성된다.

**기본 예제 — 함수를 NOP으로 패치:**

```javascript
const targetFunc = Module.getExportByName(null, 'anti_debug_check');

Memory.patchCode(targetFunc, 64, code => {
  const writer = new Arm64Writer(code, { pc: targetFunc });

  // 함수를 즉시 return 0으로 패치
  writer.putMovRegU16('x0', 0);  // MOV X0, #0
  writer.putRet();                // RET
  writer.flush();
});

console.log('anti_debug_check 패치 완료 → 항상 0 반환');
```

**x86/x64 함수 패치:**

```javascript
const targetFunc = Module.getExportByName(null, 'verify_signature');

Memory.patchCode(targetFunc, 16, code => {
  const writer = new X86Writer(code, { pc: targetFunc });

  // return 1 (EAX = 1)
  writer.putMovRegU32('eax', 1);  // MOV EAX, 1
  writer.putRet();                 // RET
  writer.flush();
});

console.log('verify_signature 패치 완료 → 항상 1 반환');
```

**조건 분기 패치 — 분기 방향 뒤집기:**

```javascript
// JNE (Jump if Not Equal)를 JE (Jump if Equal)로 변환
// 즉, 조건 검사 결과를 뒤집는 패치
const patchAddr = ptr('0x401234'); // 패치 대상 주소

Memory.patchCode(patchAddr, 2, code => {
  // x86 JNE (0x75) → JE (0x74)
  code.writeU8(0x74);
  code.add(1).writeU8(patchAddr.add(1).readU8()); // 원래 오프셋 유지
});
```

---

### 4.2 아키텍처별 Writer 연동

`Memory.patchCode()`는 아키텍처별 Writer 클래스와 함께 사용할 때 가장 강력하다.

**ARM64 — 인라인 후킹 트램폴린:**

```javascript
function inlineHookArm64(targetAddr, hookFn) {
  // 1. 후크 함수를 NativeCallback으로 변환
  const hookCallback = new NativeCallback(hookFn, 'void', ['pointer']);

  // 2. 트램폴린 메모리 할당 (타겟 근처)
  const trampolineSize = 256;
  const trampoline = Memory.alloc(trampolineSize, {
    near: targetAddr,
    maxDistance: 128 * 1024 * 1024
  });

  // 3. 원본 명령어 백업
  const backupSize = 16; // 4개 명령어
  const backup = Memory.dup(targetAddr, backupSize);

  // 4. 트램폴린 코드 작성: 후크 호출 → 원본 명령어 실행 → 원래 위치로 복귀
  Memory.patchCode(trampoline, trampolineSize, code => {
    const writer = new Arm64Writer(code, { pc: trampoline });

    // 레지스터 저장
    writer.putPushAllXRegisters();

    // 후크 함수 호출 (X0 = 컨텍스트)
    writer.putLdrRegAddress('x0', targetAddr);
    writer.putLdrRegAddress('x16', hookCallback);
    writer.putBlrReg('x16');

    // 레지스터 복원
    writer.putPopAllXRegisters();

    // 원본 명령어 재배치 실행
    const relocator = new Arm64Relocator(backup, writer);
    for (let i = 0; i < backupSize / 4; i++) {
      relocator.readOne();
      relocator.writeOne();
    }

    // 원래 코드로 복귀
    writer.putBImm(targetAddr.add(backupSize));
    writer.flush();
  });

  // 5. 원본 코드에 트램폴린으로의 분기 삽입
  Memory.patchCode(targetAddr, backupSize, code => {
    const writer = new Arm64Writer(code, { pc: targetAddr });
    writer.putBImm(trampoline);
    writer.flush();
  });

  return { trampoline, backup, backupSize };
}
```

**x86 — NOP 슬레드 삽입:**

```javascript
// 특정 범위를 NOP으로 채우기
function nopSlide(address, size) {
  Memory.patchCode(address, size, code => {
    const writer = new X86Writer(code, { pc: address });
    for (let i = 0; i < size; i++) {
      writer.putNop();
    }
    writer.flush();
  });
  console.log(`NOP 슬레드: ${address} ~ ${address.add(size)} (${size} bytes)`);
}

// 사용: 검사 코드 무력화
// nopSlide(ptr('0x401234'), 12);
```

---

## 5. 메모리 스캔

### 5.1 Memory.scan(address, size, pattern, callbacks)

지정된 메모리 범위에서 바이트 패턴을 비동기적으로 검색한다.

**시그니처:**

```typescript
Memory.scan(
  address: NativePointer,
  size: number | UInt64,
  pattern: string,
  callbacks: {
    onMatch: (address: NativePointer, size: number) => string | void;
    onError?: (reason: string) => void;
    onComplete?: () => void;
  }
): void
```

**패턴 문법:**

| 형식 | 설명 | 예시 |
|------|------|------|
| 정확한 바이트 | 16진수 바이트 나열 | `"48 89 5c 24 08"` |
| 와일드카드 | `??`로 임의 바이트 매칭 | `"48 89 ?? 24 ??"` |
| r2-style 마스크 | 값과 마스크를 `:`로 구분 | `"13 37 13 37 : 1f ff ff f1"` |

**callbacks:**

| 콜백 | 설명 |
|-------|------|
| `onMatch(address, size)` | 매치 발견 시 호출. `'stop'` 반환 시 스캔 중단 |
| `onError(reason)` | 접근 불가 메모리 등 오류 시 호출 |
| `onComplete()` | 스캔 완료 시 호출 |

**기본 예제 — 바이트 패턴 검색:**

```javascript
const module = Process.getModuleByName('target_app');

// "48 8B 05 ?? ?? ?? ??" 패턴 검색 (x64 MOV RAX, [RIP+disp32])
Memory.scan(module.base, module.size, '48 8B 05 ?? ?? ?? ??', {
  onMatch(address, size) {
    const disp = address.add(3).readS32();
    const targetAddr = address.add(7).add(disp); // RIP + 7 + displacement
    console.log(`[발견] ${address}: MOV RAX, [${targetAddr}]`);
  },
  onError(reason) {
    console.log(`[오류] ${reason}`);
  },
  onComplete() {
    console.log('[완료] 스캔 종료');
  }
});
```

**문자열 검색:**

```javascript
// 메모리에서 특정 문자열 검색
function searchString(moduleName, searchStr) {
  const module = Process.getModuleByName(moduleName);

  // 문자열을 hex 패턴으로 변환
  const hexPattern = Array.from(new TextEncoder().encode(searchStr))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');

  console.log(`"${searchStr}" 검색 중... (패턴: ${hexPattern})`);

  Memory.scan(module.base, module.size, hexPattern, {
    onMatch(address, size) {
      console.log(`  발견: ${address}`);
      console.log(`  컨텍스트: ${hexdump(address.sub(8), { length: size + 16 })}`);
    },
    onComplete() {
      console.log('검색 완료');
    }
  });
}

// 사용
searchString('libgame.so', 'GAME_OVER');
```

**첫 번째 매치만 찾기:**

```javascript
function findFirst(base, size, pattern) {
  return new Promise((resolve, reject) => {
    let found = null;

    Memory.scan(base, size, pattern, {
      onMatch(address, size) {
        found = { address, size };
        return 'stop'; // 첫 번째 매치 후 즉시 중단
      },
      onError(reason) {
        reject(new Error(reason));
      },
      onComplete() {
        resolve(found);
      }
    });
  });
}

// 사용
async function main() {
  const module = Process.getModuleByName('target');
  const result = await findFirst(module.base, module.size, 'FF 25 ?? ?? ?? ??');

  if (result) {
    console.log(`첫 번째 매치: ${result.address}`);
  } else {
    console.log('패턴을 찾지 못함');
  }
}
```

**r2-style 마스크 패턴:**

```javascript
// ARM64에서 BL (Branch with Link) 명령어 검색
// BL의 인코딩: 1001 01xx xxxx xxxx xxxx xxxx xxxx xxxx
// 마스크: FC000000 (상위 6비트만 확인)
const module = Process.getModuleByName('target');

Memory.scan(module.base, module.size, '00 00 00 94 : 00 00 00 FC', {
  onMatch(address, size) {
    const insn = address.readU32();
    const imm26 = insn & 0x03FFFFFF;
    // 부호 확장
    const offset = (imm26 & 0x02000000) ? (imm26 | 0xFC000000) : imm26;
    const target = address.add(offset * 4);
    console.log(`BL ${target} @ ${address}`);
  },
  onComplete() {
    console.log('BL 명령어 검색 완료');
  }
});
```

---

### 5.2 Memory.scanSync(address, size, pattern)

`Memory.scan()`의 동기 버전. 모든 매치 결과를 배열로 반환한다.

**시그니처:**

```typescript
Memory.scanSync(address: NativePointer, size: number | UInt64, pattern: string): Array<{ address: NativePointer; size: number }>
```

**예제:**

```javascript
const module = Process.getModuleByName('target');

// 동기 스캔 — 결과를 바로 배열로 받음
const matches = Memory.scanSync(module.base, module.size, 'FF 15 ?? ?? ?? ??');

console.log(`${matches.length}개의 CALL [RIP+disp32] 발견:`);
matches.forEach((match, i) => {
  const disp = match.address.add(2).readS32();
  const callTarget = match.address.add(6).add(disp);
  console.log(`  [${i}] ${match.address}: CALL [${callTarget}]`);
});
```

**패턴 기반 함수 탐색:**

```javascript
// 함수 프롤로그 패턴으로 함수 시작점 찾기
function findFunctions(moduleName) {
  const module = Process.getModuleByName(moduleName);

  // x86_64 일반적인 함수 프롤로그: push rbp; mov rbp, rsp
  const prologuePattern = '55 48 89 E5';

  const matches = Memory.scanSync(module.base, module.size, prologuePattern);
  console.log(`${moduleName}에서 ${matches.length}개의 함수 프롤로그 발견`);

  return matches.map(m => m.address);
}

// ARM64 함수 프롤로그: STP X29, X30, [SP, #-0x??]!
function findFunctionsArm64(moduleName) {
  const module = Process.getModuleByName(moduleName);

  // STP X29, X30, [SP, #imm]! 패턴
  // 인코딩: A9 B? 7B FD (마스크 필요)
  const matches = Memory.scanSync(module.base, module.size, 'FD 7B ?? A9 : FF FF 00 FF');
  console.log(`${moduleName}에서 ${matches.length}개의 ARM64 함수 프롤로그 발견`);

  return matches.map(m => m.address);
}
```

**XRef(교차 참조) 찾기:**

```javascript
// 특정 주소를 참조하는 코드 찾기
function findXrefs(moduleName, targetAddress) {
  const module = Process.getModuleByName(moduleName);
  const xrefs = [];

  // x86_64: RIP-relative 참조 검색
  // 모든 4바이트 displacement를 스캔하여 targetAddress를 가리키는지 확인
  const ranges = module.enumerateRanges('r-x');

  ranges.forEach(range => {
    // 모든 가능한 displacement 패턴 검색은 비효율적이므로
    // 일반적인 명령어 패턴을 기준으로 검색
    const patterns = [
      '48 8B 05',  // MOV RAX, [RIP+disp]
      '48 8D 05',  // LEA RAX, [RIP+disp]
      'E8',        // CALL rel32
      'E9',        // JMP rel32
    ];

    const allBytes = Memory.scanSync(range.base, range.size, '?? ?? ?? ??');
    // 실제로는 각 명령어 패턴별로 스캔하는 것이 효율적
  });

  // CALL rel32 기반 XRef 검색
  const callPattern = 'E8 ?? ?? ?? ??';
  const calls = Memory.scanSync(module.base, module.size, callPattern);

  calls.forEach(match => {
    const disp = match.address.add(1).readS32();
    const callDest = match.address.add(5).add(disp);
    if (callDest.equals(targetAddress)) {
      xrefs.push(match.address);
    }
  });

  console.log(`${targetAddress}에 대한 CALL xref ${xrefs.length}개 발견`);
  xrefs.forEach(addr => console.log(`  ${addr}`));

  return xrefs;
}
```

---

### 5.3 대용량 스캔 전략

전체 프로세스 메모리를 스캔할 때는 읽기 가능한 영역만 필터링하고, 범위별로 나누어 스캔해야 한다.

**전체 프로세스 메모리 스캔:**

```javascript
function scanAllMemory(pattern) {
  const results = [];

  // 읽기 가능한 모든 메모리 범위 열거
  const ranges = Process.enumerateRanges('r--');
  console.log(`스캔 대상: ${ranges.length}개 범위`);

  let totalSize = 0;
  ranges.forEach(range => {
    totalSize += range.size;
  });
  console.log(`총 스캔 크기: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);

  ranges.forEach((range, i) => {
    try {
      const matches = Memory.scanSync(range.base, range.size, pattern);
      matches.forEach(match => {
        results.push({
          address: match.address,
          size: match.size,
          module: range.file ? range.file.path : 'anonymous',
          protection: range.protection
        });
      });

      if (matches.length > 0) {
        console.log(`  범위 [${i}] ${range.base}: ${matches.length}개 발견`);
      }
    } catch (e) {
      // 접근 불가 영역 건너뛰기
    }
  });

  console.log(`\n총 ${results.length}개 매치 발견`);
  return results;
}

// 사용
const hits = scanAllMemory('50 61 73 73 77 6F 72 64'); // "Password" ASCII
hits.forEach(h => {
  console.log(`${h.address} [${h.module}] ${h.protection}`);
  console.log(hexdump(h.address, { length: 64 }));
});
```

**비동기 대용량 스캔 (진행률 표시):**

```javascript
function scanAllMemoryAsync(pattern) {
  return new Promise((resolve) => {
    const ranges = Process.enumerateRanges('r--');
    const results = [];
    let currentIndex = 0;
    const totalRanges = ranges.length;

    function scanNext() {
      if (currentIndex >= totalRanges) {
        console.log(`\n스캔 완료: ${results.length}개 발견`);
        resolve(results);
        return;
      }

      const range = ranges[currentIndex];
      const progress = ((currentIndex / totalRanges) * 100).toFixed(1);

      Memory.scan(range.base, range.size, pattern, {
        onMatch(address, size) {
          results.push({ address, size, range });
          console.log(`  [${progress}%] 발견: ${address}`);
        },
        onError(reason) {
          // 무시하고 계속
        },
        onComplete() {
          currentIndex++;
          scanNext();
        }
      });
    }

    scanNext();
  });
}
```

**특정 모듈의 힙 메모리만 스캔:**

```javascript
function scanModuleHeap(moduleName, pattern) {
  const module = Process.getModuleByName(moduleName);
  const results = [];

  // 모듈에 속한 범위 중 쓰기 가능한 영역 (힙/데이터)
  const ranges = Process.enumerateRanges('rw-').filter(range => {
    // 모듈 파일과 매핑된 범위
    if (range.file && range.file.path.includes(moduleName)) {
      return true;
    }
    // 모듈 주소 범위 근처의 익명 매핑 (힙)
    const rangeEnd = range.base.add(range.size);
    return range.base.compare(module.base) >= 0 &&
           range.base.compare(module.base.add(module.size * 4)) <= 0;
  });

  console.log(`${moduleName} 관련 rw- 범위: ${ranges.length}개`);

  ranges.forEach(range => {
    const matches = Memory.scanSync(range.base, range.size, pattern);
    results.push(...matches);
  });

  return results;
}
```

**CARF 전략 — CModule/RustModule을 활용한 고속 스캔:**

```javascript
// CModule을 사용한 고속 메모리 스캔 (네이티브 속도)
const cm = new CModule(`
#include <glib.h>
#include <string.h>

typedef struct {
    void *address;
    int size;
} MatchResult;

int fast_scan(
    const uint8_t *base,
    int length,
    const uint8_t *needle,
    int needle_len,
    MatchResult *results,
    int max_results
) {
    int count = 0;
    for (int i = 0; i <= length - needle_len && count < max_results; i++) {
        if (memcmp(base + i, needle, needle_len) == 0) {
            results[count].address = (void *)(base + i);
            results[count].size = needle_len;
            count++;
        }
    }
    return count;
}
`);

const fastScan = new NativeFunction(cm.fast_scan, 'int', [
  'pointer', 'int', 'pointer', 'int', 'pointer', 'int'
]);

function nativeScan(base, size, needle) {
  const needleBuf = Memory.alloc(needle.length);
  for (let i = 0; i < needle.length; i++) {
    needleBuf.add(i).writeU8(needle[i]);
  }

  const MAX_RESULTS = 1000;
  const RESULT_SIZE = Process.pointerSize + 4;
  const resultsBuf = Memory.alloc(MAX_RESULTS * RESULT_SIZE);

  const count = fastScan(base, size, needleBuf, needle.length, resultsBuf, MAX_RESULTS);

  const results = [];
  for (let i = 0; i < count; i++) {
    results.push({
      address: resultsBuf.add(i * RESULT_SIZE).readPointer(),
      size: resultsBuf.add(i * RESULT_SIZE + Process.pointerSize).readS32()
    });
  }

  return results;
}
```

---

## 6. NativePointer 읽기/쓰기

`NativePointer` 인스턴스에서 직접 호출할 수 있는 메모리 읽기/쓰기 메서드다. 모든 메서드는 해당 주소의 메모리에 직접 접근한다.

### 6.1 정수 타입

**부호 있는 정수 (Signed):**

| 메서드 | 크기 | 값 범위 |
|--------|------|---------|
| `readS8()` / `writeS8(value)` | 1 byte | -128 ~ 127 |
| `readS16()` / `writeS16(value)` | 2 bytes | -32,768 ~ 32,767 |
| `readS32()` / `writeS32(value)` | 4 bytes | -2^31 ~ 2^31 - 1 |
| `readS64()` / `writeS64(value)` | 8 bytes | Int64 객체 |
| `readShort()` / `writeShort(value)` | 2 bytes | `readS16` 별칭 |
| `readInt()` / `writeInt(value)` | 4 bytes | `readS32` 별칭 |
| `readLong()` / `writeLong(value)` | 플랫폼 의존 | 32-bit: 4B, 64-bit: 8B |

**부호 없는 정수 (Unsigned):**

| 메서드 | 크기 | 값 범위 |
|--------|------|---------|
| `readU8()` / `writeU8(value)` | 1 byte | 0 ~ 255 |
| `readU16()` / `writeU16(value)` | 2 bytes | 0 ~ 65,535 |
| `readU32()` / `writeU32(value)` | 4 bytes | 0 ~ 4,294,967,295 |
| `readU64()` / `writeU64(value)` | 8 bytes | UInt64 객체 |
| `readUShort()` / `writeUShort(value)` | 2 bytes | `readU16` 별칭 |
| `readUInt()` / `writeUInt(value)` | 4 bytes | `readU32` 별칭 |
| `readULong()` / `writeULong(value)` | 플랫폼 의존 | 32-bit: 4B, 64-bit: 8B |

**예제:**

```javascript
const buf = Memory.alloc(64);

// S8/U8
buf.writeS8(-1);
console.log(buf.readS8());    // -1
console.log(buf.readU8());    // 255 (같은 비트 패턴, 다른 해석)

// S16/U16 (Big Endian 주의: Frida는 타겟 아키텍처의 엔디언을 따름)
buf.writeU16(0xBEEF);
console.log(buf.readU16().toString(16));  // beef
console.log(buf.readS16());               // -16657

// S32/U32
buf.writeU32(0xDEADBEEF);
console.log(buf.readU32().toString(16));  // deadbeef
console.log(buf.readS32());               // -559038737

// S64/U64 — Int64/UInt64 객체 사용
buf.writeU64(uint64('0x123456789ABCDEF0'));
console.log(buf.readU64().toString(16));  // 123456789abcdef0

buf.writeS64(int64('-1'));
console.log(buf.readS64().toString());    // -1
console.log(buf.readU64().toString(16));  // ffffffffffffffff
```

**구조체 읽기 예제:**

```javascript
// ELF 헤더 파싱
function parseElfHeader(baseAddr) {
  const magic = baseAddr.readU32();
  if (magic !== 0x464C457F) { // 0x7F 'E' 'L' 'F' (리틀엔디안)
    console.log('ELF 매직 불일치');
    return null;
  }

  const ei_class = baseAddr.add(4).readU8();   // 1=32bit, 2=64bit
  const ei_data = baseAddr.add(5).readU8();    // 1=LE, 2=BE
  const ei_version = baseAddr.add(6).readU8();
  const ei_osabi = baseAddr.add(7).readU8();
  const e_type = baseAddr.add(16).readU16();
  const e_machine = baseAddr.add(18).readU16();

  const classStr = ei_class === 1 ? 'ELF32' : 'ELF64';
  const endianStr = ei_data === 1 ? 'Little Endian' : 'Big Endian';

  const typeMap = { 0: 'NONE', 1: 'REL', 2: 'EXEC', 3: 'DYN', 4: 'CORE' };
  const machineMap = { 3: 'x86', 40: 'ARM', 62: 'x86_64', 183: 'AArch64' };

  console.log(`클래스: ${classStr}`);
  console.log(`엔디언: ${endianStr}`);
  console.log(`타입: ${typeMap[e_type] || e_type}`);
  console.log(`아키텍처: ${machineMap[e_machine] || e_machine}`);

  return { ei_class, ei_data, e_type, e_machine };
}

// 사용
const libc = Process.getModuleByName('libc.so');
parseElfHeader(libc.base);
```

---

### 6.2 실수 타입

| 메서드 | 크기 | 설명 |
|--------|------|------|
| `readFloat()` / `writeFloat(value)` | 4 bytes | IEEE 754 단정밀도 |
| `readDouble()` / `writeDouble(value)` | 8 bytes | IEEE 754 배정밀도 |

**예제:**

```javascript
const buf = Memory.alloc(16);

// Float (32-bit)
buf.writeFloat(3.14159);
console.log(buf.readFloat());  // 3.1415901184082031 (정밀도 손실)

// Double (64-bit)
buf.add(8).writeDouble(3.141592653589793);
console.log(buf.add(8).readDouble());  // 3.141592653589793 (정밀도 유지)
```

**게임 해킹 — 좌표값 수정:**

```javascript
// 3D 좌표 구조체 수정 (float x, y, z)
function modifyPlayerPosition(positionPtr, x, y, z) {
  positionPtr.writeFloat(x);
  positionPtr.add(4).writeFloat(y);
  positionPtr.add(8).writeFloat(z);

  console.log(`위치 변경: (${x}, ${y}, ${z})`);
}

// 좌표 읽기
function readPlayerPosition(positionPtr) {
  return {
    x: positionPtr.readFloat(),
    y: positionPtr.add(4).readFloat(),
    z: positionPtr.add(8).readFloat()
  };
}

// 게임 메모리에서 체력값 검색 (float)
function searchFloatValue(targetValue, tolerance) {
  tolerance = tolerance || 0.01;
  const results = [];

  Process.enumerateRanges('rw-').forEach(range => {
    // float 단위로 스캔
    for (let offset = 0; offset < range.size - 4; offset += 4) {
      try {
        const value = range.base.add(offset).readFloat();
        if (Math.abs(value - targetValue) < tolerance) {
          results.push({
            address: range.base.add(offset),
            value: value
          });
        }
      } catch (e) {
        break; // 접근 불가 시 다음 범위로
      }
    }
  });

  return results;
}
```

---

### 6.3 포인터 타입

| 메서드 | 크기 | 설명 |
|--------|------|------|
| `readPointer()` / `writePointer(value)` | 4 or 8 bytes | 플랫폼 포인터 크기 |

**예제:**

```javascript
const buf = Memory.alloc(Process.pointerSize * 3);

// 포인터 쓰기/읽기
const targetAddr = Module.getExportByName(null, 'malloc');
buf.writePointer(targetAddr);

console.log(`저장된 포인터: ${buf.readPointer()}`);
console.log(`원본 포인터:   ${targetAddr}`);
console.log(`일치 여부: ${buf.readPointer().equals(targetAddr)}`);
```

**포인터 체인 따라가기:**

```javascript
// 다단계 포인터 역참조 (게임 해킹에서 매우 흔한 패턴)
// base -> [offset1] -> [offset2] -> [offset3] -> 최종 값
function followPointerChain(base, offsets) {
  let current = base;

  for (let i = 0; i < offsets.length; i++) {
    try {
      const next = current.add(offsets[i]).readPointer();
      console.log(`  [${i}] ${current} + 0x${offsets[i].toString(16)} → ${next}`);
      current = next;

      if (current.isNull()) {
        console.log('  NULL 포인터 도달');
        return null;
      }
    } catch (e) {
      console.log(`  [${i}] 읽기 실패: ${e}`);
      return null;
    }
  }

  return current;
}

// 사용 예제
// GameManager -> Player -> Health
const gameManager = ptr('0x12345678'); // 예시 주소
const healthAddr = followPointerChain(gameManager, [0x10, 0x48, 0x1C0]);
if (healthAddr) {
  console.log(`체력 주소: ${healthAddr}`);
  console.log(`현재 체력: ${healthAddr.readFloat()}`);
}
```

**가상 함수 테이블(vtable) 읽기:**

```javascript
function dumpVtable(objectPtr, count) {
  // C++ 객체의 첫 번째 필드는 보통 vtable 포인터
  const vtablePtr = objectPtr.readPointer();
  console.log(`vtable 주소: ${vtablePtr}`);

  for (let i = 0; i < count; i++) {
    const funcPtr = vtablePtr.add(i * Process.pointerSize).readPointer();
    const moduleInfo = Process.findModuleByAddress(funcPtr);
    const offset = moduleInfo ? `${moduleInfo.name}+0x${funcPtr.sub(moduleInfo.base).toString(16)}` : '???';
    console.log(`  vtable[${i}]: ${funcPtr} (${offset})`);
  }
}
```

---

### 6.4 바이트 배열

| 메서드 | 설명 |
|--------|------|
| `readByteArray(length)` | `length` 바이트를 `ArrayBuffer`로 읽기 |
| `writeByteArray(bytes)` | `ArrayBuffer` 또는 `number[]`를 메모리에 쓰기 |

**예제:**

```javascript
const buf = Memory.alloc(16);

// number[] 로 쓰기
buf.writeByteArray([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"

// ArrayBuffer로 읽기
const data = buf.readByteArray(5);
console.log(hexdump(data, { ansi: true }));

// ArrayBuffer로 쓰기
const ab = new ArrayBuffer(4);
const view = new Uint8Array(ab);
view[0] = 0xDE;
view[1] = 0xAD;
view[2] = 0xBE;
view[3] = 0xEF;
buf.writeByteArray(ab);
console.log(buf.readU32().toString(16)); // efbeadde (리틀엔디안)
```

**바이너리 데이터 전송 (send + readByteArray):**

```javascript
// 메모리 덤프를 호스트로 전송
function dumpMemory(address, size) {
  const data = address.readByteArray(size);

  // send()의 두 번째 인수로 ArrayBuffer 전달 → 바이너리 전송
  send({
    type: 'memory-dump',
    address: address.toString(),
    size: size
  }, data);
}

// 모듈 전체 덤프
function dumpModule(moduleName) {
  const module = Process.getModuleByName(moduleName);
  console.log(`${moduleName} 덤프 중: ${module.base} (${module.size} bytes)`);

  // 큰 모듈은 청크 단위로 전송
  const CHUNK_SIZE = 1024 * 1024; // 1MB

  for (let offset = 0; offset < module.size; offset += CHUNK_SIZE) {
    const chunkSize = Math.min(CHUNK_SIZE, module.size - offset);
    try {
      const chunk = module.base.add(offset).readByteArray(chunkSize);
      send({
        type: 'module-dump',
        module: moduleName,
        offset: offset,
        size: chunkSize,
        total: module.size
      }, chunk);
    } catch (e) {
      console.log(`  오프셋 0x${offset.toString(16)}에서 읽기 실패: ${e}`);
    }
  }
}
```

**암호화 키 추출:**

```javascript
// AES 키가 있을 법한 메모리 영역에서 키 추출
Interceptor.attach(Module.getExportByName(null, 'EVP_EncryptInit_ex'), {
  onEnter(args) {
    const ctx = args[0];
    const cipher = args[1];
    const key = args[3];
    const iv = args[4];

    if (!key.isNull()) {
      const keyData = key.readByteArray(32); // AES-256 키
      send({ type: 'aes-key', direction: 'encrypt' }, keyData);
      console.log('[AES] 암호화 키 추출');
      console.log(hexdump(key, { length: 32 }));
    }

    if (!iv.isNull()) {
      const ivData = iv.readByteArray(16);
      send({ type: 'aes-iv', direction: 'encrypt' }, ivData);
    }
  }
});
```

---

### 6.5 Volatile 읽기/쓰기

컴파일러 최적화나 CPU 캐시를 우회하여 메모리를 직접 읽고 쓴다. 하드웨어 레지스터(MMIO)나 다른 스레드가 수정할 수 있는 공유 메모리에 접근할 때 사용한다.

| 메서드 | 설명 |
|--------|------|
| `readVolatile(size)` | 캐시를 우회하여 `size` 바이트를 `ArrayBuffer`로 읽기 |
| `writeVolatile(bytes)` | 캐시를 우회하여 `ArrayBuffer`를 메모리에 쓰기 |

**예제:**

```javascript
// MMIO 레지스터 읽기 (임베디드 환경)
const mmioBase = ptr('0xFF000000'); // 하드웨어 레지스터 기본 주소

// 일반 read는 캐시된 값을 반환할 수 있음
// volatile은 항상 실제 메모리에서 읽음
const statusReg = mmioBase.add(0x04).readVolatile(4);
const view = new Uint32Array(statusReg);
console.log(`상태 레지스터: 0x${view[0].toString(16)}`);
```

**스핀락 모니터링:**

```javascript
// 다른 스레드가 수정하는 플래그를 감시
function waitForFlag(flagAddr, expectedValue, timeoutMs) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const buf = flagAddr.readVolatile(4);
    const value = new Uint32Array(buf)[0];
    if (value === expectedValue) {
      return true;
    }
  }
  return false; // 타임아웃
}
```

---

### 6.6 문자열 읽기/쓰기

| 메서드 | 설명 |
|--------|------|
| `readUtf8String([maxLength])` | UTF-8 null-terminated 문자열 읽기 |
| `readUtf16String([maxLength])` | UTF-16 null-terminated 문자열 읽기 |
| `readAnsiString([maxLength])` | ANSI null-terminated 문자열 읽기 (Windows) |
| `readCString([maxLength])` | null-terminated C 문자열 읽기 |
| `writeUtf8String(str)` | UTF-8 문자열을 해당 주소에 쓰기 |
| `writeUtf16String(str)` | UTF-16 문자열을 해당 주소에 쓰기 |
| `writeAnsiString(str)` | ANSI 문자열을 해당 주소에 쓰기 (Windows) |

> **`readCString` vs `readUtf8String`:** `readCString`은 Frida 16+에서 추가된 메서드로, `readUtf8String`과 동일하게 null-terminated 문자열을 읽지만, 잘못된 UTF-8 시퀀스를 만났을 때 예외를 던지지 않고 교체 문자로 대체한다.

**maxLength 파라미터:**

`maxLength`를 지정하면 null 종단 문자를 만나지 않더라도 해당 길이에서 읽기를 중단한다. 버퍼 오버리드를 방지할 때 유용하다.

```javascript
// maxLength 없이 읽기 — null 바이트가 없으면 위험!
const str1 = ptr(0x12345678).readUtf8String();

// maxLength로 안전하게 읽기
const str2 = ptr(0x12345678).readUtf8String(256); // 최대 256바이트
```

**종합 예제 — 문자열 로깅:**

```javascript
// 모든 문자열 관련 함수 후킹
function traceStrings() {
  // strlen
  Interceptor.attach(Module.getExportByName(null, 'strlen'), {
    onEnter(args) {
      try {
        this.str = args[0].readUtf8String(512);
      } catch (e) {
        this.str = '<읽기 실패>';
      }
    },
    onLeave(retval) {
      if (this.str && this.str.length > 0) {
        console.log(`[strlen] "${this.str}" → ${retval}`);
      }
    }
  });

  // strcmp
  Interceptor.attach(Module.getExportByName(null, 'strcmp'), {
    onEnter(args) {
      try {
        this.s1 = args[0].readUtf8String(256);
        this.s2 = args[1].readUtf8String(256);
      } catch (e) {
        this.s1 = this.s2 = '<읽기 실패>';
      }
    },
    onLeave(retval) {
      const result = retval.toInt32();
      const match = result === 0 ? 'MATCH' : 'DIFFER';
      console.log(`[strcmp] "${this.s1}" vs "${this.s2}" → ${match} (${result})`);
    }
  });

  // strstr
  Interceptor.attach(Module.getExportByName(null, 'strstr'), {
    onEnter(args) {
      try {
        this.haystack = args[0].readUtf8String(512);
        this.needle = args[1].readUtf8String(128);
      } catch (e) {
        return;
      }
    },
    onLeave(retval) {
      if (this.needle) {
        const found = !retval.isNull();
        console.log(`[strstr] "${this.needle}" in "${this.haystack}" → ${found}`);
      }
    }
  });
}
```

**writeUtf8String — 문자열 인플레이스 수정:**

```javascript
// 기존 버퍼에 문자열 덮어쓰기 (버퍼 크기 초과 주의!)
Interceptor.attach(Module.getExportByName(null, 'process_command'), {
  onEnter(args) {
    const cmd = args[0].readUtf8String();
    console.log(`[원본 명령] ${cmd}`);

    if (cmd === 'SHUTDOWN') {
      // 기존 버퍼에 직접 쓰기 (원본 문자열보다 짧은 경우만 안전)
      args[0].writeUtf8String('NOP');
      console.log('[수정됨] SHUTDOWN → NOP');
    }
  }
});
```

---

### 6.7 패턴 변환

| 메서드 | 설명 |
|--------|------|
| `toMatchPattern()` | 해당 주소의 메모리 내용을 `Memory.scan()` 패턴 문자열로 변환 |

> **주의:** `toMatchPattern()`은 `Process.pointerSize` 바이트를 읽어 패턴으로 변환한다 (4 또는 8바이트).

**예제:**

```javascript
const buf = Memory.alloc(8);
buf.writeU64(uint64('0x4142434445464748'));

// 메모리 내용을 스캔 패턴으로 변환
const pattern = buf.toMatchPattern();
console.log(`패턴: ${pattern}`);
// 출력 예: "48 47 46 45 44 43 42 41" (리틀엔디안)
```

**함수 시그니처 기반 검색:**

```javascript
// 알려진 함수의 처음 몇 바이트를 패턴으로 변환하여 다른 바이너리에서 검색
function createSignature(funcAddr, length) {
  const bytes = funcAddr.readByteArray(length);
  const view = new Uint8Array(bytes);

  // 변위(displacement)나 절대 주소가 포함될 수 있는 바이트를 와일드카드로 교체
  const pattern = Array.from(view)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');

  return pattern;
}

const sig = createSignature(Module.getExportByName(null, 'target_func'), 16);
console.log(`시그니처: ${sig}`);
```

---

## 7. MemoryAccessMonitor

`MemoryAccessMonitor`는 특정 메모리 범위에 대한 접근(읽기/쓰기/실행)을 감시한다. 하드웨어 페이지 보호 메커니즘을 사용하므로 페이지 단위(보통 4KB)로 동작한다.

> **중요:** 한 번 접근이 감지되면 해당 페이지의 감시가 해제된다. 지속적인 감시가 필요하면 `onAccess` 콜백에서 감시를 다시 활성화해야 한다.

### 7.1 enable(ranges, callbacks)

**시그니처:**

```typescript
MemoryAccessMonitor.enable(
  ranges: { base: NativePointer; size: number } | Array<{ base: NativePointer; size: number }>,
  callbacks: {
    onAccess: (details: MemoryAccessDetails) => void;
  }
): void
```

**MemoryAccessDetails 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `operation` | `string` | `'read'`, `'write'`, `'execute'` |
| `from` | `NativePointer` | 접근을 수행한 명령어 주소 |
| `address` | `NativePointer` | 접근 대상 메모리 주소 |
| `rangeIndex` | `number` | `ranges` 배열에서의 인덱스 |
| `pageIndex` | `number` | 해당 범위 내 페이지 인덱스 |
| `pagesCompleted` | `number` | 감시 해제된 총 페이지 수 |
| `pagesTotal` | `number` | 감시 중인 총 페이지 수 |
| `threadId` | `number` | 접근을 수행한 스레드 ID |
| `context` | `CpuContext` | CPU 레지스터 (수정 가능) |

**기본 예제 — 데이터 접근 감시:**

```javascript
const secretData = Memory.alloc(Process.pageSize);
secretData.writeUtf8String('TOP SECRET DATA');

MemoryAccessMonitor.enable(
  { base: secretData, size: Process.pageSize },
  {
    onAccess(details) {
      console.log(`[접근 감지]`);
      console.log(`  유형: ${details.operation}`);
      console.log(`  주소: ${details.address}`);
      console.log(`  접근 코드: ${details.from}`);
      console.log(`  스레드: ${details.threadId}`);

      // 접근한 코드가 어느 모듈에 속하는지 확인
      const module = Process.findModuleByAddress(details.from);
      if (module) {
        const offset = details.from.sub(module.base);
        console.log(`  모듈: ${module.name}+0x${offset.toString(16)}`);
      }

      // 진행 상황
      console.log(`  페이지: ${details.pagesCompleted}/${details.pagesTotal}`);
    }
  }
);

console.log('메모리 감시 활성화');
```

**여러 영역 동시 감시:**

```javascript
const globalVars = [
  { name: 'score', ptr: Module.getExportByName(null, 'g_score') },
  { name: 'health', ptr: Module.getExportByName(null, 'g_health') },
  { name: 'ammo', ptr: Module.getExportByName(null, 'g_ammo') },
];

const ranges = globalVars.map(v => ({
  base: v.ptr.and(ptr(Process.pageSize - 1).not()), // 페이지 정렬
  size: Process.pageSize
}));

MemoryAccessMonitor.enable(ranges, {
  onAccess(details) {
    const varInfo = globalVars[details.rangeIndex];
    console.log(`[${varInfo.name}] ${details.operation} from ${details.from}`);

    if (details.operation === 'write') {
      // 쓰기 접근의 경우 레지스터 덤프
      const ctx = details.context;
      if (Process.arch === 'arm64') {
        console.log(`  X0=${ctx.x0} X1=${ctx.x1} X2=${ctx.x2}`);
      } else if (Process.arch === 'x64') {
        console.log(`  RAX=${ctx.rax} RBX=${ctx.rbx} RCX=${ctx.rcx}`);
      }
    }
  }
});
```

---

### 7.2 disable()

모든 메모리 접근 감시를 해제한다.

**시그니처:**

```typescript
MemoryAccessMonitor.disable(): void
```

**예제:**

```javascript
// 5초 후 감시 해제
setTimeout(() => {
  MemoryAccessMonitor.disable();
  console.log('메모리 감시 해제');
}, 5000);
```

---

### 7.3 활용 예제

**메모리 브레이크포인트 구현:**

```javascript
// 특정 주소에 대한 쓰기를 감지하고 호출 스택 출력
function setWriteBreakpoint(address, size) {
  const pageSize = Process.pageSize;
  const alignedBase = address.and(ptr(pageSize - 1).not());
  const alignedSize = pageSize; // 최소 단위

  function startMonitor() {
    MemoryAccessMonitor.enable(
      { base: alignedBase, size: alignedSize },
      {
        onAccess(details) {
          if (details.operation === 'write') {
            console.log(`\n=== 쓰기 브레이크포인트 ===`);
            console.log(`대상 주소: ${details.address}`);
            console.log(`접근 코드: ${details.from}`);

            // 백트레이스
            const bt = Thread.backtrace(details.context, Backtracer.ACCURATE);
            console.log('콜스택:');
            bt.forEach((frame, i) => {
              const sym = DebugSymbol.fromAddress(frame);
              console.log(`  [${i}] ${sym}`);
            });
          }

          // 감시 재활성화 (지속적 모니터링)
          setTimeout(() => startMonitor(), 0);
        }
      }
    );
  }

  startMonitor();
  console.log(`쓰기 브레이크포인트 설정: ${address} (${size} bytes)`);

  return {
    remove() {
      MemoryAccessMonitor.disable();
      console.log('브레이크포인트 해제');
    }
  };
}

// 사용
// const bp = setWriteBreakpoint(ptr('0x12345678'), 4);
// bp.remove(); // 해제
```

**안티 치트 — 메모리 변조 감지:**

```javascript
function protectMemoryRegion(address, size, label) {
  const pageSize = Process.pageSize;
  const alignedBase = address.and(ptr(pageSize - 1).not());
  const pages = Math.ceil(size / pageSize);
  const totalSize = pages * pageSize;

  let accessLog = [];

  function enableProtection() {
    MemoryAccessMonitor.enable(
      { base: alignedBase, size: totalSize },
      {
        onAccess(details) {
          const entry = {
            timestamp: Date.now(),
            operation: details.operation,
            from: details.from.toString(),
            address: details.address.toString(),
            threadId: details.threadId
          };
          accessLog.push(entry);

          const module = Process.findModuleByAddress(details.from);
          const source = module
            ? `${module.name}+0x${details.from.sub(module.base).toString(16)}`
            : details.from.toString();

          console.log(`[보호] ${label}: ${details.operation} from ${source}`);

          if (details.operation === 'write') {
            console.log(`  경고: 보호된 영역에 쓰기 시도!`);
            // 필요시 원래 값으로 복원
          }

          // 재감시
          setTimeout(() => enableProtection(), 0);
        }
      }
    );
  }

  enableProtection();

  return {
    getLog: () => [...accessLog],
    clearLog: () => { accessLog = []; },
    disable: () => MemoryAccessMonitor.disable()
  };
}
```

**코드 실행 추적:**

```javascript
// 특정 메모리 영역의 코드가 실행되는지 감시
function traceCodeExecution(codeBase, codeSize) {
  const executedPages = new Set();

  MemoryAccessMonitor.enable(
    { base: codeBase, size: codeSize },
    {
      onAccess(details) {
        if (details.operation === 'execute') {
          const pageAddr = details.address.and(ptr(Process.pageSize - 1).not());
          const pageKey = pageAddr.toString();

          if (!executedPages.has(pageKey)) {
            executedPages.add(pageKey);
            const module = Process.findModuleByAddress(details.address);
            const offset = module ? details.address.sub(module.base) : '?';
            console.log(`[코드 실행] 페이지 ${pageAddr} (오프셋 0x${offset.toString(16)})`);
          }

          console.log(`  진행: ${details.pagesCompleted}/${details.pagesTotal} 페이지`);
        }
      }
    }
  );

  return {
    getExecutedPages: () => [...executedPages],
    stop: () => MemoryAccessMonitor.disable()
  };
}
```

---

## 8. ArrayBuffer 유틸리티

### 8.1 ArrayBuffer.wrap(address, size)

기존 메모리 영역을 복사 없이 `ArrayBuffer`로 래핑한다. 대용량 메모리를 JavaScript에서 효율적으로 접근할 때 유용하다.

**시그니처:**

```typescript
ArrayBuffer.wrap(address: NativePointer, size: number): ArrayBuffer
```

> **주의:** 래핑된 `ArrayBuffer`는 원본 메모리를 직접 참조한다. 원본 메모리가 해제되면 래핑된 버퍼에 접근하는 것은 정의되지 않은 동작이다.

**예제:**

```javascript
// 대용량 데이터 구조를 복사 없이 접근
const dataPtr = Module.getExportByName(null, 'large_buffer');
const dataSize = 1024 * 1024; // 1MB

// 복사 없이 ArrayBuffer로 래핑
const ab = ArrayBuffer.wrap(dataPtr, dataSize);

// TypedArray 뷰로 고속 접근
const u32View = new Uint32Array(ab);
console.log(`첫 번째 uint32: 0x${u32View[0].toString(16)}`);
console.log(`요소 수: ${u32View.length}`);

// Float32Array로도 접근 가능
const f32View = new Float32Array(ab);
console.log(`첫 번째 float: ${f32View[0]}`);
```

**구조체 배열 파싱:**

```javascript
// C 구조체 배열을 TypedArray로 효율적으로 파싱
// struct Entry { uint32_t id; float value; uint32_t flags; uint32_t reserved; };
const ENTRY_SIZE = 16; // 16 bytes per entry

function parseEntries(basePtr, count) {
  const ab = ArrayBuffer.wrap(basePtr, count * ENTRY_SIZE);
  const view = new DataView(ab);

  const entries = [];
  for (let i = 0; i < count; i++) {
    const offset = i * ENTRY_SIZE;
    entries.push({
      id: view.getUint32(offset, true),       // little-endian
      value: view.getFloat32(offset + 4, true),
      flags: view.getUint32(offset + 8, true)
    });
  }

  return entries;
}

// 사용
// const entries = parseEntries(ptr('0x12345678'), 100);
// entries.forEach(e => console.log(`ID: ${e.id}, Value: ${e.value}, Flags: 0x${e.flags.toString(16)}`));
```

**이미지 데이터 접근:**

```javascript
// 프레임버퍼나 텍스처 메모리 접근
function captureFramebuffer(fbAddr, width, height, bytesPerPixel) {
  const size = width * height * bytesPerPixel;
  const ab = ArrayBuffer.wrap(fbAddr, size);

  // RGBA 픽셀 데이터로 해석
  const pixels = new Uint8Array(ab);

  // 특정 픽셀 읽기
  function getPixel(x, y) {
    const idx = (y * width + x) * bytesPerPixel;
    return {
      r: pixels[idx],
      g: pixels[idx + 1],
      b: pixels[idx + 2],
      a: bytesPerPixel === 4 ? pixels[idx + 3] : 255
    };
  }

  // 호스트로 전송
  send({ type: 'framebuffer', width, height, bpp: bytesPerPixel }, ab);

  return { pixels, getPixel };
}
```

---

### 8.2 ArrayBuffer.unwrap(buffer)

`ArrayBuffer`의 기반(backing store) 메모리 주소를 `NativePointer`로 반환한다. `ArrayBuffer.wrap()`으로 생성된 버퍼의 원래 주소를 복구하거나, JavaScript에서 생성한 `ArrayBuffer`의 실제 메모리 위치를 알아낼 때 사용한다.

**시그니처:**

```typescript
ArrayBuffer.unwrap(buffer: ArrayBuffer): NativePointer
```

**예제:**

```javascript
// wrap한 버퍼에서 원래 주소 복구
const originalAddr = Memory.alloc(256);
originalAddr.writeUtf8String('Test Data');

const ab = ArrayBuffer.wrap(originalAddr, 256);
const recoveredAddr = ArrayBuffer.unwrap(ab);

console.log(`원본 주소: ${originalAddr}`);
console.log(`복구 주소: ${recoveredAddr}`);
console.log(`일치 여부: ${originalAddr.equals(recoveredAddr)}`); // true
```

**JavaScript 배열을 네이티브 함수에 전달:**

```javascript
// JavaScript에서 생성한 데이터를 네이티브 함수에 전달
const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
const dataPtr = ArrayBuffer.unwrap(data.buffer);

// 네이티브 함수 호출 시 포인터로 전달
const processData = new NativeFunction(
  Module.getExportByName(null, 'process_data'),
  'int',
  ['pointer', 'int']
);

const result = processData(dataPtr, data.length);
console.log(`처리 결과: ${result}`);
```

**CModule과의 데이터 공유:**

```javascript
// JavaScript에서 생성한 ArrayBuffer를 CModule에서 직접 접근
const sharedBuffer = new ArrayBuffer(1024);
const sharedView = new Uint32Array(sharedBuffer);

// 초기값 설정
sharedView[0] = 42;
sharedView[1] = 100;

const sharedPtr = ArrayBuffer.unwrap(sharedBuffer);

const cm = new CModule(`
#include <glib.h>

extern uint32_t *shared_data;

void increment_counter(void) {
    shared_data[0]++;
}

uint32_t get_counter(void) {
    return shared_data[0];
}
`, {
  shared_data: sharedPtr
});

const increment = new NativeFunction(cm.increment_counter, 'void', []);
const getCounter = new NativeFunction(cm.get_counter, 'uint32', []);

increment();
increment();
console.log(`카운터: ${getCounter()}`);       // 44
console.log(`JS에서도: ${sharedView[0]}`);     // 44 (같은 메모리)
```

---

## 9. 주의사항 및 베스트 프랙티스

### GC(가비지 컬렉션) 관리

Frida에서 가장 흔한 버그 원인은 GC로 인한 메모리 해제다. `Memory.alloc()`, `Memory.allocUtf8String()` 등으로 할당한 메모리는 반환된 `NativePointer`가 JavaScript에서 참조되지 않으면 해제된다.

```javascript
// 패턴 1: 전역 변수로 유지
const globalBuf = Memory.alloc(256); // 스크립트 수명 동안 유지

// 패턴 2: Map/Set/Array로 유지
const allocations = new Map();
allocations.set('config', Memory.alloc(1024));
allocations.set('buffer', Memory.alloc(4096));

// 패턴 3: Interceptor 콜백에서 this 사용
Interceptor.attach(funcPtr, {
  onEnter(args) {
    this.myBuffer = Memory.alloc(256); // onLeave까지 유지
    // 나쁜 예: const buf = Memory.alloc(256); // GC 대상!
  },
  onLeave(retval) {
    // this.myBuffer는 여전히 유효
  }
});

// 패턴 4: 클로저로 유지
(function() {
  const persistentBuf = Memory.alloc(256);
  Interceptor.attach(funcPtr, {
    onEnter(args) {
      args[0] = persistentBuf; // 클로저가 참조를 유지
    }
  });
})();
```

### 성능 최적화

```javascript
// 나쁜 예: 같은 인수를 여러 번 읽음
Interceptor.attach(funcPtr, {
  onEnter(args) {
    console.log(args[0].readUtf8String()); // 1차 읽기
    if (args[0].readUtf8String().includes('test')) { // 2차 읽기 (불필요)
      send({ path: args[0].readUtf8String() }); // 3차 읽기 (불필요)
    }
  }
});

// 좋은 예: 로컬 변수에 캐시
Interceptor.attach(funcPtr, {
  onEnter(args) {
    const str = args[0].readUtf8String(); // 1번만 읽기
    console.log(str);
    if (str.includes('test')) {
      send({ path: str });
    }
  }
});
```

### Memory.patchCode vs 직접 쓰기

```javascript
// 코드 영역 수정 시: Memory.patchCode 사용 (안전)
Memory.patchCode(codeAddr, 8, code => {
  const writer = new Arm64Writer(code, { pc: codeAddr });
  writer.putRet();
  writer.flush();
});

// 데이터 영역 수정 시: 직접 쓰기 (단순)
Memory.protect(dataAddr, 4, 'rw-');
dataAddr.writeU32(newValue);

// patchCode는 데이터 영역에 사용하지 않는다 — Writer가 불필요하고 오버헤드만 발생
```

### readByteArray + send 바이너리 전송

```javascript
// 대용량 바이너리 데이터를 효율적으로 전송
Interceptor.attach(Module.getExportByName(null, 'SSL_write'), {
  onEnter(args) {
    const buf = args[1];
    const len = args[2].toInt32();

    if (len > 0 && len < 1024 * 1024) { // 1MB 제한
      const data = buf.readByteArray(len);
      // send의 두 번째 인수로 ArrayBuffer 전달 → 바이너리로 전송
      // JSON 직렬화 없이 효율적으로 전달됨
      send({ type: 'ssl_write', length: len }, data);
    }
  }
});
```

### 스캔 시 안전한 메모리 접근

```javascript
// 모든 메모리 범위를 스캔할 때 오류 처리
function safeRead(address, readFn) {
  try {
    return readFn(address);
  } catch (e) {
    return null; // 접근 불가 메모리
  }
}

// 범위 검증 후 스캔
function safeScan(pattern) {
  const ranges = Process.enumerateRanges('r--');

  return ranges.flatMap(range => {
    try {
      return Memory.scanSync(range.base, range.size, pattern);
    } catch (e) {
      console.warn(`범위 ${range.base} 스캔 실패: ${e.message}`);
      return [];
    }
  });
}
```

### 대용량 처리 시 CModule/RustModule 활용

JavaScript의 메모리 접근은 네이티브 코드보다 훨씬 느리다. 대용량 데이터 처리, 복잡한 패턴 매칭, 반복적인 메모리 조작이 필요한 경우 CModule 또는 RustModule로 구현하면 성능이 크게 향상된다.

```javascript
// JavaScript로 1MB 스캔: ~수백 ms
// CModule로 동일 작업: ~수 ms

const cm = new CModule(`
#include <glib.h>
#include <string.h>

// 고속 바이트 패턴 검색 (Boyer-Moore 변형)
int fast_search(
    const uint8_t *haystack, int haystack_len,
    const uint8_t *needle, int needle_len,
    void **results, int max_results
) {
    int count = 0;
    // 단순 구현 (실제로는 Boyer-Moore 등 사용)
    for (int i = 0; i <= haystack_len - needle_len && count < max_results; i++) {
        if (memcmp(haystack + i, needle, needle_len) == 0) {
            results[count++] = (void *)(haystack + i);
        }
    }
    return count;
}
`);

// NativeFunction으로 래핑하여 사용
const fastSearch = new NativeFunction(cm.fast_search, 'int', [
  'pointer', 'int', 'pointer', 'int', 'pointer', 'int'
]);
```

### 스레드 안전성

```javascript
// 멀티스레드 환경에서 메모리 수정 시 주의사항

// 1. 코드 패치: Memory.patchCode는 원자적이지 않음
//    → 가능하면 Interceptor.replace() 사용

// 2. 데이터 수정: 크기가 포인터 이하인 경우 원자적일 수 있음
//    → 하지만 보장되지 않으므로 주의

// 3. 가장 안전한 패턴: 대상 함수를 Interceptor로 교체
Interceptor.replace(targetFunc, new NativeCallback(function() {
  // 완전히 새로운 구현
  return 1;
}, 'int', []));
```

---

> **참고:** 이 문서는 Frida 16.x 기준으로 작성되었다. API 변경사항은 [Frida 공식 문서](https://frida.re/docs/)를 참조한다.
