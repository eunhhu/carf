import { JavaRuntime as Java } from "../bridges";
import { registerHandler } from "../rpc/router";
import { emitStalkerEvent } from "../rpc/protocol";

interface StructuredStalkerEvent {
  threadId: number;
  type: "call" | "ret" | "exec" | "block";
  from: string;
  to: string;
  fromModule: string | null;
  toModule: string | null;
  fromSymbol: string | null;
  toSymbol: string | null;
  depth: number;
  count: number;
}

interface StalkerSession {
  threadId: number;
  eventBuffer: StructuredStalkerEvent[];
  summaryMode: boolean;
  samplingMode: boolean;
  packageName: string | null;
}

interface ModuleRange {
  base: NativePointer;
  size: number;
}

const sessions = new Map<number, StalkerSession>();
const moduleMap = new ModuleMap();
const addressCache = new Map<string, {
  address: string;
  moduleName: string | null;
  symbolName: string | null;
}>();
const FLUSH_INTERVAL_MS = 500;
const MAX_BUFFER_SIZE = 1000;
const MAX_CACHE_SIZE = 8192;
const excludedModuleRanges = new Set<string>();

// Periodic flush to avoid holding too many events in memory
let flushTimer: ReturnType<typeof setInterval> | null = null;

function getAndroidPackageName(): string | null {
  if (Process.platform !== "android") {
    return null;
  }

  try {
    if (!Java.available) {
      return null;
    }
  } catch {
    return null;
  }

  let packageName: string | null = null;

  try {
    Java.performNow(() => {
      try {
        const ActivityThread = Java.use("android.app.ActivityThread");
        const app = ActivityThread.currentApplication();
        if (app !== null) {
          packageName = String(app.getPackageName());
        }
      } catch {
        packageName = null;
      }
    });
  } catch {
    packageName = null;
  }

  return packageName;
}

function shouldExcludeModule(module: Module, packageName: string | null): boolean {
  if (module.path.includes("frida")) {
    return true;
  }

  if (Process.platform !== "android") {
    return false;
  }

  if (module.name === "linker" || module.name === "linker64") {
    return true;
  }

  const normalizedPath = module.path.toLowerCase();
  const normalizedPackage = packageName?.toLowerCase() ?? null;
  const isPackageModule =
    normalizedPackage !== null &&
    (normalizedPath.includes(`/${normalizedPackage}-`) ||
      normalizedPath.includes(`/${normalizedPackage}/`));
  const isAppNativeLibrary =
    isPackageModule &&
    normalizedPath.includes(".apk!/lib/") &&
    module.name.endsWith(".so");

  if (normalizedPath.endsWith(".odex") || normalizedPath.endsWith(".oat")) {
    return true;
  }

  if (normalizedPath.startsWith("/data/misc/")) {
    return true;
  }

  if (isAppNativeLibrary) {
    return false;
  }

  return (
    module.path.startsWith("/system/") ||
    module.path.startsWith("/apex/") ||
    module.path.startsWith("/vendor/") ||
    module.path.startsWith("/product/") ||
    module.path.startsWith("/memfd:") ||
    !isPackageModule
  );
}

function excludeModuleRange(range: ModuleRange): void {
  const key = `${range.base.toString()}:${range.size}`;
  if (excludedModuleRanges.has(key)) {
    return;
  }

  Stalker.exclude(range);
  excludedModuleRanges.add(key);
}

function configureStalkerEnvironment(summaryMode: boolean): void {
  if (summaryMode) {
    Stalker.queueCapacity = 32768;
    Stalker.queueDrainInterval = 1000;
  } else {
    Stalker.queueCapacity = 4096;
    Stalker.queueDrainInterval = 250;
  }

  if (Process.platform === "android") {
    const packageName = getAndroidPackageName();
    for (const module of Process.enumerateModules()) {
      if (!shouldExcludeModule(module, packageName)) {
        continue;
      }

      try {
        excludeModuleRange({ base: module.base, size: module.size });
      } catch {
        // Some ranges cannot be excluded on every build; skip them.
      }
    }
  }
}

function shouldCaptureAddress(
  address: NativePointerValue,
  packageName: string | null,
): boolean {
  const module = Process.findModuleByAddress(ptr(address));
  if (!module) {
    return false;
  }

  return !shouldExcludeModule(module, packageName);
}

