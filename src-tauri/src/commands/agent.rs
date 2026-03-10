use tauri::State;

use crate::api;
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
    api::rpc_call(&state, session_id, method, params)
}
