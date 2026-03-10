use std::sync::Mutex;

use crate::services::{adb::AdbService, frida::FridaService};

/// Global application state managed by Tauri.
/// Each service is wrapped in a Mutex for thread-safe access from command handlers.
pub struct AppState {
    pub frida_service: Mutex<FridaService>,
    pub adb_service: Mutex<AdbService>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            frida_service: Mutex::new(FridaService::new()),
            adb_service: Mutex::new(AdbService::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
