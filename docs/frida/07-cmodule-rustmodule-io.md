# CModule, RustModule & I/O API

> 고성능 네이티브 코드 모듈과 파일/네트워크/데이터베이스 I/O

---

## 1. CModule

### 1.1 개요

C 소스코드를 런타임에 컴파일하여 대상 프로세스 메모리에 매핑한다.
Interceptor, Stalker의 **고성능 콜백** 구현에 핵심적으로 활용된다.

### 1.2 생성자

```javascript
new CModule(code[, symbols, options])
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `code` | `string` 또는 `ArrayBuffer` | C 소스코드 또는 사전 컴파일된 바이너리 |
| `symbols` | `Record<string, NativePointer>` | JS에서 C로 전달할 심볼 맵 |
| `options` | `{ toolchain: string }` | 컴파일러 선택 |

**toolchain 옵션:**

| 값 | 설명 | 장점 | 단점 |
|----|------|------|------|
| `'internal'` | TinyCC (정적 링크) | 샌드박스 환경 동작 | 비최적화 코드 |
| `'external'` | 시스템 툴체인 (clang/gcc) | 최적화된 코드 | 설치 필요 |
| `'any'` (기본) | internal 우선, 실패 시 external | 최대 호환성 | - |

### 1.3 기본 사용

```javascript
const cm = new CModule(`
#include <stdio.h>

void hello(void) {
    printf("Hello from CModule!\\n");
}
`);

// 퍼블릭 함수는 NativePointer 프로퍼티로 자동 노출
const hello = new NativeFunction(cm.hello, 'void', []);
hello();
```

### 1.4 JS와 C 양방향 통신

```javascript
const buffer = Memory.alloc(4096);
const onResult = new NativeCallback((addr, size) => {
    console.log('Result:', addr.readByteArray(size));
}, 'void', ['pointer', 'uint32']);

const cm = new CModule(`
#include <string.h>

extern void on_result(void *addr, unsigned int size);
extern char *buffer;

void process(const char *input, int len) {
    memcpy(buffer, input, len);
    on_result(buffer, len);
}
`, {
    on_result: onResult,
    buffer: buffer,
});

const process = new NativeFunction(cm.process, 'void', ['pointer', 'int']);
```

### 1.5 Interceptor C 콜백

JS 콜백 대비 약 10배 성능 향상.

```javascript
const cm = new CModule(`
#include <gum/guminterceptor.h>

extern void notify(int fd, int result);

void on_enter(GumInvocationContext *ic) {
    int *data = (int *)gum_invocation_context_get_listener_invocation_data(ic, sizeof(int));
    *data = (int)(size_t)gum_invocation_context_get_nth_argument(ic, 0);
}

void on_leave(GumInvocationContext *ic) {
    int *data = (int *)gum_invocation_context_get_listener_invocation_data(ic, sizeof(int));
    int result = (int)(size_t)gum_invocation_context_get_return_value(ic);
    if (result > 0) {
        notify(*data, result);
    }
}
`, {
    notify: new NativeCallback((fd, result) => {
        send({ type: 'read', fd, bytes: result });
    }, 'void', ['int', 'int']),
});

Interceptor.attach(readPtr, {
    onEnter: cm.on_enter,
    onLeave: cm.on_leave,
});
```

### 1.6 라이프사이클 함수

```c
// 선택적 정의 - 자동 호출됨
void init(void) {
    // 모듈 생성 시
}

void finalize(void) {
    // 모듈 해제 시 (dispose 또는 GC)
}
```

### 1.7 dispose 메서드

```javascript
cm.dispose(); // 즉시 메모리 해제 (GC 대기 불필요)
```

### 1.8 builtins 프로퍼티

```javascript
CModule.builtins
// { defines, headers: { gum, glib, 'json-glib', capstone } }
```

빌드 환경 정보. frida-create 같은 스캐폴딩 도구에서 활용.

### 1.9 REPL 사용

```bash
frida -p 0 -C example.c    # -C 플래그로 CModule 로드
# 전역 변수 cm으로 접근 가능
```

### 1.10 주의사항

| 항목 | 설명 |
|------|------|
| 전역 변수 | 읽기 전용. 쓰기 가능 전역은 extern 선언 후 Memory.alloc으로 전달 |
| 디버깅 | console 출력 불가. send용 NativeCallback으로 우회 |
| 문자열 | C 문자열은 수동 관리. 버퍼 오버플로 주의 |
| 스레드 안전 | 공유 상태 접근 시 atomic 또는 뮤텍스 필요 |

---

## 2. RustModule

### 2.1 개요

Rust 소스코드를 런타임에 컴파일하여 프로세스 메모리에 매핑.
CModule과 유사하나 Rust의 안전성과 Cargo 생태계를 활용할 수 있다.

### 2.2 생성자

```javascript
new RustModule(code[, symbols, options])
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `code` | `string` | Rust 소스코드 |
| `symbols` | `Record<string, NativePointer>` | JS에서 Rust extern "C" 심볼로 전달 |
| `options` | `{ dependencies: string[] }` | Cargo 의존성 |

