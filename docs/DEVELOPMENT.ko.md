# CARF 개발 가이드

이 문서는 CARF 개발 환경 설정 및 개발 가이드를 제공합니다.

[English](DEVELOPMENT.md)

## 개발 환경 설정

### 필수 요구사항

1. **Node.js / Bun**
   ```bash
   # Bun 설치 (권장)
   curl -fsSL https://bun.sh/install | bash

   # 또는 npm/pnpm 사용 가능
   ```

2. **Rust**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup update stable
   ```

3. **Tauri CLI**
   ```bash
   cargo install tauri-cli
   ```

4. **Frida (선택사항 - 에이전트 컴파일용)**
   ```bash
   npm install -g frida-compile
   ```

### 프로젝트 설정

```bash
# 저장소 클론
git clone https://github.com/eunhhu/carf.git
cd carf

# 의존성 설치
bun install

# Rust 의존성 (자동으로 처리됨)
cd src-tauri && cargo build
```

## 개발 모드

### 브라우저 전용 모드 (UI 개발)

Tauri 없이 브라우저에서만 실행합니다. Frida 기능은 비활성화되지만 UI 개발에 적합합니다.

```bash
bun run dev
# http://localhost:1420 에서 확인
```

이 모드에서:
- Tauri API 호출은 graceful하게 실패
- Frida 버전: "N/A (Browser)"로 표시
- 모든 UI 기능 테스트 가능

### Tauri 개발 모드 (전체 기능)

```bash
bun run tauri dev
```

이 모드에서:
- 전체 Frida 기능 사용 가능
- Hot reload 지원
- DevTools 사용 가능 (F12)

### Frida 에이전트 개발

에이전트 코드 수정 시:

```bash
# 에이전트 컴파일 (watch 모드 아님)
bun run compile:tools

# 또는 개발 서버 실행 시 자동 컴파일
bun run dev
```

## 프로젝트 구조

```
carf/
├── src/                    # React 프론트엔드
├── src-frida/              # Frida Agent
├── src-tauri/              # Tauri Backend (Rust)
├── docs/                   # 문서
├── public/                 # 정적 파일
└── scripts/                # 빌드 스크립트
```

## 코드 스타일

### TypeScript/React

- **Formatter**: Prettier (설정 없음, 기본값)
- **Linter**: 없음 (추후 ESLint 추가 예정)
- **Import 순서**:
  1. React imports
  2. Third-party libraries
  3. Local components
  4. Local hooks/stores
  5. Types
  6. Styles

```typescript
// 예시
import { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { Search } from 'lucide-react';

import { Button } from '../ui/Button';
import { useLibraryStore } from '../../stores/libraryStore';
import type { LibraryEntry } from '../../stores/libraryStore';
import { theme } from '../../styles';
```

### Rust

- **Formatter**: `cargo fmt`
- **Linter**: `cargo clippy`

```bash
# 포맷팅
cd src-tauri && cargo fmt

# 린트
cd src-tauri && cargo clippy
```

## 컴포넌트 작성 가이드

### UI 컴포넌트

```typescript
// src/components/ui/Button.tsx
import styled from '@emotion/styled';
import { theme } from '../../styles';

// Props 타입 정의
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

// Styled component
const StyledButton = styled.button<{ $variant: string; $size: string }>`
  // styles...
`;

// 컴포넌트
export function Button({
  variant = 'primary',
  size = 'md',
  disabled,
  onClick,
  children,
}: ButtonProps) {
  return (
    <StyledButton
      $variant={variant}
      $size={size}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </StyledButton>
  );
}
```

### 페이지 컴포넌트

```typescript
// src/pages/example/index.tsx
import { useState, useCallback } from 'react';
import { PageContainer, PageHeader, PageTitle, PageContent } from '../../components/ui/Layout';
import { useFridaStore } from '../../features/frida';

export interface ExamplePageProps {
  // props...
}

export function ExamplePage({ ...props }: ExamplePageProps) {
  // State
  const [data, setData] = useState<Data[]>([]);

  // Store
  const { agentRequest } = useFridaStore();

  // Handlers
  const handleRefresh = useCallback(async () => {
    const result = await agentRequest('example.method');
    setData(result);
  }, [agentRequest]);

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>Example</PageTitle>
      </PageHeader>
      <PageContent>
        {/* Content */}
      </PageContent>
    </PageContainer>
  );
}
```

### Zustand 스토어

```typescript
// src/stores/exampleStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ExampleState {
  value: string;
  items: Item[];
}

interface ExampleActions {
  setValue: (value: string) => void;
  addItem: (item: Item) => void;
  reset: () => void;
}

