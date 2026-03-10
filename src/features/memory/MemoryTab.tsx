import { For, Show, Switch, Match, createEffect, createSignal } from "solid-js";
import {
  memoryState,
  memorySubMode,
  setMemorySubMode,
  fetchRanges,
  readMemoryAt,
  searchMemory,
} from "./memory.store";
import type { MemorySubMode } from "./memory.store";
import { cn } from "~/lib/cn";
import { formatAddress, formatSize } from "~/lib/format";
import { activeSession } from "~/features/session/session.store";

const SUB_MODES: { id: MemorySubMode; label: string }[] = [
  { id: "map", label: "Map" },
  { id: "hex", label: "Hex" },
  { id: "search", label: "Search" },
  { id: "monitor", label: "Monitor" },
];

const PROTECTION_COLORS: Record<string, string> = {
  "rwx": "text-destructive",
  "r-x": "text-primary",
  "rw-": "text-success",
  "r--": "text-muted-foreground",
};

function MemoryTab() {
  createEffect(() => {
    const session = activeSession();
    if (session && memorySubMode() === "map") {
      fetchRanges(session.id);
    }
  });

  return (
    <div class="flex h-full flex-col">
      {/* Header */}
      <div class="flex items-center justify-between border-b px-4 py-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">Memory</span>
        </div>
        <div class="flex items-center gap-1">
          <For each={SUB_MODES}>
            {(mode) => (
              <button
                class={cn(
                  "rounded px-2 py-0.5 text-xs transition-colors",
                  memorySubMode() === mode.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setMemorySubMode(mode.id)}
              >
                {mode.label}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-auto">
        <Switch>
          <Match when={memorySubMode() === "map"}>
            <MemoryMapView />
          </Match>
          <Match when={memorySubMode() === "hex"}>
            <HexView />
          </Match>
          <Match when={memorySubMode() === "search"}>
            <SearchView />
          </Match>
          <Match when={memorySubMode() === "monitor"}>
            <MonitorView />
          </Match>
        </Switch>
      </div>
    </div>
  );
}

function MemoryMapView() {
  return (
    <div class="p-1">
      <Show
        when={!memoryState.rangesLoading}
        fallback={
          <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
            Loading memory ranges...
          </div>
        }
      >
        {/* Table header */}
        <div class="flex gap-2 px-3 py-1 text-[10px] font-medium uppercase text-muted-foreground">
          <span class="w-28">Base</span>
          <span class="w-16">Size</span>
          <span class="w-10">Prot</span>
          <span class="flex-1">File</span>
        </div>

        <For each={memoryState.ranges}>
          {(range) => (
            <button
              class="flex w-full gap-2 px-3 py-0.5 text-xs hover:bg-surface-hover"
              onClick={() => {
                const session = activeSession();
                if (session) {
                  readMemoryAt(session.id, range.base);
                }
              }}
            >
              <span class="w-28 shrink-0 font-mono text-muted-foreground">
                {formatAddress(range.base)}
              </span>
              <span class="w-16 shrink-0">{formatSize(range.size)}</span>
              <span
                class={cn(
                  "w-10 shrink-0 font-mono",
                  PROTECTION_COLORS[range.protection] ?? "text-foreground",
                )}
              >
                {range.protection}
              </span>
              <span class="flex-1 truncate text-muted-foreground">
                {range.file?.path ?? ""}
              </span>
            </button>
          )}
        </For>

        <Show when={memoryState.ranges.length === 0}>
          <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
            No memory ranges loaded. Click refresh to enumerate.
          </div>
        </Show>
      </Show>
    </div>
  );
}

function HexView() {
  return (
    <div class="flex h-full items-center justify-center text-xs text-muted-foreground">
      <Show
        when={memoryState.hexAddress}
        fallback="Select a memory range to view hex data"
      >
        Hex editor at {memoryState.hexAddress} (implementation in Phase 3)
      </Show>
    </div>
  );
}

function SearchView() {
  const [localPattern, setLocalPattern] = createSignal(memoryState.searchPattern);

  return (
    <div class="p-4">
      <div class="flex gap-2">
        <input
          type="text"
          class="flex-1 rounded border bg-background px-3 py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
          placeholder='Frida pattern (e.g., "48 65 ?? 6C")'
          value={localPattern()}
          onInput={(e) => setLocalPattern(e.currentTarget.value)}
        />
        <button
          class="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
          onClick={() => {
            const session = activeSession();
            if (session && localPattern()) {
              searchMemory(session.id, localPattern());
            }
          }}
        >
          Search
        </button>
      </div>

      <Show when={memoryState.searching}>
        <div class="mt-3">
          <div class="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full bg-primary transition-all"
              style={{ width: `${memoryState.searchProgress}%` }}
            />
          </div>
          <span class="mt-1 text-xs text-muted-foreground">
            {memoryState.searchProgress}%
          </span>
        </div>
      </Show>

      <Show when={memoryState.searchResults.length > 0}>
        <div class="mt-3 text-xs">
          <span class="text-muted-foreground">
            {memoryState.searchResults.length} results
          </span>
          <div class="mt-2">
            <For each={memoryState.searchResults}>
              {(result) => (
                <button
                  class="flex w-full gap-2 px-2 py-0.5 hover:bg-surface-hover"
                  onClick={() => {
                    const session = activeSession();
                    if (session) {
                      readMemoryAt(session.id, result.address);
                    }
                  }}
                >
                  <span class="font-mono text-primary">
                    {formatAddress(result.address)}
                  </span>
                  <span class="text-muted-foreground">
                    {result.size} bytes
                  </span>
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

function MonitorView() {
  return (
    <div class="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
      <p>Memory Access Monitor Heatmap</p>
      <p class="text-[10px]">
        MemoryAccessMonitor-based read/write frequency visualization
      </p>
      <Show
        when={memoryState.monitorActive}
        fallback={
          <button class="rounded bg-primary px-3 py-1.5 text-primary-foreground hover:bg-primary/90">
            Start Monitor
          </button>
        }
      >
        <span class="text-success">Monitoring active</span>
      </Show>
    </div>
  );
}

export default MemoryTab;
