import type {
	AppInfo,
	BacktraceFrame,
	DeviceInfo,
	ExportInfo,
	FileEntry,
	HookEvent,
	HookInfo,
	ImportInfo,
	JavaFieldInfo,
	JavaMethodInfo,
	MemoryRange,
	ModuleInfo,
	NetworkRequest,
	ObjCMethodInfo,
	ProcessInfo,
	ScanResult,
	SessionDetachedEvent,
	SessionInfo,
	StalkerEvent,
	ThreadInfo,
} from "~/lib/types";

type EventHandler = (payload: unknown) => void;

interface MockSessionState {
	hooks: HookInfo[];
	networkTimer: ReturnType<typeof setInterval> | null;
	scriptLoaded: boolean;
	session: SessionInfo;
	stalkerEvents: Record<number, StalkerEvent[]>;
	stalkerTimers: Record<number, ReturnType<typeof setInterval>>;
}

const MOCK_NOW = Date.parse("2026-03-10T09:00:00+09:00");
const DEFAULT_DEVICE_ID = "device-local-1";

const MODULES: ModuleInfo[] = [
	{
		name: "libdemo.so",
		base: "0x7100000000",
		size: 212_992,
		path: "/data/app/com.carf.demobank/lib/arm64/libdemo.so",
	},
	{
		name: "libssl.so",
		base: "0x7200000000",
		size: 475_136,
		path: "/system/lib64/libssl.so",
	},
];

const MODULE_EXPORTS: Record<string, ExportInfo[]> = {
	"libdemo.so": [
		{ name: "login", address: "0x7100011200", type: "function" },
		{ name: "encrypt_payload", address: "0x7100012400", type: "function" },
		{ name: "gFeatureFlags", address: "0x7100013300", type: "variable" },
	],
	"libssl.so": [
		{ name: "SSL_read", address: "0x7200009a10", type: "function" },
		{ name: "SSL_write", address: "0x7200009bb0", type: "function" },
	],
};

const MODULE_IMPORTS: Record<string, ImportInfo[]> = {
	"libdemo.so": [
		{
			name: "SSL_read",
			address: "0x7100004110",
			module: "libssl.so",
			type: "function",
		},
		{
			name: "SSL_write",
			address: "0x7100004190",
			module: "libssl.so",
			type: "function",
		},
	],
	"libssl.so": [],
};

const THREADS: ThreadInfo[] = [
	{ id: 1337, name: "main", state: "running" },
	{ id: 1448, name: "RenderThread", state: "waiting" },
	{ id: 1559, name: "OkHttp Dispatcher", state: "stopped" },
];

const BACKTRACES: Record<number, BacktraceFrame[]> = {
	1337: [
		{
			address: "0x7100011200",
			moduleName: "libdemo.so",
			symbolName: "login",
			fileName: null,
			lineNumber: null,
		},
		{
			address: "0x7200009bb0",
			moduleName: "libssl.so",
			symbolName: "SSL_write",
			fileName: null,
			lineNumber: null,
		},
	],
	1448: [
		{
			address: "0x7100012400",
			moduleName: "libdemo.so",
			symbolName: "encrypt_payload",
			fileName: null,
			lineNumber: null,
		},
	],
	1559: [],
};

const MEMORY_RANGES: MemoryRange[] = [
	{
		base: "0x7100000000",
		size: 131_072,
		protection: "r-x",
		file: {
			path: "/data/app/com.carf.demobank/lib/arm64/libdemo.so",
			offset: 0,
			size: 131_072,
		},
	},
	{
		base: "0x7100020000",
		size: 65_536,
		protection: "rw-",
		file: {
			path: "/data/app/com.carf.demobank/lib/arm64/libdemo.so",
			offset: 131_072,
			size: 65_536,
		},
	},
	{
		base: "0x7300000000",
		size: 32_768,
		protection: "r--",
	},
];

const JAVA_CLASSES = [
	"com.carf.demobank.LoginActivity",
	"com.carf.demobank.network.ApiClient",
	"com.carf.demobank.security.RootChecker",
];

