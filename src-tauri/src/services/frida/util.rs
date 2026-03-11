use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::{SystemTime, UNIX_EPOCH};

use frida::{
    Device as FridaDevice, DeviceType as FridaDeviceType, ScriptRuntime, SpawnStdio, Variant,
};
use serde_json::Value;

use crate::error::AppError;
use crate::state::BridgeEvent;

use super::types::{DeviceInfo, DeviceStatus, DeviceType, OsInfo, OsPlatform};

pub(super) fn serialize_device(device: &FridaDevice<'static>) -> Result<DeviceInfo, AppError> {
    let details = device
        .query_system_parameters()
        .unwrap_or_else(|_| HashMap::new());

    Ok(DeviceInfo {
        id: device.get_id().to_string(),
        name: device.get_name().to_string(),
        device_type: map_device_type(device.get_type()),
        icon: None,
        os: build_os_info(&details),
        arch: details
            .get("arch")
            .and_then(Variant::get_string)
            .map(ToOwned::to_owned),
        status: if device.is_lost() {
            DeviceStatus::Disconnected
        } else {
            DeviceStatus::Connected
        },
    })
}

pub(super) fn get_device_arch(device: &FridaDevice<'static>) -> Result<Option<String>, AppError> {
    let details = device
        .query_system_parameters()
        .map_err(|error| AppError::Internal(error.to_string()))?;

    Ok(details
        .get("arch")
        .and_then(Variant::get_string)
        .map(ToOwned::to_owned))
}

pub(super) fn resolve_attach_target(
    device: &FridaDevice<'static>,
    target: &Value,
) -> Result<(u32, String, Option<String>), AppError> {
    let processes = device.enumerate_processes();

    if let Some(pid) = target.as_u64() {
        let pid = u32::try_from(pid)
            .map_err(|_| AppError::ProcessNotFound(format!("Process not found: {pid}")))?;
        if let Some(process) = processes.iter().find(|process| process.get_pid() == pid) {
            return Ok((pid, process.get_name().to_string(), None));
        }
        return Ok((pid, pid.to_string(), None));
    }

    if let Some(target) = target.as_str() {
        if let Ok(pid) = target.parse::<u32>() {
            return resolve_attach_target(device, &Value::from(pid));
        }

        if let Some(process) = processes
            .iter()
            .find(|process| process.get_name() == target)
        {
            return Ok((process.get_pid(), process.get_name().to_string(), None));
        }

        return Err(AppError::ProcessNotFound(format!(
            "Process not found: {target}"
        )));
    }

    Err(AppError::ProcessNotFound(
        "Unsupported attach target".to_string(),
    ))
}

pub(super) fn parse_script_runtime(runtime: Option<&str>) -> ScriptRuntime {
    match runtime.unwrap_or_default().to_ascii_lowercase().as_str() {
        "qjs" => ScriptRuntime::QJS,
        "v8" => ScriptRuntime::V8,
        _ => ScriptRuntime::Default,
    }
}

pub(super) fn parse_spawn_stdio(stdio: &str) -> SpawnStdio {
    match stdio.to_ascii_lowercase().as_str() {
        "pipe" => SpawnStdio::Pipe,
        _ => SpawnStdio::Inherit,
    }
}

pub(super) fn queue_event(sender: &mpsc::Sender<BridgeEvent>, name: &str, payload: Value) {
    let _ = sender.send(BridgeEvent {
        name: name.to_string(),
        payload,
    });
}

pub(super) fn unwrap_rpc_result(value: Value) -> Result<Value, AppError> {
    match value {
        Value::Object(mut object) if matches!(object.get("success"), Some(Value::Bool(_))) => {
            match object.remove("success") {
                Some(Value::Bool(true)) => {
                    decode_rpc_data(object.remove("data").unwrap_or(Value::Null))
                }
                Some(Value::Bool(false)) => {
                    let message = object
                        .remove("error")
                        .and_then(|value| value.as_str().map(ToOwned::to_owned))
                        .unwrap_or_else(|| "agent RPC failed".to_string());
                    Err(AppError::AgentRpcError(message))
                }
                _ => Ok(Value::Object(object)),
            }
        }
        other => Ok(other),
    }
}

pub(super) fn stringify_value(value: &Value) -> String {
    match value {
        Value::String(string) => string.clone(),
        _ => serde_json::to_string(value).unwrap_or_else(|_| value.to_string()),
    }
}

pub(super) fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")))
}

pub(super) fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub(super) fn new_session_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

#[cfg(unix)]
pub(super) fn pause_process(pid: u32) -> Result<(), AppError> {
    let result = unsafe { libc::kill(pid as libc::pid_t, libc::SIGSTOP) };
    if result == 0 {
        Ok(())
    } else {
        Err(AppError::Internal(format!(
            "failed to pause process {pid}: {}",
            std::io::Error::last_os_error()
        )))
    }
}

#[cfg(not(unix))]
pub(super) fn pause_process(pid: u32) -> Result<(), AppError> {
    Err(AppError::Internal(format!(
        "pause is not supported on this platform for pid {pid}"
    )))
}

#[cfg(unix)]
pub(super) fn resume_process(pid: u32) -> Result<(), AppError> {
    let result = unsafe { libc::kill(pid as libc::pid_t, libc::SIGCONT) };
    if result == 0 {
        Ok(())
    } else {
        Err(AppError::Internal(format!(
            "failed to resume process {pid}: {}",
            std::io::Error::last_os_error()
        )))
    }
}

#[cfg(not(unix))]
pub(super) fn resume_process(pid: u32) -> Result<(), AppError> {
    Err(AppError::Internal(format!(
        "resume is not supported on this platform for pid {pid}"
    )))
}

fn build_os_info(details: &HashMap<String, Variant>) -> Option<OsInfo> {
    let os_details = details.get("os").and_then(Variant::get_map);
    let platform = os_details
        .and_then(|os| os.get("id"))
        .and_then(Variant::get_string)
        .or_else(|| details.get("platform").and_then(Variant::get_string))?;
    let version = os_details
        .and_then(|os| os.get("version"))
        .and_then(Variant::get_string)
        .unwrap_or_default()
        .to_string();

    Some(OsInfo {
        platform: normalize_platform(platform),
        version,
    })
}

fn map_device_type(device_type: FridaDeviceType) -> DeviceType {
    match device_type {
        FridaDeviceType::Local => DeviceType::Local,
        FridaDeviceType::USB => DeviceType::Usb,
        FridaDeviceType::Remote => DeviceType::Remote,
        _ => DeviceType::Remote,
    }
}

fn normalize_platform(platform: &str) -> OsPlatform {
    match platform.to_ascii_lowercase().as_str() {
        "android" => OsPlatform::Android,
        "ios" => OsPlatform::Ios,
        "darwin" | "macos" => OsPlatform::MacOs,
        "windows" => OsPlatform::Windows,
        "linux" => OsPlatform::Linux,
        _ => OsPlatform::Linux,
    }
}

fn decode_rpc_data(value: Value) -> Result<Value, AppError> {
    match value {
        Value::String(text) => match serde_json::from_str::<Value>(&text) {
            Ok(parsed) => Ok(parsed),
            Err(_) => Ok(Value::String(text)),
        },
        other => Ok(other),
    }
}
