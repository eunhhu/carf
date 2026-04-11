use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Hard limit for AI CLI subprocess runs. Passed from the request or defaults to
/// two minutes — long enough for tool-using turns, short enough to avoid hung
/// subprocesses holding a blocking thread forever.
const DEFAULT_AI_TIMEOUT: Duration = Duration::from_secs(120);

/// Run a `Command` to completion with a hard timeout. Returns captured stdout
/// and stderr on success. On timeout the child is killed and an error surfaces.
fn run_with_timeout(
    mut command: Command,
    timeout: Duration,
) -> Result<(std::process::ExitStatus, Vec<u8>, Vec<u8>), AppError> {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|e| AppError::AiProviderError(format!("Failed to spawn AI CLI: {e}")))?;

    // Stream stdout and stderr on dedicated threads so a pipe-full child cannot
    // block us while the timeout clock runs.
    let mut stdout = child.stdout.take();
    let mut stderr = child.stderr.take();

    let (stdout_tx, stdout_rx) = mpsc::channel();
    let stdout_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut pipe) = stdout.take() {
            let _ = pipe.read_to_end(&mut buf);
        }
        let _ = stdout_tx.send(buf);
    });

    let (stderr_tx, stderr_rx) = mpsc::channel();
    let stderr_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut pipe) = stderr.take() {
            let _ = pipe.read_to_end(&mut buf);
        }
        let _ = stderr_tx.send(buf);
    });

    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = stdout_handle.join();
                    let _ = stderr_handle.join();
                    return Err(AppError::AiProviderError(format!(
                        "AI CLI exceeded timeout of {}s",
                        timeout.as_secs()
                    )));
                }
                thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                return Err(AppError::AiProviderError(format!(
                    "Failed to poll AI CLI process: {e}"
                )));
            }
        }
    };

    let _ = stdout_handle.join();
    let _ = stderr_handle.join();
    let stdout_bytes = stdout_rx.recv().unwrap_or_default();
    let stderr_bytes = stderr_rx.recv().unwrap_or_default();
    Ok((status, stdout_bytes, stderr_bytes))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatRequest {
    pub provider: AiProvider,
    pub system_prompt: String,
    pub user_message: String,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    Claude,
    Codex,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatResponse {
    pub content: String,
    pub provider: AiProvider,
    pub duration_ms: u64,
    pub model: Option<String>,
    pub cost_usd: Option<f64>,
}

/// Chat with an AI provider by spawning the local CLI as a subprocess.
pub fn chat(request: &AiChatRequest) -> Result<AiChatResponse, AppError> {
    let start = std::time::Instant::now();

    let content = match request.provider {
        AiProvider::Claude => chat_claude(request)?,
        AiProvider::Codex => chat_codex(request)?,
    };

    let duration_ms = start.elapsed().as_millis() as u64;

    Ok(AiChatResponse {
        content,
        provider: request.provider,
        duration_ms,
        model: request.model.clone(),
        cost_usd: None,
    })
}

fn chat_claude(request: &AiChatRequest) -> Result<String, AppError> {
    let claude_bin = which_cli("claude")?;
    let model = request.model.as_deref().unwrap_or("sonnet");

    let mut cmd = Command::new(claude_bin);
    cmd.arg("-p")
        .arg("--output-format")
        .arg("json")
        .arg("--no-session-persistence")
        .arg("--model")
        .arg(model)
        // Disable all tool use: passing an explicit empty string to
        // --allowedTools can be silently ignored by some CLI versions.
        // Using "none" is the safest way to ensure no tools are invoked.
        .arg("--allowedTools")
        .arg("none")
        .arg("--system-prompt")
        .arg(&request.system_prompt)
        // `--` terminates option parsing so a user message starting with `--`
        // is never misinterpreted as a flag by the CLI argument parser.
        .arg("--")
        .arg(&request.user_message);

    let (status, stdout_bytes, stderr_bytes) = run_with_timeout(cmd, DEFAULT_AI_TIMEOUT)?;

    if !status.success() {
        let stderr = String::from_utf8_lossy(&stderr_bytes);
        return Err(AppError::AiProviderError(format!(
            "claude exited with {status}: {stderr}"
        )));
    }

    let stdout = String::from_utf8_lossy(&stdout_bytes);

    // Claude --output-format json returns { "result": "...", ... }
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&stdout) {
        if let Some(result) = parsed.get("result").and_then(|v| v.as_str()) {
            return Ok(result.to_string());
        }
    }

    // Fallback: return raw stdout
    Ok(stdout.trim().to_string())
}

fn chat_codex(request: &AiChatRequest) -> Result<String, AppError> {
    let codex_bin = which_cli("codex")?;

    // Codex exec receives a single prompt combining system + user
    let full_prompt = format!(
        "{}\n\n---\n\nUser request:\n{}",
        request.system_prompt, request.user_message
    );

    let mut cmd = Command::new(codex_bin);
    // SECURITY: `--dangerously-bypass-approvals-and-sandbox` disables Codex's
    // interactive approval prompts and filesystem sandbox.  This is required
    // because CARF runs the CLI non-interactively (no TTY), but it means the
    // model can execute arbitrary commands on the host.  The frontend MUST warn
    // the user before invoking the Codex provider, and the system prompt MUST
    // constrain the model to analysis-only tasks (no writes / no shell).
    cmd.arg("exec")
        .arg("--ephemeral")
        .arg("--dangerously-bypass-approvals-and-sandbox");

    if let Some(model) = &request.model {
        cmd.arg("--model").arg(model);
    }

    cmd.arg(&full_prompt);

    let (status, stdout_bytes, stderr_bytes) = run_with_timeout(cmd, DEFAULT_AI_TIMEOUT)?;

    if !status.success() {
        let stderr = String::from_utf8_lossy(&stderr_bytes);
        return Err(AppError::AiProviderError(format!(
            "codex exited with {status}: {stderr}"
        )));
    }

    let stdout = String::from_utf8_lossy(&stdout_bytes);
    Ok(stdout.trim().to_string())
}

/// Locate a CLI binary in PATH.
///
/// Uses `where` on Windows and `which` on Unix for cross-platform support.
fn which_cli(name: &str) -> Result<String, AppError> {
    let output = if cfg!(target_os = "windows") {
        Command::new("where").arg(name).output()
    } else {
        Command::new("which").arg(name).output()
    };

    let output = output
        .map_err(|e| AppError::AiProviderError(format!("Failed to locate {name}: {e}")))?;

    if !output.status.success() {
        return Err(AppError::AiProviderError(format!(
            "{name} CLI not found in PATH. Please install it first."
        )));
    }

    // `where` on Windows may return multiple lines; take the first match.
    let path = String::from_utf8_lossy(&output.stdout)
        .trim()
        .lines()
        .next()
        .unwrap_or(name)
        .to_string();

    Ok(path)
}
