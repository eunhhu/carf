use serde_json::Value;

use crate::error::AppError;
use crate::services::frida::{
    AppInfo, AttachOptions, CollectionPage, DeviceInfo, OsPlatform, ProcessInfo, SpawnOptions,
};
use crate::services::session_manager::SessionInfo;
use crate::state::AppState;

const DEFAULT_LIST_LIMIT: usize = 200;
const MAX_LIST_LIMIT: usize = 500;

fn normalize_query(query: Option<String>) -> Option<String> {
    query.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_ascii_lowercase())
        }
    })
}

fn normalize_limit(limit: Option<usize>) -> usize {
    limit.unwrap_or(DEFAULT_LIST_LIMIT).clamp(1, MAX_LIST_LIMIT)
}

fn build_collection_page<T, F>(
    items: &[T],
    limit: usize,
    query: Option<String>,
    matches: F,
) -> CollectionPage<T>
where
    T: Clone,
    F: Fn(&T) -> bool,
{
    let mut page = Vec::with_capacity(items.len().min(limit));
    let mut total = 0;

    for item in items {
        if !matches(item) {
            continue;
        }

        total += 1;
        if page.len() < limit {
            page.push(item.clone());
        }
    }

    CollectionPage {
        items: page,
        total,
        limit,
        truncated: total > limit,
        query,
    }
}

fn process_matches(process: &ProcessInfo, query: &str) -> bool {
    process.name.to_ascii_lowercase().contains(query)
        || process.pid.to_string().contains(query)
        || process
            .identifier
            .as_ref()
            .map(|identifier| identifier.to_ascii_lowercase().contains(query))
            .unwrap_or(false)
}

fn app_matches(app: &AppInfo, query: &str) -> bool {
    app.name.to_ascii_lowercase().contains(query)
        || app.identifier.to_ascii_lowercase().contains(query)
        || app
            .pid
            .map(|pid| pid.to_string().contains(query))
            .unwrap_or(false)
}

fn process_identifier(process: &ProcessInfo) -> Option<&str> {
    process.identifier.as_deref().or_else(|| {
        if process.name.contains('.') {
            Some(process.name.as_str())
        } else {
            None
        }
    })
}

fn sort_applications(apps: &mut [AppInfo]) {
    apps.sort_by(|left, right| {
        left.name
            .cmp(&right.name)
            .then(left.identifier.cmp(&right.identifier))
    });
}

fn merge_running_pids(apps: &mut [AppInfo], processes: &[ProcessInfo]) {
    use std::collections::HashMap;

    let pid_by_identifier = processes
        .iter()
        .filter_map(|process| process_identifier(process).map(|identifier| (identifier, process.pid)))
        .collect::<HashMap<_, _>>();

    for app in apps {
        if app.pid.is_none() {
            app.pid = pid_by_identifier.get(app.identifier.as_str()).copied();
        }
    }
}

fn load_processes(
    state: &AppState,
    device_id: &str,
    force_refresh: bool,
) -> Result<Vec<ProcessInfo>, AppError> {
    if !force_refresh {
        if let Some(processes) = state
            .list_cache
            .lock()
            .map_err(|_| AppError::Internal("list_cache lock poisoned".to_string()))?
            .get_processes(device_id)
        {
            return Ok(processes);
        }
    }

    let mut processes = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?
        .list_processes(device_id)?;

    processes.sort_by(|left, right| left.name.cmp(&right.name).then(left.pid.cmp(&right.pid)));

    state
        .list_cache
        .lock()
        .map_err(|_| AppError::Internal("list_cache lock poisoned".to_string()))?
        .set_processes(device_id.to_string(), processes.clone());

    Ok(processes)
}

