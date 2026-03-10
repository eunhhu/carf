import { For, Show } from "solid-js";
import { cn } from "~/lib/cn";
import { invoke } from "~/lib/tauri";
import { removeSession, sessionState, switchSession } from "./session.store";

async function closeSession(sessionId: string): Promise<void> {
	try {
		await invoke<void>("detach", { sessionId });
	} catch {
		// The backend session may already be gone; remove the local tab either way.
	}

	removeSession(sessionId);
}

export function SessionTabBar() {
	return (
		<div class="flex h-9 items-center border-b bg-surface px-2">
			<For each={sessionState.sessions}>
				{(session) => {
					const isActive = () => session.id === sessionState.activeSessionId;

					return (
						<div
							class={cn(
								"group flex h-7 items-center gap-2 rounded-md px-3 text-xs transition-colors",
								isActive()
									? "bg-background text-foreground"
									: "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
							)}
						>
							<button
								type="button"
								class="flex min-w-0 flex-1 items-center gap-2 text-left"
								onClick={() => switchSession(session.id)}
							>
								{/* Status dot */}
								<span
									class={cn(
										"h-1.5 w-1.5 rounded-full",
										session.status === "active" && "bg-success",
										session.status === "paused" && "bg-warning",
										session.status === "detached" && "bg-destructive",
										session.status === "crashed" && "bg-destructive",
									)}
								/>

								{/* Label */}
								<span class="max-w-[160px] truncate font-mono">
									{session.processName}
								</span>
								<span class="text-muted-foreground">({session.pid})</span>
							</button>

							<button
								type="button"
								class="ml-1 hidden h-4 w-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground group-hover:inline-flex"
								onClick={async (e) => {
									e.stopPropagation();
									await closeSession(session.id);
								}}
							>
								&times;
							</button>
						</div>
					);
				}}
			</For>

			<Show when={sessionState.sessions.length === 0}>
				<span class="px-3 text-xs text-muted-foreground">
					No active sessions
				</span>
			</Show>
		</div>
	);
}