const initialState: ExampleState = {
  value: '',
  items: [],
};

export const useExampleStore = create<ExampleState & ExampleActions>()(
  persist(
    (set) => ({
      ...initialState,

      setValue: (value) => set({ value }),

      addItem: (item) => set((state) => ({
        items: [...state.items, item],
      })),

      reset: () => set(initialState),
    }),
    {
      name: 'carf-example', // localStorage key
    }
  )
);
```

## Frida Agent 개발

### 새 RPC 메소드 추가

1. **메소드 파일 생성/수정**

```typescript
// src-frida/methods/example.ts
export const exampleMethods = {
  'example.getData': () => {
    // Frida API 사용
    return {
      timestamp: Date.now(),
      data: 'example',
    };
  },

  'example.process': (params: { input: string }) => {
    // params 사용
    return params.input.toUpperCase();
  },
};
```

2. **Router에 등록**

```typescript
// src-frida/methods/index.ts
import { exampleMethods } from './example';

export const allMethods = {
  ...nativeMethods,
  ...memoryMethods,
  ...exampleMethods,  // 추가
};
```

3. **Frontend에서 호출**

```typescript
// 페이지에서 사용
const result = await agentRequest('example.getData');
const processed = await agentRequest('example.process', { input: 'hello' });
```

### 에이전트 디버깅

```typescript
// 에이전트 내에서 로깅
console.log('Debug:', data);  // CARF Console에 표시됨

// send()로 이벤트 전송
send({
  type: 'carf:event',
  payload: {
    event: 'example.event',
    data: 'something happened',
  },
});
```

## 테스트

### 수동 테스트

1. **브라우저 모드**: UI 기능 테스트
2. **Tauri 모드**: 전체 기능 테스트
3. **타겟 프로세스**: 실제 앱에 연결하여 테스트

### 자동 테스트 (TODO)

```bash
# 현재 테스트 없음 - 추가 예정
bun test
```

## 빌드

### 개발 빌드

```bash
# Frontend만
bun run build

# Tauri 앱 (Debug)
bun run tauri build --debug
```

### 프로덕션 빌드

```bash
# Tauri 앱 (Release)
bun run tauri build
```

빌드 결과물 위치:
- macOS: `src-tauri/target/release/bundle/dmg/`
- Windows: `src-tauri/target/release/bundle/msi/`
- Linux: `src-tauri/target/release/bundle/deb/`

## 트러블슈팅

### 일반적인 문제

1. **Tauri 빌드 실패**
   ```bash
   # Rust 업데이트
   rustup update stable

   # 의존성 정리
   cd src-tauri && cargo clean && cargo build
   ```

2. **Frida 에이전트 컴파일 실패**
   ```bash
   # frida-compile 재설치
   npm install -g frida-compile

   # TypeScript 타입 설치
   bun add -D @types/frida-gum
   ```

3. **브라우저에서 Tauri API 에러**
   - 정상 동작입니다. 브라우저 모드에서는 Tauri API가 비활성화됩니다.
   - 콘솔에 경고만 표시되고 앱은 정상 작동합니다.

4. **Hot Reload 작동 안 함**
   ```bash
   # Vite 캐시 삭제
   rm -rf node_modules/.vite
   bun run dev
   ```

### 디버깅

1. **Frontend 디버깅**
   - 브라우저 DevTools (F12)
   - React DevTools 확장

2. **Backend 디버깅**
   ```bash
   # Rust 로그 활성화
   RUST_LOG=debug bun run tauri dev
   ```

3. **Agent 디버깅**
   - console.log() → CARF Console에 표시
   - Frida CLI로 직접 테스트: `frida -p <pid> -l src-frida/dist/index.js`

## Git Workflow

### 브랜치 전략

- `main`: 안정 버전
- `feature/*`: 기능 개발
- `fix/*`: 버그 수정

### 커밋 메시지

```
<type>(<scope>): <description>

Types:
- feat: 새 기능
- fix: 버그 수정
- docs: 문서 변경
- style: 포맷팅
- refactor: 리팩토링
- test: 테스트
- chore: 빌드/도구

Example:
feat(memory): add memory scan feature
fix(ui): resolve panel resize issue
docs(readme): update installation guide
```

## 기여 가이드

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes
4. Test thoroughly
5. Commit: `git commit -m 'feat: add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open Pull Request

### PR 체크리스트

- [ ] 코드가 정상적으로 빌드됨
- [ ] 기존 기능이 깨지지 않음
- [ ] 새 기능에 대한 문서 추가 (필요시)
- [ ] 커밋 메시지가 규칙을 따름
