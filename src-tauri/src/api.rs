use serde_json::Value;

use crate::error::AppError;
use crate::services::frida::{
    AppInfo, AttachOptions, DeviceInfo, OsPlatform, ProcessInfo, SpawnOptions,
};
use crate::services::session_manager::SessionInfo;
use crate::state::AppState;

pub fn list_devices(state: &AppState) -> Result<Vec<DeviceInfo>, AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.list_devices()
}

pub fn add_remote_device(state: &AppState, address: String) -> Result<DeviceInfo, AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    let device = svc.add_remote_device(&address)?;
    state.events.emit(
        "carf://device/added",
        serde_json::to_value(&device).map_err(|error| AppError::Internal(error.to_string()))?,
    );
    Ok(device)
}

pub fn remove_remote_device(state: &AppState, address: String) -> Result<(), AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.remove_remote_device(&address)?;
    state.events.emit(
        "carf://device/removed",
        serde_json::json!(format!("remote-{address}")),
    );
    Ok(())
}

pub fn get_device_info(state: &AppState, device_id: String) -> Result<DeviceInfo, AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.get_device_info(&device_id)
}

pub fn list_processes(
    state: &AppState,
    device_id: String,
) -> Result<Vec<crate::services::frida::ProcessInfo>, AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.list_processes(&device_id)
}

pub fn list_applications(
    state: &AppState,
    device_id: String,
) -> Result<Vec<crate::services::frida::AppInfo>, AppError> {
    let (device, processes, frida_apps) = {
        let mut svc = state
            .frida_service
            .lock()
            .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
        let frida_apps = match svc.list_applications(&device_id) {
            Ok(apps) => apps,
            Err(AppError::Internal(_)) => Vec::new(),
            Err(error) => return Err(error),
        };
        (
            svc.get_device_info(&device_id)?,
            svc.list_processes(&device_id)?,
            frida_apps,
        )
    };

    if matches!(device.os.as_ref().map(|os| &os.platform), Some(OsPlatform::Android)) {
        let adb_apps = state
            .adb_service
            .lock()
            .map_err(|_| AppError::Internal("adb_service lock poisoned".to_string()))?
            .list_applications(&device_id, &processes);

        match adb_apps {
            Ok(apps) => return Ok(merge_app_lists(&frida_apps, &apps)),
            Err(AppError::AdbNotFound)
            | Err(AppError::AdbDeviceNotFound(_))
            | Err(AppError::AdbError(_)) => {}
            Err(error) => return Err(error),
        }
    }

    if frida_apps.is_empty() {
        Ok(processes_to_apps(&processes))
    } else {
        Ok(frida_apps)
    }
}

fn processes_to_apps(processes: &[ProcessInfo]) -> Vec<AppInfo> {
    processes
        .iter()
        .map(|process| AppInfo {
            identifier: process
                .identifier
                .clone()
                .unwrap_or_else(|| process.name.clone()),
            name: process.name.clone(),
            pid: Some(process.pid),
            icon: process.icon.clone(),
        })
        .collect()
}

fn merge_app_lists(primary: &[AppInfo], fallback: &[AppInfo]) -> Vec<AppInfo> {
    use std::collections::HashMap;

    let mut merged = HashMap::<String, AppInfo>::new();

    for app in fallback {
        merged.insert(app.identifier.clone(), app.clone());
    }

    for app in primary {
        merged
            .entry(app.identifier.clone())
            .and_modify(|existing| {
                if existing.name == existing.identifier && app.name != app.identifier {
                    existing.name = app.name.clone();
                }
                if existing.pid.is_none() {
                    existing.pid = app.pid;
                }
                if existing.icon.is_none() {
                    existing.icon = app.icon.clone();
                }
            })
            .or_insert_with(|| app.clone());
    }

    let mut apps = merged.into_values().collect::<Vec<_>>();
    apps.sort_by(|left, right| {
        left.name
            .cmp(&right.name)
            .then(left.identifier.cmp(&right.identifier))
    });
    apps
}

pub fn kill_process(state: &AppState, device_id: String, pid: u32) -> Result<(), AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.kill_process(&device_id, pid)
}

pub fn spawn_and_attach(
    state: &AppState,
    device_id: String,
    options: SpawnOptions,
) -> Result<SessionInfo, AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    let session = svc.spawn_and_attach(&device_id, options)?;
    emit_console_message(
        state,
        "info",
        "system",
        format!("Attached to {}", session.process_name),
        None,
    );
    Ok(session)
}

pub fn attach(
    state: &AppState,
    device_id: String,
    options: AttachOptions,
) -> Result<SessionInfo, AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    let session = svc.attach(&device_id, options)?;
    emit_console_message(
        state,
        "info",
        "system",
        format!("Attached to {}", session.process_name),
        None,
    );
    Ok(session)
}

pub fn detach(state: &AppState, session_id: String) -> Result<(), AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.detach(&session_id)
}

pub fn resume(state: &AppState, session_id: String) -> Result<(), AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.resume(&session_id)
}

pub fn list_sessions(state: &AppState) -> Result<Vec<SessionInfo>, AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.list_sessions()
}

pub fn rpc_call(
    state: &AppState,
    session_id: String,
    method: String,
    params: Value,
) -> Result<Value, AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.rpc_call(&session_id, &method, params)
}

fn emit_console_message(
    state: &AppState,
    level: &str,
    source: &str,
    content: String,
    data: Option<Value>,
) {
    state.events.emit(
        "carf://console/message",
        serde_json::json!({
            "level": level,
            "source": source,
            "content": content,
            "data": data,
        }),
    );
}
