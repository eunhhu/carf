mod commands;
mod error;
mod frida_service;
mod input_service;

use frida_service::FridaWorker;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize library storage with app data directory
            if let Ok(app_data_dir) = app.path().app_data_dir() {
                commands::library::init_library_storage(app_data_dir);
            }

            input_service::start_global_key_listener(app.handle().clone());
            app.manage(FridaWorker::new(app.handle().clone()));
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(commands::handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
