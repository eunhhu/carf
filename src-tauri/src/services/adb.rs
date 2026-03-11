use std::collections::HashMap;
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::services::frida::{AppInfo, ProcessInfo};

// ─── ADB types ────────────────────────────────────────────────────────────────

/// Mirrors frontend `AdbDevice`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbDevice {
    pub serial: String,
    pub state: String,
    pub model: String,
    pub product: String,
    pub transport_id: u32,
}

/// Mirrors frontend `DeviceProps`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceProps {
    pub model: String,
    pub manufacturer: String,
    pub android_version: String,
    pub sdk_version: u32,
    pub abi: String,
    pub security_patch: String,
    pub build_id: String,
    pub is_rooted: bool,
    pub selinux_status: String,
}

// ─── AdbService ───────────────────────────────────────────────────────────────

pub struct AdbService;

impl AdbService {
    pub fn new() -> Self {
        Self
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /// Runs an adb command and returns stdout as a String.
    fn run(&self, args: &[&str]) -> Result<String, AppError> {
        let output = Command::new("adb").args(args).output().map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                AppError::AdbNotFound
            } else {
                AppError::AdbError(e.to_string())
            }
        })?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).into_owned())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
            Err(AppError::AdbError(stderr))
        }
    }

    /// Runs an adb command targeting a specific device serial.
    fn run_on(&self, serial: &str, args: &[&str]) -> Result<String, AppError> {
        let mut full_args = vec!["-s", serial];
        full_args.extend_from_slice(args);
        self.run(&full_args)
    }

    /// Reads a single Android system property from a device.
    fn getprop(&self, serial: &str, prop: &str) -> Result<String, AppError> {
        let out = self.run_on(serial, &["shell", "getprop", prop])?;
        Ok(out.trim().to_string())
    }

    fn infer_process_identifier(process: &ProcessInfo) -> Option<&str> {
        process.identifier.as_deref().or_else(|| {
            if process.name.contains('.') {
                Some(process.name.as_str())
            } else {
                None
            }
        })
    }

    fn parse_package_identifier(line: &str) -> Option<&str> {
        let package = line.trim().strip_prefix("package:")?;
        let identifier = package
            .split_once('=')
            .map(|(_, identifier)| identifier)
            .unwrap_or(package)
            .trim();

        if identifier.is_empty() {
            None
        } else {
            Some(identifier)
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /// Lists all devices visible to `adb devices -l`.
    pub fn list_devices(&self) -> Result<Vec<AdbDevice>, AppError> {
        let output = self.run(&["devices", "-l"])?;
        let mut devices = Vec::new();
        let mut transport_counter: u32 = 1;

        for line in output.lines().skip(1) {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 2 {
                continue;
            }

            let serial = parts[0].to_string();
            let state = parts[1].to_string();

            // Parse key=value pairs from the rest of the line
            let mut model = String::new();
            let mut product = String::new();
            for part in &parts[2..] {
                if let Some(val) = part.strip_prefix("model:") {
                    model = val.to_string();
                } else if let Some(val) = part.strip_prefix("product:") {
                    product = val.to_string();
                }
            }

            devices.push(AdbDevice {
                serial,
                state,
                model,
                product,
                transport_id: transport_counter,
            });
            transport_counter += 1;
        }

        Ok(devices)
    }

    /// Reads common system properties from a device.
    pub fn device_props(&self, serial: &str) -> Result<DeviceProps, AppError> {
        let model = self.getprop(serial, "ro.product.model").unwrap_or_default();
        let manufacturer = self
            .getprop(serial, "ro.product.manufacturer")
            .unwrap_or_default();
        let android_version = self
            .getprop(serial, "ro.build.version.release")
            .unwrap_or_default();
        let sdk_str = self
            .getprop(serial, "ro.build.version.sdk")
            .unwrap_or_default();
        let sdk_version: u32 = sdk_str.parse().unwrap_or(0);
        let abi = self
            .getprop(serial, "ro.product.cpu.abi")
            .unwrap_or_default();
        let security_patch = self
            .getprop(serial, "ro.build.version.security_patch")
            .unwrap_or_default();
        let build_id = self.getprop(serial, "ro.build.id").unwrap_or_default();

        // Naive root check: look for su binary in common locations
        let su_check = self
            .run_on(serial, &["shell", "which", "su"])
            .unwrap_or_default();
        let is_rooted = su_check.contains("/su");

        // SELinux status
        let selinux_raw = self
            .run_on(serial, &["shell", "getenforce"])
            .unwrap_or_else(|_| "Unknown".to_string());
        let selinux_status = selinux_raw.trim().to_string();

        Ok(DeviceProps {
            model,
            manufacturer,
            android_version,
            sdk_version,
            abi,
            security_patch,
            build_id,
            is_rooted,
            selinux_status,
        })
    }

    /// Lists installed Android packages visible to `pm list packages`.
    pub fn list_applications(
        &self,
        serial: &str,
        running_processes: &[ProcessInfo],
    ) -> Result<Vec<AppInfo>, AppError> {
        let output = self.run_on(serial, &["shell", "pm", "list", "packages"])?;
        let pid_by_identifier: HashMap<&str, u32> = running_processes
            .iter()
            .filter_map(|process| {
                Self::infer_process_identifier(process).map(|identifier| (identifier, process.pid))
            })
            .collect();

        let mut applications = output
            .lines()
            .filter_map(Self::parse_package_identifier)
            .map(|identifier| AppInfo {
                identifier: identifier.to_string(),
                name: identifier.to_string(),
                pid: pid_by_identifier.get(identifier).copied(),
                icon: None,
            })
            .collect::<Vec<_>>();

        applications.sort_by(|left, right| {
            left.name
                .cmp(&right.name)
                .then(left.identifier.cmp(&right.identifier))
        });
        applications.dedup_by(|left, right| left.identifier == right.identifier);

        Ok(applications)
    }

    /// Pushes a frida-server binary to the device at `/data/local/tmp/frida-server`.
    pub fn push_frida_server(
        &self,
        serial: &str,
        version: &str,
        arch: &str,
    ) -> Result<(), AppError> {
        let local_path = format!("/tmp/frida-server-{version}-android-{arch}");
        self.run_on(
            serial,
            &["push", &local_path, "/data/local/tmp/frida-server"],
        )?;
        // Make executable
        self.run_on(
            serial,
            &["shell", "chmod", "755", "/data/local/tmp/frida-server"],
        )?;
        Ok(())
    }

    /// Starts frida-server on the device in the background.
    pub fn start_frida_server(&self, serial: &str) -> Result<(), AppError> {
        self.run_on(
            serial,
            &["shell", "nohup", "/data/local/tmp/frida-server", "&"],
        )?;
        Ok(())
    }

    /// Stops any running frida-server process.
    pub fn stop_frida_server(&self, serial: &str) -> Result<(), AppError> {
        // pkill returns non-zero if no process found; treat both as success
        let _ = self.run_on(serial, &["shell", "pkill", "-f", "frida-server"]);
        Ok(())
    }

    /// Returns true if frida-server is currently running on the device.
    pub fn is_frida_running(&self, serial: &str) -> Result<bool, AppError> {
        let output = self
            .run_on(serial, &["shell", "pgrep", "-f", "frida-server"])
            .unwrap_or_default();
        Ok(!output.trim().is_empty())
    }

    /// Executes a shell command on the device and returns stdout.
    ///
    /// The command is passed as a program name and separate arguments to prevent
    /// shell injection. The caller must split the command into tokens.
    pub fn shell(&self, serial: &str, command: &str, args: &[String]) -> Result<String, AppError> {
        let mut shell_args: Vec<&str> = vec!["shell", command];
        for arg in args {
            shell_args.push(arg.as_str());
        }
        self.run_on(serial, &shell_args)
    }

    /// Installs an APK on the device.
    pub fn install_apk(&self, serial: &str, path: &str) -> Result<(), AppError> {
        self.run_on(serial, &["install", "-r", path])?;
        Ok(())
    }

    /// Pairs with a device over Wi-Fi using the pairing code (Android 11+).
    pub fn pair(&self, address: &str, code: &str) -> Result<(), AppError> {
        if !address.contains(':') {
            return Err(AppError::InvalidAddress(address.to_string()));
        }
        self.run(&["pair", address, code])?;
        Ok(())
    }

    /// Connects to a device over TCP/IP.
    pub fn connect(&self, address: &str) -> Result<(), AppError> {
        if !address.contains(':') {
            return Err(AppError::InvalidAddress(address.to_string()));
        }
        let output = self.run(&["connect", address])?;
        if output.contains("failed") || output.contains("error") {
            return Err(AppError::ConnectionFailed(
                address.to_string(),
                output.trim().to_string(),
            ));
        }
        Ok(())
    }
}

impl Default for AdbService {
    fn default() -> Self {
        Self::new()
    }
}