function sampleThreadBacktrace(
  sessionKey: number,
  sampledThreadId: number,
  packageName: string | null,
): void {
  const session = sessions.get(sessionKey);
  if (!session) {
    return;
  }

  const thread = Process.enumerateThreads().find(
    (candidate) => candidate.id === sampledThreadId,
  );
  if (!thread) {
    return;
  }

  const frames = Thread.backtrace(thread.context, Backtracer.FUZZY);
  if (frames.length < 2) {
    return;
  }

  for (let index = 0; index < frames.length - 1; index += 1) {
    const calleeAddress = frames[index];
    const callerAddress = frames[index + 1];

    if (
      !shouldCaptureAddress(calleeAddress, packageName) ||
      !shouldCaptureAddress(callerAddress, packageName)
    ) {
      continue;
    }

    const callee = describeAddress(calleeAddress);
    const caller = describeAddress(callerAddress);

    pushStalkerEvent(sessionKey, {
      threadId: sampledThreadId,
      type: "call",
      from: caller.address,
      to: callee.address,
      fromModule: caller.moduleName,
      toModule: callee.moduleName,
      fromSymbol: caller.symbolName,
      toSymbol: callee.symbolName,
      depth: index,
      count: 1,
    });
  }
}

function describeAddress(address: NativePointerValue): {
  address: string;
  moduleName: string | null;
  symbolName: string | null;
} {
  const pointer = ptr(address);
  const normalizedAddress = pointer.toString();
  const cached = addressCache.get(normalizedAddress);
  if (cached) {
    return cached;
  }

  const moduleName = moduleMap.findName(pointer) ?? null;
  let symbolName: string | null = null;

  try {
    const symbol = DebugSymbol.fromAddress(pointer);
    symbolName = symbol.name ?? null;
  } catch {
    symbolName = null;
  }

  const described = {
    address: normalizedAddress,
    moduleName,
    symbolName,
  };

  if (addressCache.size >= MAX_CACHE_SIZE) {
    addressCache.clear();
  }
  addressCache.set(normalizedAddress, described);

  return described;
}

function normalizeEvent(
  threadId: number,
  rawEvent: unknown,
): StructuredStalkerEvent | null {
  if (!Array.isArray(rawEvent) || rawEvent.length === 0) {
    return null;
  }

  const [eventType, first, second, depthValue] = rawEvent as [
    unknown,
    unknown,
    unknown?,
    unknown?,
  ];

  if (
    eventType !== "call" &&
    eventType !== "ret" &&
    eventType !== "exec" &&
    eventType !== "block"
  ) {
    return null;
  }

  if (first === undefined) {
    return null;
  }

  if (eventType === "exec") {
    const info = describeAddress(first as NativePointerValue);
    return {
      threadId,
      type: "exec",
      from: info.address,
      to: info.address,
      fromModule: info.moduleName,
      toModule: info.moduleName,
      fromSymbol: info.symbolName,
      toSymbol: info.symbolName,
        depth: 0,
        count: 1,
      };
  }

  if (second === undefined) {
    return null;
  }

  if (eventType === "block") {
    const info = describeAddress(first as NativePointerValue);
    return {
      threadId,
      type: "block",
      from: info.address,
      to: info.address,
      fromModule: info.moduleName,
      toModule: info.moduleName,
      fromSymbol: info.symbolName,
      toSymbol: info.symbolName,
      depth: 0,
      count: 1,
    };
  }

  const from = describeAddress(first as NativePointerValue);
  const to = describeAddress(second as NativePointerValue);

  return {
    threadId,
    type: eventType,
    from: from.address,
    to: to.address,
    fromModule: from.moduleName,
    toModule: to.moduleName,
    fromSymbol: from.symbolName,
    toSymbol: to.symbolName,
    depth:
      eventType === "call" || eventType === "ret"
        ? typeof depthValue === "number"
          ? depthValue
          : 0
        : 0,
    count: 1,
  };
}

function pushStalkerEvent(threadId: number, event: StructuredStalkerEvent): void {
  const session = sessions.get(threadId);
  if (!session) {
    return;
  }

  session.eventBuffer.push(event);
  if (session.eventBuffer.length >= MAX_BUFFER_SIZE) {
    emitStalkerEvent(session.eventBuffer.splice(0));
  }
}

function ensureFlushTimer(): void {
  if (flushTimer !== null) return;
  flushTimer = setInterval(() => {
    let anyEvents = false;
    for (const session of sessions.values()) {
      if (session.eventBuffer.length > 0) {
        emitStalkerEvent(session.eventBuffer.splice(0));
        anyEvents = true;
      }
    }
    if (!anyEvents && sessions.size === 0 && flushTimer !== null) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  }, FLUSH_INTERVAL_MS);
}

