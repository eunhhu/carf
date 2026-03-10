import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { SessionInfo } from "~/lib/types";

const MAX_SESSIONS = 5;

interface SessionState {
	sessions: SessionInfo[];
	activeSessionId: string | null;
}

const [state, setState] = createStore<SessionState>({
	sessions: [],
	activeSessionId: null,
});

const activeSession = () =>
	state.sessions.find((s) => s.id === state.activeSessionId) ?? null;

function addSession(session: SessionInfo): void {
	const existingIndex = state.sessions.findIndex(
		(item) => item.id === session.id,
	);
	if (existingIndex !== -1) {
		setState("sessions", existingIndex, session);
		setState("activeSessionId", session.id);
		return;
	}

	if (state.sessions.length >= MAX_SESSIONS) {
		return;
	}
	setState("sessions", (prev) => [...prev, session]);
	setState("activeSessionId", session.id);
}

function removeSession(sessionId: string): void {
	const remainingSessions = state.sessions.filter((s) => s.id !== sessionId);

	setState("sessions", remainingSessions);

	if (state.activeSessionId === sessionId) {
		setState("activeSessionId", remainingSessions[0]?.id ?? null);
	}

	if (remainingSessions.length === 0) {
		setAppView("process");
	}
}

function switchSession(sessionId: string): void {
	const exists = state.sessions.some((s) => s.id === sessionId);
	if (exists) {
		setState("activeSessionId", sessionId);
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

export {
	state as sessionState,
	activeSession,
	addSession,
	removeSession,
	switchSession,
	updateSessionStatus,
	appView,
	setAppView,
};
