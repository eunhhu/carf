import { createStore } from "solid-js/store";
import { extractEventSessionId } from "~/lib/event-normalizers";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke, listen } from "~/lib/tauri";
import type { MemoryMonitorRange, MemoryMonitorEvent } from "~/lib/types";

interface MonitorState {
	active: boolean;
	ranges: MemoryMonitorRange[];
	events: MemoryMonitorEvent[];
	eventCount: number;
}

const DEFAULT_STATE: MonitorState = {
	active: false,
	ranges: [],
	events: [],
	eventCount: 0,
};

const [monitorState, setMonitorState] = createStore<MonitorState>({
	...DEFAULT_STATE,
});

const MAX_EVENTS = 5000;

async function startMonitor(
	sessionId: string,
	ranges: MemoryMonitorRange[],
): Promise<void> {
	await invoke("rpc_call", {
		sessionId,
		method: "startMemoryMonitor",
		params: { ranges },
	});
	setMonitorState({ active: true, ranges, events: [], eventCount: 0 });
}

async function stopMonitor(sessionId: string): Promise<void> {
	await invoke("rpc_call", {
		sessionId,
		method: "stopMemoryMonitor",
		params: {},
	});
	setMonitorState({ active: false });
}

function setupMonitorListener(sessionId: string): () => void {
	return listen<{ data: MemoryMonitorEvent }>(
		"carf://memory/access",
		(payload) => {
			if (extractEventSessionId(payload) !== sessionId) {
				return;
			}
			const enriched = { ...payload.data, timestamp: Date.now() };

			setMonitorState("eventCount", (c) => c + 1);
			setMonitorState("events", (prev) => {
				const next = [...prev, enriched];
				return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
			});
		},
	);
}

function clearMonitorEvents(): void {
	setMonitorState({ events: [], eventCount: 0 });
}

function snapshotMonitorState(): MonitorState {
	return snapshotStore(monitorState);
}

function restoreMonitorState(snapshot?: MonitorState): void {
	setMonitorState(restoreStore(snapshot ?? DEFAULT_STATE));
}

export {
	monitorState,
	startMonitor,
	stopMonitor,
	setupMonitorListener,
	clearMonitorEvents,
	snapshotMonitorState,
	restoreMonitorState,
};
