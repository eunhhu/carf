// ─── Tab System ───

export type TabId =
	| "console"
	| "modules"
	| "threads"
	| "memory"
	| "java"
	| "objc"
	| "native"
	| "script"
	| "hooks"
	| "pinboard"
	| "callgraph"
	| "network"
	| "files";

export interface TabDefinition {
	id: TabId;
	label: string;
	priority: "P0" | "P1" | "P2";
	shortcutIndex: number;
}

export const TAB_DEFINITIONS: TabDefinition[] = [
	{ id: "console", label: "Console", priority: "P0", shortcutIndex: 1 },
	{ id: "modules", label: "Modules", priority: "P0", shortcutIndex: 2 },
	{ id: "threads", label: "Threads", priority: "P0", shortcutIndex: 3 },
	{ id: "memory", label: "Memory", priority: "P1", shortcutIndex: 4 },
	{ id: "java", label: "Java", priority: "P1", shortcutIndex: 5 },
	{ id: "objc", label: "ObjC", priority: "P1", shortcutIndex: 6 },
	{ id: "native", label: "Native", priority: "P1", shortcutIndex: 7 },
	{ id: "script", label: "Script", priority: "P1", shortcutIndex: 8 },
	{ id: "hooks", label: "Hooks", priority: "P1", shortcutIndex: 9 },
	{ id: "pinboard", label: "Pinboard", priority: "P1", shortcutIndex: 0 },
	{ id: "callgraph", label: "Call Graph", priority: "P2", shortcutIndex: -1 },
	{ id: "network", label: "Network", priority: "P2", shortcutIndex: -1 },
	{ id: "files", label: "Files", priority: "P2", shortcutIndex: -1 },
];

// ─── Navigation ───

export interface NavigateOptions {
	tab: TabId;
	context?: Record<string, unknown>;
}

// ─── Device ───

export interface DeviceInfo {
	id: string;
	name: string;
	type: "local" | "usb" | "remote";
	icon: string | null;
	os: OsInfo | null;
	arch: string | null;
	status: "connected" | "disconnected" | "pairing";
}

export interface OsInfo {
	platform: "android" | "ios" | "macos" | "linux" | "windows";
	version: string;
}

// ─── Process ───

export interface ProcessInfo {
	pid: number;
	name: string;
	identifier: string | null;
	icon: string | null;
}

export interface AppInfo {
	identifier: string;
	name: string;
	pid: number | null;
	icon: string | null;
}

// ─── Session ───

export interface SessionInfo {
	id: string;
	deviceId: string;
	pid: number;
	processName: string;
	identifier: string | null;
	status: "active" | "paused" | "detached" | "crashed";
	mode: "spawn" | "attach";
	arch: string | null;
	createdAt: number;
}

export interface SpawnOptions {
	identifier: string;
	argv?: string[];
	envp?: Record<string, string>;
	cwd?: string;
	stdio?: "inherit" | "pipe";
	autoResume?: boolean;
	realm?: "native" | "emulated";
	persistTimeout?: number;
	runtime?: "qjs" | "v8";
	enableChildGating?: boolean;
	scriptPath?: string;
}

export interface AttachOptions {
	target: number | string;
	realm?: "native" | "emulated";
	persistTimeout?: number;
	runtime?: "qjs" | "v8";
	enableChildGating?: boolean;
	scriptPath?: string;
}

// ─── Module ───

export interface ModuleInfo {
	name: string;
	base: string;
	size: number;
	path: string;
}

export interface ExportInfo {
	name: string;
	address: string;
	type: "function" | "variable";
}

export interface ImportInfo {
	name: string;
	address: string;
	module: string;
	type: "function" | "variable";
}

export interface SymbolInfo {
	name: string;
	address: string;
	type: string;
	isGlobal: boolean;
	section?: { id: string; protection: string };
}

// ─── Thread ───

export interface ThreadInfo {
	id: number;
	name: string | null;
	state: "running" | "stopped" | "waiting" | "uninterruptible" | "halted";
}

export interface BacktraceFrame {
	address: string;
	moduleName: string | null;
	symbolName: string | null;
	fileName: string | null;
	lineNumber: number | null;
}

// ─── Memory ───

export interface MemoryRange {
	base: string;
	size: number;
	protection: string;
	file?: { path: string; offset: number; size: number };
}

export interface ScanResult {
	address: string;
	size: number;
	moduleName?: string | null;
	offset?: number | null;
	value?: string | null;
}

export interface MemoryAccessEvent {
	address: string;
	size: number;
	operation: "read" | "write" | "execute";
	from: string;
	timestamp: number;
}

// ─── Hook ───

export interface HookInfo {
	id: string;
	target: string;
	address: string | null;
	type: "native" | "java" | "objc";
	active: boolean;
	hits: number;
}

export interface HookConfig {
	type: "native" | "java" | "objc";
	target: string;
	address: string | null;
	options: {
		captureArgs: boolean;
		captureRetval: boolean;
		captureBacktrace: boolean;
	};
}

export interface HookEvent {
	sessionId?: string;
	hookId: string;
	type: "enter" | "leave";
	timestamp: number;
	threadId: number;
	target: string;
	address: string | null;
	args: unknown[];
	retval: unknown;
	backtrace: BacktraceFrame[];
}

// ─── Console ───

export type ConsoleLevel = "log" | "warn" | "error" | "info" | "debug";
export type ConsoleSource = "agent" | "system" | "user" | "hook";

