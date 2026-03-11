import { For, Show, createEffect, createSignal } from "solid-js";
import {
	il2cppState,
	filteredIl2cppClasses,
	il2cppSearchQuery,
	setIl2cppSearchQuery,
	il2cppSubTab,
	setIl2cppSubTab,
	selectIl2cppClass,
	checkIl2cppAvailable,
	fetchIl2cppClasses,
	fetchIl2cppMethods,
	fetchIl2cppFields,
	hookIl2cppMethod,
	unhookIl2cppMethod,
	dumpIl2cppMetadata,
} from "./il2cpp.store";
import { hooksState, deleteHook } from "~/features/hooks/hooks.store";
import { cn } from "~/lib/cn";
import { activeSession } from "~/features/session/session.store";
import { SplitPane } from "~/components/SplitPane";
import { CopyButton } from "~/components/CopyButton";
import { InlineActions } from "~/components/InlineActions";
import { navigateTo } from "~/lib/navigation";

function Il2cppTab() {
	const [dumpPath, setDumpPath] = createSignal<string | null>(null);
	const [dumping, setDumping] = createSignal(false);

	createEffect(() => {
		const sessionId = activeSession()?.id;
		if (!sessionId) return;

		void (async () => {
			const available = await checkIl2cppAvailable(sessionId);
			if (available && activeSession()?.id === sessionId) {
				await fetchIl2cppClasses(sessionId);
			}
		})();
	});

	async function handleDump() {
		const session = activeSession();
		if (!session) return;
		setDumping(true);
		const path = await dumpIl2cppMetadata(session.id);
		setDumpPath(path);
		setDumping(false);
	}

	return (
		<div class="flex h-full flex-col">
			{/* Header */}
			<div class="flex items-center justify-between border-b px-4 py-2">
				<div class="flex items-center gap-2">
					<span class="text-sm font-semibold">IL2CPP</span>
					<Show when={il2cppState.available === false}>
						<span class="rounded bg-warning/10 px-1.5 py-0.5 text-xs text-warning">
							Not Available
						</span>
					</Show>
					<Show when={il2cppState.available === true}>
						<span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
							{il2cppState.classes.length} classes
						</span>
					</Show>
					<Show when={il2cppState.info?.version}>
						<span class="text-[10px] text-muted-foreground">
							v{il2cppState.info!.version}
						</span>
					</Show>
				</div>
				<div class="flex items-center gap-2">
					<button
						class="cursor-pointer rounded border px-2 py-1 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
						onClick={handleDump}
						disabled={dumping() || !il2cppState.available}
					>
						{dumping() ? "Dumping..." : "Dump Metadata"}
					</button>
					<input
						type="text"
						class="rounded border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
						placeholder="Search classes..."
						value={il2cppSearchQuery()}
						onInput={(e) => setIl2cppSearchQuery(e.currentTarget.value)}
					/>
				</div>
			</div>

			<Show when={dumpPath()}>
				<div class="flex items-center gap-2 border-b bg-success/5 px-4 py-1.5 text-xs text-success">
					<span>Metadata dumped to:</span>
					<span class="font-mono">{dumpPath()}</span>
					<button
						class="ml-auto cursor-pointer text-muted-foreground hover:text-foreground"
						onClick={() => setDumpPath(null)}
					>
						&times;
					</button>
				</div>
			</Show>

			{/* Split: Class list + Detail */}
			<SplitPane
				id="il2cpp"
				minLeft={200}
				maxLeft={400}
				defaultLeft={280}
				left={
					<div class="h-full overflow-auto">
						<Show
							when={!il2cppState.classesLoading}
							fallback={
								<div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
									Loading classes...
								</div>
							}
						>
							<For each={filteredIl2cppClasses()}>
								{(cls) => {
									const isSelected = () =>
										il2cppState.selectedClass === cls.fullName;
									return (
										<button
											class={cn(
												"group/row flex w-full cursor-pointer items-center gap-1 px-3 py-1 text-left font-mono text-xs transition-colors hover:bg-surface-hover",
												isSelected() && "bg-muted",
											)}
											onClick={() => {
												selectIl2cppClass(cls.fullName);
												const session = activeSession();
												if (session) {
													fetchIl2cppMethods(session.id, cls.fullName);
													fetchIl2cppFields(session.id, cls.fullName);
												}
											}}
										>
											<span class="truncate" title={cls.fullName}>
												<Show when={cls.namespace}>
													<span class="text-muted-foreground">
														{cls.namespace}.
													</span>
												</Show>
												{cls.name}
											</span>
											<span class="ml-auto shrink-0 text-[10px] text-muted-foreground">
												{cls.methodCount}m {cls.fieldCount}f
											</span>
											<CopyButton
												value={cls.fullName}
												class="opacity-0 group-hover/row:opacity-100"
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
							when={il2cppState.selectedClass}
							fallback={
								<div class="flex h-full items-center justify-center text-xs text-muted-foreground">
									Select a class to view details
								</div>
							}
						>
							<div class="p-4">
								<div class="mb-3 flex items-center gap-2">
									<h3
										class="truncate font-mono text-sm font-semibold"
										title={il2cppState.selectedClass!}
									>
										{il2cppState.selectedClass}
									</h3>
									<CopyButton value={il2cppState.selectedClass!} />
								</div>

								{/* Sub-tabs */}
								<div class="flex gap-2 border-b pb-2 text-xs">
									<For each={["methods", "fields"] as const}>
										{(tab) => (
											<button
												class={cn(
													"cursor-pointer rounded px-2 py-0.5 capitalize",
													il2cppSubTab() === tab
														? "bg-muted text-foreground"
														: "text-muted-foreground hover:text-foreground",
												)}
												onClick={() => setIl2cppSubTab(tab)}
											>
												{tab}
											</button>
										)}
									</For>
								</div>

								{/* Methods */}
								<Show when={il2cppSubTab() === "methods"}>
									<div class="mt-2">
										<For each={il2cppState.methods}>
											{(method) => {
												const isHooked = () => method.hooked;
												return (
													<div class="group/row flex items-center gap-2 py-0.5 text-xs">
														<Show when={method.isStatic}>
															<span class="rounded bg-muted px-1 text-[10px] text-muted-foreground">
																S
															</span>
														</Show>
														<Show when={isHooked()}>
															<span class="rounded bg-primary/10 px-1 text-[10px] text-primary">
																H
															</span>
														</Show>
														<span class="text-muted-foreground">
															{method.returnType}
														</span>
														<span class="font-mono font-medium">
															{method.name}
														</span>
														<span class="text-[10px] text-muted-foreground">
															({method.paramCount} params)
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
																						const hook =
																							hooksState.hooks.find(
																								(h) =>
																									h.type === "il2cpp" &&
																									h.address ===
																										method.address,
																							);
																						if (hook) {
																							deleteHook(session.id, hook);
																						}
																						unhookIl2cppMethod(
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
																					if (
																						session &&
																						il2cppState.selectedClass
																					) {
																						hookIl2cppMethod(
																							session.id,
																							il2cppState.selectedClass,
																							method.name,
																							method.address,
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
										<Show
											when={
												il2cppState.methods.length === 0 &&
												!il2cppState.detailLoading
											}
										>
											<div class="py-4 text-center text-xs text-muted-foreground">
												No methods loaded
											</div>
										</Show>
									</div>
								</Show>

								{/* Fields */}
								<Show when={il2cppSubTab() === "fields"}>
									<div class="mt-2">
										<For each={il2cppState.fields}>
											{(field) => (
												<div class="group/row flex items-center gap-2 py-0.5 text-xs">
													<Show when={field.isStatic}>
														<span class="rounded bg-muted px-1 text-[10px] text-muted-foreground">
															S
														</span>
													</Show>
													<span class="text-muted-foreground">
														{field.type}
													</span>
													<span class="font-mono font-medium">
														{field.name}
													</span>
													<span class="ml-auto font-mono text-[10px] text-muted-foreground">
														+0x{field.offset.toString(16)}
													</span>
													<CopyButton
														value={`${field.type} ${field.name}`}
														class="opacity-0 group-hover/row:opacity-100"
													/>
												</div>
											)}
										</For>
										<Show
											when={
												il2cppState.fields.length === 0 &&
												!il2cppState.detailLoading
											}
										>
											<div class="py-4 text-center text-xs text-muted-foreground">
												No fields loaded
											</div>
										</Show>
									</div>
								</Show>
							</div>
						</Show>
					</div>
				}
			/>
		</div>
	);
}

export default Il2cppTab;
