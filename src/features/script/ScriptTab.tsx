import { For, Show } from "solid-js";
import { activeSession } from "~/features/session/session.store";
import { cn } from "~/lib/cn";
import { pickTextFile } from "~/lib/file-picker";
import {
	editorDirty,
	loadScript,
	loadTemplate,
	reloadScript,
	scriptState,
	setCode,
	setScriptPath,
	unloadScript,
} from "./script.store";

async function handleOpenFile() {
	try {
		const selected = await pickTextFile(
			".js,.ts,text/javascript,text/typescript",
		);
		if (selected) {
			setCode(selected.content);
			setScriptPath(selected.path);
		}
	} catch (e) {
		console.error("handleOpenFile failed:", e);
	}
}

function ScriptTab() {
	async function handleLoadOrHotReload() {
		const session = activeSession();
		if (!session) return;
		if (scriptState.loaded) {
			await reloadScript(session.id);
		} else {
			await loadScript(session.id, scriptState.code);
		}
	}

	async function handleUnload() {
		const session = activeSession();
		if (!session) return;
		await unloadScript(session.id);
	}

	return (
		<div class="flex h-full flex-col">
			{/* Header */}
			<div class="flex items-center justify-between border-b px-4 py-2">
				<div class="flex items-center gap-2">
					<span class="text-sm font-semibold">Script</span>
					<Show when={scriptState.loaded}>
						<span class="rounded bg-success/10 px-1.5 py-0.5 text-xs text-success">
							Loaded
						</span>
					</Show>
					<Show when={editorDirty()}>
						<span class="rounded bg-warning/10 px-1.5 py-0.5 text-xs text-warning">
							Modified
						</span>
					</Show>
				</div>
				<div class="flex items-center gap-1">
					<button
						type="button"
						class="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
						onClick={handleOpenFile}
					>
						Open...
					</button>
					<button
						type="button"
						class={cn(
							"rounded px-2 py-0.5 text-xs",
							scriptState.loaded
								? "bg-warning/10 text-warning hover:bg-warning/20"
								: "bg-primary text-primary-foreground hover:bg-primary/90",
						)}
						onClick={handleLoadOrHotReload}
						disabled={scriptState.loading}
					>
						{scriptState.loaded ? "Hot Reload" : "Load"}
					</button>
					<Show when={scriptState.loaded}>
						<button
							type="button"
							class="rounded px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10"
							onClick={handleUnload}
						>
							Unload
						</button>
					</Show>
				</div>
			</div>

			{/* Content: Editor + Templates sidebar */}
			<div class="flex flex-1 overflow-hidden">
				{/* Editor */}
				<div class="flex-1 overflow-hidden">
					<Show when={scriptState.error}>
						<div class="border-b bg-destructive/5 px-4 py-2 text-xs text-destructive">
							{scriptState.error}
						</div>
					</Show>
					<textarea
						class="h-full w-full resize-none bg-background p-4 font-mono text-xs text-foreground outline-none"
						placeholder="// Write Frida script here or select a template..."
						value={scriptState.code}
						onInput={(e) => setCode(e.currentTarget.value)}
						spellcheck={false}
					/>
				</div>

				{/* Templates sidebar */}
				<div class="w-56 overflow-auto border-l">
					<div class="p-2">
						<h4 class="mb-2 px-1 text-xs font-medium text-muted-foreground">
							Templates
						</h4>
						<For each={scriptState.templates}>
							{(template, idx) => (
								<button
									type="button"
									class="mb-1 w-full rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover"
									onClick={() => loadTemplate(idx())}
								>
									<div class="font-medium">{template.name}</div>
									<div class="text-[10px] text-muted-foreground">
										{template.description}
									</div>
								</button>
							)}
						</For>
					</div>
				</div>
			</div>
		</div>
	);
}

export default ScriptTab;
