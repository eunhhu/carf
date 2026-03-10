import { type JSX, Show, createSignal, onCleanup, onMount } from "solid-js";
import { navigateTo } from "~/lib/navigation";
import { cn } from "~/lib/cn";

export interface PopoverAction {
  label: string;
  icon?: string;
  shortcut?: string;
  separator?: boolean;
  section?: string;
  onClick: () => void;
}

export type LinkableType = "address" | "module" | "symbol" | "class" | "thread";

interface ActionPopoverProps {
  type: LinkableType;
  value: string;
  label?: string;
  actions: PopoverAction[];
  children?: JSX.Element;
  class?: string;
}

const TYPE_COLORS: Record<LinkableType, string> = {
  address: "text-primary",
  module: "text-success",
  symbol: "text-warning",
  class: "text-destructive",
  thread: "text-purple-400",
};

export function ActionPopover(props: ActionPopoverProps) {
  const [open, setOpen] = createSignal(false);
  const [position, setPosition] = createSignal({ top: 0, left: 0 });
  let triggerRef: HTMLSpanElement | undefined;
  let menuRef: HTMLDivElement | undefined;

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (open()) {
      setOpen(false);
      return;
    }
    if (triggerRef) {
      const rect = triggerRef.getBoundingClientRect();
      const menuWidth = 220;
      const menuHeight = 300;
      let top = rect.bottom + 4;
      let left = rect.left;
      // Clamp to viewport
      if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 8;
      }
      if (top + menuHeight > window.innerHeight) {
        top = rect.top - menuHeight - 4;
      }
      setPosition({ top, left });
    }
    setOpen(true);
  }

  function handleOutsideClick(e: MouseEvent) {
    if (
      menuRef &&
      !menuRef.contains(e.target as Node) &&
      triggerRef &&
      !triggerRef.contains(e.target as Node)
    ) {
      setOpen(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
  }

  onMount(() => {
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    });
  });

  let currentSection = "";

  return (
    <>
      <span
        ref={triggerRef}
        class={cn(
          "cursor-pointer border-b border-dashed font-mono text-xs transition-colors hover:brightness-125",
          TYPE_COLORS[props.type] ?? "text-primary",
          `border-current/40`,
          props.class,
        )}
        onClick={handleClick}
        title={`Click for actions: ${props.value}`}
      >
        {props.children ?? props.label ?? props.value}
      </span>

      <Show when={open()}>
        <div
          ref={menuRef}
          class="fixed z-50 min-w-[200px] max-w-[280px] rounded-lg border bg-surface shadow-lg"
          style={{
            top: `${position().top}px`,
            left: `${position().left}px`,
          }}
        >
          {/* Header */}
          <div class="border-b px-3 py-2">
            <div class="truncate font-mono text-xs text-foreground">
              {props.value}
            </div>
            <div class="text-[10px] uppercase tracking-wider text-muted-foreground">
              {props.type}
            </div>
          </div>

          {/* Actions */}
          <div class="py-1">
            {props.actions.map((action) => {
              const showSection =
                action.section && action.section !== currentSection;
              if (action.section) currentSection = action.section;

              return (
                <>
                  <Show when={showSection}>
                    <div class="px-3 pb-0.5 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {action.section}
                    </div>
                  </Show>
                  <Show when={action.separator}>
                    <div class="my-1 border-t" />
                  </Show>
                  <button
                    class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-surface-hover"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      action.onClick();
                    }}
                  >
                    <Show when={action.icon}>
                      <span class="w-4 text-center text-muted-foreground">
                        {action.icon}
                      </span>
                    </Show>
                    <span class="flex-1">{action.label}</span>
                    <Show when={action.shortcut}>
                      <span class="text-[10px] text-muted-foreground">
                        {action.shortcut}
                      </span>
                    </Show>
                  </button>
                </>
              );
            })}
          </div>
        </div>
      </Show>
    </>
  );
}

// --- Helper: build common actions for a given type ---

