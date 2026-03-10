import {
	restoreCallgraphState,
	snapshotCallgraphState,
} from "~/features/callgraph/callgraph.store";
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
	restoreAntiDetectState,
	snapshotAntiDetectState,
} from "~/features/session/antidetect.store";
import {
	restoreScriptState,
	snapshotScriptState,
} from "~/features/script/script.store";
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
