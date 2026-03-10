use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};
use std::thread;
use std::time::Duration;

use serde_json::{json, Value};

use crate::error::AppError;
use crate::services::frida::{AttachOptions, DeviceInfo, SpawnOptions};
use crate::services::session_manager::SessionInfo;
use crate::state::AppState;

static NETWORK_REQUEST_COUNTER: AtomicU64 = AtomicU64::new(1);

pub fn list_devices(state: &AppState) -> Result<Vec<DeviceInfo>, AppError> {
    let svc = state
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
        json!({ "id": format!("remote-{address}") }),
    );
    Ok(())
}

pub fn get_device_info(state: &AppState, device_id: String) -> Result<DeviceInfo, AppError> {
    let svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.get_device_info(&device_id)
}

pub fn list_processes(
    state: &AppState,
    device_id: String,
) -> Result<Vec<crate::services::frida::ProcessInfo>, AppError> {
    let svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.list_processes(&device_id)
}

pub fn list_applications(
    state: &AppState,
    device_id: String,
) -> Result<Vec<crate::services::frida::AppInfo>, AppError> {
    let svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.list_applications(&device_id)
}

pub fn kill_process(state: &AppState, device_id: String, pid: u32) -> Result<(), AppError> {
    let svc = state
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
    svc.detach(&session_id)?;
    drop(svc);

    stop_session_tasks(state, &session_id);
    state.events.emit(
        "carf://session/detached",
        json!({
            "sessionId": session_id,
            "reason": "application_requested",
        }),
    );
    Ok(())
}

pub fn resume(state: &AppState, session_id: String) -> Result<(), AppError> {
    let mut svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.resume(&session_id)
}

pub fn list_sessions(state: &AppState) -> Result<Vec<SessionInfo>, AppError> {
    let svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    Ok(svc.list_sessions())
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
    let result = svc.rpc_call(&session_id, &method, params.clone())?;
    drop(svc);

    emit_rpc_side_effects(state, &session_id, &method, &params, &result);

    Ok(result)
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
        json!({
            "level": level,
            "source": source,
            "content": content,
            "data": data,
        }),
    );
}

fn emit_rpc_side_effects(
    state: &AppState,
    session_id: &str,
    method: &str,
    params: &Value,
    result: &Value,
) {
    match method {
        "loadScript" => emit_console_message(
            state,
            "info",
            "agent",
            "Mock script loaded".to_string(),
            Some(json!({
                "size": params
                    .get("code")
                    .and_then(Value::as_str)
                    .map(str::len)
                    .unwrap_or_default(),
            })),
        ),
        "unloadScript" => emit_console_message(
            state,
            "info",
            "agent",
            "Mock script unloaded".to_string(),
            None,
        ),
        "hookFunction" | "hookJavaMethod" | "hookObjcMethod" => {
            schedule_hook_events(state, result.clone());
        }
        "startStalker" => start_stalker_events(state, session_id, params),
        "stopStalker" => stop_stalker_events(state, session_id, params),
        "startNetworkCapture" => start_network_capture(state, session_id),
        "stopNetworkCapture" => stop_network_capture(state, session_id),
        _ => {}
    }
}

fn schedule_hook_events(state: &AppState, hook: Value) {
    let hook_id = hook
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("hook-stub")
        .to_string();
    let target = hook
        .get("target")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_string();
    let address = hook
        .get("address")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let events = state.events.clone();

    thread::spawn(move || {
        thread::sleep(Duration::from_millis(80));
        events.emit(
            "carf://hook/event",
            json!({
                "hookId": hook_id,
                "type": "enter",
                "timestamp": crate::services::session_manager::now_millis(),
                "threadId": 1337,
                "target": target,
                "address": address,
                "args": ["alice", "hunter2"],
                "retval": Value::Null,
                "backtrace": [{
                    "address": "0x7200009bb0",
                    "moduleName": "libssl.so",
                    "symbolName": "SSL_write",
                    "fileName": Value::Null,
                    "lineNumber": Value::Null,
                }],
            }),
        );
        thread::sleep(Duration::from_millis(60));
        events.emit(
            "carf://hook/event",
            json!({
                "hookId": hook_id,
                "type": "leave",
                "timestamp": crate::services::session_manager::now_millis(),
                "threadId": 1337,
                "target": target,
                "address": address,
                "args": [],
                "retval": "ok",
                "backtrace": [],
            }),
        );
    });
}

