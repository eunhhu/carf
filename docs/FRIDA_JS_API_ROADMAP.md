# FRIDA JavaScript API Roadmap for CARF

This document maps **Frida’s JavaScript API** to a concrete implementation plan for **CARF**.

- Focus: **Frida JS API feature coverage** + **CARF UX deliverables** (Agent RPC + UI TabPages + Zustand + safety).
- Non-goals: managing `frida-server` lifecycle automatically; CARF assumes the user manages their Frida environment.

## References

- Frida JavaScript API (main): https://frida.re/docs/javascript-api/
- Stalker deep-dive: https://frida.re/docs/stalker/
- Function hooking & calling tutorial: https://frida.re/docs/functions/

## CARF architecture recap (why this roadmap is structured this way)

CARF uses a 3-hop model:

1. **Frontend (React)** → **Backend (Tauri Rust)** via `invoke()` commands
2. **Backend (Rust)** → **Frontend** via Tauri events (`app.emit()`)
3. **Backend (Rust)** ↔ **Agent (Frida JS)** via `script.post()` / `send()`

Key docs in this repo:

- `docs/COMMUNICATION.md`: message formats and RPC protocol
- `docs/FRONTEND_STORE_GUIDE.md`: how to add features cleanly

## Conventions (must follow for all Frida JS API expansions)

### Naming

- **Agent RPC method name**: `snake_case` (already used across CARF)
- **Agent event type**: use `send({ type: 'carf:event', event: '...', ... })`

### RPC safety requirements

- **Timeout**: every request must have a timeout (already implemented in `agentRpc.ts`)
- **Pending cleanup**: pending requests must always be cleaned up (already implemented)
- **Error normalization**: agent error payloads must become a JS `Error` on the FE side (already implemented)

### UX requirements

- Each TabPage must be able to scale independently as features grow:
  - `src/pages/<tab>/` owns the UI composition
  - keep low-level reusable UI components under `src/components/common/`
- All long-running / high-volume streams must be controllable:
  - start/stop
  - rate limiting / sampling
  - explicit “clear buffer”

### Platform gating

Many APIs are platform / runtime dependent. All UI must expose availability clearly.

Examples:

- `ObjC` and `Java` bridges are external packages since Frida 17
  - `frida-objc-bridge`
  - `frida-java-bridge`
- `Module.enumerateSymbols()` is unavailable on some platforms
- `Kernel.*` is only available where kernel instrumentation is supported

## Current implementation snapshot (already done)

Agent methods currently available (see `src-frida/methods/index.ts`):

### Core

- `ping`
- `get_arch`, `get_process_info`

### Native / Modules

- `enumerate_modules`
- `enumerate_exports`
- `enumerate_imports`
- `enumerate_symbols`
- `find_module_by_address`

### Native / Function-level

- `find_export_by_name`, `get_export_by_name`
- `resolve_symbol`, `get_debug_symbol`, `get_function_by_address`
- NativeFunction registry:
  - `create_native_function`, `call_native_function`, `delete_native_function`, `list_native_functions`

### Native / Advanced

- `demangle_symbol`
- `disassemble` (Instruction.parse-based)
- `get_function_info`
- `call_function`
- `read_cstring`
- `get_module_exports_demangled`
- `enumerate_module_sections` (currently approximated via ranges)
- `find_pattern_in_module`
- `get_arch_info`

### Memory

- Basic: `read_memory`, `write_memory`, `search_memory`, `enumerate_ranges`, `allocate_memory`
- Advanced: `memory_protect`, `memory_query_protection`, `memory_alloc_*_string`, `memory_copy`, `memory_dup`, `read_pointer`, `write_pointer`, `read_int`, `write_int`, `read_string`, `write_string`, `memory_scan_sync`, `memory_patch_code`

### Thread

- `enumerate_threads`, `get_backtrace`, `get_current_thread_id`

### Instrumentation

- Interceptor: attach/detach/list/replace/revert/flush
- Stalker: follow/unfollow/flush/garbage_collect/get/set trust threshold/list/parse

### Frontend UI

