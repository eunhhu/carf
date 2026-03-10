import { For, Show, createEffect } from "solid-js";
import {
  processState,
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
} from "./process.store";
import { selectedDevice } from "~/features/device/device.store";
import { setAppView } from "~/features/session/session.store";
import { cn } from "~/lib/cn";
import type { ProcessInfo, AppInfo } from "~/lib/types";

export default function ProcessPanel() {
  const device = selectedDevice;

  createEffect(() => {
    const d = device();
    if (!d) return;
    if (processState.showMode === "processes") {
      refreshProcesses(d.id);
    } else {
      refreshApplications(d.id);
    }
  });

  function handleRefresh() {
    const d = device();
    if (!d) return;
    if (processState.showMode === "processes") {
      refreshProcesses(d.id);
    } else {
      refreshApplications(d.id);
    }
  }

  function handleAttach() {
    const d = device();
    const t = processState.selectedTarget;
    if (!d || !t) return;
    attachToProcess(d.id, t);
  }

  function handleSpawn() {
    const d = device();
    const t = processState.selectedTarget;
    if (!d || !t || !t.identifier) return;
    spawnAndAttach(d.id, t.identifier);
  }

  function handleKill() {
    const d = device();
    const t = processState.selectedTarget;
    if (!d || !t || !t.pid) return;
    killProcess(d.id, t.pid);
  }

  const hasSelection = () => processState.selectedTarget !== null;
  const selectionHasPid = () => processState.selectedTarget?.pid != null;
  const selectionHasIdentifier = () =>
    processState.selectedTarget?.identifier != null;

  return (
    <div class="flex h-full flex-col bg-background">
      {/* Header toolbar */}
      <div class="flex h-10 shrink-0 items-center gap-3 border-b bg-surface px-3">
        {/* Back button */}
        <button
          class="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          onClick={() => setAppView("device")}
        >
          <span class="text-sm">&larr;</span>
          Back
        </button>

        {/* Divider */}
        <div class="h-4 w-px bg-border" />

        {/* Device info */}
        <Show when={device()}>
          {(d) => (
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-foreground">{d().name}</span>
              <Show when={d().os}>
                {(os) => (
                  <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {os().platform} {os().version}
                  </span>
                )}
              </Show>
              <Show when={d().arch}>
                <span class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {d().arch}
                </span>
              </Show>
            </div>
          )}
        </Show>

        <div class="flex-1" />

        {/* Refresh */}
        <button
          class="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          onClick={handleRefresh}
          disabled={processState.loading}
        >
          {processState.loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Content area */}
      <div class="flex flex-1 flex-col overflow-hidden">
        {/* Mode toggle + search bar */}
        <div class="flex shrink-0 items-center gap-3 border-b px-4 py-2">
          {/* Processes / Apps toggle */}
          <div class="flex rounded-lg bg-muted p-0.5">
            <button
              class={cn(
                "rounded-md px-3 py-1 text-xs transition-colors",
                processState.showMode === "processes"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setShowMode("processes")}
            >
              Processes
            </button>
            <button
              class={cn(
                "rounded-md px-3 py-1 text-xs transition-colors",
                processState.showMode === "apps"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setShowMode("apps")}
            >
              Applications
            </button>
          </div>

          {/* Count badge */}
          <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {processState.showMode === "processes"
              ? filteredProcesses().length
              : filteredApplications().length}
          </span>

          <div class="flex-1" />

          {/* Search */}
          <input
            type="text"
            class="w-56 rounded border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
            placeholder={
              processState.showMode === "processes"
                ? "Search processes..."
                : "Search applications..."
            }
            value={processState.searchQuery}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </div>

        {/* Error banner */}
        <Show when={processState.error}>
          <div class="flex shrink-0 items-center justify-between border-b border-destructive/30 bg-destructive/10 px-4 py-2">
            <p class="text-xs text-destructive">{processState.error}</p>
            <button
              class="text-xs text-destructive underline hover:no-underline"
              onClick={handleRefresh}
            >
              Retry
            </button>
          </div>
        </Show>

        {/* List */}
        <div class="flex flex-1 overflow-hidden">
          {/* Main list column */}
          <div class="flex-1 overflow-auto">
            {/* Loading */}
            <Show when={processState.loading}>
              <div class="flex h-32 items-center justify-center">
                <p class="text-sm text-muted-foreground">
                  {processState.showMode === "processes"
                    ? "Loading processes..."
                    : "Loading applications..."}
                </p>
              </div>
            </Show>

            {/* Processes list */}
            <Show when={!processState.loading && processState.showMode === "processes"}>
              <Show
                when={filteredProcesses().length > 0}
                fallback={
                  <div class="flex h-32 items-center justify-center">
                    <p class="text-sm text-muted-foreground">
                      {processState.searchQuery
                        ? "No processes match your search"
                        : "No processes found"}
                    </p>
                  </div>
                }
              >
                {/* Column headers */}
                <div class="flex items-center gap-3 border-b px-4 py-1.5">
                  <span class="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    PID
                  </span>
                  <span class="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Name
                  </span>
                  <span class="w-48 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Identifier
                  </span>
                </div>
                <For each={filteredProcesses()}>
                  {(proc) => <ProcessRow process={proc} />}
                </For>
              </Show>
            </Show>

            {/* Applications list */}
            <Show when={!processState.loading && processState.showMode === "apps"}>
              <Show
                when={filteredApplications().length > 0}
                fallback={
                  <div class="flex h-32 items-center justify-center">
                    <p class="text-sm text-muted-foreground">
                      {processState.searchQuery
                        ? "No applications match your search"
                        : "No applications found"}
                    </p>
                  </div>
                }
              >
                {/* Column headers */}
                <div class="flex items-center gap-3 border-b px-4 py-1.5">
                  <div class="w-6 shrink-0" />
                  <span class="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Name
                  </span>
                  <span class="w-48 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Identifier
                  </span>
                  <span class="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    PID
                  </span>
                </div>
                <For each={filteredApplications()}>
                  {(app) => <AppRow app={app} />}
                </For>
              </Show>
            </Show>
          </div>

          {/* Action sidebar — shown when something is selected */}
          <Show when={hasSelection()}>
            <div class="flex w-56 shrink-0 flex-col gap-3 border-l bg-surface p-4">
              <div class="flex flex-col gap-1">
                <span class="text-xs font-semibold text-foreground">
                  {processState.showMode === "processes"
                    ? processState.selectedTarget?.pid != null
                      ? `PID ${processState.selectedTarget.pid}`
                      : "Selected"
                    : processState.selectedTarget?.identifier ?? "Selected"}
                </span>
                <Show when={processState.selectedTarget?.identifier && processState.showMode === "processes"}>
                  <span class="truncate text-[10px] text-muted-foreground">
                    {processState.selectedTarget?.identifier}
                  </span>
                </Show>
              </div>

              <div class="h-px bg-border" />

              <div class="flex flex-col gap-2">
                {/* Attach — available when there's a running pid */}
                <Show when={selectionHasPid()}>
                  <button
                    class="w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    onClick={handleAttach}
                    disabled={processState.loading}
                  >
                    Attach
                  </button>
                </Show>

                {/* Spawn — available for apps */}
                <Show when={processState.showMode === "apps" && selectionHasIdentifier()}>
                  <button
                    class="w-full rounded-md border px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-hover disabled:opacity-50"
                    onClick={handleSpawn}
                    disabled={processState.loading}
                  >
                    Spawn &amp; Attach
                  </button>
                </Show>

                {/* Kill — available when there's a running pid */}
                <Show when={selectionHasPid()}>
                  <button
                    class="w-full rounded-md px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                    onClick={handleKill}
                    disabled={processState.loading}
                  >
                    Kill Process
                  </button>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

function ProcessRow(props: { process: ProcessInfo }) {
  const isSelected = () =>
    processState.selectedTarget?.type === "process" &&
    processState.selectedTarget.pid === props.process.pid;

  function handleClick() {
    selectTarget({
      type: "process",
      pid: props.process.pid,
      identifier: props.process.identifier ?? undefined,
    });
  }

  return (
    <button
      class={cn(
        "flex w-full items-center gap-3 px-4 py-2 text-left text-xs transition-colors hover:bg-surface-hover",
        isSelected() && "bg-muted",
      )}
      onClick={handleClick}
    >
      {/* PID */}
      <span class="w-14 shrink-0 font-mono text-muted-foreground">
        {props.process.pid}
      </span>

      {/* Icon + Name */}
      <div class="flex flex-1 items-center gap-2 overflow-hidden">
        <Show when={props.process.icon}>
          {(icon) => (
            <img
              src={icon()}
              alt=""
              class="h-4 w-4 shrink-0 rounded object-contain"
            />
          )}
        </Show>
        <span class="truncate font-medium">{props.process.name}</span>
      </div>

      {/* Identifier */}
      <span class="w-48 shrink-0 truncate text-muted-foreground">
        {props.process.identifier ?? "—"}
      </span>
    </button>
  );
}

function AppRow(props: { app: AppInfo }) {
  const isSelected = () =>
    processState.selectedTarget?.type === "app" &&
    processState.selectedTarget.identifier === props.app.identifier;

  function handleClick() {
    selectTarget({
      type: "app",
      pid: props.app.pid ?? undefined,
      identifier: props.app.identifier,
    });
  }

  const isRunning = () => props.app.pid != null;

  return (
    <button
      class={cn(
        "flex w-full items-center gap-3 px-4 py-2 text-left text-xs transition-colors hover:bg-surface-hover",
        isSelected() && "bg-muted",
      )}
      onClick={handleClick}
    >
      {/* Running dot / icon placeholder */}
      <div class="flex w-6 shrink-0 items-center justify-center">
        <Show
          when={props.app.icon}
          fallback={
            <div
              class={cn(
                "h-2 w-2 rounded-full",
                isRunning() ? "bg-success" : "bg-border",
              )}
              title={isRunning() ? "Running" : "Not running"}
            />
          }
        >
          {(icon) => (
            <img
              src={icon()}
              alt=""
              class="h-5 w-5 shrink-0 rounded object-contain"
            />
          )}
        </Show>
      </div>

      {/* Name */}
      <span class="flex-1 truncate font-medium">{props.app.name}</span>

      {/* Identifier */}
      <span class="w-48 shrink-0 truncate font-mono text-muted-foreground">
        {props.app.identifier}
      </span>

      {/* PID */}
      <div class="flex w-16 shrink-0 items-center gap-1">
        <Show when={isRunning()}>
          <span
            class="h-1.5 w-1.5 shrink-0 rounded-full bg-success"
            title="Running"
          />
          <span class="font-mono text-muted-foreground">{props.app.pid}</span>
        </Show>
        <Show when={!isRunning()}>
          <span class="text-muted-foreground">—</span>
        </Show>
      </div>
    </button>
  );
}
