import { For, Show, createEffect } from "solid-js";
import { Folder, Database, FileCode, File } from "lucide-solid";
import {
  filesystemState,
  selectFilesystemFile,
  navigateUp,
  setSqliteQuery,
  fetchDirectory,
  readFileContent,
  querySqlite,
  fetchSqliteTables,
  downloadFile,
} from "./filesystem.store";
import { activeSession } from "~/features/session/session.store";
import { SplitPane } from "~/components/SplitPane";
import { CopyButton } from "~/components/CopyButton";
import { cn } from "~/lib/cn";
import { formatSize } from "~/lib/format";
import { invoke } from "~/lib/tauri";

function initialFilesystemPaths(identifier: string | null): string[] {
  const candidates: string[] = [];

  if (identifier && identifier.includes(".")) {
    candidates.push(`/data/user/0/${identifier}`);
    candidates.push(`/data/data/${identifier}`);
  }

  candidates.push("/proc/self", "/sdcard", "/");
  return candidates;
}

function FilesTab() {
  createEffect(() => {
    const session = activeSession();
    if (!session) return;

    void (async () => {
      let packageIdentifier = session.identifier;

      if (!packageIdentifier) {
        try {
          const resolvedIdentifier = await invoke<string | null>("rpc_call", {
            sessionId: session.id,
            method: "getAndroidPackageName",
            params: {},
          });
          packageIdentifier = resolvedIdentifier ?? null;
        } catch {
          packageIdentifier = null;
        }
      }

      for (const path of initialFilesystemPaths(packageIdentifier)) {
        const opened = await fetchDirectory(session.id, path);
        if (opened) {
          return;
        }
      }
    })();
  });

  async function handleEntryClick(entry: (typeof filesystemState.entries)[number]): Promise<void> {
    const session = activeSession();
    if (!session) return;
    if (entry.type === "directory") {
      await fetchDirectory(session.id, entry.path);
      return;
    }

    if (entry.type === "symlink") {
      const openedAsDirectory = await fetchDirectory(session.id, entry.path);
      if (openedAsDirectory) {
        selectFilesystemFile(null);
        return;
      }
    }

    if (entry.name.endsWith(".db") || entry.name.endsWith(".sqlite")) {
      selectFilesystemFile(entry);
      void fetchSqliteTables(session.id, entry.path);
    } else {
      selectFilesystemFile(entry);
      void readFileContent(session.id, entry.path);
    }
  }

  function handleNavigateUp(): void {
    const session = activeSession();
    navigateUp();
    if (!session) return;
    const parts = filesystemState.currentPath.split("/").filter(Boolean);
    parts.pop();
    const newPath = parts.length === 0 ? "/" : `/${parts.join("/")}`;
    void fetchDirectory(session.id, newPath);
  }

  function handleExecuteQuery(): void {
    const session = activeSession();
    const file = filesystemState.selectedFile;
    if (!session || !file) return;
    void querySqlite(session.id, file.path, filesystemState.sqliteQuery);
  }

  function handleTableClick(table: string): void {
    const session = activeSession();
    const file = filesystemState.selectedFile;
    const query = `SELECT * FROM ${table} LIMIT 100`;
    setSqliteQuery(query);
    if (!session || !file) return;
    void querySqlite(session.id, file.path, query);
  }

  return (
    <div class="flex h-full flex-col">
      {/* Header */}
      <div class="flex items-center justify-between border-b px-4 py-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">File Explorer</span>
        </div>
        <div class="flex items-center gap-1">
          <button
            class="cursor-pointer rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            onClick={handleNavigateUp}
          >
            Up
          </button>
        </div>
      </div>

      {/* Path bar */}
      <div class="flex items-center gap-1 border-b px-4 py-1">
        <span class="font-mono text-xs text-muted-foreground">
          {filesystemState.currentPath}
        </span>
        <CopyButton value={filesystemState.currentPath} />
      </div>

      {/* Split: File tree (left) + Preview (right) */}
      <SplitPane
        id="filesystem"
        minLeft={200}
        maxLeft={450}
        defaultLeft={300}
        left={
          <div class="h-full overflow-auto border-r">
            <Show
              when={!filesystemState.entriesLoading}
              fallback={
                <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
                  Loading...
                </div>
              }
            >
              <For each={filesystemState.entries}>
                {(entry) => {
                  const isSelected = () =>
                    filesystemState.selectedFile?.path === entry.path;
                  const isDir = () => entry.type === "directory";

                  return (
                    <button
                      class={cn(
                        "group/row flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover",
                        isSelected() && "bg-muted",
                      )}
                      onClick={() => handleEntryClick(entry)}
                    >
                      <span class="shrink-0">
                        {isDir() ? (
                          <Folder size={14} class="text-primary" />
                        ) : entry.name.endsWith(".db") ||
                          entry.name.endsWith(".sqlite") ? (
                          <Database size={14} class="text-warning" />
                        ) : entry.name.endsWith(".xml") ? (
                          <FileCode size={14} class="text-success" />
                        ) : (
                          <File size={14} class="text-muted-foreground" />
                        )}
                      </span>
                      <span class="flex-1 truncate">{entry.name}</span>
                      <span class="shrink-0 text-muted-foreground">
                        {entry.permissions}
                      </span>
                      <span class="w-16 shrink-0 text-right text-muted-foreground">
                        {isDir() ? "" : formatSize(entry.size)}
                      </span>
                    </button>
                  );
                }}
              </For>

              <Show when={filesystemState.entries.length === 0}>
                <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
                  Empty directory or not loaded
                </div>
              </Show>
            </Show>
          </div>
        }
        right={
          <div class="h-full overflow-auto">
            <Show
              when={filesystemState.selectedFile}
              fallback={
                <div class="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Select a file to preview
                </div>
              }
            >
              {(file) => (
                <div class="flex h-full flex-col">
                  {/* File info */}
                  <div class="border-b px-4 py-2">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1">
                        <span class="font-mono text-xs font-medium">
                          {file().name}
                        </span>
                        <CopyButton value={file().name} />
                      </div>
                      <button
                        class="cursor-pointer rounded px-2 py-0.5 text-xs text-primary hover:bg-primary/10"
                        onClick={() => {
                          const s = activeSession();
                          if (s) void downloadFile(s.id, file().path);
                        }}
                      >
                        Download
                      </button>
                    </div>
                    <span class="text-[10px] text-muted-foreground">
                      {formatSize(file().size)} &middot; {file().permissions}
                    </span>
                  </div>

                  {/* Content */}
                  <div class="flex-1 overflow-auto">
                    <Show
                      when={
                        file().name.endsWith(".db") ||
                        file().name.endsWith(".sqlite")
                      }
                    >
                      {/* SQLite browser */}
                      <div class="p-4">
                        <div class="mb-2 text-xs font-medium text-muted-foreground">
                          SQLite Browser
                        </div>
                        <div class="mb-2 flex gap-2">
                          <For each={filesystemState.sqliteTables}>
                            {(table) => (
                              <button
                                class="cursor-pointer rounded bg-muted px-2 py-0.5 text-xs hover:bg-surface-hover"
                                onClick={() => handleTableClick(table)}
                              >
                                {table}
                              </button>
                            )}
                          </For>
                        </div>
                        <div class="flex gap-2">
                          <input
                            type="text"
                            class="flex-1 rounded border bg-background px-2 py-1 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
                            placeholder="SQL query..."
                            value={filesystemState.sqliteQuery}
                            onInput={(e) => setSqliteQuery(e.currentTarget.value)}
                          />
                          <button
                            class="cursor-pointer rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                            onClick={handleExecuteQuery}
                          >
                            Execute
                          </button>
                        </div>

                        <Show when={filesystemState.sqliteResult}>
                          {(result) => (
                            <div class="mt-3 overflow-auto">
                              <table class="w-full text-xs">
                                <thead>
                                  <tr class="border-b">
                                    <For each={result().columns}>
                                      {(col) => (
                                        <th class="px-2 py-1 text-left font-medium text-muted-foreground">
                                          {col}
                                        </th>
                                      )}
                                    </For>
                                  </tr>
                                </thead>
                                <tbody>
                                  <For each={result().rows}>
                                    {(row) => (
                                      <tr class="border-b border-border/30 hover:bg-surface-hover">
                                        <For each={row}>
                                          {(cell) => (
                                            <td class="px-2 py-0.5 font-mono">
                                              {String(cell)}
                                            </td>
                                          )}
                                        </For>
                                      </tr>
                                    )}
                                  </For>
                                </tbody>
                              </table>
                            </div>
                          )}
                        </Show>
                      </div>
                    </Show>

                    <Show
                      when={
                        !file().name.endsWith(".db") &&
                        !file().name.endsWith(".sqlite")
                      }
                    >
                      <Show
                        when={!filesystemState.fileLoading}
                        fallback={
                          <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
                            Loading file...
                          </div>
                        }
                      >
                        <Show
                          when={filesystemState.fileContent}
                          fallback={
                            <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
                              Click to load file content
                            </div>
                          }
                        >
                          <pre class="p-4 font-mono text-xs">
                            {filesystemState.fileContent}
                          </pre>
                        </Show>
                      </Show>
                    </Show>
                  </div>
                </div>
              )}
            </Show>
          </div>
        }
      />
    </div>
  );
}

export default FilesTab;
