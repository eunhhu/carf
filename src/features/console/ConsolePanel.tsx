import { For, Show, createSignal } from "solid-js";
import {
  consoleState,
  filteredMessages,
  consolePanelTab,
  setConsolePanelTab,
  levelFilter,
  setLevelFilter,
  clearMessages,
  clearHookEvents,
  addMessage,
  addReplEntry,
  consolePanelHeight,
} from "./console.store";
import { cn } from "~/lib/cn";
import { formatTimestamp } from "~/lib/format";
import type { ConsolePanelTab, ConsoleLevel } from "~/lib/types";

const PANEL_TABS: { id: ConsolePanelTab; label: string }[] = [
  { id: "console", label: "Console" },
  { id: "hookEvents", label: "Hook Events" },
  { id: "system", label: "System" },
  { id: "timeline", label: "Timeline" },
];

export function ConsolePanel() {
  const [replInput, setReplInput] = createSignal("");

  function handleReplSubmit(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const code = replInput().trim();
      if (!code) return;
      addReplEntry(code);
      addMessage("info", "user", `> ${code}`);
      setReplInput("");
      // RPC evaluate would be called here in full implementation
    }
  }

  return (
    <div
      class="flex flex-col border-t bg-surface"
      style={{ height: `${consolePanelHeight()}px` }}
    >
      {/* Tab bar + controls */}
      <div class="flex h-8 items-center justify-between border-b px-2">
        <div class="flex items-center gap-1">
          <For each={PANEL_TABS}>
            {(tab) => (
              <button
                class={cn(
                  "rounded px-2 py-0.5 text-xs transition-colors",
                  consolePanelTab() === tab.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setConsolePanelTab(tab.id)}
              >
                {tab.label}
                <Show when={tab.id === "hookEvents" && consoleState.hookEvents.length > 0}>
                  <span class="ml-1 rounded-full bg-primary/20 px-1 text-[10px] text-primary">
                    {consoleState.hookEvents.length}
                  </span>
                </Show>
              </button>
            )}
          </For>
        </div>

        <div class="flex items-center gap-1">
          {/* Level filter */}
          <Show when={consolePanelTab() === "console"}>
            <select
              class="rounded border bg-background px-1 py-0.5 text-xs text-foreground"
              value={levelFilter()}
              onChange={(e) =>
                setLevelFilter(e.currentTarget.value as ConsoleLevel | "all")
              }
            >
              <option value="all">All</option>
              <option value="log">Log</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </Show>

          {/* Clear */}
          <button
            class="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (consolePanelTab() === "hookEvents") {
                clearHookEvents();
              } else {
                clearMessages();
              }
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div class="flex-1 overflow-auto font-mono text-xs">
        <Show when={consolePanelTab() === "console"}>
          <div class="p-1">
            <For each={filteredMessages()}>
              {(msg) => (
                <div
                  class={cn(
                    "flex gap-2 rounded px-2 py-0.5 hover:bg-surface-hover",
                    msg.level === "error" && "text-destructive",
                    msg.level === "warn" && "text-warning",
                    msg.level === "debug" && "text-muted-foreground",
                  )}
                >
                  <span class="shrink-0 text-muted-foreground">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                  <span class="shrink-0 w-10 text-muted-foreground">
                    [{msg.source}]
                  </span>
                  <span class="break-all">{msg.content}</span>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={consolePanelTab() === "hookEvents"}>
          <div class="p-1">
            <For each={consoleState.hookEvents}>
              {(event) => (
                <div class="flex gap-2 rounded px-2 py-0.5 hover:bg-surface-hover">
                  <span class="shrink-0 text-muted-foreground">
                    {formatTimestamp(event.timestamp)}
                  </span>
                  <span class={cn(
                    "shrink-0 w-12",
                    event.type === "enter" ? "text-success" : "text-primary",
                  )}>
                    {event.type}
                  </span>
                  <span>{event.target}</span>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={consolePanelTab() === "system"}>
          <div class="p-1">
            <For each={consoleState.systemMessages}>
              {(msg) => (
                <div class="flex gap-2 rounded px-2 py-0.5 hover:bg-surface-hover">
                  <span class="shrink-0 text-muted-foreground">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                  <span>{msg.content}</span>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={consolePanelTab() === "timeline"}>
          <div class="flex h-full items-center justify-center text-muted-foreground">
            Timeline visualization (Phase 3)
          </div>
        </Show>
      </div>

      {/* REPL input */}
      <Show when={consolePanelTab() === "console"}>
        <div class="flex items-center border-t px-2">
          <span class="text-xs text-primary">&gt;</span>
          <input
            type="text"
            class="flex-1 bg-transparent px-2 py-1.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Evaluate JavaScript..."
            value={replInput()}
            onInput={(e) => setReplInput(e.currentTarget.value)}
            onKeyDown={handleReplSubmit}
          />
        </div>
      </Show>
    </div>
  );
}