export interface ConsoleMessage {
	id: string;
	sessionId?: string;
	timestamp: number;
	level: ConsoleLevel;
	source: ConsoleSource;
	content: string;
	data?: unknown;
}

// ─── Java / ObjC ───

export interface JavaClassInfo {
	name: string;
	methods: JavaMethodInfo[];
	fields: JavaFieldInfo[];
}

export interface JavaMethodInfo {
	name: string;
	returnType: string;
	argumentTypes: string[];
	isOverloaded: boolean;
	hooked: boolean;
}

export interface JavaFieldInfo {
	name: string;
	type: string;
	value?: unknown;
}

export interface ObjCClassInfo {
	name: string;
	methods: ObjCMethodInfo[];
}

export interface ObjCMethodInfo {
	selector: string;
	type: "instance" | "class";
	returnType: string;
	argumentTypes: string[];
	hooked: boolean;
}

// ─── Native ───

export interface StalkerEvent {
	sessionId?: string;
	threadId: number;
	type: "call" | "ret" | "exec" | "block";
	from: string;
	to: string;
	fromModule: string | null;
	toModule: string | null;
	fromSymbol: string | null;
	toSymbol: string | null;
	depth: number;
	count?: number;
}

// ─── Call Graph ───

export interface CallGraphNode {
	id: string;
	address: string;
	module: string | null;
	symbol: string | null;
	callCount: number;
}

export interface CallGraphEdge {
	from: string;
	to: string;
	count: number;
}

export interface CallGraphData {
	nodes: CallGraphNode[];
	edges: CallGraphEdge[];
}

// ─── Network ───

export interface NetworkRequest {
	sessionId?: string;
	id: string;
	timestamp: number;
	method: string;
	url: string;
	statusCode: number | null;
	requestHeaders: Record<string, string>;
	responseHeaders: Record<string, string>;
	requestBody: string | null;
	responseBody: string | null;
	duration: number | null;
	protocol: "http" | "https";
	source: "native" | "java" | "objc";
}

// ─── Filesystem ───

export interface FileEntry {
	name: string;
	path: string;
	type: "file" | "directory" | "symlink";
	size: number;
	permissions: string;
	modified: number | null;
}

// ─── Pinboard ───

export interface PinItem {
	id: string;
	type: "module" | "address" | "function" | "thread" | "class" | "hook";
	name: string;
	address: string | null;
	source: TabId;
	tags: string[];
	memo: string;
	metadata: Record<string, unknown>;
	pinnedAt: number;
}

// ─── Console Panel Sub-tabs ───

export type ConsolePanelTab = "console" | "hookEvents" | "system" | "timeline";

// ─── Events ───

export interface SessionDetachedEvent {
	sessionId: string;
	reason:
		| "application_requested"
		| "process_replaced"
		| "process_terminated"
		| "connection_terminated"
		| "device_lost";
}

export interface ProcessCrashedEvent {
	sessionId: string;
	crashReport: {
		summary: string;
		report: string;
		parameters: Record<string, string>;
	};
}

// ─── ADB ───

export interface AdbDevice {
	serial: string;
	state: string;
	model: string;
	product: string;
	transportId: number;
}

export interface DeviceProps {
	model: string;
	manufacturer: string;
	androidVersion: string;
	sdkVersion: number;
	abi: string;
	securityPatch: string;
	buildId: string;
	isRooted: boolean;
	selinuxStatus: string;
}

// ─── Swift ───

export interface SwiftTypeInfo {
	name: string;
	mangledName: string;
	kind: "class" | "struct" | "enum" | "protocol";
	moduleName: string;
	methods: SwiftMethodInfo[];
}

export interface SwiftMethodInfo {
	name: string;
	mangledName: string;
	address: string;
	hooked: boolean;
}

// ─── IL2CPP (Unity) ───

export interface Il2cppInfo {
	available: boolean;
	moduleName: string | null;
	base: string | null;
	size: number | null;
	version: string | null;
}

export interface Il2cppClassInfo {
	name: string;
	namespace: string;
	fullName: string;
	methodCount: number;
	fieldCount: number;
	imageIndex: number;
}

export interface Il2cppMethodInfo {
	name: string;
	address: string;
	paramCount: number;
	returnType: string;
	isStatic: boolean;
	hooked: boolean;
}

export interface Il2cppFieldInfo {
	name: string;
	type: string;
	offset: number;
	isStatic: boolean;
}

// ─── ApiResolver ───

export interface ApiResolveResult {
	name: string;
	address: string;
}

export interface ResolvedSymbolInfo {
	address: string;
	name: string | null;
	moduleName: string | null;
	fileName: string | null;
	lineNumber: number | null;
}

// ─── Memory Monitor ───

export interface MemoryMonitorRange {
	base: string;
	size: number;
}

export interface MemoryMonitorEvent {
	operation: "read" | "write" | "execute";
	from: string;
	address: string;
	rangeIndex: number;
	pageIndex: number;
	pagesCompleted: number;
	pagesTotal: number;
	timestamp: number;
}

// ─── Anti-Detection ───

export interface CloakStatus {
	cloakedThreads: number[];
	cloakedRanges: Array<{ base: string; size: number }>;
}

export interface BypassResult {
	type: "ssl-pinning" | "root-detection";
	hooksInstalled: number;
	details: string[];
}

// ─── Module Extended ───

export interface ModuleSectionInfo {
	id: string;
	name: string;
	address: string;
	size: number;
	protection: string;
}
