import type { MethodHandler } from "../../rpc/types";

// Memory protection constants
const PROT_READ = "r";
const PROT_WRITE = "w";
const PROT_EXEC = "x";

// Change memory protection
export const memoryProtect: MethodHandler = ({ params }) => {
  const { address, size, protection } = (params || {}) as {
    address?: string;
    size?: number;
    protection?: string;
  };

  if (!address || !size || !protection) {
    throw new Error("address, size, and protection are required");
  }

  try {
    const ptr = new NativePointer(address);
    const success = Memory.protect(ptr, size, protection);
    return { success, address: ptr.toString(), size, protection };
  } catch (e) {
    throw new Error(`Failed to protect memory: ${e}`);
  }
};

// Query memory protection
export const memoryQueryProtection: MethodHandler = ({ params }) => {
  const { address } = (params || {}) as { address?: string };

  if (!address) {
    throw new Error("address parameter is required");
  }

  try {
    const ptr = new NativePointer(address);
    const range = Process.findRangeByAddress(ptr);
    
    if (!range) {
      return null;
    }

    return {
      base: range.base.toString(),
      size: range.size,
      protection: range.protection,
      file: range.file ? { path: range.file.path, offset: range.file.offset } : null,
    };
  } catch (e) {
    throw new Error(`Failed to query protection: ${e}`);
  }
};

// Allocate memory with specific protection
export const memoryAllocProtected: MethodHandler = ({ params }) => {
  const { size, protection = "rw-" } = (params || {}) as {
    size?: number;
    protection?: string;
  };

  if (!size || size <= 0) {
    throw new Error("size must be positive");
  }

  if (size > 1024 * 1024 * 10) {
    throw new Error("Cannot allocate more than 10MB");
  }

  try {
    const mem = Memory.alloc(size);
    Memory.protect(mem, size, protection);
    return { address: mem.toString(), size, protection };
  } catch (e) {
    throw new Error(`Failed to allocate memory: ${e}`);
  }
};

// Allocate UTF-8 string
export const memoryAllocUtf8String: MethodHandler = ({ params }) => {
  const { text } = (params || {}) as { text?: string };

  if (!text) {
    throw new Error("text parameter is required");
  }

  try {
    const mem = Memory.allocUtf8String(text);
    return { address: mem.toString(), length: text.length };
  } catch (e) {
    throw new Error(`Failed to allocate string: ${e}`);
  }
};

// Allocate UTF-16 string
export const memoryAllocUtf16String: MethodHandler = ({ params }) => {
  const { text } = (params || {}) as { text?: string };

  if (!text) {
    throw new Error("text parameter is required");
  }

  try {
    const mem = Memory.allocUtf16String(text);
    return { address: mem.toString(), length: text.length };
  } catch (e) {
    throw new Error(`Failed to allocate string: ${e}`);
  }
};

// Allocate ANSI string (Windows)
export const memoryAllocAnsiString: MethodHandler = ({ params }) => {
  const { text } = (params || {}) as { text?: string };

  if (!text) {
    throw new Error("text parameter is required");
  }

  try {
    const mem = Memory.allocAnsiString(text);
    return { address: mem.toString(), length: text.length };
  } catch (e) {
    throw new Error(`Failed to allocate string: ${e}`);
  }
};

// Copy memory
export const memoryCopy: MethodHandler = ({ params }) => {
  const { dest, src, size } = (params || {}) as {
    dest?: string;
    src?: string;
    size?: number;
  };

  if (!dest || !src || !size) {
    throw new Error("dest, src, and size are required");
  }

  if (size > 1024 * 1024) {
    throw new Error("Cannot copy more than 1MB at once");
  }

  try {
    const destPtr = new NativePointer(dest);
    const srcPtr = new NativePointer(src);
    Memory.copy(destPtr, srcPtr, size);
    return { success: true, dest: destPtr.toString(), src: srcPtr.toString(), size };
  } catch (e) {
    throw new Error(`Failed to copy memory: ${e}`);
  }
};

