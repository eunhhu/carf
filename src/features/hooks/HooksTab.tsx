import { For, Show, createSignal, onMount } from "solid-js";
import { activeSession } from "~/features/session/session.store";
import { cn } from "~/lib/cn";
import { pickTextFile } from "~/lib/file-picker";
import { formatAddress } from "~/lib/format";
import type { HookConfig, HookInfo } from "~/lib/types";
import {
	activeHooks,
	deleteHook,
	exportHookConfigs,
	fetchHooks,
	hooksState,
	importHookConfigs,
	toggleHook,
} from "./hooks.store";

function HooksTab() {
	const [typeFilter, setTypeFilter] = createSignal<HookInfo["type"] | "all">(
		"all",
	);

	onMount(() => {
		const session = activeSession();
		if (session) {
			fetchHooks(session.id).catch((e) =>
				console.error("fetchHooks on mount failed:", e),
			);
		}
	});

	const filtered = () => {
		const filter = typeFilter();
		if (filter === "all") return hooksState.hooks;
		return hooksState.hooks.filter((h) => h.type === filter);
	};

	function handleExport() {
		const configs = exportHookConfigs();
		const json = JSON.stringify({ hooks: configs, version: "1.0" }, null, 2);
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "carf-hooks.json";
		a.click();
		URL.revokeObjectURL(url);
	}

	async function handleImport() {
		const session = activeSession();
		if (!session) return;
		try {
			const selected = await pickTextFile(".json,application/json");
			if (!selected) return;
			const parsed = JSON.parse(selected.content) as { hooks: HookConfig[] };
			if (Array.isArray(parsed.hooks)) {
				await importHookConfigs(session.id, parsed.hooks);
			}
		} catch (e) {
			console.error("handleImport failed:", e);
		}
	}

	async function handleToggle(hook: HookInfo) {
		const session = activeSession();
		if (!session) return;
		await toggleHook(session.id, hook, !hook.active).catch((e) =>
			console.error("toggleHook failed:", e),
		);
	}

	async function handleDelete(hook: HookInfo) {
		const session = activeSession();
		if (!session) return;
		await deleteHook(session.id, hook).catch((e) =>
			console.error("deleteHook failed:", e),
		);
	}

	return (
		<div class="flex h-full flex-col">
			{/* Header */}
			<div class="flex items-center justify-between border-b px-4 py-2">
				<div class="flex items-center gap-2">
					<span class="text-sm font-semibold">Hooks Manager</span>
					<span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
						{activeHooks().length} active / {hooksState.hooks.length} total
					</span>
				</div>
				<div class="flex items-center gap-1">
					<select
						class="rounded border bg-background px-1.5 py-0.5 text-xs"
						value={typeFilter()}
						onChange={(e) =>
							setTypeFilter(e.currentTarget.value as HookInfo["type"] | "all")
						}
					>
						<option value="all">All Types</option>
						<option value="native">Native</option>
						<option value="java">Java</option>
						<option value="objc">ObjC</option>
					</select>
					<button
						type="button"
						class="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
						onClick={handleExport}
					>
						Export
					</button>
					<button
						type="button"
						class="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
						onClick={handleImport}
					>
						Import
					</button>
					<button
						type="button"
						class="rounded px-2 py-0.5 text-xs text-primary hover:bg-primary/10"
					>
						Export as Script
					</button>
				</div>
			</div>

			{/* Hook table */}
			<div class="flex-1 overflow-auto">
				{/* Table header */}
				<div class="sticky top-0 flex gap-2 border-b bg-surface px-4 py-1.5 text-[10px] font-medium uppercase text-muted-foreground">
					<span class="w-6" />
					<span class="w-20">ID</span>
					<span class="w-14">Type</span>
					<span class="flex-1">Target</span>
					<span class="w-28">Address</span>
					<span class="w-14 text-right">Hits</span>
					<span class="w-16 text-center">Status</span>
					<span class="w-16" />
				</div>

				<For each={filtered()}>
					{(hook) => (
						<div class="flex items-center gap-2 border-b border-border/30 px-4 py-1.5 text-xs hover:bg-surface-hover">
							<span class="w-6">
								<span
									class={cn(
										"inline-block h-2 w-2 rounded-full",
										hook.active ? "bg-success" : "bg-muted-foreground",
									)}
								/>
							</span>
							<span class="w-20 font-mono text-muted-foreground">
								{hook.id}
							</span>
							<span class="w-14">
								<span
									class={cn(
										"rounded px-1.5 py-0.5 text-[10px] font-medium",
										hook.type === "native" && "bg-primary/10 text-primary",
										hook.type === "java" && "bg-warning/10 text-warning",
										hook.type === "objc" && "bg-success/10 text-success",
									)}
								>
									{hook.type}
								</span>
							</span>
							<span class="flex-1 truncate font-mono">{hook.target}</span>
							<span class="w-28 font-mono text-muted-foreground">
								{hook.address ? formatAddress(hook.address) : "-"}
							</span>
							<span class="w-14 text-right font-mono">{hook.hits}</span>
							<span class="w-16 text-center">
								<button
									type="button"
									class={cn(
										"rounded px-2 py-0.5 text-[10px]",
										hook.active
											? "bg-success/10 text-success"
											: "bg-muted text-muted-foreground",
									)}
									onClick={() => handleToggle(hook)}
								>
									{hook.active ? "ON" : "OFF"}
								</button>
							</span>
							<span class="w-16 text-right">
								<button
									type="button"
									class="rounded px-1.5 py-0.5 text-[10px] text-destructive hover:bg-destructive/10"
									onClick={() => handleDelete(hook)}
								>
									Remove
								</button>
							</span>
						</div>
					)}
				</For>

				<Show when={filtered().length === 0}>
					<div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
						No hooks configured. Hook functions from Java, ObjC, or Native tabs.
					</div>
				</Show>
			</div>
		</div>
	);
}

export default HooksTab;
