import { registerHandler } from "../rpc/router";
import { emitMemoryAccess, emitLog } from "../rpc/protocol";

interface MonitorEvent {
  operation: "read" | "write" | "execute";
  from: string;
  address: string;
  rangeIndex: number;
  pageIndex: number;
  pagesCompleted: number;
  pagesTotal: number;
}

let monitorActive = false;
const monitorEvents: MonitorEvent[] = [];
const MAX_EVENTS = 10000;

// Emit at most `EMIT_RATE_LIMIT` events per `EMIT_WINDOW_MS` window so a hot
// access pattern cannot saturate the Frida RPC channel. Extra events are still
// recorded to the ring buffer so callers can drain them via
// `drainMonitorEvents` later.
const EMIT_WINDOW_MS = 100;
const EMIT_RATE_LIMIT = 200;
let emitWindowStart = 0;
let emitsInWindow = 0;
let droppedSinceLastWarn = 0;

registerHandler("startMemoryMonitor", (params: unknown) => {
  if (monitorActive) {
    throw new Error("Memory monitor already active");
  }

  const { ranges } = params as {
    ranges: Array<{ base: string; size: number }>;
  };

  if (!Array.isArray(ranges) || ranges.length === 0) {
    throw new Error("At least one memory range is required");
  }

  const nativeRanges = ranges.map((r) => ({
    base: ptr(r.base),
    size: r.size,
  }));

  monitorEvents.length = 0;

  MemoryAccessMonitor.enable(nativeRanges, {
    onAccess(details) {
      const event: MonitorEvent = {
        operation: details.operation,
        from: details.from.toString(),
        address: details.address.toString(),
        rangeIndex: details.rangeIndex,
        pageIndex: details.pageIndex,
        pagesCompleted: details.pagesCompleted,
        pagesTotal: details.pagesTotal,
      };

      if (monitorEvents.length >= MAX_EVENTS) {
        emitLog("warn", `Memory monitor event buffer full (${MAX_EVENTS}), dropping oldest events`);
        monitorEvents.splice(0, monitorEvents.length - MAX_EVENTS + 1);
      }
      monitorEvents.push(event);

      const now = Date.now();
      if (now - emitWindowStart >= EMIT_WINDOW_MS) {
        if (droppedSinceLastWarn > 0) {
          emitLog(
            "warn",
            `Memory monitor throttled: dropped ${droppedSinceLastWarn} events over the last window`,
          );
          droppedSinceLastWarn = 0;
        }
        emitWindowStart = now;
        emitsInWindow = 0;
      }
      if (emitsInWindow < EMIT_RATE_LIMIT) {
        emitsInWindow += 1;
        emitMemoryAccess(event);
      } else {
        droppedSinceLastWarn += 1;
      }
    },
  });

  emitWindowStart = Date.now();
  emitsInWindow = 0;
  droppedSinceLastWarn = 0;
  monitorActive = true;
  return { started: true, rangeCount: ranges.length };
});

registerHandler("stopMemoryMonitor", (_params: unknown) => {
  if (!monitorActive) {
    throw new Error("Memory monitor is not active");
  }

  MemoryAccessMonitor.disable();
  monitorActive = false;

  return { stopped: true, totalEvents: monitorEvents.length };
});

registerHandler("getMemoryMonitorStatus", (_params: unknown) => {
  return {
    active: monitorActive,
    eventsCaptured: monitorEvents.length,
    maxEvents: MAX_EVENTS,
    bufferFull: monitorEvents.length >= MAX_EVENTS,
  };
});

registerHandler("drainMonitorEvents", (_params: unknown) => {
  const drained = monitorEvents.splice(0, monitorEvents.length);
  return {
    events: drained,
    count: drained.length,
  };
});
