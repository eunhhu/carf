use std::sync::mpsc;

use frida::{Message, MessageLogLevel, ScriptHandler};
use serde_json::{json, Value};

use crate::state::BridgeEvent;

use super::util::{now_millis, queue_event, stringify_value};

pub(super) struct HostScriptHandler {
    session_id: String,
    event_sender: mpsc::Sender<BridgeEvent>,
}

impl HostScriptHandler {
    pub(super) fn new(session_id: String, event_sender: mpsc::Sender<BridgeEvent>) -> Self {
        Self {
            session_id,
            event_sender,
        }
    }

    fn handle_raw_message(&self, message: Value) {
        let Some(kind) = message.get("type").and_then(Value::as_str) else {
            return;
        };

        match kind {
            "send" => {
                self.handle_send_payload(message.get("payload").cloned().unwrap_or(Value::Null))
            }
            "log" => {
                let content = message
                    .get("payload")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                let level = message
                    .get("level")
                    .and_then(Value::as_str)
                    .unwrap_or("info");
                self.queue_session_console(level, "agent", content, None);
            }
            "error" => {
                let description = message
                    .get("description")
                    .or_else(|| message.get("stack"))
                    .and_then(Value::as_str)
                    .unwrap_or("Script error")
                    .to_string();
                self.queue_session_console(
                    "error",
                    "agent",
                    description,
                    Some(message),
                );
            }
            _ => {}
        }
    }

    fn handle_send_payload(&self, payload: Value) {
        let Value::Object(payload) = payload else {
            self.queue_session_console(
                "info",
                "script",
                stringify_value(&payload),
                Some(payload),
            );
            return;
        };

        let event_type = payload
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let data = payload.get("data").cloned().unwrap_or(Value::Null);
        let timestamp = payload
            .get("timestamp")
            .and_then(Value::as_u64)
            .unwrap_or_else(now_millis);

        match event_type {
            _ if event_type.starts_with("carf://") => {
                let forwarded = if data.is_null() {
                    Value::Object(payload.clone())
                } else {
                    data
                };
                self.queue_session_event(event_type, forwarded);
            }
            "console/message" => {
                if matches!(data, Value::Object(_)) {
                    self.queue_session_event("carf://console/message", data);
                } else {
                    self.queue_session_console(
                        "info",
                        "agent",
                        stringify_value(&data),
                        Some(data),
                    );
                }
            }
            "hook/event" => {
                if matches!(data, Value::Object(_)) {
                    self.queue_session_event("carf://hook/event", data);
                }
            }
            "network/request" => {
                if matches!(data, Value::Object(_)) {
                    self.queue_session_event("carf://network/request", data);
                }
            }
            "stalker/event" => {
                self.queue_session_event("carf://stalker/event", data);
            }
            "memory/access" => {
                if matches!(data, Value::Object(_)) {
                    self.queue_session_event("carf://memory/access", data);
                }
            }
            "scan/progress" => {
                if matches!(data, Value::Object(_)) {
                    self.queue_session_event("carf://scan/progress", data);
                }
            }
            "scan/result" => {
                self.queue_session_event("carf://scan/result", data);
            }
            "log" => {
                self.queue_session_console(
                    "info",
                    "script",
                    stringify_value(&data),
                    Some(data),
                );
            }
            "hook:enter" | "hook:leave" => {
                let details = data.as_object().cloned().unwrap_or_default();
                self.queue_session_event(
                    "carf://hook/event",
                    json!({
                        "hookId": details.get("hookId").and_then(Value::as_str).unwrap_or("script-hook"),
                        "type": if event_type.ends_with("enter") { "enter" } else { "leave" },
                        "timestamp": timestamp,
                        "threadId": details.get("threadId").and_then(Value::as_i64).unwrap_or(-1),
                        "target": details.get("target").cloned().unwrap_or_else(|| Value::String("unknown".to_string())),
                        "address": details.get("address").cloned().unwrap_or(Value::Null),
                        "args": details.get("args").cloned().unwrap_or_else(|| Value::Array(Vec::new())),
                        "retval": details.get("retval").cloned().unwrap_or(Value::Null),
                        "backtrace": details.get("backtrace").cloned().unwrap_or_else(|| Value::Array(Vec::new())),
                    }),
                );
            }
            _ => {
                self.queue_session_console(
                    "info",
                    "script",
                    format!(
                        "Unhandled script message on session {}: {}",
                        self.session_id, event_type
                    ),
                    Some(Value::Object(payload)),
                );
            }
        }
    }

    fn queue_session_event(&self, name: &str, payload: Value) {
        let payload = match payload {
            Value::Object(mut object) => {
                object.insert(
                    "sessionId".to_string(),
                    Value::String(self.session_id.clone()),
                );
                Value::Object(object)
            }
            other => json!({
                "sessionId": self.session_id,
                "data": other,
            }),
        };

        queue_event(&self.event_sender, name, payload);
    }

    fn queue_session_console(&self, level: &str, source: &str, content: String, data: Option<Value>) {
        self.queue_session_event(
            "carf://console/message",
            json!({
                "level": level,
                "source": source,
                "content": content,
                "data": data,
            }),
        );
    }
}

impl ScriptHandler for HostScriptHandler {
    fn on_message(&mut self, message: Message, _data: Option<Vec<u8>>) {
        match message {
            Message::Log(log) => {
                let level = match log.level {
                    MessageLogLevel::Info => "info",
                    MessageLogLevel::Debug => "debug",
                    MessageLogLevel::Warning => "warn",
                    MessageLogLevel::Error => "error",
                };
                self.queue_session_console(level, "agent", log.payload, None);
            }
            Message::Error(error) => {
                self.queue_session_console(
                    "error",
                    "agent",
                    error.description.clone(),
                    Some(json!({
                        "description": error.description,
                        "stack": error.stack,
                        "fileName": error.file_name,
                        "lineNumber": error.line_number,
                        "columnNumber": error.column_number,
                    })),
                );
            }
            Message::Other(value) => {
                let raw = value
                    .get("data")
                    .and_then(Value::as_str)
                    .and_then(|data| serde_json::from_str::<Value>(data).ok());

                if let Some(raw) = raw {
                    self.handle_raw_message(raw);
                } else {
                    self.queue_session_console(
                        "warn",
                        "agent",
                        "Failed to decode script message".to_string(),
                        Some(value),
                    );
                }
            }
            Message::Send(_) => {}
        }
    }
}
