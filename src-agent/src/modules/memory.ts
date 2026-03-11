import { registerHandler } from "../rpc/router";
import { emitEvent } from "../rpc/protocol";
import { readByteArray, writeByteArray } from "../runtime/frida-compat";

function hexEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function hexDecode(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex string length");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function buildScanResult(match: MemoryScanMatch): {
  address: string;
  size: number;
  moduleName: string | null;
  offset: number | null;
  value: string | null;
} {
  const module = Process.findModuleByAddress(match.address);
  const value = readByteArray(match.address, match.size);

  return {
    address: match.address.toString(),
    size: match.size,
    moduleName: module?.name ?? null,
    offset:
      module != null
        ? Number(match.address.sub(module.base).toString())
        : null,
    value: value ? hexEncode(value) : null,
  };
}

function scanRange(
  base: NativePointer,
  size: number,
  pattern: string,
): Promise<Array<ReturnType<typeof buildScanResult>>> {
  return new Promise((resolve, reject) => {
    const results: Array<ReturnType<typeof buildScanResult>> = [];

    Memory.scan(base, size, pattern, {
      onMatch(address, matchSize) {
        results.push(
          buildScanResult({
            address,
            size: matchSize,
          }),
        );
      },
      onError(reason) {
        reject(new Error(reason));
      },
      onComplete() {
        resolve(results);
      },
    });
  });
}

registerHandler("readMemory", (params: unknown) => {
  const { address, size } = params as { address: string; size: number };
  if (size <= 0 || size > 64 * 1024 * 1024) {
    throw new Error(`Invalid size: ${size} (max 64MB)`);
  }
  const buf = readByteArray(address, size);
  if (!buf) throw new Error("Failed to read memory");
  return hexEncode(buf);
});

registerHandler("writeMemory", (params: unknown) => {
  const {
    address,
    bytes,
    data,
  } = params as { address: string; bytes?: string; data?: string };
  const encoded = data ?? bytes;
  if (!encoded) {
    throw new Error("Memory write payload is required");
  }
  const decoded = hexDecode(encoded);
  writeByteArray(address, decoded);
  return { written: decoded.length };
});

registerHandler("scanMemory", async (params: unknown) => {
  const { address, base, size, pattern, protection, ranges } = params as {
    address?: string;
    base?: string;
    size?: number;
    pattern: string;
    protection?: string;
    ranges?: string;
  };
  const resolvedBase = address ?? base;
  const resolvedProtection = ranges ?? protection ?? "r--";

  const results: Array<ReturnType<typeof buildScanResult>> = [];

  if (resolvedBase && typeof size === "number") {
    results.push(...(await scanRange(ptr(resolvedBase), size, pattern)));
    emitEvent("scan/progress", { progress: 100, scanned: 1, total: 1 });
    emitEvent("scan/result", { results });
    return results;
  }

  const rangesToScan = Process.enumerateRanges(
    resolvedProtection as PageProtection,
  );

  for (const [index, range] of rangesToScan.entries()) {
    try {
      results.push(...(await scanRange(range.base, range.size, pattern)));
    } catch {
      // Ignore unreadable ranges and continue scanning the rest.
    }

    emitEvent("scan/progress", {
      progress: Math.round(((index + 1) / rangesToScan.length) * 100),
      scanned: index + 1,
      total: rangesToScan.length,
    });
  }

  emitEvent("scan/result", { results });
  return results;
});

registerHandler("protectMemory", (params: unknown) => {
  const { address, size, protection } = params as {
    address: string;
    size: number;
    protection: string;
  };
  const success = Memory.protect(ptr(address), size, protection as PageProtection);
  return { success };
});

// --- Advanced Memory Features (Frida 17+) ---

