import { registerHandler } from "../rpc/router";
import { emitLog } from "../rpc/protocol";

// SECURITY NOTE: evaluate() is intentionally designed to execute arbitrary code.
// CARF is a Frida-based dynamic analysis tool — the agent runs inside the target
// process, and REPL evaluation is a core instrumentation feature. This is NOT a
// web application; there is no untrusted user input risk here.

registerHandler("evaluate", (params: unknown) => {
  const { code } = params as { code: string };

  try {
    // Use the global Script.evaluate or fallback to indirect eval
    // eslint-disable-next-line no-eval
    const result = (0, eval)(code);

    // If result is a Promise, handle async
    if (result && typeof result === "object" && typeof result.then === "function") {
      return (result as Promise<unknown>).then((value: unknown) => {
        const output = formatResult(value);
        emitLog("info", output);
        return output;
      });
    }

    const output = formatResult(result);
    emitLog("info", output);
    return output;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    emitLog("error", message);
    throw e;
  }
});

function formatResult(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
