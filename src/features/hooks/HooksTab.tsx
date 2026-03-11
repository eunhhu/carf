import {
	For,
	Show,
	createDeferred,
	createMemo,
	createSignal,
	onMount,
} from "solid-js";
import { ActionPopover, buildAddressActions } from "~/components/ActionPopover";
import { CopyButton } from "~/components/CopyButton";
import { InlineActions } from "~/components/InlineActions";
import type { OverflowAction } from "~/components/InlineActions";
import { activeSession } from "~/features/session/session.store";
import { cn } from "~/lib/cn";
import { pickTextFile } from "~/lib/file-picker";
import { formatAddress } from "~/lib/format";
import { navigateTo } from "~/lib/navigation";
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
	const deferredTypeFilter = createDeferred(typeFilter);

	onMount(() => {
		const session = activeSession();
		if (session) {
			fetchHooks(session.id).catch((e) =>
				console.error("fetchHooks on mount failed:", e),
			);
		}
	});

	const filtered = createMemo(() => {
		const filter = deferredTypeFilter();
		if (filter === "all") return hooksState.hooks;
		return hooksState.hooks.filter((h) => h.type === filter);
	});

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

	function handleExportAsScript() {
		const hooks = hooksState.hooks;
		if (hooks.length === 0) return;

		const lines: string[] = [
			"// CARF Hook Configuration Script",
			`// Generated: ${new Date().toISOString()}`,
			`// Hooks: ${hooks.length}`,
			"",
		];

		const nativeHooks = hooks.filter((h) => h.type === "native");
		const javaHooks = hooks.filter((h) => h.type === "java");
		const objcHooks = hooks.filter((h) => h.type === "objc");

		if (nativeHooks.length > 0) {
			lines.push("// --- Native Hooks ---");
			for (const hook of nativeHooks) {
				lines.push(
					`Interceptor.attach(Module.findExportByName(${hook.target.includes("!") ? `"${hook.target.split("!")[0]}", "${hook.target.split("!")[1]}"` : `null, "${hook.target}"`}), {`,
				);
				lines.push("  onEnter(args) {");
				lines.push(
					`    send({ type: "hook:enter", data: { target: "${hook.target}", args: [args[0], args[1], args[2], args[3]].map(String) }});`,
				);
				lines.push("  },");
				lines.push("  onLeave(retval) {");
				lines.push(
					`    send({ type: "hook:leave", data: { target: "${hook.target}", retval: retval.toString() }});`,
				);
				lines.push("  }");
				lines.push("});");
				lines.push("");
			}
		}

		if (javaHooks.length > 0) {
			lines.push("// --- Java Hooks ---");
			lines.push("Java.perform(function() {");
			for (const hook of javaHooks) {
				const dot = hook.target.lastIndexOf(".");
				if (dot <= 0) continue;
				const className = hook.target.slice(0, dot);
				const methodName = hook.target.slice(dot + 1);
				lines.push(`  var cls = Java.use("${className}");`);
				lines.push(`  cls.${methodName}.implementation = function() {`);
				lines.push(
					`    send({ type: "hook:enter", data: { target: "${hook.target}", args: Array.from(arguments).map(String) }});`,
				);
				lines.push(`    var ret = this.${methodName}.apply(this, arguments);`);
				lines.push(
					`    send({ type: "hook:leave", data: { target: "${hook.target}", retval: String(ret) }});`,
				);
				lines.push("    return ret;");
				lines.push("  };");
				lines.push("");
			}
			lines.push("});");
			lines.push("");
		}

		if (objcHooks.length > 0) {
			lines.push("// --- ObjC Hooks ---");
			for (const hook of objcHooks) {
				const space = hook.target.indexOf(" ");
				if (space <= 0) continue;
				const className = hook.target.slice(0, space);
				const selector = hook.target.slice(space + 1);
				lines.push(
					`var ${className.replace(/[^a-zA-Z]/g, "_")}_impl = ObjC.classes.${className}["- ${selector}"].implementation;`,
				);
				lines.push(
					`Interceptor.attach(${className.replace(/[^a-zA-Z]/g, "_")}_impl, {`,
				);
				lines.push("  onEnter(args) {");
				lines.push(
					`    send({ type: "hook:enter", data: { target: "${hook.target}" }});`,
				);
				lines.push("  },");
				lines.push("  onLeave(retval) {");
				lines.push(
					`    send({ type: "hook:leave", data: { target: "${hook.target}", retval: retval.toString() }});`,
				);
				lines.push("  }");
				lines.push("});");
				lines.push("");
			}
		}

		const script = lines.join("\n");
		const blob = new Blob([script], { type: "text/javascript" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "carf-hooks.js";
		a.click();
		URL.revokeObjectURL(url);
	}

	function buildOverflowActions(hook: HookInfo): OverflowAction[] {
		const actions: OverflowAction[] = [
			{
				label: "Copy Target",
				onClick: () => navigator.clipboard.writeText(hook.target),
			},
		];
		if (hook.address) {
			const address = hook.address;
			actions.push({
				label: "Copy Address",
				onClick: () => navigator.clipboard.writeText(address),
			});
		}
		actions.push({
			label: "View Hook Events",
			onClick: () =>
				navigateTo({
					tab: "console",
					context: { filter: hook.target },
				}),
		});
		actions.push({
			label: "Remove Hook",
			separator: true,
			onClick: () => handleDelete(hook),
		});
		return actions;
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
						<option value="swift">Swift</option>
						<option value="il2cpp">IL2CPP</option>
					</select>
					<button
						type="button"
						class="cursor-pointer rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
						onClick={handleExport}
					>
						Export
					</button>
					<button
						type="button"
						class="cursor-pointer rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
						onClick={handleImport}
					>
						Import
					</button>
					<button
						type="button"
						class="cursor-pointer rounded px-2 py-0.5 text-xs text-primary hover:bg-primary/10"
						onClick={handleExportAsScript}
					>
						Export as Script
					</button>
				</div>
			</div>

			{/* Hook table */}
			<div class="flex-1 overflow-auto">
				{/* Table header */}
				<div class="sticky top-0 flex items-center border-b bg-surface px-4 py-1.5 text-[10px] font-medium uppercase text-muted-foreground">
					<span class="w-6 shrink-0" />
					<span class="w-16 shrink-0">ID</span>
					<span class="w-14 shrink-0">Type</span>
					<span class="min-w-0 flex-1">Target</span>
					<span class="w-36 shrink-0">Address</span>
					<span class="w-12 shrink-0 text-right">Hits</span>
					<span class="w-20 shrink-0" />
				</div>

				<For each={filtered()}>
					{(hook) => (
						<div class="group/row flex items-center border-b border-border/30 px-4 py-1.5 text-xs hover:bg-surface-hover">
							<span class="w-6 shrink-0">
								<span
									class={cn(
										"inline-block h-2 w-2 rounded-full",
										hook.active ? "bg-success" : "bg-muted-foreground",
									)}
								/>
							</span>
							<span
								class="w-16 shrink-0 truncate font-mono text-muted-foreground"
								title={hook.id}
							>
								{hook.id}
							</span>
							<span class="w-14 shrink-0">
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
							<span class="min-w-0 flex-1 flex items-center gap-1 font-mono">
								<span class="min-w-0 truncate" title={hook.target}>
									{hook.target}
								</span>
								<CopyButton value={hook.target} class="shrink-0" />
							</span>
							<span class="w-36 shrink-0 flex items-center gap-1 font-mono text-muted-foreground">
								<Show when={hook.address} keyed fallback={<span>-</span>}>
									{(address) => (
										<>
											<ActionPopover
												type="address"
												value={address}
												actions={buildAddressActions(address)}
											>
												{formatAddress(address)}
											</ActionPopover>
											<CopyButton value={address} class="shrink-0" />
										</>
									)}
								</Show>
							</span>
							<span class="w-12 shrink-0 text-right font-mono">
								{hook.hits}
							</span>
							<span class="w-20 shrink-0 flex justify-end">
								<InlineActions
									primary={[
										{
											label: hook.active ? "ON" : "OFF",
											variant: hook.active ? "primary" : "default",
											onClick: (e: MouseEvent) => {
												e.stopPropagation();
												handleToggle(hook);
											},
										},
									]}
									overflow={buildOverflowActions(hook)}
								/>
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
