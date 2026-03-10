import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { SessionInfo } from "~/lib/types";

const MAX_SESSIONS = 5;

interface SessionState {
	sessions: SessionInfo[];
	activeSessionId: string | null;
}

interface SessionLifecycleListener {
	beforeSessionChange?: (currentSessionId: string | null, nextSessionId: string | null) => void;
	afterSessionChange?: (activeSessionId: string | null) => void;
	onSessionRemoved?: (sessionId: string) => void;
}

const [state, setState] = createStore<SessionState>({
	sessions: [],
	activeSessionId: null,
});
const lifecycleListeners = new Set<SessionLifecycleListener>();

const activeSession = () =>
	state.sessions.find((s) => s.id === state.activeSessionId) ?? null;

function notifyBeforeSessionChange(nextSessionId: string | null): void {
	for (const listener of lifecycleListeners) {
		listener.beforeSessionChange?.(state.activeSessionId, nextSessionId);
	}
}

function notifyAfterSessionChange(): void {
	for (const listener of lifecycleListeners) {
		listener.afterSessionChange?.(state.activeSessionId);
	}
}

function addSession(session: SessionInfo): void {
	const existingIndex = state.sessions.findIndex(
		(item) => item.id === session.id,
	);
	if (existingIndex !== -1) {
		notifyBeforeSessionChange(session.id);
		setState("sessions", existingIndex, session);
		setState("activeSessionId", session.id);
		notifyAfterSessionChange();
		return;
	}

	if (state.sessions.length >= MAX_SESSIONS) {
		return;
	}
	notifyBeforeSessionChange(session.id);
	setState("sessions", (prev) => [...prev, session]);
	setState("activeSessionId", session.id);
	notifyAfterSessionChange();
}

function removeSession(sessionId: string): void {
	const remainingSessions = state.sessions.filter((s) => s.id !== sessionId);
	const nextSessionId =
		state.activeSessionId === sessionId ? (remainingSessions[0]?.id ?? null) : state.activeSessionId;

	if (state.activeSessionId === sessionId) {
		notifyBeforeSessionChange(nextSessionId);
	}

	setState("sessions", remainingSessions);

	if (state.activeSessionId === sessionId) {
		setState("activeSessionId", remainingSessions[0]?.id ?? null);
		notifyAfterSessionChange();
	}

	for (const listener of lifecycleListeners) {
		listener.onSessionRemoved?.(sessionId);
	}

	if (remainingSessions.length === 0) {
		setAppView("process");
	}
}

function switchSession(sessionId: string): void {
	const exists = state.sessions.some((s) => s.id === sessionId);
	if (exists && state.activeSessionId !== sessionId) {
		notifyBeforeSessionChange(sessionId);
		setState("activeSessionId", sessionId);
		notifyAfterSessionChange();
	}
}

function updateSessionStatus(
	sessionId: string,
	status: SessionInfo["status"],
): void {
	setState("sessions", (s) => s.id === sessionId, "status", status);
}

// View state signal (which view is shown: device, process, or session)
export type AppView = "device" | "process" | "session";
const [appView, setAppView] = createSignal<AppView>("device");

function registerSessionLifecycleListener(listener: SessionLifecycleListener): () => void {
	lifecycleListeners.add(listener);
	return () => {
		lifecycleListeners.delete(listener);
	};
}

export {
	state as sessionState,
	activeSession,
	addSession,
	removeSession,
	switchSession,
	updateSessionStatus,
	appView,
	setAppView,
	registerSessionLifecycleListener,
};
