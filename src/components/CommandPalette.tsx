import { createSignal, createMemo, For, Show, onMount } from "solid-js";
import { navigateTo } from "~/lib/navigation";
import { TAB_DEFINITIONS } from "~/lib/types";
import { pinboardState } from "~/features/pinboard/pinboard.store";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  category: "Tabs" | "Pinboard";
  action: () => void;
}

export function CommandPalette(props: CommandPaletteProps) {
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;

  onMount(() => {
    inputRef?.focus();
  });

  const allItems = createMemo<PaletteItem[]>(() => {
    const tabs: PaletteItem[] = TAB_DEFINITIONS.map((tab) => ({
      id: `tab:${tab.id}`,
      label: tab.label,
      description: tab.shortcutIndex >= 0 ? `Cmd+${tab.shortcutIndex}` : undefined,
      category: "Tabs" as const,
      action: () => {
        navigateTo({ tab: tab.id });
        props.onClose();
      },
    }));

    const pins: PaletteItem[] = pinboardState.items.map((pin) => ({
      id: `pin:${pin.id}`,
      label: pin.name,
      description: pin.address ?? pin.type,
      category: "Pinboard" as const,
      action: () => {
        navigateTo({ tab: "pinboard", context: { pinId: pin.id } });
        props.onClose();
      },
    }));

    return [...tabs, ...pins];
  });

  const filteredItems = createMemo<PaletteItem[]>(() => {
    const q = query().toLowerCase().trim();
    if (!q) return allItems();
    return allItems().filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    );
  });

  // Group by category
  const groupedItems = createMemo(() => {
    const items = filteredItems();
    const groups: Record<string, PaletteItem[]> = {};
    for (const item of items) {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    }
    return groups;
  });

  // Flat ordered list for keyboard navigation (matches render order)
  const flatItems = createMemo<PaletteItem[]>(() => {
    const groups = groupedItems();
    return (["Tabs", "Pinboard"] as const).flatMap((cat) => groups[cat] ?? []);
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatItems().length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems()[selectedIndex()];
      item?.action();
      return;
    }
  }

  // Reset selection when query changes
  function handleInput(e: InputEvent) {
    setQuery((e.currentTarget as HTMLInputElement).value);
    setSelectedIndex(0);
  }

  // Track flat index across groups for selectedIndex mapping
  let flatIndex = 0;

  return (
    <div
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        class="flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div class="flex items-center border-b border-border px-3">
          <span class="mr-2 text-sm text-muted-foreground">⌘</span>
          <input
            ref={inputRef}
            type="text"
            class="flex-1 bg-transparent py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="Search tabs, pinboard items..."
            value={query()}
            onInput={handleInput}
          />
          <kbd class="ml-2 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div class="max-h-80 overflow-y-auto py-1">
          <Show
            when={flatItems().length > 0}
            fallback={
              <div class="px-3 py-6 text-center text-xs text-muted-foreground">
                No results found
              </div>
            }
          >
            {(() => {
              flatIndex = 0;
              return (
                <For each={["Tabs", "Pinboard"] as const}>
                  {(category) => {
                    const items = groupedItems()[category];
                    if (!items || items.length === 0) return null;
                    return (
                      <div>
                        {/* Category header */}
                        <div class="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                          {category}
                        </div>
                        <For each={items}>
                          {(item) => {
                            const currentIndex = flatIndex++;
                            return (
                              <button
                                class="flex w-full items-center justify-between px-3 py-2 text-left transition-colors"
                                classList={{
                                  "bg-muted": selectedIndex() === currentIndex,
                                  "hover:bg-surface-hover": selectedIndex() !== currentIndex,
                                }}
                                onClick={() => item.action()}
                                onMouseEnter={() => setSelectedIndex(currentIndex)}
                              >
                                <span class="text-sm text-foreground">
                                  {item.label}
                                </span>
                                <Show when={item.description}>
                                  <span class="text-xs text-muted-foreground">
                                    {item.description}
                                  </span>
                                </Show>
                              </button>
                            );
                          }}
                        </For>
                      </div>
                    );
                  }}
                </For>
              );
            })()}
          </Show>
        </div>

        {/* Footer hint */}
        <div class="flex items-center gap-3 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span><kbd class="rounded border border-border px-1">↑↓</kbd> navigate</span>
          <span><kbd class="rounded border border-border px-1">↵</kbd> select</span>
          <span><kbd class="rounded border border-border px-1">ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
