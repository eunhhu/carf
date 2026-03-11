import { For, Show, createEffect, createSignal } from "solid-js";
import {
	antiDetectState,
	fetchCloakStatus,
	cloakThread,
	uncloakThread,
	cloakRange,
	uncloakRange,
	bypassSslPinning,
	bypassRootDetection,
} from "./antidetect.store";
import { activeSession } from "~/features/session/session.store";
import { formatAddress } from "~/lib/format";

function AntiDetectTab() {
	createEffect(() => {
		const session = activeSession();
		if (session) {
			void fetchCloakStatus(session.id);
		}
	});

	return (
		<div class="flex h-full flex-col">
			{/* Header */}
			<div class="flex items-center justify-between border-b px-4 py-2">
				<div class="flex items-center gap-2">
					<span class="text-sm font-semibold">Anti-Detection</span>
					<span class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
						Frida Cloak + Bypass
					</span>
				</div>
				<button
					class="cursor-pointer rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
					onClick={() => {
						const session = activeSession();
						if (session) void fetchCloakStatus(session.id);
					}}
				>
					Refresh
				</button>
			</div>

			{/* Content */}
			<div class="flex-1 overflow-auto p-4">
				<div class="grid gap-6">
					<ThreadCloakSection />
					<RangeCloakSection />
					<BypassSection />
				</div>
			</div>
		</div>
	);
}

function ThreadCloakSection() {
	const [threadIdInput, setThreadIdInput] = createSignal("");

	function handleCloak() {
		const session = activeSession();
		const id = Number(threadIdInput());
		if (!session || Number.isNaN(id)) return;
		void cloakThread(session.id, id);
		setThreadIdInput("");
	}

	return (
		<section>
			<h3 class="mb-2 text-xs font-semibold uppercase text-muted-foreground">
				Thread Cloaking
			</h3>
			<p class="mb-3 text-[10px] text-muted-foreground">
				Cloaked threads are hidden from Process.enumerateThreads() and
				anti-debug checks.
			</p>

			<div class="mb-3 flex items-center gap-2">
				<input
					type="text"
					class="w-28 rounded border bg-background px-2 py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
					placeholder="Thread ID"
					value={threadIdInput()}
					onInput={(e) => setThreadIdInput(e.currentTarget.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleCloak();
					}}
				/>
				<button
					class="cursor-pointer rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
					onClick={handleCloak}
				>
					Cloak
				</button>
			</div>

			<Show
				when={!antiDetectState.statusLoading}
				fallback={
					<div class="text-xs text-muted-foreground">Loading...</div>
				}
			>
				<Show when={antiDetectState.cloakStatus}>
					{(status) => (
						<Show
							when={status().cloakedThreads.length > 0}
							fallback={
								<div class="text-xs text-muted-foreground">
									No cloaked threads
								</div>
							}
						>
							<div class="rounded border">
								<div class="flex items-center border-b px-3 py-1 text-[10px] font-medium uppercase text-muted-foreground">
									<span class="flex-1">Thread ID</span>
									<span class="w-16" />
								</div>
								<For each={status().cloakedThreads}>
									{(threadId) => (
										<div class="flex items-center px-3 py-1 text-xs hover:bg-surface-hover">
											<span class="flex-1 font-mono">#{threadId}</span>
											<button
												class="cursor-pointer rounded px-2 py-0.5 text-[10px] text-destructive hover:bg-destructive/10"
												onClick={() => {
													const session = activeSession();
													if (session) {
														void uncloakThread(session.id, threadId);
													}
												}}
											>
												Uncloak
											</button>
										</div>
									)}
								</For>
							</div>
						</Show>
					)}
				</Show>
			</Show>
		</section>
	);
}