fn start_network_capture(state: &AppState, session_id: &str) {
    let mut runtime = match state.bridge_runtime.lock() {
        Ok(runtime) => runtime,
        Err(_) => return,
    };

    if runtime.network_capture_flags.contains_key(session_id) {
        return;
    }

    let stop_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
    runtime
        .network_capture_flags
        .insert(session_id.to_string(), stop_flag.clone());

    let events = state.events.clone();
    thread::spawn(move || {
        emit_network_request(&events);
        while !stop_flag.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_secs(2));
            if stop_flag.load(Ordering::SeqCst) {
                break;
            }
            emit_network_request(&events);
        }
    });
}

fn stop_network_capture(state: &AppState, session_id: &str) {
    if let Ok(mut runtime) = state.bridge_runtime.lock() {
        if let Some(flag) = runtime.network_capture_flags.remove(session_id) {
            flag.store(true, Ordering::SeqCst);
        }
    }
}

fn emit_network_request(events: &crate::state::EventHub) {
    let request_id = NETWORK_REQUEST_COUNTER.fetch_add(1, Ordering::SeqCst);
    let is_login = request_id == 1;

    events.emit(
        "carf://network/request",
        json!({
            "id": format!("req-{request_id}"),
            "timestamp": crate::services::session_manager::now_millis(),
            "method": if is_login { "POST" } else { "GET" },
            "url": if is_login {
                "https://api.carf.app/v1/login"
            } else {
                "https://api.carf.app/v1/profile"
            },
            "statusCode": 200,
            "requestHeaders": {
                "accept": "application/json",
                "x-session": "bridge-session",
            },
            "responseHeaders": {
                "content-type": "application/json",
            },
            "requestBody": if is_login {
                Value::String("{\"username\":\"alice\"}".to_string())
            } else {
                Value::Null
            },
            "responseBody": if is_login {
                Value::String("{\"token\":\"demo-token\"}".to_string())
            } else {
                Value::String("{\"user\":\"alice\"}".to_string())
            },
            "duration": if is_login { 84 } else { 27 },
            "protocol": "https",
            "source": "java",
        }),
    );
}

fn start_stalker_events(state: &AppState, session_id: &str, params: &Value) {
    let thread_id = params
        .get("threadId")
        .and_then(Value::as_u64)
        .unwrap_or(1337);
    let task_key = format!("{session_id}:{thread_id}");

    let mut runtime = match state.bridge_runtime.lock() {
        Ok(runtime) => runtime,
        Err(_) => return,
    };

    if runtime.stalker_flags.contains_key(&task_key) {
        return;
    }

    let stop_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
    runtime.stalker_flags.insert(task_key, stop_flag.clone());

    let events = state.events.clone();
    thread::spawn(move || {
        while !stop_flag.load(Ordering::SeqCst) {
            emit_stalker_batch(&events, thread_id);
            thread::sleep(Duration::from_millis(1200));
        }
    });
}

fn stop_stalker_events(state: &AppState, session_id: &str, params: &Value) {
    let thread_id = params
        .get("threadId")
        .and_then(Value::as_u64)
        .unwrap_or(1337);
    let task_key = format!("{session_id}:{thread_id}");

    if let Ok(mut runtime) = state.bridge_runtime.lock() {
        if let Some(flag) = runtime.stalker_flags.remove(&task_key) {
            flag.store(true, Ordering::SeqCst);
        }
    }
}

fn emit_stalker_batch(events: &crate::state::EventHub, thread_id: u64) {
    let batch = json!([
        {
            "threadId": thread_id,
            "type": "call",
            "from": "0x7100011200",
            "to": "0x7200009bb0",
            "fromModule": "libdemo.so",
            "toModule": "libssl.so",
            "fromSymbol": "login",
            "toSymbol": "SSL_write",
            "depth": 0,
        },
        {
            "threadId": thread_id,
            "type": "ret",
            "from": "0x7200009bb0",
            "to": "0x7100011200",
            "fromModule": "libssl.so",
            "toModule": "libdemo.so",
            "fromSymbol": "SSL_write",
            "toSymbol": "login",
            "depth": 0,
        }
    ]);

    events.emit("carf://stalker/event", json!({ "events": batch }));

    if let Some(items) = batch.as_array() {
        for item in items {
            events.emit("carf://stalker/event", item.clone());
        }
    }
}

fn stop_session_tasks(state: &AppState, session_id: &str) {
    if let Ok(mut runtime) = state.bridge_runtime.lock() {
        runtime.stop_session(session_id);
    }
}
