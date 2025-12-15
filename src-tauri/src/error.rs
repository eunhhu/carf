use serde::Serialize;
use thiserror::Error;

/// Structured error types for Frida operations
#[derive(Debug, Error)]
pub enum FridaError {
    #[error("Device not found: {0}")]
    DeviceNotFound(String),

    #[error("Process not found: {0}")]
    ProcessNotFound(u32),

    #[error("Session not found: {0}")]
    SessionNotFound(u64),

    #[error("Script not found: {0}")]
    ScriptNotFound(u64),

    #[error("Attach failed: {0}")]
    AttachFailed(String),

    #[error("Detach failed: {0}")]
    DetachFailed(String),

    #[error("Script load failed: {0}")]
    ScriptLoadFailed(String),

    #[error("Script unload failed: {0}")]
    ScriptUnloadFailed(String),

    #[error("Spawn failed: {0}")]
    SpawnFailed(String),

    #[error("Resume failed: {0}")]
    ResumeFailed(String),

    #[error("Kill failed: {0}")]
    KillFailed(String),

    #[error("RPC call failed: {0}")]
    RpcFailed(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Operation timed out")]
    Timeout,

    #[error("Internal error: {0}")]
    Internal(String),
}

/// Serializable error response for frontend
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl From<FridaError> for ErrorResponse {
    fn from(err: FridaError) -> Self {
        let code = match &err {
            FridaError::DeviceNotFound(_) => "DEVICE_NOT_FOUND",
            FridaError::ProcessNotFound(_) => "PROCESS_NOT_FOUND",
            FridaError::SessionNotFound(_) => "SESSION_NOT_FOUND",
            FridaError::ScriptNotFound(_) => "SCRIPT_NOT_FOUND",
            FridaError::AttachFailed(_) => "ATTACH_FAILED",
            FridaError::DetachFailed(_) => "DETACH_FAILED",
            FridaError::ScriptLoadFailed(_) => "SCRIPT_LOAD_FAILED",
            FridaError::ScriptUnloadFailed(_) => "SCRIPT_UNLOAD_FAILED",
            FridaError::SpawnFailed(_) => "SPAWN_FAILED",
            FridaError::ResumeFailed(_) => "RESUME_FAILED",
            FridaError::KillFailed(_) => "KILL_FAILED",
            FridaError::RpcFailed(_) => "RPC_FAILED",
            FridaError::InvalidInput(_) => "INVALID_INPUT",
            FridaError::Timeout => "TIMEOUT",
            FridaError::Internal(_) => "INTERNAL_ERROR",
        };

        ErrorResponse {
            code: code.to_string(),
            message: err.to_string(),
            details: None,
        }
    }
}

impl From<FridaError> for String {
    fn from(err: FridaError) -> Self {
        err.to_string()
    }
}

/// Validate that a string doesn't contain NUL bytes (required for C FFI)
pub fn validate_no_nul(field: &str, value: &str) -> Result<(), FridaError> {
    if value.contains('\0') {
        Err(FridaError::InvalidInput(format!(
            "{} cannot contain NUL bytes",
            field
        )))
    } else {
        Ok(())
    }
}
