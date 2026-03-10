import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import { SessionTabBar } from "./SessionTabBar";
import { SessionToolbar } from "./SessionToolbar";
import { SessionNavBar } from "./SessionNavBar";
import { SessionMainContent } from "./SessionMainContent";
import { InspectorPanel } from "./InspectorPanel";
import { ConsolePanel } from "~/features/console/ConsolePanel";
import { CommandPalette } from "~/components/CommandPalette";
import { settingsState, toggleInspector, toggleConsole } from "~/features/settings/settings.store";
import { activeTab, setActiveTab } from "~/lib/navigation";
import { TAB_DEFINITIONS } from "~/lib/types";
import { listen } from "~/lib/tauri";
import { addMessage, addHookEvent, clearMessages } from "~/features/console/console.store";
import {
  activeSession,
  updateSessionStatus,
} from "~/features/session/session.store";
import type { HookEvent, SessionDetachedEvent, ProcessCrashedEvent } from "~/lib/types";
import { fetchModules } from "~/features/module/module.store";
import { fetchRanges } from "~/features/memory/memory.store";

export function SessionView() {
  const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);

  // Set up session event listeners whenever the active session changes
  createEffect(() => {
    const session = activeSession();
    if (!session) return;

    const sessionId = session.id;

    const unlistenMessage = listen<{
      level: "log" | "warn" | "error" | "info" | "debug";
      source: "agent" | "system" | "user" | "hook";
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
          updateSessionStatus(sessionId, "detached");
          addMessage("error", "system", "Session detached");
        }
      },
    );

    const unlistenCrashed = listen<ProcessCrashedEvent>(
      "carf://process/crashed",
      (payload) => {
        if (payload.sessionId === sessionId) {
          updateSessionStatus(sessionId, "crashed");
          const summary = payload.crashReport?.summary ?? "Unknown crash";
          addMessage(
            "error",
            "system",
            `Process crashed: ${summary}`,
            payload.crashReport,
          );
        }
      },
    );

    onCleanup(() => {
      unlistenMessage();
      unlistenHook();
      unlistenDetached();
      unlistenCrashed();
    });
  });

  // Keyboard shortcuts
  function handleKeyDown(e: KeyboardEvent) {
    const meta = e.metaKey || e.ctrlKey;

    if (meta && e.shiftKey && e.key === "p") {
      e.preventDefault();
      setCommandPaletteOpen(true);
      return;
    }
    if (meta && e.shiftKey && e.key === "b") {
      e.preventDefault();
      setActiveTab("pinboard");
      return;
    }
    if (meta && e.key === "i") {
      e.preventDefault();
      toggleInspector();
      return;
    }
    if (meta && e.key === "j") {
      e.preventDefault();
      toggleConsole();
      return;
    }
    if (meta && e.key === "l") {
      e.preventDefault();
      clearMessages();
      return;
    }
    if (meta && e.key === "k") {
      e.preventDefault();
      // Focus REPL input — handled by ConsolePanel via document event
      document.dispatchEvent(new CustomEvent("carf:focus-repl"));
      return;
    }
    if (meta && e.key === "r") {
      e.preventDefault();
      const session = activeSession();
      if (!session) return;
      const tab = activeTab();
      if (tab === "modules") {
        fetchModules(session.id).catch(() => {});
      } else if (tab === "memory") {
        fetchRanges(session.id).catch(() => {});
      }
      return;
    }

    // Tab switching: Cmd+1 through Cmd+0
    if (meta && !e.shiftKey) {
      const num = parseInt(e.key, 10);
      if (num >= 0 && num <= 9) {
        e.preventDefault();
        const tab = TAB_DEFINITIONS.find((t) => t.shortcutIndex === num);
        if (tab) {
          setActiveTab(tab.id);
        }
      }
    }
  }

  createEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <div class="flex h-full flex-col">
      {/* Session tabs (multi-session) */}
      <SessionTabBar />

      {/* Session toolbar */}
      <SessionToolbar />

      {/* Main area: NavBar + Content + Inspector */}
      <div class="flex flex-1 overflow-hidden">
        {/* Left: Icon rail navigation */}
        <SessionNavBar activeTab={activeTab()} onTabChange={setActiveTab} />

        {/* Center: Main content */}
        <div class="flex-1 overflow-hidden">
          <SessionMainContent activeTab={activeTab()} />
        </div>

        {/* Right: Inspector panel */}
        <Show when={settingsState.inspectorOpen}>
          <InspectorPanel />
        </Show>
      </div>

      {/* Bottom: Console panel */}
      <Show when={settingsState.consoleOpen}>
        <ConsolePanel />
      </Show>

      {/* Command Palette */}
      <Show when={commandPaletteOpen()}>
        <CommandPalette
          open={commandPaletteOpen()}
          onClose={() => setCommandPaletteOpen(false)}
        />
      </Show>
    </div>
  );
}
