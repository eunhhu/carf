use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    // Device errors
    #[error("Device not found: {0}")]
    DeviceNotFound(String),

    #[error("Device disconnected: {0}")]
    DeviceDisconnected(String),

    // Process errors
    #[error("Process not found: {0}")]
    ProcessNotFound(String),

    // Session errors
    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Session expired: {0}")]
    SessionExpired(String),

    // Frida operation errors
    #[error("Spawn failed for '{0}': {1}")]
    SpawnFailed(String, String),

    #[error("Attach failed to '{0}': {1}")]
    AttachFailed(String, String),

    #[error("Script load failed: {0}")]
    ScriptLoadFailed(String),

    // Agent errors
    #[error("Agent RPC error: {0}")]
    AgentRpcError(String),

    #[error("Agent method not found: {0}")]
    AgentMethodNotFound(String),

    // ADB errors
    #[error("adb binary not found. Please install Android SDK platform-tools.")]
    AdbNotFound,

    #[error("ADB error: {0}")]
    AdbError(String),

    #[error("ADB device not found: {0}")]
    AdbDeviceNotFound(String),

    #[error("Root access required for this operation")]
    AdbRootRequired,

    // Network errors
    #[error("Connection failed to '{0}': {1}")]
    ConnectionFailed(String, String),

    #[error("Invalid address: {0}")]
    InvalidAddress(String),

    // Catch-all
    #[error("Internal error: {0}")]
    Internal(String),
}

/// Tauri requires commands to return serializable errors.
/// We serialize AppError as a JSON object with `code` and `message` fields.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(Some(2))?;
        map.serialize_entry("code", &self.error_code())?;
        map.serialize_entry("message", &self.to_string())?;
        map.end()
    }
}

impl AppError {
    fn error_code(&self) -> &'static str {
        match self {
            AppError::DeviceNotFound(_) => "DEVICE_NOT_FOUND",
            AppError::DeviceDisconnected(_) => "DEVICE_DISCONNECTED",
            AppError::ProcessNotFound(_) => "PROCESS_NOT_FOUND",
            AppError::SessionNotFound(_) => "SESSION_NOT_FOUND",
            AppError::SessionExpired(_) => "SESSION_EXPIRED",
            AppError::SpawnFailed(_, _) => "SPAWN_FAILED",
            AppError::AttachFailed(_, _) => "ATTACH_FAILED",
            AppError::ScriptLoadFailed(_) => "SCRIPT_LOAD_FAILED",
            AppError::AgentRpcError(_) => "AGENT_RPC_ERROR",
            AppError::AgentMethodNotFound(_) => "AGENT_METHOD_NOT_FOUND",
            AppError::AdbNotFound => "ADB_NOT_FOUND",
            AppError::AdbError(_) => "ADB_ERROR",
            AppError::AdbDeviceNotFound(_) => "ADB_DEVICE_NOT_FOUND",
            AppError::AdbRootRequired => "ADB_ROOT_REQUIRED",
            AppError::ConnectionFailed(_, _) => "CONNECTION_FAILED",
            AppError::InvalidAddress(_) => "INVALID_ADDRESS",
            AppError::Internal(_) => "INTERNAL_ERROR",
        }
    }
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}
