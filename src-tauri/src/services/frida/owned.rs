use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use frida::{Device as FridaDevice, DeviceManager, Frida, Session};

use crate::error::AppError;

pub(super) struct OwnedSession {
    ptr: *mut Session<'static>,
}

pub(super) struct OwnedDeviceManager {
    ptr: *mut DeviceManager<'static>,
}

pub(super) struct OwnedDevice {
    ptr: *mut FridaDevice<'static>,
}

pub(super) struct MainContextPump {
    stop: Arc<AtomicBool>,
    worker: Option<JoinHandle<()>>,
}

impl OwnedSession {
    pub(super) fn new(session: Session<'static>) -> Self {
        Self {
            ptr: Box::into_raw(Box::new(session)),
        }
    }

    pub(super) fn as_ref(&self) -> &'static Session<'static> {
        // The boxed session lives until OwnedSession is dropped inside the actor thread.
        unsafe { &*self.ptr }
    }
}

impl Drop for OwnedSession {
    fn drop(&mut self) {
        // Rebuild the Box so the Frida session gets detached/unreffed normally.
        unsafe {
            drop(Box::from_raw(self.ptr));
        }
    }
}

impl OwnedDeviceManager {
    pub(super) fn new(
        frida: &'static Frida,
        remote_addresses: &[String],
    ) -> Result<Self, AppError> {
        let manager = DeviceManager::obtain(frida);

        for address in remote_addresses {
            manager.get_remote_device(address).map_err(|error| {
                AppError::ConnectionFailed("frida".to_string(), error.to_string())
            })?;
        }

        Ok(Self {
            ptr: Box::into_raw(Box::new(manager)),
        })
    }

    pub(super) fn as_ref(&self) -> &'static DeviceManager<'static> {
        // The boxed manager lives until OwnedDeviceManager is dropped inside the actor thread.
        unsafe { &*self.ptr }
    }
}

impl Drop for OwnedDeviceManager {
    fn drop(&mut self) {
        unsafe {
            drop(Box::from_raw(self.ptr));
        }
    }
}

impl OwnedDevice {
    pub(super) fn new(device: FridaDevice<'static>) -> Self {
        Self {
            ptr: Box::into_raw(Box::new(device)),
        }
    }

    pub(super) fn as_ref(&self) -> &'static FridaDevice<'static> {
        // The boxed device lives until OwnedDevice is dropped inside the actor thread.
        unsafe { &*self.ptr }
    }

    pub(super) fn as_mut(&mut self) -> &'static mut FridaDevice<'static> {
        // The boxed device lives until OwnedDevice is dropped inside the actor thread.
        unsafe { &mut *self.ptr }
    }
}

impl Drop for OwnedDevice {
    fn drop(&mut self) {
        unsafe {
            drop(Box::from_raw(self.ptr));
        }
    }
}

impl MainContextPump {
    pub(super) fn start() -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        let worker_stop = stop.clone();
        let worker = thread::spawn(move || {
            while !worker_stop.load(Ordering::Relaxed) {
                while unsafe {
                    frida_sys::g_main_context_iteration(frida_sys::frida_get_main_context(), 0)
                        != frida_sys::FALSE as i32
                } {}
                thread::sleep(Duration::from_millis(5));
            }
        });

        Self {
            stop,
            worker: Some(worker),
        }
    }
}

impl Drop for MainContextPump {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}
