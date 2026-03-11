use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::broadcast;

use crate::services::{
    adb::AdbService,
    frida::{AppInfo, FridaService, ProcessInfo},
};

const LIST_CACHE_TTL: Duration = Duration::from_secs(3);

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

#[derive(Clone)]
struct CachedList<T> {
    items: Vec<T>,
    fetched_at: Instant,
}

#[derive(Default)]
pub struct ListCache {
    processes: HashMap<String, CachedList<ProcessInfo>>,
    applications: HashMap<String, CachedList<AppInfo>>,
}

impl ListCache {
    fn fresh<T>(entry: &CachedList<T>) -> bool {
        entry.fetched_at.elapsed() <= LIST_CACHE_TTL
    }

    pub fn get_processes(&self, device_id: &str) -> Option<Vec<ProcessInfo>> {
        self.processes
            .get(device_id)
            .filter(|entry| Self::fresh(entry))
            .map(|entry| entry.items.clone())
    }

    pub fn set_processes(&mut self, device_id: impl Into<String>, items: Vec<ProcessInfo>) {
        self.processes.insert(
            device_id.into(),
            CachedList {
                items,
                fetched_at: Instant::now(),
            },
        );
    }

    pub fn get_applications(&self, device_id: &str) -> Option<Vec<AppInfo>> {
        self.applications
            .get(device_id)
            .filter(|entry| Self::fresh(entry))
            .map(|entry| entry.items.clone())
    }

    pub fn set_applications(&mut self, device_id: impl Into<String>, items: Vec<AppInfo>) {
        self.applications.insert(
            device_id.into(),
            CachedList {
                items,
                fetched_at: Instant::now(),
            },
        );
    }

    pub fn invalidate_device(&mut self, device_id: &str) {
        self.processes.remove(device_id);
        self.applications.remove(device_id);
    }
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

/// Global application state managed by Tauri.
/// Each service is wrapped in a Mutex for thread-safe access from command handlers.
pub struct AppState {
    pub frida_service: Mutex<FridaService>,
    pub adb_service: Mutex<AdbService>,
    pub list_cache: Mutex<ListCache>,
    pub events: EventHub,
}

impl AppState {
    pub fn new() -> Result<Self, crate::error::AppError> {
        let events = EventHub::new();
        Ok(Self {
            frida_service: Mutex::new(FridaService::new(events.clone())?),
            adb_service: Mutex::new(AdbService::new()),
            list_cache: Mutex::new(ListCache::default()),
            events,
        })
    }
}