### 2.3 기본 사용

```javascript
const rm = new RustModule(`
    #[no_mangle]
    pub extern "C" fn add(a: i32, b: i32) -> i32 {
        a + b
    }

    #[no_mangle]
    pub extern "C" fn fibonacci(n: u32) -> u64 {
        match n {
            0 => 0,
            1 => 1,
            _ => {
                let (mut a, mut b) = (0u64, 1u64);
                for _ in 2..=n {
                    let temp = a + b;
                    a = b;
                    b = temp;
                }
                b
            }
        }
    }
`);

const add = new NativeFunction(rm.add, 'int', ['int', 'int']);
const fib = new NativeFunction(rm.fibonacci, 'uint64', ['uint32']);

console.log(add(3, 4));    // 7
console.log(fib(50));       // 12586269025
```

### 2.4 JS와 Rust 통신

```javascript
const notifyMatch = new NativeCallback((address, size) => {
    send({
        type: 'scan:match',
        address: '0x' + address.toString(16),
        size,
    });
}, 'void', ['uint64', 'uint32']);

const rm = new RustModule(`
    extern "C" {
        fn notify_match(address: u64, size: u32);
    }

    #[no_mangle]
    pub extern "C" fn fast_scan(
        base: *const u8,
        haystack_len: usize,
        needle: *const u8,
        needle_len: usize,
    ) -> i32 {
        if needle_len == 0 || haystack_len < needle_len {
            return 0;
        }
        let haystack = unsafe {
            std::slice::from_raw_parts(base, haystack_len)
        };
        let pattern = unsafe {
            std::slice::from_raw_parts(needle, needle_len)
        };
        let mut count = 0i32;
        for i in 0..=(haystack.len() - pattern.len()) {
            if &haystack[i..i + pattern.len()] == pattern {
                unsafe { notify_match(base as u64 + i as u64, pattern.len() as u32); }
                count += 1;
            }
        }
        count
    }
`, { notify_match: notifyMatch });

const fastScan = new NativeFunction(
    rm.fast_scan, 'int',
    ['pointer', 'size_t', 'pointer', 'size_t']
);
```

### 2.5 Cargo 의존성 사용

```javascript
const rm = new RustModule(`
    use base64::{Engine, engine::general_purpose::STANDARD};

    #[no_mangle]
    pub extern "C" fn encode_base64(
        input: *const u8, input_len: usize,
        output: *mut u8, output_cap: usize,
    ) -> usize {
        let data = unsafe { std::slice::from_raw_parts(input, input_len) };
        let encoded = STANDARD.encode(data);
        let bytes = encoded.as_bytes();
        let len = bytes.len().min(output_cap);
        unsafe { std::ptr::copy_nonoverlapping(bytes.as_ptr(), output, len); }
        len
    }
`, {}, {
    dependencies: ['base64 = "0.22.1"']
});
```

### 2.6 Interceptor 핫 콜백

```javascript
const rm = new RustModule(`
    use std::sync::atomic::{AtomicU64, Ordering};

    static CALL_COUNT: AtomicU64 = AtomicU64::new(0);

    extern "C" {
        fn notify_threshold(count: u64);
    }

    #[no_mangle]
    pub extern "C" fn on_enter(_ic: *mut std::ffi::c_void) {
        let count = CALL_COUNT.fetch_add(1, Ordering::Relaxed) + 1;
        if count % 1000 == 0 {
            unsafe { notify_threshold(count); }
        }
    }

    #[no_mangle]
    pub extern "C" fn get_count() -> u64 {
        CALL_COUNT.load(Ordering::Relaxed)
    }
`, {
    notify_threshold: new NativeCallback((count) => {
        send({ type: 'threshold', count: count.toNumber() });
    }, 'void', ['uint64']),
});

Interceptor.attach(mallocPtr, { onEnter: rm.on_enter });
```

