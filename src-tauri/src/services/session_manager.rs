use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Mirrors frontend `SessionInfo.status`
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SessionStatus {
    Active,
    Paused,
    Detached,
    Crashed,
}

/// Mirrors frontend `SessionInfo`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: String,
    pub device_id: String,
    pub pid: u32,
    pub process_name: String,
    pub identifier: Option<String>,
    pub status: SessionStatus,
    pub mode: SessionMode,
    pub arch: Option<String>,
    pub created_at: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SessionMode {
    Spawn,
    Attach,
}

/// Internal handle that owns the live Frida session and script objects.
/// The frida-rust types are stored as raw pointers / opaque stubs until
/// the real frida-rust integration is wired up (see TODO comments in FridaService).
pub struct SessionHandle {
    pub info: SessionInfo,
    /// TODO: replace with actual `frida::Session` once frida-rust is integrated
    pub _frida_session_stub: (),
    /// TODO: replace with actual `frida::Script` once frida-rust is integrated
    pub script: Option<()>,
}

impl SessionHandle {
    pub fn new(info: SessionInfo) -> Self {
        Self {
            info,
            _frida_session_stub: (),
            script: None,
        }
    }
}

/// Manages the in-process session pool.
pub struct SessionManager {
    sessions: HashMap<String, SessionHandle>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn add(&mut self, handle: SessionHandle) {
        self.sessions.insert(handle.info.id.clone(), handle);
    }

    pub fn get(&self, session_id: &str) -> Option<&SessionHandle> {
        self.sessions.get(session_id)
    }

    pub fn get_mut(&mut self, session_id: &str) -> Option<&mut SessionHandle> {
        self.sessions.get_mut(session_id)
    }

    pub fn remove(&mut self, session_id: &str) -> Option<SessionHandle> {
        self.sessions.remove(session_id)
    }

    pub fn list(&self) -> Vec<SessionInfo> {
        self.sessions.values().map(|h| h.info.clone()).collect()
    }

    pub fn update_status(
        &mut self,
        session_id: &str,
        status: SessionStatus,
    ) -> Result<(), AppError> {
        let handle = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))?;
        handle.info.status = status;
        Ok(())
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

pub fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
