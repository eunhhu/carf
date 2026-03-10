import { For, Show, createEffect, onCleanup, onMount } from "solid-js";
import {
  threadState,
  selectThread,
  selectedThread,
  refreshInterval,
  setRefreshInterval,
  fetchThreads,
  fetchBacktrace,
} from "./thread.store";
import { activeSession } from "~/features/session/session.store";
import { cn } from "~/lib/cn";
import { formatAddress } from "~/lib/format";

const STATE_COLORS: Record<string, string> = {
  running: "bg-success",
  waiting: "bg-warning",
  stopped: "bg-destructive",
  halted: "bg-destructive",
  uninterruptible: "bg-muted-foreground",
};

function ThreadsTab() {
  onMount(() => {
    const session = activeSession();
    if (session) {
      void fetchThreads(session.id);
    }
  });

  // Auto-refresh based on refreshInterval signal
  createEffect(() => {
    const interval = refreshInterval();
    if (interval === 0) return;
    const id = setInterval(() => {
      const session = activeSession();
      if (session) {
        void fetchThreads(session.id);
      }
    }, interval);
    onCleanup(() => clearInterval(id));
  });

  function handleSelectThread(threadId: number): void {
    selectThread(threadId);
    const session = activeSession();
    if (session) {
      void fetchBacktrace(session.id, threadId);
    }
  }

  return (
    <div class="flex h-full flex-col">
      {/* Header */}
      <div class="flex items-center justify-between border-b px-4 py-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">Threads</span>
          <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {threadState.threads.length}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground">Auto-refresh:</span>
          <select
            class="rounded border bg-background px-1.5 py-0.5 text-xs"
            value={refreshInterval()}
            onChange={(e) =>
              setRefreshInterval(Number(e.currentTarget.value) as 0 | 2000 | 5000)
            }
          >
            <option value={0}>Off</option>
            <option value={2000}>2s</option>
            <option value={5000}>5s</option>
          </select>
        </div>
      </div>

      {/* Split view: Thread list (35%) + Detail (65%) */}
      <div class="flex flex-1 overflow-hidden">
        {/* Thread list */}
        <div class="w-[35%] overflow-auto border-r">
          <Show
            when={!threadState.loading}
            fallback={
              <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
                Loading threads...
              </div>
            }
          >
            <For each={threadState.threads}>
              {(thread) => {
                const isSelected = () =>
                  threadState.selectedThreadId === thread.id;
                return (
                  <button
                    class={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-surface-hover",
                      isSelected() && "bg-muted",
                    )}
                    onClick={() => handleSelectThread(thread.id)}
                  >
                    <span
                      class={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        STATE_COLORS[thread.state] ?? "bg-muted-foreground",
                      )}
                    />
                    <span class="font-mono text-muted-foreground">
                      #{thread.id}
                    </span>
                    <span class="flex-1 truncate">
                      {thread.name ?? "unnamed"}
                    </span>
                    <span class="text-muted-foreground">{thread.state}</span>
                  </button>
                );
              }}
            </For>
          </Show>
        </div>

        {/* Thread detail */}
        <div class="w-[65%] overflow-auto">
          <Show
            when={selectedThread()}
            fallback={
              <div class="flex h-full items-center justify-center text-xs text-muted-foreground">
                Select a thread to view details
              </div>
            }
          >
            {(thread) => (
              <div class="p-4">
                <h3 class="mb-3 text-sm font-semibold">
                  Thread #{thread().id}
                  <Show when={thread().name}>
                    <span class="ml-2 font-normal text-muted-foreground">
                      ({thread().name})
                    </span>
                  </Show>
                </h3>

                {/* Sub-tabs */}
                <div class="flex gap-2 border-b pb-2 text-xs">
                  <button class="rounded bg-muted px-2 py-0.5 text-foreground">
                    Backtrace
                  </button>
                  <button class="rounded px-2 py-0.5 text-muted-foreground hover:text-foreground">
                    Context
                  </button>
                  <button class="rounded px-2 py-0.5 text-muted-foreground hover:text-foreground">
                    Stalker
                  </button>
                </div>

                {/* Backtrace */}
                <div class="mt-3">
                  <Show
                    when={!threadState.backtraceLoading}
                    fallback={
                      <div class="py-4 text-center text-xs text-muted-foreground">
                        Loading backtrace...
                      </div>
                    }
                  >
                    <For each={threadState.backtrace}>
                      {(frame, idx) => (
                        <div class="flex items-start gap-2 py-1 text-xs">
                          <span class="w-6 shrink-0 text-right text-muted-foreground">
                            {idx()}
                          </span>
                          <span class="shrink-0 font-mono text-muted-foreground">
                            {formatAddress(frame.address)}
                          </span>
                          <div class="flex-1">
                            <Show when={frame.moduleName}>
                              <span class="text-primary">{frame.moduleName}</span>
                              <Show when={frame.symbolName}>
                                <span class="text-muted-foreground">!</span>
                              </Show>
                            </Show>
                            <Show when={frame.symbolName}>
                              <span class="font-mono">{frame.symbolName}</span>
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                    <Show when={threadState.backtrace.length === 0}>
                      <div class="py-4 text-center text-xs text-muted-foreground">
                        No backtrace data
                      </div>
                    </Show>
                  </Show>
                </div>
              </div>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}

export default ThreadsTab;
