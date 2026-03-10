import { Show, createSignal } from "solid-js";
import { ArrowLeft } from "lucide-solid";
import { activeSession, setAppView, removeSession, updateSessionStatus } from "./session.store";
import { settingsState, toggleInspector, toggleConsole } from "~/features/settings/settings.store";
import { invoke } from "~/lib/tauri";
import { cn } from "~/lib/cn";
import { formatDuration } from "~/lib/format";
import { saveSessionState, restorePinboard, getSavedHookConfigs, exportSessionSnapshot, importSessionSnapshot } from "~/lib/session-persistence";
import { exportReportJSON, exportReportHTML } from "~/lib/report-export";
import { importHookConfigs } from "~/features/hooks/hooks.store";
import { pickTextFile } from "~/lib/file-picker";

export function SessionToolbar() {
  const session = activeSession;

  const uptime = () => {
    const s = session();
    if (!s) return "";
    return formatDuration(Date.now() - s.createdAt);
  };

  async function handleDetach() {
    const s = session();
    if (!s) return;
    try {
      await invoke<void>("detach", { sessionId: s.id });
    } catch {
      // Session may already be gone; proceed with cleanup
    }
    removeSession(s.id);
    setAppView("process");
  }

  async function handlePause() {
    const s = session();
    if (!s) return;
    try {
      await invoke<void>("rpc_call", {
        sessionId: s.id,
        method: "pause",
        params: {},
      });
      updateSessionStatus(s.id, "paused");
    } catch {
      // ignore
    }
  }

  async function handleResume() {
    const s = session();
    if (!s) return;
    try {
      await invoke<void>("resume", { sessionId: s.id });
      updateSessionStatus(s.id, "active");
    } catch {
      // ignore
    }
  }

  return (
    <div class="flex h-10 items-center justify-between border-b bg-surface px-3">
      {/* Left section */}
      <div class="flex items-center gap-3">
        {/* Back button */}
        <button
          class="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          onClick={() => setAppView("process")}
        >
          <ArrowLeft size={14} />
          Back
        </button>

        {/* Process info */}
        <Show when={session()}>
          {(s) => (
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">{s().processName}</span>
              <span class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                PID:{s().pid}
              </span>
              <Show when={s().arch}>
                <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {s().arch}
                </span>
              </Show>
              {/* Status badge */}
              <span
                class={cn(
                  "rounded px-1.5 py-0.5 text-xs font-medium",
                  s().status === "active" && "bg-success/10 text-success",
                  s().status === "paused" && "bg-warning/10 text-warning",
                  s().status === "detached" && "bg-destructive/10 text-destructive",
                  s().status === "crashed" && "bg-destructive/10 text-destructive",
                )}
              >
                {s().status}
              </span>
            </div>
          )}
        </Show>
      </div>

      {/* Right section */}
      <div class="flex items-center gap-1">
        <Show when={session()}>
          <span class="mr-2 text-xs text-muted-foreground">{uptime()}</span>
        </Show>

        {/* Pause / Resume */}
        <Show when={session()}>
          {(s) => (
            <Show
              when={s().status === "active"}
              fallback={
                <Show when={s().status === "paused"}>
                  <ToolbarButton
                    label="Resume"
                    active={false}
                    onClick={handleResume}
                    shortcut="Resume session"
                  />
                </Show>
              }
            >
              <ToolbarButton
                label="Pause"
                active={false}
                onClick={handlePause}
                shortcut="Pause session"
              />
            </Show>
          )}
        </Show>

        {/* Inspector toggle */}
        <ToolbarButton
          label="Inspector"
          active={settingsState.inspectorOpen}
          onClick={toggleInspector}
          shortcut="Cmd+I"
        />

        {/* Console toggle */}
        <ToolbarButton
          label="Console"
          active={settingsState.consoleOpen}
          onClick={toggleConsole}
          shortcut="Cmd+J"
        />

        {/* Session menu */}
        <SessionMenu />

        {/* Detach */}
        <button
          class="ml-2 rounded-md px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
          onClick={handleDetach}
        >
          Detach
        </button>
      </div>
    </div>
  );
}

function SessionMenu() {
  const [open, setOpen] = createSignal(false);

  function handleSave() {
    saveSessionState();
    setOpen(false);
  }

  async function handleRestore() {
    const session = activeSession();
    if (!session) return;
    const pinsRestored = restorePinboard();
    const hookConfigs = getSavedHookConfigs();
    if (hookConfigs.length > 0) {
      await importHookConfigs(session.id, hookConfigs).catch(() => {});
    }
    setOpen(false);
    void pinsRestored;
  }

  function handleExportSnapshot() {
    const json = exportSessionSnapshot();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "carf-session.json";
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  async function handleImportSnapshot() {
    const session = activeSession();
    if (!session) return;
    try {
      const selected = await pickTextFile(".json,application/json");
      if (!selected) return;
      const result = importSessionSnapshot(selected.content);
      if (result.hookConfigs.length > 0) {
        await importHookConfigs(session.id, result.hookConfigs).catch(() => {});
      }
    } catch {
      // ignore
    }
    setOpen(false);
  }

  function handleReportJSON() {
    exportReportJSON();
    setOpen(false);
  }

  function handleReportHTML() {
    exportReportHTML();
    setOpen(false);
  }

  return (
    <div class="relative">
      <button
        class="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        onClick={() => setOpen(!open())}
      >
        Menu
      </button>
      <Show when={open()}>
        <div
          class="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border bg-surface py-1 shadow-lg"
        >
          <MenuSection label="Session">
            <MenuItem label="Save State" onClick={handleSave} />
            <MenuItem label="Restore State" onClick={handleRestore} />
            <MenuItem label="Export Snapshot" onClick={handleExportSnapshot} />
            <MenuItem label="Import Snapshot" onClick={handleImportSnapshot} />
          </MenuSection>
          <div class="my-1 border-t" />
          <MenuSection label="Report">
            <MenuItem label="Export JSON" onClick={handleReportJSON} />
            <MenuItem label="Export HTML" onClick={handleReportHTML} />
          </MenuSection>
        </div>
        {/* Backdrop */}
        <div class="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      </Show>
    </div>
  );
}

function MenuSection(props: { label: string; children: any }) {
  return (
    <div>
      <div class="px-3 py-1 text-[10px] font-medium uppercase text-muted-foreground">
        {props.label}
      </div>
      {props.children}
    </div>
  );
}

function MenuItem(props: { label: string; onClick: () => void }) {
  return (
    <button
      class="w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover"
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
}

function ToolbarButton(props: {
  label: string;
  active: boolean;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <button
      class={cn(
        "rounded-md px-2 py-1 text-xs transition-colors",
        props.active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
      )}
      onClick={props.onClick}
      title={props.shortcut}
    >
      {props.label}
    </button>
  );
}
