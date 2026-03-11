import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
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
  consolePanelHeight,
  evaluateCode,
} from "./console.store";
import { activeSession } from "~/features/session/session.store";
import { CopyButton } from "~/components/CopyButton";
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
  let replInputRef: HTMLInputElement | undefined;

  createEffect(() => {
    const focusRepl = () => replInputRef?.focus();
    document.addEventListener("carf:focus-repl", focusRepl);
    onCleanup(() => document.removeEventListener("carf:focus-repl", focusRepl));
  });

  function handleReplSubmit(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const code = replInput().trim();
      if (!code) return;
      const session = activeSession();
      if (!session) {
        addMessage("warn", "system", "No active session for REPL evaluation");
        return;
      }

      void evaluateCode(session.id, code);
      setReplInput("");
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
                  "cursor-pointer rounded px-2 py-0.5 text-xs transition-colors",
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
            class="cursor-pointer rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
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
                    "group/row flex items-center gap-2 rounded px-2 py-0.5 hover:bg-surface-hover",
                    msg.level === "error" && "text-destructive",
                    msg.level === "warn" && "text-warning",
                    msg.level === "debug" && "text-muted-foreground",
                  )}
                >
                  <span class="shrink-0 text-muted-foreground">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                  <span class="w-10 shrink-0 text-muted-foreground">
                    [{msg.source}]
                  </span>
                  <span class="min-w-0 flex-1 break-all">{msg.content}</span>
                  <CopyButton value={msg.content} class="shrink-0 opacity-0 group-hover/row:opacity-100" />
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={consolePanelTab() === "hookEvents"}>
          <div class="p-1">
            <For each={consoleState.hookEvents}>
              {(event) => (
                <div class="group/row flex items-center gap-2 rounded px-2 py-0.5 hover:bg-surface-hover">
                  <span class="shrink-0 text-muted-foreground">
                    {formatTimestamp(event.timestamp)}
                  </span>
                  <span class={cn(
                    "w-12 shrink-0",
                    event.type === "enter" ? "text-success" : "text-primary",
                  )}>
                    {event.type}
                  </span>
                  <span class="min-w-0 flex-1 truncate">{event.target}</span>
                  <CopyButton value={event.target} class="shrink-0 opacity-0 group-hover/row:opacity-100" />
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={consolePanelTab() === "system"}>
          <div class="p-1">
            <For each={consoleState.systemMessages}>
              {(msg) => (
                <div class="group/row flex items-center gap-2 rounded px-2 py-0.5 hover:bg-surface-hover">
                  <span class="shrink-0 text-muted-foreground">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                  <span class="min-w-0 flex-1 truncate">{msg.content}</span>
                  <CopyButton value={msg.content} class="shrink-0 opacity-0 group-hover/row:opacity-100" />
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={consolePanelTab() === "timeline"}>
          <TimelineView />
        </Show>
      </div>

      {/* REPL input */}
      <Show when={consolePanelTab() === "console"}>
        <div class="flex items-center border-t px-2">
          <span class="text-xs text-primary">&gt;</span>
          <input
            ref={replInputRef}
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

interface TimelineEntry {
  id: string;
  timestamp: number;
  kind: "message" | "hook" | "system";
  label: string;
  detail: string;
  color: string;
}

function TimelineView() {
  const [kindFilter, setKindFilter] = createSignal<TimelineEntry["kind"] | "all">("all");

  const entries = createMemo<TimelineEntry[]>(() => {
    const result: TimelineEntry[] = [];

    for (const msg of consoleState.messages) {
      result.push({
        id: msg.id,
        timestamp: msg.timestamp,
        kind: "message",
        label: msg.level.toUpperCase(),
        detail: msg.content,
        color:
          msg.level === "error"
            ? "bg-destructive"
            : msg.level === "warn"
              ? "bg-warning"
              : "bg-primary",
      });
    }

    for (const evt of consoleState.hookEvents) {
      result.push({
        id: `hook-${evt.hookId}-${evt.timestamp}`,
        timestamp: evt.timestamp,
        kind: "hook",
        label: evt.type === "enter" ? "ENTER" : "LEAVE",
        detail: evt.target,
        color: evt.type === "enter" ? "bg-success" : "bg-cyan-500",
      });
    }

    for (const msg of consoleState.systemMessages) {
      result.push({
        id: `sys-${msg.id}`,
        timestamp: msg.timestamp,
        kind: "system",
        label: "SYSTEM",
        detail: msg.content,
        color: "bg-muted-foreground",
      });
    }

    result.sort((a, b) => a.timestamp - b.timestamp);
    return result;
  });

  const filteredEntries = createMemo(() => {
    const k = kindFilter();
    if (k === "all") return entries();
    return entries().filter((e) => e.kind === k);
  });

  // Compute time range for the visual bar
  const timeRange = createMemo(() => {
    const e = entries();
    if (e.length === 0) return { min: 0, max: 1 };
    return { min: e[0].timestamp, max: e[e.length - 1].timestamp };
  });

  function barPosition(ts: number): string {
    const { min, max } = timeRange();
    const range = max - min;
    if (range <= 0) return "0%";
    return `${((ts - min) / range) * 100}%`;
  }

  return (
    <div class="flex h-full flex-col">
      {/* Timeline bar visualization */}
      <div class="border-b px-2 py-1.5">
        <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
          <select
            class="rounded border bg-background px-1 py-0.5 text-xs"
            value={kindFilter()}
            onChange={(e) =>
              setKindFilter(e.currentTarget.value as TimelineEntry["kind"] | "all")
            }
          >
            <option value="all">All</option>
            <option value="message">Messages</option>
            <option value="hook">Hook Events</option>
            <option value="system">System</option>
          </select>
          <span>{filteredEntries().length} events</span>
        </div>
        {/* Mini timeline bar */}
        <div class="relative mt-1 h-3 rounded bg-muted">
          <For each={filteredEntries().slice(-200)}>
            {(entry) => (
              <div
                class={cn("absolute top-0 h-3 w-px", entry.color)}
                style={{ left: barPosition(entry.timestamp) }}
                title={`${new Date(entry.timestamp).toLocaleTimeString()} ${entry.label}: ${entry.detail.slice(0, 60)}`}
              />
            )}
          </For>
        </div>
      </div>

      {/* Event list */}
      <div class="flex-1 overflow-auto p-1">
        <For each={filteredEntries()}>
          {(entry) => (
            <div class="group/row flex items-center gap-2 rounded px-2 py-0.5 hover:bg-surface-hover">
              <span class="shrink-0 text-[10px] text-muted-foreground">
                {formatTimestamp(entry.timestamp)}
              </span>
              <span
                class={cn(
                  "w-14 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-medium",
                  entry.kind === "hook" && "bg-success/10 text-success",
                  entry.kind === "system" && "bg-muted text-muted-foreground",
                  entry.kind === "message" && "bg-primary/10 text-primary",
                )}
              >
                {entry.label}
              </span>
              <span class="min-w-0 flex-1 truncate text-xs">{entry.detail}</span>
              <CopyButton value={entry.detail} class="shrink-0 opacity-0 group-hover/row:opacity-100" />
            </div>
          )}
        </For>
        <Show when={filteredEntries().length === 0}>
          <div class="flex h-full items-center justify-center text-xs text-muted-foreground">
            No timeline events
          </div>
        </Show>
      </div>
    </div>
  );
}
