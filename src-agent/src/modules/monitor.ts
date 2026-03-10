import { registerHandler } from "../rpc/router";
import { emitMemoryAccess } from "../rpc/protocol";

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

      if (monitorEvents.length < MAX_EVENTS) {
        monitorEvents.push(event);
      }

      emitMemoryAccess(event);
    },
  });

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
