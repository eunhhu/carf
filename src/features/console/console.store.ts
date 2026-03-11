import { createDeferred, createMemo, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { recordHookEvent } from "~/features/hooks/hooks.store";
import {
	extractEventSessionId,
	normalizeConsoleMessagePayload,
	normalizeHookEventPayload,
} from "~/lib/event-normalizers";
import { generateId } from "~/lib/format";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke, listen } from "~/lib/tauri";
import type {
	ConsoleLevel,
	ConsoleMessage,
	ConsolePanelTab,
	ConsoleSource,
	HookEvent,
	SessionDetachedEvent,
} from "~/lib/types";

const MAX_MESSAGES = 10_000;

interface ConsoleState {
	messages: ConsoleMessage[];
	hookEvents: HookEvent[];
	systemMessages: ConsoleMessage[];
	replHistory: string[];
}

const DEFAULT_STATE: ConsoleState = {
	messages: [],
	hookEvents: [],
	systemMessages: [],
	replHistory: [],
};

const [state, setState] = createStore<ConsoleState>({
	...DEFAULT_STATE,
});

// Filters
const [levelFilter, setLevelFilter] = createSignal<ConsoleLevel | "all">("all");
const [sourceFilter, setSourceFilter] = createSignal<ConsoleSource | "all">(
	"all",
);
const deferredLevelFilter = createDeferred(levelFilter);
const deferredSourceFilter = createDeferred(sourceFilter);
const [consolePanelTab, setConsolePanelTab] =
	createSignal<ConsolePanelTab>("console");
const [consolePanelOpen, setConsolePanelOpen] = createSignal(true);
const [consolePanelHeight, setConsolePanelHeight] = createSignal(200);

function addMessage(
	level: ConsoleLevel,
	source: ConsoleSource,
	content: string,
	data?: unknown,
): void {
	const message: ConsoleMessage = {
		id: generateId(),
		timestamp: Date.now(),
		level,
		source,
		content,
		data,
	};

	setState("messages", (prev) => {
		const next = [...prev, message];
		return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
	});

	if (source === "system") {
		setState("systemMessages", (prev) => {
			const next = [...prev, message];
			return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
		});
	}
}

function addHookEvent(event: HookEvent): void {
	setState("hookEvents", (prev) => {
		const next = [...prev, event];
		return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
	});
}

function addReplEntry(code: string): void {
	setState("replHistory", (prev) => [...prev, code]);
}

function clearMessages(): void {
	setState("messages", []);
}

function clearHookEvents(): void {
	setState("hookEvents", []);
}

function resetConsoleState(): void {
	setState(restoreStore(DEFAULT_STATE));
	setLevelFilter("all");
	setSourceFilter("all");
	setConsolePanelTab("console");
}

function snapshotConsoleState(): {
	state: ConsoleState;
	levelFilter: ConsoleLevel | "all";
	sourceFilter: ConsoleSource | "all";
	consolePanelTab: ConsolePanelTab;
} {
	return {
		state: snapshotStore(state),
		levelFilter: levelFilter(),
		sourceFilter: sourceFilter(),
		consolePanelTab: consolePanelTab(),
	};
}

function restoreConsoleState(snapshot?: {
	state: ConsoleState;
	levelFilter: ConsoleLevel | "all";
	sourceFilter: ConsoleSource | "all";
	consolePanelTab: ConsolePanelTab;
}): void {
	if (!snapshot) {
		resetConsoleState();
		return;
	}

	setState(restoreStore(snapshot.state));
	setLevelFilter(snapshot.levelFilter);
	setSourceFilter(snapshot.sourceFilter);
	setConsolePanelTab(snapshot.consolePanelTab);
}

const filteredMessages = createMemo(() => {
	let msgs = state.messages;
	const level = deferredLevelFilter();
	const source = deferredSourceFilter();
	if (level !== "all") {
		msgs = msgs.filter((m) => m.level === level);
	}
	if (source !== "all") {
		msgs = msgs.filter((m) => m.source === source);
	}
	return msgs;
});

async function evaluateCode(sessionId: string, code: string): Promise<void> {
	addReplEntry(code);
	addMessage("info", "user", `> ${code}`);
	try {
		await invoke<unknown>("rpc_call", {
			sessionId,
			method: "evaluate",
			params: { code },
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		addMessage("error", "agent", message);
	}
}

function setupConsoleListeners(sessionId: string): () => void {
	const unlistenMessage = listen<{
		level: ConsoleLevel;
		source: ConsoleSource;
		content: string;
		data?: unknown;
	}>("carf://console/message", (payload) => {
		if (extractEventSessionId(payload) !== sessionId) {
			return;
		}
		const message = normalizeConsoleMessagePayload(payload);
		addMessage(message.level, message.source, message.content, message.data);
	});

	const unlistenHook = listen<HookEvent>("carf://hook/event", (payload) => {
		if (extractEventSessionId(payload) !== sessionId) {
			return;
		}
		const event = normalizeHookEventPayload(payload);
		addHookEvent(event);
		recordHookEvent(event);
	});

	const unlistenDetached = listen<SessionDetachedEvent>(
		"carf://session/detached",
		(payload) => {
			if (payload.sessionId === sessionId) {
				addMessage("warn", "system", `Session detached: ${payload.reason}`);
			}
		},
	);

	return () => {
		unlistenMessage();
		unlistenHook();
		unlistenDetached();
	};
}

export {
	state as consoleState,
	filteredMessages,
	addMessage,
	addHookEvent,
	addReplEntry,
	clearMessages,
	clearHookEvents,
	resetConsoleState,
	snapshotConsoleState,
	restoreConsoleState,
	levelFilter,
	setLevelFilter,
	sourceFilter,
	setSourceFilter,
	consolePanelTab,
	setConsolePanelTab,
	consolePanelOpen,
	setConsolePanelOpen,
	consolePanelHeight,
	setConsolePanelHeight,
	evaluateCode,
	setupConsoleListeners,
};
