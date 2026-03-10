import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import {
  filteredMessages,
  levelFilter,
  setLevelFilter,
  sourceFilter,
  setSourceFilter,
  evaluateCode,
  setupConsoleListeners,
} from "./console.store";
import { activeSession } from "~/features/session/session.store";
import { cn } from "~/lib/cn";
import { formatTimestamp } from "~/lib/format";
import type { ConsoleLevel, ConsoleSource } from "~/lib/types";

function ConsoleTab() {
  const [replInput, setReplInput] = createSignal("");

  createEffect(() => {
    const session = activeSession();
    if (!session) return;
    const cleanup = setupConsoleListeners(session.id);
    onCleanup(cleanup);
  });

  function handleReplKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const code = replInput().trim();
      if (!code) return;
      const session = activeSession();
      if (session) {
        void evaluateCode(session.id, code);
      }
      setReplInput("");
    }
  }

  return (
    <div class="flex h-full flex-col">
      {/* Header */}
      <div class="flex items-center justify-between border-b px-4 py-2">
        <div class="flex items-center gap-2">
          <span class="font-mono text-sm text-muted-foreground">&gt;_</span>
          <h2 class="text-sm font-semibold">Console</h2>
        </div>
        <div class="flex items-center gap-2">
          {/* Level filter */}
          <select
            class="rounded border bg-background px-1.5 py-0.5 text-xs"
            value={levelFilter()}
            onChange={(e) =>
              setLevelFilter(e.currentTarget.value as ConsoleLevel | "all")
            }
          >
            <option value="all">All Levels</option>
            <option value="log">Log</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>

          {/* Source filter */}
          <select
            class="rounded border bg-background px-1.5 py-0.5 text-xs"
            value={sourceFilter()}
            onChange={(e) =>
              setSourceFilter(e.currentTarget.value as ConsoleSource | "all")
            }
          >
            <option value="all">All Sources</option>
            <option value="agent">Agent</option>
            <option value="system">System</option>
            <option value="user">User</option>
            <option value="hook">Hook</option>
          </select>
        </div>
      </div>

      {/* Message list */}
      <div class="flex-1 overflow-auto font-mono text-xs">
        <For each={filteredMessages()}>
          {(msg) => (
            <div
              class={cn(
                "flex gap-2 border-b border-border/30 px-4 py-1 hover:bg-surface-hover",
                msg.level === "error" && "bg-destructive/5 text-destructive",
                msg.level === "warn" && "bg-warning/5 text-warning",
                msg.level === "debug" && "text-muted-foreground",
              )}
            >
              <span class="shrink-0 text-muted-foreground">
                {formatTimestamp(msg.timestamp)}
              </span>
              <span
                class={cn(
                  "shrink-0 w-12 uppercase",
                  msg.level === "error" && "text-destructive",
                  msg.level === "warn" && "text-warning",
                  msg.level === "info" && "text-primary",
                  msg.level === "debug" && "text-muted-foreground",
                )}
              >
                {msg.level}
              </span>
              <span class="shrink-0 w-14 text-muted-foreground">
                [{msg.source}]
              </span>
              <span class="break-all">{msg.content}</span>
            </div>
          )}
        </For>

        <Show when={filteredMessages().length === 0}>
          <div class="flex h-32 items-center justify-center text-muted-foreground">
            No messages
          </div>
        </Show>
      </div>

      {/* REPL input */}
      <div class="flex items-center border-t px-4">
        <span class="text-sm text-primary">&gt;</span>
        <input
          type="text"
          class="flex-1 bg-transparent px-2 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Evaluate JavaScript in agent context..."
          value={replInput()}
          onInput={(e) => setReplInput(e.currentTarget.value)}
          onKeyDown={handleReplKeyDown}
        />
      </div>
    </div>
  );
}

export default ConsoleTab;
