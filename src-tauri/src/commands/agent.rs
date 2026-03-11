use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::api;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RpcChunkEvent {
    request_id: String,
    phase: &'static str,
    is_array: bool,
    chunk_index: usize,
    total_chunks: usize,
    data: Option<serde_json::Value>,
}

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

#[tauri::command]
pub fn rpc_call_chunked(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    method: String,
    params: serde_json::Value,
    request_id: String,
    chunk_size: Option<usize>,
) -> Result<(), AppError> {
    let result = api::rpc_call(&state, session_id, method, params)?;
    let chunk_size = chunk_size.unwrap_or(128).clamp(1, 1_000);

    match result {
        serde_json::Value::Array(items) => {
            if items.is_empty() {
                app.emit(
                    "carf://rpc/chunk",
                    RpcChunkEvent {
                        request_id,
                        phase: "complete",
                        is_array: true,
                        chunk_index: 0,
                        total_chunks: 0,
                        data: None,
                    },
                )
                .map_err(|error| AppError::Internal(error.to_string()))?;
                return Ok(());
            }

            let total_chunks = items.len().div_ceil(chunk_size);
            for (chunk_index, chunk) in items.chunks(chunk_size).enumerate() {
                app.emit(
                    "carf://rpc/chunk",
                    RpcChunkEvent {
                        request_id: request_id.clone(),
                        phase: "chunk",
                        is_array: true,
                        chunk_index,
                        total_chunks,
                        data: Some(serde_json::Value::Array(chunk.to_vec())),
                    },
                )
                .map_err(|error| AppError::Internal(error.to_string()))?;
            }

            app.emit(
                "carf://rpc/chunk",
                RpcChunkEvent {
                    request_id,
                    phase: "complete",
                    is_array: true,
                    chunk_index: total_chunks,
                    total_chunks,
                    data: None,
                },
            )
            .map_err(|error| AppError::Internal(error.to_string()))?;
        }
        value => {
            app.emit(
                "carf://rpc/chunk",
                RpcChunkEvent {
                    request_id: request_id.clone(),
                    phase: "chunk",
                    is_array: false,
                    chunk_index: 0,
                    total_chunks: 1,
                    data: Some(value),
                },
            )
            .map_err(|error| AppError::Internal(error.to_string()))?;
            app.emit(
                "carf://rpc/chunk",
                RpcChunkEvent {
                    request_id,
                    phase: "complete",
                    is_array: false,
                    chunk_index: 1,
                    total_chunks: 1,
                    data: None,
                },
            )
            .map_err(|error| AppError::Internal(error.to_string()))?;
        }
    }

    Ok(())
}
