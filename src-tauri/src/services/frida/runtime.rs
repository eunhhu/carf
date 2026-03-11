use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use frida::{Frida, Script, ScriptOption, Session, SpawnOptions as FridaSpawnOptions};
use serde_json::{json, Value};

use crate::error::AppError;
use crate::services::session_manager::{SessionInfo, SessionMode, SessionStatus};
use crate::state::{BridgeEvent, EventHub};

use super::owned::{MainContextPump, OwnedDevice, OwnedDeviceManager, OwnedSession};
use super::script::HostScriptHandler;
use super::types::{AppInfo, AttachOptions, DeviceInfo, ProcessInfo, SpawnOptions};
use super::util::{
    get_device_arch, new_session_id, now_millis, parse_script_runtime, parse_spawn_stdio,
    pause_process, project_root, resolve_attach_target, resume_process, serialize_device,
    unwrap_rpc_result,
};

const FRIDA_ACTOR_POLL_INTERVAL: Duration = Duration::from_millis(100);
const COMPILED_AGENT_PATH: &str = "src-agent/dist/_agent.js";

type ActorTask = Box<dyn FnOnce(&mut FridaActor) + Send + 'static>;

struct ActorHandle {
    sender: Option<mpsc::Sender<ActorTask>>,
    worker: Option<JoinHandle<()>>,
}

impl ActorHandle {
    fn new(events: EventHub) -> Self {
        let (sender, receiver) = mpsc::channel::<ActorTask>();
        let worker = thread::spawn(move || {
            let mut actor = FridaActor::new(events);

            loop {
                actor.pump();

                match receiver.recv_timeout(FRIDA_ACTOR_POLL_INTERVAL) {
                    Ok(task) => task(&mut actor),
                    Err(RecvTimeoutError::Timeout) => {}
                    Err(RecvTimeoutError::Disconnected) => break,
                }
            }
        });

        Self {
            sender: Some(sender),
            worker: Some(worker),
        }
    }

    fn request<T, F>(&self, operation: F) -> Result<T, AppError>
    where
        T: Send + 'static,
        F: FnOnce(&mut FridaActor) -> Result<T, AppError> + Send + 'static,
    {
        let sender = self
            .sender
            .as_ref()
            .ok_or_else(|| AppError::Internal("Frida actor is not available".to_string()))?;
        let (result_tx, result_rx) = mpsc::sync_channel(1);

        sender
            .send(Box::new(move |actor| {
                let result = operation(actor);
                actor.pump();
                let _ = result_tx.send(result);
            }))
            .map_err(|_| AppError::Internal("Failed to send Frida actor request".to_string()))?;

        result_rx
            .recv()
            .map_err(|_| AppError::Internal("Frida actor stopped unexpectedly".to_string()))?
    }
}

