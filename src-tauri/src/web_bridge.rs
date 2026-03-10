use std::convert::Infallible;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;

use async_stream::stream;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use tower_http::cors::{Any, CorsLayer};

use crate::api;
use crate::error::AppError;
use crate::services::frida::{AttachOptions, SpawnOptions};
use crate::state::{AppState, BridgeEvent};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeviceIdArgs {
    device_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KillProcessArgs {
    device_id: String,
    pid: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionIdArgs {
    session_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddressArgs {
    address: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AttachArgs {
    device_id: String,
    options: AttachOptions,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SpawnArgs {
    device_id: String,
    options: SpawnOptions,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RpcCallArgs {
    session_id: String,
    method: String,
    params: Value,
}

pub async fn run() -> anyhow::Result<()> {
    let state = Arc::new(AppState::new());
    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/events", get(events))
        .route("/api/invoke/{command}", post(invoke))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_headers(Any)
                .allow_methods(Any),
        )
        .with_state(state);

    let address = std::env::var("CARF_BRIDGE_ADDR")
        .ok()
        .and_then(|value| value.parse::<SocketAddr>().ok())
        .unwrap_or_else(|| SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 7766));

    log::info!("Starting CARF Axum bridge on http://{address}");
    let listener = tokio::net::TcpListener::bind(address).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health() -> Json<Value> {
    Json(json!({ "ok": true }))
}

async fn invoke(
    State(state): State<Arc<AppState>>,
    Path(command): Path<String>,
    Json(args): Json<Value>,
) -> impl IntoResponse {
    match dispatch(&state, &command, args) {
        Ok(data) => (StatusCode::OK, Json(json!({ "data": data }))).into_response(),
        Err(error) => (
            status_code_for_error(&error),
            Json(json!({ "error": error })),
        )
            .into_response(),
    }
}

async fn events(
    State(state): State<Arc<AppState>>,
) -> Sse<impl futures_core::Stream<Item = Result<Event, Infallible>>> {
    let mut receiver = state.events.subscribe();

    let stream = stream! {
        loop {
            match receiver.recv().await {
                Ok(event) => {
                    yield Ok(to_sse_event(event));
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
            }
        }
    };

    Sse::new(stream).keep_alive(KeepAlive::default())
}

fn to_sse_event(event: BridgeEvent) -> Event {
    Event::default()
        .event(event.name)
        .data(serde_json::to_string(&event.payload).unwrap_or_else(|_| "null".to_string()))
}

fn dispatch(state: &AppState, command: &str, args: Value) -> Result<Value, AppError> {
    match command {
        "list_devices" => Ok(serde_json::to_value(api::list_devices(state)?)
            .map_err(|error| AppError::Internal(error.to_string()))?),
        "add_remote_device" => {
            let args: AddressArgs = parse_args(args)?;
            Ok(
                serde_json::to_value(api::add_remote_device(state, args.address)?)
                    .map_err(|error| AppError::Internal(error.to_string()))?,
            )
        }
        "remove_remote_device" => {
            let args: AddressArgs = parse_args(args)?;
            api::remove_remote_device(state, args.address)?;
            Ok(Value::Null)
        }
        "get_device_info" => {
            let args: DeviceIdArgs = parse_args(args)?;
            Ok(
                serde_json::to_value(api::get_device_info(state, args.device_id)?)
                    .map_err(|error| AppError::Internal(error.to_string()))?,
            )
        }
        "list_processes" => {
            let args: DeviceIdArgs = parse_args(args)?;
            Ok(
                serde_json::to_value(api::list_processes(state, args.device_id)?)
                    .map_err(|error| AppError::Internal(error.to_string()))?,
            )
        }
        "list_applications" => {
            let args: DeviceIdArgs = parse_args(args)?;
            Ok(
                serde_json::to_value(api::list_applications(state, args.device_id)?)
                    .map_err(|error| AppError::Internal(error.to_string()))?,
            )
        }
        "kill_process" => {
            let args: KillProcessArgs = parse_args(args)?;
            api::kill_process(state, args.device_id, args.pid)?;
            Ok(Value::Null)
        }
        "attach" => {
            let args: AttachArgs = parse_args(args)?;
            Ok(
                serde_json::to_value(api::attach(state, args.device_id, args.options)?)
                    .map_err(|error| AppError::Internal(error.to_string()))?,
            )
        }
        "spawn_and_attach" => {
            let args: SpawnArgs = parse_args(args)?;
            Ok(
                serde_json::to_value(api::spawn_and_attach(state, args.device_id, args.options)?)
                    .map_err(|error| AppError::Internal(error.to_string()))?,
            )
        }
        "detach" => {
            let args: SessionIdArgs = parse_args(args)?;
            api::detach(state, args.session_id)?;
            Ok(Value::Null)
        }
        "resume" => {
            let args: SessionIdArgs = parse_args(args)?;
            api::resume(state, args.session_id)?;
            Ok(Value::Null)
        }
        "list_sessions" => Ok(serde_json::to_value(api::list_sessions(state)?)
            .map_err(|error| AppError::Internal(error.to_string()))?),
        "rpc_call" => {
            let args: RpcCallArgs = parse_args(args)?;
            api::rpc_call(state, args.session_id, args.method, args.params)
        }
        _ => Err(AppError::Internal(format!(
            "Unsupported bridge command: {command}"
        ))),
    }
}

fn parse_args<T>(args: Value) -> Result<T, AppError>
where
    T: for<'de> Deserialize<'de>,
{
    serde_json::from_value(args).map_err(|error| AppError::Internal(error.to_string()))
}

fn status_code_for_error(error: &AppError) -> StatusCode {
    match error {
        AppError::DeviceNotFound(_)
        | AppError::ProcessNotFound(_)
        | AppError::SessionNotFound(_)
        | AppError::AdbDeviceNotFound(_) => StatusCode::NOT_FOUND,
        AppError::InvalidAddress(_) => StatusCode::BAD_REQUEST,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    }
}
