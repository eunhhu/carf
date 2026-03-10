use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::error::AppError;
use crate::services::session_manager::{
    now_millis, SessionHandle, SessionInfo, SessionManager, SessionMode, SessionStatus,
};

// ─── Frontend-mirroring types ─────────────────────────────────────────────────

/// Mirrors frontend `DeviceInfo`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub device_type: DeviceType,
    pub icon: Option<String>,
    pub os: Option<OsInfo>,
    pub arch: Option<String>,
    pub status: DeviceStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DeviceType {
    #[serde(rename = "local")]
    Local,
    #[serde(rename = "usb")]
    Usb,
    #[serde(rename = "remote")]
    Remote,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DeviceStatus {
    #[serde(rename = "connected")]
    Connected,
    #[serde(rename = "disconnected")]
    Disconnected,
    #[serde(rename = "pairing")]
    Pairing,
}

/// Mirrors frontend `OsInfo`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OsInfo {
    pub platform: OsPlatform,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OsPlatform {
    #[serde(rename = "android")]
    Android,
    #[serde(rename = "ios")]
    Ios,
    #[serde(rename = "macos")]
    MacOs,
    #[serde(rename = "linux")]
    Linux,
    #[serde(rename = "windows")]
    Windows,
}

/// Mirrors frontend `ProcessInfo`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub identifier: Option<String>,
    pub icon: Option<String>,
}

/// Mirrors frontend `AppInfo`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub identifier: String,
    pub name: String,
    pub pid: Option<u32>,
    pub icon: Option<String>,
}

/// Mirrors frontend `SpawnOptions`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnOptions {
    pub identifier: String,
    pub argv: Option<Vec<String>>,
    pub envp: Option<HashMap<String, String>>,
    pub cwd: Option<String>,
    pub stdio: Option<String>,
    pub auto_resume: Option<bool>,
    pub script_path: Option<String>,
}

/// Mirrors frontend `AttachOptions`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachOptions {
    pub target: serde_json::Value, // number | string
    pub realm: Option<String>,
    pub persist_timeout: Option<u32>,
    pub runtime: Option<String>,
    pub enable_child_gating: Option<bool>,
    pub script_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HookState {
    pub id: String,
    pub target: String,
    pub address: Option<String>,
    #[serde(rename = "type")]
    pub hook_type: String,
    pub active: bool,
    pub hits: u64,
}

#[derive(Debug, Default)]
struct SessionRuntimeState {
    hooks: Vec<HookState>,
    script_loaded: bool,
    stalker_events: HashMap<u64, Vec<Value>>,
}

// ─── FridaService ─────────────────────────────────────────────────────────────

/// Owns the Frida DeviceManager and the session pool.
///
/// All methods that touch the frida-rust API are marked with TODO comments.
/// The scaffolding compiles cleanly and returns stub data; wire up the actual
/// frida-rust calls once the crate integration is validated.
pub struct FridaService {
    /// TODO: replace with `frida::Frida` + `frida::DeviceManager` instances.
    /// Example initialisation:
    /// ```rust
    /// let frida = unsafe { frida::Frida::obtain() };
    /// let device_manager = frida::DeviceManager::obtain(&frida);
    /// ```
    _frida_stub: (),
    session_manager: SessionManager,
    remote_devices: Vec<DeviceInfo>,
    session_runtime: HashMap<String, SessionRuntimeState>,
}

impl FridaService {
    pub fn new() -> Self {
        // TODO: initialise Frida runtime here
        Self {
            _frida_stub: (),
            session_manager: SessionManager::new(),
            remote_devices: Vec::new(),
            session_runtime: HashMap::new(),
        }
    }

    // ── Devices ──────────────────────────────────────────────────────────────

    /// Returns the list of devices known to Frida.
    ///
    /// TODO: replace stub with real frida-rust call:
    /// ```rust
    /// let devices = self.device_manager.enumerate_all_devices()?;
    /// devices.iter().map(|d| DeviceInfo { id: d.get_id(), name: d.get_name(), ... }).collect()
    /// ```
    pub fn list_devices(&self) -> Result<Vec<DeviceInfo>, AppError> {
        log::debug!("FridaService::list_devices (stub)");

        let mut devices = vec![DeviceInfo {
            id: "device-local-1".to_string(),
            name: "Pixel 8 Pro".to_string(),
            device_type: DeviceType::Usb,
            icon: None,
            os: Some(OsInfo {
                platform: OsPlatform::Android,
                version: "15".to_string(),
            }),
            arch: Some("arm64".to_string()),
            status: DeviceStatus::Connected,
        }];
        devices.extend(self.remote_devices.clone());
        Ok(devices)
    }

