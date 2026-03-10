use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

/// Calls an RPC method on the CARF Std agent running inside the target process.
///
/// `params` is forwarded as-is to the agent's RPC handler.
/// Returns the JSON value produced by the agent method.
#[tauri::command]
pub fn rpc_call(
    state: State<'_, AppState>,
    session_id: String,
    method: String,
    params: serde_json::Value,
) -> Result<serde_json::Value, AppError> {
    let svc = state
        .frida_service
        .lock()
        .map_err(|_| AppError::Internal("frida_service lock poisoned".to_string()))?;
    svc.rpc_call(&session_id, &method, params)
}
