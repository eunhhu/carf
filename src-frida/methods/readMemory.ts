import type { MethodHandler } from "../rpc/types";

type Params = {
  address: string;
  size: number;
};

// Read memory at specified address
export const readMemory: MethodHandler = ({ params }) => {
  const { address, size } = params as Params;

  if (!address) {
    throw new Error("address parameter is required");
  }

  const readSize = Math.min(size || 256, 4096); // Cap at 4KB for safety
  const targetPtr = new NativePointer(address);

  try {
    const bytes = targetPtr.readByteArray(readSize);
    if (!bytes) {
      throw new Error("Failed to read memory");
    }

    // Convert to hex dump format
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
