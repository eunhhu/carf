use crate::error::AppError;

/// Embedded CARF Std agent JS bundle.
/// Falls back to an empty string during development if the agent hasn't been compiled yet.
/// Run `bun run compile:agent` to produce `src-agent/dist/_agent.js`.
const AGENT_JS: &str = {
    // Use include_str! with a fallback via cfg:
    // If the agent dist file doesn't exist at compile time we fall back to an empty stub.
    // The real integration path: include_str!("../../../src-agent/dist/_agent.js")
    // TODO: replace the empty string below with the include_str! macro once the agent is compiled:
    // include_str!("../../../src-agent/dist/_agent.js")
    ""
};

pub struct ScriptLoader;

impl ScriptLoader {
    /// Returns the embedded agent JS source code.
    pub fn agent_source() -> &'static str {
        AGENT_JS
    }

    /// Loads and evaluates the CARF Std agent script into the given session.
    ///
    /// TODO: replace stub with actual frida-rust Script creation:
    /// ```
    /// let source = Self::agent_source();
    /// let script_options = frida::ScriptOption::default();
    /// let script = session.create_script(source, &mut script_options)?;
    /// script.load()?;
    /// // wire up `script.connect_signal::<frida::ScriptMessageHandler>(...)`
    /// ```
    pub fn load_script(&self, _session_id: &str) -> Result<(), AppError> {
        // TODO: implement once frida-rust Session handle is available in SessionHandle
        log::info!("ScriptLoader::load_script called for session {_session_id} (stub)");

        if AGENT_JS.is_empty() {
            log::warn!(
                "Agent JS is empty – run `bun run compile:agent` to build src-agent/dist/_agent.js"
            );
        }

        Ok(())
    }
}
