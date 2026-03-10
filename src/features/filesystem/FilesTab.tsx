import { For, Show, createEffect } from "solid-js";
import {
  filesystemState,
  selectFilesystemFile,
  navigateUp,
  setSqliteQuery,
  fetchDirectory,
  readFileContent,
  querySqlite,
  fetchSqliteTables,
} from "./filesystem.store";
import { activeSession } from "~/features/session/session.store";
import { cn } from "~/lib/cn";
import { formatSize } from "~/lib/format";

function FilesTab() {
  createEffect(() => {
    const session = activeSession();
    if (!session) return;
    void fetchDirectory(session.id, "/data/data/");
  });

  function handleEntryClick(entry: (typeof filesystemState.entries)[number]): void {
    const session = activeSession();
    if (!session) return;
    if (entry.type === "directory") {
      void fetchDirectory(session.id, entry.path);
    } else if (entry.name.endsWith(".db") || entry.name.endsWith(".sqlite")) {
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
            class="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            onClick={handleNavigateUp}
          >
            Up
          </button>
        </div>
      </div>

      {/* Path bar */}
      <div class="flex items-center border-b px-4 py-1">
        <span class="font-mono text-xs text-muted-foreground">
          {filesystemState.currentPath}
        </span>
      </div>

      {/* Split: File tree (left) + Preview (right) */}
      <div class="flex flex-1 overflow-hidden">
        {/* File list */}
        <div class="w-[40%] overflow-auto border-r">
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
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover",
                      isSelected() && "bg-muted",
                    )}
                    onClick={() => handleEntryClick(entry)}
                  >
                    <span class="shrink-0">
                      {isDir() ? (
                        <span class="text-primary">D</span>
                      ) : entry.name.endsWith(".db") ||
                        entry.name.endsWith(".sqlite") ? (
                        <span class="text-warning">B</span>
                      ) : entry.name.endsWith(".xml") ? (
                        <span class="text-success">X</span>
                      ) : (
                        <span class="text-muted-foreground">F</span>
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

        {/* File preview */}
        <div class="w-[60%] overflow-auto">
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
                    <span class="font-mono text-xs font-medium">
                      {file().name}
                    </span>
                    <button class="rounded px-2 py-0.5 text-xs text-primary hover:bg-primary/10">
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
                              class="rounded bg-muted px-2 py-0.5 text-xs hover:bg-surface-hover"
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
                          class="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
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
      </div>
    </div>
  );
}

export default FilesTab;
