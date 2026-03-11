import { createSignal, Show } from "solid-js";
import { cn } from "~/lib/cn";

type Mode = "attach" | "spawn";
type Realm = "native" | "emulated";
type Runtime = "qjs" | "v8";
type Stdio = "inherit" | "pipe";

export interface AttachModalOptions {
  mode: Mode;
  realm: Realm;
  runtime: Runtime;
  persistTimeout: number;
  enableChildGating: boolean;
  scriptPath: string;
  // Spawn-only
  argv: string;
  envp: string;
  cwd: string;
  stdio: Stdio;
  autoResume: boolean;
}

interface AttachModalProps {
  /** Whether the selected target has a running PID (attach-capable) */
  canAttach: boolean;
  /** Whether the selected target has an identifier (spawn-capable) */
  canSpawn: boolean;
  targetLabel: string;
  onConfirm: (options: AttachModalOptions) => void;
  onCancel: () => void;
}

export default function AttachModal(props: AttachModalProps) {
  const defaultMode = (): Mode => {
    if (props.canAttach) return "attach";
    if (props.canSpawn) return "spawn";
    return "attach";
  };

  const [mode, setMode] = createSignal<Mode>(defaultMode());
  const [realm, setRealm] = createSignal<Realm>("native");
  const [runtime, setRuntime] = createSignal<Runtime>("v8");
  const [persistTimeout, setPersistTimeout] = createSignal(0);
  const [enableChildGating, setEnableChildGating] = createSignal(false);
  const [scriptPath, setScriptPath] = createSignal("");

  // Spawn-only options
  const [argv, setArgv] = createSignal("");
  const [envp, setEnvp] = createSignal("");
  const [cwd, setCwd] = createSignal("");
  const [stdio, setStdio] = createSignal<Stdio>("inherit");
  const [autoResume, setAutoResume] = createSignal(true);

  function handleConfirm() {
    props.onConfirm({
      mode: mode(),
      realm: realm(),
      runtime: runtime(),
      persistTimeout: persistTimeout(),
      enableChildGating: enableChildGating(),
      scriptPath: scriptPath(),
      argv: argv(),
      envp: envp(),
      cwd: cwd(),
      stdio: stdio(),
      autoResume: autoResume(),
    });
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      props.onCancel();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      props.onCancel();
    }
  }

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      ref={(el) => el.focus()}
    >
      {/* Modal body */}
      <div class="w-[480px] rounded-lg border bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div class="flex items-center justify-between border-b px-5 py-3">
            <h2 class="text-sm font-semibold text-foreground">Session Options</h2>
            <span class="truncate pl-3 text-xs text-muted-foreground">{props.targetLabel}</span>
          </div>

          {/* Content */}
          <div class="flex flex-col gap-4 px-5 py-4">
            {/* Mode toggle */}
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-foreground">Mode</label>
              <div class="flex rounded-lg bg-muted p-0.5">
                <button
                  class={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs transition-colors",
                    mode() === "attach"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  disabled={!props.canAttach}
                  onClick={() => setMode("attach")}
                >
                  Attach
                </button>
                <button
                  class={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs transition-colors",
                    mode() === "spawn"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  disabled={!props.canSpawn}
                  onClick={() => setMode("spawn")}
                >
                  Spawn
                </button>
              </div>
            </div>

            {/* Common options row */}
            <div class="grid grid-cols-2 gap-3">
              {/* Realm */}
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-medium text-foreground">Realm</label>
                <select
                  class="rounded border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                  value={realm()}
                  onChange={(e) => setRealm(e.currentTarget.value as Realm)}
                >
                  <option value="native">Native</option>
                  <option value="emulated">Emulated</option>
                </select>
              </div>

              {/* Runtime */}
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-medium text-foreground">Runtime</label>
                <select
                  class="rounded border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                  value={runtime()}
                  onChange={(e) => setRuntime(e.currentTarget.value as Runtime)}
                >
                  <option value="v8">V8</option>
                  <option value="qjs">QJS</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              {/* Persist Timeout */}
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-medium text-foreground">Persist Timeout (s)</label>
                <input
                  type="number"
                  min="0"
                  class="rounded border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                  value={persistTimeout()}
                  onInput={(e) => setPersistTimeout(Number(e.currentTarget.value) || 0)}
                />
              </div>

              {/* Enable Child Gating */}
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-medium text-foreground">Child Gating</label>
                <label class="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    class="rounded border"
                    checked={enableChildGating()}
                    onChange={(e) => setEnableChildGating(e.currentTarget.checked)}
                  />
                  <span class="text-xs text-muted-foreground">Enable child gating</span>
                </label>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-foreground">Startup Script</label>
              <input
                type="text"
                class="rounded border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                placeholder="/absolute/path/to/script.js"
                value={scriptPath()}
                onInput={(e) => setScriptPath(e.currentTarget.value)}
              />
              <span class="text-[10px] text-muted-foreground">
                Optional user script loaded immediately after attach or spawn
              </span>
            </div>

            {/* Spawn-only options */}
            <Show when={mode() === "spawn"}>
              <div class="h-px bg-border" />

              <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Spawn Options
              </p>

              {/* Arguments */}
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-medium text-foreground">Arguments (argv)</label>
                <input
                  type="text"
                  class="rounded border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                  placeholder="arg1, arg2, arg3"
                  value={argv()}
                  onInput={(e) => setArgv(e.currentTarget.value)}
                />
                <span class="text-[10px] text-muted-foreground">Comma-separated</span>
              </div>

              {/* Environment */}
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-medium text-foreground">Environment (envp)</label>
                <textarea
                  class="max-h-24 min-h-[60px] rounded border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                  placeholder={"KEY=VALUE\nANOTHER=VALUE"}
                  value={envp()}
                  onInput={(e) => setEnvp(e.currentTarget.value)}
                />
                <span class="text-[10px] text-muted-foreground">One KEY=VALUE per line</span>
              </div>

              {/* Working Directory */}
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-medium text-foreground">Working Directory (cwd)</label>
                <input
                  type="text"
                  class="rounded border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                  placeholder="/data/local/tmp"
                  value={cwd()}
                  onInput={(e) => setCwd(e.currentTarget.value)}
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                {/* Stdio */}
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-medium text-foreground">Stdio</label>
                  <select
                    class="rounded border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                    value={stdio()}
                    onChange={(e) => setStdio(e.currentTarget.value as Stdio)}
                  >
                    <option value="inherit">inherit</option>
                    <option value="pipe">pipe</option>
                  </select>
                </div>

                {/* Auto Resume */}
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-medium text-foreground">Auto Resume</label>
                  <label class="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      class="rounded border"
                      checked={autoResume()}
                      onChange={(e) => setAutoResume(e.currentTarget.checked)}
                    />
                    <span class="text-xs text-muted-foreground">Resume immediately</span>
                  </label>
                </div>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div class="flex items-center justify-end gap-2 border-t px-5 py-3">
            <button
              class="rounded px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              onClick={props.onCancel}
            >
              Cancel
            </button>
            <button
              class="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              onClick={handleConfirm}
            >
              {mode() === "attach" ? "Attach" : "Spawn & Attach"}
            </button>
          </div>
      </div>
    </div>
  );
}
