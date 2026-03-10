import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";

const IS_TAURI =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!IS_TAURI) {
    throw new Error(`Tauri not available: ${cmd}`);
  }
  return tauriInvoke<T>(cmd, args);
}

export function listen<T>(
  event: string,
  handler: (payload: T) => void,
): () => void {
  if (!IS_TAURI) {
    return () => {};
  }
  let unlisten: (() => void) | undefined;
  let disposed = false;
  tauriListen<T>(event, (e) => handler(e.payload)).then((fn) => {
    if (disposed) {
      fn();
    } else {
      unlisten = fn;
    }
  });
  return () => {
    disposed = true;
    unlisten?.();
  };
}

export function isTauri(): boolean {
  return IS_TAURI;
}
