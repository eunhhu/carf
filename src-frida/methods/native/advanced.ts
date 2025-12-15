import type { MethodHandler } from "../../rpc/types";

// Demangle C++ symbol name
export const demangleSymbol: MethodHandler = ({ params }) => {
  const { name } = (params || {}) as { name?: string };

  if (!name) {
    throw new Error("name parameter is required");
  }

  try {
    // Use DebugSymbol.getFunctionByName for demangling
    const demangled = DebugSymbol.fromName(name);
    
    return {
      original: name,
      demangled: demangled.name || name,
      address: demangled.address?.toString() || null,
      moduleName: demangled.moduleName || null,
    };
  } catch (e) {
    // Fallback: return original if demangling fails
    return {
      original: name,
      demangled: name,
      address: null,
      moduleName: null,
    };
  }
};

// Disassemble instructions at address
export const disassemble: MethodHandler = ({ params }) => {
  const { address, count = 10 } = (params || {}) as { address?: string; count?: number };

  if (!address) {
    throw new Error("address parameter is required");
  }

  const maxCount = Math.min(count, 100);

  try {
    const ptr = new NativePointer(address);
    const instructions: Array<{
      address: string;
      mnemonic: string;
      opStr: string;
      size: number;
      bytes: string;
    }> = [];

    let currentAddr = ptr;
    for (let i = 0; i < maxCount; i++) {
      try {
        const insn = Instruction.parse(currentAddr);
        
        // Read instruction bytes
        const bytes = currentAddr.readByteArray(insn.size);
        const bytesHex = bytes 
          ? Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join(' ')
          : '';

        instructions.push({
          address: currentAddr.toString(),
          mnemonic: insn.mnemonic,
          opStr: insn.opStr,
          size: insn.size,
          bytes: bytesHex,
        });

        currentAddr = insn.next;
      } catch {
        // Stop if we can't parse more instructions
        break;
      }
    }

    return {
      startAddress: ptr.toString(),
      count: instructions.length,
      instructions,
    };
  } catch (e) {
    throw new Error(`Failed to disassemble at ${address}: ${e}`);
  }
};

// Get detailed function info
export const getFunctionInfo: MethodHandler = ({ params }) => {
  const { address } = (params || {}) as { address?: string };

  if (!address) {
    throw new Error("address parameter is required");
  }

  try {
    const ptr = new NativePointer(address);
    const sym = DebugSymbol.fromAddress(ptr);
    const mod = Process.findModuleByAddress(ptr);
    const range = Process.findRangeByAddress(ptr);

    // Try to get first few instructions
    const instructions: Array<{ address: string; mnemonic: string; opStr: string }> = [];
    let currentAddr = ptr;
    for (let i = 0; i < 5; i++) {
      try {
        const insn = Instruction.parse(currentAddr);
        instructions.push({
          address: currentAddr.toString(),
          mnemonic: insn.mnemonic,
          opStr: insn.opStr,
        });
        currentAddr = insn.next;
      } catch {
        break;
      }
    }

    return {
      address: ptr.toString(),
      name: sym.name || null,
      moduleName: mod?.name || sym.moduleName || null,
      moduleBase: mod?.base.toString() || null,
      offset: mod ? ptr.sub(mod.base).toInt32() : null,
      fileName: sym.fileName || null,
      lineNumber: sym.lineNumber || null,
      protection: range?.protection || null,
      instructions,
    };
  } catch (e) {
    throw new Error(`Failed to get function info: ${e}`);
  }
};

// Call native function with arguments
export const callFunction: MethodHandler = ({ params }) => {
  const { address, returnType = "pointer", argTypes = [], args = [] } = (params || {}) as {
    address?: string;
    returnType?: string;
    argTypes?: string[];
    args?: (string | number)[];
  };

  if (!address) {
    throw new Error("address parameter is required");
  }

  try {
    const ptr = new NativePointer(address);
    
    // Create NativeFunction
    const fn = new NativeFunction(
      ptr,
      returnType as NativeFunctionReturnType,
      argTypes as NativeFunctionArgumentType[]
    );

    // Convert string addresses to NativePointer
    const convertedArgs = args.map((arg, i) => {
      if (typeof arg === "string" && arg.startsWith("0x")) {
        return new NativePointer(arg);
      }
      return arg;
    });

    // Call the function
    const result = fn(...convertedArgs);

    // Convert result to string representation
    let resultStr: string;
    if (result instanceof NativePointer) {
      resultStr = result.toString();
    } else if (typeof result === "object" && result !== null) {
      resultStr = JSON.stringify(result);
    } else {
      resultStr = String(result);
    }

    return {
      address: ptr.toString(),
      returnType,
      result: resultStr,
    };
  } catch (e) {
    throw new Error(`Failed to call function at ${address}: ${e}`);
  }
};