impl Drop for ActorHandle {
    fn drop(&mut self) {
        self.sender.take();

        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

pub struct FridaService {
    actor: ActorHandle,
}

impl FridaService {
    pub fn new(events: EventHub) -> Self {
        Self {
            actor: ActorHandle::new(events),
        }
    }

    pub fn list_devices(&mut self) -> Result<Vec<DeviceInfo>, AppError> {
        self.actor.request(|actor| actor.list_devices())
    }

    pub fn add_remote_device(&mut self, address: &str) -> Result<DeviceInfo, AppError> {
        let address = address.to_string();
        self.actor
            .request(move |actor| actor.add_remote_device(&address))
    }

    pub fn remove_remote_device(&mut self, address: &str) -> Result<(), AppError> {
        let address = address.to_string();
        self.actor
            .request(move |actor| actor.remove_remote_device(&address))
    }

    pub fn get_device_info(&mut self, device_id: &str) -> Result<DeviceInfo, AppError> {
        let device_id = device_id.to_string();
        self.actor
            .request(move |actor| actor.get_device_info(&device_id))
    }

    pub fn list_processes(&mut self, device_id: &str) -> Result<Vec<ProcessInfo>, AppError> {
        let device_id = device_id.to_string();
        self.actor
            .request(move |actor| actor.list_processes(&device_id))
    }

    pub fn list_applications(&mut self, device_id: &str) -> Result<Vec<AppInfo>, AppError> {
        let device_id = device_id.to_string();
        self.actor
            .request(move |actor| actor.list_applications(&device_id))
    }

    pub fn kill_process(&mut self, device_id: &str, pid: u32) -> Result<(), AppError> {
        let device_id = device_id.to_string();
        self.actor
            .request(move |actor| actor.kill_process(&device_id, pid))
    }

    pub fn spawn_and_attach(
        &mut self,
        device_id: &str,
        options: SpawnOptions,
    ) -> Result<SessionInfo, AppError> {
        let device_id = device_id.to_string();
        self.actor
            .request(move |actor| actor.spawn_and_attach(&device_id, options))
    }

    pub fn attach(
        &mut self,
        device_id: &str,
        options: AttachOptions,
    ) -> Result<SessionInfo, AppError> {
        let device_id = device_id.to_string();
        self.actor
            .request(move |actor| actor.attach(&device_id, options))
    }

    pub fn detach(&mut self, session_id: &str) -> Result<(), AppError> {
        let session_id = session_id.to_string();
        self.actor.request(move |actor| actor.detach(&session_id))
    }

    pub fn resume(&mut self, session_id: &str) -> Result<(), AppError> {
        let session_id = session_id.to_string();
        self.actor.request(move |actor| actor.resume(&session_id))
    }

    pub fn list_sessions(&mut self) -> Result<Vec<SessionInfo>, AppError> {
        self.actor.request(|actor| actor.list_sessions())
    }

    pub fn rpc_call(
        &mut self,
        session_id: &str,
        method: &str,
        params: Value,
    ) -> Result<Value, AppError> {
        let session_id = session_id.to_string();
        let method = method.to_string();
        self.actor
            .request(move |actor| actor.rpc_call(&session_id, &method, params))
    }
}

struct FridaActor {
    frida: &'static Frida,
    device_manager: OwnedDeviceManager,
    remote_addresses: Vec<String>,
    events: EventHub,
    script_events_tx: mpsc::Sender<BridgeEvent>,
    script_events_rx: mpsc::Receiver<BridgeEvent>,
    _main_context_pump: MainContextPump,
    sessions: HashMap<String, SessionBundle>,
    agent_source: Option<String>,
}

struct SessionBundle {
    info: SessionInfo,
    session: OwnedSession,
    core_script: Script<'static>,
    user_script: Option<Script<'static>>,
    spawned_pid: Option<u32>,
    pause_mode: Option<PauseMode>,
}

#[derive(Clone, Copy)]
enum PauseMode {
    FridaSpawn,
    SignalStop,
}

struct SessionOptionsHandle {
    ptr: *mut frida_sys::FridaSessionOptions,
}

impl SessionOptionsHandle {
    fn build(realm: Option<&str>, persist_timeout: Option<u32>) -> Self {
        let ptr = unsafe { frida_sys::frida_session_options_new() };
        let handle = Self { ptr };

        if let Some(realm) = realm {
            let value = match realm.to_ascii_lowercase().as_str() {
                "emulated" => frida_sys::FridaRealm_FRIDA_REALM_EMULATED,
                _ => frida_sys::FridaRealm_FRIDA_REALM_NATIVE,
            };
            unsafe {
                frida_sys::frida_session_options_set_realm(handle.ptr, value);
            }
        }

        if let Some(timeout) = persist_timeout {
            unsafe {
                frida_sys::frida_session_options_set_persist_timeout(handle.ptr, timeout);
            }
        }

        handle
    }

    fn from_attach_options(options: &AttachOptions) -> Result<Self, AppError> {
        Ok(Self::build(
            options.realm.as_deref(),
            options.persist_timeout,
        ))
    }

    fn from_spawn_options(options: &SpawnOptions) -> Result<Self, AppError> {
        Ok(Self::build(
            options.realm.as_deref(),
            options.persist_timeout,
        ))
    }

    fn as_mut_ptr(&self) -> *mut frida_sys::FridaSessionOptions {
        self.ptr
    }
}

impl Drop for SessionOptionsHandle {
    fn drop(&mut self) {
        unsafe {
            frida_sys::frida_unref(self.ptr.cast());
        }
    }
}

fn frida_device_ptr(device: &frida::Device<'static>) -> *mut frida_sys::FridaDevice {
    debug_assert_eq!(
        std::mem::size_of::<frida::Device<'static>>(),
        std::mem::size_of::<*mut frida_sys::FridaDevice>(),
    );
    unsafe { std::mem::transmute_copy(device) }
}

fn frida_session_ptr(session: &Session<'static>) -> *mut frida_sys::FridaSession {
    debug_assert_eq!(
        std::mem::size_of::<Session<'static>>(),
        std::mem::size_of::<*mut frida_sys::FridaSession>(),
    );
    unsafe { std::mem::transmute_copy(session) }
}

fn frida_session_from_raw(session: *mut frida_sys::FridaSession) -> Session<'static> {
    debug_assert_eq!(
        std::mem::size_of::<Session<'static>>(),
        std::mem::size_of::<*mut frida_sys::FridaSession>(),
    );
    unsafe { std::mem::transmute(session) }
}

fn take_gerror_message(error: *mut frida_sys::GError) -> String {
    if error.is_null() {
        return "unknown Frida error".to_string();
    }

    let message = unsafe { CStr::from_ptr((*error).message) }
        .to_string_lossy()
        .into_owned();

    unsafe {
        frida_sys::g_error_free(error);
    }

    message
}

impl FridaActor {
    fn new(events: EventHub) -> Self {
        let frida = Box::leak(Box::new(unsafe { Frida::obtain() }));
        let device_manager =
            OwnedDeviceManager::new(frida, &[]).expect("failed to create Frida device manager");
        let (script_events_tx, script_events_rx) = mpsc::channel();
        let main_context_pump = MainContextPump::start();

        Self {
            frida,
            device_manager,
            remote_addresses: Vec::new(),
            events,
            script_events_tx,
            script_events_rx,
            _main_context_pump: main_context_pump,
            sessions: HashMap::new(),
            agent_source: None,
        }
    }

