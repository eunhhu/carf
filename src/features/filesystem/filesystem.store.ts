import { createStore } from "solid-js/store";
import type { FileEntry } from "~/lib/types";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { invoke } from "~/lib/tauri";

interface SqliteQueryResult {
  columns: string[];
  rows: unknown[][];
}

interface FilesystemState {
  currentPath: string;
  entries: FileEntry[];
  entriesLoading: boolean;
  selectedFile: FileEntry | null;
  fileContent: string | null;
  fileLoading: boolean;
  sqliteTables: string[];
  sqliteResult: SqliteQueryResult | null;
  sqliteQuery: string;
  sqliteLoading: boolean;
}

const DEFAULT_STATE: FilesystemState = {
  currentPath: "/",
  entries: [],
  entriesLoading: false,
  selectedFile: null,
  fileContent: null,
  fileLoading: false,
  sqliteTables: [],
  sqliteResult: null,
  sqliteQuery: "",
  sqliteLoading: false,
};

const [state, setState] = createStore<FilesystemState>({
  ...DEFAULT_STATE,
});

function setPath(path: string): void {
  setState({ currentPath: path, entries: [], entriesLoading: true });
}

function setEntries(entries: FileEntry[]): void {
  setState({ entries, entriesLoading: false });
}

function selectFile(file: FileEntry | null): void {
  setState({ selectedFile: file, fileContent: null });
}

function setFileContent(content: string): void {
  setState({ fileContent: content, fileLoading: false });
}

function setFileLoading(loading: boolean): void {
  setState("fileLoading", loading);
}

function setSqliteTables(tables: string[]): void {
  setState("sqliteTables", tables);
}

function setSqliteResult(result: SqliteQueryResult | null): void {
  setState({ sqliteResult: result, sqliteLoading: false });
}

function setSqliteQuery(query: string): void {
  setState("sqliteQuery", query);
}

function setSqliteLoading(loading: boolean): void {
  setState("sqliteLoading", loading);
}

function resetFilesystemState(): void {
  setState(restoreStore(DEFAULT_STATE));
}

function snapshotFilesystemState(): FilesystemState {
  return snapshotStore(state);
}

function restoreFilesystemState(snapshot?: FilesystemState): void {
  setState(restoreStore(snapshot ?? DEFAULT_STATE));
}

function navigateUp(): void {
  const parts = state.currentPath.split("/").filter(Boolean);
  parts.pop();
  setPath(parts.length === 0 ? "/" : `/${parts.join("/")}`);
}

async function fetchDirectory(sessionId: string, path: string): Promise<boolean> {
  setState({ entries: [], entriesLoading: true });
  try {
    const entries = await invoke<FileEntry[]>("rpc_call", {
      sessionId,
      method: "listDirectory",
      params: { path },
    });
    setState({ currentPath: path, entries: entries ?? [], entriesLoading: false });
    return true;
  } catch (err) {
    console.error("[filesystem] fetchDirectory failed:", err);
    setState({ entries: [], entriesLoading: false });
    return false;
  }
}

async function readFileContent(
  sessionId: string,
  path: string,
  encoding: "hex" | "utf8" = "utf8",
): Promise<void> {
  setState({ fileContent: null, fileLoading: true });
  try {
    const content = await invoke<string>("rpc_call", {
      sessionId,
      method: "readFile",
      params: { path, encoding },
    });
    setState({ fileContent: content ?? "", fileLoading: false });
  } catch (err) {
    console.error("[filesystem] readFileContent failed:", err);
    setState({ fileContent: null, fileLoading: false });
  }
}

async function querySqlite(
  sessionId: string,
  path: string,
  query: string,
): Promise<void> {
  setState("sqliteLoading", true);
  try {
    const result = await invoke<SqliteQueryResult>("rpc_call", {
      sessionId,
      method: "sqliteQuery",
      params: { path, query },
    });
    setState({ sqliteResult: result ?? null, sqliteLoading: false });
  } catch (err) {
    console.error("[filesystem] querySqlite failed:", err);
    setState({ sqliteResult: null, sqliteLoading: false });
  }
}

async function fetchSqliteTables(sessionId: string, path: string): Promise<void> {
  try {
    const tables = await invoke<string[]>("rpc_call", {
      sessionId,
      method: "sqliteTables",
      params: { path },
    });
    setState("sqliteTables", tables ?? []);
  } catch (err) {
    console.error("[filesystem] fetchSqliteTables failed:", err);
    setState("sqliteTables", []);
  }
}

async function downloadFile(sessionId: string, path: string): Promise<void> {
  try {
    const content = await invoke<string>("rpc_call", {
      sessionId,
      method: "readFile",
      params: { path, encoding: "utf8" },
    });
    if (content == null) return;
    const filename = path.split("/").pop() ?? "download";
    const blob = new Blob([content], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("[filesystem] downloadFile failed:", err);
  }
}

export {
  state as filesystemState,
  setPath as setFilesystemPath,
  setEntries as setFilesystemEntries,
  selectFile as selectFilesystemFile,
  setFileContent,
  setFileLoading,
  setSqliteTables,
  setSqliteResult,
  setSqliteQuery,
  setSqliteLoading,
  resetFilesystemState,
  navigateUp,
  fetchDirectory,
  readFileContent,
  querySqlite,
  fetchSqliteTables,
  downloadFile,
  snapshotFilesystemState,
  restoreFilesystemState,
};
