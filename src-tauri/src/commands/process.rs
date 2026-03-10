use tauri::State;

use crate::error::AppError;
use crate::services::frida::{AppInfo, ProcessInfo};
use crate::state::AppState;

/// Lists all running processes on the given device.
#[tauri::command]
pub fn list_processes(
    state: State<'_, AppState>,
    device_id: String,
) -> Result<Vec<ProcessInfo>, AppError> {
    let svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.list_processes(&device_id)
}

/// Lists all installed applications on the given device.
#[tauri::command]
pub fn list_applications(
    state: State<'_, AppState>,
    device_id: String,
) -> Result<Vec<AppInfo>, AppError> {
    let svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.list_applications(&device_id)
}

/// Kills the process with the given PID on the given device.
#[tauri::command]
pub fn kill_process(
    state: State<'_, AppState>,
    device_id: String,
    pid: u32,
) -> Result<(), AppError> {
    let svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.kill_process(&device_id, pid)
}