    fn pump(&mut self) {
        while let Ok(event) = self.script_events_rx.try_recv() {
            self.events.emit(event.name, event.payload);
        }

        self.reap_detached_sessions();
    }

    fn rebuild_device_manager(&mut self) -> Result<(), AppError> {
        self.device_manager = OwnedDeviceManager::new(self.frida, &self.remote_addresses)?;
        Ok(())
    }

    fn list_devices(&mut self) -> Result<Vec<DeviceInfo>, AppError> {
        self.device_manager
            .as_ref()
            .enumerate_all_devices()
            .into_iter()
            .map(|device| serialize_device(&device))
            .collect::<Result<Vec<_>, _>>()
    }

    fn add_remote_device(&mut self, address: &str) -> Result<DeviceInfo, AppError> {
        let address = address.trim();
        if !address.contains(':') {
            return Err(AppError::InvalidAddress(format!(
                "Invalid address: {address}"
            )));
        }

        if !self.remote_addresses.iter().any(|entry| entry == address) {
            self.remote_addresses.push(address.to_string());
        }
        self.rebuild_device_manager()?;

        let device = self.get_device(address).or_else(|_| {
            self.device_manager
                .as_ref()
                .enumerate_all_devices()
                .into_iter()
                .find(|device| {
                    device.get_name().contains(address) || device.get_id().contains(address)
                })
                .map(OwnedDevice::new)
                .ok_or_else(|| AppError::DeviceNotFound(format!("Device not found: {address}")))
        })?;

        serialize_device(device.as_ref())
    }

    fn remove_remote_device(&mut self, address: &str) -> Result<(), AppError> {
        self.remote_addresses.retain(|entry| entry != address);
        self.rebuild_device_manager()
    }

    fn get_device_info(&mut self, device_id: &str) -> Result<DeviceInfo, AppError> {
        let device = self.get_device(device_id)?;
        serialize_device(device.as_ref())
    }

