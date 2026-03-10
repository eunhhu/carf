import { Show, For, Switch, Match } from "solid-js";
import { settingsState } from "~/features/settings/settings.store";
import { activeTab } from "~/lib/navigation";
import { moduleState } from "~/features/module/module.store";
import { threadState } from "~/features/thread/thread.store";
import { hooksState, getRecentEvents } from "~/features/hooks/hooks.store";
import { memoryState } from "~/features/memory/memory.store";

export function InspectorPanel() {
  return (
    <div
      class="flex flex-col border-l bg-surface"
      style={{ width: `${settingsState.panels.inspectorWidth}px` }}
    >
      {/* Header */}
      <div class="flex h-9 items-center border-b px-3">
        <span class="text-xs font-medium text-muted-foreground">Inspector</span>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-auto p-3">
        <InspectorContent />
      </div>
    </div>
  );
}

function InspectorContent() {
  return (
    <Switch fallback={<EmptyInspector />}>
      <Match when={activeTab() === "modules"}>
        <ModulesInspector />
      </Match>
      <Match when={activeTab() === "threads"}>
        <ThreadsInspector />
      </Match>
      <Match when={activeTab() === "hooks"}>
        <HooksInspector />
      </Match>
      <Match when={activeTab() === "memory"}>
        <MemoryInspector />
      </Match>
    </Switch>
  );
}

function EmptyInspector() {
  return (
    <div class="flex h-full items-center justify-center">
      <span class="text-xs text-muted-foreground">Select an item to inspect</span>
    </div>
  );
}

// ─── Modules Inspector ───

function ModulesInspector() {
  const selected = () => moduleState.selectedModule;
  const exports = () => moduleState.exports;
  const imports = () => moduleState.imports;
  const info = () =>
    moduleState.modules.find((m) => m.name === selected()) ?? null;

  return (
    <Show when={selected()} fallback={<EmptyInspector />}>
      <div class="flex flex-col gap-3">
        {/* Module info */}
        <Show when={info()}>
          {(mod) => (
            <div class="flex flex-col gap-1">
              <span class="text-xs font-semibold text-foreground">{mod().name}</span>
              <span class="break-all font-mono text-xs text-muted-foreground">
                {mod().path}
              </span>
              <div class="flex gap-2 text-xs text-muted-foreground">
                <span>Base: <span class="font-mono">{mod().base}</span></span>
                <span>Size: {formatSize(mod().size)}</span>
              </div>
            </div>
          )}
        </Show>

        {/* Exports */}
        <Show when={exports().length > 0}>
          <div>
            <div class="mb-1 text-xs font-medium text-muted-foreground">
              Exports ({exports().length})
            </div>
            <div class="flex flex-col gap-0.5">
              <For each={exports().slice(0, 50)}>
                {(exp) => (
                  <div class="flex flex-col rounded px-1.5 py-1 hover:bg-surface-hover">
                    <span class="truncate font-mono text-xs text-foreground">
                      {exp.name}
                    </span>
                    <span class="font-mono text-xs text-muted-foreground">
                      {exp.address}
                    </span>
                  </div>
                )}
              </For>
              <Show when={exports().length > 50}>
                <span class="px-1.5 text-xs text-muted-foreground">
                  +{exports().length - 50} more
                </span>
              </Show>
            </div>
          </div>
        </Show>

        {/* Imports */}
        <Show when={imports().length > 0}>
          <div>
            <div class="mb-1 text-xs font-medium text-muted-foreground">
              Imports ({imports().length})
            </div>
            <div class="flex flex-col gap-0.5">
              <For each={imports().slice(0, 50)}>
                {(imp) => (
                  <div class="flex flex-col rounded px-1.5 py-1 hover:bg-surface-hover">
                    <span class="truncate font-mono text-xs text-foreground">
                      {imp.name}
                    </span>
                    <span class="font-mono text-xs text-muted-foreground">
                      {imp.module}
                    </span>
                  </div>
                )}
              </For>
              <Show when={imports().length > 50}>
                <span class="px-1.5 text-xs text-muted-foreground">
                  +{imports().length - 50} more
                </span>
              </Show>
            </div>
          </div>
        </Show>

        <Show when={exports().length === 0 && imports().length === 0}>
          <span class="text-xs text-muted-foreground">
            No exports/imports loaded
          </span>
        </Show>
      </div>
    </Show>
  );
}

// ─── Threads Inspector ───

