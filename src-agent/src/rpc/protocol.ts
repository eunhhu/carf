// Helper to emit structured events to the Backend
function emitEvent(type: string, data: unknown): void {
  send({
    type,
    timestamp: Date.now(),
    data,
  });
}

function buildHookTarget(payload: Record<string, unknown>): string {
  if (typeof payload.target === "string" && payload.target.length > 0) {
    return payload.target;
  }

  if (
    typeof payload.className === "string" &&
    typeof payload.methodName === "string"
  ) {
    return `${payload.className}.${payload.methodName}`;
  }

  if (
    typeof payload.className === "string" &&
    typeof payload.selector === "string"
  ) {
    return `${payload.className} ${payload.selector}`;
  }

  return "unknown";
}

// Specific event emitters
function emitLog(level: "info" | "warn" | "error", message: string, data?: unknown): void {
  emitEvent("console/message", {
    level,
    source: "agent",
    content: message,
    data,
  });
}

function emitHookEvent(hookId: string, eventType: "enter" | "leave", details: unknown): void {
  const payload = (details as Record<string, unknown>) ?? {};

  emitEvent("hook/event", {
    hookId,
    type: eventType,
    timestamp: Date.now(),
    threadId:
      typeof payload.threadId === "number" ? payload.threadId : -1,
    target: buildHookTarget(payload),
    address: typeof payload.address === "string" ? payload.address : null,
    args: Array.isArray(payload.args) ? payload.args : [],
    retval: payload.retval ?? null,
    backtrace: Array.isArray(payload.backtrace) ? payload.backtrace : [],
    ...payload,
  });
}

function emitStalkerEvent(events: unknown[]): void {
  emitEvent("stalker/event", { events });
}

function emitNetworkRequest(request: unknown): void {
  emitEvent("network/request", {
    timestamp: Date.now(),
    ...(request as object),
  });
}

function emitMemoryAccess(access: unknown): void {
  emitEvent("memory/access", access);
}

export { emitEvent, emitLog, emitHookEvent, emitStalkerEvent, emitNetworkRequest, emitMemoryAccess };