    fn list_processes(&mut self, device_id: &str) -> Result<Vec<ProcessInfo>, AppError> {
        let device = self.get_device(device_id)?;
        Ok(device
            .as_ref()
            .enumerate_processes()
            .into_iter()
            .map(|process| ProcessInfo {
                pid: process.get_pid(),
                name: process.get_name().to_string(),
                identifier: None,
                icon: None,
            })
            .collect())
    }

    fn list_applications(&mut self, device_id: &str) -> Result<Vec<AppInfo>, AppError> {
        let device = self.get_device(device_id)?;
        let raw_device = frida_device_ptr(device.as_ref());
        let mut error = std::ptr::null_mut();
        let applications = unsafe {
            frida_sys::frida_device_enumerate_applications_sync(
                raw_device,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                &mut error,
            )
        };

        if !error.is_null() {
            return Err(AppError::Internal(take_gerror_message(error)));
        }

        let count = unsafe { frida_sys::frida_application_list_size(applications) };
        let mut results = Vec::with_capacity(count.max(0) as usize);

        for index in 0..count {
            let application = unsafe { frida_sys::frida_application_list_get(applications, index) };
            let identifier = unsafe {
                CStr::from_ptr(frida_sys::frida_application_get_identifier(application))
            }
            .to_string_lossy()
            .into_owned();
            let name =
                unsafe { CStr::from_ptr(frida_sys::frida_application_get_name(application)) }
                    .to_string_lossy()
                    .into_owned();
            let pid = unsafe { frida_sys::frida_application_get_pid(application) };

            results.push(AppInfo {
                identifier,
                name,
                pid: if pid == 0 { None } else { Some(pid) },
                icon: None,
            });
        }

        unsafe {
            frida_sys::frida_unref(applications.cast());
        }

        Ok(results)
    }

    fn kill_process(&mut self, device_id: &str, pid: u32) -> Result<(), AppError> {
        let mut device = self.get_device(device_id)?;
        device
            .as_mut()
            .kill(pid)
            .map_err(|error| AppError::Internal(error.to_string()))
    }

    fn spawn_and_attach(
        &mut self,
        device_id: &str,
        options: SpawnOptions,
    ) -> Result<SessionInfo, AppError> {
        let mut device = self.get_device(device_id)?;
        let mut spawn_options = FridaSpawnOptions::new();

        if let Some(argv) = options.argv.as_ref() {
            if !argv.is_empty() {
                spawn_options = spawn_options.argv(argv.iter().map(String::as_str));
            }
        }

        if let Some(envp) = options.envp.as_ref() {
            spawn_options = spawn_options.envp(
                envp.iter()
                    .map(|(key, value)| (key.as_str(), value.as_str())),
            );
        }

        if let Some(cwd) = options.cwd.as_ref() {
            let cwd = CString::new(cwd.as_str()).map_err(|_| {
                AppError::SpawnFailed(options.identifier.clone(), "Invalid cwd".to_string())
            })?;
            spawn_options = spawn_options.cwd(cwd.as_c_str());
        }

        if let Some(stdio) = options.stdio.as_deref() {
            spawn_options = spawn_options.stdio(parse_spawn_stdio(stdio));
        }

        let pid = device
            .as_mut()
            .spawn(&options.identifier, &spawn_options)
            .map_err(|error| {
                AppError::SpawnFailed(options.identifier.clone(), error.to_string())
            })?;
        let session_options = SessionOptionsHandle::from_spawn_options(&options)?;
        let mut error = std::ptr::null_mut();
        let raw_session = unsafe {
            frida_sys::frida_device_attach_sync(
                frida_device_ptr(device.as_ref()),
                pid,
                session_options.as_mut_ptr(),
                std::ptr::null_mut(),
                &mut error,
            )
        };

        if !error.is_null() {
            return Err(AppError::AttachFailed(
                options.identifier.clone(),
                take_gerror_message(error),
            ));
        }

        let session = frida_session_from_raw(raw_session);

        let info = SessionInfo {
            id: new_session_id(),
            device_id: device_id.to_string(),
            pid,
            process_name: options.identifier.clone(),
            identifier: Some(options.identifier.clone()),
            status: if options.auto_resume == Some(false) {
                SessionStatus::Paused
            } else {
                SessionStatus::Active
            },
            mode: SessionMode::Spawn,
            arch: get_device_arch(device.as_ref())?,
            created_at: now_millis(),
        };

        let mut bundle =
            self.build_session_bundle(info.clone(), session, options.runtime.as_deref())?;
        if options.auto_resume == Some(false) {
            bundle.spawned_pid = Some(pid);
            bundle.pause_mode = Some(PauseMode::FridaSpawn);
        } else {
            device
                .as_ref()
                .resume(pid)
                .map_err(|error| AppError::Internal(error.to_string()))?;
        }

        self.sessions.insert(info.id.clone(), bundle);
        if let Err(error) = self.configure_session(
            &info.id,
            options.runtime.as_deref(),
            options.script_path.as_deref(),
            options.enable_child_gating == Some(true),
        ) {
            self.discard_session(&info.id);
            return Err(error);
        }
        Ok(info)
    }

