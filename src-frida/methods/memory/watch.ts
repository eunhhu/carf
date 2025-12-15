import type { MethodHandler } from "../../rpc/types";

type WatchValueType = "s8" | "u8" | "s16" | "u16" | "s32" | "u32" | "s64" | "u64" | "float" | "double" | "utf8";

type WatchItem = {
  id: string;
  address: string;
  valueType: WatchValueType;
  intervalMs: number;
  lastValue: string;
  timer: number;
};

const watchItems = new Map<string, WatchItem>();

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readValueAsString(address: string, valueType: WatchValueType): string {
  const ptr = new NativePointer(address);
  switch (valueType) {
    case "s8":
      return ptr.readS8().toString();
    case "u8":
      return ptr.readU8().toString();
    case "s16":
      return ptr.readS16().toString();
    case "u16":
      return ptr.readU16().toString();
    case "s32":
      return ptr.readS32().toString();
    case "u32":
      return ptr.readU32().toString();
    case "s64":
      return ptr.readS64().toString();
    case "u64":
      return ptr.readU64().toString();
    case "float":
      return ptr.readFloat().toString();
    case "double":
      return ptr.readDouble().toString();
    case "utf8":
      return ptr.readUtf8String() ?? "";
  }
}

function stopWatch(id: string) {
  const item = watchItems.get(id);
  if (!item) return;
  clearInterval(item.timer);
  watchItems.delete(id);
}

export const memoryWatchAdd: MethodHandler = async ({ params }) => {
  const { address, valueType, intervalMs = 250 } = (params || {}) as {
    address?: string;
    valueType?: WatchValueType;
    intervalMs?: number;
  };

  if (!address) throw new Error("address is required");
  if (!valueType) throw new Error("valueType is required");

  const { emitEvent } = await import("../../rpc/reply");

  const id = createId("watch");
  let lastValue = "";

  try {
    lastValue = readValueAsString(address, valueType);
  } catch {
    lastValue = "";
  }

  // Periodic read & emit changes
  const timer = setInterval(() => {
    const current = watchItems.get(id);
    if (!current) return;

    let nextValue: string;
    try {
      nextValue = readValueAsString(current.address, current.valueType);
    } catch {
      // If address becomes invalid, just skip this tick
      return;
    }

    const changed = nextValue !== current.lastValue;
    current.lastValue = nextValue;

    emitEvent("memory_watch_update", {
      watchId: current.id,
      address: current.address,
      valueType: current.valueType,
      value: nextValue,
      changed,
      timestamp: Date.now(),
    });
  }, Math.max(50, intervalMs));

  watchItems.set(id, {
    id,
    address,
    valueType,
    intervalMs: Math.max(50, intervalMs),
    lastValue,
    timer: timer as unknown as number,
  });

  emitEvent("memory_watch_added", { watchId: id, address, valueType, intervalMs: Math.max(50, intervalMs) });

  return { watchId: id, address, valueType, intervalMs: Math.max(50, intervalMs), value: lastValue };
};

export const memoryWatchRemove: MethodHandler = async ({ params }) => {
  const { watchId } = (params || {}) as { watchId?: string };
  if (!watchId) throw new Error("watchId is required");

  const { emitEvent } = await import("../../rpc/reply");

  const existed = watchItems.has(watchId);
  stopWatch(watchId);

  emitEvent("memory_watch_removed", { watchId, existed });
  return { success: true, watchId, existed };
};

export const memoryWatchList: MethodHandler = () => {
  return Array.from(watchItems.values()).map((w) => ({
    watchId: w.id,
    address: w.address,
    valueType: w.valueType,
    intervalMs: w.intervalMs,
    lastValue: w.lastValue,
  }));
};

export const memoryWatchClear: MethodHandler = async () => {
  const { emitEvent } = await import("../../rpc/reply");

  const ids = Array.from(watchItems.keys());
  ids.forEach((id) => stopWatch(id));

  emitEvent("memory_watch_cleared", { count: ids.length });
  return { success: true, count: ids.length };
};
