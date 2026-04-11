import { For, Show } from "solid-js";
import { cn } from "~/lib/cn";
import { navigateTo } from "~/lib/navigation";
import type { AiMessage as AiMessageType } from "~/lib/types";
import { AiToolPipeline } from "./AiToolPipeline";

interface AiMessageProps {
	message: AiMessageType;
}

export function AiMessageBubble(props: AiMessageProps) {
	const msg = () => props.message;

	return (
		<Show when={msg().role !== "tool-result"}>
		<div
			class={cn(
				"flex w-full gap-3 px-4 py-3",
				msg().role === "user" ? "justify-end" : "justify-start",
			)}
		>
			<Show when={msg().role !== "user"}>
				<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
					AI
				</div>
			</Show>

			<div
				class={cn(
					"max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed",
					msg().role === "user"
						? "bg-primary text-primary-foreground"
						: "bg-muted/50",
				)}
			>
				{/* Message content */}
				<Show when={msg().content}>
					<div class="whitespace-pre-wrap">{msg().content}</div>
				</Show>

				{/* Tool pipeline */}
				<Show when={msg().toolCalls && msg().toolCalls!.length > 0}>
					<AiToolPipeline calls={msg().toolCalls!} />
				</Show>

				{/* Quick actions */}
				<Show
					when={msg().quickActions && msg().quickActions!.length > 0}
				>
					<div class="mt-3 flex flex-wrap gap-2 border-t border-border/30 pt-2">
						<For each={msg().quickActions}>
							{(action) => (
								<button
									class="cursor-pointer rounded-md border border-border/50 bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
									onClick={() => {
										if (action.tab) {
											navigateTo({
												tab: action.tab,
												context: action.context,
											});
										}
									}}
								>
									{action.label}
								</button>
							)}
						</For>
					</div>
				</Show>
			</div>

			<Show when={msg().role === "user"}>
				<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground/10 text-xs font-bold text-foreground">
					You
				</div>
			</Show>
		</div>
		</Show>
	);
}
