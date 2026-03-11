import { invoke } from "~/lib/tauri";
import type { AiChatRequest, AiChatResponse, AiProvider } from "~/lib/types";

export interface ProviderInfo {
	id: AiProvider;
	name: string;
	description: string;
}

export const PROVIDERS: ProviderInfo[] = [
	{
		id: "claude",
		name: "Claude",
		description: "Claude Code (Anthropic)",
	},
	{
		id: "codex",
		name: "Codex",
		description: "Codex CLI (OpenAI)",
	},
];

/** Send a chat request to the selected AI provider via Tauri backend. */
export async function sendAiChat(
	provider: AiProvider,
	systemPrompt: string,
	userMessage: string,
	model?: string,
): Promise<AiChatResponse> {
	return invoke<AiChatResponse>("ai_chat", {
		request: {
			provider,
			systemPrompt,
			userMessage,
			model,
		} satisfies AiChatRequest,
	});
}
