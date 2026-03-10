import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import {
  networkState,
  filteredRequests,
  selectedRequest,
  selectRequest,
  domainFilter,
  setDomainFilter,
  methodFilter,
  setMethodFilter,
  clearRequests,
  startCapture,
  stopCapture,
  setupNetworkListener,
  exportHar,
} from "./network.store";
import { activeSession } from "~/features/session/session.store";
import { SplitPane } from "~/components/SplitPane";
import { CopyButton } from "~/components/CopyButton";
import { cn } from "~/lib/cn";
import { formatDuration } from "~/lib/format";

const STATUS_COLORS: Record<string, string> = {
  "2": "text-success",
  "3": "text-primary",
  "4": "text-warning",
  "5": "text-destructive",
};

function getStatusColor(code: number | null): string {
  if (!code) return "text-muted-foreground";
  return STATUS_COLORS[String(code)[0]] ?? "text-foreground";
}

type DetailTab = "request" | "response" | "timing";

function NetworkTab() {
  const [detailTab, setDetailTab] = createSignal<DetailTab>("request");

  createEffect(() => {
    const session = activeSession();
    if (!session) return;
    const cleanup = setupNetworkListener(session.id);
    onCleanup(cleanup);
  });

  function handleCaptureToggle(): void {
    const session = activeSession();
    if (!session) return;
    if (networkState.capturing) {
      void stopCapture(session.id);
    } else {
      void startCapture(session.id);
    }
  }

  function handleExportHar(): void {
    const har = exportHar();
    const blob = new Blob([har], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "capture.har";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div class="flex h-full flex-col">
      {/* Header */}
      <div class="flex items-center justify-between border-b px-4 py-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">Network</span>
          <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {networkState.requests.length} requests
          </span>
        </div>
        <div class="flex items-center gap-2">
          <input
            type="text"
            class="rounded border bg-background px-2 py-0.5 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
            placeholder="Filter domain..."
            value={domainFilter()}
            onInput={(e) => setDomainFilter(e.currentTarget.value)}
          />
          <select
            class="rounded border bg-background px-1.5 py-0.5 text-xs"
            value={methodFilter()}
            onChange={(e) => setMethodFilter(e.currentTarget.value)}
          >
            <option value="all">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
          <button
            class={cn(
              "cursor-pointer rounded px-2 py-0.5 text-xs",
              networkState.capturing
                ? "bg-destructive/10 text-destructive"
                : "bg-success/10 text-success",
            )}
            onClick={handleCaptureToggle}
          >
            {networkState.capturing ? "Stop" : "Start"} Capture
          </button>
          <button
            class="cursor-pointer rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={clearRequests}
          >
            Clear
          </button>
          <button
            class="cursor-pointer rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleExportHar}
          >
            Export HAR
          </button>
        </div>
      </div>

      {/* Split: Request list + Detail */}
      <SplitPane
        id="network"
        minLeft={250}
        maxLeft={500}
        defaultLeft={350}
        left={
          <div class="h-full overflow-auto">
            <div class="sticky top-0 flex items-center border-b bg-surface px-3 py-1 text-[10px] font-medium uppercase text-muted-foreground">
              <span class="w-12 shrink-0">Status</span>
              <span class="w-12 shrink-0">Method</span>
              <span class="min-w-0 flex-1">URL</span>
              <span class="w-14 shrink-0 text-right">Duration</span>
            </div>

            <For each={filteredRequests()}>
              {(req) => {
                const isSelected = () =>
                  networkState.selectedRequestId === req.id;
                return (
                  <button
                    class={cn(
                      "group/row flex w-full cursor-pointer items-center px-3 py-1 text-left text-xs transition-colors hover:bg-surface-hover",
                      isSelected() && "bg-muted",
                    )}
                    onClick={() => selectRequest(req.id)}
                  >
                    <span
                      class={cn("w-12 shrink-0 font-mono", getStatusColor(req.statusCode))}
                    >
                      {req.statusCode ?? "..."}
                    </span>
                    <span class="w-12 shrink-0 font-medium">{req.method}</span>
                    <span class="min-w-0 flex-1 truncate font-mono text-muted-foreground" title={req.url}>
                      {req.url}
                    </span>
                    <span class="w-14 shrink-0 text-right text-muted-foreground">
                      {req.duration != null ? formatDuration(req.duration) : ""}
                    </span>
                  </button>
                );
              }}
            </For>

            <Show when={filteredRequests().length === 0}>
              <div class="flex h-32 items-center justify-center text-xs text-muted-foreground">
                {networkState.capturing
                  ? "Waiting for requests..."
                  : "Start capture to monitor network traffic"}
              </div>
            </Show>
          </div>
        }
        right={
          <div class="h-full overflow-auto">
            <Show
              when={selectedRequest()}
              fallback={
                <div class="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Select a request to view details
                </div>
              }
            >
              {(req) => (
                <div class="p-4">
                  <div class="mb-3 flex items-center gap-2">
                    <span
                      class={cn(
                        "font-mono font-bold",
                        getStatusColor(req().statusCode),
                      )}
                    >
                      {req().statusCode}
                    </span>
                    <CopyButton value={String(req().statusCode ?? "")} />
                    <span class="font-medium">{req().method}</span>
                    <span class="rounded bg-muted px-1 py-0.5 text-[10px]">
                      {req().protocol}
                    </span>
                  </div>
                  <div class="mb-3 flex items-start gap-1">
                    <span class="break-all font-mono text-xs text-muted-foreground">
                      {req().url}
                    </span>
                    <CopyButton value={req().url} />
                  </div>

                  {/* Sub-tabs */}
                  <div class="flex gap-2 border-b pb-2 text-xs">
                    {(["request", "response", "timing"] as DetailTab[]).map((tab) => (
                      <button
                        class={cn(
                          "cursor-pointer rounded px-2 py-0.5",
                          detailTab() === tab
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() => setDetailTab(tab)}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Request tab */}
                  <Show when={detailTab() === "request"}>
                    <div class="mt-3">
                      <h4 class="mb-1 text-xs font-medium text-muted-foreground">
                        Request Headers
                      </h4>
                      <div class="space-y-0.5">
                        {Object.entries(req().requestHeaders).map(([k, v]) => (
                          <div class="group/header flex items-center gap-2 text-xs">
                            <span class="shrink-0 text-primary">{k}:</span>
                            <span class="break-all text-muted-foreground">{v}</span>
                            <CopyButton value={String(v)} class="opacity-0 group-hover/header:opacity-100" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <Show when={req().requestBody}>
                      <div class="mt-3">
                        <h4 class="mb-1 text-xs font-medium text-muted-foreground">
                          Body
                        </h4>
                        <pre class="rounded bg-background p-2 font-mono text-xs">
                          {req().requestBody}
                        </pre>
                      </div>
                    </Show>
                  </Show>

                  {/* Response tab */}
                  <Show when={detailTab() === "response"}>
                    <div class="mt-3">
                      <h4 class="mb-1 text-xs font-medium text-muted-foreground">
                        Response Headers
                      </h4>
                      <div class="space-y-0.5">
                        {Object.entries(req().responseHeaders).map(([k, v]) => (
                          <div class="group/header flex items-center gap-2 text-xs">
                            <span class="shrink-0 text-primary">{k}:</span>
                            <span class="break-all text-muted-foreground">{v}</span>
                            <CopyButton value={String(v)} class="opacity-0 group-hover/header:opacity-100" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <Show when={req().responseBody}>
                      <div class="mt-3">
                        <h4 class="mb-1 text-xs font-medium text-muted-foreground">
                          Body
                        </h4>
                        <pre class="rounded bg-background p-2 font-mono text-xs">
                          {req().responseBody}
                        </pre>
                      </div>
                    </Show>
                  </Show>

                  {/* Timing tab */}
                  <Show when={detailTab() === "timing"}>
                    <div class="mt-3 space-y-1">
                      <div class="flex justify-between text-xs">
                        <span class="text-muted-foreground">Duration</span>
                        <span class="font-mono">
                          {req().duration != null ? formatDuration(req().duration!) : "—"}
                        </span>
                      </div>
                      <div class="flex justify-between text-xs">
                        <span class="text-muted-foreground">Started</span>
                        <span class="font-mono">
                          {new Date(req().timestamp).toISOString()}
                        </span>
                      </div>
                    </div>
                  </Show>
                </div>
              )}
            </Show>
          </div>
        }
      />
    </div>
  );
}

export default NetworkTab;
