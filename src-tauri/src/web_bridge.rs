use std::convert::Infallible;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;

use async_stream::stream;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{Html, IntoResponse};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use tower_http::cors::{AllowOrigin, Any, CorsLayer};

use crate::api;
use crate::error::AppError;
use crate::services::ai::{self, AiChatRequest};
use crate::services::frida::{AttachOptions, SpawnOptions};
use crate::state::{AppState, BridgeEvent};

/// RPC methods that execute arbitrary JavaScript inside the Frida agent.
/// These must never be callable through the HTTP bridge unless the operator
/// has explicitly opted in via `CARF_ALLOW_EVAL=1`, since the bridge is
/// reachable from any process on the local machine.
const EVAL_METHODS: &[&str] = &["evaluate", "eval", "runScript", "loadScript"];

fn bridge_auth_token() -> Option<String> {
    std::env::var("CARF_BRIDGE_TOKEN").ok().and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn check_bridge_auth(headers: &HeaderMap) -> Result<(), StatusCode> {
    let Some(expected) = bridge_auth_token() else {
        return Ok(());
    };
    let provided = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(|value| value.trim());
    match provided {
        Some(token) if token == expected => Ok(()),
        _ => Err(StatusCode::UNAUTHORIZED),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeviceIdArgs {
    device_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListQueryArgs {
    device_id: String,
    query: Option<String>,
    limit: Option<usize>,
    force_refresh: Option<bool>,
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
    let state = Arc::new(AppState::new()?);

    // Only allow requests from the local Vite dev server and loopback origins.
    // Opening this to `Any` would let any webpage the user happens to visit drive
    // Frida/ADB on their local machine, which would be a sandbox escape for the
    // instrumentation backend.
    let cors_origins = std::env::var("CARF_BRIDGE_CORS_ORIGINS")
        .ok()
        .map(|raw| {
            raw.split(',')
                .filter_map(|value| value.trim().parse().ok())
                .collect::<Vec<_>>()
        })
        .filter(|list| !list.is_empty())
        .unwrap_or_else(|| {
            vec![
                "http://localhost:1420".parse().unwrap(),
                "http://127.0.0.1:1420".parse().unwrap(),
                "http://localhost:7766".parse().unwrap(),
                "http://127.0.0.1:7766".parse().unwrap(),
            ]
        });

    let app = Router::new()
        .route("/", get(index))
        .route("/api/health", get(health))
        .route("/api/events", get(events))
        .route("/api/invoke/{command}", post(invoke))
        .layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::list(cors_origins))
                .allow_headers(Any)
                .allow_methods(Any),
        )
        .with_state(state);

    let address = std::env::var("CARF_BRIDGE_ADDR")
        .ok()
        .and_then(|value| value.parse::<SocketAddr>().ok())
        .unwrap_or_else(|| SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 7766));

    // Refuse to bind on non-loopback interfaces unless the operator has
    // explicitly opted in. The bridge exposes full Frida/ADB control — exposing
    // it on a LAN address by accident would hand the host over to anyone on the
    // same network.
    if !address.ip().is_loopback()
        && std::env::var("CARF_BRIDGE_ALLOW_PUBLIC")
            .map(|v| v != "1" && !v.eq_ignore_ascii_case("true"))
            .unwrap_or(true)
    {
        anyhow::bail!(
            "CARF_BRIDGE_ADDR={address} is not a loopback address. Set CARF_BRIDGE_ALLOW_PUBLIC=1 and configure CARF_BRIDGE_TOKEN to expose the bridge."
        );
    }
    if !address.ip().is_loopback() && bridge_auth_token().is_none() {
        anyhow::bail!(
            "CARF_BRIDGE_ADDR={address} is not loopback but CARF_BRIDGE_TOKEN is not set. Refusing to start an unauthenticated public bridge."
        );
    }

    log::info!("Starting CARF Axum bridge on http://{address}");
    let listener = tokio::net::TcpListener::bind(address).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn index() -> Html<&'static str> {
    Html(
        r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CARF Axum Bridge</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23060b13'/%3E%3Cpath d='M10 10h12v4H14v4h6v4h-6v2h-4z' fill='%239ed0ff'/%3E%3C/svg%3E" />
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, system-ui, sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background:
          radial-gradient(circle at top, rgba(31, 133, 255, 0.18), transparent 40%),
          linear-gradient(180deg, #0a0f19, #06080d);
        color: #ecf3ff;
      }
      main {
        width: min(720px, calc(100vw - 32px));
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        background: rgba(8, 13, 22, 0.9);
        box-shadow: 0 20px 80px rgba(0, 0, 0, 0.45);
        padding: 28px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 28px;
      }
      p {
        margin: 0 0 18px;
        color: #a8b4c7;
        line-height: 1.5;
      }
      ul {
        margin: 0;
        padding-left: 20px;
      }
      li + li {
        margin-top: 10px;
      }
      code {
        color: #9ed0ff;
        font-family: "JetBrains Mono", ui-monospace, monospace;
      }
      a {
        color: #9ed0ff;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>CARF Axum Bridge</h1>
      <p>
        The bridge is running. Open the frontend with <code>bun run dev</code> and keep this
        process alive, or call the API endpoints directly.
      </p>
      <ul>
        <li><a href="/api/health"><code>GET /api/health</code></a> for a quick health check</li>
        <li><code>GET /api/events</code> for the SSE event stream</li>
        <li><code>POST /api/invoke/&lt;command&gt;</code> for backend commands</li>
      </ul>
    </main>
  </body>
</html>"#,
    )
}

async fn health() -> Json<Value> {
    Json(json!({ "ok": true }))
}

async fn invoke(
    State(state): State<Arc<AppState>>,
    Path(command): Path<String>,
    headers: HeaderMap,
    Json(args): Json<Value>,
) -> impl IntoResponse {
    if let Err(status) = check_bridge_auth(&headers) {
        return (status, Json(json!({ "error": "unauthorized" }))).into_response();
    }

    // Frida, ADB, and AI CLI calls are all blocking, so we must not run them on the
    // Tokio reactor thread. spawn_blocking moves the work onto a dedicated pool so
    // SSE streams and other concurrent requests stay responsive.
    let result = tokio::task::spawn_blocking(move || dispatch(&state, &command, args))
        .await
        .unwrap_or_else(|join_error| {
            Err(AppError::Internal(format!(
                "bridge dispatch task panicked: {join_error}"
            )))
        });

    match result {
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
    headers: HeaderMap,
) -> impl IntoResponse {
    if check_bridge_auth(&headers).is_err() {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "unauthorized" })),
        )
            .into_response();
    }
    event_stream(state).into_response()
}

