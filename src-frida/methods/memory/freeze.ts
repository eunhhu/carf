import type { MethodHandler } from "../../rpc/types";

type FreezeValueType = "s8" | "u8" | "s16" | "u16" | "s32" | "u32" | "s64" | "u64" | "float" | "double";

type FreezeItem = {
  id: string;
  address: string;
  valueType: FreezeValueType;
  value: string;
  intervalMs: number;
  enabled: boolean;
  timer: number;
  writeCount: number;
  lastWriteTime: number;
};

const freezeItems = new Map<string, FreezeItem>();

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function writeValueFromString(address: string, valueType: FreezeValueType, value: string): boolean {
  try {
    const ptr = new NativePointer(address);

    // Ensure memory is writable
    Memory.protect(ptr, getTypeSize(valueType), "rw-");

    switch (valueType) {
      case "s8":
        ptr.writeS8(parseInt(value, 10));
        break;
      case "u8":
        ptr.writeU8(parseInt(value, 10));
        break;
      case "s16":
        ptr.writeS16(parseInt(value, 10));
        break;
      case "u16":
        ptr.writeU16(parseInt(value, 10));
        break;
      case "s32":
        ptr.writeS32(parseInt(value, 10));
        break;
      case "u32":
        ptr.writeU32(parseInt(value, 10));
        break;
      case "s64":
        ptr.writeS64(Int64(value));
        break;
      case "u64":
        ptr.writeU64(UInt64(value));
        break;
      case "float":
        ptr.writeFloat(parseFloat(value));
        break;
      case "double":
        ptr.writeDouble(parseFloat(value));
        break;
    }
    return true;
  } catch {
    return false;
  }
}

function readValueAsString(address: string, valueType: FreezeValueType): string {
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
  }
}

function getTypeSize(valueType: FreezeValueType): number {
  switch (valueType) {
    case "s8":
    case "u8":
      return 1;
    case "s16":
    case "u16":
      return 2;
    case "s32":
    case "u32":
    case "float":
      return 4;
    case "s64":
    case "u64":
    case "double":
      return 8;
  }
}

function stopFreeze(id: string) {
  const item = freezeItems.get(id);
  if (!item) return;
  clearInterval(item.timer);
  freezeItems.delete(id);
}

export const memoryFreezeAdd: MethodHandler = async ({ params }) => {
  const { address, valueType, value, intervalMs = 100 } = (params || {}) as {
    address?: string;
    valueType?: FreezeValueType;
    value?: string;
    intervalMs?: number;
  };

  if (!address) throw new Error("address is required");
  if (!valueType) throw new Error("valueType is required");
  if (value === undefined) throw new Error("value is required");

  const { emitEvent } = await import("../../rpc/reply");

  const id = createId("freeze");
  const effectiveInterval = Math.max(10, intervalMs); // Minimum 10ms

  // Initial write
  const success = writeValueFromString(address, valueType, value);
  if (!success) {
    throw new Error(`Failed to write initial value to ${address}`);
  }

  let writeCount = 1;
  let lastWriteTime = Date.now();

  // Periodic write to maintain frozen value
  const timer = setInterval(() => {
    const current = freezeItems.get(id);
    if (!current || !current.enabled) return;

    const wrote = writeValueFromString(current.address, current.valueType, current.value);
    if (wrote) {
      current.writeCount++;
      current.lastWriteTime = Date.now();

      // Emit event every 10 writes to reduce noise
      if (current.writeCount % 10 === 0) {
        emitEvent("memory_freeze_tick", {
          freezeId: current.id,
          address: current.address,
          value: current.value,
          writeCount: current.writeCount,
        });
      }
    }
  }, effectiveInterval);

  freezeItems.set(id, {
    id,
    address,
    valueType,
    value,
    intervalMs: effectiveInterval,
    enabled: true,
    timer: timer as unknown as number,
    writeCount,
    lastWriteTime,
  });

  emitEvent("memory_freeze_added", {
    freezeId: id,
    address,
    valueType,
    value,
    intervalMs: effectiveInterval,
  });

  return {
    freezeId: id,
    address,
    valueType,
    value,
    intervalMs: effectiveInterval,
    enabled: true,
  };
};

export const memoryFreezeRemove: MethodHandler = async ({ params }) => {
  const { freezeId } = (params || {}) as { freezeId?: string };
  if (!freezeId) throw new Error("freezeId is required");

  const { emitEvent } = await import("../../rpc/reply");

  const existed = freezeItems.has(freezeId);
  stopFreeze(freezeId);

  emitEvent("memory_freeze_removed", { freezeId, existed });
  return { success: true, freezeId, existed };
};

export const memoryFreezeUpdate: MethodHandler = async ({ params }) => {
  const { freezeId, value, enabled } = (params || {}) as {
    freezeId?: string;
    value?: string;
    enabled?: boolean;
  };

  if (!freezeId) throw new Error("freezeId is required");

  const { emitEvent } = await import("../../rpc/reply");

  const item = freezeItems.get(freezeId);
  if (!item) throw new Error(`Freeze ${freezeId} not found`);

  // Update value if provided
  if (value !== undefined) {
    item.value = value;
    // Immediately write the new value
    if (item.enabled) {
      writeValueFromString(item.address, item.valueType, value);
      item.writeCount++;
      item.lastWriteTime = Date.now();
    }
  }

  // Update enabled state
  if (enabled !== undefined) {
    item.enabled = enabled;
    // If re-enabling, write immediately
    if (enabled && value === undefined) {
      writeValueFromString(item.address, item.valueType, item.value);
      item.writeCount++;
      item.lastWriteTime = Date.now();
    }
  }

  emitEvent("memory_freeze_updated", {
    freezeId,
    value: item.value,
    enabled: item.enabled,
  });

  return {
    freezeId,
    address: item.address,
    valueType: item.valueType,
    value: item.value,
    enabled: item.enabled,
    writeCount: item.writeCount,
  };
};

export const memoryFreezeList: MethodHandler = () => {
  return Array.from(freezeItems.values()).map((f) => ({
    freezeId: f.id,
    address: f.address,
    valueType: f.valueType,
    value: f.value,
    intervalMs: f.intervalMs,
    enabled: f.enabled,
    writeCount: f.writeCount,
    lastWriteTime: f.lastWriteTime,
  }));
};

export const memoryFreezeClear: MethodHandler = async () => {
  const { emitEvent } = await import("../../rpc/reply");

  const ids = Array.from(freezeItems.keys());
  ids.forEach((id) => stopFreeze(id));

  emitEvent("memory_freeze_cleared", { count: ids.length });
  return { success: true, count: ids.length };
};

// Read current value at frozen address (for UI display)
export const memoryFreezeRead: MethodHandler = ({ params }) => {
  const { freezeId } = (params || {}) as { freezeId?: string };
  if (!freezeId) throw new Error("freezeId is required");

  const item = freezeItems.get(freezeId);
  if (!item) throw new Error(`Freeze ${freezeId} not found`);

  try {
    const currentValue = readValueAsString(item.address, item.valueType);
    return {
      freezeId,
      address: item.address,
      frozenValue: item.value,
      currentValue,
      matches: currentValue === item.value,
    };
  } catch (e) {
    throw new Error(`Failed to read frozen address: ${e}`);
  }
};
