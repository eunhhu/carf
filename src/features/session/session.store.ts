import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
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
  if (state.sessions.length >= MAX_SESSIONS) {
    return;
  }
  setState("sessions", (prev) => [...prev, session]);
  setState("activeSessionId", session.id);
}

function removeSession(sessionId: string): void {
  setState("sessions", (prev) => prev.filter((s) => s.id !== sessionId));
  if (state.activeSessionId === sessionId) {
    setState("activeSessionId", state.sessions[0]?.id ?? null);
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
  setState(
    "sessions",
    (s) => s.id === sessionId,
    "status",
    status,
  );
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
