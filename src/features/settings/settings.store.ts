import { createStore } from "solid-js/store";

interface PanelSizes {
  inspectorWidth: number;
  consoleHeight: number;
  navBarWidth: number;
}

interface SettingsState {
  theme: "dark" | "light";
  panels: PanelSizes;
  inspectorOpen: boolean;
  consoleOpen: boolean;
  consoleMaxMessages: number;
}

const STORAGE_KEY = "carf:settings";

function loadSettings(): SettingsState {
  const defaults: SettingsState = {
    theme: "dark",
    panels: {
      inspectorWidth: 320,
      consoleHeight: 200,
      navBarWidth: 48,
    },
    inspectorOpen: true,
    consoleOpen: true,
    consoleMaxMessages: 10_000,
  };

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) };
    }
  } catch {
    // ignore parse errors
  }
  return defaults;
}

const [state, setState] = createStore<SettingsState>(loadSettings());

function persistSettings(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

function setTheme(theme: "dark" | "light"): void {
  setState("theme", theme);
  persistSettings();
}

function setInspectorWidth(width: number): void {
  setState("panels", "inspectorWidth", width);
  persistSettings();
}

function setConsoleHeight(height: number): void {
  setState("panels", "consoleHeight", height);
  persistSettings();
}

function toggleInspector(): void {
  setState("inspectorOpen", (prev) => !prev);
  persistSettings();
}

function toggleConsole(): void {
  setState("consoleOpen", (prev) => !prev);
  persistSettings();
}

function setConsoleMaxMessages(max: number): void {
  setState("consoleMaxMessages", max);
  persistSettings();
}

export {
  state as settingsState,
  setTheme,
  setInspectorWidth,
  setConsoleHeight,
  toggleInspector,
  toggleConsole,
  setConsoleMaxMessages,
};
