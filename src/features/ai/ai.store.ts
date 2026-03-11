import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { activeSession } from "~/features/session/session.store";
import { generateId } from "~/lib/format";
import { invoke } from "~/lib/tauri";
import type {
	AiMessage,
	AiProvider,
	AiQuickAction,
	AiToolCall,
} from "~/lib/types";
import { sendAiChat } from "./ai-providers";
import { buildSystemPrompt } from "./ai-prompt";

const MAX_TOOL_LOOPS = 10;

interface AiState {
	messages: AiMessage[];
	loading: boolean;
	currentToolCalls: AiToolCall[];
}

const DEFAULT_STATE: AiState = {
	messages: [],
	loading: false,
	currentToolCalls: [],
};

const [state, setState] = createStore<AiState>({ ...DEFAULT_STATE });
const [provider, setProvider] = createSignal<AiProvider>("claude");
const [inputHistory, setInputHistory] = createSignal<string[]>([]);

let currentGeneration = 0;

function resetAiState(): void {
	currentGeneration++;
	setState({ ...DEFAULT_STATE });
	setInputHistory([]);
}

/** Parse action blocks from AI response. */
function parseToolCalls(content: string): AiToolCall[] {
	const calls: AiToolCall[] = [];
	const pattern = /```action\s*\n([\s\S]*?)```/g;
	let match: RegExpExecArray | null = pattern.exec(content);
	while (match !== null) {
		try {
			const parsed = JSON.parse(match[1].trim()) as {
				method: string;
				params?: Record<string, unknown>;
			};
			calls.push({
				id: generateId(),
				method: parsed.method,
				params: parsed.params ?? {},
				status: "pending",
			});
		} catch {
			// Skip malformed action blocks
		}
		match = pattern.exec(content);
	}
	return calls;
}

/** Parse quickaction blocks from AI response. */
function parseQuickActions(content: string): AiQuickAction[] {
	const actions: AiQuickAction[] = [];
	const pattern = /```quickaction\s*\n([\s\S]*?)```/g;
	let match: RegExpExecArray | null = pattern.exec(content);
	while (match !== null) {
		try {
			const parsed = JSON.parse(match[1].trim()) as AiQuickAction;
			actions.push(parsed);
		} catch {
			// Skip malformed
		}
		match = pattern.exec(content);
	}
	return actions;
}

/** Strip action/quickaction code blocks from display content. */
function cleanDisplayContent(content: string): string {
	return content
		.replace(/```action\s*\n[\s\S]*?```/g, "")
		.replace(/```quickaction\s*\n[\s\S]*?```/g, "")
		.trim();
}

/** Run a single RPC tool call via Tauri IPC. */
async function runToolCall(
	sessionId: string,
	call: AiToolCall,
): Promise<{ result?: unknown; error?: string; durationMs: number }> {
	const start = Date.now();
	try {
		const result = await invoke<unknown>("rpc_call", {
			sessionId,
			method: call.method,
			params: call.params,
		});
		return { result, durationMs: Date.now() - start };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { error: message, durationMs: Date.now() - start };
	}
}

/** Build context string from tool results for the next AI turn. */
function buildToolResultsContext(calls: AiToolCall[]): string {
	const results = calls.map((c) => {
		const label = c.status === "error" ? "ERROR" : "OK";
		const data =
			c.status === "error"
				? c.error
				: JSON.stringify(c.result, null, 2);
		return `[${c.method}] ${label}:\n${data}`;
	});
	return `Tool results:\n\n${results.join("\n\n")}`;
}

