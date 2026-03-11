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

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::new().expect("failed to initialize CARF application state"))
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
            // Acquire the Frida service through the managed state
            let state = app_handle.state::<AppState>();
            if let Ok(mut svc) = state.frida_service.lock() {
                if let Ok(current_devices) = svc.list_devices() {
                    let current_ids: HashSet<String> =
                        current_devices.iter().map(|d| d.id.clone()).collect();

                    if let Ok(mut known) = known_ids.lock() {
                        // Emit added events for new devices
                        for device in &current_devices {
                            if !known.contains(&device.id) {
                                state.events.emit(
                                    "carf://device/added",
                                    serde_json::to_value(device).unwrap_or_default(),
                                );
                                log::info!("Device added: {} ({})", device.name, device.id);
                            }
                        }

                        // Emit removed events for disappeared devices
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
                }
            }

            // Poll every 2 seconds
            // TODO: replace with event-driven frida-rust signals
            std::thread::sleep(Duration::from_secs(2));
        }
    });
}
