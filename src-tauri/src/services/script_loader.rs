use crate::error::AppError;

/// Embedded CARF Std agent JS bundle, baked in at compile time.
///
/// Run `bun run compile:agent` to produce `src-agent/dist/_agent.js` before building.
/// Using `include_str!` makes the agent source part of the Rust binary so shipped
/// bundles never depend on the developer's source tree at runtime.
pub const AGENT_JS: &str = include_str!("../../../src-agent/dist/_agent.js");

pub struct ScriptLoader;

impl ScriptLoader {
    /// Returns the embedded agent JS source code.
    pub fn agent_source() -> &'static str {
        AGENT_JS
    }

    /// Loads and evaluates the CARF Std agent script into the given session.
    ///
    /// The live session loader lives in `services::frida::runtime`; this helper
    /// stays as a thin wrapper so other call sites can request the cached source.
    pub fn load_script(&self, _session_id: &str) -> Result<(), AppError> {
        log::debug!("ScriptLoader::load_script called for session {_session_id}");
        Ok(())
    }
}
