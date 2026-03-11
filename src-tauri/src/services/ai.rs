use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::error::AppError;

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

    let output = cmd
        .output()
        .map_err(|e| AppError::AiProviderError(format!("Failed to spawn claude: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::AiProviderError(format!(
            "claude exited with {}: {stderr}",
            output.status
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

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

    let output = cmd
        .output()
        .map_err(|e| AppError::AiProviderError(format!("Failed to spawn codex: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::AiProviderError(format!(
            "codex exited with {}: {stderr}",
            output.status
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
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
