import type { MethodHandler } from "../rpc/types";

// Core methods
import { ping, getArch, getProcessInfo } from "./core";

// Process methods
import {
  getCurrentDir,
  getHomeDir,
  getTmpDir,
  isDebuggerAttached,
  enumerateRanges as processEnumerateRanges,
  enumerateMallocRanges,
  findRangeByAddress,
  attachModuleObserver,
  detachModuleObserver,
  attachThreadObserver,
  detachThreadObserver,
  setExceptionHandler,
  getMainModule,
} from "./process";

// Native methods
import {
  enumerateModules,
  enumerateExports,
  enumerateImports,
  enumerateSymbols,
  findModuleByAddress,
  enumerateSections,
  enumerateDependencies,
  enumerateModuleRanges,
  findSymbolByName,
  loadModule,
  findGlobalExportByName,
} from "./native";

// Native function methods
import {
  createNativeFunction,
  callNativeFunction,
  deleteNativeFunction,
  listNativeFunctions,
  findExportByName,
  getExportByName,
  resolveSymbol,
  getDebugSymbol,
  getFunctionByAddress,
  createNativeCallback,
  deleteNativeCallback,
  listNativeCallbacks,
  createSystemFunction,
  callSystemFunction,
  deleteSystemFunction,
  listSystemFunctions,
  apiResolverEnumerate,
  getAbiOptions,
  getNativeTypes,
} from "./native/functions";

// Advanced native methods
import {
  demangleSymbol,
  disassemble,
  getFunctionInfo,
  callFunction,
  readCString,
  getModuleExportsDemangled,
  enumerateModuleSections,
  findPatternInModule,
  getArchInfo,
} from "./native/advanced";

// Memory methods
import {
  readMemory,
  writeMemory,
  searchMemory,
  enumerateRanges,
  allocateMemory,
  memoryScanAsync,
  memoryScanAbort,
  memoryAccessMonitorEnable,
  memoryAccessMonitorDisable,
} from "./memory";

// Advanced memory methods
import {
  memoryProtect,
  memoryQueryProtection,
  memoryAllocProtected,
  memoryAllocUtf8String,
  memoryAllocUtf16String,
  memoryAllocAnsiString,
  memoryCopy,
  memoryDup,
  readPointer,
  writePointer,
  readInt,
  writeInt,
  readString,
  writeString,
  memoryScanSync,
  memoryPatchCode,
} from "./memory/advanced";

// Thread methods
import {
  enumerateThreads,
  getBacktrace,
  getCurrentThreadId,
  setHardwareBreakpoint,
  unsetHardwareBreakpoint,
  setHardwareWatchpoint,
  unsetHardwareWatchpoint,
  threadSleep,
} from "./thread";

// Interceptor methods
import {
  interceptorAttach,
  interceptorDetach,
  interceptorDetachAll,
  interceptorList,
  interceptorReplace,
  interceptorRevert,
  interceptorFlush,
} from "./interceptor";

// ObjC methods
import {
  objcAvailable,
  objcGetRuntime,
  objcEnumerateClasses,
  objcGetClassMethods,
  objcGetClassProperties,
  objcEnumerateProtocols,
  objcChoose,
  objcScheduleOnMainThread,
} from "./objc";

// Java methods
import {
  javaAvailable,
  javaGetVmInfo,
  javaEnumerateLoadedClasses,
  javaGetClassMethods,
  javaGetClassFields,
  javaChoose,
  javaEnumerateClassLoaders,
  javaPerform,
  javaScheduleOnMainThread,
} from "./java";

// IO methods
import {
  fileReadAllText,
  fileReadAllBytes,
  fileWriteAllText,
  fileWriteAllBytes,
  socketConnect,
  socketListen,
  socketType,
  socketLocalAddress,
  socketPeerAddress,
  sqliteOpen,
  sqliteExec,
  sqliteQuery,
  sqliteDumpSchema,
} from "./io";

// Advanced methods (Cloak, Script, Kernel)
import {
  cloakAddCurrentThread,
  cloakAddThread,
  cloakRemoveThread,
  cloakHasThread,
  cloakAddRange,
  cloakRemoveRange,
  cloakHasRange,
  cloakAddFd,
  cloakRemoveFd,
  cloakHasFd,
  scriptGetRuntime,
  scriptPin,
  scriptUnpin,
  scriptSetGlobalAccessHandler,
  kernelAvailable,
  kernelGetBase,
  kernelReadByteArray,
  kernelEnumerateModules,
  kernelEnumerateRanges,
} from "./advanced";

