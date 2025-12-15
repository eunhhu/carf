import type { MethodHandler } from "../rpc/types";

type Params = {
  address: string;
  bytes: string | number[];
};

// Write memory at specified address
export const writeMemory: MethodHandler = ({ params }) => {
  const { address, bytes } = params as Params;

  if (!address) {
    throw new Error("address parameter is required");
  }

  if (!bytes) {
    throw new Error("bytes parameter is required");
  }

  const targetPtr = ptr(address);
  let byteArray: number[];

  if (typeof bytes === "string") {
    // Parse hex string like "90 90 90" or "909090"
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
    // Make memory writable temporarily
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