// Read C string at address
export const readCString: MethodHandler = ({ params }) => {
  const { address, maxLength = 256 } = (params || {}) as { address?: string; maxLength?: number };

  if (!address) {
    throw new Error("address parameter is required");
  }

  try {
    const ptr = new NativePointer(address);
    const str = ptr.readCString(Math.min(maxLength, 4096));
    return {
      address: ptr.toString(),
      value: str,
      length: str?.length || 0,
    };
  } catch (e) {
    throw new Error(`Failed to read C string: ${e}`);
  }
};

// Get module exports with demangled names
export const getModuleExportsDemangled: MethodHandler = ({ params }) => {
  const { module, limit = 500 } = (params || {}) as { module?: string; limit?: number };

  if (!module) {
    throw new Error("module parameter is required");
  }

  try {
    const mod = Process.findModuleByName(module);
    if (!mod) {
      throw new Error(`Module '${module}' not found`);
    }

    const exports = mod.enumerateExports();
    
    return exports.slice(0, limit).map((exp) => {
      // Try to demangle the name
      let demangled = exp.name;
      try {
        const sym = DebugSymbol.fromAddress(exp.address);
        if (sym.name && sym.name !== exp.name) {
          demangled = sym.name;
        }
      } catch {
        // Keep original name
      }

      return {
        name: exp.name,
        demangled,
        type: exp.type,
        address: exp.address.toString(),
      };
    });
  } catch (e) {
    throw new Error(`Failed to get exports: ${e}`);
  }
};

// Enumerate module sections
export const enumerateModuleSections: MethodHandler = ({ params }) => {
  const { module } = (params || {}) as { module?: string };

  if (!module) {
    throw new Error("module parameter is required");
  }

  try {
    const mod = Process.findModuleByName(module);
    if (!mod) {
      throw new Error(`Module '${module}' not found`);
    }

    // Get ranges that belong to this module
    const ranges = Process.enumerateRanges("r--").filter((r) => {
      return r.file?.path?.includes(module) || 
             (r.base.compare(mod.base) >= 0 && r.base.compare(mod.base.add(mod.size)) < 0);
    });

    return ranges.map((r) => ({
      base: r.base.toString(),
      size: r.size,
      protection: r.protection,
      file: r.file ? { path: r.file.path, offset: r.file.offset } : null,
    }));
  } catch (e) {
    throw new Error(`Failed to enumerate sections: ${e}`);
  }
};

// Find pattern in module
export const findPatternInModule: MethodHandler = ({ params }) => {
  const { module, pattern, limit = 50 } = (params || {}) as {
    module?: string;
    pattern?: string;
    limit?: number;
  };

  if (!module || !pattern) {
    throw new Error("module and pattern parameters are required");
  }

  try {
    const mod = Process.findModuleByName(module);
    if (!mod) {
      throw new Error(`Module '${module}' not found`);
    }

    const matches = Memory.scanSync(mod.base, mod.size, pattern);
    
    return {
      module,
      pattern,
      count: matches.length,
      matches: matches.slice(0, limit).map((m) => ({
        address: m.address.toString(),
        offset: m.address.sub(mod.base).toInt32(),
      })),
    };
  } catch (e) {
    throw new Error(`Failed to find pattern: ${e}`);
  }
};

// Get architecture info
export const getArchInfo: MethodHandler = () => {
  return {
    arch: Process.arch,
    platform: Process.platform,
    pageSize: Process.pageSize,
    pointerSize: Process.pointerSize,
    codeSigningPolicy: Process.codeSigningPolicy,
  };
};
