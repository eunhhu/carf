import { For, Show, createSignal, onMount, onCleanup } from "solid-js";
import {
  deviceState,
  selectedDevice,
  refreshDevices,
  selectDevice,
  addRemoteDevice,
  setupDeviceListeners,
} from "./device.store";
import { setAppView } from "~/features/session/session.store";
import { cn } from "~/lib/cn";
import type { DeviceInfo } from "~/lib/types";

export default function DevicePanel() {
  const [showRemoteForm, setShowRemoteForm] = createSignal(false);
  const [remoteAddress, setRemoteAddress] = createSignal("");
  const [remoteError, setRemoteError] = createSignal<string | null>(null);
  const [connecting, setConnecting] = createSignal(false);

  onMount(() => {
    const cleanup = setupDeviceListeners();
    refreshDevices();
    onCleanup(cleanup);
  });

  async function handleAddRemote() {
    const addr = remoteAddress().trim();
    if (!addr) return;
    setRemoteError(null);
    setConnecting(true);
    try {
      await addRemoteDevice(addr);
      setRemoteAddress("");
      setShowRemoteForm(false);
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }

  function handleContinue() {
    if (selectedDevice()) {
      setAppView("process");
    }
  }

  return (
    <div class="flex h-full flex-col items-center justify-center bg-background p-8">
      <div class="flex w-full max-w-3xl flex-col gap-8">
        {/* Header */}
        <div class="flex flex-col items-center gap-2 text-center">
          <div class="text-4xl font-bold tracking-tight text-foreground">
            CARF
          </div>
          <span class="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            v2.0
          </span>
          <p class="mt-1 text-sm text-muted-foreground">
            Select a device to begin
          </p>
        </div>

        {/* Device grid */}
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Connected Devices
            </span>
            <div class="flex items-center gap-2">
              <button
                class="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                onClick={() => refreshDevices()}
                disabled={deviceState.loading}
              >
                {deviceState.loading ? "Refreshing..." : "Refresh"}
              </button>
              <button
                class={cn(
                  "rounded-md px-2 py-1 text-xs transition-colors",
                  showRemoteForm()
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
                onClick={() => {
                  setShowRemoteForm((v) => !v);
                  setRemoteError(null);
                }}
              >
                + Add Remote
              </button>
            </div>
          </div>

          {/* Remote device form */}
          <Show when={showRemoteForm()}>
            <div class="flex flex-col gap-2 rounded-lg border bg-surface p-3">
              <span class="text-xs font-medium text-muted-foreground">
                Remote Device Address
              </span>
              <div class="flex gap-2">
                <input
                  type="text"
                  class="flex-1 rounded border bg-background px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                  placeholder="192.168.1.100:27042"
                  value={remoteAddress()}
                  onInput={(e) => setRemoteAddress(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddRemote()}
                />
                <button
                  class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  onClick={handleAddRemote}
                  disabled={connecting() || !remoteAddress().trim()}
                >
                  {connecting() ? "Connecting..." : "Connect"}
                </button>
              </div>
              <Show when={remoteError()}>
                <p class="text-xs text-destructive">{remoteError()}</p>
              </Show>
            </div>
          </Show>

          {/* Error state */}
          <Show when={deviceState.error}>
            <div class="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
              <p class="text-sm text-destructive">{deviceState.error}</p>
              <button
                class="text-xs text-destructive underline hover:no-underline"
                onClick={() => refreshDevices()}
              >
                Retry
              </button>
            </div>
          </Show>

          {/* Loading state */}
          <Show when={deviceState.loading && deviceState.devices.length === 0}>
            <div class="flex h-40 items-center justify-center">
              <p class="text-sm text-muted-foreground">Scanning for devices...</p>
            </div>
          </Show>

          {/* Empty state */}
          <Show
            when={
              !deviceState.loading &&
              !deviceState.error &&
              deviceState.devices.length === 0
            }
          >
            <div class="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
              <p class="text-sm text-muted-foreground">No devices found</p>
              <p class="text-xs text-muted-foreground">
                Connect a device or add a remote device
              </p>
            </div>
          </Show>

          {/* Device grid */}
          <Show when={deviceState.devices.length > 0}>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <For each={deviceState.devices}>
                {(device) => <DeviceCard device={device} />}
              </For>
            </div>
          </Show>
        </div>

        {/* Continue button */}
        <Show when={selectedDevice()}>
          <div class="flex justify-center">
            <button
              class="rounded-lg bg-primary px-8 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              onClick={handleContinue}
            >
              Continue with {selectedDevice()!.name} &rarr;
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}

function DeviceCard(props: { device: DeviceInfo }) {
  const isSelected = () =>
    props.device.id === (selectedDevice()?.id ?? null);

  const typeLabel = () => {
    switch (props.device.type) {
      case "local":
        return "Local";
      case "usb":
        return "USB";
      case "remote":
        return "Remote";
    }
  };

  const typeBadgeClass = () => {
    switch (props.device.type) {
      case "local":
        return "bg-primary/10 text-primary";
      case "usb":
        return "bg-success/10 text-success";
      case "remote":
        return "bg-warning/10 text-warning";
    }
  };

  const statusDotClass = () => {
    switch (props.device.status) {
      case "connected":
        return "bg-success";
      case "disconnected":
        return "bg-destructive";
      case "pairing":
        return "bg-warning";
    }
  };

  return (
    <button
      class={cn(
        "flex flex-col gap-3 rounded-lg border bg-surface p-4 text-left transition-all hover:border-primary/50 hover:bg-surface-hover",
        isSelected() && "border-primary bg-primary/5 ring-1 ring-primary",
      )}
      onClick={() => selectDevice(props.device.id)}
    >
      {/* Top row: icon + status dot */}
      <div class="flex items-start justify-between">
        {/* Device icon placeholder */}
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xl">
          {deviceIcon(props.device)}
        </div>
        {/* Status dot */}
        <span
          class={cn("mt-1 h-2 w-2 rounded-full", statusDotClass())}
          title={props.device.status}
        />
      </div>

      {/* Device name */}
      <div class="flex flex-col gap-1">
        <span class="truncate text-sm font-medium text-foreground">
          {props.device.name}
        </span>

        {/* Badges row */}
        <div class="flex flex-wrap gap-1">
          <span
            class={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium",
              typeBadgeClass(),
            )}
          >
            {typeLabel()}
          </span>

          <Show when={props.device.os}>
            {(os) => (
              <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {os().platform} {os().version}
              </span>
            )}
          </Show>

          <Show when={props.device.arch}>
            <span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {props.device.arch}
            </span>
          </Show>
        </div>
      </div>
    </button>
  );
}

function deviceIcon(device: DeviceInfo): string {
  if (device.os) {
    switch (device.os.platform) {
      case "android":
        return "🤖";
      case "ios":
        return "📱";
      case "macos":
        return "🍎";
      case "linux":
        return "🐧";
      case "windows":
        return "🪟";
    }
  }
  switch (device.type) {
    case "usb":
      return "📲";
    case "remote":
      return "🌐";
    default:
      return "💻";
  }
}
