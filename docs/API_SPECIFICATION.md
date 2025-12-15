# CARF API Specification

> Cross-platform Application Runtime Framework - Frida GUI

This document describes all available APIs for communicating with the Frida backend and agent.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [React Hooks](#react-hooks)
3. [Backend API (Tauri IPC)](#backend-api-tauri-ipc)
4. [Agent RPC Methods](#agent-rpc-methods)
5. [Event System](#event-system)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ useFridaBackend │  │ useFridaEvents  │  │   useAgentRpc   │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
└───────────┼────────────────────┼────────────────────┼──────────┘
            │ invoke()           │ listen()           │ scriptPost()
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Tauri Backend (Rust)                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    FridaWorker                           │   │
│  │  - Device/Process management                             │   │
│  │  - Session lifecycle                                     │   │
│  │  - Script loading/unloading                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────┬─────────────────────────────────────────────────────┘
            │ frida-rust bindings
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frida Agent (JavaScript)                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    RPC Router                            │   │
│  │  - Receives carf:request messages                        │   │
│  │  - Dispatches to method handlers                         │   │
│  │  - Sends carf:response / carf:event messages             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## React Hooks

### `useFridaBackend`

Backend operations via Tauri IPC.

```typescript
import { useFridaBackend } from "@/hooks";

const {
  getVersion,     // () => Promise<string>
  listDevices,    // () => Promise<DeviceInfo[]>
  listProcesses,  // (deviceId: string) => Promise<ProcessInfo[]>
  attach,         // (deviceId: string, pid: number) => Promise<SessionInfo>
  detach,         // (sessionId: number) => Promise<void>
  spawn,          // (deviceId: string, program: string, argv?: string[]) => Promise<number>
  resume,         // (deviceId: string, pid: number) => Promise<void>
  kill,           // (deviceId: string, pid: number) => Promise<void>
  loadScript,     // (sessionId: number) => Promise<ScriptInfo>
  unloadScript,   // (scriptId: number) => Promise<void>
  scriptPost,     // (scriptId: number, message: unknown, data?: Uint8Array) => Promise<void>
} = useFridaBackend();
```

### `useFridaEvents`

Event subscriptions for backend events.

```typescript
import { useFridaEvents, useAutoFridaEvents } from "@/hooks";

// Manual subscription
const { onSessionAttached, onSessionDetached, onScriptMessage } = useFridaEvents();
const unlisten = await onSessionAttached((event) => console.log(event));
// Later: unlisten();

// Auto-cleanup subscription
useAutoFridaEvents({
  onSessionAttached: (e) => console.log("Attached:", e.session_id),
  onSessionDetached: (e) => console.log("Detached:", e.reason),
  onScriptMessage: (e) => console.log("Message:", e.message),
});
```

### `useAgentRpc`

RPC communication with the injected agent.

```typescript
import { useAgentRpc, createRpcMethod } from "@/hooks";

const { isListening, start, stop, request, onEvent } = useAgentRpc({
  scriptId: 123,
  timeout: 10000,  // optional, default 10s
  autoStart: true, // optional, default true
});

// Generic request
const modules = await request<ModuleInfo[]>("enumerate_modules");

// With parameters
const exports = await request<ExportInfo[]>("enumerate_exports", { moduleName: "libc.so" });

// Subscribe to agent events
const unsubscribe = onEvent((event) => {
  if (event.event === "interceptor_hit") {
    console.log("Hook triggered:", event);
  }
});
```

---

## Backend API (Tauri IPC)

### Types

```typescript
type DeviceInfo = {
  id: string;
  name: string;
  device_type: string;  // "local" | "usb" | "remote"
};

type ProcessInfo = {
  pid: number;
  name: string;
};

type SessionInfo = {
  session_id: number;
  script_id: number;
};

type ScriptInfo = {
  script_id: number;
};
```

### Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `frida_version` | - | `string` | Get Frida version |
| `frida_list_devices` | - | `DeviceInfo[]` | List all devices |
| `frida_list_processes` | `device_id: string` | `ProcessInfo[]` | List processes on device |
| `frida_attach` | `device_id: string, pid: number` | `SessionInfo` | Attach to process |
| `frida_detach` | `session_id: number` | `void` | Detach from session |
| `frida_spawn` | `device_id: string, program: string, argv?: string[]` | `number` | Spawn process (returns PID) |
| `frida_resume` | `device_id: string, pid: number` | `void` | Resume spawned process |
| `frida_kill` | `device_id: string, pid: number` | `void` | Kill process |
| `frida_load_default_script` | `session_id: number` | `ScriptInfo` | Load agent script |
| `frida_unload_script` | `script_id: number` | `void` | Unload script |
| `frida_script_post` | `script_id: number, message: any, data?: number[]` | `void` | Post message to script |

---

## Agent RPC Methods

All methods are called via `useAgentRpc().request(method, params)`.

### Core

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `ping` | - | `"pong"` | Health check |
| `get_arch` | - | `string` | CPU architecture |
| `get_process_info` | - | `ProcessInfo` | Current process info |

### Process

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `get_current_dir` | - | `string` | Current working directory |
| `get_home_dir` | - | `string` | Home directory |
| `get_tmp_dir` | - | `string` | Temp directory |
| `is_debugger_attached` | - | `boolean` | Debugger detection |
| `process_enumerate_ranges` | `protection: string` | `RangeInfo[]` | Enumerate memory ranges |
| `enumerate_malloc_ranges` | - | `RangeInfo[]` | Enumerate malloc ranges |
| `find_range_by_address` | `address: string` | `RangeInfo \| null` | Find range containing address |
| `get_main_module` | - | `ModuleInfo` | Get main module |
| `attach_module_observer` | - | `void` | Start module load/unload events |
| `detach_module_observer` | - | `void` | Stop module observer |
| `attach_thread_observer` | - | `void` | Start thread events |
| `detach_thread_observer` | - | `void` | Stop thread observer |
| `set_exception_handler` | - | `void` | Enable exception events |

### Native - Modules

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `enumerate_modules` | - | `ModuleInfo[]` | List loaded modules |
| `enumerate_exports` | `moduleName: string` | `ExportInfo[]` | List module exports |
| `enumerate_imports` | `moduleName: string` | `ImportInfo[]` | List module imports |
| `enumerate_symbols` | `moduleName: string` | `SymbolInfo[]` | List module symbols |
| `enumerate_sections` | `moduleName: string` | `SectionInfo[]` | List module sections |
| `enumerate_dependencies` | `moduleName: string` | `string[]` | List module dependencies |
| `enumerate_module_ranges` | `moduleName: string, protection: string` | `RangeInfo[]` | List module ranges |
| `find_module_by_address` | `address: string` | `ModuleInfo \| null` | Find module by address |
| `find_symbol_by_name` | `moduleName: string, symbolName: string` | `SymbolInfo \| null` | Find symbol |
| `find_global_export_by_name` | `exportName: string` | `string \| null` | Find export address |
| `load_module` | `path: string` | `ModuleInfo` | Load a module |

### Native - Functions

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `find_export_by_name` | `moduleName: string \| null, exportName: string` | `string \| null` | Find export address |
| `get_export_by_name` | `moduleName: string \| null, exportName: string` | `string` | Get export (throws if not found) |
| `resolve_symbol` | `symbol: string` | `string \| null` | Resolve symbol to address |
| `get_debug_symbol` | `address: string` | `DebugSymbol` | Get debug info for address |
| `get_function_by_address` | `address: string` | `FunctionInfo` | Get function info |
| `create_native_function` | `address: string, returnType: string, argTypes: string[], abi?: string` | `string` | Create callable function |
| `call_native_function` | `id: string, args: any[]` | `any` | Call created function |
| `delete_native_function` | `id: string` | `void` | Delete function |
| `list_native_functions` | - | `string[]` | List function IDs |
| `create_native_callback` | `returnType: string, argTypes: string[], abi?: string` | `{ id: string, address: string }` | Create callback |
| `delete_native_callback` | `id: string` | `void` | Delete callback |
| `list_native_callbacks` | - | `string[]` | List callback IDs |
| `create_system_function` | `address: string, returnType: string, argTypes: string[], abi?: string` | `string` | Create system function |
| `call_system_function` | `id: string, args: any[]` | `{ value: any, errno: number }` | Call with errno |
| `delete_system_function` | `id: string` | `void` | Delete system function |
| `list_system_functions` | - | `string[]` | List system function IDs |
| `api_resolver_enumerate` | `type: string, query: string` | `ApiMatch[]` | Resolve API patterns |
| `get_abi_options` | - | `string[]` | List available ABIs |
| `get_native_types` | - | `string[]` | List native types |

### Native - Advanced

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `demangle_symbol` | `symbol: string` | `string` | Demangle C++/Swift symbol |
| `disassemble` | `address: string, count?: number` | `Instruction[]` | Disassemble instructions |
| `get_function_info` | `address: string` | `FunctionInfo` | Get function boundaries |
| `call_function` | `address: string, args: any[]` | `any` | Quick function call |
| `read_cstring` | `address: string, maxLength?: number` | `string` | Read C string |
| `get_module_exports_demangled` | `moduleName: string` | `DemangledExport[]` | Exports with demangled names |
| `enumerate_module_sections` | `moduleName: string` | `SectionInfo[]` | List sections |
| `find_pattern_in_module` | `moduleName: string, pattern: string` | `string[]` | Pattern scan |
| `get_arch_info` | - | `ArchInfo` | Architecture details |

### Memory - Basic

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `read_memory` | `address: string, size: number` | `number[]` | Read bytes |
| `write_memory` | `address: string, data: number[]` | `void` | Write bytes |
| `search_memory` | `pattern: string, protection?: string` | `string[]` | Search pattern |
| `enumerate_ranges` | `protection: string` | `RangeInfo[]` | List memory ranges |
| `allocate_memory` | `size: number, protection?: string` | `string` | Allocate memory |
| `memory_scan_async` | `address: string, size: number, pattern: string` | `string` | Start async scan |
| `memory_scan_abort` | `scanId: string` | `void` | Abort scan |
| `memory_access_monitor_enable` | `ranges: RangeSpec[]` | `void` | Enable access monitor |
| `memory_access_monitor_disable` | - | `void` | Disable access monitor |

### Memory - Advanced

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `memory_protect` | `address: string, size: number, protection: string` | `boolean` | Change protection |
| `memory_query_protection` | `address: string` | `string` | Get protection |
| `memory_alloc_protected` | `size: number, protection: string` | `string` | Alloc with protection |
| `memory_alloc_utf8_string` | `str: string` | `string` | Alloc UTF-8 string |
| `memory_alloc_utf16_string` | `str: string` | `string` | Alloc UTF-16 string |
| `memory_alloc_ansi_string` | `str: string` | `string` | Alloc ANSI string |
| `memory_copy` | `dst: string, src: string, size: number` | `void` | Copy memory |
| `memory_dup` | `address: string, size: number` | `string` | Duplicate memory |
| `read_pointer` | `address: string` | `string` | Read pointer |
| `write_pointer` | `address: string, value: string` | `void` | Write pointer |
| `read_int` | `address: string, size: number, signed?: boolean` | `number` | Read integer |
| `write_int` | `address: string, value: number, size: number` | `void` | Write integer |
| `read_string` | `address: string, encoding?: string, maxLength?: number` | `string` | Read string |
| `write_string` | `address: string, str: string, encoding?: string` | `void` | Write string |
| `memory_scan_sync` | `address: string, size: number, pattern: string` | `string[]` | Sync pattern scan |
| `memory_patch_code` | `address: string, data: number[]` | `void` | Patch code |

### Thread

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `enumerate_threads` | - | `ThreadInfo[]` | List threads |
| `get_backtrace` | `context?: CpuContext, limit?: number` | `string[]` | Get backtrace |
| `get_current_thread_id` | - | `number` | Current thread ID |
| `set_hardware_breakpoint` | `address: string, size?: number` | `void` | Set HW breakpoint |
| `unset_hardware_breakpoint` | `address: string` | `void` | Remove HW breakpoint |
| `set_hardware_watchpoint` | `address: string, size: number, conditions: string` | `void` | Set watchpoint |
| `unset_hardware_watchpoint` | `address: string` | `void` | Remove watchpoint |
| `thread_sleep` | `ms: number` | `void` | Sleep current thread |

### Interceptor

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `interceptor_attach` | `target: string, options?: InterceptorOptions` | `string` | Attach hook |
| `interceptor_detach` | `id: string` | `void` | Detach hook |
| `interceptor_detach_all` | - | `void` | Detach all hooks |
| `interceptor_list` | - | `InterceptorInfo[]` | List active hooks |
| `interceptor_replace` | `target: string, replacement: string` | `string` | Replace function |
| `interceptor_revert` | `target: string` | `void` | Revert replacement |
| `interceptor_flush` | - | `void` | Flush pending changes |

### Stalker

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `stalker_follow` | `threadId?: number, options?: StalkerOptions` | `void` | Start tracing |
| `stalker_unfollow` | `threadId?: number` | `void` | Stop tracing |
| `stalker_garbage_collect` | - | `void` | GC stalker data |
| `stalker_flush` | - | `void` | Flush pending events |
| `stalker_get_trust_threshold` | - | `number` | Get trust threshold |
| `stalker_set_trust_threshold` | `threshold: number` | `void` | Set trust threshold |
| `stalker_list` | - | `number[]` | List followed threads |
| `stalker_parse` | `events: any[], options?: ParseOptions` | `any[]` | Parse events |
| `stalker_invalidate` | `address: string, size?: number` | `void` | Invalidate cache |
| `stalker_exclude` | `range: RangeSpec` | `void` | Exclude range |
| `stalker_add_call_probe` | `target: string` | `string` | Add call probe |
| `stalker_remove_call_probe` | `id: string` | `void` | Remove call probe |
| `stalker_list_call_probes` | - | `string[]` | List call probes |
| `stalker_get_queue_capacity` | - | `number` | Get queue capacity |
| `stalker_set_queue_capacity` | `capacity: number` | `void` | Set queue capacity |
| `stalker_get_queue_drain_interval` | - | `number` | Get drain interval |
| `stalker_set_queue_drain_interval` | `interval: number` | `void` | Set drain interval |

### ObjC (iOS/macOS)

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `objc_available` | - | `boolean` | Check ObjC runtime |
| `objc_get_runtime` | - | `ObjCRuntime` | Get runtime info |
| `objc_enumerate_classes` | `pattern?: string` | `string[]` | List classes |
| `objc_get_class_methods` | `className: string` | `MethodInfo[]` | Get methods |
| `objc_get_class_properties` | `className: string` | `PropertyInfo[]` | Get properties |
| `objc_enumerate_protocols` | - | `string[]` | List protocols |
| `objc_choose` | `className: string` | `string[]` | Find instances |
| `objc_schedule_on_main_thread` | `callback: string` | `void` | Run on main thread |

### Java (Android)

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `java_available` | - | `boolean` | Check Java runtime |
| `java_get_vm_info` | - | `JavaVmInfo` | Get VM info |
| `java_enumerate_loaded_classes` | `pattern?: string` | `string[]` | List classes |
| `java_get_class_methods` | `className: string` | `MethodInfo[]` | Get methods |
| `java_get_class_fields` | `className: string` | `FieldInfo[]` | Get fields |
| `java_choose` | `className: string` | `string[]` | Find instances |
| `java_enumerate_class_loaders` | - | `ClassLoaderInfo[]` | List class loaders |
| `java_perform` | `script: string` | `any` | Run in Java context |
| `java_schedule_on_main_thread` | `callback: string` | `void` | Run on main thread |

### IO - File

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `file_read_all_text` | `path: string` | `string` | Read text file |
| `file_read_all_bytes` | `path: string` | `number[]` | Read binary file |
| `file_write_all_text` | `path: string, content: string` | `void` | Write text file |
| `file_write_all_bytes` | `path: string, data: number[]` | `void` | Write binary file |

### IO - Socket

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `socket_connect` | `options: SocketConnectOptions` | `string` | Connect socket |
| `socket_listen` | `options: SocketListenOptions` | `string` | Listen socket |
| `socket_type` | `handle: string` | `string` | Get socket type |
| `socket_local_address` | `handle: string` | `SocketAddress` | Get local address |
| `socket_peer_address` | `handle: string` | `SocketAddress` | Get peer address |

### IO - SQLite

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `sqlite_open` | `path: string, flags?: string[]` | `string` | Open database |
| `sqlite_exec` | `dbId: string, sql: string` | `void` | Execute SQL |
| `sqlite_query` | `dbId: string, sql: string` | `any[][]` | Query SQL |
| `sqlite_dump_schema` | `dbId: string` | `string` | Dump schema |

### Cloak (Anti-detection)

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `cloak_add_current_thread` | - | `void` | Hide current thread |
| `cloak_add_thread` | `threadId: number` | `void` | Hide thread |
| `cloak_remove_thread` | `threadId: number` | `void` | Unhide thread |
| `cloak_has_thread` | `threadId: number` | `boolean` | Check if hidden |
| `cloak_add_range` | `address: string, size: number` | `void` | Hide memory range |
| `cloak_remove_range` | `address: string, size: number` | `void` | Unhide range |
| `cloak_has_range` | `address: string, size: number` | `boolean` | Check if hidden |
| `cloak_add_fd` | `fd: number` | `void` | Hide file descriptor |
| `cloak_remove_fd` | `fd: number` | `void` | Unhide FD |
| `cloak_has_fd` | `fd: number` | `boolean` | Check if hidden |

### Script

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `script_get_runtime` | - | `string` | Get runtime type |
| `script_pin` | - | `void` | Pin script |
| `script_unpin` | - | `void` | Unpin script |
| `script_set_global_access_handler` | `enabled: boolean` | `void` | Enable global access |

### Kernel (requires root)

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `kernel_available` | - | `boolean` | Check kernel access |
| `kernel_get_base` | - | `string` | Get kernel base |
| `kernel_read_byte_array` | `address: string, size: number` | `number[]` | Read kernel memory |
| `kernel_enumerate_modules` | - | `ModuleInfo[]` | List kernel modules |
| `kernel_enumerate_ranges` | `protection: string` | `RangeInfo[]` | List kernel ranges |

---

## Event System

### Backend Events (Tauri)

| Event | Payload | Description |
|-------|---------|-------------|
| `frida_session_attached` | `SessionAttachedEvent` | Session attached |
| `frida_session_detached` | `SessionDetachedEvent` | Session detached |
| `frida_script_message` | `ScriptMessageEvent` | Script message |

### Agent Events (carf:event)

Subscribe via `useAgentRpc().onEvent()`:

| Event | Payload | Description |
|-------|---------|-------------|
| `agent_loaded` | `{}` | Agent script loaded |
| `interceptor_enter` | `{ target, args, threadId }` | Hook onEnter |
| `interceptor_leave` | `{ target, retval, threadId }` | Hook onLeave |
| `stalker_event` | `{ threadId, events }` | Stalker trace events |
| `module_loaded` | `{ name, base, size }` | Module loaded |
| `module_unloaded` | `{ name, base, size }` | Module unloaded |
| `thread_created` | `{ id }` | Thread created |
| `thread_terminated` | `{ id }` | Thread terminated |
| `exception` | `{ type, address, context }` | Exception occurred |
| `memory_access` | `{ operation, from, address }` | Memory access detected |
| `scan_match` | `{ scanId, address }` | Pattern scan match |
| `scan_complete` | `{ scanId }` | Pattern scan complete |

---

## Usage Examples

### Basic Attach Flow

```typescript
import { useFridaBackend, useAgentRpc, useAutoFridaEvents } from "@/hooks";

function MyComponent() {
  const backend = useFridaBackend();
  const [scriptId, setScriptId] = useState<number | null>(null);
  const rpc = useAgentRpc({ scriptId });

  // Listen for session events
  useAutoFridaEvents({
    onSessionDetached: (e) => {
      console.log("Session detached:", e.reason);
      setScriptId(null);
    },
  });

  const handleAttach = async (deviceId: string, pid: number) => {
    const session = await backend.attach(deviceId, pid);
    setScriptId(session.script_id);
  };

  const handleEnumerateModules = async () => {
    const modules = await rpc.request<ModuleInfo[]>("enumerate_modules");
    console.log("Modules:", modules);
  };

  // ...
}
```

### Hook a Function

```typescript
const rpc = useAgentRpc({ scriptId });

// Subscribe to hook events
rpc.onEvent((event) => {
  if (event.event === "interceptor_enter") {
    console.log("Function called:", event.target, event.args);
  }
});

// Attach hook
const hookId = await rpc.request<string>("interceptor_attach", {
  target: "0x12345678",
  onEnter: true,
  onLeave: true,
});

// Later: detach
await rpc.request("interceptor_detach", { id: hookId });
```

### Memory Operations

```typescript
const rpc = useAgentRpc({ scriptId });

// Read memory
const bytes = await rpc.request<number[]>("read_memory", {
  address: "0x12345678",
  size: 256,
});

// Search pattern
const matches = await rpc.request<string[]>("search_memory", {
  pattern: "48 89 5C 24 ?? 48 89 74 24",
  protection: "r-x",
});

// Write memory
await rpc.request("write_memory", {
  address: "0x12345678",
  data: [0x90, 0x90, 0x90],
});
```

---

## Type Definitions

```typescript
// Common types used across APIs

type ModuleInfo = {
  name: string;
  base: string;
  size: number;
  path: string;
};

type ExportInfo = {
  type: "function" | "variable";
  name: string;
  address: string;
};

type ImportInfo = {
  type: "function" | "variable";
  name: string;
  module: string;
  address: string;
};

type SymbolInfo = {
  isGlobal: boolean;
  type: string;
  name: string;
  address: string;
  size?: number;
};

type RangeInfo = {
  base: string;
  size: number;
  protection: string;
  file?: { path: string; offset: number; size: number };
};

type ThreadInfo = {
  id: number;
  state: string;
  context: CpuContext;
};

type CpuContext = {
  pc: string;
  sp: string;
  [register: string]: string;
};

type Instruction = {
  address: string;
  mnemonic: string;
  opStr: string;
  size: number;
  bytes: number[];
};
```