- Native tab already has built-in advanced tabs (Modules/Disasm/Call/Hook/Info)
- Memory and Thread tabs functional
- TabPages migration done under `src/pages/*`

## Roadmap overview (milestones)

This roadmap is intentionally **feature-complete** relative to Frida’s JS API, but still prioritizes what matters for CARF.

- **M0 (Stability & Plumbing)**: event streaming, logging, rate limiting, persistence
- **M1 (Process/Thread/Module parity)**: observers, ranges, exception handling, module sections/deps
- **M2 (Memory parity)**: MemoryAccessMonitor, malloc ranges, safer patch flows
- **M3 (Native parity)**: NativeCallback/SystemFunction, ABI options, structured args/return editors
- **M4 (Instrumentation parity)**: Stalker advanced features (invalidate/call probes/exclude) + perf tooling
- **M5 (Runtime bridges)**: ObjC + Java (external bridges) + Swift resolver
- **M6 (IO/Network/DB)**: File/Streams, Socket, SqliteDatabase for caches
- **M7 (Advanced runtime)**: Worker, Cloak, Profiler/Samplers

Each milestone below contains:

- **Agent RPC deliverables** (method signatures)
- **FE TabPage deliverables** (UI sections)
- **State & storage** (Zustand + persistence)
- **Safety notes** (crash risk / platform gating)

---

# Milestone details

## M0 — Stability & Plumbing (P0)

### Goal
Make every future feature safe to ship by standardizing streaming, logging, and persistence.

### Agent
- Add a generic event channel utility:
  - `emit_event(event, payload)` → wrapper for `send({ type: 'carf:event', event, ...payload })`

### Frontend
- Console tab:
  - show `carf:event` stream
  - filter by `event` name
  - optional JSON view + copy
  - ring buffer + max size

### Backend
- none (already forwards script messages)

### Risks
- high-frequency send() is expensive → must batch or sample

Acceptance criteria:

- Can stream 100+ events/sec without freezing UI (using buffer + sampling)

---

## M1 — Process/Thread/Module parity (P0)

### Frida JS API scope
- `Process.*` (enumeration, observers, ranges, exception handler)
- `Thread.*` (HW breakpoints/watchpoints, backtrace helpers)
- `Module.*` (sections, dependencies, exports/symbols, ranges)
- `ModuleMap`

### Gaps vs current
- Missing:
  - `Process.attachThreadObserver()`
  - `Process.attachModuleObserver()`
  - `Process.enumerateRanges()` (full options like coalesce)
  - `Process.enumerateMallocRanges()`
  - `Process.setExceptionHandler()`
  - `Process.runOnThread()` (dangerous; must be opt-in)
  - `Module.enumerateSections()` / `enumerateDependencies()` / `enumerateRanges(protection)`
  - `Module.findSymbolByName()` / `getSymbolByName()`
  - `ModuleMap` utilities

### Agent RPC (planned)

#### Process
- `process_get_current_dir -> { path }`
- `process_get_home_dir -> { path }`
- `process_get_tmp_dir -> { path }`
- `process_is_debugger_attached -> { attached: boolean }`
- `process_enumerate_ranges -> { ranges: Range[] }`
  - params: `{ protection: string | { protection: string; coalesce?: boolean } }`
- `process_enumerate_malloc_ranges -> { ranges: Range[] }`
- `process_attach_thread_observer_start -> { observerId }`
- `process_attach_thread_observer_stop -> void`
  - event: `thread_added|thread_removed|thread_renamed`
- `process_attach_module_observer_start -> { observerId }`
- `process_attach_module_observer_stop -> void`
  - event: `module_added|module_removed`
- `process_set_exception_handler_start -> void`
- `process_set_exception_handler_stop -> void`
  - event: `native_exception`

#### Thread
- `thread_set_hw_breakpoint -> void`
- `thread_unset_hw_breakpoint -> void`
- `thread_set_hw_watchpoint -> void`
- `thread_unset_hw_watchpoint -> void`