function RangeCloakSection() {
	const [rangeBase, setRangeBase] = createSignal("");
	const [rangeSize, setRangeSize] = createSignal("4096");

	function handleCloak() {
		const session = activeSession();
		if (!session || !rangeBase()) return;
		void cloakRange(session.id, rangeBase(), Number(rangeSize()));
		setRangeBase("");
	}

	return (
		<section>
			<h3 class="mb-2 text-xs font-semibold uppercase text-muted-foreground">
				Range Cloaking
			</h3>
			<p class="mb-3 text-[10px] text-muted-foreground">
				Cloaked memory ranges are hidden from Process.enumerateRanges() and
				Module.enumerateRanges().
			</p>

			<div class="mb-3 flex items-center gap-2">
				<input
					type="text"
					class="w-36 rounded border bg-background px-2 py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
					placeholder="Base (0x...)"
					value={rangeBase()}
					onInput={(e) => setRangeBase(e.currentTarget.value)}
				/>
				<input
					type="text"
					class="w-20 rounded border bg-background px-2 py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
					placeholder="Size"
					value={rangeSize()}
					onInput={(e) => setRangeSize(e.currentTarget.value)}
				/>
				<button
					class="cursor-pointer rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
					onClick={handleCloak}
				>
					Cloak
				</button>
			</div>

			<Show when={antiDetectState.cloakStatus}>
				{(status) => (
					<Show
						when={status().cloakedRanges.length > 0}
						fallback={
							<div class="text-xs text-muted-foreground">
								No cloaked ranges
							</div>
						}
					>
						<div class="rounded border">
							<div class="flex items-center border-b px-3 py-1 text-[10px] font-medium uppercase text-muted-foreground">
								<span class="w-36">Base</span>
								<span class="flex-1">Size</span>
								<span class="w-16" />
							</div>
							<For each={status().cloakedRanges}>
								{(range) => (
									<div class="flex items-center px-3 py-1 text-xs hover:bg-surface-hover">
										<span class="w-36 font-mono">
											{formatAddress(range.base)}
										</span>
										<span class="flex-1">{range.size} bytes</span>
										<button
											class="cursor-pointer rounded px-2 py-0.5 text-[10px] text-destructive hover:bg-destructive/10"
											onClick={() => {
												const session = activeSession();
												if (session) {
													void uncloakRange(
														session.id,
														range.base,
														range.size,
													);
												}
											}}
										>
											Uncloak
										</button>
									</div>
								)}
							</For>
						</div>
					</Show>
				)}
			</Show>
		</section>
	);
}

function BypassSection() {
	return (
		<section>
			<h3 class="mb-2 text-xs font-semibold uppercase text-muted-foreground">
				Bypass Controls
			</h3>
			<p class="mb-3 text-[10px] text-muted-foreground">
				Install hooks to bypass common security checks in the target
				application.
			</p>

			<div class="grid gap-3">
				{/* SSL Pinning Bypass */}
				<div class="rounded border p-3">
					<div class="flex items-center justify-between">
						<div>
							<div class="text-xs font-medium">SSL Pinning Bypass</div>
							<div class="text-[10px] text-muted-foreground">
								Hooks SSL certificate validation to allow MITM inspection
							</div>
						</div>
						<Show
							when={antiDetectState.sslBypass}
							fallback={
								<button
									class="cursor-pointer rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
									onClick={() => {
										const session = activeSession();
										if (session) void bypassSslPinning(session.id);
									}}
									disabled={antiDetectState.sslBypassing}
								>
									{antiDetectState.sslBypassing ? "Installing..." : "Enable"}
								</button>
							}
						>
							<span class="rounded bg-success/10 px-2 py-1 text-xs text-success">
								Active
							</span>
						</Show>
					</div>
					<Show when={antiDetectState.sslBypass}>
						{(result) => (
							<div class="mt-2 border-t pt-2">
								<div class="text-[10px] text-muted-foreground">
									{result().hooksInstalled} hooks installed
								</div>
								<For each={result().details}>
									{(detail) => (
										<div class="text-[10px] text-muted-foreground">
											&bull; {detail}
										</div>
									)}
								</For>
							</div>
						)}
					</Show>
				</div>

				{/* Root Detection Bypass */}
				<div class="rounded border p-3">
					<div class="flex items-center justify-between">
						<div>
							<div class="text-xs font-medium">Root Detection Bypass</div>
							<div class="text-[10px] text-muted-foreground">
								Hooks root/jailbreak detection APIs to return clean results
							</div>
						</div>
						<Show
							when={antiDetectState.rootBypass}
							fallback={
								<button
									class="cursor-pointer rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
									onClick={() => {
										const session = activeSession();
										if (session) void bypassRootDetection(session.id);
									}}
									disabled={antiDetectState.rootBypassing}
								>
									{antiDetectState.rootBypassing ? "Installing..." : "Enable"}
								</button>
							}
						>
							<span class="rounded bg-success/10 px-2 py-1 text-xs text-success">
								Active
							</span>
						</Show>
					</div>
					<Show when={antiDetectState.rootBypass}>
						{(result) => (
							<div class="mt-2 border-t pt-2">
								<div class="text-[10px] text-muted-foreground">
									{result().hooksInstalled} hooks installed
								</div>
								<For each={result().details}>
									{(detail) => (
										<div class="text-[10px] text-muted-foreground">
											&bull; {detail}
										</div>
									)}
								</For>
							</div>
						)}
					</Show>
				</div>
			</div>
		</section>
	);
}

export default AntiDetectTab;