fn load_applications(
    state: &AppState,
    device_id: &str,
    force_refresh: bool,
) -> Result<Vec<AppInfo>, AppError> {
    if !force_refresh {
        if let Some(applications) = state
            .list_cache
            .lock()
            .map_err(|_| AppError::Internal("list_cache lock poisoned".to_string()))?
            .get_applications(device_id)
        {
            return Ok(applications);
        }
    }

    let (device, mut frida_apps) = {
        let mut svc = state
            .frida_service
            .lock()
            .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
        // Frida's `enumerate_applications` isn't implemented for every
        // device type, and on those devices it returns a generic `Internal`
        // error. We still want to fall through to the ADB-based path, but
        // we should at least surface *why* we're falling through so
        // genuinely broken devices don't look identical to unsupported
        // ones in the logs.
        let frida_apps = match svc.list_applications(device_id) {
            Ok(apps) => apps,
            Err(AppError::Internal(message)) => {
                log::debug!(
                    "Frida list_applications for {device_id} returned Internal error ({message}); falling back to ADB/process scan"
                );
                Vec::new()
            }
            Err(error) => return Err(error),
        };
        (svc.get_device_info(device_id)?, frida_apps)
    };

    if !frida_apps.is_empty() {
        if frida_apps.iter().any(|app| app.pid.is_none()) {
            if let Ok(processes) = load_processes(state, device_id, force_refresh) {
                merge_running_pids(&mut frida_apps, &processes);
            }
        }

        sort_applications(&mut frida_apps);
        state
            .list_cache
            .lock()
            .map_err(|_| AppError::Internal("list_cache lock poisoned".to_string()))?
            .set_applications(device_id.to_string(), frida_apps.clone());

        return Ok(frida_apps);
    }

    let processes = load_processes(state, device_id, force_refresh)?;
    let mut applications = if matches!(
        device.os.as_ref().map(|os| &os.platform),
        Some(OsPlatform::Android)
    ) {
        let adb_apps = state
            .adb_service
            .lock()
            .map_err(|_| AppError::Internal("adb_service lock poisoned".to_string()))?
            .list_applications(device_id, &processes);

        match adb_apps {
            Ok(apps) => merge_app_lists(&frida_apps, &apps),
            Err(AppError::AdbNotFound)
            | Err(AppError::AdbDeviceNotFound(_))
            | Err(AppError::AdbError(_)) => {
                if frida_apps.is_empty() {
                    processes_to_apps(&processes)
                } else {
                    frida_apps
                }
            }
            Err(error) => return Err(error),
        }
    } else if frida_apps.is_empty() {
        processes_to_apps(&processes)
    } else {
        frida_apps
    };

    sort_applications(&mut applications);

    state
        .list_cache
        .lock()
        .map_err(|_| AppError::Internal("list_cache lock poisoned".to_string()))?
        .set_applications(device_id.to_string(), applications.clone());

    Ok(applications)
}

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
    query: Option<String>,
    limit: Option<usize>,
    force_refresh: Option<bool>,
) -> Result<CollectionPage<ProcessInfo>, AppError> {
    let query = normalize_query(query);
    let limit = normalize_limit(limit);
    let query_filter = query.clone();
    let processes = load_processes(state, &device_id, force_refresh.unwrap_or(false))?;

    Ok(build_collection_page(&processes, limit, query, |process| {
        query_filter
            .as_deref()
            .map(|value| process_matches(process, value))
            .unwrap_or(true)
    }))
}

pub fn list_applications(
    state: &AppState,
    device_id: String,
    query: Option<String>,
    limit: Option<usize>,
    force_refresh: Option<bool>,
) -> Result<CollectionPage<AppInfo>, AppError> {
    let query = normalize_query(query);
    let limit = normalize_limit(limit);
    let query_filter = query.clone();
    let apps = load_applications(state, &device_id, force_refresh.unwrap_or(false))?;

    Ok(build_collection_page(&apps, limit, query, |app| {
        query_filter
            .as_deref()
            .map(|value| app_matches(app, value))
            .unwrap_or(true)
    }))
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
    let result = svc.kill_process(&device_id, pid);
    drop(svc);

    if result.is_ok() {
        state
            .list_cache
            .lock()
            .map_err(|_| AppError::Internal("list_cache lock poisoned".to_string()))?
            .invalidate_device(&device_id);
    }

    result
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
    drop(svc);
    state
        .list_cache
        .lock()
        .map_err(|_| AppError::Internal("list_cache lock poisoned".to_string()))?
        .invalidate_device(&device_id);
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
