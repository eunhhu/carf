import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { addSession, setAppView } from "~/features/session/session.store";
import { scheduleTransition } from "~/lib/scheduling";
import { invoke } from "~/lib/tauri";
import type {
	AppInfo,
	AttachOptions,
	ProcessInfo,
	SessionInfo,
	SpawnOptions,
} from "~/lib/types";

type ShowMode = "processes" | "apps";

interface SelectedTarget {
	type: "process" | "app";
	pid?: number;
	identifier?: string;
}

interface CollectionPage<T> {
	items: T[];
	total: number;
	limit: number;
	truncated: boolean;
	query?: string | null;
}

interface RefreshOptions {
	forceRefresh?: boolean;
}

interface ProcessState {
	processesTotal: number;
	processesTruncated: boolean;
	applicationsTotal: number;
	applicationsTruncated: boolean;
	selectedTarget: SelectedTarget | null;
	loading: boolean;
	error: string | null;
	searchQuery: string;
	showMode: ShowMode;
}

const DEFAULT_LIST_LIMIT = 200;
const requestVersions = {
	processes: 0,
	applications: 0,
};

const [processes, setProcesses] = createSignal<ProcessInfo[]>([]);
const [applications, setApplications] = createSignal<AppInfo[]>([]);

const [state, setState] = createStore<ProcessState>({
	processesTotal: 0,
	processesTruncated: false,
	applicationsTotal: 0,
	applicationsTruncated: false,
	selectedTarget: null,
	loading: false,
	error: null,
	searchQuery: "",
	showMode: "processes",
});

function normalizeSearchQuery(query: string): string | undefined {
	const trimmed = query.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function beginRequest(kind: keyof typeof requestVersions): number {
	requestVersions[kind] += 1;
	return requestVersions[kind];
}

function isCurrentRequest(
	kind: keyof typeof requestVersions,
	requestId: number,
): boolean {
	return requestVersions[kind] === requestId;
}

async function refreshProcesses(
	deviceId: string,
	query = state.searchQuery,
	options?: RefreshOptions,
): Promise<void> {
	const requestId = beginRequest("processes");
	setState({ loading: true, error: null });
	try {
		const result = await invoke<CollectionPage<ProcessInfo>>("list_processes", {
			deviceId,
			query: normalizeSearchQuery(query),
			limit: DEFAULT_LIST_LIMIT,
			forceRefresh: options?.forceRefresh ?? false,
		});
		if (!isCurrentRequest("processes", requestId)) {
			return;
		}
		scheduleTransition(() => {
			if (!isCurrentRequest("processes", requestId)) {
				return;
			}
			setProcesses(result.items);
			setState({
				processesTotal: result.total,
				processesTruncated: result.truncated,
				loading: false,
			});
		});
	} catch (err) {
		if (!isCurrentRequest("processes", requestId)) {
			return;
		}
		setState({
			loading: false,
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

async function refreshApplications(
	deviceId: string,
	query = state.searchQuery,
	options?: RefreshOptions,
): Promise<void> {
	const requestId = beginRequest("applications");
	setState({ loading: true, error: null });
	try {
		const result = await invoke<CollectionPage<AppInfo>>("list_applications", {
			deviceId,
			query: normalizeSearchQuery(query),
			limit: DEFAULT_LIST_LIMIT,
			forceRefresh: options?.forceRefresh ?? false,
		});
		if (!isCurrentRequest("applications", requestId)) {
			return;
		}
		scheduleTransition(() => {
			if (!isCurrentRequest("applications", requestId)) {
				return;
			}
			setApplications(result.items);
			setState({
				applicationsTotal: result.total,
				applicationsTruncated: result.truncated,
				loading: false,
			});
		});
	} catch (err) {
		if (!isCurrentRequest("applications", requestId)) {
			return;
		}
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
	scheduleTransition(() => {
		setState({ showMode: mode, selectedTarget: null, searchQuery: "" });
	});
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
		scheduleTransition(() => {
			setState({ loading: false });
		});
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
		scheduleTransition(() => {
			setState({ loading: false });
		});
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
	processes,
	applications,
	state as processState,
	refreshProcesses,
	refreshApplications,
	selectTarget,
	setSearchQuery,
	setShowMode,
	killProcess,
	attachToProcess,
	spawnAndAttach,
};
