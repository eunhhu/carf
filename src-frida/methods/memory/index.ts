import type { MethodHandler } from "../../rpc/types";

// Read memory at address
export const readMemory: MethodHandler = ({ params }) => {
  const { address, size } = (params || {}) as { address?: string; size?: number };

  if (!address) {
    throw new Error("address parameter is required");
  }

  const readSize = Math.min(size || 256, 4096);
  const targetPtr = new NativePointer(address);

  try {
    const bytes = targetPtr.readByteArray(readSize);
    if (!bytes) {
      throw new Error("Failed to read memory - null result");
    }

    const arr = new Uint8Array(bytes);
    const lines: string[] = [];

    for (let i = 0; i < arr.length; i += 16) {
      const chunk = arr.slice(i, Math.min(i + 16, arr.length));
      const hexPart = Array.from(chunk)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      const asciiPart = Array.from(chunk)
        .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."))
        .join("");

      const offset = targetPtr.add(i).toString();
      lines.push(`${offset}  ${hexPart.padEnd(48)}  ${asciiPart}`);
    }

    return {
      address: targetPtr.toString(),
      size: arr.length,
      hex: lines.join("\n"),
      bytes: Array.from(arr),
    };
  } catch (e) {
    throw new Error(`Failed to read memory at ${address}: ${e}`);
  }
};

// Write memory at address
export const writeMemory: MethodHandler = ({ params }) => {
  const { address, bytes } = (params || {}) as { address?: string; bytes?: string | number[] };

  if (!address) {
    throw new Error("address parameter is required");
  }

  if (!bytes) {
    throw new Error("bytes parameter is required");
  }

  const targetPtr = new NativePointer(address);
  let byteArray: number[];

  if (typeof bytes === "string") {
    const cleaned = bytes.replace(/\s+/g, "");
    if (!/^[0-9a-fA-F]+$/.test(cleaned) || cleaned.length % 2 !== 0) {
      throw new Error("Invalid hex string format");
    }
    byteArray = [];
    for (let i = 0; i < cleaned.length; i += 2) {
      byteArray.push(parseInt(cleaned.slice(i, i + 2), 16));
    }
  } else {
    byteArray = bytes;
  }

  if (byteArray.length === 0) {
    throw new Error("No bytes to write");
  }

  if (byteArray.length > 4096) {
    throw new Error("Cannot write more than 4KB at once");
  }

  try {
    Memory.protect(targetPtr, byteArray.length, "rwx");
    targetPtr.writeByteArray(byteArray);

    return {
      address: targetPtr.toString(),
      bytesWritten: byteArray.length,
    };
  } catch (e) {
    throw new Error(`Failed to write memory at ${address}: ${e}`);
  }
};

// Search memory for pattern
export const searchMemory: MethodHandler = async ({ params }) => {
  const { pattern, limit = 100 } = (params || {}) as { pattern?: string; limit?: number };

  if (!pattern) {
    throw new Error("pattern parameter is required");
  }

  const results: string[] = [];

  try {
    const ranges = Process.enumerateRanges("r--");

    for (const range of ranges) {
      if (results.length >= limit) break;

      try {
        const matches = Memory.scanSync(range.base, range.size, pattern);
        for (const match of matches) {
          if (results.length >= limit) break;
          results.push(match.address.toString());
        }
      } catch {
        // Skip unreadable ranges
      }
    }

    return { pattern, results, count: results.length };
  } catch (e) {
    throw new Error(`Failed to search memory: ${e}`);
  }
};

// Enumerate memory ranges
export const enumerateRanges: MethodHandler = ({ params }) => {
  const { protection = "r--" } = (params || {}) as { protection?: string };

  try {
    const ranges = Process.enumerateRanges(protection);
    return ranges.slice(0, 500).map((r) => ({
      base: r.base.toString(),
      size: r.size,
      protection: r.protection,
      file: r.file ? { path: r.file.path, offset: r.file.offset } : null,
    }));
  } catch (e) {
    throw new Error(`Failed to enumerate ranges: ${e}`);
  }
};

// Allocate memory
export const allocateMemory: MethodHandler = ({ params }) => {
  const { size } = (params || {}) as { size?: number };

  if (!size || size <= 0) {
    throw new Error("size parameter is required and must be positive");
  }

  if (size > 1024 * 1024) {
    throw new Error("Cannot allocate more than 1MB");
  }

  try {
    const mem = Memory.alloc(size);
    return {
      address: mem.toString(),
      size,
    };
  } catch (e) {
    throw new Error(`Failed to allocate memory: ${e}`);
  }
};

