import { Show } from "solid-js";
import { activeSession, setAppView, removeSession, updateSessionStatus } from "./session.store";
import { settingsState, toggleInspector, toggleConsole } from "~/features/settings/settings.store";
import { invoke } from "~/lib/tauri";
import { cn } from "~/lib/cn";
import { formatDuration } from "~/lib/format";

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
          <span class="text-sm">&larr;</span>
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
