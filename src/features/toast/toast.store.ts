import { createSignal } from "solid-js";

export type ToastLevel = "info" | "success" | "warning" | "error";

export interface Toast {
  id: number;
  level: ToastLevel;
  title: string;
  message?: string;
  createdAt: number;
}

const [toasts, setToasts] = createSignal<Toast[]>([]);

let nextId = 1;
const DEFAULT_DURATION = 4000;
const ERROR_DURATION = 8000;
const MAX_TOASTS = 5;

function pushToast(
  level: ToastLevel,
  title: string,
  message?: string,
  durationMs?: number,
): number {
  const id = nextId++;
  const toast: Toast = {
    id,
    level,
    title,
    message,
    createdAt: Date.now(),
  };

  setToasts((prev) => {
    const next = [...prev, toast];
    if (next.length > MAX_TOASTS) {
      return next.slice(next.length - MAX_TOASTS);
    }
    return next;
  });

  const ttl =
    durationMs ?? (level === "error" ? ERROR_DURATION : DEFAULT_DURATION);
  if (ttl > 0) {
    setTimeout(() => dismissToast(id), ttl);
  }

  return id;
}

export function dismissToast(id: number): void {
  setToasts((prev) => prev.filter((t) => t.id !== id));
}

export function toastInfo(title: string, message?: string): number {
  return pushToast("info", title, message);
}

export function toastSuccess(title: string, message?: string): number {
  return pushToast("success", title, message);
}

export function toastWarning(title: string, message?: string): number {
  return pushToast("warning", title, message);
}

export function toastError(
  title: string,
  error?: unknown,
  durationMs?: number,
): number {
  const message = formatError(error);
  return pushToast("error", title, message, durationMs);
}

function formatError(error: unknown): string | undefined {
  if (error == null) return undefined;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const maybe = error as { message?: unknown; error?: unknown };
    if (typeof maybe.message === "string") return maybe.message;
    if (typeof maybe.error === "string") return maybe.error;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

export { toasts };