registerHandler("patchMemory", (params: unknown) => {
  const { address, bytes } = params as { address: string; bytes: string };

  if (!bytes || bytes.length === 0) {
    throw new Error("Bytes must not be empty");
  }
  if (bytes.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }

  const target = ptr(address);
  const decoded = hexDecode(bytes);
  const size = decoded.length;

  if (size > 4096) {
    throw new Error("Patch size exceeds maximum of 4096 bytes");
  }

  try {
    // Use Memory.patchCode for executable memory regions
    const range = Process.findRangeByAddress(target);
    if (range && range.protection.includes("x")) {
      Memory.patchCode(target, size, (code) => {
        code.writeByteArray(Array.from(decoded));
      });
    } else {
      // For non-code regions, ensure writable, write, then restore
      const origProtection = range?.protection ?? "rw-";
      if (range && !range.protection.includes("w")) {
        Memory.protect(target, size, "rw-" as PageProtection);
      }
      target.writeByteArray(Array.from(decoded));
      if (range && !range.protection.includes("w")) {
        Memory.protect(target, size, origProtection as PageProtection);
      }
    }

    return { patched: true, address: target.toString(), size };
  } catch (e) {
    throw new Error(
      `Failed to patch memory at ${address}: ${e instanceof Error ? e.message : String(e)}`
    );
  }
});

registerHandler("queryMemoryProtection", (params: unknown) => {
  const { address } = params as { address: string };

  try {
    const protection = Memory.queryProtection(ptr(address));
    return { address, protection };
  } catch (e) {
    throw new Error(
      `Failed to query protection at ${address}: ${e instanceof Error ? e.message : String(e)}`
    );
  }
});

registerHandler("allocateMemory", (params: unknown) => {
  const { size, near, maxDistance } = params as {
    size: number;
    near?: string;
    maxDistance?: number;
  };

  if (size <= 0 || size > 64 * 1024 * 1024) {
    throw new Error(`Invalid allocation size: ${size} (max 64MB)`);
  }

  try {
    let allocated: NativePointer;

    if (near) {
      allocated = Memory.alloc(size, {
        near: ptr(near),
        maxDistance: maxDistance ?? 0x7fffffff,
      });
    } else {
      allocated = Memory.alloc(size);
    }

    return { address: allocated.toString(), size };
  } catch (e) {
    throw new Error(
      `Failed to allocate memory: ${e instanceof Error ? e.message : String(e)}`
    );
  }
});

registerHandler("dumpMemoryRange", (params: unknown) => {
  const { address, size } = params as { address: string; size: number };

  if (size <= 0 || size > 1024 * 1024) {
    throw new Error(`Invalid dump size: ${size} (max 1MB)`);
  }

  try {
    const target = ptr(address);
    const buf = readByteArray(target, size);
    if (!buf) throw new Error("Failed to read memory");

    const hexDump = hexdump(target, { length: size, header: true, ansi: false });
    const rawHex = hexEncode(buf);

    return { hexDump, rawHex, address, size };
  } catch (e) {
    throw new Error(
      `Failed to dump memory at ${address}: ${e instanceof Error ? e.message : String(e)}`
    );
  }
});

registerHandler("compareMemory", (params: unknown) => {
  const { address1, address2, size } = params as {
    address1: string;
    address2: string;
    size: number;
  };

  if (size <= 0 || size > 64 * 1024 * 1024) {
    throw new Error(`Invalid comparison size: ${size} (max 64MB)`);
  }

  try {
    const buf1 = readByteArray(ptr(address1), size);
    const buf2 = readByteArray(ptr(address2), size);
    if (!buf1 || !buf2) throw new Error("Failed to read one or both memory regions");

    const bytes1 = new Uint8Array(buf1);
    const bytes2 = new Uint8Array(buf2);

    const differences: Array<{
      offset: number;
      address1Value: number;
      address2Value: number;
    }> = [];

    for (let i = 0; i < size; i++) {
      if (bytes1[i] !== bytes2[i]) {
        differences.push({
          offset: i,
          address1Value: bytes1[i],
          address2Value: bytes2[i],
        });
      }
    }

    return {
      identical: differences.length === 0,
      totalBytes: size,
      differenceCount: differences.length,
      differences: differences.slice(0, 1000), // Cap at 1000 diffs
    };
  } catch (e) {
    throw new Error(
      `Failed to compare memory: ${e instanceof Error ? e.message : String(e)}`
    );
  }
});

registerHandler("enumerateMallocRanges", (_params: unknown) => {
  try {
    const ranges = Process.enumerateMallocRanges();
    return ranges.map((r) => ({
      base: r.base.toString(),
      size: r.size,
      protection: r.protection,
    }));
  } catch (e) {
    throw new Error(
      `Failed to enumerate malloc ranges: ${e instanceof Error ? e.message : String(e)}`
    );
  }
});
