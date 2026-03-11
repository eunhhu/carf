use tauri::State;

use crate::api;
use crate::error::AppError;
use crate::services::frida::{AppInfo, CollectionPage, ProcessInfo};
use crate::state::AppState;

/// Lists all running processes on the given device.
#[tauri::command]
pub fn list_processes(
    state: State<'_, AppState>,
    device_id: String,
    query: Option<String>,
    limit: Option<usize>,
    force_refresh: Option<bool>,
) -> Result<CollectionPage<ProcessInfo>, AppError> {
    api::list_processes(&state, device_id, query, limit, force_refresh)
}

/// Lists all installed applications on the given device.
#[tauri::command]
pub fn list_applications(
    state: State<'_, AppState>,
    device_id: String,
    query: Option<String>,
    limit: Option<usize>,
    force_refresh: Option<bool>,
) -> Result<CollectionPage<AppInfo>, AppError> {
    api::list_applications(&state, device_id, query, limit, force_refresh)
}

/// Kills the process with the given PID on the given device.
#[tauri::command]
pub fn kill_process(
    state: State<'_, AppState>,
    device_id: String,
    pid: u32,
) -> Result<(), AppError> {
    api::kill_process(&state, device_id, pid)
}
