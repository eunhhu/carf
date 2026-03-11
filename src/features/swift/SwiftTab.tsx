import { For, Show, createEffect } from "solid-js";
import {
	swiftState,
	filteredSwiftModules,
	swiftSearchQuery,
	setSwiftSearchQuery,
	selectSwiftModule,
	selectSwiftType,
	checkSwiftAvailable,
	fetchSwiftModules,
	fetchSwiftTypes,
	hookSwiftFunction,
	unhookSwiftFunction,
} from "./swift.store";
import { hooksState, deleteHook } from "~/features/hooks/hooks.store";
import { cn } from "~/lib/cn";
import { activeSession } from "~/features/session/session.store";
import { SplitPane } from "~/components/SplitPane";
import { CopyButton } from "~/components/CopyButton";
import { InlineActions } from "~/components/InlineActions";
import { navigateTo } from "~/lib/navigation";

const KIND_COLORS: Record<string, string> = {
	class: "text-primary",
	struct: "text-success",
	enum: "text-warning",
	protocol: "text-purple-400",
};

function SwiftTab() {
	createEffect(() => {
		const sessionId = activeSession()?.id;
		if (!sessionId) return;

		void (async () => {
			const available = await checkSwiftAvailable(sessionId);
			if (available && activeSession()?.id === sessionId) {
				await fetchSwiftModules(sessionId);
			}
		})();
	});

	return (
		<div class="flex h-full flex-col">
			{/* Header */}
			<div class="flex items-center justify-between border-b px-4 py-2">
				<div class="flex items-center gap-2">
					<span class="text-sm font-semibold">Swift</span>
					<Show when={swiftState.available === false}>
						<span class="rounded bg-warning/10 px-1.5 py-0.5 text-xs text-warning">
							Not Available
						</span>
					</Show>
					<Show when={swiftState.available === true}>
						<span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
							{swiftState.modules.length} modules
						</span>
					</Show>
				</div>
				<input
					type="text"
					class="rounded border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
					placeholder="Search modules..."
					value={swiftSearchQuery()}
					onInput={(e) => setSwiftSearchQuery(e.currentTarget.value)}
				/>
			</div>

			{/* Split: Module list + Detail */}
			<SplitPane
				id="swift"
				minLeft={180}
				maxLeft={400}
				defaultLeft={260}
				left={
					<div class="h-full overflow-auto">
						<Show
							when={!swiftState.modulesLoading}
							fallback={
								<div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
									Loading modules...
								</div>
							}
						>
							<For each={filteredSwiftModules()}>
								{(moduleName) => {
									const isSelected = () =>
										swiftState.selectedModule === moduleName;
									return (
										<button
											class={cn(
												"group/row flex w-full cursor-pointer items-center gap-1 px-3 py-1 text-left font-mono text-xs transition-colors hover:bg-surface-hover",
												isSelected() && "bg-muted",
											)}
											onClick={() => {
												selectSwiftModule(moduleName);
												const session = activeSession();
												if (session) {
													fetchSwiftTypes(session.id, moduleName);
												}
											}}
										>
											<span class="truncate" title={moduleName}>
												{moduleName}
											</span>
											<CopyButton
												value={moduleName}
												class="ml-auto opacity-0 group-hover/row:opacity-100"
											/>
										</button>
									);
								}}
							</For>
						</Show>
					</div>
				}
				right={
					<div class="h-full overflow-auto">
						<Show
							when={swiftState.selectedModule}
							fallback={
								<div class="flex h-full items-center justify-center text-xs text-muted-foreground">
									Select a module to view types
								</div>
							}
						>
							<div class="p-4">
								<div class="mb-3 flex items-center gap-2">
									<h3
										class="truncate font-mono text-sm font-semibold"
										title={swiftState.selectedModule!}
									>
										{swiftState.selectedModule}
									</h3>
									<CopyButton value={swiftState.selectedModule!} />
								</div>

								{/* Types list */}
								<Show
									when={!swiftState.typesLoading}
									fallback={
										<div class="py-4 text-center text-xs text-muted-foreground">
											Loading types...
										</div>
									}
								>
									<Show
										when={!swiftState.selectedType}
										fallback={<SwiftTypeDetail />}
									>
										<For each={swiftState.types}>
											{(type) => (
												<button
													class="group/row flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-surface-hover"
													onClick={() => selectSwiftType(type.name)}
												>
													<span
														class={cn(
															"w-14 shrink-0 text-[10px] font-medium uppercase",
															KIND_COLORS[type.kind] ?? "text-muted-foreground",
														)}
													>
														{type.kind}
													</span>
													<span class="truncate font-mono" title={type.name}>
														{type.name}
													</span>
													<span class="ml-auto text-muted-foreground">
														{type.methods.length}m
													</span>
												</button>
											)}
										</For>
										<Show when={swiftState.types.length === 0}>
											<div class="py-4 text-center text-xs text-muted-foreground">
												No types found
											</div>
										</Show>
									</Show>
								</Show>
							</div>
						</Show>
					</div>
				}
			/>
		</div>
	);
}

