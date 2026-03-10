import { For, Show, Switch, Match, createSignal } from "solid-js";
import {
  nativeState,
  nativeSubMode,
  setNativeSubMode,
  setInterceptorTarget,
  setFunctionAddress,
  hookNativeFunction,
  startStalker,
  stopStalker,
  callNativeFunction,
} from "./native.store";
import { hooksByType } from "~/features/hooks/hooks.store";
import type { NativeSubMode } from "./native.store";
import { cn } from "~/lib/cn";
import { formatAddress } from "~/lib/format";
import { activeSession } from "~/features/session/session.store";

const SUB_MODES: { id: NativeSubMode; label: string }[] = [
  { id: "interceptor", label: "Interceptor" },
  { id: "stalker", label: "Stalker" },
  { id: "functions", label: "Functions" },
];

function NativeTab() {
  return (
    <div class="flex h-full flex-col">
      {/* Header */}
      <div class="flex items-center justify-between border-b px-4 py-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">Native</span>
        </div>
        <div class="flex items-center gap-1">
          <For each={SUB_MODES}>
            {(mode) => (
              <button
                class={cn(
                  "rounded px-2 py-0.5 text-xs transition-colors",
                  nativeSubMode() === mode.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setNativeSubMode(mode.id)}
              >
                {mode.label}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="flex-1 overflow-auto">
        <Switch>
          <Match when={nativeSubMode() === "interceptor"}>
            <InterceptorView />
          </Match>
          <Match when={nativeSubMode() === "stalker"}>
            <StalkerView />
          </Match>
          <Match when={nativeSubMode() === "functions"}>
            <FunctionsView />
          </Match>
        </Switch>
      </div>
    </div>
  );
}

function InterceptorView() {
  const nativeHooks = () => hooksByType("native");
  const [captureArgs, setCaptureArgs] = createSignal(true);
  const [captureRetval, setCaptureRetval] = createSignal(true);
  const [captureBacktrace, setCaptureBacktrace] = createSignal(false);

  async function handleHook() {
    const session = activeSession();
    if (!session || !nativeState.interceptorTarget) return;
    await hookNativeFunction(session.id, nativeState.interceptorTarget, {
      captureArgs: captureArgs(),
      captureRetval: captureRetval(),
      captureBacktrace: captureBacktrace(),
    });
  }

  return (
    <div class="p-4">
      {/* Hook target input */}
      <div class="flex gap-2">
        <input
          type="text"
          class="flex-1 rounded border bg-background px-3 py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
          placeholder="module!symbol or 0xaddress"
          value={nativeState.interceptorTarget}
          onInput={(e) => setInterceptorTarget(e.currentTarget.value)}
        />
        <button
          class="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
          onClick={handleHook}
        >
          Hook
        </button>
      </div>

      {/* Options */}
      <div class="mt-2 flex gap-3 text-xs text-muted-foreground">
        <label class="flex items-center gap-1">
          <input
            type="checkbox"
            checked={captureArgs()}
            onChange={(e) => setCaptureArgs(e.currentTarget.checked)}
            class="rounded"
          />
          Capture Args
        </label>
        <label class="flex items-center gap-1">
          <input
            type="checkbox"
            checked={captureRetval()}
            onChange={(e) => setCaptureRetval(e.currentTarget.checked)}
            class="rounded"
          />
          Capture Retval
        </label>
        <label class="flex items-center gap-1">
          <input
            type="checkbox"
            checked={captureBacktrace()}
            onChange={(e) => setCaptureBacktrace(e.currentTarget.checked)}
            class="rounded"
          />
          Backtrace
        </label>
      </div>

      {/* Active hooks table */}
      <div class="mt-4">
        <h4 class="mb-2 text-xs font-medium text-muted-foreground">
          Active Hooks ({nativeHooks().length})
        </h4>
        <For each={nativeHooks()}>
          {(hook) => (
            <div class="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-surface-hover">
              <span class={cn(
                "h-2 w-2 rounded-full",
                hook.active ? "bg-success" : "bg-muted-foreground",
              )} />
              <span class="font-mono text-muted-foreground">
                {hook.address ? formatAddress(hook.address) : ""}
              </span>
              <span class="flex-1 font-mono">{hook.target}</span>
              <span class="text-muted-foreground">{hook.hits} hits</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

function StalkerView() {
  const [threadIdInput, setThreadIdInput] = createSignal("");
  const [callEvent, setCallEvent] = createSignal(true);
  const [retEvent, setRetEvent] = createSignal(true);
  const [execEvent, setExecEvent] = createSignal(false);
  const [blockEvent, setBlockEvent] = createSignal(false);

  async function handleToggleStalker() {
    const session = activeSession();
    if (!session) return;
    const threadId = parseInt(threadIdInput(), 10);
    if (isNaN(threadId)) return;

    if (nativeState.stalkerActive) {
      await stopStalker(session.id, threadId);
    } else {
      const events: string[] = [];
      if (callEvent()) events.push("call");
      if (retEvent()) events.push("ret");
      if (execEvent()) events.push("exec");
      if (blockEvent()) events.push("block");
      await startStalker(session.id, threadId, events);
    }
  }

  return (
    <div class="p-4">
      <div class="flex items-center gap-2">
        <input
          type="text"
          class="w-32 rounded border bg-background px-2 py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
          placeholder="Thread ID"
          value={threadIdInput()}
          onInput={(e) => setThreadIdInput(e.currentTarget.value)}
        />
        <button
          class={cn(
            "rounded px-3 py-1.5 text-xs",
            nativeState.stalkerActive
              ? "bg-destructive text-destructive-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          onClick={handleToggleStalker}
        >
          {nativeState.stalkerActive ? "Stop" : "Start"} Stalker
        </button>
      </div>

      <div class="mt-2 flex gap-2 text-xs text-muted-foreground">
        <label class="flex items-center gap-1">
          <input
            type="checkbox"
            checked={callEvent()}
            onChange={(e) => setCallEvent(e.currentTarget.checked)}
            class="rounded"
          />
          call
        </label>
        <label class="flex items-center gap-1">
          <input
            type="checkbox"
            checked={retEvent()}
            onChange={(e) => setRetEvent(e.currentTarget.checked)}
            class="rounded"
          />
          ret
        </label>
        <label class="flex items-center gap-1">
          <input
            type="checkbox"
            checked={execEvent()}
            onChange={(e) => setExecEvent(e.currentTarget.checked)}
            class="rounded"
          />
          exec
        </label>
        <label class="flex items-center gap-1">
          <input
            type="checkbox"
            checked={blockEvent()}
            onChange={(e) => setBlockEvent(e.currentTarget.checked)}
            class="rounded"
          />
          block
        </label>
      </div>

      {/* Call trace */}
      <div class="mt-4">
        <For each={nativeState.stalkerEvents}>
          {(event) => (
            <div class="flex items-center gap-1 font-mono text-xs" style={{ "padding-left": `${event.depth * 12}px` }}>
              <span class={cn(
                event.type === "call" ? "text-success" : "text-primary",
              )}>
                {event.type === "call" ? "=>" : "<="}
              </span>
              <span class="text-muted-foreground">
                {event.toModule ? `${event.toModule}!` : ""}
              </span>
              <span>{event.toSymbol ?? formatAddress(event.to)}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

function FunctionsView() {
  const [retType, setRetType] = createSignal(nativeState.functionRetType);
  const [argTypesInput, setArgTypesInput] = createSignal("");
  const [argsInput, setArgsInput] = createSignal("");

  async function handleCall() {
    const session = activeSession();
    if (!session || !nativeState.functionAddress) return;
    const argTypes = argTypesInput()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const args = argsInput()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await callNativeFunction(
      session.id,
      nativeState.functionAddress,
      retType(),
      argTypes,
      args,
    );
  }

  return (
    <div class="p-4">
      <div class="space-y-2">
        <input
          type="text"
          class="w-full rounded border bg-background px-3 py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
          placeholder="Function address (0x...)"
          value={nativeState.functionAddress}
          onInput={(e) => setFunctionAddress(e.currentTarget.value)}
        />
        <div class="flex gap-2">
          <input
            type="text"
            class="flex-1 rounded border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground"
            placeholder="Return type (e.g., int)"
            value={retType()}
            onInput={(e) => setRetType(e.currentTarget.value)}
          />
          <input
            type="text"
            class="flex-1 rounded border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground"
            placeholder="Arg types (e.g., pointer, int)"
            value={argTypesInput()}
            onInput={(e) => setArgTypesInput(e.currentTarget.value)}
          />
        </div>
        <input
          type="text"
          class="w-full rounded border bg-background px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground"
          placeholder="Arguments (comma separated)"
          value={argsInput()}
          onInput={(e) => setArgsInput(e.currentTarget.value)}
        />
        <button
          class="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
          onClick={handleCall}
        >
          Call Function
        </button>
      </div>

      {/* Results */}
      <Show when={nativeState.functionResults.length > 0}>
        <div class="mt-4">
          <h4 class="mb-2 text-xs font-medium text-muted-foreground">Results</h4>
          <For each={nativeState.functionResults}>
            {(result) => (
              <div class="flex gap-2 py-0.5 font-mono text-xs">
                <span class="text-muted-foreground">
                  {formatAddress(result.address)}
                </span>
                <span class="text-primary">=&gt;</span>
                <span>{String(result.retval)}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export default NativeTab;
