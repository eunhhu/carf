import { For, Show } from "solid-js";
import {
  sessionState,
  switchSession,
  removeSession,
} from "./session.store";
import { cn } from "~/lib/cn";

export function SessionTabBar() {
  return (
    <div class="flex h-9 items-center border-b bg-surface px-2">
      <For each={sessionState.sessions}>
        {(session) => {
          const isActive = () => session.id === sessionState.activeSessionId;

          return (
            <button
              class={cn(
                "group flex h-7 items-center gap-2 rounded-md px-3 text-xs transition-colors",
                isActive()
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
              onClick={() => switchSession(session.id)}
            >
              {/* Status dot */}
              <span
                class={cn(
                  "h-1.5 w-1.5 rounded-full",
                  session.status === "active" && "bg-success",
                  session.status === "paused" && "bg-warning",
                  session.status === "detached" && "bg-destructive",
                  session.status === "crashed" && "bg-destructive",
                )}
              />

              {/* Label */}
              <span class="max-w-[160px] truncate font-mono">
                {session.processName}
              </span>
              <span class="text-muted-foreground">({session.pid})</span>

              {/* Close button */}
              <span
                role="button"
                class="ml-1 hidden h-4 w-4 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground group-hover:inline-flex"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSession(session.id);
                }}
              >
                &times;
              </span>
            </button>
          );
        }}
      </For>

      <Show when={sessionState.sessions.length === 0}>
        <span class="px-3 text-xs text-muted-foreground">
          No active sessions
        </span>
      </Show>
    </div>
  );
}
