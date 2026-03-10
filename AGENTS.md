# CARF - Codex Instructions

## Project Overview

CARF (Cross-platform Application Runtime Framework) is a Frida-based dynamic analysis GUI tool. It provides a visual interface for runtime instrumentation of mobile and desktop applications.

Three-layer architecture:
1. **Frontend** (SolidJS) — UI, user interaction, state display
2. **Backend** (Rust/Tauri 2) — business logic, Frida/ADB integration, IPC
3. **Agent** (TypeScript/RustModule) — injected into target process, executes instrumentation

Communication: Frontend <-> Backend via Tauri IPC (`invoke`/`emit`), Backend <-> Agent via Frida RPC (`script.exports`/`send`).

## Directory Structure

```
src/                    # SolidJS frontend
├── components/
│   ├── ui/            # solid-ui based components
│   └── layout/        # Layout (Shell, Sidebar, Toolbar)
├── features/          # Feature modules (device, process, session, etc.)
├── lib/               # Utilities, Tauri IPC wrapper, types
└── styles/            # Global styles, Tailwind config

src-tauri/src/         # Tauri Backend (Rust)
├── commands/          # Tauri IPC command handlers (thin layer)
├── services/          # Business logic (frida, adb, script)
├── state/             # App state management
└── error.rs           # Unified error type

src-agent/src/         # CARF Std Script (Frida Agent)
├── rpc/               # RPC router and protocol
├── modules/           # Feature modules (memory, java, objc, native, etc.)
└── rust/              # RustModule source files (.rs)
```

## Code Style

### TypeScript/SolidJS

1. Functional components only (no class components)
2. Named exports (`export function Component`)
3. Props: `interface ComponentProps` format
4. Use solid-ui components from `~/components/ui/`
5. Tailwind CSS for styling (no inline styles, no CSS-in-JS)
6. SolidJS signals/stores for state (no external state library)

Import order:
1. solid-js imports
2. Third-party libraries
3. Components (`~/components/`)
4. Features (`~/features/`)
5. Lib/utils (`~/lib/`)
6. Types

### Rust

1. Commands: thin adapter only (no business logic, just IPC <-> Service bridge)
2. Services: all business logic here
3. Errors: use `AppError` enum with `thiserror`
4. Naming: `snake_case` functions, `PascalCase` types

### Agent (Frida Script)

1. Module pattern: each feature registers handlers via `registerHandler()`
2. RPC exports via `rpc.exports`
3. Performance-critical code in RustModule
4. Events via `send()` with typed protocol: `{ type, timestamp, data }`

## Build Commands

```bash
bun install          # Install dependencies
bun run dev          # Dev server (browser, UI only)
bun run tauri dev    # Full dev (Frontend + Backend)
bun run compile:agent # Compile Frida agent
bun run build        # Production frontend build
bun run tauri build  # Full production build
```

## Design System

- Carbon + Apple + OpenAI hybrid style
- solid-ui (shadcn/ui SolidJS port, Kobalte + corvu) for components
- Tailwind CSS v4 for utility styling
- HugeIcons for icons
- solid-motionone for animations
- Dark mode default, Light mode support
- Font: Inter (UI) + JetBrains Mono (code/data)

## Prohibited

1. No `any` type — use explicit types or `unknown`
2. No `var` — use `const`/`let`
3. No class components
4. No inline styles — use Tailwind classes
5. No `console.log` in production code
6. No business logic in command handlers (Rust)

## Tauri IPC

- Always check `IS_TAURI` before calling Tauri API
- Use `invoke()` wrapper from `~/lib/tauri.ts`
- Events use `carf://` prefix namespace (e.g., `carf://device/added`, `carf://session/detached`)

## Frida Integration

- Agent RPC calls go through Backend proxy: Frontend -> `invoke("rpc_call")` -> Backend -> `script.exports`
- CARF Std Script is always loaded on attach/spawn
- RustModule for Interceptor callbacks, Stalker callbacks, memory scanning
- Agent events: `send()` with `{ type, timestamp, data }` protocol

## Documentation

- [docs/PRD.md](docs/PRD.md) — Product requirements
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System architecture
- docs/API.md — API specification
- docs/DEVELOPMENT.md — Development guide
