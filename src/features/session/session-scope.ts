import {
	restoreCallgraphState,
	snapshotCallgraphState,
} from "~/features/callgraph/callgraph.store";
import {
	restoreAntiDetectState,
	snapshotAntiDetectState,
} from "~/features/antidetect/antidetect.store";
import {
	restoreConsoleState,
	snapshotConsoleState,
} from "~/features/console/console.store";
import {
	restoreFilesystemState,
	snapshotFilesystemState,
} from "~/features/filesystem/filesystem.store";
import {
	restoreHooksState,
	snapshotHooksState,
} from "~/features/hooks/hooks.store";
import {
	restoreIl2cppState,
	snapshotIl2cppState,
} from "~/features/il2cpp/il2cpp.store";
import {
	restoreJavaState,
	snapshotJavaState,
} from "~/features/java/java.store";
import {
	restoreMemoryState,
	snapshotMemoryState,
} from "~/features/memory/memory.store";
import {
	restoreMonitorState,
	snapshotMonitorState,
} from "~/features/memory/monitor.store";
import {
	restoreModuleState,
	snapshotModuleState,
} from "~/features/module/module.store";
import {
	restoreNativeState,
	snapshotNativeState,
} from "~/features/native/native.store";
import {
	restoreResolverState,
	snapshotResolverState,
} from "~/features/native/resolver.store";
import {
	restoreNetworkState,
	snapshotNetworkState,
} from "~/features/network/network.store";
import {
	restoreObjcState,
	snapshotObjcState,
} from "~/features/objc/objc.store";
import {
	restorePinboardState,
	snapshotPinboardState,
} from "~/features/pinboard/pinboard.store";
import {
	registerSessionLifecycleListener,
} from "~/features/session/session.store";
import {
	restoreScriptState,
	snapshotScriptState,
} from "~/features/script/script.store";
import {
	restoreSwiftState,
	snapshotSwiftState,
} from "~/features/swift/swift.store";
import {
	restoreThreadState,
	snapshotThreadState,
} from "~/features/thread/thread.store";
import {
	restoreNavigationState,
	snapshotNavigationState,
} from "~/lib/navigation";

type SessionScopedSnapshot = {
	navigation: ReturnType<typeof snapshotNavigationState>;
	callgraph: ReturnType<typeof snapshotCallgraphState>;
	console: ReturnType<typeof snapshotConsoleState>;
	filesystem: ReturnType<typeof snapshotFilesystemState>;
	hooks: ReturnType<typeof snapshotHooksState>;
	il2cpp: ReturnType<typeof snapshotIl2cppState>;
	java: ReturnType<typeof snapshotJavaState>;
	memory: ReturnType<typeof snapshotMemoryState>;
	monitor: ReturnType<typeof snapshotMonitorState>;
	module: ReturnType<typeof snapshotModuleState>;
	native: ReturnType<typeof snapshotNativeState>;
	network: ReturnType<typeof snapshotNetworkState>;
	objc: ReturnType<typeof snapshotObjcState>;
	pinboard: ReturnType<typeof snapshotPinboardState>;
	resolver: ReturnType<typeof snapshotResolverState>;
	script: ReturnType<typeof snapshotScriptState>;
	swift: ReturnType<typeof snapshotSwiftState>;
	thread: ReturnType<typeof snapshotThreadState>;
	antiDetect: ReturnType<typeof snapshotAntiDetectState>;
};

const sessionSnapshots = new Map<string, SessionScopedSnapshot>();

function captureCurrentSessionSnapshot(): SessionScopedSnapshot {
	return {
		navigation: snapshotNavigationState(),
		callgraph: snapshotCallgraphState(),
		console: snapshotConsoleState(),
		filesystem: snapshotFilesystemState(),
		hooks: snapshotHooksState(),
		il2cpp: snapshotIl2cppState(),
		java: snapshotJavaState(),
		memory: snapshotMemoryState(),
		monitor: snapshotMonitorState(),
		module: snapshotModuleState(),
		native: snapshotNativeState(),
		network: snapshotNetworkState(),
		objc: snapshotObjcState(),
		pinboard: snapshotPinboardState(),
		resolver: snapshotResolverState(),
		script: snapshotScriptState(),
		swift: snapshotSwiftState(),
		thread: snapshotThreadState(),
		antiDetect: snapshotAntiDetectState(),
	};
}

function restoreSessionSnapshot(snapshot?: SessionScopedSnapshot): void {
	restoreNavigationState(snapshot?.navigation);
	restoreCallgraphState(snapshot?.callgraph);
	restoreConsoleState(snapshot?.console);
	restoreFilesystemState(snapshot?.filesystem);
	restoreHooksState(snapshot?.hooks);
	restoreIl2cppState(snapshot?.il2cpp);
	restoreJavaState(snapshot?.java);
	restoreMemoryState(snapshot?.memory);
	restoreMonitorState(snapshot?.monitor);
	restoreModuleState(snapshot?.module);
	restoreNativeState(snapshot?.native);
	restoreNetworkState(snapshot?.network);
	restoreObjcState(snapshot?.objc);
	restorePinboardState(snapshot?.pinboard);
	restoreResolverState(snapshot?.resolver);
	restoreScriptState(snapshot?.script);
	restoreSwiftState(snapshot?.swift);
	restoreThreadState(snapshot?.thread);
	restoreAntiDetectState(snapshot?.antiDetect);
}

function saveSessionSnapshot(sessionId: string | null): void {
	if (!sessionId) {
		return;
	}

	sessionSnapshots.set(sessionId, captureCurrentSessionSnapshot());
}

function loadSessionSnapshot(sessionId: string | null): void {
	restoreSessionSnapshot(
		typeof sessionId === "string" ? sessionSnapshots.get(sessionId) : undefined,
	);
}

registerSessionLifecycleListener({
	beforeSessionChange(currentSessionId) {
		saveSessionSnapshot(currentSessionId);
	},
	afterSessionChange(activeSessionId) {
		loadSessionSnapshot(activeSessionId);
	},
	onSessionRemoved(sessionId) {
		sessionSnapshots.delete(sessionId);
	},
});
