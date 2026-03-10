use tauri::State;

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
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.spawn_and_attach(&device_id, options)
}

/// Attaches Frida to an already-running process (pid or name).
#[tauri::command]
pub fn attach(
    state: State<'_, AppState>,
    device_id: String,
    options: AttachOptions,
) -> Result<SessionInfo, AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.attach(&device_id, options)
}

/// Detaches from the session and cleans up Frida resources.
#[tauri::command]
pub fn detach(state: State<'_, AppState>, session_id: String) -> Result<(), AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.detach(&session_id)
}

/// Resumes a suspended spawned process.
#[tauri::command]
pub fn resume(state: State<'_, AppState>, session_id: String) -> Result<(), AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.resume(&session_id)
}

/// Returns the list of all currently active sessions.
#[tauri::command]
pub fn list_sessions(state: State<'_, AppState>) -> Result<Vec<SessionInfo>, AppError> {
    let svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    Ok(svc.list_sessions())
}
