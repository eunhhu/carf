import { For, Show, createSignal, onMount, onCleanup } from "solid-js";
import { MoreHorizontal } from "lucide-solid";

export interface ActionDef {
  label: string;
  variant?: "primary" | "default" | "danger";
  onClick: (e: MouseEvent) => void;
}

export interface OverflowAction {
  label: string;
  onClick: () => void;
  separator?: boolean;
}

interface InlineActionsProps {
  primary: ActionDef[];
  overflow?: OverflowAction[];
}

export function InlineActions(props: InlineActionsProps) {
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [menuPos, setMenuPos] = createSignal({ top: 0, left: 0 });
  let btnRef: HTMLButtonElement | undefined;
  let menuRef: HTMLDivElement | undefined;

  function openMenu(e: MouseEvent) {
    e.stopPropagation();
    if (btnRef) {
      const rect = btnRef.getBoundingClientRect();
      let left = rect.right - 180;
      if (left < 8) left = 8;
      let top = rect.bottom + 4;
      if (top + 200 > window.innerHeight) top = rect.top - 200;
      setMenuPos({ top, left });
    }
    setMenuOpen(true);
  }

  function handleOutside(e: MouseEvent) {
    if (
      menuRef &&
      !menuRef.contains(e.target as Node) &&
      btnRef &&
      !btnRef.contains(e.target as Node)
    ) {
      setMenuOpen(false);
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === "Escape") setMenuOpen(false);
  }

  onMount(() => {
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    onCleanup(() => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    });
  });

  const variantClass = (v?: "primary" | "default" | "danger") => {
    switch (v) {
      case "primary":
        return "border-primary/40 text-primary hover:bg-primary/10";
      case "danger":
        return "border-destructive/40 text-destructive hover:bg-destructive/10";
      default:
        return "border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground";
    }
  };

  return (
    <div
      class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/row:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <For each={props.primary}>
        {(action) => (
          <button
            class={`cursor-pointer rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${variantClass(action.variant)}`}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        )}
      </For>

      <Show when={props.overflow && props.overflow.length > 0}>
        <button
          ref={btnRef}
          class="flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          onClick={openMenu}
          title="More actions"
        >
          <MoreHorizontal size={12} />
        </button>

        <Show when={menuOpen()}>
          <div
            ref={menuRef}
            class="fixed z-50 min-w-[180px] rounded-lg border bg-surface py-1 shadow-lg"
            style={{
              top: `${menuPos().top}px`,
              left: `${menuPos().left}px`,
            }}
          >
            <For each={props.overflow}>
              {(item) => (
                <>
                  <Show when={item.separator}>
                    <div class="my-1 border-t" />
                  </Show>
                  <button
                    class="flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-surface-hover"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      item.onClick();
                    }}
                  >
                    {item.label}
                  </button>
                </>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
