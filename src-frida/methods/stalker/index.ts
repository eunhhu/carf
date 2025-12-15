import type { MethodHandler } from "../../rpc/types";

// Active stalker sessions
const activeStalkers: Set<number> = new Set();

type FollowParams = {
  threadId?: number;
  events?: {
    call?: boolean;
    ret?: boolean;
    exec?: boolean;
    block?: boolean;
    compile?: boolean;
  };
};

// Follow a thread with Stalker
export const stalkerFollow: MethodHandler = ({ params }) => {
  const { threadId, events = {} } = (params || {}) as FollowParams;

  const tid = threadId ?? Process.getCurrentThreadId();

  if (activeStalkers.has(tid)) {
    throw new Error(`Thread ${tid} is already being followed`);
  }

  try {
    const eventMask = {
      call: events.call ?? true,
      ret: events.ret ?? false,
      exec: events.exec ?? false,
      block: events.block ?? false,
      compile: events.compile ?? false,
    };

    Stalker.follow(tid, {
      events: eventMask,
      onReceive: (events) => {
        send({
          type: "carf:event",
          event: "stalker_events",
          threadId: tid,
          count: events.byteLength,
        });
      },
      onCallSummary: (summary) => {
        const calls: { target: string; count: number }[] = [];
        for (const [target, count] of Object.entries(summary)) {
          calls.push({ target, count: count as number });
        }
        send({
          type: "carf:event",
          event: "stalker_call_summary",
          threadId: tid,
          calls: calls.slice(0, 100), // Limit to 100 entries
        });
      },
    });

    activeStalkers.add(tid);
    return { success: true, threadId: tid };
  } catch (e) {
    throw new Error(`Failed to follow thread: ${e}`);
  }
};

// Unfollow a thread
export const stalkerUnfollow: MethodHandler = ({ params }) => {
  const { threadId } = (params || {}) as { threadId?: number };

  const tid = threadId ?? Process.getCurrentThreadId();

  if (!activeStalkers.has(tid)) {
    throw new Error(`Thread ${tid} is not being followed`);
  }

  try {
    Stalker.unfollow(tid);
    activeStalkers.delete(tid);
    return { success: true, threadId: tid };
  } catch (e) {
    throw new Error(`Failed to unfollow thread: ${e}`);
  }
};

// Garbage collect stalker
export const stalkerGarbageCollect: MethodHandler = () => {
  try {
    Stalker.garbageCollect();
    return { success: true };
  } catch (e) {
    throw new Error(`Failed to garbage collect: ${e}`);
  }
};

// Flush stalker
export const stalkerFlush: MethodHandler = () => {
  try {
    Stalker.flush();
    return { success: true };
  } catch (e) {
    throw new Error(`Failed to flush stalker: ${e}`);
  }
};

// Get stalker trust threshold
export const stalkerGetTrustThreshold: MethodHandler = () => {
  return { trustThreshold: Stalker.trustThreshold };
};

// Set stalker trust threshold
export const stalkerSetTrustThreshold: MethodHandler = ({ params }) => {
  const { value } = (params || {}) as { value?: number };

  if (value === undefined) {
    throw new Error("value parameter is required");
  }

  try {
    Stalker.trustThreshold = value;
    return { success: true, trustThreshold: value };
  } catch (e) {
    throw new Error(`Failed to set trust threshold: ${e}`);
  }
};

// List active stalker sessions
export const stalkerList: MethodHandler = () => {
  return Array.from(activeStalkers);
};

// Parse stalker events (helper)
export const stalkerParse: MethodHandler = ({ params }) => {
  const { events, format = "json" } = (params || {}) as { events?: ArrayBuffer; format?: string };

  if (!events) {
    throw new Error("events parameter is required");
  }

  try {
    const parsed = Stalker.parse(events, { stringify: format === "string" });
    return parsed;
  } catch (e) {
    throw new Error(`Failed to parse events: ${e}`);
  }
};