// Duplicate memory (allocate + copy)
export const memoryDup: MethodHandler = ({ params }) => {
  const { address, size } = (params || {}) as { address?: string; size?: number };

  if (!address || !size) {
    throw new Error("address and size are required");
  }

  if (size > 1024 * 1024) {
    throw new Error("Cannot duplicate more than 1MB");
  }

  try {
    const srcPtr = new NativePointer(address);
    const dupPtr = Memory.dup(srcPtr, size);
    return { address: dupPtr.toString(), size };
  } catch (e) {
    throw new Error(`Failed to duplicate memory: ${e}`);
  }
};

// Read pointer at address
export const readPointer: MethodHandler = ({ params }) => {
  const { address } = (params || {}) as { address?: string };

  if (!address) {
    throw new Error("address parameter is required");
  }

  try {
    const ptr = new NativePointer(address);
    const value = ptr.readPointer();
    return { address: ptr.toString(), value: value.toString() };
  } catch (e) {
    throw new Error(`Failed to read pointer: ${e}`);
  }
};

// Write pointer at address
export const writePointer: MethodHandler = ({ params }) => {
  const { address, value } = (params || {}) as { address?: string; value?: string };

  if (!address || !value) {
    throw new Error("address and value are required");
  }

  try {
    const ptr = new NativePointer(address);
    const valuePtr = new NativePointer(value);
    ptr.writePointer(valuePtr);
    return { success: true, address: ptr.toString(), value: valuePtr.toString() };
  } catch (e) {
    throw new Error(`Failed to write pointer: ${e}`);
  }
};

// Read various integer types
export const readInt: MethodHandler = ({ params }) => {
  const { address, type = "int32" } = (params || {}) as { address?: string; type?: string };

  if (!address) {
    throw new Error("address parameter is required");
  }

  try {
    const ptr = new NativePointer(address);
    let value: number | Int64 | UInt64;

    switch (type) {
      case "s8": value = ptr.readS8(); break;
      case "u8": value = ptr.readU8(); break;
      case "s16": value = ptr.readS16(); break;
      case "u16": value = ptr.readU16(); break;
      case "s32":
      case "int32": value = ptr.readS32(); break;
      case "u32":
      case "uint32": value = ptr.readU32(); break;
      case "s64":
      case "int64": value = ptr.readS64(); break;
      case "u64":
      case "uint64": value = ptr.readU64(); break;
      case "short": value = ptr.readShort(); break;
      case "ushort": value = ptr.readUShort(); break;
      case "int": value = ptr.readInt(); break;
      case "uint": value = ptr.readUInt(); break;
      case "long": value = ptr.readLong(); break;
      case "ulong": value = ptr.readULong(); break;
      case "float": value = ptr.readFloat(); break;
      case "double": value = ptr.readDouble(); break;
      default: throw new Error(`Unknown type: ${type}`);
    }

    return { address: ptr.toString(), type, value: value.toString() };
  } catch (e) {
    throw new Error(`Failed to read integer: ${e}`);
  }
};