// Async memory scan with streaming results
let scanAbortController: { abort: boolean } | null = null;

export const memoryScanAsync: MethodHandler = async ({ params }) => {
  const { pattern, protection = "r--", limit = 500 } = (params || {}) as {
    pattern?: string;
    protection?: string;
    limit?: number;
  };

  if (!pattern) {
    throw new Error("pattern parameter is required");
  }

  // Import emitEvent for streaming
  const { emitEvent } = await import("../../rpc/reply");

  // Create abort controller
  scanAbortController = { abort: false };
  const controller = scanAbortController;

  let totalMatches = 0;
  let scannedRanges = 0;

  try {
    const ranges = Process.enumerateRanges(protection);
    const totalRanges = ranges.length;

    emitEvent("memory_scan_started", { pattern, totalRanges });

    for (const range of ranges) {
      if (controller.abort || totalMatches >= limit) break;

      scannedRanges++;

      try {
        Memory.scan(range.base, range.size, pattern, {
          onMatch(address, size) {
            if (controller.abort || totalMatches >= limit) return "stop";
            totalMatches++;
            emitEvent("memory_scan_match", {
              address: address.toString(),
              size,
              matchIndex: totalMatches,
            });
            if (totalMatches >= limit) return "stop";
          },
          onError(reason) {
            // Skip errors silently
          },
          onComplete() {
            // Range complete
          },
        });
      } catch {
        // Skip unreadable ranges
      }

      // Emit progress every 10 ranges
      if (scannedRanges % 10 === 0) {
        emitEvent("memory_scan_progress", {
          scannedRanges,
          totalRanges,
          matchCount: totalMatches,
          progress: Math.round((scannedRanges / totalRanges) * 100),
        });
      }
    }

    emitEvent("memory_scan_complete", {
      pattern,
      totalMatches,
      scannedRanges,
      aborted: controller.abort,
    });

    return { status: "complete", totalMatches, scannedRanges };
  } catch (e) {
    throw new Error(`Failed to scan memory: ${e}`);
  } finally {
    scanAbortController = null;
  }
};

// Abort ongoing memory scan
export const memoryScanAbort: MethodHandler = () => {
  if (scanAbortController) {
    scanAbortController.abort = true;
    return { status: "aborted" };
  }
  return { status: "no_scan_running" };
};

// Memory access monitor state
let memoryAccessMonitorEnabled = false;

// Enable memory access monitor
export const memoryAccessMonitorEnable: MethodHandler = async ({ params }) => {
  const { ranges } = (params || {}) as {
    ranges?: { base: string; size: number }[];
  };

  if (!ranges || ranges.length === 0) {
    throw new Error("ranges parameter is required");
  }

  if (memoryAccessMonitorEnabled) {
    return { status: "already_enabled" };
  }

  // Import emitEvent for streaming
  const { emitEvent } = await import("../../rpc/reply");

  try {
    const monitorRanges = ranges.map((r) => ({
      base: new NativePointer(r.base),
      size: r.size,
    }));

    MemoryAccessMonitor.enable(monitorRanges, {
      onAccess(details) {
        emitEvent("memory_access", {
          operation: details.operation,
          from: details.from.toString(),
          address: details.address.toString(),
          rangeIndex: details.rangeIndex,
          pageIndex: details.pageIndex,
          pagesCompleted: details.pagesCompleted,
          pagesTotal: details.pagesTotal,
        });
      },
    });

    memoryAccessMonitorEnabled = true;
    return { status: "enabled", rangeCount: ranges.length };
  } catch (e) {
    throw new Error(`Failed to enable memory access monitor: ${e}`);
  }
};

// Disable memory access monitor
export const memoryAccessMonitorDisable: MethodHandler = () => {
  if (!memoryAccessMonitorEnabled) {
    return { status: "not_enabled" };
  }

  try {
    MemoryAccessMonitor.disable();
    memoryAccessMonitorEnabled = false;
    return { status: "disabled" };
  } catch (e) {
    throw new Error(`Failed to disable memory access monitor: ${e}`);
  }
};

export {
  memoryValueScanStart,
  memoryValueScanAbort,
  memoryValueScanGet,
  memoryValueScanNext,
  memoryValueScanClear,
} from "./valueScan";

export { memoryWatchAdd, memoryWatchRemove, memoryWatchList, memoryWatchClear } from "./watch";