### 2.7 퍼징 엔진

```javascript
const rm = new RustModule(`
    extern "C" {
        fn target_func(input: *const u8, len: usize) -> i32;
        fn on_crash(input: *const u8, len: usize, result: i32);
    }

    #[no_mangle]
    pub extern "C" fn fuzz_loop(
        seed: *const u8, seed_len: usize, iterations: u32,
    ) -> u32 {
        let base = unsafe { std::slice::from_raw_parts(seed, seed_len) };
        let mut buf = base.to_vec();
        let mut crashes = 0u32;
        for i in 0..iterations {
            let idx = (i as usize) % buf.len();
            buf[idx] = buf[idx].wrapping_add(1);
            let result = unsafe { target_func(buf.as_ptr(), buf.len()) };
            if result < 0 {
                unsafe { on_crash(buf.as_ptr(), buf.len(), result); }
                crashes += 1;
            }
            buf.copy_from_slice(base);
        }
        crashes
    }
`, {
    target_func: targetFuncPtr,
    on_crash: new NativeCallback((input, len, result) => {
        send({ type: 'fuzz:crash', input: input.readByteArray(len), result });
    }, 'void', ['pointer', 'size_t', 'int']),
});
```

### 2.8 CModule vs RustModule 비교

| 항목 | CModule | RustModule |
|------|---------|------------|
| 언어 | C | Rust |
| 컴파일 속도 | 빠름 (TinyCC) | 느림 (rustc) |
| 안전성 | 낮음 (수동 메모리) | 높음 (소유권 시스템) |
| 생태계 | 제한적 (gum 헤더) | Cargo crates 전체 |
| 헤더/라이브러리 | gum, glib, capstone 내장 | std 사용 가능 |
| 최적화 | external 툴체인 필요 | 기본 최적화 |
| 디버깅 | printf로 send 우회 | panic은 크래시 주의 |
| CARF 권장 | 간단한 GumAPI 콜백 | 복잡한 로직, 의존성 필요 시 |

### 2.9 주의사항

| 항목 | 설명 |
|------|------|
| `#[no_mangle]` | 반드시 필요. 없으면 심볼 이름 맹글링됨 |
| `extern "C"` | 반드시 필요. C ABI 호출 규약 |
| 컴파일 시간 | CModule보다 상당히 길 수 있음 |
| gc-sections | v17.2.10에서 수정. KEEP 디렉티브 자동 생성 |
| panic | 프로세스 크래시 유발. catch_unwind 사용 권장 |
| 전역 상태 | static 변수는 AtomicXxx 또는 Mutex 사용 |
| 의존성 | Cargo 형식 문자열: `'crate_name = "version"'` |

---

## 3. File I/O

### 3.1 정적 메서드 (간편 API)

```javascript
// 전체 읽기
const bytes = File.readAllBytes('/path/to/file');     // ArrayBuffer
const text = File.readAllText('/path/to/file');        // string (UTF-8)

// 전체 쓰기
File.writeAllBytes('/path/to/file', arrayBuffer);
File.writeAllText('/path/to/file', 'content');
```

### 3.2 인스턴스 (스트림 API)

```javascript
const f = new File('/path/to/file', 'rb'); // C fopen 모드

f.tell();                          // 현재 위치
f.seek(0, File.SEEK_SET);         // 시작부터
f.seek(-10, File.SEEK_END);       // 끝에서 10바이트 전
f.seek(5, File.SEEK_CUR);         // 현재에서 +5

f.readBytes(256);                  // ArrayBuffer (최대 256바이트)
f.readBytes();                     // ArrayBuffer (EOF까지)
f.readText(100);                   // string (최대 100자)
f.readLine();                      // string (개행 제외)

f.write('text data');              // 문자열 쓰기
f.write(arrayBuffer);             // 바이너리 쓰기

f.flush();
f.close();
```

### 3.3 활용 예제

```javascript
// 설정 파일 읽기/수정
const config = JSON.parse(File.readAllText('/data/local/tmp/config.json'));
config.debug = true;
File.writeAllText('/data/local/tmp/config.json', JSON.stringify(config));

// 바이너리 파일 파싱
const elf = File.readAllBytes('/proc/self/exe');
const view = new DataView(elf);
const magic = view.getUint32(0, true);
```

---

## 4. Socket API

### 4.1 Socket.listen([options])