registerHandler("startStalker", (params: unknown) => {
  const {
    threadId,
    events = {},
  } = params as {
    threadId: number;
    events?: {
      call?: boolean;
      ret?: boolean;
      exec?: boolean;
      block?: boolean;
      compile?: boolean;
    };
  };

  if (sessions.has(threadId)) {
    throw new Error(`Stalker already following thread: ${threadId}`);
  }

  const summaryMode =
    (events.call ?? false) &&
    !(events.ret ?? false) &&
    !(events.exec ?? false) &&
    !(events.block ?? false) &&
    !(events.compile ?? false);
  const samplingMode = Process.platform === "android";
  const packageName = samplingMode ? getAndroidPackageName() : null;

  const session: StalkerSession = {
    threadId,
    eventBuffer: [],
    summaryMode,
    samplingMode,
    packageName,
  };

  const eventMask: StalkerEventType[] = [];
  if (events.call) eventMask.push("call");
  if (events.ret) eventMask.push("ret");
  if (events.exec) eventMask.push("exec");
  if (events.block) eventMask.push("block");
  if (events.compile) eventMask.push("compile");

  try {
    // Android's SELinux + verified boot makes Frida's Stalker rewrite the
    // thread that owns the instrumented code, which can deadlock the
    // target. On Android we fall back to periodic sampling instead of
    // calling Stalker.follow. The actual sampling loop is started
    // elsewhere via ensureFlushTimer + onSampleTick.
    if (!samplingMode) {
      configureStalkerEnvironment(summaryMode);
      Stalker.follow(threadId, {
        events: {
          call: events.call ?? false,
          ret: events.ret ?? false,
          exec: events.exec ?? false,
          block: events.block ?? false,
          compile: events.compile ?? false,
        },
        onReceive: summaryMode
          ? undefined
          : (rawEvents: ArrayBuffer) => {
              const parsed = Stalker.parse(rawEvents, {
                annotate: true,
                stringify: false,
              });

              for (const ev of parsed as unknown[]) {
                const normalized = normalizeEvent(threadId, ev);
                if (normalized !== null) {
                  pushStalkerEvent(threadId, normalized);
                }
              }
            },
        onCallSummary: summaryMode
          ? (summary: Record<string, number>) => {
              for (const [address, count] of Object.entries(summary)) {
                if (count <= 0) {
                  continue;
                }

                const target = describeAddress(ptr(address));
                pushStalkerEvent(threadId, {
                  threadId,
                  type: "call",
                  from: `thread:${threadId}`,
                  to: target.address,
                  fromModule: null,
                  toModule: target.moduleName,
                  fromSymbol: null,
                  toSymbol: target.symbolName,
                  depth: 0,
                  count,
                });
              }
            }
          : undefined,
      });
    }
    sessions.set(threadId, session);
  } catch (error) {
    sessions.delete(threadId);
    throw error;
  }

  ensureFlushTimer();

  return {
    threadId,
    started: true,
    events: eventMask,
    mode: samplingMode ? "sampling" : "stalker",
  };
});

registerHandler("stopStalker", (params: unknown) => {
  const { threadId } = params as { threadId: number };

  if (!sessions.has(threadId)) {
    throw new Error(`Stalker not following thread: ${threadId}`);
  }

  const session = sessions.get(threadId)!;
  if (!session.samplingMode) {
    Stalker.unfollow(threadId);
    Stalker.garbageCollect();
  }
  const remaining = session.eventBuffer.splice(0);
  sessions.delete(threadId);

  if (remaining.length > 0) {
    emitStalkerEvent(remaining);
  }

  // Tear the flush timer down as soon as the last session disappears so we
  // don't leave a periodic interval running inside the target process.
  if (sessions.size === 0 && flushTimer !== null) {
    clearInterval(flushTimer);
    flushTimer = null;
  }

  return { threadId, stopped: true };
});

registerHandler("getStalkerEvents", (params: unknown) => {
  const p = (params as { threadId?: number }) ?? {};

  if (p.threadId !== undefined) {
    const session = sessions.get(p.threadId);
    if (!session) return { threadId: p.threadId, events: [] };
    if (session.samplingMode) {
      sampleThreadBacktrace(session.threadId, session.threadId, session.packageName);
    }
    const events = session.eventBuffer.splice(0);
    return { threadId: p.threadId, events };
  }

  // Return and drain all sessions
  const all: { threadId: number; events: unknown[] }[] = [];
  for (const session of sessions.values()) {
    all.push({ threadId: session.threadId, events: session.eventBuffer.splice(0) });
  }
  return all;
});

registerHandler("listStalkerSessions", (_params: unknown) => {
  const result: {
    threadId: number;
    buffered: number;
    samplingMode: boolean;
  }[] = [];
  for (const session of sessions.values()) {
    result.push({
      threadId: session.threadId,
      buffered: session.eventBuffer.length,
      samplingMode: session.samplingMode,
    });
  }
  return result;
});
