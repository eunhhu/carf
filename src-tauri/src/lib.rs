mod api;
mod commands;
mod error;
mod services;
mod state;
mod web_bridge;

use commands::{
    adb::{
        adb_connect, adb_device_props, adb_devices, adb_install_apk, adb_is_frida_running,
        adb_pair, adb_push_frida_server, adb_shell, adb_start_frida_server, adb_stop_frida_server,
    },
    agent::{rpc_call, rpc_call_chunked},
    ai::ai_chat,
    device::{add_remote_device, get_device_info, list_devices, remove_remote_device},
    process::{kill_process, list_applications, list_processes},
    session::{attach, detach, list_sessions, resume, spawn_and_attach},
};
use state::AppState;
use tauri::{Emitter, Manager};

pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let app_state = match AppState::new() {
        Ok(state) => state,
        Err(error) => {
            // Surface a clear error to the user instead of a raw panic backtrace.
            let message = format!(
                "CARF failed to initialise: {error}\n\n\
                 This usually means Frida could not locate a device manager.\n\
                 Reinstall the app or file an issue with the log above."
            );
            log::error!("{message}");
            eprintln!("{message}");
            std::process::exit(1);
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .setup(|app| {
            setup_event_forwarder(app);
            setup_device_change_listener(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Device commands
            list_devices,
            add_remote_device,
            remove_remote_device,
            get_device_info,
            // Process commands
            list_processes,
            list_applications,
            kill_process,
            // Session commands
            spawn_and_attach,
            attach,
            detach,
            resume,
            list_sessions,
            // Agent commands
            rpc_call,
            rpc_call_chunked,
            // AI commands
            ai_chat,
            // ADB commands
            adb_devices,
            adb_device_props,
            adb_push_frida_server,
            adb_start_frida_server,
            adb_stop_frida_server,
            adb_is_frida_running,
            adb_shell,
            adb_install_apk,
            adb_pair,
            adb_connect,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CARF application");
}

pub async fn run_web_bridge() -> anyhow::Result<()> {
    web_bridge::run().await
}

fn setup_event_forwarder(app: &tauri::App) {
    let app_handle = app.handle().clone();
    let state = app.state::<AppState>();
    let mut receiver = state.events.subscribe();

    tauri::async_runtime::spawn(async move {
        loop {
            match receiver.recv().await {
                Ok(event) => {
                    let _ = app_handle.emit(&event.name, event.payload);
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
            }
        }
    });
}

/// Sets up a background task that polls Frida for device changes and emits
/// `carf://device/added` and `carf://device/removed` events to the frontend.
///
/// TODO: Replace the polling stub with real frida-rust DeviceManager signal
/// subscriptions once the frida-rust integration is in place:
/// ```text
/// device_manager.connect_signal::<frida::DeviceAddedHandler>(...);
/// device_manager.connect_signal::<frida::DeviceRemovedHandler>(...);
/// ```
fn setup_device_change_listener(app: &tauri::App) {
    use std::collections::HashSet;
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    let app_handle = app.handle().clone();
    let known_ids: Arc<Mutex<HashSet<String>>> = Arc::new(Mutex::new(HashSet::new()));

    std::thread::spawn(move || {
        // Give the app a moment to finish initialising before the first poll
        std::thread::sleep(Duration::from_millis(500));

        loop {
            // Acquire the Frida service through the managed state. Recover from
            // poisoned locks rather than silently dropping the polling loop --
            // otherwise a panic inside any other Frida command would stop all
            // future device change notifications without any user-visible sign.
            let state = app_handle.state::<AppState>();
            let svc_guard = match state.frida_service.lock() {
                Ok(guard) => Some(guard),
                Err(poisoned) => {
                    log::warn!(
                        "frida_service mutex was poisoned during device listener poll; recovering"
                    );
                    Some(poisoned.into_inner())
                }
            };

            if let Some(mut svc) = svc_guard {
                match svc.list_devices() {
                    Ok(current_devices) => {
                        let current_ids: HashSet<String> =
                            current_devices.iter().map(|d| d.id.clone()).collect();

                        let mut known = match known_ids.lock() {
                            Ok(guard) => guard,
                            Err(poisoned) => {
                                log::warn!(
                                    "device listener known_ids mutex was poisoned; recovering"
                                );
                                poisoned.into_inner()
                            }
                        };

                        for device in &current_devices {
                            if !known.contains(&device.id) {
                                state.events.emit(
                                    "carf://device/added",
                                    serde_json::to_value(device).unwrap_or_default(),
                                );
                                log::info!("Device added: {} ({})", device.name, device.id);
                            }
                        }

                        for id in known.iter() {
                            if !current_ids.contains(id) {
                                state
                                    .events
                                    .emit("carf://device/removed", serde_json::json!(id));
                                log::info!("Device removed: {id}");
                            }
                        }

                        *known = current_ids;
                    }
                    Err(error) => {
                        log::debug!("device listener list_devices failed: {error}");
                    }
                }
            }

            // Poll every 2 seconds
            // TODO: replace with event-driven frida-rust signals
            std::thread::sleep(Duration::from_secs(2));
        }
    });
}
