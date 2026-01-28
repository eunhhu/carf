# CARF - Claude Code 지침서

이 문서는 CARF 프로젝트 작업 시 Claude Code가 따라야 할 규칙과 컨벤션을 정의합니다.

[English](CLAUDE.md)

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
│   └── ui/            # 공통 UI (Button, Input, Tabs 등)
├── contexts/          # React Context (ThemeContext)
├── features/frida/    # Frida 통합 모듈
├── hooks/             # Custom Hooks
├── pages/             # 페이지 컴포넌트
├── stores/            # Zustand 스토어
└── styles/            # 테마 및 스타일

src-frida/             # Frida 에이전트
├── methods/           # RPC 메소드 구현
└── rpc/               # RPC 라우터

src-tauri/src/         # Tauri 백엔드 (Rust)
├── commands/          # Tauri 커맨드
└── services/          # 서비스 레이어
```

## 코드 스타일

### TypeScript/React

1. **함수형 컴포넌트** 사용 (클래스 컴포넌트 사용 금지)
2. **Named exports** 선호 (`export function Component`)
3. **Props 타입**은 `interface ComponentProps` 형식 사용
4. **Styled components**는 transient props 사용 (`$variant`, `$size`)

```typescript
// 좋은 예시
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
2. 서드파티 라이브러리
3. 로컬 컴포넌트
4. 로컬 hooks/stores
5. 타입
6. 스타일/테마

### Zustand 스토어

- 스토어는 `stores/` 디렉토리에 위치
- `create` 함수 사용
- 영속성을 위해 `persist` 미들웨어 사용
- LocalStorage 키는 `carf-` 접두사 사용

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

- Tauri API 호출 시 항상 `isTauri()` 체크
- 브라우저 환경을 위한 graceful fallback 제공
- Agent RPC는 `agentRequest(method, params)` 사용

```typescript
// 브라우저 환경 체크
const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window;

// Tauri invoke 래퍼
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
// 테마 사용 예시
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
        {/* 콘텐츠 */}
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
    {/* 메인 콘텐츠 */}
  </Panel>
  <Separator />
  <Panel id="sidebar" minSize="250px" maxSize="500px">
    {/* 사이드바 */}
  </Panel>
</Group>
```

## 금지 사항

1. **`any` 타입 금지** - 명시적 타입 또는 `unknown` 사용
2. **`var` 금지** - `const`/`let` 사용
3. **클래스 컴포넌트 금지** - 함수형 컴포넌트 사용
4. **인라인 스타일 최소화** - Emotion styled 사용
5. **프로덕션 코드에 console.log 금지**

## 테스트

현재 자동화된 테스트 없음. 수동 테스트:

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

## 자주 수정하는 파일

- `src/App.tsx` - 메인 레이아웃
- `src/features/frida/store.ts` - Frida 상태 관리
- `src/pages/*/index.tsx` - 페이지 컴포넌트
- `src/stores/*.ts` - 상태 관리
- `src-frida/methods/*.ts` - Agent RPC 메소드

## 문서

- [README.ko.md](README.ko.md) - 프로젝트 소개
- [docs/API_SPECIFICATION.md](docs/API_SPECIFICATION.md) - API 문서
- [docs/ARCHITECTURE.ko.md](docs/ARCHITECTURE.ko.md) - 아키텍처
- [docs/DEVELOPMENT.ko.md](docs/DEVELOPMENT.ko.md) - 개발 가이드