const JAVA_METHODS: Record<string, JavaMethodInfo[]> = {
	"com.carf.demobank.LoginActivity": [
		{
			name: "submitLogin",
			returnType: "void",
			argumentTypes: ["java.lang.String", "java.lang.String"],
			isOverloaded: false,
			hooked: false,
		},
		{
			name: "onCreate",
			returnType: "void",
			argumentTypes: ["android.os.Bundle"],
			isOverloaded: false,
			hooked: false,
		},
	],
	"com.carf.demobank.network.ApiClient": [
		{
			name: "postTransfer",
			returnType: "java.lang.String",
			argumentTypes: ["java.lang.String", "double"],
			isOverloaded: false,
			hooked: false,
		},
	],
	"com.carf.demobank.security.RootChecker": [
		{
			name: "isDeviceRooted",
			returnType: "boolean",
			argumentTypes: [],
			isOverloaded: false,
			hooked: false,
		},
	],
};

const JAVA_FIELDS: Record<string, JavaFieldInfo[]> = {
	"com.carf.demobank.LoginActivity": [
		{ name: "username", type: "java.lang.String", value: "demo@carf.app" },
		{ name: "loggedIn", type: "boolean", value: false },
	],
	"com.carf.demobank.network.ApiClient": [
		{
			name: "baseUrl",
			type: "java.lang.String",
			value: "https://api.carf.app",
		},
	],
	"com.carf.demobank.security.RootChecker": [
		{ name: "checksEnabled", type: "boolean", value: true },
	],
};

const OBJC_CLASSES = [
	"CARFLoginViewController",
	"CARFAPIClient",
	"CARFKeyStore",
];

const OBJC_METHODS: Record<string, ObjCMethodInfo[]> = {
	CARFLoginViewController: [
		{
			selector: "viewDidLoad",
			type: "instance",
			returnType: "void",
			argumentTypes: [],
			hooked: false,
		},
		{
			selector: "submitLogin:",
			type: "instance",
			returnType: "void",
			argumentTypes: ["id"],
			hooked: false,
		},
	],
	CARFAPIClient: [
		{
			selector: "postTransfer:amount:",
			type: "instance",
			returnType: "id",
			argumentTypes: ["id", "double"],
			hooked: false,
		},
	],
	CARFKeyStore: [
		{
			selector: "sharedStore",
			type: "class",
			returnType: "id",
			argumentTypes: [],
			hooked: false,
		},
	],
};

const FILE_TREE: Record<string, FileEntry[]> = {
	"/data/data/": [
		makeDirectory("com.carf.demobank", "/data/data/com.carf.demobank"),
		makeDirectory("shared", "/data/data/shared"),
	],
	"/data/data/com.carf.demobank/": [
		makeDirectory("databases", "/data/data/com.carf.demobank/databases"),
		makeFile(
			"config.json",
			"/data/data/com.carf.demobank/config.json",
			154,
			"rw-r--r--",
		),
		makeFile(
			"session.txt",
			"/data/data/com.carf.demobank/session.txt",
			48,
			"rw-------",
		),
	],
	"/data/data/com.carf.demobank/databases/": [
		makeFile(
			"users.db",
			"/data/data/com.carf.demobank/databases/users.db",
			4096,
			"rw-------",
		),
		makeFile(
			"audit.sqlite",
			"/data/data/com.carf.demobank/databases/audit.sqlite",
			2048,
			"rw-------",
		),
	],
	"/data/data/shared/": [
		makeFile("notes.xml", "/data/data/shared/notes.xml", 96, "rw-r--r--"),
	],
};

const FILE_CONTENT: Record<string, string> = {
	"/data/data/com.carf.demobank/config.json": JSON.stringify(
		{
			apiBaseUrl: "https://api.carf.app",
			buildFlavor: "debug",
			lastLoginUser: "demo@carf.app",
		},
		null,
		2,
	),
	"/data/data/com.carf.demobank/session.txt":
		"sid=mock-session-token\nuser=demo@carf.app\n",
	"/data/data/shared/notes.xml":
		'<notes><note id="1">Mock browser runtime</note></notes>',
};

const SQLITE_TABLE_MAP: Record<string, string[]> = {
	"/data/data/com.carf.demobank/databases/users.db": ["users", "sessions"],
	"/data/data/com.carf.demobank/databases/audit.sqlite": ["events"],
};