    /// Connects to a remote Frida device by TCP address.
    ///
    /// TODO: replace stub with real frida-rust call:
    /// ```rust
    /// let device = self.device_manager.add_remote_device(address, None)?;
    /// ```
    pub fn add_remote_device(&mut self, address: &str) -> Result<DeviceInfo, AppError> {
        // Validate address format (host:port)
        if !address.contains(':') {
            return Err(AppError::InvalidAddress(address.to_string()));
        }
        // TODO: add via Frida DeviceManager
        log::info!("FridaService::add_remote_device({address}) (stub)");
        let device = DeviceInfo {
            id: format!("remote-{address}"),
            name: format!("Remote {address}"),
            device_type: DeviceType::Remote,
            icon: None,
            os: Some(OsInfo {
                platform: OsPlatform::Android,
                version: "15".to_string(),
            }),
            arch: Some("arm64".to_string()),
            status: DeviceStatus::Connected,
        };

        if !self.remote_devices.iter().any(|item| item.id == device.id) {
            self.remote_devices.push(device.clone());
        }

        Ok(device)
    }

    /// Removes a previously added remote device.
    ///
    /// TODO: replace stub with real frida-rust call:
    /// ```rust
    /// self.device_manager.remove_remote_device(address)?;
    /// ```
    pub fn remove_remote_device(&mut self, address: &str) -> Result<(), AppError> {
        log::info!("FridaService::remove_remote_device({address}) (stub)");
        self.remote_devices
            .retain(|device| device.id != format!("remote-{address}"));
        Ok(())
    }

    /// Fetches info for a single device by id.
    pub fn get_device_info(&self, device_id: &str) -> Result<DeviceInfo, AppError> {
        // TODO: look up in device_manager by id
        let devices = self.list_devices()?;
        devices
            .into_iter()
            .find(|d| d.id == device_id)
            .ok_or_else(|| AppError::DeviceNotFound(device_id.to_string()))
    }

    // ── Processes ─────────────────────────────────────────────────────────────

    /// Lists running processes on the given device.
    ///
    /// TODO: replace stub with real frida-rust call:
    /// ```rust
    /// let device = self.get_frida_device(device_id)?;
    /// let processes = device.enumerate_processes(frida::ProcessQueryOptions::default())?;
    /// ```
    pub fn list_processes(&self, device_id: &str) -> Result<Vec<ProcessInfo>, AppError> {
        log::debug!("FridaService::list_processes({device_id}) (stub)");
        Ok(stub_processes())
    }

    /// Lists installed applications on the given device.
    ///
    /// TODO: replace stub with real frida-rust call:
    /// ```rust
    /// let device = self.get_frida_device(device_id)?;
    /// let apps = device.enumerate_applications(frida::ApplicationQueryOptions::default())?;
    /// ```
    pub fn list_applications(&self, device_id: &str) -> Result<Vec<AppInfo>, AppError> {
        log::debug!("FridaService::list_applications({device_id}) (stub)");
        Ok(stub_applications())
    }

    /// Kills a process on the given device.
    ///
    /// TODO: replace stub with real frida-rust call:
    /// ```rust
    /// let device = self.get_frida_device(device_id)?;
    /// device.kill(pid)?;
    /// ```
    pub fn kill_process(&self, device_id: &str, pid: u32) -> Result<(), AppError> {
        // TODO: kill via Frida device
        log::info!("FridaService::kill_process({device_id}, {pid}) (stub)");
        Ok(())
    }

    // ── Sessions ──────────────────────────────────────────────────────────────