// Write various integer types
export const writeInt: MethodHandler = ({ params }) => {
  const { address, value, type = "int32" } = (params || {}) as {
    address?: string;
    value?: number | string;
    type?: string;
  };

  if (!address || value === undefined) {
    throw new Error("address and value are required");
  }

  try {
    const ptr = new NativePointer(address);
    const numValue = typeof value === "string" ? parseInt(value, 10) : value;

    switch (type) {
      case "s8": ptr.writeS8(numValue); break;
      case "u8": ptr.writeU8(numValue); break;
      case "s16": ptr.writeS16(numValue); break;
      case "u16": ptr.writeU16(numValue); break;
      case "s32":
      case "int32": ptr.writeS32(numValue); break;
      case "u32":
      case "uint32": ptr.writeU32(numValue); break;
      case "s64":
      case "int64": ptr.writeS64(int64(value.toString())); break;
      case "u64":
      case "uint64": ptr.writeU64(uint64(value.toString())); break;
      case "short": ptr.writeShort(numValue); break;
      case "ushort": ptr.writeUShort(numValue); break;
      case "int": ptr.writeInt(numValue); break;
      case "uint": ptr.writeUInt(numValue); break;
      case "long": ptr.writeLong(numValue); break;
      case "ulong": ptr.writeULong(numValue); break;
      case "float": ptr.writeFloat(numValue); break;
      case "double": ptr.writeDouble(numValue); break;
      default: throw new Error(`Unknown type: ${type}`);
    }

    return { success: true, address: ptr.toString(), type, value: value.toString() };
  } catch (e) {
    throw new Error(`Failed to write integer: ${e}`);
  }
};

// Read string
export const readString: MethodHandler = ({ params }) => {
  const { address, encoding = "utf8", length } = (params || {}) as {
    address?: string;
    encoding?: string;
    length?: number;
  };

  if (!address) {
    throw new Error("address parameter is required");
  }

  try {
    const ptr = new NativePointer(address);
    let value: string | null;

    switch (encoding) {
      case "utf8": value = ptr.readUtf8String(length); break;
      case "utf16": value = ptr.readUtf16String(length); break;
      case "ansi": value = ptr.readAnsiString(length); break;
      case "cstring": value = ptr.readCString(length); break;
      default: throw new Error(`Unknown encoding: ${encoding}`);
    }

    return { address: ptr.toString(), encoding, value };
  } catch (e) {
    throw new Error(`Failed to read string: ${e}`);
  }
};

// Write string
export const writeString: MethodHandler = ({ params }) => {
  const { address, value, encoding = "utf8" } = (params || {}) as {
    address?: string;
    value?: string;
    encoding?: string;
  };

  if (!address || !value) {
    throw new Error("address and value are required");
  }

  try {
    const ptr = new NativePointer(address);

    switch (encoding) {
      case "utf8": ptr.writeUtf8String(value); break;
      case "utf16": ptr.writeUtf16String(value); break;
      case "ansi": ptr.writeAnsiString(value); break;
      default: throw new Error(`Unknown encoding: ${encoding}`);
    }

    return { success: true, address: ptr.toString(), encoding, length: value.length };
  } catch (e) {
    throw new Error(`Failed to write string: ${e}`);
  }
};

// Scan memory with pattern
export const memoryScanSync: MethodHandler = ({ params }) => {
  const { address, size, pattern, limit = 100 } = (params || {}) as {
    address?: string;
    size?: number;
    pattern?: string;
    limit?: number;
  };

  if (!address || !size || !pattern) {
    throw new Error("address, size, and pattern are required");
  }

  try {
    const ptr = new NativePointer(address);
    const matches = Memory.scanSync(ptr, size, pattern);
    
    return matches.slice(0, limit).map((m) => ({
      address: m.address.toString(),
      size: m.size,
    }));
  } catch (e) {
    throw new Error(`Failed to scan memory: ${e}`);
  }
};

// Patch code
export const memoryPatchCode: MethodHandler = ({ params }) => {
  const { address, bytes } = (params || {}) as { address?: string; bytes?: number[] };

  if (!address || !bytes || bytes.length === 0) {
    throw new Error("address and bytes are required");
  }

  if (bytes.length > 1024) {
    throw new Error("Cannot patch more than 1KB at once");
  }

  try {
    const ptr = new NativePointer(address);
    
    Memory.patchCode(ptr, bytes.length, (code) => {
      for (let i = 0; i < bytes.length; i++) {
        code.add(i).writeU8(bytes[i]);
      }
    });

    return { success: true, address: ptr.toString(), size: bytes.length };
  } catch (e) {
    throw new Error(`Failed to patch code: ${e}`);
  }
};
