import {
	For,
	Match,
	Show,
	Switch,
	createEffect,
	createSignal,
	onCleanup,
} from "solid-js";
import { ActionPopover, buildAddressActions } from "~/components/ActionPopover";
import { CopyButton } from "~/components/CopyButton";
import { InlineActions } from "~/components/InlineActions";
import { hooksByType } from "~/features/hooks/hooks.store";
import { activeSession } from "~/features/session/session.store";
import { cn } from "~/lib/cn";
import { formatAddress } from "~/lib/format";
import { consumeNavigationContext, navigateTo } from "~/lib/navigation";
import {
	callNativeFunction,
	fetchStalkerEvents,
	hookNativeFunction,
	nativeState,
	nativeSubMode,
	setFunctionAddress,
	setInterceptorTarget,
	setNativeSubMode,
	setStalkerThread,
	setupStalkerListener,
	startStalker,
	stopStalker,
} from "./native.store";
import type { NativeSubMode } from "./native.store";

const SUB_MODES: { id: NativeSubMode; label: string }[] = [
	{ id: "interceptor", label: "Interceptor" },
	{ id: "stalker", label: "Stalker" },
	{ id: "functions", label: "Functions" },
];

function NativeTab() {
	createEffect(() => {
		const session = activeSession();
		if (!session) return;
		const cleanup = setupStalkerListener(session.id);
		onCleanup(cleanup);
	});

	// Handle cross-tab navigation context
	createEffect(() => {
		const context = consumeNavigationContext();
		if (!context) return;

		if (context.action === "hook" && typeof context.address === "string") {
			setNativeSubMode("interceptor");
			setInterceptorTarget(context.address);
		} else if (context.action === "stalker" && context.threadId != null) {
			setNativeSubMode("stalker");
			setStalkerThread(Number(context.threadId));
		}
	});

	return (
		<div class="flex h-full flex-col">
			{/* Header */}
			<div class="flex items-center justify-between border-b px-4 py-2">
				<div class="flex items-center gap-2">
					<span class="text-sm font-semibold">Native</span>
				</div>
				<div class="flex items-center gap-1">
					<For each={SUB_MODES}>
						{(mode) => (
							<button
								type="button"
								class={cn(
									"cursor-pointer rounded px-2 py-0.5 text-xs transition-colors",
									nativeSubMode() === mode.id
										? "bg-muted text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
								onClick={() => setNativeSubMode(mode.id)}
							>
								{mode.label}
							</button>
						)}
					</For>
				</div>
			</div>

			<div class="flex-1 overflow-auto">
				<Switch>
					<Match when={nativeSubMode() === "interceptor"}>
						<InterceptorView />
					</Match>
					<Match when={nativeSubMode() === "stalker"}>
						<StalkerView />
					</Match>
					<Match when={nativeSubMode() === "functions"}>
						<FunctionsView />
					</Match>
				</Switch>
			</div>
		</div>
	);
}

function InterceptorView() {
	const nativeHooks = () => hooksByType("native");
	const [captureArgs, setCaptureArgs] = createSignal(true);
	const [captureRetval, setCaptureRetval] = createSignal(true);
	const [captureBacktrace, setCaptureBacktrace] = createSignal(false);

	async function handleHook() {
		const session = activeSession();
		if (!session || !nativeState.interceptorTarget) return;
		await hookNativeFunction(session.id, nativeState.interceptorTarget, {
			captureArgs: captureArgs(),
			captureRetval: captureRetval(),
			captureBacktrace: captureBacktrace(),
		});
	}

	return (
		<div class="p-4">
			{/* Hook target input */}
			<div class="flex gap-2">
				<input
					type="text"
					class="flex-1 rounded border bg-background px-3 py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
					placeholder="module!symbol or 0xaddress"
					value={nativeState.interceptorTarget}
					onInput={(e) => setInterceptorTarget(e.currentTarget.value)}
					onKeyDown={(e) => e.key === "Enter" && handleHook()}
				/>
				<button
					type="button"
					class="cursor-pointer rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-opacity hover:opacity-90"
					onClick={handleHook}
				>
					Hook
				</button>
			</div>

			{/* Options */}
			<div class="mt-2 flex gap-3 text-xs text-muted-foreground">
				<label class="flex cursor-pointer items-center gap-1">
					<input
						type="checkbox"
						checked={captureArgs()}
						onChange={(e) => setCaptureArgs(e.currentTarget.checked)}
						class="rounded"
					/>
					Capture Args
				</label>
				<label class="flex cursor-pointer items-center gap-1">
					<input
						type="checkbox"
						checked={captureRetval()}
						onChange={(e) => setCaptureRetval(e.currentTarget.checked)}
						class="rounded"
					/>
					Capture Retval
				</label>
				<label class="flex cursor-pointer items-center gap-1">
					<input
						type="checkbox"
						checked={captureBacktrace()}
						onChange={(e) => setCaptureBacktrace(e.currentTarget.checked)}
						class="rounded"
					/>
					Backtrace
				</label>
			</div>

			{/* Active hooks table */}
			<div class="mt-4">
				<h4 class="mb-2 text-xs font-medium text-muted-foreground">
					Active Hooks ({nativeHooks().length})
				</h4>
				<For each={nativeHooks()}>
					{(hook) => (
						<div class="group/row flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors hover:bg-surface-hover">
							<span
								class={cn(
									"h-2 w-2 shrink-0 rounded-full",
									hook.active ? "bg-success" : "bg-muted-foreground",
								)}
							/>
							<Show when={hook.address}>
								{(() => {
									const address = hook.address ?? "0x0";
									return (
										<ActionPopover
											type="address"
											value={address}
											actions={buildAddressActions(address)}
										>
											{formatAddress(address)}
										</ActionPopover>
									);
								})()}
							</Show>
							<span
								class="min-w-0 flex-1 truncate font-mono"
								title={hook.target}
							>
								{hook.target}
							</span>
							<span class="shrink-0 text-muted-foreground">
								{hook.hits} hits
							</span>
							<CopyButton value={hook.address ?? hook.target} />
							<InlineActions
								primary={[
									{
										label: hook.active ? "Disable" : "Enable",
										variant: hook.active ? "default" : "primary",
										onClick: (e) => {
											e.stopPropagation();
											// Toggle handled by hooks store
										},
									},
								]}
								overflow={[
									{
										label: "Copy Target",
										onClick: () => navigator.clipboard.writeText(hook.target),
									},
									...(hook.address
										? [
												{
													label: "View in Memory",
													onClick: () =>
														navigateTo({
															tab: "memory",
															context: {
																address: hook.address ?? "0x0",
																action: "hexview",
															},
														}),
												},
											]
										: []),
									{
										label: "View Hook Events",
										separator: true,
										onClick: () =>
											navigateTo({
												tab: "console",
												context: { filter: hook.id },
											}),
									},
								]}
							/>
						</div>
					)}
				</For>
			</div>
		</div>
	);
}

function StalkerView() {
	const [threadIdInput, setThreadIdInput] = createSignal("");
	const [callEvent, setCallEvent] = createSignal(true);
	const [retEvent, setRetEvent] = createSignal(true);
	const [execEvent, setExecEvent] = createSignal(false);
	const [blockEvent, setBlockEvent] = createSignal(false);

	createEffect(() => {
		const threadId = nativeState.stalkerThreadId;
		if (threadId !== null) {
			setThreadIdInput(String(threadId));
		}
	});

	async function handleToggleStalker() {
		const session = activeSession();
		if (!session) return;
		const threadId =
			nativeState.stalkerActive && nativeState.stalkerThreadId !== null
				? nativeState.stalkerThreadId
				: Number.parseInt(threadIdInput(), 10);
		if (Number.isNaN(threadId)) return;

		if (nativeState.stalkerActive) {
			await stopStalker(session.id, threadId);
		} else {
			const events: string[] = [];
			if (callEvent()) events.push("call");
			if (retEvent()) events.push("ret");
			if (execEvent()) events.push("exec");
			if (blockEvent()) events.push("block");
			await startStalker(session.id, threadId, events);
		}
	}

	async function handleSample(): Promise<void> {
		const session = activeSession();
		if (!session || nativeState.stalkerThreadId === null) return;
		await fetchStalkerEvents(session.id, nativeState.stalkerThreadId);
	}

	return (
		<div class="p-4">
			<div class="flex items-center gap-2">
				<input
					type="text"
					class="w-32 rounded border bg-background px-2 py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
					placeholder="Thread ID"
					value={threadIdInput()}
					onInput={(e) => setThreadIdInput(e.currentTarget.value)}
					onKeyDown={(e) => e.key === "Enter" && handleToggleStalker()}
				/>
				<button
					type="button"
					class={cn(
						"cursor-pointer rounded px-3 py-1.5 text-xs transition-opacity hover:opacity-90",
						nativeState.stalkerActive
							? "bg-destructive text-destructive-foreground"
							: "bg-primary text-primary-foreground",
					)}
					onClick={handleToggleStalker}
				>
					{nativeState.stalkerActive ? "Stop" : "Start"} Stalker
				</button>
				<Show
					when={
						nativeState.stalkerActive && nativeState.stalkerMode === "sampling"
					}
				>
					<button
						type="button"
						class="cursor-pointer rounded border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
						onClick={() => void handleSample()}
					>
						Sample
					</button>
					<span class="text-xs text-muted-foreground">Sampling mode</span>
				</Show>
			</div>

			<div class="mt-2 flex gap-2 text-xs text-muted-foreground">
				<label class="flex cursor-pointer items-center gap-1">
					<input
						type="checkbox"
						checked={callEvent()}
						onChange={(e) => setCallEvent(e.currentTarget.checked)}
						class="rounded"
					/>
					call
				</label>
				<label class="flex cursor-pointer items-center gap-1">
					<input
						type="checkbox"
						checked={retEvent()}
						onChange={(e) => setRetEvent(e.currentTarget.checked)}
						class="rounded"
					/>
					ret
				</label>
				<label class="flex cursor-pointer items-center gap-1">
					<input
						type="checkbox"
						checked={execEvent()}
						onChange={(e) => setExecEvent(e.currentTarget.checked)}
						class="rounded"
					/>
					exec
				</label>
				<label class="flex cursor-pointer items-center gap-1">
					<input
						type="checkbox"
						checked={blockEvent()}
						onChange={(e) => setBlockEvent(e.currentTarget.checked)}
						class="rounded"
					/>
					block
				</label>
			</div>

			{/* Call trace */}
			<div class="mt-4">
				<For each={nativeState.stalkerEvents}>
					{(event) => (
						<div
							class="group/row flex items-center gap-1 font-mono text-xs"
							style={{ "padding-left": `${event.depth * 12}px` }}
						>
							<span
								class={cn(
									event.type === "call" ? "text-success" : "text-primary",
								)}
							>
								{event.type === "call" ? "=>" : "<="}
							</span>
							<Show when={event.toModule}>
								{(() => {
									const moduleName = event.toModule ?? "unknown";
									return (
										<ActionPopover
											type="module"
											value={moduleName}
											actions={[
												{
													section: "Navigate",
													label: "View in Modules",
													icon: "M",
													onClick: () =>
														navigateTo({
															tab: "modules",
															context: { moduleName },
														}),
												},
											]}
											class="text-muted-foreground"
										>
											{moduleName}!
										</ActionPopover>
									);
								})()}
							</Show>
							<ActionPopover
								type="address"
								value={event.to}
								actions={buildAddressActions(
									event.to,
									event.toModule ?? undefined,
								)}
							>
								{event.toSymbol ?? formatAddress(event.to)}
							</ActionPopover>
							<Show when={(event.count ?? 1) > 1}>
								<span class="text-muted-foreground">x{event.count}</span>
							</Show>
							<CopyButton value={event.to} />
						</div>
					)}
				</For>
			</div>
		</div>
	);
}

function FunctionsView() {
	const [retType, setRetType] = createSignal(nativeState.functionRetType);
	const [argTypesInput, setArgTypesInput] = createSignal("");
	const [argsInput, setArgsInput] = createSignal("");

	async function handleCall() {
		const session = activeSession();
		if (!session || !nativeState.functionAddress) return;
		const argTypes = argTypesInput()
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		const args = argsInput()
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		await callNativeFunction(
			session.id,
			nativeState.functionAddress,
			retType(),
			argTypes,
			args,
		);
	}

	return (
		<div class="p-4">
			<div class="space-y-2">
				<input
					type="text"
					class="w-full rounded border bg-background px-3 py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
					placeholder="Function address (0x...)"
					value={nativeState.functionAddress}
					onInput={(e) => setFunctionAddress(e.currentTarget.value)}
				/>
				<div class="flex gap-2">
					<input
						type="text"
						class="flex-1 rounded border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground"
						placeholder="Return type (e.g., int)"
						value={retType()}
						onInput={(e) => setRetType(e.currentTarget.value)}
					/>
					<input
						type="text"
						class="flex-1 rounded border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground"
						placeholder="Arg types (e.g., pointer, int)"
						value={argTypesInput()}
						onInput={(e) => setArgTypesInput(e.currentTarget.value)}
					/>
				</div>
				<input
					type="text"
					class="w-full rounded border bg-background px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground"
					placeholder="Arguments (comma separated)"
					value={argsInput()}
					onInput={(e) => setArgsInput(e.currentTarget.value)}
					onKeyDown={(e) => e.key === "Enter" && handleCall()}
				/>
				<button
					type="button"
					class="cursor-pointer rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-opacity hover:opacity-90"
					onClick={handleCall}
				>
					Call Function
				</button>
			</div>

			{/* Results */}
			<Show when={nativeState.functionResults.length > 0}>
				<div class="mt-4">
					<h4 class="mb-2 text-xs font-medium text-muted-foreground">
						Results
					</h4>
					<For each={nativeState.functionResults}>
						{(result) => (
							<div class="group/row flex items-center gap-2 py-0.5 font-mono text-xs">
								<ActionPopover
									type="address"
									value={result.address}
									actions={buildAddressActions(result.address)}
								>
									{formatAddress(result.address)}
								</ActionPopover>
								<span class="text-primary">=&gt;</span>
								<span class="min-w-0 flex-1 truncate">
									{String(result.retval)}
								</span>
								<CopyButton value={String(result.retval)} />
							</div>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
}

export default NativeTab;
