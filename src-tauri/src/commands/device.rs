use tauri::State;

use crate::error::AppError;
use crate::services::frida::DeviceInfo;
use crate::state::AppState;

/// Lists all Frida-visible devices (local, USB, remote).
#[tauri::command]
pub fn list_devices(state: State<'_, AppState>) -> Result<Vec<DeviceInfo>, AppError> {
    let svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.list_devices()
}

/// Connects to a remote Frida device at the given TCP address (host:port).
#[tauri::command]
pub fn add_remote_device(
    state: State<'_, AppState>,
    address: String,
) -> Result<DeviceInfo, AppError> {
    let svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.add_remote_device(&address)
}

/// Removes a previously added remote device.
#[tauri::command]
pub fn remove_remote_device(
    state: State<'_, AppState>,
    address: String,
) -> Result<(), AppError> {
    let svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.remove_remote_device(&address)
}

/// Returns detailed info for a single device by its Frida device id.
#[tauri::command]
pub fn get_device_info(
    state: State<'_, AppState>,
    device_id: String,
) -> Result<DeviceInfo, AppError> {
    let svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.get_device_info(&device_id)
}
