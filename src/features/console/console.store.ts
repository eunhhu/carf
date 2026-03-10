import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import type {
  ConsoleMessage,
  ConsoleLevel,
  ConsoleSource,
  ConsolePanelTab,
  HookEvent,
  SessionDetachedEvent,
} from "~/lib/types";
import { generateId } from "~/lib/format";
import { invoke, listen } from "~/lib/tauri";

const MAX_MESSAGES = 10_000;

interface ConsoleState {
  messages: ConsoleMessage[];
  hookEvents: HookEvent[];
  systemMessages: ConsoleMessage[];
  replHistory: string[];
}

const [state, setState] = createStore<ConsoleState>({
  messages: [],
  hookEvents: [],
  systemMessages: [],
  replHistory: [],
});

// Filters
const [levelFilter, setLevelFilter] = createSignal<ConsoleLevel | "all">("all");
const [sourceFilter, setSourceFilter] = createSignal<ConsoleSource | "all">(
  "all",
);
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

const filteredMessages = () => {
  let msgs = state.messages;
  const level = levelFilter();
  const source = sourceFilter();
  if (level !== "all") {
    msgs = msgs.filter((m) => m.level === level);
  }
  if (source !== "all") {
    msgs = msgs.filter((m) => m.source === source);
  }
  return msgs;
};

async function evaluateCode(sessionId: string, code: string): Promise<void> {
  addReplEntry(code);
  addMessage("info", "user", `> ${code}`);
  try {
    const result = await invoke<unknown>("rpc_call", {
      sessionId,
      method: "evaluate",
      params: { code },
    });
    const resultStr =
      typeof result === "string" ? result : JSON.stringify(result);
    addMessage("log", "agent", resultStr);
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
    addMessage(payload.level, payload.source, payload.content, payload.data);
  });

  const unlistenHook = listen<HookEvent>("carf://hook/event", (payload) => {
    addHookEvent(payload);
  });

  const unlistenDetached = listen<SessionDetachedEvent>(
    "carf://session/detached",
    (payload) => {
      if (payload.sessionId === sessionId) {
        addMessage(
          "warn",
          "system",
          `Session detached: ${payload.reason}`,
        );
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
