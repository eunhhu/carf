use tauri::State;

use crate::error::AppError;
use crate::services::adb::{AdbDevice, DeviceProps};
use crate::state::AppState;

/// Lists all devices visible to the local `adb` daemon.
#[tauri::command]
pub fn adb_devices(state: State<'_, AppState>) -> Result<Vec<AdbDevice>, AppError> {
    let svc = state
        .adb_service
        .lock()
        .map_err(|_| AppError::Internal("adb_service lock poisoned".to_string()))?;
    svc.list_devices()
}

/// Reads system properties from the device identified by `serial`.
#[tauri::command]
pub fn adb_device_props(
    state: State<'_, AppState>,
    serial: String,
) -> Result<DeviceProps, AppError> {
    let svc = state
        .adb_service
        .lock()
        .map_err(|_| AppError::Internal("adb_service lock poisoned".to_string()))?;
    svc.device_props(&serial)
}

/// Pushes a frida-server binary for the given `version`/`arch` to the device.
#[tauri::command]
pub fn adb_push_frida_server(
    state: State<'_, AppState>,
    serial: String,
    version: String,
    arch: String,
) -> Result<(), AppError> {
    let svc = state
        .adb_service
        .lock()
        .map_err(|_| AppError::Internal("adb_service lock poisoned".to_string()))?;
    svc.push_frida_server(&serial, &version, &arch)
}

/// Starts frida-server in the background on the device.
#[tauri::command]
pub fn adb_start_frida_server(
    state: State<'_, AppState>,
    serial: String,
) -> Result<(), AppError> {
    let svc = state
        .adb_service
        .lock()
        .map_err(|_| AppError::Internal("adb_service lock poisoned".to_string()))?;
    svc.start_frida_server(&serial)
}

/// Stops frida-server on the device.
#[tauri::command]
pub fn adb_stop_frida_server(
    state: State<'_, AppState>,
    serial: String,
) -> Result<(), AppError> {
    let svc = state
        .adb_service
        .lock()
        .map_err(|_| AppError::Internal("adb_service lock poisoned".to_string()))?;
    svc.stop_frida_server(&serial)
}

/// Returns whether frida-server is currently running on the device.
#[tauri::command]
pub fn adb_is_frida_running(
    state: State<'_, AppState>,
    serial: String,
) -> Result<bool, AppError> {
    let svc = state
        .adb_service
        .lock()
        .map_err(|_| AppError::Internal("adb_service lock poisoned".to_string()))?;
    svc.is_frida_running(&serial)
}

/// Executes a shell command on the device and returns the output.
///
/// The command is split into a program name and separate arguments to
/// prevent shell injection attacks.
#[tauri::command]
pub fn adb_shell(
    state: State<'_, AppState>,
    serial: String,
    command: String,
    args: Vec<String>,
) -> Result<String, AppError> {
    let svc = state
        .adb_service
        .lock()
        .map_err(|_| AppError::Internal("adb_service lock poisoned".to_string()))?;
    svc.shell(&serial, &command, &args)
}

/// Installs an APK file on the device.
#[tauri::command]
pub fn adb_install_apk(
    state: State<'_, AppState>,
    serial: String,
    path: String,
) -> Result<(), AppError> {
    let svc = state
        .adb_service
        .lock()
        .map_err(|_| AppError::Internal("adb_service lock poisoned".to_string()))?;
    svc.install_apk(&serial, &path)
}

/// Pairs with a device over Wi-Fi using a pairing code (Android 11+).
#[tauri::command]
pub fn adb_pair(
    state: State<'_, AppState>,
    address: String,
    code: String,
) -> Result<(), AppError> {
    let svc = state
        .adb_service
        .lock()
        .map_err(|_| AppError::Internal("adb_service lock poisoned".to_string()))?;
    svc.pair(&address, &code)
}

/// Connects to a remote device over TCP/IP.
#[tauri::command]
pub fn adb_connect(
    state: State<'_, AppState>,
    address: String,
) -> Result<(), AppError> {
    let svc = state
        .adb_service
        .lock()
        .map_err(|_| AppError::Internal("adb_service lock poisoned".to_string()))?;
    svc.connect(&address)
}
