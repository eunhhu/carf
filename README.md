<div align="center">

# CARF

**Cross-platform Application Runtime Framework**

A modern, Frida-based dynamic analysis GUI built with SolidJS and Tauri 2.
CARF brings the full power of Frida's instrumentation engine into an intuitive desktop application,
enabling security researchers and developers to inspect, hook, and modify running applications across platforms.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri 2](https://img.shields.io/badge/Tauri-2.x-24C8D8?logo=tauri)](https://v2.tauri.app)
[![SolidJS](https://img.shields.io/badge/SolidJS-1.9+-4F88C6?logo=solid)](https://www.solidjs.com)
[![Frida](https://img.shields.io/badge/Frida-17.x-FF6633)](https://frida.re)

</div>

---

## Features

- **Multi-Device Support** -- Connect to local, USB, and remote devices seamlessly. Auto-detect USB devices and manage remote connections via IP:port.

- **Process Management** -- Enumerate running processes and installed applications. Spawn new processes or attach to existing ones with full control over Frida options (realm, runtime, child gating, and more).

- **ADB Integration** -- Manage Android devices end-to-end: push and start frida-server, WiFi pairing, app installation, and shell access -- all from the GUI.

- **Runtime Analysis** -- Explore and hook Java classes/methods, Objective-C selectors, and native functions. Browse loaded modules, exports, imports, and symbols.

- **Memory Inspection** -- Read, write, scan, and watch memory regions. Pattern-based scanning with RustModule acceleration for large memory ranges.

- **Code Tracing** -- Trace execution with Frida Interceptor and Stalker. Capture function arguments, return values, backtraces, and control flow.

- **High-Performance Callbacks** -- Offload hot paths to Frida RustModule for native-speed instrumentation with zero V8 overhead on Interceptor and Stalker callbacks.

- **Modern UI** -- A clean, information-dense interface inspired by Carbon, Apple HIG, and OpenAI design principles. Dark and light themes, keyboard navigation, and accessibility built in.

---

## Screenshots

> Coming soon.

---

## Quick Start

### Prerequisites

| Tool | Purpose |
|------|---------|
| [bun](https://bun.sh) | Package manager and JS runtime |
| [Rust toolchain](https://rustup.rs) | Backend compilation |
| [Tauri 2 CLI](https://v2.tauri.app/start/prerequisites/) | Desktop app bundling |
| [Frida tools](https://frida.re/docs/installation/) | frida-server for target devices |

### Installation

```bash
git clone https://github.com/user/carf.git
cd carf
bun install
```

### Run in Development

```bash
# Full desktop app (Frontend + Rust backend)
bun run tauri dev

# Frontend only (browser mode, limited functionality)
bun run dev
```

### Build for Production

```bash
bun run tauri build
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | SolidJS, solid-ui (Kobalte + corvu), Tailwind CSS v4, HugeIcons |
| Desktop Runtime | Tauri 2 (Rust) |
| Instrumentation | Frida 17.x, RustModule |
| Package Manager | bun |

---

## Architecture

CARF follows a **three-layer architecture**: Frontend, Backend, and Agent.

```
┌──────────────────────────────────────────┐
│              CARF Host                   │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │     Frontend (SolidJS + solid-ui)  │  │
│  │     Tailwind CSS + HugeIcons      │  │
│  └──────────────┬─────────────────────┘  │
│                 │ Tauri IPC              │
│  ┌──────────────▼─────────────────────┐  │
│  │     Backend (Rust / Tauri 2)       │  │
│  │     frida-rust + ADB service      │  │
│  └──────────────┬─────────────────────┘  │
│                 │ Frida Protocol          │
└─────────────────┼────────────────────────┘
                  │
    ┌─────────────▼──────────────────┐
    │    Target Device / Process     │
    │                                │
    │  ┌──────────────────────────┐  │
    │  │   CARF Std Script        │  │
    │  │   (JS + RustModule)      │  │
    │  └──────────────────────────┘  │
    └────────────────────────────────┘
```

- **Frontend** -- SolidJS SPA with signal-based state management. Communicates with the backend over Tauri IPC.
- **Backend** -- Rust service layer managing Frida DeviceManager, session lifecycle, ADB integration, and script loading.
- **Agent** -- TypeScript instrumentation script injected into the target process. Exposes RPC methods for the host and delegates performance-critical work to RustModule.

For the full architecture document, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Documentation

| Document | Description |
|----------|-------------|
| [PRD](docs/PRD.md) | Product requirements and roadmap |
| [Architecture](docs/ARCHITECTURE.md) | System architecture and data flow |

---

## Development

```bash
# Install dependencies
bun install

# Start development (full Tauri app)
bun run tauri dev

# Start development (browser only)
bun run dev

# Compile Frida agent script
bun run compile:agent

# Production build
bun run build
bun run tauri build
```

### Project Structure

```
carf/
├── src/                 # SolidJS frontend
│   ├── components/      #   UI components (solid-ui based)
│   ├── features/        #   Feature modules (device, process, session, ...)
│   ├── lib/             #   Utilities, Tauri IPC wrapper
│   └── styles/          #   Global styles, theme tokens
│
├── src-tauri/           # Tauri 2 backend (Rust)
│   └── src/
│       ├── commands/    #   IPC command handlers
│       ├── services/    #   Business logic (Frida, ADB)
│       └── state/       #   Application state
│
├── src-agent/           # Frida agent (TypeScript)
│   └── src/
│       ├── rpc/         #   RPC router
│       ├── modules/     #   Feature modules (memory, java, objc, native, ...)
│       └── rust/        #   RustModule sources (.rs)
│
└── docs/                # Documentation
```

---

## Supported Platforms

### Analysis Targets

| Platform | Architectures |
|----------|---------------|
| Android | ARM, ARM64, x86, x86_64 |
| iOS | ARM64 |
| macOS | ARM64, x86_64 |
| Linux | x86_64, ARM64 |
| Windows | x86, x86_64 |

### Host Platforms

| Platform | Status |
|----------|--------|
| macOS | Primary |
| Linux | Supported |
| Windows | Supported |

---

## Contributing

Contributions are welcome. Please read through the existing documentation before submitting changes:

1. Fork the repository and create a feature branch.
2. Follow the coding conventions described in [CLAUDE.md](CLAUDE.md).
3. Test your changes in both browser mode (`bun run dev`) and Tauri mode (`bun run tauri dev`).
4. Submit a pull request with a clear description of the change.

---

## License

This project is licensed under the [MIT License](LICENSE).
