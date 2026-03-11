export interface AiToolDef {
	name: string;
	category: string;
	description: string;
	params: Record<string, string>;
}

/** All 127 CARF RPC handlers exposed as AI-callable tools, grouped by module. */
export const CARF_TOOLS: AiToolDef[] = [
	// ── Process (5) ──
	{ name: "ping", category: "process", description: "Health check — returns pong if agent is alive", params: {} },
	{ name: "getProcessInfo", category: "process", description: "Get target process info (pid, arch, platform, pageSize)", params: {} },
	{ name: "enumerateModules", category: "process", description: "List all loaded modules (name, base, size, path)", params: {} },
	{ name: "enumerateRanges", category: "process", description: "List memory ranges with given protection", params: { protection: "string, e.g. 'r--', 'rwx'" } },
	{ name: "getModuleVersion", category: "process", description: "Get module version string", params: { moduleName: "string" } },

	// ── Module (10) ──
	{ name: "findModuleByName", category: "module", description: "Find module by exact name", params: { name: "string" } },
	{ name: "findModuleByAddress", category: "module", description: "Find module containing address", params: { address: "string (hex)" } },
	{ name: "getModuleExports", category: "module", description: "List exports of a module", params: { moduleName: "string" } },
	{ name: "getModuleImports", category: "module", description: "List imports of a module", params: { moduleName: "string" } },
	{ name: "getModuleSymbols", category: "module", description: "List symbols of a module", params: { moduleName: "string" } },
	{ name: "enumerateModuleSections", category: "module", description: "List sections (.text, .data, etc.) of a module", params: { moduleName: "string" } },
	{ name: "enumerateModuleDependencies", category: "module", description: "List dependencies of a module", params: { moduleName: "string" } },
	{ name: "startModuleObserver", category: "module", description: "Start observing module load/unload events", params: {} },
	{ name: "stopModuleObserver", category: "module", description: "Stop module observer", params: {} },
	{ name: "findSymbolByName", category: "module", description: "Find debug symbol by name", params: { name: "string" } },

	// ── Thread (6) ──
	{ name: "enumerateThreads", category: "thread", description: "List all threads (id, name, state)", params: {} },
	{ name: "getThreadBacktrace", category: "thread", description: "Get backtrace of a thread", params: { threadId: "number" } },
	{ name: "getThreadContext", category: "thread", description: "Get CPU register context of a thread", params: { threadId: "number" } },
	{ name: "startThreadObserver", category: "thread", description: "Start observing thread creation/destruction", params: {} },
	{ name: "stopThreadObserver", category: "thread", description: "Stop thread observer", params: {} },
	{ name: "runOnThread", category: "thread", description: "Execute code on a specific thread", params: { threadId: "number", code: "string (JS)" } },

	// ── Memory (14) ──
	{ name: "readMemory", category: "memory", description: "Read bytes from memory address", params: { address: "string (hex)", size: "number" } },
	{ name: "writeMemory", category: "memory", description: "Write bytes to memory address", params: { address: "string (hex)", data: "string (hex bytes)" } },
	{ name: "scanMemory", category: "memory", description: "Scan memory for pattern", params: { pattern: "string (IDA-style, e.g. '48 8B ?? 00')", ranges: "string (protection filter, e.g. 'r-x')" } },
	{ name: "allocateMemory", category: "memory", description: "Allocate memory in target process", params: { size: "number" } },
	{ name: "protectMemory", category: "memory", description: "Change memory protection", params: { address: "string", size: "number", protection: "string (e.g. 'rwx')" } },
	{ name: "queryMemoryProtection", category: "memory", description: "Query current protection of memory address", params: { address: "string" } },
	{ name: "patchMemory", category: "memory", description: "Atomically patch code bytes (uses Memory.patchCode)", params: { address: "string", data: "string (hex)" } },
	{ name: "dumpMemoryRange", category: "memory", description: "Dump memory range as hex string", params: { base: "string", size: "number" } },
	{ name: "compareMemory", category: "memory", description: "Compare two memory regions", params: { addr1: "string", addr2: "string", size: "number" } },
	{ name: "enumerateMallocRanges", category: "memory", description: "Enumerate heap-allocated ranges", params: {} },
	{ name: "startMemoryMonitor", category: "memory", description: "Start monitoring memory access on a range", params: { base: "string", size: "number" } },
	{ name: "stopMemoryMonitor", category: "memory", description: "Stop memory access monitor", params: {} },
	{ name: "drainMonitorEvents", category: "memory", description: "Get pending memory access events", params: {} },
	{ name: "getMemoryMonitorStatus", category: "memory", description: "Check if memory monitor is active", params: {} },

	// ── Java (15) ──
	{ name: "isJavaAvailable", category: "java", description: "Check if Java runtime is available (Android)", params: {} },
	{ name: "getAndroidPackageName", category: "java", description: "Get the current Android package name", params: {} },
	{ name: "enumerateJavaClasses", category: "java", description: "List all loaded Java classes (optional filter)", params: { filter: "string? (substring match)" } },
	{ name: "enumerateJavaClassLoaders", category: "java", description: "List Java class loaders", params: {} },
	{ name: "getJavaMethods", category: "java", description: "Get methods of a Java class", params: { className: "string (e.g. 'com.example.MyClass')" } },
	{ name: "getJavaFields", category: "java", description: "Get fields of a Java class", params: { className: "string" } },
	{ name: "getJavaStackTrace", category: "java", description: "Get Java stack trace of current thread", params: {} },
	{ name: "hookJavaMethod", category: "java", description: "Hook a Java method to intercept calls", params: { className: "string", method: "string", overloadIndex: "number?" } },
	{ name: "unhookJavaMethod", category: "java", description: "Remove hook from a Java method", params: { className: "string", method: "string" } },
	{ name: "callJavaMethod", category: "java", description: "Call a static Java method", params: { className: "string", method: "string", args: "unknown[]?" } },
	{ name: "setJavaHookActive", category: "java", description: "Enable/disable a Java hook without removing it", params: { hookId: "string", active: "boolean" } },
	{ name: "listJavaHooks", category: "java", description: "List all active Java hooks", params: {} },
	{ name: "chooseJavaInstances", category: "java", description: "Find live instances of a Java class on heap", params: { className: "string" } },
	{ name: "searchJavaHeap", category: "java", description: "Search the Java heap for instances matching criteria", params: { className: "string" } },
	{ name: "sqliteQuery", category: "java", description: "Execute SQL query on an open SQLite database", params: { dbPath: "string", query: "string" } },

	// ── ObjC (8) ──
	{ name: "isObjcAvailable", category: "objc", description: "Check if Objective-C runtime is available (iOS/macOS)", params: {} },
	{ name: "enumerateObjcClasses", category: "objc", description: "List all registered ObjC classes", params: { filter: "string?" } },
	{ name: "getObjcMethods", category: "objc", description: "Get methods of an ObjC class", params: { className: "string" } },
	{ name: "hookObjcMethod", category: "objc", description: "Hook an ObjC method by selector", params: { className: "string", selector: "string" } },
	{ name: "unhookObjcMethod", category: "objc", description: "Unhook an ObjC method", params: { className: "string", selector: "string" } },
	{ name: "setObjcHookActive", category: "objc", description: "Enable/disable an ObjC hook", params: { hookId: "string", active: "boolean" } },
	{ name: "listObjcHooks", category: "objc", description: "List active ObjC hooks", params: {} },
	{ name: "chooseObjcInstances", category: "objc", description: "Find live instances of an ObjC class", params: { className: "string" } },

	// ── Swift (8) ──
	{ name: "isSwiftAvailable", category: "swift", description: "Check if Swift runtime is available", params: {} },
	{ name: "enumerateSwiftModules", category: "swift", description: "List Swift modules", params: {} },
	{ name: "demangleSwiftSymbol", category: "swift", description: "Demangle a Swift symbol name", params: { symbol: "string" } },
	{ name: "enumerateSwiftTypes", category: "swift", description: "List types in a Swift module", params: { moduleName: "string" } },
	{ name: "hookSwiftFunction", category: "swift", description: "Hook a Swift function by address", params: { address: "string", name: "string?" } },
	{ name: "unhookSwiftFunction", category: "swift", description: "Unhook a Swift function", params: { address: "string" } },
	{ name: "listSwiftHooks", category: "swift", description: "List active Swift hooks", params: {} },
	{ name: "setSwiftHookActive", category: "swift", description: "Enable/disable a Swift hook", params: { hookId: "string", active: "boolean" } },

	// ── IL2CPP (11) ──
	{ name: "isIl2cppAvailable", category: "il2cpp", description: "Check if IL2CPP (Unity) runtime is loaded", params: {} },
	{ name: "getIl2cppInfo", category: "il2cpp", description: "Get IL2CPP runtime info (module, version)", params: {} },
	{ name: "enumerateIl2cppDomains", category: "il2cpp", description: "List IL2CPP app domains", params: {} },
	{ name: "enumerateIl2cppClasses", category: "il2cpp", description: "List all IL2CPP classes", params: { filter: "string?" } },
	{ name: "getIl2cppClassMethods", category: "il2cpp", description: "Get methods of an IL2CPP class", params: { className: "string (full name)" } },
	{ name: "getIl2cppClassFields", category: "il2cpp", description: "Get fields of an IL2CPP class", params: { className: "string" } },
	{ name: "hookIl2cppMethod", category: "il2cpp", description: "Hook an IL2CPP method", params: { className: "string", methodName: "string", address: "string" } },
	{ name: "unhookIl2cppMethod", category: "il2cpp", description: "Unhook an IL2CPP method", params: { address: "string" } },
	{ name: "dumpIl2cppMetadata", category: "il2cpp", description: "Dump all IL2CPP metadata to a file", params: {} },
	{ name: "listIl2cppHooks", category: "il2cpp", description: "List active IL2CPP hooks", params: {} },
	{ name: "setIl2cppHookActive", category: "il2cpp", description: "Enable/disable an IL2CPP hook", params: { hookId: "string", active: "boolean" } },

	// ── Native (5) ──
	{ name: "hookFunction", category: "native", description: "Hook a native function by address", params: { address: "string", name: "string?" } },
	{ name: "unhookFunction", category: "native", description: "Unhook a native function", params: { address: "string" } },
	{ name: "setNativeHookActive", category: "native", description: "Enable/disable a native hook", params: { hookId: "string", active: "boolean" } },
	{ name: "listHooks", category: "native", description: "List all active native hooks", params: {} },
	{ name: "listNativeHooks", category: "native", description: "List native hooks only", params: {} },

	// ── Stalker (4) ──
	{ name: "startStalker", category: "stalker", description: "Start code tracing on a thread (call/ret/exec events)", params: { threadId: "number", events: "string[]? (call, ret, exec, block)" } },
	{ name: "stopStalker", category: "stalker", description: "Stop code tracing on a thread", params: { threadId: "number" } },
	{ name: "getStalkerEvents", category: "stalker", description: "Get buffered Stalker events", params: { threadId: "number" } },
	{ name: "listStalkerSessions", category: "stalker", description: "List active Stalker tracing sessions", params: {} },

	// ── Network (3) ──
	{ name: "isNetworkCaptureActive", category: "network", description: "Check if network capture is running", params: {} },
	{ name: "startNetworkCapture", category: "network", description: "Start capturing HTTP/HTTPS traffic", params: {} },
	{ name: "stopNetworkCapture", category: "network", description: "Stop network capture", params: {} },

	// ── Filesystem (4) ──
	{ name: "listDirectory", category: "filesystem", description: "List directory contents on target device", params: { path: "string" } },
	{ name: "readFile", category: "filesystem", description: "Read file contents from target device", params: { path: "string", encoding: "string? (utf8, hex)" } },
	{ name: "sqliteTables", category: "filesystem", description: "List tables in a SQLite database file", params: { dbPath: "string" } },
	{ name: "statFile", category: "filesystem", description: "Get file metadata (size, permissions, timestamps)", params: { path: "string" } },

	// ── Console (1) ──
	{ name: "evaluate", category: "console", description: "Execute arbitrary JavaScript code in the agent context. Use for anything not covered by other tools.", params: { code: "string (JavaScript)" } },

	// ── Resolver (5) ──
	{ name: "resolveApi", category: "resolver", description: "Resolve API functions by query (e.g. 'exports:libssl!SSL_*')", params: { query: "string" } },
	{ name: "resolveSymbol", category: "resolver", description: "Resolve a debug symbol to address and module info", params: { address: "string" } },
	{ name: "resolveModuleExport", category: "resolver", description: "Resolve a specific export from a module", params: { moduleName: "string", exportName: "string" } },
	{ name: "getGlobalExport", category: "resolver", description: "Find a global export across all modules", params: { name: "string" } },
	{ name: "findExportByName", category: "resolver", description: "Find export address by name (any module)", params: { name: "string" } },

	// ── Anti-Detection (7) ──
	{ name: "getCloakStatus", category: "antidetect", description: "Get current cloak status (hidden threads/ranges)", params: {} },
	{ name: "cloakThread", category: "antidetect", description: "Hide a thread from Process.enumerateThreads()", params: { threadId: "number" } },
	{ name: "uncloakThread", category: "antidetect", description: "Unhide a previously cloaked thread", params: { threadId: "number" } },
	{ name: "cloakRange", category: "antidetect", description: "Hide a memory range from enumeration", params: { base: "string", size: "number" } },
	{ name: "uncloakRange", category: "antidetect", description: "Unhide a previously cloaked range", params: { base: "string", size: "number" } },
	{ name: "bypassSslPinning", category: "antidetect", description: "Install hooks to bypass SSL certificate pinning (MITM-ready)", params: {} },
	{ name: "bypassRootDetection", category: "antidetect", description: "Install hooks to bypass root/jailbreak detection", params: {} },
];

/** Build a compact tool list string for the system prompt. */
export function buildToolListPrompt(): string {
	const byCategory = new Map<string, AiToolDef[]>();
	for (const tool of CARF_TOOLS) {
		const list = byCategory.get(tool.category) ?? [];
		list.push(tool);
		byCategory.set(tool.category, list);
	}

	const sections: string[] = [];
	for (const [category, tools] of byCategory) {
		const lines = tools.map((t) => {
			const paramStr = Object.keys(t.params).length > 0
				? `(${Object.entries(t.params).map(([k, v]) => `${k}: ${v}`).join(", ")})`
				: "()";
			return `  - ${t.name}${paramStr} — ${t.description}`;
		});
		sections.push(`### ${category} (${tools.length})\n${lines.join("\n")}`);
	}

	return sections.join("\n\n");
}
