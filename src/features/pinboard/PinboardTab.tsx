import { For, Show, createSignal } from "solid-js";
import {
  pinboardState,
  filteredPins,
  pinTypeFilter,
  setPinTypeFilter,
  unpinItem,
  exportPins,
  importPins,
  updatePinTags,
  updatePinMemo,
} from "./pinboard.store";
import {
  ActionPopover,
  buildAddressActions,
} from "~/components/ActionPopover";
import { CopyButton } from "~/components/CopyButton";
import { InlineActions } from "~/components/InlineActions";
import { navigateTo } from "~/lib/navigation";
import { pickTextFile } from "~/lib/file-picker";
import { toastError } from "~/features/toast/toast.store";
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
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editTagInput, setEditTagInput] = createSignal("");
  const [editMemoInput, setEditMemoInput] = createSignal("");

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

  async function handleImport() {
    try {
      const selected = await pickTextFile(".json,application/json");
      if (!selected) return;
      const count = importPins(selected.content);
      if (count === 0) {
        console.info("No new pins to import (all duplicates)");
      }
    } catch (e) {
      toastError("Failed to import pins", e);
    }
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

  function startEditing(item: PinItem) {
    setEditingId(item.id);
    setEditTagInput(item.tags.join(", "));
    setEditMemoInput(item.memo);
  }

  function saveEditing(id: string) {
    const tags = editTagInput()
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    updatePinTags(id, tags);
    updatePinMemo(id, editMemoInput());
    setEditingId(null);
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
            class="cursor-pointer rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            onClick={handleExport}
          >
            Export
          </button>
          <button
            class="cursor-pointer rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            onClick={handleImport}
          >
            Import
          </button>
        </div>
      </div>

      {/* Pin table */}
      <div class="flex-1 overflow-auto">
        {/* Table header */}
        <div class="sticky top-0 flex items-center border-b bg-surface px-4 py-1.5 text-[10px] font-medium uppercase text-muted-foreground">
          <span class="w-16 shrink-0">Type</span>
          <span class="min-w-0 flex-1">Name</span>
          <span class="w-36 shrink-0">Address</span>
          <span class="w-14 shrink-0">Source</span>
          <span class="w-28 shrink-0">Tags</span>
          <span class="w-20 shrink-0" />
        </div>

        <For each={filteredPins()}>
          {(item) => (
            <div class="group/row border-b border-border/30 hover:bg-surface-hover">
              <div class="flex items-center px-4 py-1.5 text-xs">
                <span class="w-16 shrink-0">
                  <span
                    class={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium",
                      PIN_TYPE_COLORS[item.type],
                    )}
                  >
                    {item.type}
                  </span>
                </span>
                <span class="flex min-w-0 flex-1 items-center gap-1">
                  <button
                    class="min-w-0 cursor-pointer truncate text-left font-mono hover:text-primary"
                    onClick={() => handleJump(item)}
                    title={item.name}
                  >
                    {item.name}
                  </button>
                  <CopyButton value={item.name} class="shrink-0" />
                </span>
                <span class="flex w-36 shrink-0 items-center gap-1">
                  <Show
                    when={item.address}
                    fallback={
                      <span class="font-mono text-muted-foreground">-</span>
                    }
                  >
                    <ActionPopover
                      type="address"
                      value={item.address!}
                      actions={buildAddressActions(item.address!, item.name)}
                    >
                      {formatAddress(item.address!)}
                    </ActionPopover>
                    <CopyButton value={item.address!} class="shrink-0" />
                  </Show>
                </span>
                <span class="w-14 shrink-0 text-muted-foreground">{item.source}</span>
                <span class="w-28 shrink-0">
                  <For each={item.tags}>
                    {(tag) => (
                      <span class="mr-1 rounded bg-muted px-1 py-0.5 text-[10px]">
                        {tag}
                      </span>
                    )}
                  </For>
                </span>
                <span class="flex w-20 shrink-0 items-center justify-end">
                  <InlineActions
                    primary={[
                      {
                        label: "Jump",
                        variant: "primary",
                        onClick: () => handleJump(item),
                      },
                    ]}
                    overflow={[
                      {
                        label: "Edit Tags/Memo",
                        onClick: () => startEditing(item),
                      },
                      {
                        label: "Copy Name",
                        onClick: () => navigator.clipboard.writeText(item.name),
                      },
                      ...(item.address
                        ? [
                            {
                              label: "Copy Address",
                              onClick: () =>
                                navigator.clipboard.writeText(item.address!),
                            },
                          ]
                        : []),
                      {
                        label: "Unpin",
                        separator: true,
                        onClick: () => unpinItem(item.id),
                      },
                    ]}
                  />
                </span>
              </div>
              {/* Inline edit panel */}
              <Show when={editingId() === item.id}>
                <div class="flex items-center gap-2 border-t border-border/20 bg-surface px-4 py-2">
                  <div class="flex flex-1 gap-2">
                    <input
                      type="text"
                      class="w-48 rounded border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
                      placeholder="Tags (comma separated)"
                      value={editTagInput()}
                      onInput={(e) => setEditTagInput(e.currentTarget.value)}
                    />
                    <input
                      type="text"
                      class="flex-1 rounded border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
                      placeholder="Memo"
                      value={editMemoInput()}
                      onInput={(e) => setEditMemoInput(e.currentTarget.value)}
                    />
                  </div>
                  <button
                    class="cursor-pointer rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                    onClick={() => saveEditing(item.id)}
                  >
                    Save
                  </button>
                  <button
                    class="cursor-pointer rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </Show>
              {/* Show memo if present */}
              <Show when={item.memo && editingId() !== item.id}>
                <div class="px-4 pb-1.5 text-[10px] text-muted-foreground">
                  {item.memo}
                </div>
              </Show>
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