TCP/UNIX 리스닝 소켓. `Promise<SocketListener>` 반환.

```javascript
const listener = await Socket.listen();
console.log('Listening on port:', listener.port);

const listener = await Socket.listen({ port: 8080 });

const listener = await Socket.listen({
    family: 'unix',
    path: '/tmp/carf.sock',
});
```

| 옵션 | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| `family` | `string` | `'unix'`, `'ipv4'`, `'ipv6'` | IPv4+IPv6 |
| `host` | `string` | 바인딩 주소 | 모든 인터페이스 |
| `port` | `number` | 포트 번호 | 랜덤 |
| `type` | `string` | UNIX: `'anonymous'`, `'path'`, `'abstract'` | - |
| `path` | `string` | UNIX 소켓 경로 | - |
| `backlog` | `number` | 대기열 크기 | 10 |

### 4.2 Socket.connect(options)

```javascript
const conn = await Socket.connect({ host: '127.0.0.1', port: 8080 });
```

### 4.3 유틸리티

```javascript
Socket.type(fd);           // 'tcp', 'udp', 'tcp6', 'unix:stream', null
Socket.localAddress(fd);   // { ip: '0.0.0.0', port: 8080 }
Socket.peerAddress(fd);    // { ip: '1.2.3.4', port: 54321 }
```

### 4.4 SocketListener

```javascript
listener.port;                       // 리스닝 포트
listener.path;                       // UNIX 소켓 경로
const conn = await listener.accept(); // 클라이언트 수락
await listener.close();
```

### 4.5 SocketConnection (IOStream 상속)

```javascript
const conn = await Socket.connect({ host: 'localhost', port: 9090 });
conn.setNoDelay(true);

const data = await conn.input.read(1024);
await conn.output.write(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]).buffer);
await conn.close();
```

---

## 5. Stream API

### 5.1 IOStream

```javascript
stream.input;    // InputStream
stream.output;   // OutputStream
await stream.close();
```

### 5.2 InputStream

```javascript
const data = await input.read(4096);       // 최대 size 바이트 (빈 ArrayBuffer = EOF)
const exact = await input.readAll(1024);   // 정확히 size 바이트 (부족하면 에러)
await input.close();
```

`readAll` 실패 시 에러 객체에 `partialData` 프로퍼티로 읽은 데이터 접근 가능.

### 5.3 OutputStream

```javascript
const written = await output.write(arrayBuffer);           // 반환: 쓴 바이트 수
await output.writeAll(arrayBuffer);                         // 전부 쓰기
await output.writeMemoryRegion(ptr('0x1000'), 4096);       // 메모리에서 직접 전송
await output.close();
```

`writeAll` 실패 시 에러 객체에 `partialSize` 프로퍼티.

### 5.4 Unix/Win32 스트림

```javascript
// UNIX
const input = new UnixInputStream(fd, { autoClose: true });
const output = new UnixOutputStream(fd, { autoClose: true });

// Windows
const input = new Win32InputStream(handle, { autoClose: true });
const output = new Win32OutputStream(handle, { autoClose: true });
```

---

## 6. SqliteDatabase

### 6.1 열기

```javascript
const db = SqliteDatabase.open('/path/to/db.sqlite');
const db = SqliteDatabase.open('/path/to/db.sqlite', {
    flags: ['readonly']   // 'readonly' | 'readwrite' | 'create'
});

// 인라인 (Base64, gzip 압축 가능)
const db = SqliteDatabase.openInline('H4sIAAAAA...');
```

### 6.2 쿼리

```javascript
// DDL
db.exec('CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, msg TEXT)');

// 파라미터 바인딩
const stmt = db.prepare('SELECT name, age FROM users WHERE age > ?');
stmt.bindInteger(1, 18);

let row;
while ((row = stmt.step()) !== null) {
    const [name, age] = row;
    console.log(name, age);
}
stmt.reset();
```

### 6.3 바인딩 메서드

| 메서드 | 타입 |
|--------|------|
| `bindInteger(index, value)` | 정수 |
| `bindFloat(index, value)` | 실수 |
| `bindText(index, value)` | 문자열 |
| `bindBlob(index, bytes)` | ArrayBuffer, 바이트 배열, 문자열 |
| `bindNull(index)` | NULL |

### 6.4 내보내기/닫기

```javascript
const exported = db.dump();  // gzip Base64 문자열
db.close();
```

### 6.5 활용 예제

