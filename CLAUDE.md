# CARF - Claude Code Instructions

This document defines rules and conventions that Claude Code should follow when working on the CARF project.

[한국어](CLAUDE.ko.md)

## Project Overview

CARF (Cross-platform Application Runtime Framework) is a Frida-based dynamic analysis GUI tool.

- **Frontend**: React 19, TypeScript, Zustand, Emotion
- **Backend**: Tauri 2, Rust
- **Agent**: TypeScript (frida-compile)

## Directory Structure

```
src/                    # React frontend
├── components/
│   ├── layout/        # Layout (Navbar, Sidebar, StatusBar)
│   ├── panels/        # Panels (LibraryPanel)
│   └── ui/            # Common UI (Button, Input, Tabs, etc.)
├── contexts/          # React Context (ThemeContext)
├── features/frida/    # Frida integration module
├── hooks/             # Custom Hooks
├── pages/             # Page components
├── stores/            # Zustand stores
└── styles/            # Theme and styles

src-frida/             # Frida Agent
├── methods/           # RPC method implementations
└── rpc/               # RPC router

src-tauri/src/         # Tauri Backend (Rust)
├── commands/          # Tauri commands
└── services/          # Service layer
```

## Code Style

### TypeScript/React

1. Use **functional components** (no class components)
2. Prefer **named exports** (`export function Component`)
3. **Props types** use `interface ComponentProps` format
4. **Styled components** use transient props (`$variant`, `$size`)

```typescript
// Good example
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

### Import Order

1. React imports (`import { useState } from 'react'`)
2. Third-party libraries
3. Local components
4. Local hooks/stores
5. Types
6. Styles/theme

### Zustand Stores

- Stores are located in `stores/` directory
- Use `create` function
- Use `persist` middleware for persistence
- LocalStorage keys use `carf-` prefix

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

### Frida Integration

- Always check `isTauri()` when calling Tauri API
- Provide graceful fallback for browser environment
- Use `agentRequest(method, params)` for Agent RPC

```typescript
// Browser environment check
const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window;

// Tauri invoke wrapper
async function safeInvoke<T>(cmd: string, args?: unknown, fallback?: T): Promise<T> {
  if (!isTauri()) {
    console.warn(`Tauri invoke '${cmd}' called outside Tauri environment`);
    return fallback as T;
  }
  return await invoke<T>(cmd, args);
}
```

## Theme

- Theme is defined in `src/styles/theme.ts`
- Supports Dark/Light modes
- Use `theme.colors.*` for colors
- Use `theme.spacing.*` for spacing

```typescript
// Theme usage example
const StyledDiv = styled.div`
  background: ${theme.colors.bg.primary};
  padding: ${theme.spacing.md};
  border-radius: ${theme.borderRadius.md};
`;
```

## Component Patterns

### Page Components

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

### Resizable Panels

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

## Prohibited

1. **No `any` type** - Use explicit types or `unknown`
2. **No `var`** - Use `const`/`let`
3. **No class components** - Use functional components
4. **Minimize inline styles** - Use Emotion styled
5. **No console.log in production code**

## Testing

Currently no automated tests. Manual testing:

```bash
# Browser mode (UI testing)
bun run dev

# Tauri mode (full feature testing)
bun run tauri dev
```

## Build Commands

```bash
bun install          # Install dependencies
bun run dev          # Dev server (browser)
bun run tauri dev    # Dev server (Tauri)
bun run build        # Production build
bun run compile:tools # Compile Frida agent
```

## Frequently Modified Files

- `src/App.tsx` - Main layout
- `src/features/frida/store.ts` - Frida state management
- `src/pages/*/index.tsx` - Page components
- `src/stores/*.ts` - State management
- `src-frida/methods/*.ts` - Agent RPC methods

## Documentation

- [README.md](README.md) - Project introduction
- [docs/API_SPECIFICATION.md](docs/API_SPECIFICATION.md) - API documentation
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Architecture
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Development guide
