import { For, Show, Switch, Match, createEffect, createMemo, createSignal, onMount } from "solid-js";
import {
  hexData,
  monitorEvents,
  monitorHeatmap,
  memoryState,
  memorySubMode,
  ranges,
  searchResults,
  setMemorySubMode,
  fetchRanges,
  readMemoryAt,
  searchMemory,
  startMemoryMonitor,
  stopMemoryMonitor,
} from "./memory.store";
import type { MemorySubMode } from "./memory.store";
import { cn } from "~/lib/cn";
import { formatAddress, formatSize } from "~/lib/format";
import { consumeNavigationContext, navigateTo } from "~/lib/navigation";
import { activeSession } from "~/features/session/session.store";
import { CopyButton } from "~/components/CopyButton";
import { ActionPopover, buildAddressActions } from "~/components/ActionPopover";
import { InlineActions } from "~/components/InlineActions";
import { VirtualList } from "~/components/VirtualList";

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
    if (
      session &&
      memorySubMode() === "map" &&
      !memoryState.rangesLoading &&
      ranges().length === 0
    ) {
      fetchRanges(session.id);
    }
  });

  onMount(() => {
    const session = activeSession();
    const context = consumeNavigationContext();
    const address = context?.address;

    if (session && typeof address === "string") {
      void readMemoryAt(session.id, address);
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
    <div class="flex h-full flex-col p-1">
      <Show
        when={!memoryState.rangesLoading}
        fallback={
          <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
            Loading memory ranges...
          </div>
        }
      >
        {/* Table header */}
        <div class="flex items-center px-3 py-1 text-[10px] font-medium uppercase text-muted-foreground">
          <span class="w-36 shrink-0">Base</span>
          <span class="w-16 shrink-0">Size</span>
          <span class="w-10 shrink-0">Prot</span>
          <span class="min-w-0 flex-1">File</span>
          <span class="w-20 shrink-0" />
        </div>

        <VirtualList
          items={ranges()}
          itemHeight={24}
          overscan={10}
          resetKey={activeSession()?.id ?? ""}
          class="flex-1 overflow-auto"
          empty={
            <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
              No memory ranges loaded. Click refresh to enumerate.
            </div>
          }
        >
          {(range) => (
            <div
              class="group/row flex w-full cursor-pointer items-center px-3 py-0.5 text-xs hover:bg-surface-hover"
              onClick={() => {
                const session = activeSession();
                if (session) {
                  readMemoryAt(session.id, range.base);
                }
              }}
            >
              <span class="flex w-36 shrink-0 items-center gap-1">
                <ActionPopover
                  type="address"
                  value={range.base}
                  actions={buildAddressActions(range.base)}
                >
                  {formatAddress(range.base)}
                </ActionPopover>
                <CopyButton value={range.base} />
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
              <span
                class="min-w-0 flex-1 truncate text-muted-foreground"
                title={range.file?.path ?? ""}
              >
                {range.file?.path ?? ""}
              </span>
              <span class="w-20 shrink-0">
                <InlineActions
                  primary={[
                    {
                      label: "Read",
                      variant: "primary",
                      onClick: (e) => {
                        e.stopPropagation();
                        const session = activeSession();
                        if (session) {
                          readMemoryAt(session.id, range.base);
                        }
                      },
                    },
                  ]}
                  overflow={[
                    {
                      label: "Copy Base Address",
                      onClick: () => {
                        void navigator.clipboard.writeText(range.base);
                      },
                    },
                    {
                      label: "Pin Range",
                      onClick: () => {
                        navigateTo({
                          tab: "pinboard",
                          context: {
                            type: "address",
                            value: range.base,
                            label: range.file?.path,
                          },
                        });
                      },
                    },
                  ]}
                />
              </span>
            </div>
          )}
        </VirtualList>
      </Show>
    </div>
  );
}

function HexView() {
  const BYTES_PER_ROW = 16;

  const rows = () => {
    const bytes = hexData();
    if (!bytes) return [];
    const result: { offset: number; bytes: number[]; ascii: string }[] = [];
    for (let i = 0; i < bytes.length; i += BYTES_PER_ROW) {
      const slice = Array.from(bytes.slice(i, i + BYTES_PER_ROW));
      const ascii = slice
        .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : "."))
        .join("");
      result.push({ offset: i, bytes: slice, ascii });
    }
    return result;
  };

  const baseAddr = () => {
    const addr = memoryState.hexAddress;
    if (!addr) return 0n;
    try {
      return BigInt(addr.startsWith("0x") ? addr : `0x${addr}`);
    } catch {
      return 0n;
    }
  };

  const formatOffset = (offset: number) => {
    const addr = baseAddr() + BigInt(offset);
    return `0x${addr.toString(16).padStart(16, "0")}`;
  };

  return (
    <div class="flex h-full flex-col">
      <Show
        when={memoryState.hexAddress}
        fallback={
          <div class="flex h-full items-center justify-center text-xs text-muted-foreground">
            Select a memory range to view hex data
          </div>
        }
      >
        {/* Toolbar */}
        <div class="flex items-center gap-2 border-b px-3 py-1.5">
          <span class="flex items-center gap-1 font-mono text-xs text-muted-foreground">
            {formatAddress(memoryState.hexAddress!)}
            <CopyButton value={memoryState.hexAddress!} />
          </span>
          <span class="text-[10px] text-muted-foreground">
            {hexData()?.length ?? 0} bytes
          </span>
          <div class="flex-1" />
          <button
            class="cursor-pointer rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            onClick={() => {
              const session = activeSession();
              if (session && memoryState.hexAddress) {
                readMemoryAt(session.id, memoryState.hexAddress, 256);
              }
            }}
          >
            Refresh
          </button>
        </div>

        {/* Hex header */}
        <div class="flex items-center border-b bg-surface px-3 py-0.5 font-mono text-[10px] text-muted-foreground">
          <span class="w-[76px] shrink-0">Offset</span>
          <span class="min-w-0 flex-1 whitespace-pre">
            {Array.from({ length: BYTES_PER_ROW }, (_, i) =>
              i.toString(16).toUpperCase().padStart(2, "0"),
            ).join(" ")}
          </span>
          <span class="ml-3 w-[130px] shrink-0">ASCII</span>
        </div>

        {/* Hex rows */}
        <div class="flex-1 overflow-auto">
          <Show when={memoryState.hexLoading}>
            <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
              Reading memory...
            </div>
          </Show>
          <For each={rows()}>
            {(row) => (
              <div class="flex items-center px-3 py-px font-mono text-xs leading-5 hover:bg-surface-hover">
                <span class="w-[76px] shrink-0 text-muted-foreground">
                  {formatOffset(row.offset)}
                </span>
                <span class="min-w-0 flex-1 whitespace-pre">
                  {row.bytes
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join(" ")}
                  {row.bytes.length < BYTES_PER_ROW
                    ? "   ".repeat(BYTES_PER_ROW - row.bytes.length)
                    : ""}
                </span>
                <span class="ml-3 w-[130px] shrink-0 text-muted-foreground">
                  {row.ascii}
                </span>
              </div>
            )}
          </For>
        </div>
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
          class="cursor-pointer rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
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

      <Show when={searchResults().length > 0}>
        <div class="mt-3 text-xs">
          <span class="text-muted-foreground">
            {searchResults().length} results
          </span>
          <VirtualList
            items={searchResults()}
            itemHeight={24}
            overscan={10}
            resetKey={memoryState.searchPattern}
            class="mt-2 max-h-80 overflow-auto"
          >
            {(result) => (
              <div
                class="group/row flex w-full cursor-pointer items-center gap-2 px-2 py-0.5 hover:bg-surface-hover"
                onClick={() => {
                  const session = activeSession();
                  if (session) {
                    readMemoryAt(session.id, result.address);
                  }
                }}
              >
                <span class="flex items-center gap-1">
                  <ActionPopover
                    type="address"
                    value={result.address}
                    actions={buildAddressActions(result.address)}
                  >
                    {formatAddress(result.address)}
                  </ActionPopover>
                  <CopyButton value={result.address} />
                </span>
                <span class="text-muted-foreground">
                  {result.size} bytes
                </span>
              </div>
            )}
          </VirtualList>
        </div>
      </Show>
    </div>
  );
}

