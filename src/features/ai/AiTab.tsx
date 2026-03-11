import { For, Show, createEffect, createSignal } from "solid-js";
import { cn } from "~/lib/cn";
import { activeSession } from "~/features/session/session.store";
import type { AiProvider } from "~/lib/types";
import { PROVIDERS } from "./ai-providers";
import {
	aiState,
	aiProvider,
	setAiProvider,
	aiInputHistory,
	sendMessage,
	resetAiState,
} from "./ai.store";
import { AiMessageBubble } from "./AiMessage";
import { AiToolPipeline } from "./AiToolPipeline";

function AiTab() {
	const [input, setInput] = createSignal("");
	const [historyIdx, setHistoryIdx] = createSignal(-1);
	let messagesEndRef: HTMLDivElement | undefined;
	let textareaRef: HTMLTextAreaElement | undefined;

	// Auto-scroll on new messages
	createEffect(() => {
		// Track reactive dependencies
		void aiState.messages.length;
		void aiState.loading;
		requestAnimationFrame(() => {
			messagesEndRef?.scrollIntoView({ behavior: "smooth" });
		});
	});

	// Auto-resize textarea
	function resizeTextarea() {
		if (!textareaRef) return;
		textareaRef.style.height = "auto";
		textareaRef.style.height = `${Math.min(textareaRef.scrollHeight, 160)}px`;
	}

	function handleSend() {
		const text = input().trim();
		if (!text || aiState.loading) return;
		setInput("");
		setHistoryIdx(-1);
		if (textareaRef) textareaRef.style.height = "auto";
		void sendMessage(text);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
			return;
		}

		if (e.key === "ArrowUp" && input() === "") {
			const history = aiInputHistory();
			if (history.length === 0) return;
			e.preventDefault();
			const newIdx =
				historyIdx() === -1
					? history.length - 1
					: Math.max(0, historyIdx() - 1);
			setHistoryIdx(newIdx);
			setInput(history[newIdx]);
		}

		if (e.key === "ArrowDown" && historyIdx() >= 0) {
			const history = aiInputHistory();
			e.preventDefault();
			const newIdx = historyIdx() + 1;
			if (newIdx >= history.length) {
				setHistoryIdx(-1);
				setInput("");
			} else {
				setHistoryIdx(newIdx);
				setInput(history[newIdx]);
			}
		}
	}

	const session = () => activeSession();

	return (
		<div class="flex h-full flex-col">
			{/* Header */}
			<div class="flex items-center justify-between border-b px-4 py-2">
				<div class="flex items-center gap-3">
					<span class="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-sm font-bold text-transparent">
						AI Agent
					</span>

					{/* Provider toggle */}
					<div class="flex rounded-lg border bg-background p-0.5">
						<For each={PROVIDERS}>
							{(p) => (
								<button
									class={cn(
										"cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
										aiProvider() === p.id
											? "bg-primary text-primary-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground",
									)}
									onClick={() => setAiProvider(p.id)}
									title={p.description}
								>
									<span
										class={cn(
											"mr-1 inline-block h-1.5 w-1.5 rounded-full",
											aiProvider() === p.id
												? "bg-primary-foreground"
												: "bg-muted-foreground/40",
										)}
									/>
									{p.name}
								</button>
							)}
						</For>
					</div>
				</div>

				<div class="flex items-center gap-2">
					{/* Session context badge */}
					<Show when={session()}>
						{(s) => (
							<div class="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1">
								<span class="h-1.5 w-1.5 rounded-full bg-success" />
								<span class="max-w-[200px] truncate font-mono text-[10px] text-muted-foreground">
									{s().processName}
								</span>
								<span class="text-[10px] text-muted-foreground/60">
									PID {s().pid}
								</span>
								<Show when={s().arch}>
									<span class="text-[10px] text-muted-foreground/60">
										{s().arch}
									</span>
								</Show>
							</div>
						)}
					</Show>

					<button
						class="cursor-pointer rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
						onClick={resetAiState}
						title="New conversation"
					>
						New
					</button>
				</div>
			</div>

			{/* Messages */}
			<div class="flex-1 overflow-auto">
				<Show
					when={aiState.messages.length > 0}
					fallback={<EmptyState provider={aiProvider()} />}
				>
					<div class="py-4">
						<For each={aiState.messages}>
							{(msg) => <AiMessageBubble message={msg} />}
						</For>

						{/* Live tool pipeline while loading */}
						<Show
							when={
								aiState.loading &&
								aiState.currentToolCalls.length > 0
							}
						>
							<div class="px-4 py-2">
								<div class="flex gap-3">
									<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
										AI
									</div>
									<div class="max-w-[85%] rounded-xl bg-muted/50 px-4 py-2.5">
										<AiToolPipeline
											calls={aiState.currentToolCalls}
										/>
									</div>
								</div>
							</div>
						</Show>

						{/* Thinking indicator */}
						<Show
							when={
								aiState.loading &&
								aiState.currentToolCalls.length === 0
							}
						>
							<div class="flex gap-3 px-4 py-3">
								<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
									AI
								</div>
								<div class="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-2.5">
									<div class="flex gap-1">
										<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
										<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
										<span class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
									</div>
									<span class="text-xs text-muted-foreground">
										Thinking...
									</span>
								</div>
							</div>
						</Show>

						<div ref={messagesEndRef} />
					</div>
				</Show>
			</div>

			{/* Input */}
			<div class="border-t bg-surface/50 px-4 py-3">
				<div class="flex items-end gap-2">
					<div class="relative flex-1">
						<textarea
							ref={textareaRef}
							class="w-full resize-none rounded-xl border bg-background px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
							placeholder="Ask the AI agent to analyze, hook, scan, or explore..."
							value={input()}
							rows={1}
							onInput={(e) => {
								setInput(e.currentTarget.value);
								resizeTextarea();
							}}
							onKeyDown={handleKeyDown}
							disabled={aiState.loading}
						/>
					</div>
					<button
						class={cn(
							"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
							input().trim() && !aiState.loading
								? "cursor-pointer bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
								: "cursor-default bg-muted text-muted-foreground",
						)}
						onClick={handleSend}
						disabled={!input().trim() || aiState.loading}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="h-4 w-4"
						>
							<path d="m5 12 7-7 7 7" />
							<path d="M12 19V5" />
						</svg>
					</button>
				</div>
				<div class="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground/60">
					<span>
						<kbd class="rounded border px-1">Enter</kbd> send
					</span>
					<span>
						<kbd class="rounded border px-1">Shift+Enter</kbd>{" "}
						newline
					</span>
					<span>
						<kbd class="rounded border px-1">↑</kbd> history
					</span>
				</div>
			</div>
		</div>
	);
}

function EmptyState(props: { provider: AiProvider }) {
	const providerLabel = () =>
		props.provider === "claude" ? "Claude Code" : "Codex CLI";

	return (
		<div class="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
			<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
				<span class="text-2xl font-bold text-primary">AI</span>
			</div>
			<div>
				<h3 class="text-sm font-semibold">CARF AI Agent</h3>
				<p class="mt-1 text-xs text-muted-foreground">
					Powered by {providerLabel()} — 127 instrumentation tools
				</p>
			</div>
			<div class="grid max-w-md gap-2 text-left">
				<SuggestionCard text="Enumerate all loaded modules and find security-related libraries" />
				<SuggestionCard text="Bypass SSL pinning and start network capture" />
				<SuggestionCard text="Find and hook all Java crypto methods" />
				<SuggestionCard text="Scan memory for hardcoded API keys or tokens" />
			</div>
		</div>
	);
}

function SuggestionCard(props: { text: string }) {
	return (
		<button
			class="cursor-pointer rounded-lg border bg-background/50 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-surface-hover hover:text-foreground"
			onClick={() => void sendMessage(props.text)}
		>
			{props.text}
		</button>
	);
}

export default AiTab;
