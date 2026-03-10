import type { HookConfig, PinItem } from "~/lib/types";
import { pinboardState, importPins, clearPins } from "~/features/pinboard/pinboard.store";
import { exportHookConfigs } from "~/features/hooks/hooks.store";

const PINBOARD_KEY = "carf:pinboard";
const HOOKS_KEY = "carf:hooks";

interface SessionSnapshot {
  version: "1.0";
  timestamp: number;
  pinboard: PinItem[];
  hookConfigs: HookConfig[];
}

/** Save current Pinboard + Hook configs to localStorage */
export function saveSessionState(): void {
  try {
    localStorage.setItem(PINBOARD_KEY, JSON.stringify(pinboardState.items));
    localStorage.setItem(
      HOOKS_KEY,
      JSON.stringify(exportHookConfigs()),
    );
  } catch {
    // ignore storage errors
  }
}

/** Restore Pinboard items from localStorage */
export function restorePinboard(): number {
  try {
    const stored = localStorage.getItem(PINBOARD_KEY);
    if (!stored) return 0;
    return importPins(stored);
  } catch {
    return 0;
  }
}

/** Get saved hook configs from localStorage (caller applies via importHookConfigs) */
export function getSavedHookConfigs(): HookConfig[] {
  try {
    const stored = localStorage.getItem(HOOKS_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as HookConfig[];
  } catch {
    return [];
  }
}

/** Export full session snapshot as JSON string */
export function exportSessionSnapshot(): string {
  const snapshot: SessionSnapshot = {
    version: "1.0",
    timestamp: Date.now(),
    pinboard: [...pinboardState.items],
    hookConfigs: exportHookConfigs(),
  };
  return JSON.stringify(snapshot, null, 2);
}

/** Import session snapshot from JSON string */
export function importSessionSnapshot(json: string): {
  pinsImported: number;
  hookConfigs: HookConfig[];
} {
  const snapshot = JSON.parse(json) as SessionSnapshot;
  clearPins();
  const pinsImported = importPins(JSON.stringify(snapshot.pinboard));
  return { pinsImported, hookConfigs: snapshot.hookConfigs };
}

/** Clear all saved session state */
export function clearSavedState(): void {
  localStorage.removeItem(PINBOARD_KEY);
  localStorage.removeItem(HOOKS_KEY);
}
