import { For, Show, createSignal } from "solid-js";
import { cn } from "~/lib/cn";
import type { AiToolCall } from "~/lib/types";

interface AiToolPipelineProps {
	calls: AiToolCall[];
}

export function AiToolPipeline(props: AiToolPipelineProps) {
	const completed = () => props.calls.filter((c) => c.status === "done" || c.status === "error").length;
	const total = () => props.calls.length;
	const progress = () => (total() > 0 ? (completed() / total()) * 100 : 0);

	return (
		<div class="my-2 rounded-lg border border-border/50 bg-surface/50">
			<div class="flex items-center justify-between px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
				<span>Tool Pipeline</span>
				<span>
					{completed()}/{total()} completed
				</span>
			</div>

			{/* Progress bar */}
			<div class="mx-3 mb-2 h-0.5 overflow-hidden rounded-full bg-muted">
				<div
					class="h-full rounded-full bg-primary transition-all duration-300"
					style={{ width: `${progress()}%` }}
				/>
			</div>

			<div class="px-3 pb-2">
				<For each={props.calls}>
					{(call) => <ToolCallRow call={call} />}
				</For>
			</div>
		</div>
	);
}

function ToolCallRow(props: { call: AiToolCall }) {
	const [expanded, setExpanded] = createSignal(false);

	const statusIcon = () => {
		switch (props.call.status) {
			case "done":
				return "✓";
			case "running":
				return "●";
			case "error":
				return "✗";
			default:
				return "○";
		}
	};

	const statusColor = () => {
		switch (props.call.status) {
			case "done":
				return "text-success";
			case "running":
				return "text-primary animate-pulse";
			case "error":
				return "text-destructive";
			default:
				return "text-muted-foreground";
		}
	};

	return (
		<div class="group">
			<div class="flex items-center gap-2 py-0.5 text-xs">
				<span class={cn("w-4 text-center font-mono", statusColor())}>
					{statusIcon()}
				</span>
				<span class="font-mono font-medium">{props.call.method}</span>
				<Show when={props.call.durationMs != null}>
					<span class="text-[10px] text-muted-foreground">
						{props.call.durationMs}ms
					</span>
				</Show>
				<Show when={props.call.status === "running"}>
					<span class="text-[10px] text-muted-foreground">running...</span>
				</Show>
				<Show when={props.call.status === "done" || props.call.status === "error"}>
					<button
						class="ml-auto cursor-pointer text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
						onClick={() => setExpanded((v) => !v)}
					>
						{expanded() ? "hide" : "result"}
					</button>
				</Show>
			</div>

			<Show when={expanded()}>
				<div class="mb-1 ml-6 overflow-auto rounded border bg-background p-2">
					<pre class="max-h-40 whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
						{props.call.status === "error"
							? props.call.error
							: JSON.stringify(props.call.result, null, 2)}
					</pre>
				</div>
			</Show>
		</div>
	);
}
