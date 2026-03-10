use tauri::State;

use crate::api;
use crate::error::AppError;
use crate::services::frida::{AttachOptions, SpawnOptions};
use crate::services::session_manager::SessionInfo;
use crate::state::AppState;

/// Spawns the application identified by `options.identifier` and attaches Frida.
#[tauri::command]
pub fn spawn_and_attach(
    state: State<'_, AppState>,
    device_id: String,
    options: SpawnOptions,
) -> Result<SessionInfo, AppError> {
    api::spawn_and_attach(&state, device_id, options)
}

/// Attaches Frida to an already-running process (pid or name).
#[tauri::command]
pub fn attach(
    state: State<'_, AppState>,
    device_id: String,
    options: AttachOptions,
) -> Result<SessionInfo, AppError> {
    api::attach(&state, device_id, options)
}

/// Detaches from the session and cleans up Frida resources.
#[tauri::command]
pub fn detach(state: State<'_, AppState>, session_id: String) -> Result<(), AppError> {
    api::detach(&state, session_id)
}

/// Resumes a suspended spawned process.
#[tauri::command]
pub fn resume(state: State<'_, AppState>, session_id: String) -> Result<(), AppError> {
    api::resume(&state, session_id)
}

/// Returns the list of all currently active sessions.
#[tauri::command]
pub fn list_sessions(state: State<'_, AppState>) -> Result<Vec<SessionInfo>, AppError> {
    api::list_sessions(&state)
}