// Invalidate stalker cache for address range
export const stalkerInvalidate: MethodHandler = ({ params }) => {
  const { address, size } = (params || {}) as { address?: string; size?: number };

  if (!address) {
    throw new Error("address parameter is required");
  }

  try {
    const ptr = new NativePointer(address);
    if (size !== undefined) {
      Stalker.invalidate(ptr, size);
    } else {
      Stalker.invalidate(ptr);
    }
    return { success: true, address, size };
  } catch (e) {
    throw new Error(`Failed to invalidate: ${e}`);
  }
};

// Exclude a memory range from stalking
export const stalkerExclude: MethodHandler = ({ params }) => {
  const { base, size } = (params || {}) as { base?: string; size?: number };

  if (!base || !size) {
    throw new Error("base and size parameters are required");
  }

  try {
    Stalker.exclude({ base: new NativePointer(base), size });
    return { success: true, base, size };
  } catch (e) {
    throw new Error(`Failed to exclude range: ${e}`);
  }
};

// Call probes storage
const callProbes: Map<string, InvocationListener> = new Map();

// Add a call probe at address
export const stalkerAddCallProbe: MethodHandler = async ({ params }) => {
  const { address } = (params || {}) as { address?: string };

  if (!address) {
    throw new Error("address parameter is required");
  }

  try {
    const ptr = new NativePointer(address);
    const id = `probe_${address}_${Date.now()}`;

    const { emitEvent } = await import("../../rpc/reply");

    const probeId = Stalker.addCallProbe(ptr, (args) => {
      emitEvent("stalker_call_probe", {
        id,
        address,
        args: [
          args[0].toString(),
          args[1].toString(),
          args[2].toString(),
          args[3].toString(),
        ],
      });
    });

    callProbes.set(id, probeId as unknown as InvocationListener);
    return { id, address };
  } catch (e) {
    throw new Error(`Failed to add call probe: ${e}`);
  }
};

// Remove a call probe
export const stalkerRemoveCallProbe: MethodHandler = ({ params }) => {
  const { id } = (params || {}) as { id?: string };

  if (!id) {
    throw new Error("id parameter is required");
  }

  const probe = callProbes.get(id);
  if (!probe) {
    throw new Error(`Call probe '${id}' not found`);
  }

  try {
    Stalker.removeCallProbe(probe as unknown as StalkerCallProbeId);
    callProbes.delete(id);
    return { success: true, id };
  } catch (e) {
    throw new Error(`Failed to remove call probe: ${e}`);
  }
};

// List call probes
export const stalkerListCallProbes: MethodHandler = () => {
  return Array.from(callProbes.keys());
};

// Get stalker queue capacity
export const stalkerGetQueueCapacity: MethodHandler = () => {
  return { queueCapacity: Stalker.queueCapacity };
};

// Set stalker queue capacity
export const stalkerSetQueueCapacity: MethodHandler = ({ params }) => {
  const { value } = (params || {}) as { value?: number };

  if (value === undefined) {
    throw new Error("value parameter is required");
  }

  try {
    Stalker.queueCapacity = value;
    return { success: true, queueCapacity: value };
  } catch (e) {
    throw new Error(`Failed to set queue capacity: ${e}`);
  }
};

// Get stalker queue drain interval
export const stalkerGetQueueDrainInterval: MethodHandler = () => {
  return { queueDrainInterval: Stalker.queueDrainInterval };
};

// Set stalker queue drain interval
export const stalkerSetQueueDrainInterval: MethodHandler = ({ params }) => {
  const { value } = (params || {}) as { value?: number };

  if (value === undefined) {
    throw new Error("value parameter is required");
  }

  try {
    Stalker.queueDrainInterval = value;
    return { success: true, queueDrainInterval: value };
  } catch (e) {
    throw new Error(`Failed to set queue drain interval: ${e}`);
  }
};
