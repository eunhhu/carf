import { For, Show } from "solid-js";
import { cn } from "~/lib/cn";
import { dismissToast, toasts, type ToastLevel } from "./toast.store";

const LEVEL_STYLES: Record<ToastLevel, string> = {
  info: "border-primary/40 bg-primary/10 text-primary",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};

const LEVEL_BADGE: Record<ToastLevel, string> = {
  info: "INFO",
  success: "OK",
  warning: "WARN",
  error: "ERROR",
};

export function ToastHost() {
  return (
    <div class="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      <For each={toasts()}>
        {(toast) => (
          <div
            class={cn(
              "pointer-events-auto flex items-start gap-2 rounded-lg border bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm",
              LEVEL_STYLES[toast.level],
            )}
            role="status"
          >
            <span class="shrink-0 font-mono text-[10px] font-semibold">
              {LEVEL_BADGE[toast.level]}
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium" title={toast.title}>
                {toast.title}
              </div>
              <Show when={toast.message}>
                <div
                  class="mt-0.5 break-words text-muted-foreground"
                  title={toast.message}
                >
                  {toast.message}
                </div>
              </Show>
            </div>
            <button
              class="shrink-0 cursor-pointer rounded px-1 text-muted-foreground hover:text-foreground"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
      </For>
    </div>
  );
}
