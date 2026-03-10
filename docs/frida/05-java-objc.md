# Java & ObjC 런타임 API

> Frida의 Java (Android ART/Dalvik) 및 ObjC (iOS/macOS) 런타임 브릿지 API 완전 레퍼런스.
> 두 런타임 모두 힙 탐색, 메서드 후킹, 클래스 동적 생성, 인스턴스 조작 등을 지원한다.

---

## 목차

1. [Java API (Android)](#1-java-api-android)
   - 1.1 [프로퍼티](#11-프로퍼티)
   - 1.2 [핵심 메서드](#12-핵심-메서드)
   - 1.3 [클래스 열거](#13-클래스-열거)
   - 1.4 [메서드 후킹](#14-메서드-후킹)
   - 1.5 [필드 접근](#15-필드-접근)
   - 1.6 [클래스 등록](#16-클래스-등록)
   - 1.7 [디옵티마이즈](#17-디옵티마이즈)
   - 1.8 [VM 및 클래스 팩토리](#18-vm-및-클래스-팩토리)
   - 1.9 [실전 레시피](#19-실전-레시피)
   - 1.10 [주의사항 및 트러블슈팅](#110-주의사항-및-트러블슈팅)
2. [ObjC API (iOS/macOS)](#2-objc-api-iosmacos)
   - 2.1 [프로퍼티](#21-프로퍼티)
   - 2.2 [ObjC.Object](#22-objcobject)
   - 2.3 [메서드 후킹](#23-메서드-후킹)
   - 2.4 [클래스 열거](#24-클래스-열거)
   - 2.5 [인스턴스 탐색](#25-인스턴스-탐색)
   - 2.6 [클래스 등록](#26-클래스-등록)
   - 2.7 [ObjC.Block](#27-objcblock)
   - 2.8 [프록시 등록](#28-프록시-등록)
   - 2.9 [바인딩](#29-바인딩)
   - 2.10 [Selector 유틸리티](#210-selector-유틸리티)
   - 2.11 [ApiResolver 활용](#211-apiresolver-활용)
   - 2.12 [실전 레시피](#212-실전-레시피)
   - 2.13 [주의사항 및 트러블슈팅](#213-주의사항-및-트러블슈팅)
3. [플랫폼 판별 및 공통 패턴](#3-플랫폼-판별-및-공통-패턴)
4. [Java vs ObjC 비교 요약](#4-java-vs-objc-비교-요약)

---

## 1. Java API (Android)

Android 환경(Dalvik/ART)에서 Java 레이어를 동적으로 조작하기 위한 API.
Frida가 프로세스에 주입되면 ART VM에 접근하여 클래스 로드, 메서드 후킹, 힙 탐색 등을 수행할 수 있다.

---

### 1.1 프로퍼티

| 프로퍼티 | 타입 | 설명 |
|----------|------|------|
| `Java.available` | `boolean` | Java 런타임(ART/Dalvik)이 현재 프로세스에 로드되어 있는지 여부. `false`이면 네이티브 전용 프로세스이거나 비-Android 환경 |
| `Java.androidVersion` | `string` | Android OS 버전 문자열 (예: `"14"`, `"15"`). API 레벨이 아닌 릴리스 버전 |
| `Java.vm` | `JavaVM` | 현재 프로세스의 Java VM 인스턴스. JNI 레벨 접근에 사용 |
| `Java.classFactory` | `ClassFactory` | 현재 스레드의 기본 클래스 팩토리. 클래스 로더 제어에 사용 |

```javascript
// 안전한 Java API 진입점 패턴
if (Java.available) {
  console.log(`Android ${Java.androidVersion} 감지`);
  Java.perform(() => {
    // 모든 Java API 호출은 이 블록 안에서
  });
} else {
  console.log('Java 런타임 없음 — 네이티브 전용이거나 비-Android 환경');
}
```

> **주의**: `Java.available`이 `false`인 경우는 네이티브 전용 프로세스(NDK만 사용), 비-Android 플랫폼, 또는 VM이 아직 초기화되지 않은 시점일 수 있다.

---

### 1.2 핵심 메서드

#### Java.perform(fn)

현재 스레드를 Java VM에 attach한 뒤 콜백 `fn`을 실행한다. **모든 Java API 호출의 필수 진입점**이다.

| 항목 | 값 |
|------|-----|
| **매개변수** | `fn: () => void` |
| **반환값** | `void` |
| **비동기** | 내부적으로 큐잉 가능 |

```javascript
Java.perform(() => {
  // 이 블록 안에서만 Java API가 유효하다
  const Activity = Java.use('android.app.Activity');
  console.log('Activity 클래스 접근 성공');
});
```

**동작 원리:**
1. 현재 스레드가 이미 VM에 attach되어 있으면 즉시 `fn` 실행
2. 그렇지 않으면 새로운 스레드를 VM에 attach하고 `fn` 실행
3. `fn` 실행 완료 후 스레드를 detach

```javascript
// 중첩 perform — 외부 perform 안에서 다시 호출해도 안전
Java.perform(() => {
  Java.perform(() => {
    // 이미 attach된 스레드이므로 즉시 실행
    console.log('중첩 perform도 정상 동작');
  });
});
```

---

#### Java.performNow(fn)

`Java.perform`과 동일하지만 **큐잉 없이 즉시 실행**한다.

| 항목 | 값 |
|------|-----|
| **매개변수** | `fn: () => void` |
| **반환값** | `void` |
| **비동기** | 아니오 — 즉시 실행 |

```javascript
// 이미 Java 스레드에 있을 때 (예: Java 메서드 후킹 콜백 내부)
Java.performNow(() => {
  const System = Java.use('java.lang.System');
  console.log(System.getProperty('os.name'));
});
```

**`perform` vs `performNow` 비교:**

| 특성 | `perform` | `performNow` |
|------|-----------|-------------|
| VM 미attach 스레드 | 큐잉 후 실행 | 즉시 attach 후 실행 |
| 이미 attach된 스레드 | 즉시 실행 | 즉시 실행 |
| 안전성 | 높음 (큐잉으로 순서 보장) | 호출자가 타이밍 관리 필요 |
| 사용 시점 | 일반적인 진입점 | 후킹 콜백 내부, 성능 민감 경로 |

---

#### Java.use(className)

지정된 클래스의 래퍼 객체를 반환한다. 이 래퍼를 통해 메서드 후킹, 필드 접근, 인스턴스 생성 등을 수행한다.

| 항목 | 값 |
|------|-----|
| **매개변수** | `className: string` — 정규화된 클래스명 (예: `'java.lang.String'`) |
| **반환값** | 클래스 래퍼 객체 |
| **예외** | 클래스를 찾을 수 없으면 `Error` |

```javascript
Java.perform(() => {
  // 기본 클래스 접근
  const String = Java.use('java.lang.String');
  const StringBuilder = Java.use('java.lang.StringBuilder');
  const ArrayList = Java.use('java.util.ArrayList');

  // 인스턴스 생성 ($new는 생성자)
  const str = String.$new('Hello Frida');
  console.log(str.toString());  // "Hello Frida"
  console.log(str.length());    // 11

  // StringBuilder 활용
  const sb = StringBuilder.$new();
  sb.append('Hello');
  sb.append(' ');
  sb.append('World');
  console.log(sb.toString());  // "Hello World"

  // ArrayList
  const list = ArrayList.$new();
  list.add('item1');
  list.add('item2');
  console.log(`크기: ${list.size()}`);  // 크기: 2
});
```

**내부 클래스 접근:**

```javascript
Java.perform(() => {
  // 내부 클래스는 '$'로 구분
  const Entry = Java.use('java.util.Map$Entry');
  const MyInner = Java.use('com.example.OuterClass$InnerClass');

  // 익명 내부 클래스 (번호로 접근)
  const Anon = Java.use('com.example.OuterClass$1');
});
```

**메서드 접근 방식:**

```javascript
Java.perform(() => {
  const Cls = Java.use('com.example.MyClass');

  // 정적 메서드 호출
  const result = Cls.staticMethod('arg');

  // implementation 교체 (후킹)
  Cls.targetMethod.implementation = function(arg1, arg2) {
    console.log(`인자: ${arg1}, ${arg2}`);
    return this.targetMethod(arg1, arg2);  // 원본 호출
  };

  // 오버로드 구분
  Cls.overloadedMethod.overload('int').implementation = function(n) {
    return this.overloadedMethod(n);
  };

  Cls.overloadedMethod.overload('java.lang.String').implementation = function(s) {
    return this.overloadedMethod(s);
  };
});
```

---

#### Java.choose(className, callbacks)

Java 힙을 스캔하여 지정된 클래스의 **살아있는(live) 인스턴스**를 찾는다.

| 항목 | 값 |
|------|-----|
| **매개변수** | `className: string`, `callbacks: { onMatch, onComplete }` |
| **callbacks.onMatch** | `(instance: Object) => void | 'stop'` — 인스턴스 발견 시 호출. `'stop'` 반환 시 탐색 중단 |
| **callbacks.onComplete** | `() => void` — 탐색 완료 시 호출 |

```javascript
Java.perform(() => {
  // 모든 Activity 인스턴스 찾기
  Java.choose('android.app.Activity', {
    onMatch(instance) {
      console.log(`Activity 발견: ${instance.getClass().getName()}`);
      console.log(`  제목: ${instance.getTitle()}`);
      console.log(`  표시 중: ${!instance.isFinishing()}`);
    },
    onComplete() {
      console.log('Activity 스캔 완료');
    }
  });
});
```

```javascript
// 특정 인스턴스 하나만 찾고 중단
Java.perform(() => {
  let targetInstance = null;

  Java.choose('com.example.SessionManager', {
    onMatch(instance) {
      targetInstance = instance;
      console.log(`세션 토큰: ${instance.getToken()}`);
      return 'stop';  // 첫 번째 인스턴스만 필요
    },
    onComplete() {
      if (targetInstance) {
        // retain하여 나중에 사용
        Java.retain(targetInstance);
      }
    }
  });
});
```

```javascript
// SharedPreferences에서 저장된 값 추출
Java.perform(() => {
  Java.choose('android.app.SharedPreferencesImpl', {
    onMatch(instance) {
      const file = instance.getFile();
      console.log(`\nPrefs 파일: ${file.getAbsolutePath()}`);

      const map = instance.getAll();
      const iterator = map.entrySet().iterator();
      while (iterator.hasNext()) {
        const entry = Java.cast(iterator.next(), Java.use('java.util.Map$Entry'));
        console.log(`  ${entry.getKey()} = ${entry.getValue()}`);
      }
    },
    onComplete() {
      console.log('SharedPreferences 스캔 완료');
    }
  });
});
```

> **성능 주의**: `Java.choose`는 전체 힙을 스캔하므로 대형 앱에서는 느릴 수 있다. 가능한 한 구체적인 클래스명을 사용하고, 필요하면 `'stop'`으로 조기 중단한다.

---

#### Java.retain(obj)

JavaScript 측에서 Java 객체에 대한 참조를 유지하여 GC로부터 보호한다.

```javascript
Java.perform(() => {
  let savedRef = null;

  Java.choose('com.example.CryptoHelper', {
    onMatch(instance) {
      // retain하지 않으면 onComplete 이후 GC될 수 있음
      savedRef = Java.retain(instance);
      return 'stop';
    },
    onComplete() {}
  });

  // savedRef를 나중에 안전하게 사용 가능
  if (savedRef) {
    console.log(savedRef.decrypt('encrypted_data'));
  }
});
```

---

#### Java.cast(handle, klass)

Java 객체를 특정 클래스/인터페이스 타입으로 캐스팅한다. 부모 클래스나 구현 인터페이스로의 업캐스트, 또는 실제 타입으로의 다운캐스트에 사용한다.

| 항목 | 값 |
|------|-----|
| **매개변수** | `handle: Object` — 캐스팅할 객체, `klass: Object` — `Java.use()`로 얻은 클래스 래퍼 |
| **반환값** | 캐스팅된 객체 |

```javascript
Java.perform(() => {
  // 인터페이스로 캐스팅
  Java.choose('java.util.HashMap', {
    onMatch(instance) {
      const asMap = Java.cast(instance, Java.use('java.util.Map'));
      console.log(`Map 크기: ${asMap.size()}`);

      // entrySet 순회
      const entrySet = asMap.entrySet();
      const iterator = entrySet.iterator();
      while (iterator.hasNext()) {
        const entry = Java.cast(iterator.next(), Java.use('java.util.Map$Entry'));
        console.log(`  ${entry.getKey()} → ${entry.getValue()}`);
      }
    },
    onComplete() {}
  });
});
```

```javascript
// Context에서 Activity로 다운캐스트
Java.perform(() => {
  Java.choose('android.content.ContextWrapper', {
    onMatch(instance) {
      try {
        const activity = Java.cast(instance, Java.use('android.app.Activity'));
        console.log(`Activity: ${activity.getClass().getName()}`);
      } catch (e) {
        // 모든 ContextWrapper가 Activity인 것은 아님
        console.log(`Activity 아님: ${instance.getClass().getName()}`);
      }
    },
    onComplete() {}
  });
});
```

---

#### Java.array(type, elements)

Java 배열을 생성한다.

| 항목 | 값 |
|------|-----|
| **매개변수** | `type: string` — Java 타입명, `elements: any[]` — 초기 요소 |
| **반환값** | Java 배열 객체 |

**타입 문자열 규칙:**

| Java 타입 | 타입 문자열 |
|-----------|------------|
| `int` | `'int'` |
| `byte` | `'byte'` |
| `char` | `'char'` |
| `boolean` | `'boolean'` |
| `long` | `'long'` |
| `float` | `'float'` |
| `double` | `'double'` |
| `short` | `'short'` |
| `String` | `'java.lang.String'` |
| `Object` | `'java.lang.Object'` |
| `byte[]` | `'[B'` |

```javascript
Java.perform(() => {
  // 기본 타입 배열
  const intArr = Java.array('int', [1, 2, 3, 4, 5]);
  const byteArr = Java.array('byte', [0x48, 0x65, 0x6c, 0x6c, 0x6f]);

  // 문자열 배열
  const strArr = Java.array('java.lang.String', ['hello', 'world']);

  // byte 배열을 String으로 변환
  const String = Java.use('java.lang.String');
  const str = String.$new(byteArr);
  console.log(str.toString());  // "Hello"

  // 2차원 배열은 java.lang.reflect.Array를 사용
  const Array = Java.use('java.lang.reflect.Array');
  const intClass = Java.use('java.lang.Integer').TYPE.value;
  const dims = Java.array('int', [3, 4]);
  const matrix = Array.newInstance(intClass, dims);
});
```

---

#### Java.isMainThread()

현재 실행 중인 스레드가 Android 메인(UI) 스레드인지 확인한다. `boolean`을 반환한다.

```javascript
Java.perform(() => {
  const Activity = Java.use('android.app.Activity');
  Activity.onCreate.implementation = function(savedInstanceState) {
    console.log(`메인 스레드: ${Java.isMainThread()}`);  // true
    this.onCreate(savedInstanceState);
  };
});
```

```javascript
// 메인 스레드 안전 패턴 — UI 조작이 필요할 때
Java.perform(() => {
  if (!Java.isMainThread()) {
    // 메인 스레드에서 실행하도록 스케줄링
    const Looper = Java.use('android.os.Looper');
    const Handler = Java.use('android.os.Handler');
    const Runnable = Java.use('java.lang.Runnable');

    const mainHandler = Handler.$new(Looper.getMainLooper());
    const runnable = Java.registerClass({
      name: 'com.frida.MainThreadRunner',
      implements: [Runnable],
      methods: {
        run() {
          console.log(`이제 메인 스레드: ${Java.isMainThread()}`);  // true
          // UI 조작 수행
        }
      }
    });
    mainHandler.post(runnable.$new());
  }
});
```

---

### 1.3 클래스 열거

#### Java.enumerateLoadedClasses(callbacks)

현재 VM에 로드된 모든 클래스를 비동기로 열거한다.

| 항목 | 값 |
|------|-----|
| **callbacks.onMatch** | `(name: string, handle: NativePointer) => void` — 클래스 발견 시 호출 |
| **callbacks.onComplete** | `() => void` — 열거 완료 시 호출 |

```javascript
Java.perform(() => {
  const loadedClasses = [];

  Java.enumerateLoadedClasses({
    onMatch(name, handle) {
      loadedClasses.push(name);
    },
    onComplete() {
      console.log(`총 ${loadedClasses.length}개 클래스 로드됨`);

      // 특정 패키지 필터링
      const appClasses = loadedClasses.filter(c => c.startsWith('com.example.'));
      appClasses.forEach(c => console.log(`  ${c}`));
    }
  });
});
```

#### Java.enumerateLoadedClassesSync()

동기 버전. 모든 클래스명을 `string[]`로 반환한다.

```javascript
Java.perform(() => {
  const classes = Java.enumerateLoadedClassesSync();

  // 특정 키워드로 클래스 검색
  const cryptoClasses = classes.filter(c =>
    c.toLowerCase().includes('crypto') ||
    c.toLowerCase().includes('cipher') ||
    c.toLowerCase().includes('encrypt')
  );
  console.log('암호화 관련 클래스:');
  cryptoClasses.forEach(c => console.log(`  ${c}`));
});
```

#### Java.enumerateClassLoaders(callbacks)

사용 가능한 모든 클래스 로더를 열거한다. 커스텀 클래스 로더가 로드한 클래스에 접근할 때 필수적이다.

| 항목 | 값 |
|------|-----|
| **callbacks.onMatch** | `(loader: Object) => void | 'stop'` — 클래스 로더 발견 시 호출 |
| **callbacks.onComplete** | `() => void` — 열거 완료 시 호출 |

```javascript
Java.perform(() => {
  Java.enumerateClassLoaders({
    onMatch(loader) {
      console.log(`ClassLoader: ${loader}`);
      try {
        // 특정 클래스 로더로 클래스 접근 시도
        const factory = Java.ClassFactory.get(loader);
        const target = factory.use('com.example.hidden.SecretClass');
        console.log(`  SecretClass 발견!`);
        console.log(`  비밀값: ${target.getSecret()}`);
      } catch (e) {
        // 이 로더에는 해당 클래스가 없음
      }
    },
    onComplete() {
      console.log('클래스 로더 열거 완료');
    }
  });
});
```

#### Java.enumerateClassLoadersSync()

동기 버전. 모든 ClassLoader 인스턴스를 배열로 반환한다.

```javascript
Java.perform(() => {
  const loaders = Java.enumerateClassLoadersSync();
  console.log(`클래스 로더 ${loaders.length}개 발견`);

  // 각 로더에서 특정 클래스 탐색
  for (const loader of loaders) {
    try {
      const factory = Java.ClassFactory.get(loader);
      const cls = factory.use('com.example.DynamicPlugin');
      console.log(`DynamicPlugin을 로드한 ClassLoader: ${loader}`);
      break;
    } catch (e) {
      continue;
    }
  }
});
```

**커스텀 클래스 로더에서 클래스 접근하는 완전한 패턴:**

```javascript
Java.perform(() => {
  const targetClassName = 'com.example.obfuscated.a';

  // 1. 기본 방법 시도
  try {
    const cls = Java.use(targetClassName);
    console.log('기본 클래스 로더에서 발견');
    return;
  } catch (e) {
    console.log('기본 클래스 로더에 없음 — 다른 로더 탐색');
  }

  // 2. 모든 클래스 로더에서 탐색
  Java.enumerateClassLoaders({
    onMatch(loader) {
      try {
        const factory = Java.ClassFactory.get(loader);
        const cls = factory.use(targetClassName);
        console.log(`발견! ClassLoader: ${loader}`);

        // 이후 이 factory를 기본으로 설정
        Java.classFactory.loader = loader;

        // 이제 Java.use()로 접근 가능
        const target = Java.use(targetClassName);
        console.log(`메서드: ${target.class.getDeclaredMethods()}`);
        return 'stop';
      } catch (e) {
        // 다음 로더로
      }
    },
    onComplete() {}
  });
});
```

---

### 1.4 메서드 후킹

Java 메서드 후킹은 `implementation` 속성을 교체하는 방식으로 동작한다.

#### 기본 후킹

```javascript
Java.perform(() => {
  const Activity = Java.use('android.app.Activity');

  // 생명주기 후킹
  Activity.onCreate.overload('android.os.Bundle').implementation = function(savedInstanceState) {
    console.log(`[onCreate] ${this.getClass().getName()}`);
    this.onCreate(savedInstanceState);  // 원본 호출 필수
  };

  Activity.onResume.implementation = function() {
    console.log(`[onResume] ${this.getClass().getName()}`);
    this.onResume();
  };

  Activity.onPause.implementation = function() {
    console.log(`[onPause] ${this.getClass().getName()}`);
    this.onPause();
  };
});
```

#### 오버로드 처리

동일 이름의 메서드가 여러 개(오버로드)인 경우 `overload()`로 시그니처를 명시해야 한다.

```javascript
Java.perform(() => {
  const String = Java.use('java.lang.String');

  // 특정 오버로드 지정
  String.valueOf.overload('int').implementation = function(i) {
    console.log(`String.valueOf(int): ${i}`);
    return this.valueOf(i);
  };

  String.valueOf.overload('boolean').implementation = function(b) {
    console.log(`String.valueOf(boolean): ${b}`);
    return this.valueOf(b);
  };

  String.valueOf.overload('java.lang.Object').implementation = function(obj) {
    console.log(`String.valueOf(Object): ${obj}`);
    return this.valueOf(obj);
  };
});
```

#### 모든 오버로드 일괄 후킹

```javascript
Java.perform(() => {
  const target = Java.use('com.example.ApiClient');
  const methodName = 'request';

  // 모든 오버로드를 순회하며 후킹
  const overloads = target[methodName].overloads;
  console.log(`${methodName}: ${overloads.length}개 오버로드 발견`);

  overloads.forEach((overload, index) => {
    overload.implementation = function(...args) {
      console.log(`[${methodName}] 오버로드 #${index}`);
      args.forEach((arg, i) => {
        console.log(`  arg[${i}]: ${arg} (${typeof arg})`);
      });

      const result = this[methodName](...args);
      console.log(`  반환값: ${result}`);
      return result;
    };
  });
});
```

#### 반환값 변조

```javascript
Java.perform(() => {
  const Security = Java.use('com.example.Security');

  // 루팅 탐지 우회
  Security.isRooted.implementation = function() {
    const original = this.isRooted();
    console.log(`isRooted() 원본: ${original}`);
    return false;  // 항상 false 반환
  };

  // SSL Pinning 우회
  Security.checkCertificate.implementation = function(cert) {
    console.log('인증서 검증 우회');
    return true;  // 항상 유효한 것으로
  };

  // 디버거 탐지 우회
  Security.isDebuggerAttached.implementation = function() {
    return false;
  };
});
```

#### 생성자 후킹

```javascript
Java.perform(() => {
  const URL = Java.use('java.net.URL');

  // 생성자 후킹 ($init)
  URL.$init.overload('java.lang.String').implementation = function(urlStr) {
    console.log(`URL 생성: ${urlStr}`);
    // URL 변경도 가능
    // urlStr = urlStr.replace('http://', 'https://');
    this.$init(urlStr);
  };
});
```

#### 후킹 해제

```javascript
Java.perform(() => {
  const Target = Java.use('com.example.Target');

  // 후킹
  Target.method.implementation = function() {
    console.log('후킹됨');
    return this.method();
  };

  // 해제 — null 할당으로 원본 구현 복원
  Target.method.implementation = null;
  console.log('후킹 해제됨 — 원본 구현 복원');
});
```

#### 스택 트레이스 출력

```javascript
Java.perform(() => {
  const Cipher = Java.use('javax.crypto.Cipher');

  Cipher.doFinal.overload('[B').implementation = function(input) {
    console.log('\n=== Cipher.doFinal 호출 ===');
    console.log(`알고리즘: ${this.getAlgorithm()}`);
    console.log(`입력 (hex): ${bytesToHex(input)}`);

    // Java 스택 트레이스
    const Exception = Java.use('java.lang.Exception');
    const trace = Exception.$new().getStackTrace();
    console.log('호출 스택:');
    for (let i = 0; i < Math.min(trace.length, 10); i++) {
      console.log(`  ${trace[i].toString()}`);
    }

    const result = this.doFinal(input);
    console.log(`출력 (hex): ${bytesToHex(result)}`);
    return result;
  };
});

function bytesToHex(bytes) {
  const hex = [];
  for (let i = 0; i < bytes.length; i++) {
    hex.push(('0' + (bytes[i] & 0xFF).toString(16)).slice(-2));
  }
  return hex.join('');
}
```

#### 예외 처리

```javascript
Java.perform(() => {
  const Parser = Java.use('com.example.JsonParser');

  Parser.parse.implementation = function(jsonStr) {
    try {
      const result = this.parse(jsonStr);
      console.log(`파싱 성공: ${result}`);
      return result;
    } catch (e) {
      // Java 예외를 JavaScript로 잡기
      console.log(`파싱 실패: ${e.message}`);
      console.log(`입력: ${jsonStr}`);

      // 원본 예외를 다시 던지거나
      throw e;

      // 또는 기본값 반환
      // return Java.use('org.json.JSONObject').$new();
    }
  };
});
```

---

### 1.5 필드 접근

Java 클래스의 정적 필드와 인스턴스 필드에 접근하는 방법.

#### 정적 필드

```javascript
Java.perform(() => {
  const cls = Java.use('com.example.Config');

  // 정적 필드 읽기
  console.log(`API_KEY: ${cls.API_KEY.value}`);
  console.log(`DEBUG: ${cls.DEBUG_MODE.value}`);

  // 정적 필드 쓰기
  cls.DEBUG_MODE.value = true;
  cls.API_ENDPOINT.value = 'https://modified.example.com';
});
```

#### 인스턴스 필드

인스턴스 필드에 접근하려면 먼저 `Java.choose()`로 인스턴스를 획득해야 한다.

```javascript
Java.perform(() => {
  Java.choose('com.example.Config', {
    onMatch(instance) {
      // 인스턴스 필드 읽기/쓰기
      console.log(`secretToken: ${instance.secretToken.value}`);
      instance.secretToken.value = 'modified';

      // 부모 클래스의 필드 접근 (필드명 충돌 시)
      console.log(`부모 필드: ${instance._parentField.value}`);
    },
    onComplete() {}
  });
});
```

#### 리플렉션으로 필드 열거

```javascript
Java.perform(() => {
  const cls = Java.use('com.example.MyClass');

  // 모든 선언된 필드 열거
  const fields = cls.class.getDeclaredFields();
  console.log(`\n${cls.class.getName()} 필드 목록:`);

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    field.setAccessible(true);  // private 필드도 접근 가능하게
    const name = field.getName();
    const type = field.getType().getName();
    const modifiers = field.getModifiers();
    const isStatic = (modifiers & 0x0008) !== 0;  // Modifier.STATIC

    console.log(`  ${isStatic ? 'static ' : ''}${type} ${name}`);

    // 정적 필드의 값 출력
    if (isStatic) {
      try {
        const value = field.get(null);
        console.log(`    = ${value}`);
      } catch (e) {}
    }
  }
});
```

---

### 1.6 클래스 등록

`Java.registerClass()`로 런타임에 새로운 Java 클래스를 동적 생성한다. 인터페이스 구현, 콜백 처리 등에 활용한다.

```javascript
Java.perform(() => {
  // 기본 클래스 등록
  const MyClass = Java.registerClass({
    name: 'com.frida.MyClass',
    superClass: Java.use('java.lang.Object'),
    implements: [Java.use('java.io.Serializable')],
    fields: {
      name: 'java.lang.String',
      count: 'int',
    },
    methods: {
      // 생성자
      $init: [{
        returnType: 'void',
        argumentTypes: ['java.lang.String'],
        implementation(name) {
          this.$super.$init();
          this.name.value = name;
          this.count.value = 0;
        }
      }],
      // 일반 메서드
      getName: {
        returnType: 'java.lang.String',
        implementation() {
          return this.name.value;
        }
      },
      increment: {
        returnType: 'int',
        implementation() {
          this.count.value++;
          return this.count.value;
        }
      },
      // toString 오버라이드
      toString: {
        returnType: 'java.lang.String',
        implementation() {
          return `MyClass(name=${this.name.value}, count=${this.count.value})`;
        }
      }
    }
  });

  // 인스턴스 생성 및 사용
  const instance = MyClass.$new('test');
  console.log(instance.getName());  // "test"
  instance.increment();
  console.log(instance.toString());  // "MyClass(name=test, count=1)"
});
```

**Runnable 인터페이스 구현:**

```javascript
Java.perform(() => {
  const Runnable = Java.use('java.lang.Runnable');
  const Thread = Java.use('java.lang.Thread');

  const MyRunnable = Java.registerClass({
    name: 'com.frida.MyRunnable',
    implements: [Runnable],
    methods: {
      run() {
        console.log('커스텀 Runnable 실행됨!');
      }
    }
  });

  const thread = Thread.$new(MyRunnable.$new());
  thread.start();
});
```

**이벤트 리스너 구현:**

```javascript
Java.perform(() => {
  const OnClickListener = Java.use('android.view.View$OnClickListener');

  const MyClickListener = Java.registerClass({
    name: 'com.frida.MyClickListener',
    implements: [OnClickListener],
    methods: {
      onClick(view) {
        const id = view.getId();
        const res = view.getResources();
        try {
          const name = res.getResourceEntryName(id);
          console.log(`클릭: ${name} (id=${id})`);
        } catch (e) {
          console.log(`클릭: id=${id}`);
        }
      }
    }
  });
});
```

---

### 1.7 디옵티마이즈

ART 컴파일러가 최적화(인라인 등)한 코드를 인터프리터 모드로 되돌려서 후킹 가능하게 한다.

#### Java.deoptimizeEverything()

**모든** 컴파일된 Java 코드를 디옵티마이즈한다.

```javascript
Java.perform(() => {
  // 인라인된 메서드도 후킹 가능하게 함
  Java.deoptimizeEverything();

  // 이제 인라인 최적화된 메서드도 후킹 가능
  const Target = Java.use('com.example.InlinedHelper');
  Target.inlinedMethod.implementation = function() {
    console.log('인라인 메서드 후킹 성공!');
    return this.inlinedMethod();
  };
});
```

> **성능 경고**: 전체 디옵티마이즈는 앱 성능을 **크게** 저하시킨다. 특정 메서드 후킹이 안 될 때만 사용하고, 가능하면 `Java.deoptimizeBootImage()`를 먼저 시도한다.

#### Java.deoptimizeBootImage()

부트 이미지(시스템 프레임워크 코드)만 디옵티마이즈한다. `deoptimizeEverything`보다 영향 범위가 작다.

```javascript
Java.perform(() => {
  // 시스템 프레임워크 메서드 후킹 시
  Java.deoptimizeBootImage();

  // 시스템 클래스의 인라인 메서드를 후킹
  const Log = Java.use('android.util.Log');
  Log.d.overload('java.lang.String', 'java.lang.String').implementation = function(tag, msg) {
    console.log(`[${tag}] ${msg}`);
    return this.d(tag, msg);
  };
});
```

**디옵티마이즈 선택 가이드:**

| 상황 | 권장 방법 |
|------|-----------|
| 앱 코드 후킹이 안 될 때 | `Java.deoptimizeEverything()` |
| 시스템 API 후킹이 안 될 때 | `Java.deoptimizeBootImage()` |
| 특정 메서드만 문제일 때 | `deoptimizeBootImage()`를 먼저 시도하고 안 되면 `deoptimizeEverything()` |
| 성능이 중요한 경우 | 가능한 한 사용하지 않음 |

---

### 1.8 VM 및 클래스 팩토리

#### Java.vm

JNI 레벨의 VM 인스턴스에 접근한다.

```javascript
Java.perform(() => {
  // JNIEnv 포인터 획득
  const env = Java.vm.getEnv();
  console.log(`JNIEnv: ${env.handle}`);

  // JNI 버전 확인
  const version = env.getVersion();
  console.log(`JNI 버전: ${version}`);
});
```

#### Java.classFactory

현재 스레드의 클래스 팩토리. 클래스 로더 제어에 사용한다.

```javascript
Java.perform(() => {
  // DEX 캐시 디렉토리 확인
  console.log(`캐시: ${Java.classFactory.cacheDir}`);

  // 클래스 로더 변경
  Java.enumerateClassLoaders({
    onMatch(loader) {
      try {
        Java.classFactory.loader = loader;
        const cls = Java.use('com.example.PluginClass');
        console.log('PluginClass 접근 성공');
        return 'stop';
      } catch (e) {
        // 다음 로더
      }
    },
    onComplete() {}
  });
});
```

#### Java.ClassFactory.get(classLoader)

특정 클래스 로더에 대한 ClassFactory 인스턴스를 반환한다.

```javascript
Java.perform(() => {
  // WebView의 클래스 로더에서 클래스 접근
  Java.choose('android.webkit.WebView', {
    onMatch(webview) {
      const classLoader = webview.getClass().getClassLoader();
      const factory = Java.ClassFactory.get(classLoader);
      try {
        const bridge = factory.use('android.webkit.WebViewChromium');
        console.log('WebView 내부 클래스 접근 성공');
      } catch (e) {
        console.log(`접근 실패: ${e.message}`);
      }
    },
    onComplete() {}
  });
});
```

---

### 1.9 실전 레시피

#### 네트워크 요청 모니터링

```javascript
Java.perform(() => {
  // OkHttp3 인터셉트
  try {
    const CallClass = Java.use('okhttp3.internal.connection.RealCall');

    CallClass.execute.implementation = function() {
      const request = this.request();
      console.log(`\n[OkHttp] ${request.method()} ${request.url()}`);

      // 헤더 출력
      const headers = request.headers();
      for (let i = 0; i < headers.size(); i++) {
        console.log(`  ${headers.name(i)}: ${headers.value(i)}`);
      }

      const response = this.execute();
      console.log(`  응답: ${response.code()} ${response.message()}`);
      return response;
    };
  } catch (e) {
    console.log('OkHttp3 미사용');
  }

  // HttpURLConnection
  const URL = Java.use('java.net.URL');
  URL.openConnection.overload().implementation = function() {
    console.log(`[URLConnection] ${this.toString()}`);
    return this.openConnection();
  };
});
```

#### 암호화 키 추출

```javascript
Java.perform(() => {
  // SecretKeySpec 생성 감시
  const SecretKeySpec = Java.use('javax.crypto.spec.SecretKeySpec');
  SecretKeySpec.$init.overload('[B', 'java.lang.String').implementation = function(key, algo) {
    console.log(`\n[SecretKeySpec] 알고리즘: ${algo}`);
    console.log(`  키 (hex): ${bytesToHex(key)}`);
    console.log(`  키 길이: ${key.length * 8}비트`);
    this.$init(key, algo);
  };

  // IvParameterSpec (IV 추출)
  const IvParameterSpec = Java.use('javax.crypto.spec.IvParameterSpec');
  IvParameterSpec.$init.overload('[B').implementation = function(iv) {
    console.log(`[IvParameterSpec] IV (hex): ${bytesToHex(iv)}`);
    this.$init(iv);
  };

  // Cipher.init (모드 확인)
  const Cipher = Java.use('javax.crypto.Cipher');
  Cipher.init.overload('int', 'java.security.Key').implementation = function(mode, key) {
    const modes = { 1: 'ENCRYPT', 2: 'DECRYPT', 3: 'WRAP', 4: 'UNWRAP' };
    console.log(`[Cipher.init] ${modes[mode] || mode} / ${this.getAlgorithm()}`);
    this.init(mode, key);
  };
});

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}
```

#### SSL Pinning 우회 (종합)

```javascript
Java.perform(() => {
  // 1. TrustManager 우회
  const X509TrustManager = Java.use('javax.net.ssl.X509TrustManager');
  const SSLContext = Java.use('javax.net.ssl.SSLContext');

  const EmptyTrustManager = Java.registerClass({
    name: 'com.frida.EmptyTrustManager',
    implements: [X509TrustManager],
    methods: {
      checkClientTrusted(chain, authType) {},
      checkServerTrusted(chain, authType) {},
      getAcceptedIssuers() {
        return [];
      }
    }
  });

  const trustManagers = Java.array('javax.net.ssl.TrustManager', [EmptyTrustManager.$new()]);
  const sslContext = SSLContext.getInstance('TLS');
  sslContext.init(null, trustManagers, null);

  // 2. OkHttp CertificatePinner 우회
  try {
    const CertificatePinner = Java.use('okhttp3.CertificatePinner');
    CertificatePinner.check.overload('java.lang.String', 'java.util.List').implementation = function() {
      console.log('[SSL] CertificatePinner.check 우회');
    };
  } catch (e) {}

  // 3. WebView SSL 오류 무시
  try {
    const WebViewClient = Java.use('android.webkit.WebViewClient');
    WebViewClient.onReceivedSslError.implementation = function(view, handler, error) {
      console.log('[SSL] WebView SSL 오류 무시');
      handler.proceed();
    };
  } catch (e) {}

  console.log('[SSL Pinning] 우회 완료');
});
```

#### 파일 I/O 모니터링

```javascript
Java.perform(() => {
  const File = Java.use('java.io.File');
  const FileInputStream = Java.use('java.io.FileInputStream');
  const FileOutputStream = Java.use('java.io.FileOutputStream');

  // 파일 존재 확인 감시
  File.exists.implementation = function() {
    const path = this.getAbsolutePath();
    const result = this.exists();
    // 루팅 관련 경로만 로깅
    if (path.includes('su') || path.includes('magisk') || path.includes('superuser')) {
      console.log(`[File.exists] ${path} → ${result}`);
    }
    return result;
  };

  // 파일 읽기 감시
  FileInputStream.$init.overload('java.io.File').implementation = function(file) {
    console.log(`[읽기] ${file.getAbsolutePath()}`);
    this.$init(file);
  };

  // 파일 쓰기 감시
  FileOutputStream.$init.overload('java.io.File').implementation = function(file) {
    console.log(`[쓰기] ${file.getAbsolutePath()}`);
    this.$init(file);
  };
});
```

#### 클래스의 모든 메서드 자동 후킹

```javascript
Java.perform(() => {
  const targetClassName = 'com.example.SensitiveApi';
  const target = Java.use(targetClassName);
  const methods = target.class.getDeclaredMethods();

  methods.forEach(method => {
    const methodName = method.getName();
    const overloads = target[methodName]?.overloads;

    if (!overloads) return;

    overloads.forEach(overload => {
      overload.implementation = function(...args) {
        const argStr = args.map(a => `${a}`).join(', ');
        console.log(`[${targetClassName}] ${methodName}(${argStr})`);

        try {
          const result = this[methodName](...args);
          console.log(`  → ${result}`);
          return result;
        } catch (e) {
          console.log(`  → 예외: ${e.message}`);
          throw e;
        }
      };
    });
  });

  console.log(`[자동 후킹] ${methods.length}개 메서드 후킹 완료`);
});
```

---

### 1.10 주의사항 및 트러블슈팅

#### 필수 규칙

| 규칙 | 설명 |
|------|------|
| `Java.perform()` 필수 | 모든 Java API는 반드시 `Java.perform()` 블록 안에서 호출해야 한다. 밖에서 호출하면 크래시 발생 |
| 클래스 로더 인식 | `Java.use()`는 기본 클래스 로더에 로드된 클래스만 접근 가능. 커스텀 로더의 클래스는 `Java.enumerateClassLoaders()`로 찾아야 함 |
| 오버로드 명시 | 동일 이름의 메서드가 여러 개이면 `overload()`로 시그니처를 명시해야 함. 그렇지 않으면 `Error: more than one overload matching` |
| 원본 호출 | 후킹에서 원본 메서드를 호출하지 않으면 앱이 비정상 동작할 수 있음. `this.methodName(args)`로 반드시 호출 |
| 스레드 안전성 | Java 객체를 다른 스레드에서 사용하려면 `Java.retain()`으로 보호해야 함 |
| 내부 클래스 | `$` 구분자 사용 (예: `com.example.Outer$Inner`). 익명 클래스는 `$1`, `$2` 등의 번호로 접근 |
| ProGuard/R8 난독화 | 난독화된 앱은 원본 클래스명 대신 난독화된 이름(예: `a.b.c`)을 사용해야 함 |

#### 일반적인 오류와 해결법

**`Error: java.lang.ClassNotFoundException`**

```javascript
// 문제: 클래스를 찾을 수 없음
// 원인: 커스텀 클래스 로더, 동적 로드, DEX 분할 등
// 해결:
Java.perform(() => {
  Java.enumerateClassLoaders({
    onMatch(loader) {
      try {
        const factory = Java.ClassFactory.get(loader);
        factory.use('com.target.HiddenClass');
        console.log(`발견: ${loader}`);
        Java.classFactory.loader = loader;
        return 'stop';
      } catch (e) {}
    },
    onComplete() {}
  });
});
```

**`Error: expected a pointer` (타이밍 문제)**

```javascript
// 문제: 클래스가 아직 로드되지 않은 시점에서 접근
// 해결: ClassLoader.loadClass를 후킹하여 타겟 클래스 로드 시점 감지
Java.perform(() => {
  const ClassLoader = Java.use('java.lang.ClassLoader');
  ClassLoader.loadClass.overload('java.lang.String').implementation = function(name) {
    const cls = this.loadClass(name);
    if (name === 'com.target.LateLoadedClass') {
      console.log('타겟 클래스 로드 감지!');
      Java.performNow(() => {
        const target = Java.use('com.target.LateLoadedClass');
        target.init.implementation = function() {
          console.log('후킹 성공!');
          this.init();
        };
      });
    }
    return cls;
  };
});
```

**`Error: more than one overload matching`**

```javascript
// 문제: 오버로드가 여러 개인 메서드를 overload() 없이 후킹
// 해결: 정확한 시그니처 지정
Java.perform(() => {
  const Cls = Java.use('com.example.MyClass');

  // 오버로드 목록 확인
  const overloads = Cls.method.overloads;
  overloads.forEach((ol, i) => {
    console.log(`오버로드 #${i}: ${ol.argumentTypes.map(t => t.className).join(', ')}`);
  });

  // 정확한 시그니처로 후킹
  Cls.method.overload('java.lang.String', 'int').implementation = function(s, n) {
    return this.method(s, n);
  };
});
```

**후킹이 동작하지 않는 경우 (인라인 최적화)**

```javascript
// 해결: 디옵티마이즈 적용
Java.perform(() => {
  // 방법 1: 부트 이미지만 (시스템 API 후킹 시, 영향 작음)
  Java.deoptimizeBootImage();

  // 방법 2: 전체 디옵티마이즈 (느리지만 확실)
  Java.deoptimizeEverything();

  // 이후 후킹 수행
});
```

#### Frida 버전별 주의점

| 버전 | 변경사항 |
|------|----------|
| **Frida 17.0+** | Java bridge가 별도 패키지로 분리. `frida-compile` 사용 시 `import { Java } from 'frida-java-bridge'` 필요 |
| **Android 14+** | 일부 시스템 API 접근 제한 강화. `Java.deoptimizeEverything()` 동작 변경 가능 |
| **Android 16+** | deoptimize/backtrace 메커니즘 변경 (Frida 17.4.0+에서 대응) |

---

## 2. ObjC API (iOS/macOS)

Objective-C 런타임을 통해 iOS/macOS 앱의 클래스, 메서드, 인스턴스를 동적으로 조작하기 위한 API.
ObjC 런타임의 메시지 디스패치 메커니즘을 활용하여 메서드 스위즐링, 인스턴스 탐색 등을 수행한다.

---

### 2.1 프로퍼티

| 프로퍼티 | 타입 | 설명 |
|----------|------|------|
| `ObjC.available` | `boolean` | Objective-C 런타임이 현재 프로세스에 로드되어 있는지 여부 |
| `ObjC.api` | `object` | 저수준 ObjC 런타임 함수 접근 (`objc_msgSend`, `class_getName` 등) |
| `ObjC.classes` | `{ [className]: ObjC.Object }` | 모든 등록된 클래스에 대한 매핑 객체. 클래스명을 키로 접근 |
| `ObjC.protocols` | `{ [protocolName]: ObjC.Protocol }` | 모든 프로토콜에 대한 매핑 객체 |
| `ObjC.mainQueue` | `NativePointer` | GCD 메인 디스패치 큐 (dispatch_queue_t). UI 작업에 사용 |

```javascript
if (ObjC.available) {
  console.log('ObjC 런타임 사용 가능');

  // 클래스 직접 접근
  const NSString = ObjC.classes.NSString;
  const NSURL = ObjC.classes.NSURL;

  // 클래스 존재 확인
  if ('AFHTTPSessionManager' in ObjC.classes) {
    console.log('AFNetworking 사용 중');
  }

  // 모든 클래스 개수 (주의: 수만 개)
  const allClasses = Object.keys(ObjC.classes);
  console.log(`총 ${allClasses.length}개 클래스 로드됨`);

  // 특정 접두어로 필터링
  const appClasses = allClasses.filter(c => c.startsWith('MyApp'));
  appClasses.forEach(c => console.log(`  ${c}`));
} else {
  console.log('ObjC 런타임 없음 — 비-Apple 환경');
}
```

> **참고**: Swift 앱이라도 Foundation 프레임워크를 사용하면 ObjC 런타임이 로드된다. 대부분의 iOS/macOS 앱에서 `ObjC.available`은 `true`이다.

**프로토콜 접근:**

```javascript
if (ObjC.available) {
  const NSCoding = ObjC.protocols.NSCoding;
  console.log('NSCoding 메서드:');

  // 프로토콜의 메서드 목록
  const methods = NSCoding.methods;
  for (const sel in methods) {
    const m = methods[sel];
    console.log(`  ${sel} (required: ${m.required})`);
  }

  // 보안 관련 프로토콜 검색
  const securityProtocols = Object.keys(ObjC.protocols)
    .filter(p => p.toLowerCase().includes('security') || p.toLowerCase().includes('ssl'));
  console.log('보안 관련 프로토콜:', securityProtocols);
}
```

**메인 큐에서 코드 실행:**

```javascript
if (ObjC.available) {
  ObjC.schedule(ObjC.mainQueue, () => {
    console.log('메인 스레드에서 실행 중');
    // UI 관련 작업
  });
}
```

---

### 2.2 ObjC.Object

ObjC 객체/클래스의 JavaScript 래퍼. 메서드 호출, 프로퍼티 접근, 타입 정보 조회 등을 제공한다.

#### 핵심 속성

| 속성 | 타입 | 설명 |
|------|------|------|
| `$className` | `string` | 클래스 이름 |
| `$kind` | `string` | `'instance'`, `'class'`, `'meta-class'` 중 하나 |
| `$super` | `ObjC.Object` | 슈퍼클래스 래퍼 |
| `$methods` | `string[]` | 모든 메서드 목록 (상속 포함) |
| `$ownMethods` | `string[]` | 자체 정의 메서드만 |
| `$ivars` | `object` | 인스턴스 변수 (이름 → 값 매핑) |
| `handle` | `NativePointer` | 네이티브 포인터 |

```javascript
if (ObjC.available) {
  const NSString = ObjC.classes.NSString;

  // 클래스 정보
  console.log(`이름: ${NSString.$className}`);  // NSString
  console.log(`종류: ${NSString.$kind}`);        // class
  console.log(`슈퍼: ${NSString.$super.$className}`);  // NSObject

  // 자체 정의 메서드 목록 (처음 20개)
  console.log('\nNSString 고유 메서드 (처음 20개):');
  NSString.$ownMethods.slice(0, 20).forEach(m => console.log(`  ${m}`));
}
```

#### 메서드 호출 규칙

ObjC 셀렉터의 콜론(`:`)은 언더스코어(`_`)로 변환된다.

| ObjC Selector | JavaScript 호출 |
|---------------|-----------------|
| `length` | `.length()` |
| `substringFromIndex:` | `.substringFromIndex_(index)` |
| `substringWithRange:` | `.substringWithRange_(range)` |
| `initWithString:` | `.initWithString_(str)` |
| `initWithFormat:arguments:` | `.initWithFormat_arguments_(fmt, args)` |
| `dataWithContentsOfURL:options:error:` | `.dataWithContentsOfURL_options_error_(url, opts, err)` |

```javascript
if (ObjC.available) {
  // 인스턴스 생성 및 메서드 호출
  const NSString = ObjC.classes.NSString;
  const str = NSString.stringWithString_('Hello, ObjC!');
  console.log(`문자열: ${str.toString()}`);
  console.log(`길이: ${str.length()}`);
  console.log(`대문자: ${str.uppercaseString().toString()}`);

  // NSURL 예시
  const NSURL = ObjC.classes.NSURL;
  const url = NSURL.URLWithString_('https://example.com/path?q=test');
  console.log(`Host: ${url.host().toString()}`);
  console.log(`Path: ${url.path().toString()}`);
  console.log(`Query: ${url.query().toString()}`);

  // NSMutableArray 조작
  const arr = ObjC.classes.NSMutableArray.array();
  arr.addObject_('item1');
  arr.addObject_('item2');
  arr.addObject_('item3');
  console.log(`배열 크기: ${arr.count()}`);
  console.log(`첫 번째: ${arr.objectAtIndex_(0)}`);
}
```

#### 인스턴스 변수 ($ivars) 접근

```javascript
if (ObjC.available) {
  ObjC.choose(ObjC.classes.UIViewController, {
    onMatch(instance) {
      console.log(`\nViewController: ${instance.$className}`);

      // 모든 ivar 출력
      const ivars = instance.$ivars;
      for (const name in ivars) {
        console.log(`  ${name} = ${ivars[name]}`);
      }
      return 'stop';
    },
    onComplete() {}
  });
}
```

---

### 2.3 메서드 후킹

ObjC 메서드 후킹은 `Interceptor.attach`를 `implementation` 포인터에 적용하거나, `implementation`을 직접 교체하는 방식으로 수행한다.

#### Interceptor.attach 방식 (권장)

```javascript
if (ObjC.available) {
  // NSURLSession 요청 감시
  const NSURLSession = ObjC.classes.NSURLSession;
  const dataTask = NSURLSession['- dataTaskWithRequest:completionHandler:'];

  Interceptor.attach(dataTask.implementation, {
    onEnter(args) {
      // args[0] = self, args[1] = _cmd, args[2] = NSURLRequest, args[3] = block
      const request = new ObjC.Object(args[2]);
      const url = request.URL();
      console.log(`\n[NSURLSession] ${request.HTTPMethod()} ${url.absoluteString()}`);

      // 헤더 출력
      const headers = request.allHTTPHeaderFields();
      if (headers) {
        const enumerator = headers.keyEnumerator();
        let key;
        while ((key = enumerator.nextObject()) !== null) {
          console.log(`  ${key}: ${headers.objectForKey_(key)}`);
        }
      }

      // 바디 출력
      const body = request.HTTPBody();
      if (body) {
        const bodyStr = ObjC.classes.NSString.alloc()
          .initWithData_encoding_(body, 4);  // NSUTF8StringEncoding = 4
        console.log(`  Body: ${bodyStr}`);
      }
    },
    onLeave(retval) {
      // retval = NSURLSessionDataTask
    }
  });
}
```

> **args 인덱스 규칙**: `Interceptor.attach` 콜백에서 `args[0]` = self(수신자), `args[1]` = _cmd(셀렉터), `args[2]`부터 실제 인자이다.

#### implementation 교체 방식

```javascript
if (ObjC.available) {
  const UIAlertController = ObjC.classes.UIAlertController;
  const originalImpl = UIAlertController['+ alertControllerWithTitle:message:preferredStyle:'].implementation;

  UIAlertController['+ alertControllerWithTitle:message:preferredStyle:'].implementation =
    ObjC.implement(UIAlertController['+ alertControllerWithTitle:message:preferredStyle:'], function(handle, selector, title, message, style) {
      const titleStr = title ? new ObjC.Object(title).toString() : '(nil)';
      const msgStr = message ? new ObjC.Object(message).toString() : '(nil)';
      console.log(`[Alert] 제목: ${titleStr}`);
      console.log(`[Alert] 메시지: ${msgStr}`);

      // 원본 호출
      return originalImpl(handle, selector, title, message, style);
    });
}
```

#### 인스턴스/클래스 메서드 구분

```javascript
if (ObjC.available) {
  const NSFileManager = ObjC.classes.NSFileManager;

  // 인스턴스 메서드: '-' 접두어
  const fileExists = NSFileManager['- fileExistsAtPath:'];
  Interceptor.attach(fileExists.implementation, {
    onEnter(args) {
      const path = new ObjC.Object(args[2]).toString();
      console.log(`[FileManager] 존재 확인: ${path}`);
    },
    onLeave(retval) {
      console.log(`  → ${retval.toInt32() !== 0}`);
    }
  });

  // 클래스 메서드: '+' 접두어
  const defaultManager = NSFileManager['+ defaultManager'];
  Interceptor.attach(defaultManager.implementation, {
    onEnter(args) {
      console.log('[FileManager] defaultManager 호출');
    }
  });
}
```

#### UserDefaults 감시

```javascript
if (ObjC.available) {
  const NSUserDefaults = ObjC.classes.NSUserDefaults;

  // 값 저장 감시
  const setMethods = [
    '- setObject:forKey:',
    '- setBool:forKey:',
    '- setInteger:forKey:',
    '- setFloat:forKey:',
    '- setDouble:forKey:',
  ];

  setMethods.forEach(methodName => {
    try {
      const method = NSUserDefaults[methodName];
      Interceptor.attach(method.implementation, {
        onEnter(args) {
          const key = new ObjC.Object(args[3]).toString();
          if (methodName.includes('Object')) {
            const value = new ObjC.Object(args[2]);
            console.log(`[UserDefaults] set ${key} = ${value}`);
          } else if (methodName.includes('Bool')) {
            console.log(`[UserDefaults] set ${key} = ${args[2].toInt32() !== 0}`);
          } else {
            console.log(`[UserDefaults] set ${key} = ${args[2]}`);
          }
        }
      });
    } catch (e) {}
  });

  // 값 읽기 감시
  Interceptor.attach(NSUserDefaults['- objectForKey:'].implementation, {
    onEnter(args) {
      this.key = new ObjC.Object(args[2]).toString();
    },
    onLeave(retval) {
      if (!retval.isNull()) {
        const value = new ObjC.Object(retval);
        console.log(`[UserDefaults] get ${this.key} → ${value}`);
      }
    }
  });
}
```

#### Keychain 접근 감시

```javascript
if (ObjC.available) {
  // Security.framework의 C 함수 후킹
  const SecItemAdd = Module.findExportByName('Security', 'SecItemAdd');
  const SecItemCopyMatching = Module.findExportByName('Security', 'SecItemCopyMatching');

  if (SecItemAdd) {
    Interceptor.attach(SecItemAdd, {
      onEnter(args) {
        const query = new ObjC.Object(args[0]);
        console.log(`\n[Keychain] SecItemAdd:`);
        console.log(`  ${query.toString()}`);
      },
      onLeave(retval) {
        console.log(`  결과: ${retval} (0=성공)`);
      }
    });
  }

  if (SecItemCopyMatching) {
    Interceptor.attach(SecItemCopyMatching, {
      onEnter(args) {
        const query = new ObjC.Object(args[0]);
        console.log(`\n[Keychain] SecItemCopyMatching:`);
        console.log(`  ${query.toString()}`);
        this.resultPtr = args[1];
      },
      onLeave(retval) {
        if (retval.toInt32() === 0 && !this.resultPtr.isNull()) {
          const result = new ObjC.Object(this.resultPtr.readPointer());
          console.log(`  결과: ${result.toString()}`);
        }
      }
    });
  }
}
```

---

### 2.4 클래스 열거

#### ObjC.enumerateLoadedClasses([options,] callbacks)

로드된 ObjC 클래스를 비동기로 열거한다.

| 항목 | 값 |
|------|-----|
| **options.ownedBy** | `Module` — 특정 모듈의 클래스만 열거 (선택) |
| **callbacks.onMatch** | `(name: string, owner: string) => void` — 클래스 발견 시 호출. `owner`는 정의 모듈 경로 |
| **callbacks.onComplete** | `() => void` — 열거 완료 시 호출 |

```javascript
if (ObjC.available) {
  // 기본 열거
  ObjC.enumerateLoadedClasses({
    onMatch(name, owner) {
      if (name.startsWith('MyApp')) {
        console.log(`${name} (from: ${owner})`);
      }
    },
    onComplete() {
      console.log('열거 완료');
    }
  });
}
```

```javascript
// 특정 모듈의 클래스만 열거 (앱 바이너리만)
if (ObjC.available) {
  const mainModule = Process.enumerateModules()[0];  // 메인 바이너리

  ObjC.enumerateLoadedClasses({ ownedBy: mainModule }, {
    onMatch(name) {
      console.log(`[앱 클래스] ${name}`);
    },
    onComplete() {
      console.log('앱 클래스 열거 완료');
    }
  });
}
```

#### ObjC.enumerateLoadedClassesSync([options])

동기 버전. 모듈 경로별로 그룹화된 딕셔너리를 반환한다.

```javascript
if (ObjC.available) {
  // 전체 동기 열거
  const classesByModule = ObjC.enumerateLoadedClassesSync();

  for (const modulePath in classesByModule) {
    const classes = classesByModule[modulePath];
    if (modulePath.includes('MyApp')) {
      console.log(`\n${modulePath}:`);
      classes.forEach(c => console.log(`  ${c}`));
    }
  }

  // 특정 모듈만
  const mainModule = Process.enumerateModules()[0];
  const appClasses = ObjC.enumerateLoadedClassesSync({ ownedBy: mainModule });
  console.log(`앱 클래스 수: ${Object.values(appClasses).flat().length}`);
}
```

---

### 2.5 인스턴스 탐색

#### ObjC.choose(specifier, callbacks)

ObjC 힙을 스캔하여 지정된 클래스의 살아있는 인스턴스를 찾는다.

| 항목 | 값 |
|------|-----|
| **매개변수** | `specifier: ObjC.Object` — 클래스 객체, `callbacks: { onMatch, onComplete }` |
| **callbacks.onMatch** | `(instance: ObjC.Object) => void | 'stop'` — 인스턴스 발견 시 호출 |
| **callbacks.onComplete** | `() => void` — 탐색 완료 시 호출 |

```javascript
if (ObjC.available) {
  // UIViewController 인스턴스 찾기
  ObjC.choose(ObjC.classes.UIViewController, {
    onMatch(instance) {
      console.log(`VC: ${instance.$className}`);
      console.log(`  제목: ${instance.title() || '(없음)'}`);
      console.log(`  표시 중: ${instance.isViewLoaded() && instance.view().window() !== null}`);
    },
    onComplete() {
      console.log('ViewController 스캔 완료');
    }
  });
}
```

```javascript
// WKWebView에서 URL 및 쿠키 추출
if (ObjC.available) {
  ObjC.choose(ObjC.classes.WKWebView, {
    onMatch(webview) {
      console.log('\nWKWebView 발견:');
      const url = webview.URL();
      if (url) {
        console.log(`  URL: ${url.absoluteString()}`);
      }
      console.log(`  로딩 중: ${webview.isLoading()}`);
      console.log(`  제목: ${webview.title()}`);

      // JavaScript 실행으로 쿠키 추출
      const js = ObjC.classes.NSString.stringWithString_('document.cookie');
      webview.evaluateJavaScript_completionHandler_(js, new ObjC.Block({
        retType: 'void',
        argTypes: ['object', 'object'],
        implementation(result, error) {
          if (result) {
            console.log(`  쿠키: ${new ObjC.Object(result)}`);
          }
        }
      }));
    },
    onComplete() {}
  });
}
```

#### ObjC.chooseSync(specifier)

동기 버전. `ObjC.Object[]`를 반환한다.

```javascript
if (ObjC.available) {
  const viewControllers = ObjC.chooseSync(ObjC.classes.UIViewController);
  console.log(`UIViewController 인스턴스 ${viewControllers.length}개 발견`);

  viewControllers.forEach(vc => {
    console.log(`  ${vc.$className}: ${vc.title() || '(제목 없음)'}`);
  });
}
```

---

### 2.6 클래스 등록

#### ObjC.registerClass(spec)

런타임에 새로운 ObjC 클래스를 생성한다.

| 항목 | 값 |
|------|-----|
| **spec.name** | `string` — 클래스 이름 |
| **spec.super** | `ObjC.Object` — 슈퍼클래스 (기본: `NSObject`) |
| **spec.protocols** | `ObjC.Protocol[]` — 구현할 프로토콜 배열 |
| **spec.methods** | `object` — 메서드 구현. 키는 `'- instanceMethod:'` 또는 `'+ classMethod:'` 형식 |

```javascript
if (ObjC.available) {
  // NSURLSessionDelegate 구현
  const MySessionDelegate = ObjC.registerClass({
    name: 'MySessionDelegate',
    super: ObjC.classes.NSObject,
    protocols: [ObjC.protocols.NSURLSessionDelegate],
    methods: {
      // 인스턴스 메서드
      '- URLSession:didReceiveChallenge:completionHandler:': function(session, challenge, handler) {
        console.log('[SSL] 인증서 챌린지 수신');

        const dominated = challenge.protectionSpace().authenticationMethod().toString();
        console.log(`  인증 방식: ${dominated}`);

        const credential = ObjC.classes.NSURLCredential
          .credentialForTrust_(challenge.protectionSpace().serverTrust());

        // completionHandler 호출 (Block)
        const completionHandler = new ObjC.Block(handler);
        completionHandler.implementation(0, credential);  // 0 = UseCredential
      },

      // 클래스 메서드
      '+ sharedInstance': function() {
        const instance = this.alloc().init();
        return instance;
      }
    }
  });

  console.log(`등록됨: ${MySessionDelegate.$className}`);
}
```

**UIApplicationDelegate 커스텀 구현:**

```javascript
if (ObjC.available) {
  const MyAppDelegate = ObjC.registerClass({
    name: 'FridaAppDelegate',
    super: ObjC.classes.NSObject,
    protocols: [ObjC.protocols.UIApplicationDelegate],
    methods: {
      '- application:didFinishLaunchingWithOptions:': function(app, options) {
        console.log('[AppDelegate] 앱 시작 완료');
        return true;
      },
      '- applicationDidBecomeActive:': function(app) {
        console.log('[AppDelegate] 앱 활성화');
      },
      '- applicationWillResignActive:': function(app) {
        console.log('[AppDelegate] 앱 비활성화 예정');
      },
      '- application:openURL:options:': function(app, url, options) {
        const urlStr = new ObjC.Object(url).absoluteString().toString();
        console.log(`[AppDelegate] URL 스킴: ${urlStr}`);
        return true;
      }
    }
  });
}
```

#### ObjC.registerProtocol(spec)

새 프로토콜을 정의한다.

```javascript
if (ObjC.available) {
  const MyProtocol = ObjC.registerProtocol({
    name: 'MyCustomProtocol',
    methods: {
      '- handleEvent:': {
        retType: 'void',
        argTypes: ['object'],
        required: true
      },
      '- optionalMethod': {
        retType: 'bool',
        argTypes: [],
        required: false
      }
    }
  });
}
```

---

### 2.7 ObjC.Block

ObjC Block(클로저)을 생성하거나 기존 Block을 래핑한다.

#### Block 생성

```javascript
if (ObjC.available) {
  // 완료 핸들러 Block 생성
  const completionBlock = new ObjC.Block({
    retType: 'void',
    argTypes: ['object', 'object'],  // (NSData, NSError)
    implementation(data, error) {
      if (error) {
        const err = new ObjC.Object(error);
        console.log(`에러: ${err.localizedDescription()}`);
      } else if (data) {
        const d = new ObjC.Object(data);
        console.log(`데이터 수신: ${d.length()} 바이트`);
      }
    }
  });
}
```

**Block의 타입 문자열:**

| 타입 | 문자열 |
|------|--------|
| `void` | `'void'` |
| `BOOL` | `'bool'` |
| `int` / `NSInteger` | `'int'` / `'long'` |
| `float` / `double` | `'float'` / `'double'` |
| `id` (ObjC 객체) | `'object'` |
| `SEL` | `'selector'` |
| `char *` | `'pointer'` |
| `void *` | `'pointer'` |

#### 기존 Block 가로채기

```javascript
if (ObjC.available) {
  const NSURLSession = ObjC.classes.NSURLSession;

  Interceptor.attach(
    NSURLSession['- dataTaskWithURL:completionHandler:'].implementation,
    {
      onEnter(args) {
        const url = new ObjC.Object(args[2]);
        console.log(`[URL] ${url.absoluteString()}`);

        // 원본 Block 래핑
        const origBlock = new ObjC.Block(args[3]);
        const origImpl = origBlock.implementation;

        // Block 교체 — 응답을 가로채기
        origBlock.implementation = function(data, response, error) {
          if (response) {
            const resp = new ObjC.Object(response);
            console.log(`  상태: ${resp.statusCode()}`);
          }
          if (data) {
            const d = new ObjC.Object(data);
            const bodyStr = ObjC.classes.NSString.alloc()
              .initWithData_encoding_(d, 4);
            console.log(`  응답: ${bodyStr ? bodyStr.toString().substring(0, 200) : '(바이너리)'}`);
          }
          // 원본 Block 호출
          origImpl(data, response, error);
        };
      }
    }
  );
}
```

#### Block 시그니처 확인

```javascript
if (ObjC.available) {
  function inspectBlock(blockPtr) {
    const block = new ObjC.Block(blockPtr);
    console.log(`Block 주소: ${blockPtr}`);
    console.log(`  반환 타입: ${block.types}`);
    console.log(`  구현 주소: ${block.implementation}`);
  }
}
```

---

### 2.8 프록시 등록

`ObjC.registerProxy()`로 기존 객체의 프록시를 생성한다. 프록시는 원본 객체에 대한 메시지를 가로채거나 전달한다.

```javascript
if (ObjC.available) {
  const proxy = ObjC.registerProxy({
    protocols: [ObjC.protocols.NSURLSessionDataDelegate],
    methods: {
      '- URLSession:dataTask:didReceiveData:': function(session, task, data) {
        const d = new ObjC.Object(data);
        console.log(`[Proxy] 데이터 수신: ${d.length()} 바이트`);
        // 원본 delegate로 전달
        if (this.target) {
          this.target.URLSession_dataTask_didReceiveData_(session, task, data);
        }
      },
      '- URLSession:task:didCompleteWithError:': function(session, task, error) {
        if (error) {
          console.log(`[Proxy] 완료 (에러): ${new ObjC.Object(error).localizedDescription()}`);
        } else {
          console.log('[Proxy] 완료 (성공)');
        }
      }
    },
    events: {
      forward(name) {
        // 처리하지 않은 셀렉터를 원본 대상에 전달
        console.log(`[Proxy] 포워딩: ${name}`);
      }
    }
  });
}
```

---

### 2.9 바인딩

`ObjC.bind`/`ObjC.unbind`/`ObjC.getBoundData`로 ObjC 객체에 커스텀 JavaScript 데이터를 연결한다.

```javascript
if (ObjC.available) {
  // 객체에 메타데이터 바인딩
  ObjC.choose(ObjC.classes.UIViewController, {
    onMatch(instance) {
      ObjC.bind(instance, {
        hookTime: Date.now(),
        className: instance.$className,
        customTag: 'monitored'
      });
      console.log(`바인딩 완료: ${instance.$className}`);
    },
    onComplete() {}
  });

  // 나중에 바인딩된 데이터 조회
  ObjC.choose(ObjC.classes.UIViewController, {
    onMatch(instance) {
      const data = ObjC.getBoundData(instance);
      if (data) {
        console.log(`\n${data.className}:`);
        console.log(`  후킹 시간: ${new Date(data.hookTime).toISOString()}`);
        console.log(`  태그: ${data.customTag}`);
      }
    },
    onComplete() {}
  });

  // 바인딩 해제
  // ObjC.unbind(instance);
}
```

---

### 2.10 Selector 유틸리티

#### ObjC.selector(name)

문자열에서 ObjC 셀렉터(SEL)를 생성한다. `NativePointer`를 반환한다.

```javascript
if (ObjC.available) {
  const sel = ObjC.selector('viewDidLoad');
  console.log(`SEL 포인터: ${sel}`);

  // respondsToSelector 확인
  ObjC.choose(ObjC.classes.UIViewController, {
    onMatch(instance) {
      const responds = instance.respondsToSelector_(ObjC.selector('customMethod'));
      console.log(`${instance.$className} customMethod 응답: ${responds}`);
      return 'stop';
    },
    onComplete() {}
  });
}
```

#### ObjC.selectorAsString(sel)

SEL 포인터를 문자열로 변환한다.

```javascript
if (ObjC.available) {
  const sel = ObjC.selector('initWithFrame:');
  const name = ObjC.selectorAsString(sel);
  console.log(`셀렉터: ${name}`);  // "initWithFrame:"
}
```

---

### 2.11 ApiResolver 활용

`ApiResolver('objc')`로 ObjC 메서드를 패턴 매칭으로 검색한다. 와일드카드(`*`)를 사용할 수 있다.

```javascript
if (ObjC.available) {
  const resolver = new ApiResolver('objc');

  // 특정 클래스의 모든 메서드
  console.log('\n=== NSURLSession 메서드 ===');
  resolver.enumerateMatches('-[NSURLSession *]').forEach(match => {
    console.log(`  ${match.name} @ ${match.address}`);
  });

  // HTTP 관련 메서드 검색
  console.log('\n=== HTTP 관련 메서드 ===');
  resolver.enumerateMatches('-[NSURL* *HTTP*]').forEach(match => {
    console.log(`  ${match.name}`);
  });

  // 클래스 메서드 검색
  console.log('\n=== NSJSONSerialization 클래스 메서드 ===');
  resolver.enumerateMatches('+[NSJSONSerialization *]').forEach(match => {
    console.log(`  ${match.name}`);
  });

  // 와일드카드로 암호화 관련 검색
  console.log('\n=== 암호화 관련 ===');
  resolver.enumerateMatches('-[*Crypto* *]').forEach(match => {
    console.log(`  ${match.name}`);
  });
}
```

**ApiResolver를 이용한 동적 후킹:**

```javascript
if (ObjC.available) {
  const resolver = new ApiResolver('objc');

  // 특정 패턴의 모든 메서드를 자동 후킹
  const pattern = '-[*ViewController viewDidLoad]';
  const matches = resolver.enumerateMatches(pattern);

  console.log(`${matches.length}개 매칭 발견`);
  matches.forEach(match => {
    Interceptor.attach(match.address, {
      onEnter(args) {
        const self = new ObjC.Object(args[0]);
        console.log(`[viewDidLoad] ${self.$className}`);
      }
    });
  });
}
```

```javascript
// 모든 네트워크 관련 delegate 메서드 자동 후킹
if (ObjC.available) {
  const resolver = new ApiResolver('objc');
  const patterns = [
    '-[*Delegate *connection*:*]',
    '-[*Delegate *session*:*task*:*]',
    '-[*Delegate *download*:*]',
  ];

  patterns.forEach(pattern => {
    const matches = resolver.enumerateMatches(pattern);
    matches.forEach(match => {
      try {
        Interceptor.attach(match.address, {
          onEnter(args) {
            console.log(`[Network] ${match.name}`);
          }
        });
      } catch (e) {
        // 이미 후킹된 경우 등
      }
    });
  });
}
```

---

### 2.12 실전 레시피

#### iOS 탈옥 탐지 우회

```javascript
if (ObjC.available) {
  // 1. 파일 존재 확인 우회
  const NSFileManager = ObjC.classes.NSFileManager;
  Interceptor.attach(NSFileManager['- fileExistsAtPath:'].implementation, {
    onEnter(args) {
      this.path = new ObjC.Object(args[2]).toString();
    },
    onLeave(retval) {
      const jailbreakPaths = [
        '/Applications/Cydia.app',
        '/Library/MobileSubstrate',
        '/bin/bash',
        '/usr/sbin/sshd',
        '/etc/apt',
        '/private/var/lib/apt',
        '/usr/bin/ssh',
      ];
      if (jailbreakPaths.some(p => this.path.includes(p))) {
        console.log(`[탈옥 우회] fileExists 차단: ${this.path}`);
        retval.replace(0);  // false
      }
    }
  });

  // 2. canOpenURL 우회 (cydia:// 스킴)
  const UIApplication = ObjC.classes.UIApplication;
  Interceptor.attach(UIApplication['- canOpenURL:'].implementation, {
    onEnter(args) {
      this.url = new ObjC.Object(args[2]).absoluteString().toString();
    },
    onLeave(retval) {
      if (this.url.includes('cydia://') || this.url.includes('sileo://')) {
        console.log(`[탈옥 우회] canOpenURL 차단: ${this.url}`);
        retval.replace(0);
      }
    }
  });

  // 3. fork() 감지 우회
  const forkPtr = Module.findExportByName(null, 'fork');
  if (forkPtr) {
    Interceptor.attach(forkPtr, {
      onLeave(retval) {
        console.log('[탈옥 우회] fork() → -1');
        retval.replace(-1);
      }
    });
  }

  console.log('[탈옥 탐지] 우회 설치 완료');
}
```

#### SSL Pinning 우회 (iOS)

```javascript
if (ObjC.available) {
  // 1. NSURLSession delegate 우회
  const resolver = new ApiResolver('objc');
  const challengeMatches = resolver.enumerateMatches(
    '-[* URLSession:didReceiveChallenge:completionHandler:]'
  );

  challengeMatches.forEach(match => {
    Interceptor.attach(match.address, {
      onEnter(args) {
        console.log(`[SSL] 챌린지 가로채기: ${match.name}`);

        const challenge = new ObjC.Object(args[4]);
        const completionHandler = new ObjC.Block(args[5]);
        const credential = ObjC.classes.NSURLCredential
          .credentialForTrust_(challenge.protectionSpace().serverTrust());

        // UseCredential(0)으로 수락
        completionHandler.implementation(0, credential);

        // 원본 delegate 호출 방지
        this.skipOriginal = true;
      }
    });
  });

  // 2. SecTrustEvaluate 우회
  const SecTrustEvaluateWithError = Module.findExportByName(
    'Security', 'SecTrustEvaluateWithError'
  );
  if (SecTrustEvaluateWithError) {
    Interceptor.attach(SecTrustEvaluateWithError, {
      onLeave(retval) {
        console.log('[SSL] SecTrustEvaluateWithError → true');
        retval.replace(1);
      }
    });
  }

  // 3. AFNetworking (있는 경우)
  if ('AFSecurityPolicy' in ObjC.classes) {
    const AFSecurityPolicy = ObjC.classes.AFSecurityPolicy;
    Interceptor.attach(
      AFSecurityPolicy['- evaluateServerTrust:forDomain:'].implementation,
      {
        onLeave(retval) {
          console.log('[SSL] AFSecurityPolicy 우회');
          retval.replace(1);
        }
      }
    );
  }

  console.log('[SSL Pinning] 우회 설치 완료');
}
```

#### UI 계층 덤프

```javascript
if (ObjC.available) {
  function dumpViewHierarchy() {
    ObjC.schedule(ObjC.mainQueue, () => {
      const app = ObjC.classes.UIApplication.sharedApplication();
      const keyWindow = app.keyWindow();

      if (!keyWindow) {
        console.log('keyWindow 없음');
        return;
      }

      function printView(view, depth) {
        const indent = '  '.repeat(depth);
        const cls = view.$className;
        const hidden = view.isHidden();

        let info = `${indent}${cls}`;
        if (hidden) info += ' [HIDDEN]';

        // 텍스트가 있는 뷰
        if (view.respondsToSelector_(ObjC.selector('text'))) {
          try {
            const text = view.text();
            if (text) info += ` "${text.toString().substring(0, 50)}"`;
          } catch (e) {}
        }

        // 이미지가 있는 뷰
        if (view.respondsToSelector_(ObjC.selector('image'))) {
          try {
            const img = view.image();
            if (img) info += ` [image: ${img.size().width}x${img.size().height}]`;
          } catch (e) {}
        }

        console.log(info);

        // 하위 뷰 순회
        const subviews = view.subviews();
        for (let i = 0; i < subviews.count(); i++) {
          printView(subviews.objectAtIndex_(i), depth + 1);
        }
      }

      console.log('\n=== View Hierarchy ===');
      printView(keyWindow, 0);
    });
  }

  dumpViewHierarchy();
}
```

#### 클립보드 모니터링

```javascript
if (ObjC.available) {
  const UIPasteboard = ObjC.classes.UIPasteboard;

  // 복사 감시
  Interceptor.attach(UIPasteboard['- setString:'].implementation, {
    onEnter(args) {
      const text = new ObjC.Object(args[2]).toString();
      console.log(`[클립보드 복사] ${text}`);
    }
  });

  // 붙여넣기 감시
  Interceptor.attach(UIPasteboard['- string'].implementation, {
    onLeave(retval) {
      if (!retval.isNull()) {
        const text = new ObjC.Object(retval).toString();
        console.log(`[클립보드 읽기] ${text}`);
      }
    }
  });

  // 이미지 복사 감시
  Interceptor.attach(UIPasteboard['- setImage:'].implementation, {
    onEnter(args) {
      if (!args[2].isNull()) {
        const img = new ObjC.Object(args[2]);
        console.log(`[클립보드 이미지 복사] ${img.size().width}x${img.size().height}`);
      }
    }
  });
}
```

#### 위치 정보 스푸핑

```javascript
if (ObjC.available) {
  const CLLocation = ObjC.classes.CLLocation;

  // 가짜 위치 (서울 시청)
  const fakeLatitude = 37.5665;
  const fakeLongitude = 126.9780;

  // delegate의 didUpdateLocations 가로채기
  const resolver = new ApiResolver('objc');
  const matches = resolver.enumerateMatches(
    '-[*Delegate locationManager:didUpdateLocations:]'
  );

  matches.forEach(match => {
    Interceptor.attach(match.address, {
      onEnter(args) {
        const locations = new ObjC.Object(args[3]);
        console.log(`[위치] 원본 위치 ${locations.count()}개 → 스푸핑`);

        const fakeLocation = CLLocation.alloc()
          .initWithLatitude_longitude_(fakeLatitude, fakeLongitude);
        const fakeArray = ObjC.classes.NSArray.arrayWithObject_(fakeLocation);
        args[3] = fakeArray.handle;
      }
    });
  });

  console.log(`[위치 스푸핑] ${fakeLatitude}, ${fakeLongitude} (서울 시청)`);
}
```

#### 클래스의 모든 메서드 자동 후킹

```javascript
if (ObjC.available) {
  function traceClass(className) {
    const cls = ObjC.classes[className];
    if (!cls) {
      console.log(`클래스 ${className} 없음`);
      return;
    }

    const methods = cls.$ownMethods;
    console.log(`[Trace] ${className}: ${methods.length}개 메서드`);

    methods.forEach(methodName => {
      try {
        const method = cls[methodName];
        if (!method || !method.implementation) return;

        Interceptor.attach(method.implementation, {
          onEnter(args) {
            console.log(`[${className}] ${methodName}`);

            // 인자 출력 (최대 5개)
            const argCount = methodName.split(':').length - 1;
            for (let i = 0; i < Math.min(argCount, 5); i++) {
              try {
                const arg = new ObjC.Object(args[2 + i]);
                console.log(`  arg${i}: ${arg.toString().substring(0, 100)}`);
              } catch (e) {
                console.log(`  arg${i}: ${args[2 + i]}`);
              }
            }
          },
          onLeave(retval) {
            if (!retval.isNull()) {
              try {
                const ret = new ObjC.Object(retval);
                console.log(`  → ${ret.toString().substring(0, 100)}`);
              } catch (e) {
                console.log(`  → ${retval}`);
              }
            }
          }
        });
      } catch (e) {
        // 일부 메서드는 후킹 불가
      }
    });
  }

  // 사용 예시
  traceClass('MyAppViewController');
  traceClass('MyAppNetworkManager');
}
```

---

### 2.13 주의사항 및 트러블슈팅

#### 필수 규칙

| 규칙 | 설명 |
|------|------|
| 플랫폼 제한 | `ObjC` API는 macOS/iOS에서만 사용 가능. Linux/Android/Windows에서는 `ObjC.available === false` |
| 셀렉터 변환 | ObjC 메서드명의 콜론(`:`)은 언더스코어(`_`)로 변환해야 함. `initWithString:` → `.initWithString_()` |
| Block 타입 명시 | `ObjC.Block` 생성 시 `retType`과 `argTypes`를 정확히 명시해야 함. 잘못된 타입은 크래시 유발 |
| args 인덱스 | `Interceptor.attach` 콜백의 `args[0]` = self, `args[1]` = _cmd, `args[2]`부터 실제 인자 |
| 힙 스캔 성능 | `ObjC.choose`는 힙 전체를 스캔하므로 느릴 수 있음. 대상 클래스를 최대한 구체적으로 지정 |
| 메인 스레드 | UI 관련 작업은 반드시 `ObjC.schedule(ObjC.mainQueue, fn)`으로 메인 스레드에서 실행 |
| ARC 관리 | ObjC 런타임은 ARC가 메모리를 관리하므로 Java처럼 `retain()` 호출이 필요 없음 |

#### 일반적인 오류와 해결법

**`Error: -[ClassName methodName]: unrecognized selector sent to instance`**

```javascript
// 문제: 존재하지 않는 메서드 호출
// 해결: 메서드 존재 여부 확인 후 호출
if (ObjC.available) {
  ObjC.choose(ObjC.classes.UIViewController, {
    onMatch(instance) {
      // respondsToSelector로 확인
      if (instance.respondsToSelector_(ObjC.selector('customMethod'))) {
        instance.customMethod();
      }

      // 또는 $ownMethods에서 검색
      const hasMethod = instance.$ownMethods.includes('- customMethod');
      console.log(`customMethod 존재: ${hasMethod}`);
    },
    onComplete() {}
  });
}
```

**`Error: access violation reading from address`**

```javascript
// 문제: 해제된 객체나 잘못된 포인터 접근
// 해결: null 체크 철저히
if (ObjC.available) {
  Interceptor.attach(someMethod.implementation, {
    onEnter(args) {
      // 항상 null 체크
      if (args[2].isNull()) {
        console.log('인자가 nil');
        return;
      }

      try {
        const obj = new ObjC.Object(args[2]);
        console.log(obj.toString());
      } catch (e) {
        console.log(`객체 접근 실패: ${e.message}`);
      }
    }
  });
}
```

**Swift 클래스 후킹 시 이름 맹글링**

```javascript
// Swift 클래스는 맹글링된 이름을 사용
if (ObjC.available) {
  // Swift 클래스 이름 패턴: _TtC{모듈길이}{모듈명}{클래스길이}{클래스명}
  // 예: _TtC5MyApp14ViewController

  // 방법 1: ObjC.classes에서 직접 검색
  const swiftClasses = Object.keys(ObjC.classes).filter(c => c.startsWith('_Tt'));
  swiftClasses.forEach(c => console.log(`Swift 클래스: ${c}`));

  // 방법 2: ApiResolver로 검색
  const resolver = new ApiResolver('objc');
  const matches = resolver.enumerateMatches('-[_TtC5MyApp* *]');
  matches.forEach(m => console.log(m.name));

  // 방법 3: 디맹글링된 이름으로 접근 시도
  // ObjC.classes['MyApp.ViewController']
}
```

#### Frida 버전별 주의점

| 버전 | 변경사항 |
|------|----------|
| **Frida 17.0+** | ObjC bridge가 별도 패키지로 분리. `frida-compile` 사용 시 `import { ObjC } from 'frida-objc-bridge'` 필요 |
| **iOS 17+** | 일부 시스템 프레임워크 보호 강화. Interceptor 대신 Stalker가 필요한 경우 있음 |

---

## 3. 플랫폼 판별 및 공통 패턴

런타임 환경에 따라 적절한 API를 선택하는 패턴.

```javascript
// CARF 에이전트에서 플랫폼 판별 후 초기화
function initBridges() {
  if (Java.available) {
    Java.perform(() => {
      console.log(`[Android ${Java.androidVersion}] Java 브릿지 초기화`);
      // Android 전용 초기화
      hookAndroidApis();
    });
  }

  if (ObjC.available) {
    console.log('[iOS/macOS] ObjC 브릿지 초기화');
    // iOS/macOS 전용 초기화
    hookAppleApis();
  }

  // Native는 모든 플랫폼에서 항상 사용 가능
  console.log(`[Native] ${Process.platform} / ${Process.arch}`);
  hookNativeApis();
}
```

```javascript
// 플랫폼별 네트워크 모니터링 통합 예제
function monitorNetwork() {
  if (Java.available) {
    Java.perform(() => {
      try {
        const OkHttp = Java.use('okhttp3.internal.connection.RealCall');
        OkHttp.execute.implementation = function() {
          const req = this.request();
          console.log(`[Android/OkHttp] ${req.method()} ${req.url()}`);
          return this.execute();
        };
      } catch (e) {}

      const URL = Java.use('java.net.URL');
      URL.openConnection.overload().implementation = function() {
        console.log(`[Android/URLConnection] ${this.toString()}`);
        return this.openConnection();
      };
    });
  }

  if (ObjC.available) {
    const NSURLSession = ObjC.classes.NSURLSession;
    Interceptor.attach(
      NSURLSession['- dataTaskWithRequest:completionHandler:'].implementation,
      {
        onEnter(args) {
          const request = new ObjC.Object(args[2]);
          console.log(`[iOS/NSURLSession] ${request.HTTPMethod()} ${request.URL().absoluteString()}`);
        }
      }
    );
  }
}
```

```javascript
// 플랫폼별 암호화 키 추출 통합 예제
function monitorCrypto() {
  if (Java.available) {
    Java.perform(() => {
      const SecretKeySpec = Java.use('javax.crypto.spec.SecretKeySpec');
      SecretKeySpec.$init.overload('[B', 'java.lang.String').implementation = function(key, algo) {
        console.log(`[Android] SecretKeySpec: ${algo} / ${bytesToHex(key)}`);
        this.$init(key, algo);
      };
    });
  }

  // CommonCrypto (iOS/macOS)
  const CCCrypt = Module.findExportByName('libcommonCrypto.dylib', 'CCCrypt');
  if (CCCrypt) {
    Interceptor.attach(CCCrypt, {
      onEnter(args) {
        const op = args[0].toInt32();  // 0=encrypt, 1=decrypt
        const alg = args[1].toInt32(); // 0=AES, 1=DES, ...
        const keyLen = args[4].toInt32();
        const key = args[3].readByteArray(keyLen);
        console.log(`[iOS] CCCrypt: op=${op === 0 ? 'ENC' : 'DEC'} alg=${alg} key=${bytesToHex(new Uint8Array(key))}`);
      }
    });
  }
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}
```

---

## 4. Java vs ObjC 비교 요약

| 기능 | Java (Android) | ObjC (iOS/macOS) |
|------|---------------|-----------------|
| **가용성** | `Java.available` | `ObjC.available` |
| **클래스 접근** | `Java.use('className')` | `ObjC.classes.ClassName` |
| **인스턴스 탐색** | `Java.choose(className, cb)` | `ObjC.choose(specifier, cb)` |
| **메서드 후킹** | `.implementation = fn` | `Interceptor.attach(impl, cb)` |
| **클래스 등록** | `Java.registerClass({...})` | `ObjC.registerClass({...})` |
| **VM 컨텍스트** | `Java.perform()` **필수** | 필요 없음 (직접 호출) |
| **메서드 오버로드** | `.overload('int', 'String')` | 셀렉터가 고유하므로 불필요 |
| **GC 보호** | `Java.retain(obj)` | 필요 없음 (ARC) |
| **클래스 열거** | `enumerateLoadedClasses` | `enumerateLoadedClasses` |
| **디옵티마이즈** | `deoptimizeEverything()` | 해당 없음 |
| **Block/클로저** | 해당 없음 | `ObjC.Block` |
| **셀렉터** | 해당 없음 | `ObjC.selector()` |
| **패턴 검색** | `enumerateLoadedClassesSync` + filter | `ApiResolver('objc')` |
| **후킹 해제** | `implementation = null` | `Interceptor.revert(target)` |
| **클래스 로더** | `enumerateClassLoaders` | 해당 없음 (단일 런타임) |
| **스레드 안전** | `Java.perform()`이 보장 | `ObjC.schedule(mainQueue, fn)` |