    /// Spawns an application and attaches Frida to it.
    ///
    /// TODO: replace stub with real frida-rust calls:
    /// ```rust
    /// let device = self.get_frida_device(&device_id)?;
    /// let pid = device.spawn(&options.identifier, &frida::SpawnOptions::default())?;
    /// let session = device.attach(pid)?;
    /// // load script, then resume
    /// device.resume(pid)?;
    /// ```
    pub fn spawn_and_attach(
        &mut self,
        device_id: &str,
        options: SpawnOptions,
    ) -> Result<SessionInfo, AppError> {
        log::info!(
            "FridaService::spawn_and_attach({device_id}, {}) (stub)",
            options.identifier
        );

        // TODO: real spawn + attach via frida-rust
        let process = stub_applications()
            .into_iter()
            .find(|app| app.identifier == options.identifier)
            .map(|app| (app.pid.unwrap_or(4201), app.name, Some(app.identifier)))
            .unwrap_or((
                4201,
                options.identifier.clone(),
                Some(options.identifier.clone()),
            ));
        let session_id = Uuid::new_v4().to_string();
        let info = SessionInfo {
            id: session_id.clone(),
            device_id: device_id.to_string(),
            pid: process.0,
            process_name: process.1,
            identifier: process.2,
            status: SessionStatus::Active,
            mode: SessionMode::Spawn,
            arch: Some("arm64".to_string()),
            created_at: now_millis(),
        };

        self.session_manager.add(SessionHandle::new(info.clone()));
        self.session_runtime
            .insert(session_id, SessionRuntimeState::default());
        Ok(info)
    }

    /// Attaches Frida to an already-running process.
    ///
    /// TODO: replace stub with real frida-rust call:
    /// ```rust
    /// let device = self.get_frida_device(&device_id)?;
    /// let session = device.attach(target_pid)?;
    /// ```
    pub fn attach(
        &mut self,
        device_id: &str,
        options: AttachOptions,
    ) -> Result<SessionInfo, AppError> {
        let target = match &options.target {
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::String(s) => s.clone(),
            other => {
                return Err(AppError::AttachFailed(
                    "unknown".to_string(),
                    format!("invalid target: {other}"),
                ))
            }
        };
        log::info!("FridaService::attach({device_id}, {target}) (stub)");

        // TODO: real attach via frida-rust
        let session_id = Uuid::new_v4().to_string();
        let (pid, process_name, identifier) = resolve_attach_target(&options.target);

        let info = SessionInfo {
            id: session_id.clone(),
            device_id: device_id.to_string(),
            pid,
            process_name,
            identifier,
            status: SessionStatus::Active,
            mode: SessionMode::Attach,
            arch: Some("arm64".to_string()),
            created_at: now_millis(),
        };

        self.session_manager.add(SessionHandle::new(info.clone()));
        self.session_runtime
            .insert(session_id, SessionRuntimeState::default());
        Ok(info)
    }

