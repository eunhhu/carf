import { For } from "solid-js";
import { cn } from "~/lib/cn";
import type { TabId } from "~/lib/types";

interface NavItem {
  id: TabId;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "console", label: "Console", icon: ">" },
  { id: "modules", label: "Modules", icon: "M" },
  { id: "threads", label: "Threads", icon: "T" },
  { id: "memory", label: "Memory", icon: "#" },
  { id: "java", label: "Java", icon: "J" },
  { id: "objc", label: "ObjC", icon: "O" },
  { id: "native", label: "Native", icon: "N" },
  { id: "script", label: "Script", icon: "S" },
  { id: "hooks", label: "Hooks", icon: "H" },
  { id: "pinboard", label: "Pinboard", icon: "P" },
  { id: "callgraph", label: "Call Graph", icon: "G" },
  { id: "network", label: "Network", icon: "W" },
  { id: "files", label: "Files", icon: "F" },
];

interface SessionNavBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function SessionNavBar(props: SessionNavBarProps) {
  return (
    <nav class="flex w-12 flex-col items-center border-r bg-surface py-2">
      <For each={NAV_ITEMS}>
        {(item) => {
          const isActive = () => props.activeTab === item.id;

          return (
            <button
              class={cn(
                "relative flex h-10 w-10 items-center justify-center rounded-lg text-xs font-medium transition-colors",
                isActive()
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
              onClick={() => props.onTabChange(item.id)}
              title={item.label}
            >
              {/* Active indicator */}
              {isActive() && (
                <span class="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
              )}
              <span class="font-mono">{item.icon}</span>
            </button>
          );
        }}
      </For>
    </nav>
  );
}