```javascript
// Android 앱 DB 분석
const db = SqliteDatabase.open(
    '/data/data/com.example.app/databases/app.db',
    { flags: ['readonly'] }
);
const stmt = db.prepare('SELECT key, value FROM preferences');
const prefs = {};
let row;
while ((row = stmt.step()) !== null) {
    prefs[row[0]] = row[1];
}
stmt.reset();
send({ type: 'db:prefs', data: prefs });
db.close();
```

---

## 7. 기타 유틸리티

### 7.1 console

```javascript
console.log('Info');
console.warn('Warning');
console.error('Error');
```

Agent에서 console.log는 Host의 on('message') 핸들러로 전달됨.

### 7.2 hexdump

```javascript
console.log(hexdump(ptr, {
    offset: 0,
    length: 64,
    header: true,
    ansi: true,
}));

console.log(hexdump(arrayBuffer));
```

### 7.3 Worker

```javascript
const worker = new Worker('/path/to/worker.js', {
    onMessage(message) {
        console.log('Worker:', message);
    }
});
worker.post({ type: 'task', data: 'hello' });
worker.terminate();
```

별도 스레드에서 스크립트 실행. 무거운 처리를 메인 스레드에서 분리할 때 사용.

### 7.4 Cloak

```javascript
Cloak.addThread(Process.getCurrentThreadId());  // 스레드 숨기기
Cloak.removeThread(threadId);                    // 숨기기 해제
Cloak.hasRangeContaining(ptr('0x7fff0000'));     // 은폐 범위 확인
```

안티치트/RASP 우회 시 Frida 스레드를 프로세스 열거에서 숨길 때 활용.

### 7.5 Profiler / Sampler

| Sampler | 측정 대상 |
|---------|----------|
| `CycleSampler` | CPU 사이클 |
| `BusyCycleSampler` | 바쁜 CPU 사이클 |
| `WallClockSampler` | 벽시계 시간 |
| `UserTimeSampler` | 유저 모드 시간 |
| `MallocCountSampler` | malloc 호출 횟수 |
| `CallCountSampler` | 함수 호출 횟수 |

```javascript
const sampler = new CycleSampler();
const before = sampler.sample();
// ... 측정 대상 코드 ...
const after = sampler.sample();
console.log('Cycles:', after - before);
```

---

## 8. CARF 활용 전략

### 8.1 성능 계층 선택

```
요구 성능    낮음 ◄─────────────────────► 높음
선택        JS 콜백     CModule     RustModule
            간편한       GumAPI      Cargo 생태계
            프로토타이핑   직접 접근    안전성 + 성능
```

### 8.2 CARF Std Script 기능별 구현 위치

| 기능 | 구현 | 이유 |
|------|------|------|
| RPC 라우터 | JS | 유연한 라우팅, 낮은 빈도 |
| Java/ObjC 브릿지 | JS | Frida JS API 전용 |
| 모듈/클래스 열거 | JS | 일회성, 낮은 빈도 |
| 메모리 스캔 (1MB 미만) | JS | Memory.scanSync 충분 |
| 메모리 스캔 (1MB 이상) | RustModule | 고속 패턴 매칭 |
| Interceptor 콜백 (저빈도) | JS | 프로토타이핑, 유연성 |
| Interceptor 콜백 (고빈도) | RustModule | 약 10배 성능 |
| Stalker callout | CModule | GumAPI 직접 접근 |
| 퍼징 루프 | RustModule | tight loop, 안전성 |
| 데이터 인코딩 | RustModule | base64, hex, 해싱 |
| DB 읽기 | JS | SqliteDatabase 내장 API |
| 파일 I/O | JS | File 내장 API |

### 8.3 점진적 최적화 패턴

```javascript
// 1단계: JS 프로토타입
function scanMemory(base, size, pattern) {
    return Memory.scanSync(ptr(base), size, pattern);
}

// 2단계: 성능 병목 확인 후 RustModule 도입
const scanner = new RustModule(SCANNER_RUST_SRC, { notify: notifyCb });
const fastScan = new NativeFunction(scanner.fast_scan, 'int', [...]);

// 3단계: 크기 기반 자동 라우팅
function scanMemoryAuto(base, size, pattern) {
    if (size > 1024 * 1024) {
        return scanWithRust(base, size, pattern);
    }
    return Memory.scanSync(ptr(base), size, pattern);
}
```

---

*Last updated: 2026-03-10*