    /// Detaches from a session, cleaning up Frida resources.
    ///
    /// TODO: replace stub with real frida-rust call:
    /// ```rust
    /// if let Some(handle) = self.session_manager.remove(session_id) {
    ///     handle.frida_session.detach()?;
    /// }
    /// ```
    pub fn detach(&mut self, session_id: &str) -> Result<(), AppError> {
        log::info!("FridaService::detach({session_id}) (stub)");
        self.session_manager
            .remove(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;
        self.session_runtime.remove(session_id);
        Ok(())
    }

    /// Resumes a spawned process (called after attach in spawn mode).
    ///
    /// TODO: replace stub with real frida-rust call:
    /// ```rust
    /// let device = self.get_frida_device(&session.device_id)?;
    /// device.resume(session.pid)?;
    /// ```
    pub fn resume(&mut self, session_id: &str) -> Result<(), AppError> {
        log::info!("FridaService::resume({session_id}) (stub)");
        self.session_manager
            .update_status(session_id, SessionStatus::Active)?;
        Ok(())
    }

    /// Lists all active sessions.
    pub fn list_sessions(&self) -> Vec<SessionInfo> {
        self.session_manager.list()
    }

    // ── Agent RPC ─────────────────────────────────────────────────────────────

    /// Calls an RPC method on the CARF Std agent running inside the target process.
    ///
    /// TODO: replace stub with real frida-rust call:
    /// ```rust
    /// let handle = self.session_manager.get(session_id)
    ///     .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;
    /// let script = handle.script.as_ref()
    ///     .ok_or_else(|| AppError::ScriptLoadFailed("no script loaded".to_string()))?;
    /// let result = script.exports.call(method, params)?;
    /// ```
    pub fn rpc_call(
        &mut self,
        session_id: &str,
        method: &str,
        params: Value,
    ) -> Result<serde_json::Value, AppError> {
        // Verify session exists
        let _handle = self
            .session_manager
            .get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;
        let runtime = self
            .session_runtime
            .get_mut(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        log::debug!("FridaService::rpc_call({session_id}, {method}, {params}) (stub)");

        match method {
            "pause" => {
                self.session_manager
                    .update_status(session_id, SessionStatus::Paused)?;
                Ok(json!({}))
            }
            "loadScript" => {
                runtime.script_loaded = true;
                Ok(json!({}))
            }
            "unloadScript" => {
                runtime.script_loaded = false;
                Ok(json!({}))
            }
            "startNetworkCapture" | "stopNetworkCapture" | "protectMemory" => Ok(json!({})),
            "evaluate" => Ok(json!(format!(
                "{}",
                evaluate_code(
                    params
                        .get("code")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                )
            ))),
            "enumerateModules" => Ok(json!(stub_modules())),
            "getModuleExports" => {
                let module_name = params
                    .get("moduleName")
                    .or_else(|| params.get("name"))
                    .and_then(Value::as_str)
                    .unwrap_or("libdemo.so");
                Ok(json!(stub_module_exports(module_name)))
            }
            "getModuleImports" => {
                let module_name = params
                    .get("moduleName")
                    .or_else(|| params.get("name"))
                    .and_then(Value::as_str)
                    .unwrap_or("libdemo.so");
                Ok(json!(stub_module_imports(module_name)))
            }
            "getModuleSymbols" => Ok(json!([])),
            "enumerateThreads" => Ok(json!(stub_threads())),
            "getBacktrace" => Ok(json!(stub_backtrace(
                params
                    .get("threadId")
                    .and_then(Value::as_u64)
                    .unwrap_or(1337)
            ))),
            "enumerateRanges" => Ok(json!(stub_memory_ranges())),
            "readMemory" => {
                let address = params
                    .get("address")
                    .and_then(Value::as_str)
                    .unwrap_or("0x7100000000");
                let size = params.get("size").and_then(Value::as_u64).unwrap_or(256);
                Ok(json!(build_hex_string(address, size as usize)))
            }
            "writeMemory" => Ok(
                json!({ "written": params.get("data").and_then(Value::as_str).map(str::len).unwrap_or_default() }),
            ),
            "scanMemory" => {
                let pattern = params
                    .get("pattern")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                Ok(json!(if pattern.is_empty() {
                    Vec::<Value>::new()
                } else {
                    vec![
                        json!({ "address": "0x7100020040", "size": 16 }),
                        json!({ "address": "0x7100021080", "size": 24 }),
                    ]
                }))
            }
            "enumerateJavaClasses" => Ok(json!(stub_java_classes())),
            "getJavaMethods" => {
                let class_name = params
                    .get("className")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                Ok(json!(stub_java_methods(class_name, &runtime.hooks)))
            }
            "getJavaFields" => {
                let class_name = params
                    .get("className")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                Ok(json!(stub_java_fields(class_name)))
            }
            "chooseJavaInstances" => {
                let class_name = params
                    .get("className")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                Ok(json!([
                    format!("{class_name}@0x1010"),
                    format!("{class_name}@0x1020"),
                ]))
            }
            "enumerateObjcClasses" => Ok(json!(stub_objc_classes())),
            "getObjcMethods" => {
                let class_name = params
                    .get("className")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                Ok(json!(stub_objc_methods(class_name, &runtime.hooks)))
            }
            "chooseObjcInstances" => {
                let class_name = params
                    .get("className")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                Ok(json!([
                    format!("{class_name}:0x2010"),
                    format!("{class_name}:0x2020"),
                ]))
            }
            "listHooks" => Ok(json!(filter_hooks(&runtime.hooks, "native"))),
            "listJavaHooks" => Ok(json!(filter_hooks(&runtime.hooks, "java"))),
            "listObjcHooks" => Ok(json!(filter_hooks(&runtime.hooks, "objc"))),
            "getStalkerEvents" => {
                let thread_id = params
                    .get("threadId")
                    .and_then(Value::as_u64)
                    .unwrap_or(1337);
                Ok(json!(runtime
                    .stalker_events
                    .get(&thread_id)
                    .cloned()
                    .unwrap_or_else(|| stub_stalker_events(thread_id))))
            }
            "listDirectory" => {
                let path = params
                    .get("path")
                    .and_then(Value::as_str)
                    .unwrap_or("/data/data/");
                Ok(json!(stub_directory_entries(path)))
            }
            "readFile" => {
                let path = params
                    .get("path")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                let encoding = params
                    .get("encoding")
                    .and_then(Value::as_str)
                    .unwrap_or("utf8");
                let content = stub_file_content(path);
                Ok(json!(if encoding == "hex" {
                    content
                        .bytes()
                        .map(|byte| format!("{byte:02x}"))
                        .collect::<String>()
                } else {
                    content
                }))
            }
            "sqliteQuery" => {
                let query = params
                    .get("query")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                Ok(json!(stub_sqlite_query(query)))
            }
            "sqliteTables" => {
                let path = params
                    .get("path")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                Ok(json!(stub_sqlite_tables(path)))
            }
            "isJavaAvailable" | "isObjcAvailable" => Ok(json!(true)),
            "isNetworkCaptureActive" => Ok(json!({ "active": false })),
            "callFunction" => Ok(json!(format!(
                "retval({})",
                params
                    .get("address")
                    .and_then(Value::as_str)
                    .unwrap_or("0x0")
            ))),
            "hookFunction" => {
                let target = params
                    .get("target")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown");
                let hook = HookState {
                    id: format!("hook-{}", now_millis()),
                    target: target.to_string(),
                    address: Some(resolve_native_target_address(target).to_string()),
                    hook_type: "native".to_string(),
                    active: true,
                    hits: 1,
                };
                runtime.hooks.push(hook.clone());
                Ok(json!(hook))
            }
            "hookJavaMethod" => {
                let class_name = params
                    .get("className")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown");
                let method_name = params
                    .get("methodName")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown");
                let hook = HookState {
                    id: format!("hook-{}", now_millis()),
                    target: format!("{class_name}.{method_name}"),
                    address: None,
                    hook_type: "java".to_string(),
                    active: true,
                    hits: 1,
                };
                runtime.hooks.push(hook.clone());
                Ok(json!(hook))
            }
            "hookObjcMethod" => {
                let class_name = params
                    .get("className")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown");
                let selector = params
                    .get("selector")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown");
                let hook = HookState {
                    id: format!("hook-{}", now_millis()),
                    target: format!("{class_name} {selector}"),
                    address: None,
                    hook_type: "objc".to_string(),
                    active: true,
                    hits: 1,
                };
                runtime.hooks.push(hook.clone());
                Ok(json!(hook))
            }
            "setNativeHookActive" | "setJavaHookActive" | "setObjcHookActive" => {
                set_hook_active(
                    runtime,
                    params.get("hookId").and_then(Value::as_str),
                    params
                        .get("active")
                        .and_then(Value::as_bool)
                        .unwrap_or(true),
                );
                Ok(json!({}))
            }
            "unhookFunction" | "unhookJavaMethod" | "unhookObjcMethod" => {
                let hook_id = params
                    .get("hookId")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                runtime.hooks.retain(|hook| hook.id != hook_id);
                Ok(json!({}))
            }
            "startStalker" => {
                let thread_id = params
                    .get("threadId")
                    .and_then(Value::as_u64)
                    .unwrap_or(1337);
                runtime
                    .stalker_events
                    .insert(thread_id, stub_stalker_events(thread_id));
                Ok(json!({}))
            }
            "stopStalker" => {
                let thread_id = params
                    .get("threadId")
                    .and_then(Value::as_u64)
                    .unwrap_or(1337);
                runtime.stalker_events.remove(&thread_id);
                Ok(json!({}))
            }
            _ => Err(AppError::AgentMethodNotFound(format!(
                "{method} (agent not yet loaded – stub mode)"
            ))),
        }
    }
}

impl Default for FridaService {
    fn default() -> Self {
        Self::new()
    }
}

fn stub_processes() -> Vec<ProcessInfo> {
    vec![
        ProcessInfo {
            pid: 4201,
            name: "DemoBank".to_string(),
            identifier: Some("com.carf.demobank".to_string()),
            icon: None,
        },
        ProcessInfo {
            pid: 3310,
            name: "SystemUI".to_string(),
            identifier: Some("com.android.systemui".to_string()),
            icon: None,
        },
        ProcessInfo {
            pid: 2490,
            name: "CarfHelper".to_string(),
            identifier: Some("app.carf.helper".to_string()),
            icon: None,
        },
    ]
}

fn stub_applications() -> Vec<AppInfo> {
    vec![
        AppInfo {
            identifier: "com.carf.demobank".to_string(),
            name: "DemoBank".to_string(),
            pid: Some(4201),
            icon: None,
        },
        AppInfo {
            identifier: "app.carf.helper".to_string(),
            name: "CarfHelper".to_string(),
            pid: Some(2490),
            icon: None,
        },
        AppInfo {
            identifier: "com.example.offline".to_string(),
            name: "Offline Notes".to_string(),
            pid: None,
            icon: None,
        },
    ]
}

fn resolve_attach_target(target: &Value) -> (u32, String, Option<String>) {
    match target {
        Value::Number(number) => {
            let pid = number.as_u64().unwrap_or(4201) as u32;
            let process = stub_processes()
                .into_iter()
                .find(|item| item.pid == pid)
                .unwrap_or(ProcessInfo {
                    pid,
                    name: format!("pid-{pid}"),
                    identifier: None,
                    icon: None,
                });
            (process.pid, process.name, process.identifier)
        }
        Value::String(value) => {
            let process = stub_processes()
                .into_iter()
                .find(|item| item.identifier.as_deref() == Some(value) || item.name == *value)
                .unwrap_or(ProcessInfo {
                    pid: 4201,
                    name: value.clone(),
                    identifier: Some(value.clone()),
                    icon: None,
                });
            (process.pid, process.name, process.identifier)
        }
        _ => (
            4201,
            "DemoBank".to_string(),
            Some("com.carf.demobank".to_string()),
        ),
    }
}

fn stub_modules() -> Vec<Value> {
    vec![
        json!({
            "name": "libdemo.so",
            "base": "0x7100000000",
            "size": 212_992,
            "path": "/data/app/com.carf.demobank/lib/arm64/libdemo.so",
        }),
        json!({
            "name": "libssl.so",
            "base": "0x7200000000",
            "size": 475_136,
            "path": "/system/lib64/libssl.so",
        }),
    ]
}

fn stub_module_exports(module_name: &str) -> Vec<Value> {
    match module_name {
        "libssl.so" => vec![
            json!({ "name": "SSL_read", "address": "0x7200009a10", "type": "function" }),
            json!({ "name": "SSL_write", "address": "0x7200009bb0", "type": "function" }),
        ],
        _ => vec![
            json!({ "name": "login", "address": "0x7100011200", "type": "function" }),
            json!({ "name": "encrypt_payload", "address": "0x7100012400", "type": "function" }),
            json!({ "name": "gFeatureFlags", "address": "0x7100013300", "type": "variable" }),
        ],
    }
}

fn stub_module_imports(module_name: &str) -> Vec<Value> {
    if module_name == "libssl.so" {
        return Vec::new();
    }

    vec![
        json!({
            "name": "SSL_read",
            "address": "0x7100004110",
            "module": "libssl.so",
            "type": "function",
        }),
        json!({
            "name": "SSL_write",
            "address": "0x7100004190",
            "module": "libssl.so",
            "type": "function",
        }),
    ]
}

fn stub_threads() -> Vec<Value> {
    vec![
        json!({ "id": 1337, "name": "main", "state": "running" }),
        json!({ "id": 1448, "name": "RenderThread", "state": "waiting" }),
        json!({ "id": 1559, "name": "OkHttp Dispatcher", "state": "stopped" }),
    ]
}

fn stub_backtrace(thread_id: u64) -> Vec<Value> {
    match thread_id {
        1448 => vec![json!({
            "address": "0x7100012400",
            "moduleName": "libdemo.so",
            "symbolName": "encrypt_payload",
            "fileName": Value::Null,
            "lineNumber": Value::Null,
        })],
        1559 => Vec::new(),
        _ => vec![
            json!({
                "address": "0x7100011200",
                "moduleName": "libdemo.so",
                "symbolName": "login",
                "fileName": Value::Null,
                "lineNumber": Value::Null,
            }),
            json!({
                "address": "0x7200009bb0",
                "moduleName": "libssl.so",
                "symbolName": "SSL_write",
                "fileName": Value::Null,
                "lineNumber": Value::Null,
            }),
        ],
    }
}

fn stub_memory_ranges() -> Vec<Value> {
    vec![
        json!({
            "base": "0x7100000000",
            "size": 131_072,
            "protection": "r-x",
            "file": {
                "path": "/data/app/com.carf.demobank/lib/arm64/libdemo.so",
                "offset": 0,
                "size": 131_072,
            },
        }),
        json!({
            "base": "0x7100020000",
            "size": 65_536,
            "protection": "rw-",
            "file": {
                "path": "/data/app/com.carf.demobank/lib/arm64/libdemo.so",
                "offset": 131_072,
                "size": 65_536,
            },
        }),
        json!({
            "base": "0x7300000000",
            "size": 32_768,
            "protection": "r--",
        }),
    ]
}

fn build_hex_string(address: &str, size: usize) -> String {
    let normalized = address.trim_start_matches("0x");
    let last_byte = normalized
        .get(normalized.len().saturating_sub(2)..)
        .unwrap_or(normalized);
    let seed = u8::from_str_radix(last_byte, 16).unwrap_or_default();
    (0..size)
        .map(|index| format!("{:02x}", seed.wrapping_add(index as u8)))
        .collect::<String>()
}

fn evaluate_code(code: &str) -> String {
    match code.trim() {
        "2 + 2" | "2+2" => "4".to_string(),
        "" => "undefined".to_string(),
        value => format!("mock:{value}"),
    }
}

fn stub_java_classes() -> Vec<&'static str> {
    vec![
        "com.carf.demobank.LoginActivity",
        "com.carf.demobank.network.ApiClient",
        "com.carf.demobank.security.RootChecker",
    ]
}

fn stub_java_methods(class_name: &str, hooks: &[HookState]) -> Vec<Value> {
    let methods = match class_name {
        "com.carf.demobank.network.ApiClient" => vec![(
            "postTransfer",
            "java.lang.String",
            vec!["java.lang.String", "double"],
        )],
        "com.carf.demobank.security.RootChecker" => vec![("isDeviceRooted", "boolean", vec![])],
        _ => vec![
            (
                "submitLogin",
                "void",
                vec!["java.lang.String", "java.lang.String"],
            ),
            ("onCreate", "void", vec!["android.os.Bundle"]),
        ],
    };

    methods
        .into_iter()
        .map(|(name, return_type, argument_types)| {
            let target = format!("{class_name}.{name}");
            json!({
                "name": name,
                "returnType": return_type,
                "argumentTypes": argument_types,
                "isOverloaded": false,
                "hooked": hooks.iter().any(|hook| hook.hook_type == "java" && hook.target == target),
            })
        })
        .collect()
}

fn stub_java_fields(class_name: &str) -> Vec<Value> {
    match class_name {
        "com.carf.demobank.network.ApiClient" => vec![json!({
            "name": "baseUrl",
            "type": "java.lang.String",
            "value": "https://api.carf.app",
        })],
        "com.carf.demobank.security.RootChecker" => vec![json!({
            "name": "checksEnabled",
            "type": "boolean",
            "value": true,
        })],
        _ => vec![
            json!({ "name": "username", "type": "java.lang.String", "value": "demo@carf.app" }),
            json!({ "name": "loggedIn", "type": "boolean", "value": false }),
        ],
    }
}

fn stub_objc_classes() -> Vec<&'static str> {
    vec!["CARFLoginViewController", "CARFAPIClient", "CARFKeyStore"]
}