#### Module
- `module_enumerate_sections -> Section[]`
- `module_enumerate_dependencies -> Dependency[]`
- `module_enumerate_ranges -> Range[]`
- `module_find_symbol_by_name -> { address: string | null }`
- `module_get_symbol_by_name -> { address: string }`

#### ModuleMap
- `module_map_create -> { id }`
- `module_map_update -> void`
- `module_map_find -> { module: Module | null }`
- `module_map_get_name -> { name: string }`

### FE deliverables
- `src/pages/thread/`:
  - “Observers” section (Start/Stop)
  - “Breakpoints & Watchpoints” section
  - “Exceptions” section (with event timeline)
- `src/pages/native/`:
  - “Module Dependencies” view
  - “Module Sections” view
  - Symbol search (symbol-by-name)
  - ModuleMap-backed address resolution to speed up repeated lookups

### Safety notes
- `Process.runOnThread()` is dangerous (non-reentrant risk). Treat as **P2 / explicit confirmation**.

---

## M2 — Memory parity (P0/P1)

### Frida JS API scope
- `Memory.*`
- `MemoryAccessMonitor.*`

### Gaps vs current
- Missing:
  - async `Memory.scan()` (only sync wrapper exists)
  - `MemoryAccessMonitor.enable/disable`
  - richer `NativePointer` read/write coverage (struct helpers, byte arrays, etc.)

### Agent RPC (planned)
- `memory_scan -> streams results via carf:event`
  - event: `memory_scan_match`, `memory_scan_progress`, `memory_scan_complete`
- `memory_access_monitor_enable -> void`
  - params: `{ ranges: { base: string; size: number }[]; }`
  - event: `memory_access`
- `memory_access_monitor_disable -> void`

### FE deliverables
- `src/pages/memory/`:
  - “Scan (async)” view:
    - start/stop
    - show progressive matches
    - export results to Library tab later
  - “Access Monitor” view:
    - set ranges
    - show per-page access events
    - quick jump to Disasm (from address)

### Safety notes
- Access monitoring can be very noisy; must support throttling

---

## M3 — Native parity (P0/P1)

### Frida JS API scope
- `NativeFunction`, `NativeCallback`, `SystemFunction`
- `DebugSymbol`, `ApiResolver`

### Gaps vs current
- Missing:
  - `NativeCallback` creation & use with `Interceptor.replace()`
  - `SystemFunction` wrappers (errno/lastError)
  - NativeFunction options:
    - `abi`, `scheduling`, `exceptions`, `traps`
  - `ApiResolver` usage (module/objc/swift)
  - richer demangling story (platform-specific)

### Agent RPC (planned)

#### NativeCallback
- `create_native_callback -> { id }`
  - params: `{ returnType, argTypes, abi?, bodyTemplate? }`
- `delete_native_callback -> void`
- `list_native_callbacks -> string[]`

#### SystemFunction
- `call_system_function -> { value: string; errno?: number; lastError?: number }`

#### ApiResolver
- `api_resolver_create -> { id }`
- `api_resolver_enumerate_matches -> Match[]`
- `api_resolver_dispose -> void`

### FE deliverables
- `src/pages/native/`:
  - “API Resolver” search panel:
    - module resolver: `exports:*open*` etc.
    - show results + jump to disasm
  - “Call Function” editor:
    - presets for common ABI
    - show structured return types
  - “Replace Function” editor:
    - create NativeCallback from template

### Safety notes
- Calling arbitrary functions can crash target; default to `exceptions: 'steal'` where appropriate

---

## M4 — Instrumentation parity (P0/P1)

### Frida JS API scope
- `Interceptor.*`
- `Stalker.*` (advanced)
- Profiler/Samplers (hooks-based)

### Gaps vs current
- Missing in Stalker:
  - `invalidate()` (thread/global)
  - `addCallProbe()` / `removeCallProbe()`
  - `exclude(range)`
  - queue tuning (`queueCapacity`, `queueDrainInterval`)
- Interceptor:
  - breakpoint kind (barebone only)

### Agent RPC (planned)
- `stalker_exclude -> void`
- `stalker_invalidate -> void`
- `stalker_add_call_probe -> { id }`
- `stalker_remove_call_probe -> void`
- `stalker_set_queue_params -> void`

