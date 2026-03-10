// Helper to emit structured events to the Backend
function emitEvent(type: string, data: unknown): void {
  send({
    type,
    timestamp: Date.now(),
    data,
  });
}

// Specific event emitters
function emitLog(level: "info" | "warn" | "error", message: string, data?: unknown): void {
  emitEvent("log", { level, message, data });
}

function emitHookEvent(hookId: string, eventType: "enter" | "leave", details: unknown): void {
  emitEvent("hook/event", { hookId, eventType, ...(details as object) });
}

function emitStalkerEvent(events: unknown[]): void {
  emitEvent("stalker/event", { events });
}

function emitNetworkRequest(request: unknown): void {
  emitEvent("network/request", request);
}

function emitMemoryAccess(access: unknown): void {
  emitEvent("memory/access", access);
}

export { emitEvent, emitLog, emitHookEvent, emitStalkerEvent, emitNetworkRequest, emitMemoryAccess };