fn stub_objc_methods(class_name: &str, hooks: &[HookState]) -> Vec<Value> {
    let methods = match class_name {
        "CARFAPIClient" => vec![(
            "postTransfer:amount:",
            "instance",
            "id",
            vec!["id", "double"],
        )],
        "CARFKeyStore" => vec![("sharedStore", "class", "id", vec![])],
        _ => vec![
            ("viewDidLoad", "instance", "void", vec![]),
            ("submitLogin:", "instance", "void", vec!["id"]),
        ],
    };

    methods
        .into_iter()
        .map(|(selector, method_type, return_type, argument_types)| {
            let target = format!("{class_name} {selector}");
            json!({
                "selector": selector,
                "type": method_type,
                "returnType": return_type,
                "argumentTypes": argument_types,
                "hooked": hooks.iter().any(|hook| hook.hook_type == "objc" && hook.target == target),
            })
        })
        .collect()
}

fn filter_hooks(hooks: &[HookState], hook_type: &str) -> Vec<HookState> {
    hooks
        .iter()
        .filter(|hook| hook.hook_type == hook_type)
        .cloned()
        .collect()
}

fn set_hook_active(runtime: &mut SessionRuntimeState, hook_id: Option<&str>, active: bool) {
    if let Some(hook_id) = hook_id {
        if let Some(hook) = runtime.hooks.iter_mut().find(|hook| hook.id == hook_id) {
            hook.active = active;
        }
    }
}

