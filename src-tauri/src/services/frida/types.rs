use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub device_type: DeviceType,
    pub icon: Option<String>,
    pub os: Option<OsInfo>,
    pub arch: Option<String>,
    pub status: DeviceStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DeviceType {
    #[serde(rename = "local")]
    Local,
    #[serde(rename = "usb")]
    Usb,
    #[serde(rename = "remote")]
    Remote,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DeviceStatus {
    #[serde(rename = "connected")]
    Connected,
    #[serde(rename = "disconnected")]
    Disconnected,
    #[serde(rename = "pairing")]
    Pairing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OsInfo {
    pub platform: OsPlatform,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OsPlatform {
    #[serde(rename = "android")]
    Android,
    #[serde(rename = "ios")]
    Ios,
    #[serde(rename = "macos")]
    MacOs,
    #[serde(rename = "linux")]
    Linux,
    #[serde(rename = "windows")]
    Windows,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub identifier: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub identifier: String,
    pub name: String,
    pub pid: Option<u32>,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionPage<T> {
    pub items: Vec<T>,
    pub total: usize,
    pub limit: usize,
    pub truncated: bool,
    pub query: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnOptions {
    pub identifier: String,
    pub argv: Option<Vec<String>>,
    pub envp: Option<HashMap<String, String>>,
    pub cwd: Option<String>,
    pub stdio: Option<String>,
    pub auto_resume: Option<bool>,
    pub realm: Option<String>,
    pub persist_timeout: Option<u32>,
    pub runtime: Option<String>,
    pub enable_child_gating: Option<bool>,
    pub script_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachOptions {
    pub target: Value,
    pub realm: Option<String>,
    pub persist_timeout: Option<u32>,
    pub runtime: Option<String>,
    pub enable_child_gating: Option<bool>,
    pub script_path: Option<String>,
}
