import { createStore } from "solid-js/store";
import { createMemo } from "solid-js";
import type { ProcessInfo, AppInfo, SessionInfo, AttachOptions, SpawnOptions } from "~/lib/types";
import { invoke } from "~/lib/tauri";
import { addSession, setAppView } from "~/features/session/session.store";

type ShowMode = "processes" | "apps";

interface SelectedTarget {
  type: "process" | "app";
  pid?: number;
  identifier?: string;
}

interface ProcessState {
  processes: ProcessInfo[];
  applications: AppInfo[];
  selectedTarget: SelectedTarget | null;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  showMode: ShowMode;
}

const [state, setState] = createStore<ProcessState>({
  processes: [],
  applications: [],
  selectedTarget: null,
  loading: false,
  error: null,
  searchQuery: "",
  showMode: "processes",
});

const filteredProcesses = createMemo(() => {
  const q = state.searchQuery.toLowerCase();
  if (!q) return state.processes;
  return state.processes.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      String(p.pid).includes(q) ||
      (p.identifier?.toLowerCase().includes(q) ?? false),
  );
});

const filteredApplications = createMemo(() => {
  const q = state.searchQuery.toLowerCase();
  if (!q) return state.applications;
  return state.applications.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.identifier.toLowerCase().includes(q),
  );
});

async function refreshProcesses(deviceId: string): Promise<void> {
  setState({ loading: true, error: null });
  try {
    const processes = await invoke<ProcessInfo[]>("list_processes", { deviceId });
    setState({ processes, loading: false });
  } catch (err) {
    setState({
      loading: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function refreshApplications(deviceId: string): Promise<void> {
  setState({ loading: true, error: null });
  try {
    const applications = await invoke<AppInfo[]>("list_applications", { deviceId });
    setState({ applications, loading: false });
  } catch (err) {
    setState({
      loading: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function selectTarget(target: SelectedTarget | null): void {
  setState("selectedTarget", target);
}

function setSearchQuery(query: string): void {
  setState("searchQuery", query);
}

function setShowMode(mode: ShowMode): void {
  setState({ showMode: mode, selectedTarget: null, searchQuery: "" });
}

async function killProcess(deviceId: string, pid: number): Promise<void> {
  try {
    await invoke("kill_process", { deviceId, pid });
  } catch (err) {
    setState({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function attachToProcess(
  deviceId: string,
  target: SelectedTarget,
  options?: Partial<AttachOptions>,
): Promise<void> {
  setState({ loading: true, error: null });
  try {
    const attachOptions: AttachOptions = {
      target: target.pid ?? target.identifier ?? 0,
      realm: options?.realm,
      runtime: options?.runtime,
      persistTimeout: options?.persistTimeout,
      enableChildGating: options?.enableChildGating,
      scriptPath: options?.scriptPath,
    };
    const session = await invoke<SessionInfo>("attach", {
      deviceId,
      options: attachOptions,
    });
    setState({ loading: false });
    addSession(session);
    setAppView("session");
  } catch (err) {
    setState({
      loading: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function spawnAndAttach(
  deviceId: string,
  identifier: string,
  options?: Partial<SpawnOptions>,
): Promise<void> {
  setState({ loading: true, error: null });
  try {
    const spawnOptions: SpawnOptions = {
      identifier,
      argv: options?.argv,
      envp: options?.envp,
      cwd: options?.cwd,
      stdio: options?.stdio,
      autoResume: options?.autoResume,
      realm: options?.realm,
      persistTimeout: options?.persistTimeout,
      runtime: options?.runtime,
      enableChildGating: options?.enableChildGating,
      scriptPath: options?.scriptPath,
    };
    const session = await invoke<SessionInfo>("spawn_and_attach", {
      deviceId,
      options: spawnOptions,
    });
    setState({ loading: false });
    addSession(session);
    setAppView("session");
  } catch (err) {
    setState({
      loading: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export {
  state as processState,
  filteredProcesses,
  filteredApplications,
  refreshProcesses,
  refreshApplications,
  selectTarget,
  setSearchQuery,
  setShowMode,
  killProcess,
  attachToProcess,
  spawnAndAttach,
};
