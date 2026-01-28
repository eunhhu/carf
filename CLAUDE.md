# CARF - Claude Code Instructions

이 문서는 Claude Code가 CARF 프로젝트에서 작업할 때 따라야 할 규칙과 컨벤션을 정의합니다.

## 프로젝트 개요

CARF (Cross-platform Application Runtime Framework)는 Frida 기반 동적 분석 GUI 도구입니다.

- **Frontend**: React 19, TypeScript, Zustand, Emotion
- **Backend**: Tauri 2, Rust
- **Agent**: TypeScript (frida-compile)

## 디렉토리 구조

```
src/                    # React 프론트엔드
├── components/
│   ├── layout/        # 레이아웃 (Navbar, Sidebar, StatusBar)
│   ├── panels/        # 패널 (LibraryPanel)
│   └── ui/            # 공통 UI (Button, Input, Tabs, etc.)
├── contexts/          # React Context (ThemeContext)
├── features/frida/    # Frida 통합 모듈
├── hooks/             # Custom Hooks
├── pages/             # 페이지별 컴포넌트
├── stores/            # Zustand 스토어
└── styles/            # 테마 및 스타일

src-frida/             # Frida Agent
├── methods/           # RPC 메소드 구현
└── rpc/               # RPC 라우터

src-tauri/src/         # Tauri Backend (Rust)
├── commands/          # Tauri 커맨드
└── services/          # 서비스 레이어
```

## 코드 스타일

### TypeScript/React

1. **함수형 컴포넌트** 사용 (class 컴포넌트 금지)
2. **Named export** 선호 (`export function Component`)
3. **Props 타입**은 `interface ComponentProps` 형식
4. **Styled components**는 transient props 사용 (`$variant`, `$size`)

```typescript
// 좋은 예
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
}

export function Button({ variant = 'primary', onClick }: ButtonProps) {
  return <StyledButton $variant={variant} onClick={onClick} />;
}

const StyledButton = styled.button<{ $variant: string }>`
  // styles...
`;
```

### Import 순서

1. React imports (`import { useState } from 'react'`)
2. Third-party libraries
3. Local components
4. Local hooks/stores
5. Types
6. Styles/theme

### Zustand 스토어

- 스토어는 `stores/` 디렉토리에 위치
- `create` 함수 사용
- 영속성 필요시 `persist` 미들웨어 사용
- LocalStorage 키는 `carf-` 접두사

```typescript
export const useExampleStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      // state & actions
    }),
    { name: 'carf-example' }
  )
);
```

### Frida 통합

- Tauri API 호출 시 `isTauri()` 체크 필수
- 브라우저 환경에서 graceful fallback 제공
- Agent RPC는 `agentRequest(method, params)` 사용

```typescript
// 브라우저 환경 체크
const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window;

// Tauri 호출 래퍼
async function safeInvoke<T>(cmd: string, args?: unknown, fallback?: T): Promise<T> {
  if (!isTauri()) {
    console.warn(`Tauri invoke '${cmd}' called outside Tauri environment`);
    return fallback as T;
  }
  return await invoke<T>(cmd, args);
}
```

## 테마

- 테마는 `src/styles/theme.ts`에 정의
- Dark/Light 모드 지원
- 색상은 `theme.colors.*` 사용
- 간격은 `theme.spacing.*` 사용

```typescript
// 테마 사용 예
const StyledDiv = styled.div`
  background: ${theme.colors.bg.primary};
  padding: ${theme.spacing.md};
  border-radius: ${theme.borderRadius.md};
`;
```

## 컴포넌트 패턴

### 페이지 컴포넌트

```typescript
export function ExamplePage({ prop }: ExamplePageProps) {
  return (
    <PageContainer>
      <PageHeader>
        <Flex $align="center" $gap="12px">
          <Icon size={18} />
          <PageTitle>Title</PageTitle>
        </Flex>
        <PageActions>
          <IconButton icon={Refresh} onClick={handleRefresh} />
        </PageActions>
      </PageHeader>
      <PageContent>
        {/* Content */}
      </PageContent>
    </PageContainer>
  );
}
```

### 리사이즈 가능 패널

```typescript
import { Panel, Group, Separator } from 'react-resizable-panels';

<Group orientation="horizontal">
  <Panel id="main" minSize={50}>
    {/* Main content */}
  </Panel>
  <Separator />
  <Panel id="sidebar" minSize="250px" maxSize="500px">
    {/* Sidebar */}
  </Panel>
</Group>
```

## 금지 사항

1. **`any` 타입 사용 금지** - 명시적 타입 또는 `unknown` 사용
2. **`var` 사용 금지** - `const`/`let` 사용
3. **Class 컴포넌트 금지** - 함수형 컴포넌트 사용
4. **인라인 스타일 최소화** - Emotion styled 사용
5. **console.log 프로덕션 코드에 남기지 않기**

## 테스트

현재 자동 테스트가 없습니다. 수동 테스트:

```bash
# 브라우저 모드 (UI 테스트)
bun run dev

# Tauri 모드 (전체 기능 테스트)
bun run tauri dev
```

## 빌드 명령어

```bash
bun install          # 의존성 설치
bun run dev          # 개발 서버 (브라우저)
bun run tauri dev    # 개발 서버 (Tauri)
bun run build        # 프로덕션 빌드
bun run compile:tools # Frida 에이전트 컴파일
```

## 자주 수정되는 파일

- `src/App.tsx` - 메인 레이아웃
- `src/features/frida/store.ts` - Frida 상태 관리
- `src/pages/*/index.tsx` - 페이지 컴포넌트
- `src/stores/*.ts` - 상태 관리
- `src-frida/methods/*.ts` - Agent RPC 메소드

## 문서

- [README.md](README.md) - 프로젝트 소개
- [docs/API_SPECIFICATION.md](docs/API_SPECIFICATION.md) - API 문서
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - 아키텍처
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - 개발 가이드
