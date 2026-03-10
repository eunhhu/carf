import { registerHandler } from "../rpc/router";
import { emitStalkerEvent } from "../rpc/protocol";

interface StalkerSession {
  threadId: number;
  eventBuffer: unknown[];
}

const sessions = new Map<number, StalkerSession>();
const FLUSH_INTERVAL_MS = 500;
const MAX_BUFFER_SIZE = 1000;

// Periodic flush to avoid holding too many events in memory
let flushTimer: ReturnType<typeof setInterval> | null = null;

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

  const session: StalkerSession = { threadId, eventBuffer: [] };
  sessions.set(threadId, session);

  const eventMask: StalkerEventType[] = [];
  if (events.call) eventMask.push("call");
  if (events.ret) eventMask.push("ret");
  if (events.exec) eventMask.push("exec");
  if (events.block) eventMask.push("block");
  if (events.compile) eventMask.push("compile");

  Stalker.follow(threadId, {
    events: {
      call: events.call ?? false,
      ret: events.ret ?? false,
      exec: events.exec ?? false,
      block: events.block ?? false,
      compile: events.compile ?? false,
    },
    onReceive(rawEvents: ArrayBuffer) {
      const parsed = Stalker.parse(rawEvents, {
        annotate: true,
        stringify: true,
      });

      const s = sessions.get(threadId);
      if (s) {
        for (const ev of parsed as unknown[]) {
          s.eventBuffer.push(ev);
        }
        // Immediate flush if buffer is full
        if (s.eventBuffer.length >= MAX_BUFFER_SIZE) {
          emitStalkerEvent(s.eventBuffer.splice(0));
        }
      }
    },
  });

  ensureFlushTimer();

  return { threadId, started: true, events: eventMask };
});

registerHandler("stopStalker", (params: unknown) => {
  const { threadId } = params as { threadId: number };

  if (!sessions.has(threadId)) {
    throw new Error(`Stalker not following thread: ${threadId}`);
  }

  Stalker.unfollow(threadId);

  const session = sessions.get(threadId)!;
  const remaining = session.eventBuffer.splice(0);
  sessions.delete(threadId);

  if (remaining.length > 0) {
    emitStalkerEvent(remaining);
  }

  return { threadId, stopped: true };
});

registerHandler("getStalkerEvents", (params: unknown) => {
  const p = (params as { threadId?: number }) ?? {};

  if (p.threadId !== undefined) {
    const session = sessions.get(p.threadId);
    if (!session) return { threadId: p.threadId, events: [] };
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
  const result: { threadId: number; buffered: number }[] = [];
  for (const session of sessions.values()) {
    result.push({ threadId: session.threadId, buffered: session.eventBuffer.length });
  }
  return result;
});