fn stub_stalker_events(thread_id: u64) -> Vec<Value> {
    vec![
        json!({
            "threadId": thread_id,
            "type": "call",
            "from": "0x7100011200",
            "to": "0x7200009bb0",
            "fromModule": "libdemo.so",
            "toModule": "libssl.so",
            "fromSymbol": "login",
            "toSymbol": "SSL_write",
            "depth": 0,
        }),
        json!({
            "threadId": thread_id,
            "type": "ret",
            "from": "0x7200009bb0",
            "to": "0x7100011200",
            "fromModule": "libssl.so",
            "toModule": "libdemo.so",
            "fromSymbol": "SSL_write",
            "toSymbol": "login",
            "depth": 0,
        }),
    ]
}

fn stub_directory_entries(path: &str) -> Vec<Value> {
    match ensure_trailing_slash(path).as_str() {
        "/data/data/com.carf.demobank/" => vec![
            json!(directory_entry(
                "databases",
                "/data/data/com.carf.demobank/databases"
            )),
            json!(file_entry(
                "config.json",
                "/data/data/com.carf.demobank/config.json",
                154,
                "rw-r--r--"
            )),
            json!(file_entry(
                "session.txt",
                "/data/data/com.carf.demobank/session.txt",
                48,
                "rw-------"
            )),
        ],
        "/data/data/com.carf.demobank/databases/" => vec![
            json!(file_entry(
                "users.db",
                "/data/data/com.carf.demobank/databases/users.db",
                4096,
                "rw-------"
            )),
            json!(file_entry(
                "audit.sqlite",
                "/data/data/com.carf.demobank/databases/audit.sqlite",
                2048,
                "rw-------"
            )),
        ],
        "/data/data/shared/" => vec![json!(file_entry(
            "notes.xml",
            "/data/data/shared/notes.xml",
            96,
            "rw-r--r--"
        ))],
        _ => vec![
            json!(directory_entry(
                "com.carf.demobank",
                "/data/data/com.carf.demobank"
            )),
            json!(directory_entry("shared", "/data/data/shared")),
        ],
    }
}