/** Main send handler — AI chat with multi-turn tool-use loop. */
async function sendMessage(userInput: string): Promise<void> {
	const session = activeSession();
	if (!session) return;

	const gen = ++currentGeneration;

	// Build conversation context from messages BEFORE adding the new user message
	const recentMessages = state.messages.slice(-20);
	const conversationContext = recentMessages
		.map((m) => {
			if (m.role === "user") return `User: ${m.content}`;
			if (m.role === "assistant") return `Assistant: ${m.content}`;
			if (m.role === "tool-result") return `Tool Results:\n${m.content}`;
			return "";
		})
		.filter(Boolean)
		.join("\n\n");

	// Now add the user message to the store
	const userMsg: AiMessage = {
		id: generateId(),
		role: "user",
		content: userInput,
		timestamp: Date.now(),
	};
	setState("messages", (prev) => [...prev, userMsg]);
	setInputHistory((prev) => [...prev.slice(-(50 - 1)), userInput]);
	setState("loading", true);
	setState("currentToolCalls", []);

	const systemPrompt = buildSystemPrompt(session);

	let loopCount = 0;
	let currentInput = conversationContext
		? `${conversationContext}\n\nUser: ${userInput}`
		: userInput;

	try {
		while (loopCount < MAX_TOOL_LOOPS) {
			loopCount++;

			const response = await sendAiChat(
				provider(),
				systemPrompt,
				currentInput,
			);

			if (gen !== currentGeneration) return;

			const toolCalls = parseToolCalls(response.content);
			const quickActions = parseQuickActions(response.content);
			const displayContent = cleanDisplayContent(response.content);

			if (toolCalls.length === 0) {
				// Final response — no tools to call
				const msg: AiMessage = {
					id: generateId(),
					role: "assistant",
					content: displayContent,
					timestamp: Date.now(),
					quickActions:
						quickActions.length > 0 ? quickActions : undefined,
				};
				setState("messages", (prev) => [...prev, msg]);
				setState("currentToolCalls", []);
				break;
			}

			// Assistant message with pending tool calls
			const toolMsg: AiMessage = {
				id: generateId(),
				role: "tool-call",
				content: displayContent,
				timestamp: Date.now(),
				toolCalls: [...toolCalls],
			};
			setState("messages", (prev) => [...prev, toolMsg]);
			setState("currentToolCalls", [...toolCalls]);

			// Execute each tool call sequentially
			const executed: AiToolCall[] = [];
			for (let i = 0; i < toolCalls.length; i++) {
				const call = toolCalls[i];
				setState("currentToolCalls", i, "status", "running");

				const outcome = await runToolCall(session.id, call);

				if (gen !== currentGeneration) return;

				const done: AiToolCall = {
					...call,
					status: outcome.error ? "error" : "done",
					result: outcome.result,
					error: outcome.error,
					durationMs: outcome.durationMs,
				};
				executed.push(done);
				setState("currentToolCalls", (prev) =>
					prev.map((c, idx) => (idx === i ? { ...done } : c)),
				);
			}

			// Update the tool-call message with completed results
			setState("messages", (prev) => {
				const updated = [...prev];
				let lastToolIdx = -1;
				for (let j = updated.length - 1; j >= 0; j--) {
					if (updated[j].role === "tool-call") {
						lastToolIdx = j;
						break;
					}
				}
				if (lastToolIdx >= 0) {
					updated[lastToolIdx] = {
						...updated[lastToolIdx],
						toolCalls: executed,
					};
				}
				return updated;
			});

			// Hidden tool-result message for conversation context
			const resultMsg: AiMessage = {
				id: generateId(),
				role: "tool-result",
				content: buildToolResultsContext(executed),
				timestamp: Date.now(),
			};
			setState("messages", (prev) => [...prev, resultMsg]);

			// Feed results back to AI
			currentInput = buildToolResultsContext(executed);
		}
	} catch (err) {
		if (gen !== currentGeneration) return;
		const errorContent =
			err instanceof Error ? err.message : String(err);
		const errorMsg: AiMessage = {
			id: generateId(),
			role: "assistant",
			content: `Error: ${errorContent}`,
			timestamp: Date.now(),
		};
		setState("messages", (prev) => [...prev, errorMsg]);
	} finally {
		if (gen !== currentGeneration) return;
		setState("loading", false);
		setState("currentToolCalls", []);
	}
}

export {
	state as aiState,
	provider as aiProvider,
	setProvider as setAiProvider,
	inputHistory as aiInputHistory,
	sendMessage,
	resetAiState,
};
