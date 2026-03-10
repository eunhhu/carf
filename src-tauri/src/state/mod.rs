use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::broadcast;

use crate::services::{adb::AdbService, frida::FridaService};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeEvent {
    pub name: String,
    pub payload: Value,
}

#[derive(Clone)]
pub struct EventHub {
    sender: broadcast::Sender<BridgeEvent>,
}

impl EventHub {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(256);
        Self { sender }
    }

    pub fn emit(&self, name: impl Into<String>, payload: Value) {
        let _ = self.sender.send(BridgeEvent {
            name: name.into(),
            payload,
        });
    }

    pub fn subscribe(&self) -> broadcast::Receiver<BridgeEvent> {
        self.sender.subscribe()
    }
}

impl Default for EventHub {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Default)]
pub struct BridgeRuntime {
    pub network_capture_flags: HashMap<String, Arc<AtomicBool>>,
    pub stalker_flags: HashMap<String, Arc<AtomicBool>>,
}

impl BridgeRuntime {
    pub fn stop_session(&mut self, session_id: &str) {
        if let Some(flag) = self.network_capture_flags.remove(session_id) {
            flag.store(true, Ordering::SeqCst);
        }

        let matching_keys: Vec<String> = self
            .stalker_flags
            .keys()
            .filter(|key| key.starts_with(&format!("{session_id}:")))
            .cloned()
            .collect();

        for key in matching_keys {
            if let Some(flag) = self.stalker_flags.remove(&key) {
                flag.store(true, Ordering::SeqCst);
            }
        }
    }
}

/// Global application state managed by Tauri.
/// Each service is wrapped in a Mutex for thread-safe access from command handlers.
pub struct AppState {
    pub frida_service: Mutex<FridaService>,
    pub adb_service: Mutex<AdbService>,
    pub events: EventHub,
    pub bridge_runtime: Mutex<BridgeRuntime>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            frida_service: Mutex::new(FridaService::new()),
            adb_service: Mutex::new(AdbService::new()),
            events: EventHub::new(),
            bridge_runtime: Mutex::new(BridgeRuntime::default()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
