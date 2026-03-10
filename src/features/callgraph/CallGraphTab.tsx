import { Show, For, createEffect, onCleanup } from "solid-js";
import {
  graphLayout,
  setGraphLayout,
  filteredGraphData,
  selectedGraphNode,
  selectGraphNode,
  clearGraph,
  setupCallGraphListener,
} from "./callgraph.store";
import type { GraphLayout } from "./callgraph.store";
import { activeSession } from "~/features/session/session.store";
import { cn } from "~/lib/cn";

const LAYOUTS: { id: GraphLayout; label: string }[] = [
  { id: "tree", label: "Tree" },
  { id: "force", label: "Force" },
  { id: "hierarchical", label: "Hierarchical" },
  { id: "flame", label: "Flame Graph" },
];

function CallGraphTab() {
  const data = filteredGraphData;

  createEffect(() => {
    const session = activeSession();
    if (!session) return;
    const cleanup = setupCallGraphListener(session.id);
    onCleanup(cleanup);
  });

  return (
    <div class="flex h-full flex-col">
      {/* Header */}
      <div class="flex items-center justify-between border-b px-4 py-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">Call Graph</span>
          <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {data().nodes.length} nodes / {data().edges.length} edges
          </span>
        </div>
        <div class="flex items-center gap-2">
          {/* Layout selector */}
          <div class="flex items-center gap-1">
            {LAYOUTS.map((l) => (
              <button
                class={cn(
                  "rounded px-2 py-0.5 text-xs transition-colors",
                  graphLayout() === l.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setGraphLayout(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button
            class="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            onClick={clearGraph}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div class="flex-1 overflow-hidden">
        <Show
          when={data().nodes.length > 0}
          fallback={
            <div class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <div class="text-sm font-medium">No call graph data</div>
              <p class="max-w-xs text-center text-xs">
                Start Stalker tracing on a thread from the Native tab to capture
                call data. The graph will be built automatically from captured events.
              </p>
              <div class="mt-2 rounded border border-dashed px-4 py-2 text-xs">
                Native tab &rarr; Stalker &rarr; Select thread &rarr; Start
              </div>
            </div>
          }
        >
          {/* Node list table (Canvas rendering in Phase 4) */}
          <div class="h-full overflow-auto">
            <div class="sticky top-0 flex gap-2 border-b bg-surface px-3 py-1 text-[10px] font-medium uppercase text-muted-foreground">
              <span class="w-32">Address</span>
              <span class="w-32">Module</span>
              <span class="flex-1">Symbol</span>
              <span class="w-16 text-right">Calls</span>
            </div>
            <For each={data().nodes}>
              {(node) => {
                const isSelected = () =>
                  selectedGraphNode()?.id === node.id;
                return (
                  <button
                    class={cn(
                      "flex w-full gap-2 px-3 py-1 text-left text-xs transition-colors hover:bg-surface-hover",
                      isSelected() && "bg-muted",
                    )}
                    onClick={() => selectGraphNode(isSelected() ? null : node.id)}
                  >
                    <span class="w-32 shrink-0 truncate font-mono text-muted-foreground">
                      {node.address}
                    </span>
                    <span class="w-32 shrink-0 truncate text-primary">
                      {node.module ?? "—"}
                    </span>
                    <span class="flex-1 truncate font-mono">
                      {node.symbol ?? "—"}
                    </span>
                    <span class="w-16 shrink-0 text-right text-muted-foreground">
                      {node.callCount}
                    </span>
                  </button>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* Selected node details */}
      <Show when={selectedGraphNode()}>
        {(node) => (
          <div class="border-t px-4 py-2 text-xs">
            <div class="flex gap-4">
              <span>
                <span class="text-muted-foreground">Module: </span>
                {node().module ?? "unknown"}
              </span>
              <span>
                <span class="text-muted-foreground">Symbol: </span>
                <span class="font-mono">{node().symbol ?? node().address}</span>
              </span>
              <span>
                <span class="text-muted-foreground">Calls: </span>
                {node().callCount}
              </span>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}

export default CallGraphTab;
