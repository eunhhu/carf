import { registerHandler } from "../rpc/router";

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

registerHandler("readMemory", (params: unknown) => {
  const { address, size } = params as { address: string; size: number };
  if (size <= 0 || size > 64 * 1024 * 1024) {
    throw new Error(`Invalid size: ${size} (max 64MB)`);
  }
  const buf = Memory.readByteArray(ptr(address), size);
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
  Memory.writeByteArray(ptr(address), decoded as unknown as number[]);
  return { written: decoded.length };
});

registerHandler("scanMemory", (params: unknown) => {
  const { address, size, pattern, protection = "r--" } = params as {
    address?: string;
    size?: number;
    pattern: string;
    protection?: string;
  };

  const results: { address: string; size: number }[] = [];

  if (address && typeof size === "number") {
    Memory.scanSync(ptr(address), size, pattern).forEach((match) => {
      results.push({
        address: match.address.toString(),
        size: match.size,
      });
    });
    return results;
  }

  for (const range of Process.enumerateRanges(protection as PageProtection)) {
    try {
      Memory.scanSync(range.base, range.size, pattern).forEach((match) => {
        results.push({
          address: match.address.toString(),
          size: match.size,
        });
      });
    } catch {
      // Ignore unreadable ranges and continue scanning the rest.
    }
  }

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