const SQLITE_RESULTS: Record<
	string,
	{ columns: string[]; rows: Array<Array<string | number>> }
> = {
	users: {
		columns: ["id", "email", "role"],
		rows: [
			[1, "demo@carf.app", "admin"],
			[2, "analyst@carf.app", "analyst"],
		],
	},
	sessions: {
		columns: ["id", "user_id", "active"],
		rows: [
			["sess_001", 1, 1],
			["sess_002", 2, 0],
		],
	},
	events: {
		columns: ["id", "kind", "created_at"],
		rows: [
			[1, "attach", "2026-03-10T08:57:00+09:00"],
			[2, "hook", "2026-03-10T08:58:30+09:00"],
		],
	},
};

const listeners = new Map<string, Set<EventHandler>>();

const runtimeState = {
	devices: createDevices(),
	nextHookId: 1,
	nextNetworkId: 1,
	nextSessionId: 1,
	processes: createProcesses(),
	applications: createApplications(),
	sessions: new Map<string, MockSessionState>(),
};

export function resetMockRuntime(): void {
	for (const sessionState of runtimeState.sessions.values()) {
		if (sessionState.networkTimer) {
			clearInterval(sessionState.networkTimer);
		}
		for (const timer of Object.values(sessionState.stalkerTimers)) {
			clearInterval(timer);
		}
	}

	listeners.clear();
	runtimeState.devices = createDevices();
	runtimeState.nextHookId = 1;
	runtimeState.nextNetworkId = 1;
	runtimeState.nextSessionId = 1;
	runtimeState.processes = createProcesses();
	runtimeState.applications = createApplications();
	runtimeState.sessions = new Map<string, MockSessionState>();
}

function makeDirectory(name: string, path: string): FileEntry {
	return {
		name,
		path,
		type: "directory",
		size: 0,
		permissions: "rwxr-xr-x",
		modified: MOCK_NOW,
	};
}

function makeFile(
	name: string,
	path: string,
	size: number,
	permissions: string,
): FileEntry {
	return {
		name,
		path,
		type: "file",
		size,
		permissions,
		modified: MOCK_NOW,
	};
}

function createDevices(): DeviceInfo[] {
	return [
		{
			id: DEFAULT_DEVICE_ID,
			name: "Pixel 8 Pro",
			type: "usb",
			icon: null,
			os: { platform: "android", version: "15" },
			arch: "arm64",
			status: "connected",
		},
	];
}

function createProcesses(): Record<string, ProcessInfo[]> {
	return {
		[DEFAULT_DEVICE_ID]: [
			{
				pid: 4201,
				name: "DemoBank",
				identifier: "com.carf.demobank",
				icon: null,
			},
			{
				pid: 3310,
				name: "SystemUI",
				identifier: "com.android.systemui",
				icon: null,
			},
			{
				pid: 2490,
				name: "CarfHelper",
				identifier: "app.carf.helper",
				icon: null,
			},
		],
	};
}