    fn attach(&mut self, device_id: &str, options: AttachOptions) -> Result<SessionInfo, AppError> {
        let device = self.get_device(device_id)?;
        let (pid, process_name, identifier) =
            resolve_attach_target(device.as_ref(), frida_device_ptr(device.as_ref()), &options.target)?;
        let session_options = SessionOptionsHandle::from_attach_options(&options)?;
        let mut error = std::ptr::null_mut();
        let raw_session = unsafe {
            frida_sys::frida_device_attach_sync(
                frida_device_ptr(device.as_ref()),
                pid,
                session_options.as_mut_ptr(),
                std::ptr::null_mut(),
                &mut error,
            )
        };

        if !error.is_null() {
            return Err(AppError::AttachFailed(
                process_name.clone(),
                take_gerror_message(error),
            ));
        }

        let session = frida_session_from_raw(raw_session);

        let info = SessionInfo {
            id: new_session_id(),
            device_id: device_id.to_string(),
            pid,
            process_name,
            identifier,
            status: SessionStatus::Active,
            mode: SessionMode::Attach,
            arch: get_device_arch(device.as_ref())?,
            created_at: now_millis(),
        };

        let bundle =
            self.build_session_bundle(info.clone(), session, options.runtime.as_deref())?;
        self.sessions.insert(info.id.clone(), bundle);
        if let Err(error) = self.configure_session(
            &info.id,
            options.runtime.as_deref(),
            options.script_path.as_deref(),
            options.enable_child_gating == Some(true),
        ) {
            self.discard_session(&info.id);
            return Err(error);
        }
        Ok(info)
    }

    fn detach(&mut self, session_id: &str) -> Result<(), AppError> {
        let mut bundle = self
            .sessions
            .remove(session_id)
            .ok_or_else(|| AppError::SessionNotFound(format!("Session not found: {session_id}")))?;

        let detach_result = bundle.session.as_ref().detach();
        bundle.cleanup();

        match detach_result {
            Ok(()) => {
                self.emit_detached(session_id, "application_requested");
                Ok(())
            }
            Err(error) => Err(AppError::SessionExpired(error.to_string())),
        }
    }

    fn resume(&mut self, session_id: &str) -> Result<(), AppError> {
        let pause_mode = self
            .sessions
            .get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(format!("Session not found: {session_id}")))?
            .pause_mode;

        match pause_mode {
            Some(PauseMode::FridaSpawn) => {
                let (device_id, pid) = {
                    let bundle = self.sessions.get(session_id).expect("session exists");
                    let pid = bundle.spawned_pid.unwrap_or(bundle.info.pid);
                    (bundle.info.device_id.clone(), pid)
                };
                let device = self.get_device(&device_id)?;
                device
                    .as_ref()
                    .resume(pid)
                    .map_err(|error| AppError::Internal(error.to_string()))?;
            }
            Some(PauseMode::SignalStop) => {
                let pid = self
                    .sessions
                    .get(session_id)
                    .expect("session exists")
                    .info
                    .pid;
                resume_process(pid)?;
            }
            None => return Ok(()),
        }

        if let Some(bundle) = self.sessions.get_mut(session_id) {
            bundle.pause_mode = None;
            bundle.info.status = SessionStatus::Active;
        }

