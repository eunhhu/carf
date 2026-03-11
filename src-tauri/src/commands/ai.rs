use crate::error::AppError;
use crate::services::ai::{self, AiChatRequest, AiChatResponse};

/// Sends a chat message to a local AI provider (Claude Code CLI or Codex CLI).
///
/// The CLI is spawned as a subprocess — no API keys are managed by CARF.
/// This command is async because the underlying CLI call can take 10-60+ seconds.
/// Using `spawn_blocking` ensures it does not block the Tauri IPC thread pool.
#[tauri::command]
pub async fn ai_chat(
    _state: tauri::State<'_, crate::state::AppState>,
    request: AiChatRequest,
) -> Result<AiChatResponse, AppError> {
    tokio::task::spawn_blocking(move || ai::chat(&request))
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?
}
