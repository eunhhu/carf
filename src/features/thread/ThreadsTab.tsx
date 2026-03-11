import { For, Show, Switch, Match, createEffect, onCleanup } from "solid-js";
import {
  threadState,
  selectThread,
  selectedThread,
  refreshInterval,
  setRefreshInterval,
  threadSubTab,
  setThreadSubTab,
  fetchThreads,
  fetchBacktrace,
  fetchContext,
  startStalker,
  stopStalker,
} from "./thread.store";
import { activeSession } from "~/features/session/session.store";
import { cn } from "~/lib/cn";
import { formatAddress } from "~/lib/format";
import { SplitPane } from "~/components/SplitPane";
import {
  ActionPopover,
  buildAddressActions,
  buildModuleActions,
  buildThreadActions,
} from "~/components/ActionPopover";
import { CopyButton } from "~/components/CopyButton";
import { InlineActions } from "~/components/InlineActions";
import { navigateTo } from "~/lib/navigation";

const STATE_COLORS: Record<string, string> = {
  running: "bg-success",
  waiting: "bg-warning",
  stopped: "bg-destructive",
  halted: "bg-destructive",
  uninterruptible: "bg-muted-foreground",
};

function ThreadsTab() {
  createEffect(() => {
    const sessionId = activeSession()?.id;
    if (sessionId) {
      void fetchThreads(sessionId);
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
            class="cursor-pointer rounded border bg-background px-1.5 py-0.5 text-xs"
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

      {/* Split view: Thread list + Detail */}
      <div class="flex-1 overflow-hidden">
        <SplitPane
          id="threads"
          minLeft={180}
          maxLeft={350}
          defaultLeft={250}
          left={
            <div class="h-full overflow-auto">
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
                          "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-surface-hover",
                          isSelected() && "bg-muted",
                        )}
                        onClick={() => handleSelectThread(thread.id)}
                      >
                        <span
                          class={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            STATE_COLORS[thread.state] ?? "bg-muted-foreground",
                          )}
                          title={thread.state}
                        />
                        <ActionPopover
                          type="thread"
                          value={String(thread.id)}
                          actions={buildThreadActions(thread.id)}
                        >
                          <span class="cursor-pointer font-mono text-purple-400 border-b border-dashed border-current/40">
                            #{thread.id}
                          </span>
                        </ActionPopover>
                        <CopyButton value={String(thread.id)} />
                        <span class="flex-1 truncate" title={thread.name ?? "unnamed"}>
                          {thread.name ?? "unnamed"}
                        </span>
                        <span class="text-muted-foreground" title={thread.state}>
                          {thread.state}
                        </span>
                      </button>
                    );
                  }}
                </For>
              </Show>
            </div>
          }
          right={
            <div class="h-full overflow-auto">
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
                        <span class="ml-2 font-normal text-muted-foreground" title={thread().name!}>
                          ({thread().name})
                        </span>
                      </Show>
                    </h3>

                    {/* Sub-tabs */}
                    <div class="flex gap-2 border-b pb-2 text-xs">
                      <For each={["backtrace", "context", "stalker"] as const}>
                        {(tab) => (
                          <button
                            class={cn(
                              "cursor-pointer rounded px-2 py-0.5 capitalize",
                              threadSubTab() === tab
                                ? "bg-muted text-foreground"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                            onClick={() => {
                              setThreadSubTab(tab);
                              if (tab === "context") {
                                const session = activeSession();
                                if (session && threadState.selectedThreadId != null) {
                                  void fetchContext(session.id, threadState.selectedThreadId);
                                }
                              }
                            }}
                          >
                            {tab}
                          </button>
                        )}
                      </For>
                    </div>

                    <div class="mt-3">
                      <Switch>
                        <Match when={threadSubTab() === "backtrace"}>
                          <BacktraceView />
                        </Match>
                        <Match when={threadSubTab() === "context"}>
                          <ContextView threadId={thread().id} />
                        </Match>
                        <Match when={threadSubTab() === "stalker"}>
                          <StalkerView threadId={thread().id} />
                        </Match>
                      </Switch>
                    </div>
                  </div>
                )}
              </Show>
            </div>
          }
        />
      </div>
    </div>
  );
}

function BacktraceView() {
  return (
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
          <div class="group/row flex items-center gap-2 rounded py-1 text-xs hover:bg-surface-hover">
            <span class="w-6 shrink-0 text-right text-muted-foreground">
              {idx()}
            </span>
            <ActionPopover
              type="address"
              value={frame.address}
              actions={buildAddressActions(frame.address, frame.moduleName ?? undefined)}
            >
              <span class="shrink-0 font-mono" title={frame.address}>
                {formatAddress(frame.address)}
              </span>
            </ActionPopover>
            <CopyButton value={frame.address} />
            <div class="flex-1 truncate">
              <Show when={frame.moduleName}>
                <ActionPopover
                  type="module"
                  value={frame.moduleName!}
                  actions={buildModuleActions(frame.moduleName!)}
                >
                  <span title={frame.moduleName!}>{frame.moduleName}</span>
                </ActionPopover>
                <Show when={frame.symbolName}>
                  <span class="text-muted-foreground">!</span>
                </Show>
              </Show>
              <Show when={frame.symbolName}>
                <span class="font-mono" title={frame.symbolName!}>
                  {frame.symbolName}
                </span>
              </Show>
            </div>
            <InlineActions
              primary={[
                {
                  label: "Hook",
                  variant: "primary",
                  onClick: (e) => {
                    e.stopPropagation();
                    navigateTo({
                      tab: "native",
                      context: { address: frame.address, action: "hook" },
                    });
                  },
                },
              ]}
              overflow={[
                {
                  label: "Copy Address",
                  onClick: () => {
                    void navigator.clipboard.writeText(frame.address);
                  },
                },
                {
                  label: "View in Memory",
                  onClick: () =>
                    navigateTo({
                      tab: "memory",
                      context: { address: frame.address, action: "hexview" },
                    }),
                },
                {
                  label: "Start Stalker on Thread",
                  onClick: () => {
                    setThreadSubTab("stalker");
                  },
                },
              ]}
            />
          </div>
        )}
      </For>
      <Show when={threadState.backtrace.length === 0}>
        <div class="py-4 text-center text-xs text-muted-foreground">
          No backtrace data
        </div>
      </Show>
    </Show>
  );
}