fn event_stream(
    state: Arc<AppState>,
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
            let args: ListQueryArgs = parse_args(args)?;
            Ok(
                serde_json::to_value(api::list_processes(
                    state,
                    args.device_id,
                    args.query,
                    args.limit,
                    args.force_refresh,
                )?)
                    .map_err(|error| AppError::Internal(error.to_string()))?,
            )
        }
        "list_applications" => {
            let args: ListQueryArgs = parse_args(args)?;
            Ok(
                serde_json::to_value(api::list_applications(
                    state,
                    args.device_id,
                    args.query,
                    args.limit,
                    args.force_refresh,
                )?)
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
            if EVAL_METHODS.contains(&args.method.as_str())
                && std::env::var("CARF_ALLOW_EVAL")
                    .map(|v| v != "1" && !v.eq_ignore_ascii_case("true"))
                    .unwrap_or(true)
            {
                return Err(AppError::Internal(format!(
                    "rpc method '{}' is disabled on the HTTP bridge. Set CARF_ALLOW_EVAL=1 to enable.",
                    args.method
                )));
            }
            api::rpc_call(state, args.session_id, args.method, args.params)
        }
        "ai_chat" => {
            // ai_chat shells out to the local `claude`/`codex` CLI, which can
            // execute arbitrary commands on behalf of the bridge user. Only
            // expose it when the operator explicitly opts in.
            if std::env::var("CARF_ALLOW_BRIDGE_AI")
                .map(|v| v != "1" && !v.eq_ignore_ascii_case("true"))
                .unwrap_or(true)
            {
                return Err(AppError::Internal(
                    "ai_chat is disabled on the HTTP bridge. Set CARF_ALLOW_BRIDGE_AI=1 to enable."
                        .to_string(),
                ));
            }
            let request: AiChatRequest = parse_args(args)?;
            let response = ai::chat(&request)?;
            serde_json::to_value(response)
                .map_err(|error| AppError::Internal(error.to_string()))
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
