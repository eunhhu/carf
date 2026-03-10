use std::collections::HashMap;

use serde::{Deserialize, Serialize};
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
}

impl FridaService {
    pub fn new() -> Self {
        // TODO: initialise Frida runtime here
        Self {
            _frida_stub: (),
            session_manager: SessionManager::new(),
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
        // TODO: enumerate real Frida devices
        log::debug!("FridaService::list_devices (stub)");
        Ok(vec![DeviceInfo {
            id: "local".to_string(),
            name: "Local System".to_string(),
            device_type: DeviceType::Local,
            icon: None,
            os: None,
            arch: None,
            status: DeviceStatus::Connected,
        }])
    }

    /// Connects to a remote Frida device by TCP address.
    ///
    /// TODO: replace stub with real frida-rust call:
    /// ```rust
    /// let device = self.device_manager.add_remote_device(address, None)?;
    /// ```
    pub fn add_remote_device(&self, address: &str) -> Result<DeviceInfo, AppError> {
        // Validate address format (host:port)
        if !address.contains(':') {
            return Err(AppError::InvalidAddress(address.to_string()));
        }
        // TODO: add via Frida DeviceManager
        log::info!("FridaService::add_remote_device({address}) (stub)");
        Ok(DeviceInfo {
            id: format!("remote-{address}"),
            name: address.to_string(),
            device_type: DeviceType::Remote,
            icon: None,
            os: None,
            arch: None,
            status: DeviceStatus::Connected,
        })
    }

    /// Removes a previously added remote device.
    ///
    /// TODO: replace stub with real frida-rust call:
    /// ```rust
    /// self.device_manager.remove_remote_device(address)?;
    /// ```
    pub fn remove_remote_device(&self, address: &str) -> Result<(), AppError> {
        // TODO: remove via Frida DeviceManager
        log::info!("FridaService::remove_remote_device({address}) (stub)");
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
        // TODO: enumerate real processes via Frida
        log::debug!("FridaService::list_processes({device_id}) (stub)");
        Ok(vec![])
    }

    /// Lists installed applications on the given device.
    ///
    /// TODO: replace stub with real frida-rust call:
    /// ```rust
    /// let device = self.get_frida_device(device_id)?;
    /// let apps = device.enumerate_applications(frida::ApplicationQueryOptions::default())?;
    /// ```
    pub fn list_applications(&self, device_id: &str) -> Result<Vec<AppInfo>, AppError> {
        // TODO: enumerate real applications via Frida
        log::debug!("FridaService::list_applications({device_id}) (stub)");
        Ok(vec![])
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
        let session_id = Uuid::new_v4().to_string();
        let info = SessionInfo {
            id: session_id.clone(),
            device_id: device_id.to_string(),
            pid: 0, // TODO: fill with real PID from frida spawn
            process_name: options.identifier.clone(),
            identifier: Some(options.identifier),
            status: SessionStatus::Active,
            mode: SessionMode::Spawn,
            arch: None,
            created_at: now_millis(),
        };

        self.session_manager.add(SessionHandle::new(info.clone()));
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
        let (pid, process_name) = match &options.target {
            serde_json::Value::Number(n) => (
                n.as_u64().unwrap_or(0) as u32,
                format!("pid-{}", n.as_u64().unwrap_or(0)),
            ),
            serde_json::Value::String(s) => (0u32, s.clone()),
            _ => (0u32, "unknown".to_string()),
        };

        let info = SessionInfo {
            id: session_id.clone(),
            device_id: device_id.to_string(),
            pid,
            process_name,
            identifier: None,
            status: SessionStatus::Active,
            mode: SessionMode::Attach,
            arch: None,
            created_at: now_millis(),
        };

        self.session_manager.add(SessionHandle::new(info.clone()));
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
        &self,
        session_id: &str,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, AppError> {
        // Verify session exists
        let _handle = self
            .session_manager
            .get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;

        log::debug!("FridaService::rpc_call({session_id}, {method}, {params}) (stub)");

        // TODO: call real frida script exports
        Err(AppError::AgentMethodNotFound(format!(
            "{method} (agent not yet loaded – stub mode)"
        )))
    }
}

impl Default for FridaService {
    fn default() -> Self {
        Self::new()
    }
}