fn ensure_trailing_slash(path: &str) -> String {
    if path == "/" || path.ends_with('/') {
        path.to_string()
    } else {
        format!("{path}/")
    }
}

fn directory_entry(name: &str, path: &str) -> Value {
    json!({
        "name": name,
        "path": path,
        "type": "directory",
        "size": 0,
        "permissions": "rwxr-xr-x",
        "modified": now_millis(),
    })
}

fn file_entry(name: &str, path: &str, size: u64, permissions: &str) -> Value {
    json!({
        "name": name,
        "path": path,
        "type": "file",
        "size": size,
        "permissions": permissions,
        "modified": now_millis(),
    })
}

fn stub_file_content(path: &str) -> String {
    match path {
        "/data/data/com.carf.demobank/config.json" => json!({
            "apiBaseUrl": "https://api.carf.app",
            "buildFlavor": "debug",
            "lastLoginUser": "demo@carf.app",
        })
        .to_string(),
        "/data/data/com.carf.demobank/session.txt" => {
            "sid=mock-session-token\nuser=demo@carf.app\n".to_string()
        }
        "/data/data/shared/notes.xml" => {
            "<notes><note id=\"1\">Rust bridge runtime</note></notes>".to_string()
        }
        _ => String::new(),
    }
}

fn stub_sqlite_tables(path: &str) -> Vec<&'static str> {
    match path {
        "/data/data/com.carf.demobank/databases/audit.sqlite" => vec!["events"],
        _ => vec!["users", "sessions"],
    }
}

fn stub_sqlite_query(query: &str) -> Value {
    let lower = query.to_lowercase();
    if lower.contains("from sessions") {
        json!({
            "columns": ["id", "user_id", "active"],
            "rows": [["sess_001", 1, 1], ["sess_002", 2, 0]],
        })
    } else if lower.contains("from events") {
        json!({
            "columns": ["id", "kind", "created_at"],
            "rows": [
                [1, "attach", "2026-03-10T08:57:00+09:00"],
                [2, "hook", "2026-03-10T08:58:30+09:00"],
            ],
        })
    } else {
        json!({
            "columns": ["id", "email", "role"],
            "rows": [
                [1, "demo@carf.app", "admin"],
                [2, "analyst@carf.app", "analyst"],
            ],
        })
    }
}

fn resolve_native_target_address(target: &str) -> &'static str {
    match target {
        "libssl.so!SSL_read" => "0x7200009a10",
        "libssl.so!SSL_write" => "0x7200009bb0",
        _ => "0x7100011200",
    }
}