export function buildAddressActions(
  address: string,
  moduleName?: string,
): PopoverAction[] {
  const actions: PopoverAction[] = [
    {
      section: "Navigate",
      label: "View in Memory",
      icon: "#",
      onClick: () =>
        navigateTo({ tab: "memory", context: { address, action: "hexview" } }),
    },
  ];
  if (moduleName) {
    actions.push({
      label: "View in Modules",
      icon: "M",
      onClick: () =>
        navigateTo({
          tab: "modules",
          context: { moduleName, address },
        }),
    });
  }
  actions.push(
    {
      section: "Actions",
      label: "Hook Function",
      icon: "H",
      onClick: () =>
        navigateTo({
          tab: "native",
          context: { address, action: "hook" },
        }),
    },
    {
      label: "Pin to Pinboard",
      icon: "P",
      onClick: () =>
        navigateTo({
          tab: "pinboard",
          context: { type: "address", value: address, label: moduleName },
        }),
    },
  );
  return actions;
}

export function buildModuleActions(moduleName: string): PopoverAction[] {
  return [
    {
      section: "Navigate",
      label: "View Exports",
      icon: "M",
      onClick: () =>
        navigateTo({ tab: "modules", context: { moduleName } }),
    },
    {
      section: "Actions",
      label: "Pin to Pinboard",
      icon: "P",
      onClick: () =>
        navigateTo({
          tab: "pinboard",
          context: { type: "module", value: moduleName },
        }),
    },
  ];
}

export function buildSymbolActions(
  symbol: string,
  address?: string,
  moduleName?: string,
): PopoverAction[] {
  const actions: PopoverAction[] = [];
  if (address) {
    actions.push({
      section: "Navigate",
      label: "View in Memory",
      icon: "#",
      onClick: () =>
        navigateTo({ tab: "memory", context: { address, action: "hexview" } }),
    });
  }
  if (moduleName) {
    actions.push({
      label: "View in Modules",
      icon: "M",
      onClick: () =>
        navigateTo({ tab: "modules", context: { moduleName } }),
    });
  }
  actions.push({
    section: "Actions",
    label: "Hook Function",
    icon: "H",
    onClick: () => {
      const target = address
        ? address
        : moduleName
          ? `${moduleName}!${symbol}`
          : symbol;
      navigateTo({
        tab: "native",
        context: { address: target, action: "hook" },
      });
    },
  });
  actions.push({
    label: "Pin to Pinboard",
    icon: "P",
    onClick: () =>
      navigateTo({
        tab: "pinboard",
        context: { type: "symbol", value: symbol, label: address },
      }),
  });
  return actions;
}

export function buildClassActions(
  className: string,
  type: "java" | "objc",
): PopoverAction[] {
  return [
    {
      section: "Navigate",
      label: `View in ${type === "java" ? "Java" : "ObjC"} Tab`,
      icon: type === "java" ? "J" : "O",
      onClick: () =>
        navigateTo({
          tab: type === "java" ? "java" : "objc",
          context: { className },
        }),
    },
    {
      section: "Actions",
      label: "Pin to Pinboard",
      icon: "P",
      onClick: () =>
        navigateTo({
          tab: "pinboard",
          context: { type: "class", value: className },
        }),
    },
  ];
}

export function buildThreadActions(threadId: number): PopoverAction[] {
  return [
    {
      section: "Navigate",
      label: "View Backtrace",
      icon: "T",
      onClick: () =>
        navigateTo({
          tab: "threads",
          context: { threadId },
        }),
    },
    {
      section: "Actions",
      label: "Start Stalker",
      icon: "S",
      onClick: () =>
        navigateTo({
          tab: "native",
          context: { threadId, action: "stalker" },
        }),
    },
    {
      label: "Pin to Pinboard",
      icon: "P",
      onClick: () =>
        navigateTo({
          tab: "pinboard",
          context: { type: "thread", value: String(threadId) },
        }),
    },
  ];
}
