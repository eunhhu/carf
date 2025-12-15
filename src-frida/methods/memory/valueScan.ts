import type { MethodHandler } from "../../rpc/types";

type ValueType = "s8" | "u8" | "s16" | "u16" | "s32" | "u32" | "s64" | "u64" | "float" | "double" | "utf8";

type ScanCondition = "eq" | "changed" | "unchanged" | "increased" | "decreased";

type ScanSession = {
  id: string;
  valueType: ValueType;
  addresses: string[];
  lastValues: string[];
};

let valueScanAbortController: { abort: boolean } | null = null;
const scanSessions = new Map<string, ScanSession>();

// Encode UTF-8 without TextEncoder (DOM lib not available in this TS config)
function encodeUtf8(input: string): Uint8Array {
  const encoded = unescape(encodeURIComponent(input));
  const out = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) out[i] = encoded.charCodeAt(i) & 0xff;
  return out;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function bytesToPattern(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

function encodeValueToBytes(valueType: ValueType, value: string): Uint8Array {
  switch (valueType) {
    case "utf8": {
      return encodeUtf8(value);
    }
    case "float": {
      const buf = new ArrayBuffer(4);
      new DataView(buf).setFloat32(0, Number(value), true);
      return new Uint8Array(buf);
    }
    case "double": {
      const buf = new ArrayBuffer(8);
      new DataView(buf).setFloat64(0, Number(value), true);
      return new Uint8Array(buf);
    }
    case "s8":
    case "u8": {
      const n = Number(value) & 0xff;
      return new Uint8Array([n]);
    }
    case "s16":
    case "u16": {
      const buf = new ArrayBuffer(2);
      new DataView(buf).setUint16(0, Number(value) & 0xffff, true);
      return new Uint8Array(buf);
    }
    case "s32":
    case "u32": {
      const buf = new ArrayBuffer(4);
      new DataView(buf).setUint32(0, Number(value) >>> 0, true);
      return new Uint8Array(buf);
    }
    case "s64":
    case "u64": {
      const buf = new ArrayBuffer(8);
      const dv = new DataView(buf);
      const big = BigInt(value);
      const lo = Number(big & BigInt(0xffffffff));
      const hi = Number((big >> BigInt(32)) & BigInt(0xffffffff));
      dv.setUint32(0, lo >>> 0, true);
      dv.setUint32(4, hi >>> 0, true);
      return new Uint8Array(buf);
    }
  }
}

function readValueAsString(address: string, valueType: ValueType): string {
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

function compare(prev: string, next: string, condition: ScanCondition, valueType: ValueType, expected?: string) {
  switch (condition) {
    case "eq":
      return expected !== undefined && next === expected;
    case "changed":
      return next !== prev;
    case "unchanged":
      return next === prev;
    case "increased":
      return Number(next) > Number(prev);
    case "decreased":
      return Number(next) < Number(prev);
    default:
      return false;
  }
}

export const memoryValueScanStart: MethodHandler = async ({ params }) => {
  const { valueType, value, protection = "r--", limit = 5000 } = (params || {}) as {
    valueType?: ValueType;
    value?: string;
    protection?: string;
    limit?: number;
  };

  if (!valueType) throw new Error("valueType is required");
  if (value === undefined) throw new Error("value is required");

  const { emitEvent } = await import("../../rpc/reply");

  valueScanAbortController = { abort: false };
  const controller = valueScanAbortController;

  const scanId = createId("value-scan");
  const matches: string[] = [];

  const patternBytes = encodeValueToBytes(valueType, value);
  if (patternBytes.length === 0) throw new Error("Failed to encode value");
  const pattern = bytesToPattern(patternBytes);

  const ranges = Process.enumerateRanges(protection);
  const totalRanges = ranges.length;

  emitEvent("memory_value_scan_started", { scanId, valueType, value, protection, totalRanges });

  let scannedRanges = 0;
  for (const range of ranges) {
    if (controller.abort || matches.length >= limit) break;
    scannedRanges++;

    try {
      const found = Memory.scanSync(range.base, range.size, pattern);
      for (const m of found) {
        if (controller.abort || matches.length >= limit) break;
        matches.push(m.address.toString());
        emitEvent("memory_value_scan_match", { scanId, address: m.address.toString(), matchIndex: matches.length });
      }
    } catch {
      // ignore
    }

    if (scannedRanges % 10 === 0) {
      emitEvent("memory_value_scan_progress", {
        scanId,
        scannedRanges,
        totalRanges,
        matchCount: matches.length,
        progress: Math.round((scannedRanges / totalRanges) * 100),
      });
    }
  }

  const lastValues = matches.map((addr) => {
    try {
      return readValueAsString(addr, valueType);
    } catch {
      return "";
    }
  });

  scanSessions.set(scanId, { id: scanId, valueType, addresses: matches, lastValues });

  emitEvent("memory_value_scan_complete", {
    scanId,
    totalMatches: matches.length,
    scannedRanges,
    aborted: controller.abort,
  });

  valueScanAbortController = null;

  return { scanId, totalMatches: matches.length, scannedRanges, aborted: controller.abort };
};

export const memoryValueScanAbort: MethodHandler = ({ params }) => {
  const { scanId } = (params || {}) as { scanId?: string };
  if (!scanId) throw new Error("scanId is required");

  if (valueScanAbortController) {
    valueScanAbortController.abort = true;
    return { status: "aborting", scanId };
  }
  return { status: "no_scan_running", scanId };
};

export const memoryValueScanGet: MethodHandler = ({ params }) => {
  const { scanId, offset = 0, limit = 200 } = (params || {}) as {
    scanId?: string;
    offset?: number;
    limit?: number;
  };
  if (!scanId) throw new Error("scanId is required");

  const session = scanSessions.get(scanId);
  if (!session) throw new Error("scan session not found");

  const slice = session.addresses.slice(offset, offset + limit);
  return { scanId, total: session.addresses.length, offset, limit, addresses: slice };
};

export const memoryValueScanNext: MethodHandler = ({ params }) => {
  const { scanId, condition, value } = (params || {}) as {
    scanId?: string;
    condition?: ScanCondition;
    value?: string;
  };

  if (!scanId) throw new Error("scanId is required");
  if (!condition) throw new Error("condition is required");

  const session = scanSessions.get(scanId);
  if (!session) throw new Error("scan session not found");

  const nextAddresses: string[] = [];
  const nextValues: string[] = [];

  for (let i = 0; i < session.addresses.length; i++) {
    const addr = session.addresses[i];
    const prev = session.lastValues[i] ?? "";

    let current: string;
    try {
      current = readValueAsString(addr, session.valueType);
    } catch {
      continue;
    }

    if (compare(prev, current, condition, session.valueType, value)) {
      nextAddresses.push(addr);
      nextValues.push(current);
    }
  }

  scanSessions.set(scanId, {
    ...session,
    addresses: nextAddresses,
    lastValues: nextValues,
  });

  return { scanId, totalMatches: nextAddresses.length };
};

export const memoryValueScanClear: MethodHandler = ({ params }) => {
  const { scanId } = (params || {}) as { scanId?: string };
  if (!scanId) throw new Error("scanId is required");

  scanSessions.delete(scanId);
  return { success: true, scanId };
};