function SwiftTypeDetail() {
	const currentType = () =>
		swiftState.types.find((t) => t.name === swiftState.selectedType);

	function findHookForMethod(address: string) {
		return hooksState.hooks.find(
			(h) => h.type === "swift" && h.address === address,
		);
	}

	return (
		<div>
			<button
				class="mb-3 cursor-pointer text-xs text-primary hover:underline"
				onClick={() => selectSwiftType(null)}
			>
				&larr; Back to types
			</button>

			<Show when={currentType()}>
				{(type) => (
					<>
						<div class="mb-2 flex items-center gap-2">
							<span
								class={cn(
									"text-[10px] font-medium uppercase",
									KIND_COLORS[type().kind] ?? "text-muted-foreground",
								)}
							>
								{type().kind}
							</span>
							<span class="font-mono text-sm font-semibold">{type().name}</span>
							<CopyButton value={type().name} />
						</div>
						<Show when={type().mangledName}>
							<div class="mb-3 font-mono text-[10px] text-muted-foreground">
								{type().mangledName}
							</div>
						</Show>

						<div class="border-t pt-2">
							<div class="mb-1 text-[10px] font-medium uppercase text-muted-foreground">
								Methods ({swiftState.methods.length})
							</div>
							<For each={swiftState.methods}>
								{(method) => {
									const isHooked = () => method.hooked;
									return (
										<div class="group/row flex items-center gap-2 py-0.5 text-xs">
											<Show when={isHooked()}>
												<span class="rounded bg-primary/10 px-1 text-[10px] text-primary">
													H
												</span>
											</Show>
											<span class="truncate font-mono" title={method.name}>
												{method.name}
											</span>
											<CopyButton
												value={method.name}
												class="opacity-0 group-hover/row:opacity-100"
											/>
											<div class="ml-auto">
												<InlineActions
													primary={[
														isHooked()
															? {
																	label: "Unhook",
																	variant: "danger" as const,
																	onClick: (e: MouseEvent) => {
																		e.stopPropagation();
																		const session = activeSession();
																		if (session) {
																			const hook = findHookForMethod(
																				method.address,
																			);
																			if (hook) {
																				deleteHook(session.id, hook);
																			}
																			unhookSwiftFunction(
																				session.id,
																				method.address,
																			);
																		}
																	},
																}
															: {
																	label: "Hook",
																	variant: "primary" as const,
																	onClick: (e: MouseEvent) => {
																		e.stopPropagation();
																		const session = activeSession();
																		if (session) {
																			hookSwiftFunction(
																				session.id,
																				method.address,
																				method.name,
																			);
																		}
																	},
																},
													]}
													overflow={[
														{
															label: "Copy Address",
															onClick: () => {
																void navigator.clipboard.writeText(
																	method.address,
																);
															},
														},
														{
															label: "View in Memory",
															onClick: () =>
																navigateTo({
																	tab: "memory",
																	context: {
																		address: method.address,
																		action: "hexview",
																	},
																}),
														},
													]}
												/>
											</div>
										</div>
									);
								}}
							</For>
							<Show when={swiftState.methods.length === 0}>
								<div class="py-4 text-center text-xs text-muted-foreground">
									No methods
								</div>
							</Show>
						</div>
					</>
				)}
			</Show>
		</div>
	);
}

export default SwiftTab;