function ThreadsInspector() {
  const selected = () => threadState.selectedThreadId;
  const backtrace = () => threadState.backtrace;
  const thread = () =>
    threadState.threads.find((t) => t.id === selected()) ?? null;

  return (
    <Show when={selected() !== null} fallback={<EmptyInspector />}>
      <div class="flex flex-col gap-3">
        {/* Thread info */}
        <Show when={thread()}>
          {(t) => (
            <div class="flex flex-col gap-1">
              <span class="text-xs font-semibold text-foreground">
                Thread {t().id}
              </span>
              <Show when={t().name}>
                <span class="text-xs text-muted-foreground">{t().name}</span>
              </Show>
              <span class="text-xs text-muted-foreground">State: {t().state}</span>
            </div>
          )}
        </Show>

        {/* Backtrace */}
        <Show
          when={backtrace().length > 0}
          fallback={
            <span class="text-xs text-muted-foreground">
              No backtrace available
            </span>
          }
        >
          <div>
            <div class="mb-1 text-xs font-medium text-muted-foreground">
              Backtrace
            </div>
            <div class="flex flex-col gap-0.5">
              <For each={backtrace()}>
                {(frame, i) => (
                  <div class="flex flex-col rounded px-1.5 py-1 hover:bg-surface-hover">
                    <div class="flex items-center gap-1">
                      <span class="w-5 text-right font-mono text-xs text-muted-foreground">
                        {i()}
                      </span>
                      <span class="truncate font-mono text-xs text-foreground">
                        {frame.symbolName ?? frame.address}
                      </span>
                    </div>
                    <Show when={frame.moduleName}>
                      <span class="ml-6 text-xs text-muted-foreground">
                        {frame.moduleName}
                      </span>
                    </Show>
                    <Show when={frame.fileName}>
                      <span class="ml-6 font-mono text-xs text-muted-foreground">
                        {frame.fileName}
                        <Show when={frame.lineNumber}>:{frame.lineNumber}</Show>
                      </span>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}

// ─── Hooks Inspector ───

function HooksInspector() {
  // Show the hook with the most recent events, or the first hook
  const selectedHook = () => hooksState.hooks[0] ?? null;
  const events = () =>
    selectedHook() ? getRecentEvents(selectedHook()!.id) : [];

  return (
    <Show when={selectedHook()} fallback={<EmptyInspector />}>
      {(hook) => (
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <span class="text-xs font-semibold text-foreground">
              {hook().target}
            </span>
            <div class="flex gap-2 text-xs text-muted-foreground">
              <span class="rounded bg-muted px-1 py-0.5">{hook().type}</span>
              <span>{hook().hits} hits</span>
              <span class={hook().active ? "text-success" : "text-destructive"}>
                {hook().active ? "active" : "inactive"}
              </span>
            </div>
          </div>

          <Show
            when={events().length > 0}
            fallback={
              <span class="text-xs text-muted-foreground">No recent events</span>
            }
          >
            <div>
              <div class="mb-1 text-xs font-medium text-muted-foreground">
                Recent Events ({events().length})
              </div>
              <div class="flex flex-col gap-1">
                <For each={events()}>
                  {(evt) => (
                    <div class="flex flex-col rounded border border-border p-1.5">
                      <div class="flex items-center justify-between">
                        <span class="font-mono text-xs text-muted-foreground">
                          {evt.type === "enter" ? "→" : "←"} TID:{evt.threadId}
                        </span>
                        <span class="font-mono text-xs text-muted-foreground">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <Show when={evt.args.length > 0}>
                        <span class="mt-0.5 truncate font-mono text-xs text-foreground">
                          args: {JSON.stringify(evt.args)}
                        </span>
                      </Show>
                      <Show when={evt.retval !== undefined && evt.type === "leave"}>
                        <span class="font-mono text-xs text-muted-foreground">
                          ret: {String(evt.retval)}
                        </span>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
}

// ─── Memory Inspector ───

function MemoryInspector() {
  const address = () => memoryState.hexAddress;
  const data = () => memoryState.hexData;
  const ranges = () => memoryState.ranges;

  return (
    <Show
      when={address() !== null || ranges().length > 0}
      fallback={<EmptyInspector />}
    >
      <div class="flex flex-col gap-3">
        <Show when={address()}>
          {(addr) => (
            <div class="flex flex-col gap-1">
              <span class="text-xs font-semibold text-foreground">
                Memory View
              </span>
              <span class="font-mono text-xs text-muted-foreground">
                {addr()}
              </span>
              <Show when={data()}>
                {(bytes) => (
                  <div class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground">
                      {bytes().length} bytes
                    </span>
                    <div class="rounded bg-muted p-2">
                      <pre class="font-mono text-xs text-foreground overflow-auto">
                        {formatHexPreview(bytes())}
                      </pre>
                    </div>
                  </div>
                )}
              </Show>
            </div>
          )}
        </Show>

        <Show when={ranges().length > 0 && address() === null}>
          <div>
            <div class="mb-1 text-xs font-medium text-muted-foreground">
              Memory Ranges ({ranges().length})
            </div>
            <div class="flex flex-col gap-0.5">
              <For each={ranges().slice(0, 20)}>
                {(range) => (
                  <div class="flex flex-col rounded px-1.5 py-1 hover:bg-surface-hover">
                    <span class="font-mono text-xs text-foreground">
                      {range.base}
                    </span>
                    <div class="flex gap-2 text-xs text-muted-foreground">
                      <span>{formatSize(range.size)}</span>
                      <span class="font-mono">{range.protection}</span>
                    </div>
                  </div>
                )}
              </For>
              <Show when={ranges().length > 20}>
                <span class="px-1.5 text-xs text-muted-foreground">
                  +{ranges().length - 20} more
                </span>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}

// ─── Helpers ───

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatHexPreview(data: Uint8Array): string {
  const lines: string[] = [];
  const rowSize = 16;
  const maxRows = 8;
  const limit = Math.min(data.length, rowSize * maxRows);
  for (let i = 0; i < limit; i += rowSize) {
    const row = data.slice(i, i + rowSize);
    const hex = Array.from(row)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    const ascii = Array.from(row)
      .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."))
      .join("");
    lines.push(`${hex.padEnd(rowSize * 3 - 1)}  ${ascii}`);
  }
  if (data.length > limit) {
    lines.push(`... ${data.length - limit} more bytes`);
  }
  return lines.join("\n");
}
