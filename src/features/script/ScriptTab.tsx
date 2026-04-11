import { For, Show, createMemo } from "solid-js";
import { activeSession } from "~/features/session/session.store";
import { cn } from "~/lib/cn";
import { pickTextFile } from "~/lib/file-picker";
import { toastError } from "~/features/toast/toast.store";
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
		toastError("Failed to open script file", e);
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
				{/* Editor with line numbers */}
				<div class="flex flex-1 flex-col overflow-hidden">
					<Show when={scriptState.error}>
						<div class="border-b bg-destructive/5 px-4 py-2 text-xs text-destructive">
							{scriptState.error}
						</div>
					</Show>
					<ScriptEditor />
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

function highlightCode(code: string): string {
	if (!code) return "";
	return code
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		// comments (single-line)
		.replace(/(\/\/.*)/g, '<span class="text-muted-foreground italic">$1</span>')
		// strings (double-quoted and single-quoted)
		.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="text-success">$1</span>')
		.replace(/('(?:[^'\\]|\\.)*')/g, '<span class="text-success">$1</span>')
		// template literals
		.replace(/(`(?:[^`\\]|\\.)*`)/g, '<span class="text-success">$1</span>')
		// numbers
		.replace(/\b(0x[\da-fA-F]+|\d+(?:\.\d+)?)\b/g, '<span class="text-warning">$1</span>')
		// keywords
		.replace(
			/\b(const|let|var|function|return|if|else|for|while|try|catch|finally|throw|new|import|export|from|class|extends|async|await|void|typeof|instanceof|in|of|break|continue|switch|case|default)\b/g,
			'<span class="text-purple-400 font-medium">$1</span>',
		)
		// built-in objects/types
		.replace(
			/\b(console|Java|ObjC|Interceptor|Module|Process|Thread|Memory|NativeFunction|NativeCallback|Stalker|Frida|ptr|NULL|rpc|send|recv|true|false|null|undefined)\b/g,
			'<span class="text-primary">$1</span>',
		);
}

function ScriptEditor() {
	let textareaRef: HTMLTextAreaElement | undefined;
	let lineNumbersRef: HTMLDivElement | undefined;
	let highlightRef: HTMLPreElement | undefined;

	const lineCount = createMemo(() => {
		const code = scriptState.code;
		if (!code) return 1;
		return code.split("\n").length;
	});

	const highlighted = createMemo(() => highlightCode(scriptState.code));

	function handleScroll() {
		if (textareaRef && lineNumbersRef) {
			lineNumbersRef.scrollTop = textareaRef.scrollTop;
		}
		if (textareaRef && highlightRef) {
			highlightRef.scrollTop = textareaRef.scrollTop;
			highlightRef.scrollLeft = textareaRef.scrollLeft;
		}
	}

	return (
		<div class="flex flex-1 overflow-hidden">
			{/* Line numbers */}
			<div
				ref={lineNumbersRef}
				class="shrink-0 overflow-hidden border-r bg-surface py-2 text-right font-mono text-xs leading-[18px] text-muted-foreground select-none"
			>
				<For each={Array.from({ length: lineCount() }, (_, i) => i + 1)}>
					{(num) => (
						<div class="px-2">{num}</div>
					)}
				</For>
			</div>
			{/* Editor container with overlay */}
			<div class="relative flex-1 overflow-hidden">
				{/* Highlighted code layer (behind) */}
				<pre
					ref={highlightRef}
					class="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words py-2 pl-3 pr-4 font-mono text-xs leading-[18px]"
					aria-hidden="true"
					innerHTML={highlighted() || '<span class="text-muted-foreground">// Write Frida script here or select a template...</span>'}
				/>
				{/* Transparent textarea (front) */}
				<textarea
					ref={textareaRef}
					class="relative flex-1 w-full h-full resize-none bg-transparent py-2 pl-3 pr-4 font-mono text-xs leading-[18px] text-transparent caret-foreground outline-none"
					value={scriptState.code}
					onInput={(e) => setCode(e.currentTarget.value)}
					onScroll={handleScroll}
					spellcheck={false}
					style={{ "tab-size": "2" }}
				/>
			</div>
		</div>
	);
}

export default ScriptTab;
