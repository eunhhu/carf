import { For, Show } from "solid-js";
import {
  pinboardState,
  filteredPins,
  pinTypeFilter,
  setPinTypeFilter,
  unpinItem,
  exportPins,
} from "./pinboard.store";
import { navigateTo } from "~/lib/navigation";
import { cn } from "~/lib/cn";
import { formatAddress } from "~/lib/format";
import type { PinItem } from "~/lib/types";

const PIN_TYPE_COLORS: Record<PinItem["type"], string> = {
  module: "bg-primary/10 text-primary",
  function: "bg-success/10 text-success",
  address: "bg-warning/10 text-warning",
  class: "bg-purple-500/10 text-purple-400",
  thread: "bg-cyan-500/10 text-cyan-400",
  hook: "bg-orange-500/10 text-orange-400",
};

function PinboardTab() {
  function handleExport() {
    const json = exportPins();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "carf-pinboard.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleJump(item: PinItem) {
    navigateTo({
      tab: item.source,
      context: {
        name: item.name,
        address: item.address,
        type: item.type,
      },
    });
  }

  return (
    <div class="flex h-full flex-col">
      {/* Header */}
      <div class="flex items-center justify-between border-b px-4 py-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">Pinboard</span>
          <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {pinboardState.items.length}
          </span>
        </div>
        <div class="flex items-center gap-1">
          <select
            class="rounded border bg-background px-1.5 py-0.5 text-xs"
            value={pinTypeFilter()}
            onChange={(e) =>
              setPinTypeFilter(
                e.currentTarget.value as PinItem["type"] | "all",
              )
            }
          >
            <option value="all">All Types</option>
            <option value="module">Module</option>
            <option value="address">Address</option>
            <option value="function">Function</option>
            <option value="class">Class</option>
            <option value="thread">Thread</option>
            <option value="hook">Hook</option>
          </select>
          <button
            class="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            onClick={handleExport}
          >
            Export
          </button>
          <button class="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">
            Import
          </button>
        </div>
      </div>

      {/* Pin table */}
      <div class="flex-1 overflow-auto">
        {/* Table header */}
        <div class="sticky top-0 flex gap-2 border-b bg-surface px-4 py-1.5 text-[10px] font-medium uppercase text-muted-foreground">
          <span class="w-16">Type</span>
          <span class="flex-1">Name</span>
          <span class="w-28">Address</span>
          <span class="w-16">Source</span>
          <span class="w-32">Tags</span>
          <span class="w-20" />
        </div>

        <For each={filteredPins()}>
          {(item) => (
            <div class="flex items-center gap-2 border-b border-border/30 px-4 py-1.5 text-xs hover:bg-surface-hover">
              <span class="w-16">
                <span
                  class={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                    PIN_TYPE_COLORS[item.type],
                  )}
                >
                  {item.type}
                </span>
              </span>
              <button
                class="flex-1 truncate text-left font-mono hover:text-primary"
                onClick={() => handleJump(item)}
              >
                {item.name}
              </button>
              <span class="w-28 font-mono text-muted-foreground">
                {item.address ? formatAddress(item.address) : "-"}
              </span>
              <span class="w-16 text-muted-foreground">{item.source}</span>
              <span class="w-32">
                <For each={item.tags}>
                  {(tag) => (
                    <span class="mr-1 rounded bg-muted px-1 py-0.5 text-[10px]">
                      {tag}
                    </span>
                  )}
                </For>
              </span>
              <span class="w-20 flex items-center justify-end gap-1">
                <button
                  class="rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => handleJump(item)}
                >
                  Jump
                </button>
                <button
                  class="rounded px-1 py-0.5 text-[10px] text-destructive hover:bg-destructive/10"
                  onClick={() => unpinItem(item.id)}
                >
                  Unpin
                </button>
              </span>
            </div>
          )}
        </For>

        <Show when={filteredPins().length === 0}>
          <div class="flex h-32 flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <p>No pinned items</p>
            <p class="text-[10px]">
              Right-click items in other tabs to pin them here
            </p>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default PinboardTab;