function MonitorView() {
  const [monitorAddress, setMonitorAddress] = createSignal("");
  const [monitorSize, setMonitorSize] = createSignal("4096");

  function handleStartMonitor() {
    const session = activeSession();
    if (!session || !monitorAddress()) return;
    void startMemoryMonitor(session.id, monitorAddress(), Number(monitorSize()));
  }

  function handleStopMonitor() {
    const session = activeSession();
    if (!session) return;
    void stopMemoryMonitor(session.id);
  }

  const maxHeat = createMemo(() => {
    const max = Math.max(...monitorHeatmap());
    return max > 0 ? max : 1;
  });

  function heatColor(count: number): string {
    const intensity = count / maxHeat();
    if (intensity > 0.8) return "bg-red-500/80";
    if (intensity > 0.6) return "bg-orange-500/60";
    if (intensity > 0.4) return "bg-yellow-500/40";
    if (intensity > 0.2) return "bg-cyan-500/30";
    if (intensity > 0) return "bg-blue-700/40";
    return "bg-blue-900/20";
  }

  return (
    <div class="flex h-full flex-col">
      {/* Controls */}
      <div class="border-b p-4">
        <div class="flex items-center gap-2">
          <input
            type="text"
            class="w-40 rounded border bg-background px-2 py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
            placeholder="Base address (0x...)"
            value={monitorAddress()}
            onInput={(e) => setMonitorAddress(e.currentTarget.value)}
          />
          <input
            type="text"
            class="w-20 rounded border bg-background px-2 py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
            placeholder="Size"
            value={monitorSize()}
            onInput={(e) => setMonitorSize(e.currentTarget.value)}
          />
          <Show
            when={memoryState.monitorActive}
            fallback={
              <button
                class="cursor-pointer rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
                onClick={handleStartMonitor}
              >
                Start Monitor
              </button>
            }
          >
            <button
              class="cursor-pointer rounded bg-destructive px-3 py-1.5 text-xs text-destructive-foreground hover:bg-destructive/90"
              onClick={handleStopMonitor}
            >
              Stop Monitor
            </button>
          </Show>
        </div>
        <p class="mt-2 text-[10px] text-muted-foreground">
          MemoryAccessMonitor tracks read/write frequency per memory page and
          visualizes access patterns as a heatmap.
        </p>
      </div>

      {/* Heatmap area */}
      <div class="flex-1 overflow-auto p-4">
        <Show
          when={memoryState.monitorActive}
          fallback={
            <div class="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <p>Memory Access Monitor Heatmap</p>
              <p class="text-[10px]">
                Configure a memory range above and click Start to begin monitoring.
              </p>
            </div>
          }
        >
          <div class="mb-3 flex items-center gap-4 text-[10px] text-muted-foreground">
            <span class="text-success">Monitoring active</span>
            <span>Base: {monitorAddress()}</span>
            <span>Size: {monitorSize()} bytes</span>
            <span>{monitorEvents().length} events</span>
          </div>
          <div class="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>Cold</span>
            <div class="flex gap-px">
              <div class="h-3 w-3 rounded-sm bg-blue-900/30" />
              <div class="h-3 w-3 rounded-sm bg-blue-700/50" />
              <div class="h-3 w-3 rounded-sm bg-cyan-500/60" />
              <div class="h-3 w-3 rounded-sm bg-yellow-500/70" />
              <div class="h-3 w-3 rounded-sm bg-orange-500/80" />
              <div class="h-3 w-3 rounded-sm bg-red-500/90" />
            </div>
            <span>Hot</span>
          </div>
          <div class="mt-3 grid grid-cols-16 gap-px">
            <For each={monitorHeatmap()}>
              {(count, i) => (
                <div
                  class={cn("h-4 w-4 rounded-sm", heatColor(count))}
                  title={`Page ${i()}: ${count} accesses`}
                />
              )}
            </For>
          </div>
          <p class="mt-2 text-[10px] text-muted-foreground">
            Each cell represents a memory page. Color intensity indicates access frequency.
          </p>
        </Show>
      </div>
    </div>
  );
}

export default MemoryTab;