// Stalker methods
import {
  stalkerFollow,
  stalkerUnfollow,
  stalkerGarbageCollect,
  stalkerFlush,
  stalkerGetTrustThreshold,
  stalkerSetTrustThreshold,
  stalkerList,
  stalkerParse,
  stalkerInvalidate,
  stalkerExclude,
  stalkerAddCallProbe,
  stalkerRemoveCallProbe,
  stalkerListCallProbes,
  stalkerGetQueueCapacity,
  stalkerSetQueueCapacity,
  stalkerGetQueueDrainInterval,
  stalkerSetQueueDrainInterval,
} from "./stalker";

// Map of host-callable RPC methods
export const methods: Record<string, MethodHandler> = {
  // Core
  ping,
  get_arch: getArch,
  get_process_info: getProcessInfo,

  // Process
  get_current_dir: getCurrentDir,
  get_home_dir: getHomeDir,
  get_tmp_dir: getTmpDir,
  is_debugger_attached: isDebuggerAttached,
  process_enumerate_ranges: processEnumerateRanges,
  enumerate_malloc_ranges: enumerateMallocRanges,
  find_range_by_address: findRangeByAddress,
  attach_module_observer: attachModuleObserver,
  detach_module_observer: detachModuleObserver,
  attach_thread_observer: attachThreadObserver,
  detach_thread_observer: detachThreadObserver,
  set_exception_handler: setExceptionHandler,
  get_main_module: getMainModule,

  // Native - Module enumeration
  enumerate_modules: enumerateModules,
  enumerate_exports: enumerateExports,
  enumerate_imports: enumerateImports,
  enumerate_symbols: enumerateSymbols,
  find_module_by_address: findModuleByAddress,
  enumerate_sections: enumerateSections,
  enumerate_dependencies: enumerateDependencies,
  enumerate_module_ranges: enumerateModuleRanges,
  find_symbol_by_name: findSymbolByName,
  load_module: loadModule,
  find_global_export_by_name: findGlobalExportByName,

  // Native - Functions
  create_native_function: createNativeFunction,
  call_native_function: callNativeFunction,
  delete_native_function: deleteNativeFunction,
  list_native_functions: listNativeFunctions,
  find_export_by_name: findExportByName,
  get_export_by_name: getExportByName,
  resolve_symbol: resolveSymbol,
  get_debug_symbol: getDebugSymbol,
  get_function_by_address: getFunctionByAddress,

  // Native - Callbacks
  create_native_callback: createNativeCallback,
  delete_native_callback: deleteNativeCallback,
  list_native_callbacks: listNativeCallbacks,

  // Native - SystemFunction
  create_system_function: createSystemFunction,
  call_system_function: callSystemFunction,
  delete_system_function: deleteSystemFunction,
  list_system_functions: listSystemFunctions,

  // Native - ApiResolver & Helpers
  api_resolver_enumerate: apiResolverEnumerate,
  get_abi_options: getAbiOptions,
  get_native_types: getNativeTypes,

  // Native - Advanced
  demangle_symbol: demangleSymbol,
  disassemble: disassemble,
  get_function_info: getFunctionInfo,
  call_function: callFunction,
  read_cstring: readCString,
  get_module_exports_demangled: getModuleExportsDemangled,
  enumerate_module_sections: enumerateModuleSections,
  find_pattern_in_module: findPatternInModule,
  get_arch_info: getArchInfo,

  // Memory - Basic
  read_memory: readMemory,
  write_memory: writeMemory,
  search_memory: searchMemory,
  enumerate_ranges: enumerateRanges,
  allocate_memory: allocateMemory,
  memory_scan_async: memoryScanAsync,
  memory_scan_abort: memoryScanAbort,
  memory_access_monitor_enable: memoryAccessMonitorEnable,
  memory_access_monitor_disable: memoryAccessMonitorDisable,

  // Memory - Advanced
  memory_protect: memoryProtect,
  memory_query_protection: memoryQueryProtection,
  memory_alloc_protected: memoryAllocProtected,
  memory_alloc_utf8_string: memoryAllocUtf8String,
  memory_alloc_utf16_string: memoryAllocUtf16String,
  memory_alloc_ansi_string: memoryAllocAnsiString,
  memory_copy: memoryCopy,
  memory_dup: memoryDup,
  read_pointer: readPointer,
  write_pointer: writePointer,
  read_int: readInt,
  write_int: writeInt,
  read_string: readString,
  write_string: writeString,
  memory_scan_sync: memoryScanSync,
  memory_patch_code: memoryPatchCode,

  // Thread
  enumerate_threads: enumerateThreads,
  get_backtrace: getBacktrace,
  get_current_thread_id: getCurrentThreadId,
  set_hardware_breakpoint: setHardwareBreakpoint,
  unset_hardware_breakpoint: unsetHardwareBreakpoint,
  set_hardware_watchpoint: setHardwareWatchpoint,
  unset_hardware_watchpoint: unsetHardwareWatchpoint,
  thread_sleep: threadSleep,

  // Interceptor
  interceptor_attach: interceptorAttach,
  interceptor_detach: interceptorDetach,
  interceptor_detach_all: interceptorDetachAll,
  interceptor_list: interceptorList,
  interceptor_replace: interceptorReplace,
  interceptor_revert: interceptorRevert,
  interceptor_flush: interceptorFlush,

  // Stalker
  stalker_follow: stalkerFollow,
  stalker_unfollow: stalkerUnfollow,
  stalker_garbage_collect: stalkerGarbageCollect,
  stalker_flush: stalkerFlush,
  stalker_get_trust_threshold: stalkerGetTrustThreshold,
  stalker_set_trust_threshold: stalkerSetTrustThreshold,
  stalker_list: stalkerList,
  stalker_parse: stalkerParse,
  stalker_invalidate: stalkerInvalidate,
  stalker_exclude: stalkerExclude,
  stalker_add_call_probe: stalkerAddCallProbe,
  stalker_remove_call_probe: stalkerRemoveCallProbe,
  stalker_list_call_probes: stalkerListCallProbes,
  stalker_get_queue_capacity: stalkerGetQueueCapacity,
  stalker_set_queue_capacity: stalkerSetQueueCapacity,
  stalker_get_queue_drain_interval: stalkerGetQueueDrainInterval,
  stalker_set_queue_drain_interval: stalkerSetQueueDrainInterval,

  // ObjC
  objc_available: objcAvailable,
  objc_get_runtime: objcGetRuntime,
  objc_enumerate_classes: objcEnumerateClasses,
  objc_get_class_methods: objcGetClassMethods,
  objc_get_class_properties: objcGetClassProperties,
  objc_enumerate_protocols: objcEnumerateProtocols,
  objc_choose: objcChoose,
  objc_schedule_on_main_thread: objcScheduleOnMainThread,

  // Java
  java_available: javaAvailable,
  java_get_vm_info: javaGetVmInfo,
  java_enumerate_loaded_classes: javaEnumerateLoadedClasses,
  java_get_class_methods: javaGetClassMethods,
  java_get_class_fields: javaGetClassFields,
  java_choose: javaChoose,
  java_enumerate_class_loaders: javaEnumerateClassLoaders,
  java_perform: javaPerform,
  java_schedule_on_main_thread: javaScheduleOnMainThread,

  // IO - File
  file_read_all_text: fileReadAllText,
  file_read_all_bytes: fileReadAllBytes,
  file_write_all_text: fileWriteAllText,
  file_write_all_bytes: fileWriteAllBytes,

  // IO - Socket
  socket_connect: socketConnect,
  socket_listen: socketListen,
  socket_type: socketType,
  socket_local_address: socketLocalAddress,
  socket_peer_address: socketPeerAddress,

  // IO - SQLite
  sqlite_open: sqliteOpen,
  sqlite_exec: sqliteExec,
  sqlite_query: sqliteQuery,
  sqlite_dump_schema: sqliteDumpSchema,

  // Cloak
  cloak_add_current_thread: cloakAddCurrentThread,
  cloak_add_thread: cloakAddThread,
  cloak_remove_thread: cloakRemoveThread,
  cloak_has_thread: cloakHasThread,
  cloak_add_range: cloakAddRange,
  cloak_remove_range: cloakRemoveRange,
  cloak_has_range: cloakHasRange,
  cloak_add_fd: cloakAddFd,
  cloak_remove_fd: cloakRemoveFd,
  cloak_has_fd: cloakHasFd,

  // Script
  script_get_runtime: scriptGetRuntime,
  script_pin: scriptPin,
  script_unpin: scriptUnpin,
  script_set_global_access_handler: scriptSetGlobalAccessHandler,

  // Kernel
  kernel_available: kernelAvailable,
  kernel_get_base: kernelGetBase,
  kernel_read_byte_array: kernelReadByteArray,
  kernel_enumerate_modules: kernelEnumerateModules,
  kernel_enumerate_ranges: kernelEnumerateRanges,
};
