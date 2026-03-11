use tauri::State;

use crate::api;
use crate::error::AppError;
use crate::services::frida::DeviceInfo;
use crate::state::AppState;

/// Lists all Frida-visible devices (local, USB, remote).
#[tauri::command]
pub fn list_devices(state: State<'_, AppState>) -> Result<Vec<DeviceInfo>, AppError> {
    api::list_devices(&state)
}

/// Connects to a remote Frida device at the given TCP address (host:port).
#[tauri::command]
pub fn add_remote_device(
    state: State<'_, AppState>,
    address: String,
) -> Result<DeviceInfo, AppError> {
    api::add_remote_device(&state, address)
}

/// Removes a previously added remote device.
#[tauri::command]
pub fn remove_remote_device(
    state: State<'_, AppState>,
    address: String,
) -> Result<(), AppError> {
    api::remove_remote_device(&state, address)
}

/// Returns detailed info for a single device by its Frida device id.
#[tauri::command]
pub fn get_device_info(
    state: State<'_, AppState>,
    device_id: String,
) -> Result<DeviceInfo, AppError> {
    api::get_device_info(&state, device_id)
}