function createApplications(): Record<string, AppInfo[]> {
	return {
		[DEFAULT_DEVICE_ID]: [
			{
				identifier: "com.carf.demobank",
				name: "DemoBank",
				pid: 4201,
				icon: null,
			},
			{
				identifier: "app.carf.helper",
				name: "CarfHelper",
				pid: 2490,
				icon: null,
			},
			{
				identifier: "com.example.offline",
				name: "Offline Notes",
				pid: null,
				icon: null,
			},
		],
	};
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function emit(event: string, payload: unknown): void {
	const handlers = listeners.get(event);
	if (!handlers) return;
	for (const handler of handlers) {
		handler(clone(payload));
	}
}

function emitSessionEvent(
	event: string,
	sessionId: string,
	payload: Record<string, unknown>,
): void {
	emit(event, { sessionId, ...payload });
}

function addListener(event: string, handler: EventHandler): () => void {
	const handlers = listeners.get(event) ?? new Set<EventHandler>();
	handlers.add(handler);
	listeners.set(event, handlers);

	return () => {
		handlers.delete(handler);
		if (handlers.size === 0) {
			listeners.delete(event);
		}
	};
}

function getSessionState(sessionId: string): MockSessionState {
	const session = runtimeState.sessions.get(sessionId);
	if (!session) {
		throw new Error(`Unknown mock session: ${sessionId}`);
	}
	return session;
}

function createSession(
	deviceId: string,
	pid: number,
	processName: string,
	identifier: string | null,
	mode: SessionInfo["mode"],
): SessionInfo {
	const session: SessionInfo = {
		id: `session-${runtimeState.nextSessionId++}`,
		deviceId,
		pid,
		processName,
		identifier,
		status: "active",
		mode,
		arch: "arm64",
		createdAt: Date.now(),
	};

	runtimeState.sessions.set(session.id, {
		hooks: [],
		networkTimer: null,
		scriptLoaded: false,
		session,
		stalkerEvents: {},
		stalkerTimers: {},
	});

	globalThis.setTimeout(() => {
		emitSessionEvent("carf://console/message", session.id, {
			level: "info",
			source: "system",
			content: `Attached to ${processName}`,
		});
	}, 25);

	return clone(session);
}

function destroySession(sessionId: string): void {
	const sessionState = runtimeState.sessions.get(sessionId);
	if (!sessionState) return;

	if (sessionState.networkTimer) {
		clearInterval(sessionState.networkTimer);
	}
	for (const timer of Object.values(sessionState.stalkerTimers)) {
		clearInterval(timer);
	}

	runtimeState.sessions.delete(sessionId);

	const payload: SessionDetachedEvent = {
		sessionId,
		reason: "application_requested",
	};
	emit("carf://session/detached", payload);
}

function resolveProcess(
	deviceId: string,
	target: number | string,
): ProcessInfo {
	const processes = runtimeState.processes[deviceId] ?? [];
	const applications = runtimeState.applications[deviceId] ?? [];

	if (typeof target === "number") {
		const process = processes.find((item) => item.pid === target);
		if (process) {
			return process;
		}
	} else {
		const processByIdentifier = processes.find(
			(item) => item.identifier === target || item.name === target,
		);
		if (processByIdentifier) {
			return processByIdentifier;
		}

		const application = applications.find(
			(item) => item.identifier === target || item.name === target,
		);
		if (application) {
			return {
				pid: application.pid ?? 5000,
				name: application.name,
				identifier: application.identifier,
				icon: null,
			};
		}
	}

	throw new Error(`Mock target not found: ${String(target)}`);
}

function createHook(
	sessionState: MockSessionState,
	type: HookInfo["type"],
	target: string,
	address: string | null,
): HookInfo {
	const hook: HookInfo = {
		id: `hook-${runtimeState.nextHookId++}`,
		target,
		address,
		type,
		active: true,
		hits: 0,
	};

	sessionState.hooks.push(hook);
	scheduleHookTraffic(sessionState, hook);
	return clone(hook);
}

function scheduleHookTraffic(
	sessionState: MockSessionState,
	hook: HookInfo,
): void {
	globalThis.setTimeout(() => {
		const liveHook = sessionState.hooks.find((item) => item.id === hook.id);
		if (!liveHook || !liveHook.active) return;
		liveHook.hits += 1;
		emitHookEvent(sessionState.session.id, liveHook, "enter");
	}, 80);

	globalThis.setTimeout(() => {
		const liveHook = sessionState.hooks.find((item) => item.id === hook.id);
		if (!liveHook || !liveHook.active) return;
		emitHookEvent(sessionState.session.id, liveHook, "leave");
	}, 140);
}

function emitHookEvent(
	sessionId: string,
	hook: HookInfo,
	type: HookEvent["type"],
): void {
	const payload: HookEvent = {
		sessionId,
		hookId: hook.id,
		type,
		timestamp: Date.now(),
		threadId: 1337,
		target: hook.target,
		address: hook.address,
		args: type === "enter" ? ["alice", "hunter2"] : [],
		retval: type === "leave" ? "ok" : null,
		backtrace: BACKTRACES[1337] ?? [],
	};

	emit("carf://hook/event", payload);
}

function ensureTrailingSlash(path: string): string {
	if (path === "/") return path;
	return path.endsWith("/") ? path : `${path}/`;
}

function buildHexString(address: string, size: number): string {
	const baseSeed =
		Number.parseInt(address.replace(/^0x/, "").slice(-2), 16) || 0;
	return Array.from({ length: size }, (_, index) =>
		((baseSeed + index) % 256).toString(16).padStart(2, "0"),
	).join("");
}

function createNetworkRequest(sessionId: string): NetworkRequest {
	const requestId = `req-${runtimeState.nextNetworkId++}`;
	return {
		sessionId,
		id: requestId,
		timestamp: Date.now(),
		method: requestId.endsWith("1") ? "POST" : "GET",
		url: requestId.endsWith("1")
			? "https://api.carf.app/v1/login"
			: "https://api.carf.app/v1/profile",
		statusCode: 200,
		requestHeaders: {
			accept: "application/json",
			"x-session": "mock-session",
		},
		responseHeaders: {
			"content-type": "application/json",
		},
		requestBody: requestId.endsWith("1")
			? JSON.stringify({ username: "alice" })
			: null,
		responseBody: requestId.endsWith("1")
			? JSON.stringify({ token: "demo-token" })
			: JSON.stringify({ user: "alice" }),
		duration: requestId.endsWith("1") ? 84 : 27,
		protocol: "https",
		source: "java",
	};
}

function startNetworkCapture(sessionState: MockSessionState): void {
	if (sessionState.networkTimer) return;

	globalThis.setTimeout(() => {
		emit(
			"carf://network/request",
			createNetworkRequest(sessionState.session.id),
		);
	}, 50);

	sessionState.networkTimer = setInterval(() => {
		emit(
			"carf://network/request",
			createNetworkRequest(sessionState.session.id),
		);
	}, 2_000);
}

function stopNetworkCapture(sessionState: MockSessionState): void {
	if (!sessionState.networkTimer) return;
	clearInterval(sessionState.networkTimer);
	sessionState.networkTimer = null;
}

function emitStalkerBatch(sessionId: string, events: StalkerEvent[]): void {
	emit("carf://stalker/event", { sessionId, events });
	for (const event of events) {
		emit("carf://stalker/event", { sessionId, ...event });
	}
}

function getModuleAddress(target: string): string | null {
	if (target.startsWith("0x")) {
		return target;
	}

	const [moduleName, symbolName] = target.split("!");
	if (!moduleName || !symbolName) {
		return "0x7100011200";
	}

	const exportInfo = (MODULE_EXPORTS[moduleName] ?? []).find(
		(item) => item.name === symbolName,
	);
	return exportInfo?.address ?? "0x7100011200";
}

function updateHookState(
	sessionState: MockSessionState,
	hookId: string,
	active: boolean,
): void {
	const hook = sessionState.hooks.find((item) => item.id === hookId);
	if (!hook) {
		throw new Error(`Mock hook not found: ${hookId}`);
	}
	hook.active = active;
}

function removeHook(sessionState: MockSessionState, hookId: string): void {
	sessionState.hooks = sessionState.hooks.filter((item) => item.id !== hookId);
}

function markJavaMethodHooked(
	className: string,
	methodName: string,
	hooked: boolean,
): void {
	const methods = JAVA_METHODS[className];
	if (!methods) return;
	const method = methods.find((item) => item.name === methodName);
	if (method) {
		method.hooked = hooked;
	}
}

function markObjcMethodHooked(
	className: string,
	selector: string,
	hooked: boolean,
): void {
	const methods = OBJC_METHODS[className];
	if (!methods) return;
	const method = methods.find((item) => item.selector === selector);
	if (method) {
		method.hooked = hooked;
	}
}

function queryTableName(sql: string): string | null {
	const match = sql.match(/from\s+([a-zA-Z_][\w]*)/i);
	return match?.[1] ?? null;
}

export async function mockInvoke<T>(
	cmd: string,
	args?: Record<string, unknown>,
): Promise<T> {
	switch (cmd) {
		case "list_devices":
			return clone(runtimeState.devices) as T;
		case "add_remote_device": {
			const address = String(args?.address ?? "").trim();
			if (!address) {
				throw new Error("Remote address is required");
			}

			const device: DeviceInfo = {
				id: `remote-${address}`,
				name: `Remote ${address}`,
				type: "remote",
				icon: null,
				os: { platform: "android", version: "15" },
				arch: "arm64",
				status: "connected",
			};

			if (!runtimeState.devices.some((item) => item.id === device.id)) {
				runtimeState.devices.push(device);
				runtimeState.processes[device.id] = clone(
					runtimeState.processes[DEFAULT_DEVICE_ID] ?? [],
				);
				runtimeState.applications[device.id] = clone(
					runtimeState.applications[DEFAULT_DEVICE_ID] ?? [],
				);
				emit("carf://device/added", device);
			}

			return undefined as T;
		}
		case "remove_remote_device": {
			const address = String(args?.address ?? "").trim();
			const deviceId = `remote-${address}`;
			runtimeState.devices = runtimeState.devices.filter(
				(item) => item.id !== deviceId,
			);
			delete runtimeState.processes[deviceId];
			delete runtimeState.applications[deviceId];
			emit("carf://device/removed", deviceId);
			return undefined as T;
		}
		case "list_processes": {
			const deviceId = String(args?.deviceId ?? DEFAULT_DEVICE_ID);
			return clone(runtimeState.processes[deviceId] ?? []) as T;
		}
		case "list_applications": {
			const deviceId = String(args?.deviceId ?? DEFAULT_DEVICE_ID);
			return clone(runtimeState.applications[deviceId] ?? []) as T;
		}
		case "kill_process": {
			const deviceId = String(args?.deviceId ?? DEFAULT_DEVICE_ID);
			const pid = Number(args?.pid);
			runtimeState.processes[deviceId] = (
				runtimeState.processes[deviceId] ?? []
			).filter((item) => item.pid !== pid);
			runtimeState.applications[deviceId] = (
				runtimeState.applications[deviceId] ?? []
			).map((item) => (item.pid === pid ? { ...item, pid: null } : item));
			return undefined as T;
		}
		case "attach": {
			const deviceId = String(args?.deviceId ?? DEFAULT_DEVICE_ID);
			const options =
				(args?.options as Record<string, unknown> | undefined) ?? {};
			const target = options.target as number | string;
			const process = resolveProcess(deviceId, target);
			return createSession(
				deviceId,
				process.pid,
				process.name,
				process.identifier,
				"attach",
			) as T;
		}
		case "spawn_and_attach": {
			const deviceId = String(args?.deviceId ?? DEFAULT_DEVICE_ID);
			const options =
				(args?.options as Record<string, unknown> | undefined) ?? {};
			const identifier = String(options.identifier ?? "");
			const process = resolveProcess(deviceId, identifier);
			return createSession(
				deviceId,
				process.pid,
				process.name,
				process.identifier,
				"spawn",
			) as T;
		}
		case "detach": {
			const sessionId = String(args?.sessionId ?? "");
			destroySession(sessionId);
			return undefined as T;
		}
		case "resume":
			return undefined as T;
		case "rpc_call": {
			const sessionId = String(args?.sessionId ?? "");
			const method = String(args?.method ?? "");
			const params =
				(args?.params as Record<string, unknown> | undefined) ?? {};
			return handleMockRpc<T>(sessionId, method, params);
		}
		default:
			throw new Error(`Mock runtime does not implement command: ${cmd}`);
	}
}

async function handleMockRpc<T>(
	sessionId: string,
	method: string,
	params: Record<string, unknown>,
): Promise<T> {
	const sessionState = getSessionState(sessionId);

	switch (method) {
		case "enumerateModules":
			return clone(MODULES) as T;
		case "getModuleExports": {
			const moduleName = String(
				params.moduleName ?? params.name ?? "libdemo.so",
			);
			return clone(MODULE_EXPORTS[moduleName] ?? []) as T;
		}
		case "getModuleImports": {
			const moduleName = String(
				params.moduleName ?? params.name ?? "libdemo.so",
			);
			return clone(MODULE_IMPORTS[moduleName] ?? []) as T;
		}
		case "enumerateThreads":
			return clone(THREADS) as T;
		case "getBacktrace": {
			const threadId = Number(params.threadId ?? 1337);
			return clone(BACKTRACES[threadId] ?? []) as T;
		}
		case "enumerateRanges":
			return clone(MEMORY_RANGES) as T;
		case "readMemory": {
			const address = String(params.address ?? "0x7100000000");
			const size = Number(params.size ?? 256);
			return buildHexString(address, size) as T;
		}
		case "writeMemory":
			return undefined as T;
		case "scanMemory": {
			const pattern = String(params.pattern ?? "").trim();
			const results: ScanResult[] = pattern
				? [
						{ address: "0x7100020040", size: 16 },
						{ address: "0x7100021080", size: 24 },
					]
				: [];
			return clone(results) as T;
		}
		case "evaluate": {
			const code = String(params.code ?? "");
			if (code.trim() === "2 + 2" || code.trim() === "2+2") {
				return "4" as T;
			}
			return `mock:${code.trim() || "undefined"}` as T;
		}
		case "pause":
			return undefined as T;
		case "loadScript": {
			sessionState.scriptLoaded = true;
			emitSessionEvent("carf://console/message", sessionState.session.id, {
				level: "info",
				source: "agent",
				content: "Mock script loaded",
				data: { size: String(params.code ?? "").length },
			});
			return undefined as T;
		}
		case "unloadScript": {
			sessionState.scriptLoaded = false;
			emitSessionEvent("carf://console/message", sessionState.session.id, {
				level: "info",
				source: "agent",
				content: "Mock script unloaded",
			});
			return undefined as T;
		}
		case "isJavaAvailable":
			return true as T;
		case "enumerateJavaClasses":
			return clone(JAVA_CLASSES) as T;
		case "getJavaMethods": {
			const className = String(params.className ?? "");
			return clone(JAVA_METHODS[className] ?? []) as T;
		}
		case "getJavaFields": {
			const className = String(params.className ?? "");
			return clone(JAVA_FIELDS[className] ?? []) as T;
		}
		case "chooseJavaInstances": {
			const className = String(params.className ?? "");
			return clone([`${className}@0x1010`, `${className}@0x1020`]) as T;
		}
		case "hookJavaMethod": {
			const className = String(params.className ?? "");
			const methodName = String(params.methodName ?? "");
			markJavaMethodHooked(className, methodName, true);
			return createHook(
				sessionState,
				"java",
				`${className}.${methodName}`,
				null,
			) as T;
		}
		case "listJavaHooks":
			return clone(
				sessionState.hooks.filter((item) => item.type === "java"),
			) as T;
		case "setJavaHookActive":
			updateHookState(
				sessionState,
				String(params.hookId ?? ""),
				Boolean(params.active),
			);
			return undefined as T;
		case "unhookJavaMethod": {
			const hookId = String(params.hookId ?? "");
			const hook = sessionState.hooks.find((item) => item.id === hookId);
			if (hook) {
				const target = hook.target;
				const separator = target.lastIndexOf(".");
				if (separator !== -1) {
					markJavaMethodHooked(
						target.slice(0, separator),
						target.slice(separator + 1),
						false,
					);
				}
			}
			removeHook(sessionState, hookId);
			return undefined as T;
		}
		case "isObjcAvailable":
			return true as T;
		case "enumerateObjcClasses":
			return clone(OBJC_CLASSES) as T;
		case "getObjcMethods": {
			const className = String(params.className ?? "");
			return clone(OBJC_METHODS[className] ?? []) as T;
		}
		case "chooseObjcInstances": {
			const className = String(params.className ?? "");
			return clone([`${className}:0x2010`, `${className}:0x2020`]) as T;
		}
		case "hookObjcMethod": {
			const className = String(params.className ?? "");
			const selector = String(params.selector ?? "");
			markObjcMethodHooked(className, selector, true);
			return createHook(
				sessionState,
				"objc",
				`${className} ${selector}`,
				null,
			) as T;
		}
		case "listObjcHooks":
			return clone(
				sessionState.hooks.filter((item) => item.type === "objc"),
			) as T;
		case "setObjcHookActive":
			updateHookState(
				sessionState,
				String(params.hookId ?? ""),
				Boolean(params.active),
			);
			return undefined as T;
		case "unhookObjcMethod": {
			const hookId = String(params.hookId ?? "");
			const hook = sessionState.hooks.find((item) => item.id === hookId);
			if (hook) {
				const separator = hook.target.indexOf(" ");
				if (separator !== -1) {
					markObjcMethodHooked(
						hook.target.slice(0, separator),
						hook.target.slice(separator + 1),
						false,
					);
				}
			}
			removeHook(sessionState, hookId);
			return undefined as T;
		}
		case "hookFunction": {
			const target = String(params.target ?? "");
			return createHook(
				sessionState,
				"native",
				target,
				getModuleAddress(target),
			) as T;
		}
		case "listHooks":
			return clone(
				sessionState.hooks.filter((item) => item.type === "native"),
			) as T;
		case "setNativeHookActive":
			updateHookState(
				sessionState,
				String(params.hookId ?? ""),
				Boolean(params.active),
			);
			return undefined as T;
		case "unhookFunction":
			removeHook(sessionState, String(params.hookId ?? ""));
			return undefined as T;
		case "callFunction": {
			const address = String(params.address ?? "0x0");
			const args = Array.isArray(params.args) ? params.args.join(", ") : "";
			return `retval(${address}${args ? ` | ${args}` : ""})` as T;
		}
		case "startStalker": {
			const threadId = Number(params.threadId ?? 1337);
			const events: StalkerEvent[] = [
				{
					threadId,
					type: "call",
					from: "0x7100011200",
					to: "0x7200009bb0",
					fromModule: "libdemo.so",
					toModule: "libssl.so",
					fromSymbol: "login",
					toSymbol: "SSL_write",
					depth: 0,
				},
				{
					threadId,
					type: "ret",
					from: "0x7200009bb0",
					to: "0x7100011200",
					fromModule: "libssl.so",
					toModule: "libdemo.so",
					fromSymbol: "SSL_write",
					toSymbol: "login",
					depth: 0,
				},
			];
			sessionState.stalkerEvents[threadId] = events;
			globalThis.setTimeout(
				() => emitStalkerBatch(sessionState.session.id, events),
				50,
			);
			globalThis.setTimeout(
				() => emitStalkerBatch(sessionState.session.id, events),
				400,
			);
			globalThis.setTimeout(
				() => emitStalkerBatch(sessionState.session.id, events),
				900,
			);
			if (!sessionState.stalkerTimers[threadId]) {
				sessionState.stalkerTimers[threadId] = setInterval(() => {
					emitStalkerBatch(sessionState.session.id, events);
				}, 1_200);
			}
			return {
				threadId,
				started: true,
				events: ["call", "ret"],
				mode: "stalker",
			} as T;
		}
		case "stopStalker": {
			const threadId = Number(params.threadId ?? 1337);
			const timer = sessionState.stalkerTimers[threadId];
			if (timer) {
				clearInterval(timer);
				delete sessionState.stalkerTimers[threadId];
			}
			return undefined as T;
		}
		case "getStalkerEvents": {
			const threadId = Number(params.threadId ?? 1337);
			return clone(sessionState.stalkerEvents[threadId] ?? []) as T;
		}
		case "startNetworkCapture":
			startNetworkCapture(sessionState);
			return undefined as T;
		case "stopNetworkCapture":
			stopNetworkCapture(sessionState);
			return undefined as T;
		case "listDirectory": {
			const path = ensureTrailingSlash(String(params.path ?? "/data/data/"));
			return clone(FILE_TREE[path] ?? []) as T;
		}
		case "readFile": {
			const path = String(params.path ?? "");
			const encoding = String(params.encoding ?? "utf8");
			const content = FILE_CONTENT[path] ?? "";
			if (encoding === "hex") {
				return Array.from(content)
					.map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
					.join("") as T;
			}
			return content as T;
		}
		case "sqliteTables": {
			const path = String(params.path ?? "");
			return clone(SQLITE_TABLE_MAP[path] ?? []) as T;
		}
		case "sqliteQuery": {
			const query = String(params.query ?? "");
			const tableName = queryTableName(query);
			return clone(
				(tableName ? SQLITE_RESULTS[tableName] : null) ?? {
					columns: ["result"],
					rows: [["ok"]],
				},
			) as T;
		}
		default:
			return [] as T;
	}
}

export function mockListen<T>(
	event: string,
	handler: (payload: T) => void,
): () => void {
	return addListener(event, (payload) => handler(payload as T));
}