function ContextView(props: { threadId: number }) {
  return (
    <Show
      when={!threadState.contextLoading}
      fallback={
        <div class="py-4 text-center text-xs text-muted-foreground">
          Loading context...
        </div>
      }
    >
      <Show
        when={threadState.context}
        fallback={
          <div class="flex flex-col items-center gap-2 py-4">
            <div class="text-xs text-muted-foreground">
              CPU register snapshot for thread #{props.threadId}
            </div>
            <button
              class="cursor-pointer rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                const session = activeSession();
                if (session) {
                  void fetchContext(session.id, props.threadId);
                }
              }}
            >
              Load Context
            </button>
          </div>
        }
      >
        {(ctx) => (
          <div>
            <div class="mb-2 flex items-center justify-between">
              <span class="text-[10px] font-medium uppercase text-muted-foreground">
                Registers
              </span>
              <button
                class="cursor-pointer rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                onClick={() => {
                  const session = activeSession();
                  if (session) void fetchContext(session.id, props.threadId);
                }}
              >
                Refresh
              </button>
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <div class="flex items-center gap-2 text-xs">
                <span class="w-8 font-mono font-medium text-primary">pc</span>
                <span class="font-mono text-muted-foreground">
                  {formatAddress(ctx().pc)}
                </span>
                <CopyButton value={ctx().pc} />
              </div>
              <div class="flex items-center gap-2 text-xs">
                <span class="w-8 font-mono font-medium text-primary">sp</span>
                <span class="font-mono text-muted-foreground">
                  {formatAddress(ctx().sp)}
                </span>
                <CopyButton value={ctx().sp} />
              </div>
              <For each={Object.entries(ctx().regs)}>
                {([name, value]) => (
                  <div class="flex items-center gap-2 text-xs">
                    <span class="w-8 font-mono font-medium">{name}</span>
                    <span class="font-mono text-muted-foreground">
                      {formatAddress(value)}
                    </span>
                    <CopyButton value={value} />
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </Show>
    </Show>
  );
}

function StalkerView(props: { threadId: number }) {
  return (
    <div>
      <div class="mb-3 flex items-center gap-2">
        <Show
          when={threadState.stalkerActive}
          fallback={
            <button
              class="cursor-pointer rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                const session = activeSession();
                if (session) void startStalker(session.id, props.threadId);
              }}
            >
              Start Stalker
            </button>
          }
        >
          <button
            class="cursor-pointer rounded bg-destructive px-3 py-1 text-xs text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              const session = activeSession();
              if (session) void stopStalker(session.id, props.threadId);
            }}
          >
            Stop Stalker
          </button>
          <span class="text-[10px] text-success">Recording...</span>
        </Show>
        <span class="ml-auto text-[10px] text-muted-foreground">
          {threadState.stalkerEvents.length} events
        </span>
      </div>

      <Show
        when={threadState.stalkerEvents.length > 0}
        fallback={
          <div class="py-4 text-center text-xs text-muted-foreground">
            {threadState.stalkerActive
              ? "Waiting for events..."
              : "Start Stalker to trace code execution on this thread"}
          </div>
        }
      >
        <div class="max-h-96 overflow-auto">
          <div class="flex items-center border-b px-2 py-1 text-[10px] font-medium uppercase text-muted-foreground">
            <span class="w-10 shrink-0">Type</span>
            <span class="w-24 shrink-0">From</span>
            <span class="w-24 shrink-0">To</span>
            <span class="flex-1">Symbol</span>
            <span class="w-10 shrink-0 text-right">Depth</span>
          </div>
          <For each={threadState.stalkerEvents}>
            {(event) => (
              <div class="flex items-center px-2 py-0.5 text-xs hover:bg-surface-hover">
                <span class="w-10 shrink-0 text-[10px] text-muted-foreground">
                  {event.type}
                </span>
                <span class="w-24 shrink-0 font-mono text-[10px]">
                  {formatAddress(event.from)}
                </span>
                <span class="w-24 shrink-0 font-mono text-[10px]">
                  {formatAddress(event.to)}
                </span>
                <span class="flex-1 truncate font-mono text-[10px]" title={event.toSymbol ?? ""}>
                  <Show when={event.toModule}>
                    <span class="text-muted-foreground">{event.toModule}!</span>
                  </Show>
                  {event.toSymbol ?? ""}
                </span>
                <span class="w-10 shrink-0 text-right text-[10px] text-muted-foreground">
                  {event.depth}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export default ThreadsTab;
