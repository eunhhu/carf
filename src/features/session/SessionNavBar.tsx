import {
	Anchor,
	Apple,
	Binary,
	Coffee,
	Cpu,
	FileCode2,
	FolderOpen,
	GitFork,
	Globe,
	MemoryStick,
	Package,
	Pin,
	Terminal,
} from "lucide-solid";
import { type Component, For } from "solid-js";
import { cn } from "~/lib/cn";
import type { TabId } from "~/lib/types";
import { preloadTabComponent } from "./SessionMainContent";

interface NavItem {
	id: TabId;
	label: string;
	icon: Component<{ size?: number; class?: string }>;
}

const NAV_ITEMS: NavItem[] = [
	{ id: "console", label: "Console", icon: Terminal },
	{ id: "modules", label: "Modules", icon: Package },
	{ id: "threads", label: "Threads", icon: Cpu },
	{ id: "memory", label: "Memory", icon: MemoryStick },
	{ id: "java", label: "Java", icon: Coffee },
	{ id: "objc", label: "ObjC", icon: Apple },
	{ id: "native", label: "Native", icon: Binary },
	{ id: "script", label: "Script", icon: FileCode2 },
	{ id: "hooks", label: "Hooks", icon: Anchor },
	{ id: "pinboard", label: "Pinboard", icon: Pin },
	{ id: "callgraph", label: "Call Graph", icon: GitFork },
	{ id: "network", label: "Network", icon: Globe },
	{ id: "files", label: "Files", icon: FolderOpen },
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
					const Icon = item.icon;

					return (
						<button
							type="button"
							class={cn(
								"relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
								isActive()
									? "bg-muted text-foreground"
									: "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
							)}
							onClick={() => props.onTabChange(item.id)}
							onFocus={() => {
								void preloadTabComponent(item.id);
							}}
							onMouseEnter={() => {
								void preloadTabComponent(item.id);
							}}
							title={item.label}
						>
							{isActive() && (
								<span class="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
							)}
							<Icon size={18} />
						</button>
					);
				}}
			</For>
		</nav>
	);
}