        Ok(())
    }

    fn list_sessions(&mut self) -> Result<Vec<SessionInfo>, AppError> {
        Ok(self
            .sessions
            .values()
            .map(|session| session.info.clone())
            .collect())
    }

    fn rpc_call(
        &mut self,
        session_id: &str,
        method: &str,
        params: Value,
    ) -> Result<Value, AppError> {
        match method {
            "loadScript" => {
                self.load_user_script(session_id, params)?;
                return Ok(json!({}));
            }
            "unloadScript" => {
                self.unload_user_script(session_id)?;
                return Ok(json!({}));
            }
            "pause" => {
                self.pause_session(session_id)?;
                return Ok(json!({}));
            }
            _ => {}
        }

        let bundle = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| AppError::SessionNotFound(format!("Session not found: {session_id}")))?;

        let response = bundle
            .core_script
            .exports
            .call(method, Some(Value::Array(vec![params])))
            .map_err(|error| AppError::AgentRpcError(error.to_string()))?;

        unwrap_rpc_result(response.unwrap_or(Value::Null))
    }

    fn pause_session(&mut self, session_id: &str) -> Result<(), AppError> {
        let bundle = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| AppError::SessionNotFound(format!("Session not found: {session_id}")))?;

        if bundle.info.device_id != "local" {
            return Err(AppError::AgentRpcError(
                "pause is only supported for local processes in this build".to_string(),
            ));
        }

        pause_process(bundle.info.pid)?;
        bundle.pause_mode = Some(PauseMode::SignalStop);
        bundle.info.status = SessionStatus::Paused;
        Ok(())
    }

    fn build_session_bundle(
        &mut self,
        info: SessionInfo,
        session: Session<'static>,
        runtime: Option<&str>,
    ) -> Result<SessionBundle, AppError> {
        let session = OwnedSession::new(session);
        let core_script = self.load_core_script(&session, &info.id, runtime)?;

        Ok(SessionBundle {
            info,
            session,
            core_script,
            user_script: None,
            spawned_pid: None,
            pause_mode: None,
        })
    }

    fn load_core_script(
        &mut self,
        session: &OwnedSession,
        session_id: &str,
        runtime: Option<&str>,
    ) -> Result<Script<'static>, AppError> {
        let source = self.get_core_agent_source()?;
        let mut options = ScriptOption::new().set_name("CARF Core Agent");
        options = options.set_runtime(parse_script_runtime(runtime));

        let mut script = session
            .as_ref()
            .create_script(source, &mut options)
            .map_err(|error| AppError::ScriptLoadFailed(error.to_string()))?;

        script
            .handle_message(HostScriptHandler::new(
                session_id.to_string(),
                self.script_events_tx.clone(),
            ))
            .map_err(|error| AppError::ScriptLoadFailed(error.to_string()))?;
        script
            .load()
            .map_err(|error| AppError::ScriptLoadFailed(error.to_string()))?;
        Ok(script)
    }

    fn load_user_script(&mut self, session_id: &str, params: Value) -> Result<(), AppError> {
        let code = params
            .get("code")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim()
            .to_string();
        if code.is_empty() {
            return Err(AppError::ScriptLoadFailed(
                "Script source is empty".to_string(),
            ));
        }
        let runtime = params.get("runtime").and_then(Value::as_str);

        self.unload_user_script(session_id)?;

        let bundle = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| AppError::SessionNotFound(format!("Session not found: {session_id}")))?;

        let mut options = ScriptOption::new().set_name("CARF User Script");
        options = options.set_runtime(parse_script_runtime(runtime));

        let mut script = bundle
            .session
            .as_ref()
            .create_script(&code, &mut options)
            .map_err(|error| AppError::ScriptLoadFailed(error.to_string()))?;
        script
            .handle_message(HostScriptHandler::new(
                session_id.to_string(),
                self.script_events_tx.clone(),
            ))
            .map_err(|error| AppError::ScriptLoadFailed(error.to_string()))?;
        script
            .load()
            .map_err(|error| AppError::ScriptLoadFailed(error.to_string()))?;

        bundle.user_script = Some(script);
        Ok(())
    }

    fn configure_session(
        &mut self,
        session_id: &str,
        runtime: Option<&str>,
        script_path: Option<&str>,
        enable_child_gating: bool,
    ) -> Result<(), AppError> {
        if enable_child_gating {
            self.enable_child_gating(session_id)?;
        }

        if let Some(path) = script_path {
            if !path.trim().is_empty() {
                self.load_user_script_from_path(session_id, path, runtime)?;
            }
        }

        Ok(())
    }

    fn load_user_script_from_path(
        &mut self,
        session_id: &str,
        path: &str,
        runtime: Option<&str>,
    ) -> Result<(), AppError> {
        let code = std::fs::read_to_string(path).map_err(|error| {
            AppError::ScriptLoadFailed(format!("failed to read {path}: {error}"))
        })?;

        self.load_user_script(
            session_id,
            json!({
                "code": code,
                "runtime": runtime,
            }),
        )
    }

    fn enable_child_gating(&mut self, session_id: &str) -> Result<(), AppError> {
        let bundle = self
            .sessions
            .get(session_id)
            .ok_or_else(|| AppError::SessionNotFound(format!("Session not found: {session_id}")))?;
        let mut error = std::ptr::null_mut();
        unsafe {
            frida_sys::frida_session_enable_child_gating_sync(
                frida_session_ptr(bundle.session.as_ref()),
                std::ptr::null_mut(),
                &mut error,
            );
        }

        if error.is_null() {
            Ok(())
        } else {
            Err(AppError::AttachFailed(
                bundle.info.process_name.clone(),
                take_gerror_message(error),
            ))
        }
    }

    fn discard_session(&mut self, session_id: &str) {
        if let Some(mut bundle) = self.sessions.remove(session_id) {
            let _ = bundle.session.as_ref().detach();
            bundle.cleanup();
        }
    }

    fn unload_user_script(&mut self, session_id: &str) -> Result<(), AppError> {
        let bundle = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| AppError::SessionNotFound(format!("Session not found: {session_id}")))?;

        if let Some(script) = bundle.user_script.take() {
            let _ = script.unload();
        }

        Ok(())
    }

    fn get_core_agent_source(&mut self) -> Result<&str, AppError> {
        let path = project_root().join(COMPILED_AGENT_PATH);
        let source = std::fs::read_to_string(&path).map_err(|error| {
            AppError::ScriptLoadFailed(format!(
                "failed to read precompiled agent at {}: {}. Run `bun run compile:agent`.",
                path.display(),
                error
            ))
        })?;
        self.agent_source = Some(source);

        self.agent_source
            .as_deref()
            .ok_or_else(|| AppError::ScriptLoadFailed("Compiled agent is unavailable".to_string()))
    }

    fn get_device(&self, device_id: &str) -> Result<OwnedDevice, AppError> {
        if device_id == "local" {
            return self
                .device_manager
                .as_ref()
                .get_local_device()
                .map(OwnedDevice::new)
                .map_err(|_| AppError::DeviceNotFound(format!("Device not found: {device_id}")));
        }

        self.device_manager
            .as_ref()
            .get_device_by_id(device_id)
            .map(OwnedDevice::new)
            .map_err(|_| AppError::DeviceNotFound(format!("Device not found: {device_id}")))
    }

    fn reap_detached_sessions(&mut self) {
        let detached_ids = self
            .sessions
            .iter()
            .filter_map(|(session_id, bundle)| {
                if bundle.session.as_ref().is_detached() {
                    Some(session_id.clone())
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();

        for session_id in detached_ids {
            if let Some(mut bundle) = self.sessions.remove(&session_id) {
                bundle.cleanup();
                self.emit_detached(&session_id, "process_terminated");
            }
        }
    }

    fn emit_detached(&self, session_id: &str, reason: &str) {
        self.events.emit(
            "carf://session/detached",
            json!({
                "sessionId": session_id,
                "reason": reason,
            }),
        );
    }
}

impl SessionBundle {
    fn cleanup(&mut self) {
        if let Some(script) = self.user_script.take() {
            let _ = script.unload();
        }

        let _ = self.core_script.unload();
    }
}