#### Profiler
- `profiler_create -> { id }`
- `profiler_instrument -> void`
- `profiler_generate_report -> { xml: string }`
- `profiler_dispose -> void`

#### Samplers
- `sampler_create_cycle|busy_cycle|wall_clock|user_time|malloc_count|call_count -> { id }`
- `sampler_sample -> { value: string }`

### FE deliverables
- `src/pages/methods/` or dedicated new tabs:
  - “Stalker”:
    - follow/unfollow
    - events selection
    - parse view + export
    - call probes UI
  - “Profiler”:
    - choose target functions
    - report viewer

### Safety notes
- Stalker can generate huge amounts of data; require sampling and/or summaries

---

## M5 — Runtime bridges: ObjC / Java / Swift (P1)

### Frida JS API scope
- ObjC (moved): `frida-objc-bridge`
- Java (moved): `frida-java-bridge`
- Swift resolution via `ApiResolver('swift')`

### Deliverables

#### ObjC
- Agent:
  - bundle `frida-objc-bridge` into `src-frida/` build
  - expose:
    - availability
    - class list, protocol list
    - method list
    - method hook helpers
    - block hook helpers
- FE (`src/pages/objc/`):
  - Class browser (search + details)
  - Method invocation / hooking UI
  - Block hook helper UI

#### Java
- Agent:
  - bundle `frida-java-bridge`
  - expose:
    - `Java.enumerateLoadedClasses*`
    - `Java.enumerateClassLoaders*`
    - `Java.enumerateMethods(query)`
    - `Java.perform/performNow/scheduleOnMainThread`
  - hook templates:
    - method overload selection
    - argument logging
- FE (`src/pages/java/`):
  - Loader selection
  - Class browser
  - Method enumerate + hook

#### Swift
- Agent:
  - `ApiResolver('swift')` wrappers
- FE (`src/pages/swift/`):
  - Swift symbol resolver UI
  - jump-to-disasm

### Risks
- Packaging: frida-compile bundling + version skew
- Runtime availability: must show clear “not available” states

---

## M6 — IO/Network/Database (P2)

### Scope
- `Socket.*`, `SocketListener`, `SocketConnection`
- `File.*`, streams
- `SqliteDatabase`, `SqliteStatement`

### CARF relevance
These are primarily useful for:

- pulling data out of the target process (files, sockets)
- caching static-analysis data inside the agent (SQLite openInline)
- building fuzzers / harnesses inside the target

### Planned UI
- new tabs (optional):
  - `Network`
  - `Files`
  - `Database`

### Safety
- These APIs operate in the target process context; file and network access may have security implications.

---

## M7 — Advanced runtime (P2)

### Scope
- `Worker`
- `gc()`
- `Cloak.*`

### CARF deliverables
- `src/pages/console/`:
  - Worker manager (start/terminate)
  - message bridge (worker ↔ main agent ↔ host)
- `src/pages/settings/`:
  - Cloak controls (thread/range/fd)

### Safety
- Cloak is stealth-oriented; keep behind an “Advanced” toggle and document clearly.

---

# Appendix A — Suggested folder layout for scaling UI

As feature count grows, each tab should evolve into:

- `src/pages/native/NativePage.tsx`
- `src/pages/native/components/*`
- `src/pages/native/state/*` (optional tab-local store)

Same for other tabs.

# Appendix B — Testing matrix (recommended)

Minimum targets to validate per platform:

- Windows x64 local process (notepad, calc)
- macOS (ObjC runtime) sample app
- Android emulator (Java runtime)

For each feature:

- Verify **no hang** (timeouts work)
- Verify **errors show in Alert UI**
- Verify **streaming can be stopped**
- Verify **detaching clears/halts streams**

# Appendix C — Notes on already-known constraints

- `send()` has non-trivial overhead; batch events and prefer summaries.
- Interceptor may be limited when `Process.codeSigningPolicy === 'required'`.
- `Process.runOnThread()` is powerful but dangerous; gate behind confirmations.
