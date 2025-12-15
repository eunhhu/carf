import type { MethodHandler } from "../../rpc/types";

// Store for created native functions
const nativeFunctions: Map<string, NativeFunction<any, any>> = new Map();

type CreateFunctionParams = {
  address: string;
  returnType: string;
  argTypes: string[];
  abi?: string;
};

// Create a NativeFunction wrapper
export const createNativeFunction: MethodHandler = ({ params }) => {
  const { address, returnType, argTypes, abi } = (params || {}) as CreateFunctionParams;

  if (!address || !returnType || !argTypes) {
    throw new Error("address, returnType, and argTypes are required");
  }

  try {
    const ptr = new NativePointer(address);
    const id = `nf_${address}_${Date.now()}`;

    const fn = new NativeFunction(ptr, returnType as NativeFunctionReturnType, argTypes as NativeFunctionArgumentType[], abi as NativeABI | undefined);
    nativeFunctions.set(id, fn);

    return { id, address: ptr.toString() };
  } catch (e) {
    throw new Error(`Failed to create NativeFunction: ${e}`);
  }
};

// Call a NativeFunction
export const callNativeFunction: MethodHandler = ({ params }) => {
  const { id, args = [] } = (params || {}) as { id?: string; args?: (string | number)[] };

  if (!id) {
    throw new Error("id parameter is required");
  }

  const fn = nativeFunctions.get(id);
  if (!fn) {
    throw new Error(`NativeFunction '${id}' not found`);
  }

  try {
    // Convert string addresses to NativePointer
    const convertedArgs = args.map((arg) => {
      if (typeof arg === "string" && arg.startsWith("0x")) {
        return new NativePointer(arg);
      }
      return arg;
    });

    const result = fn(...convertedArgs);
    
    // Convert result to string if it's a pointer
    const resultStr = result instanceof NativePointer ? result.toString() : result;
    
    return { result: resultStr };
  } catch (e) {
    throw new Error(`Failed to call NativeFunction: ${e}`);
  }
};

// Delete a NativeFunction
export const deleteNativeFunction: MethodHandler = ({ params }) => {
  const { id } = (params || {}) as { id?: string };

  if (!id) {
    throw new Error("id parameter is required");
  }

  if (!nativeFunctions.has(id)) {
    throw new Error(`NativeFunction '${id}' not found`);
  }

  nativeFunctions.delete(id);
  return { success: true, id };
};

// List all NativeFunctions
export const listNativeFunctions: MethodHandler = () => {
  return Array.from(nativeFunctions.keys());
};

// Find export by name
export const findExportByName: MethodHandler = ({ params }) => {
  const { module, name } = (params || {}) as { module?: string | null; name?: string };

  if (!name) {
    throw new Error("name parameter is required");
  }

  try {
    const address = module ? Process.findModuleByName(module)?.findExportByName(name) : Module.findGlobalExportByName(name);
    if (!address) {
      return new Error(`Export '${name}' not found`);
    }
    return { name, address: address.toString() };
  } catch (e) {
    throw new Error(`Failed to find export: ${e}`);
  }
};

// Get export by name (throws if not found)
export const getExportByName: MethodHandler = ({ params }) => {
  const { module, name } = (params || {}) as { module?: string | null; name?: string };

  if (!name) {
    throw new Error("name parameter is required");
  }

  try {
    const address = module ? Process.findModuleByName(module)?.getExportByName(name) : Module.findGlobalExportByName(name);
    if (!address) {
      throw new Error(`Export '${name}' not found`);
    }
    return { name, address: address.toString() };
  } catch (e) {
    throw new Error(`Export '${name}' not found: ${e}`);
  }
};

// Resolve symbol address
export const resolveSymbol: MethodHandler = ({ params }) => {
  const { name, module } = (params || {}) as { name?: string; module?: string };

  if (!name) {
    throw new Error("name parameter is required");
  }

  try {
    let address: NativePointer | null = null;

    if (module) {
      const mod = Process.findModuleByName(module);
      if (mod) {
        address = mod.findExportByName(name);
      }
    } else {
      address = Module.findGlobalExportByName(name);
    }

    if (!address) {
      // Try DebugSymbol
      const sym = DebugSymbol.fromName(name);
      if (sym.address && !sym.address.isNull()) {
        address = sym.address;
      }
    }

    if (!address) {
      return null;
    }

    return {
      name,
      address: address.toString(),
      module: module || null,
    };
  } catch (e) {
    throw new Error(`Failed to resolve symbol: ${e}`);
  }
};

// Get debug symbol from address
export const getDebugSymbol: MethodHandler = ({ params }) => {
  const { address } = (params || {}) as { address?: string };

  if (!address) {
    throw new Error("address parameter is required");
  }

  try {
    const ptr = new NativePointer(address);
    const sym = DebugSymbol.fromAddress(ptr);

    return {
      address: sym.address.toString(),
      name: sym.name,
      moduleName: sym.moduleName,
      fileName: sym.fileName,
      lineNumber: sym.lineNumber,
    };
  } catch (e) {
    throw new Error(`Failed to get debug symbol: ${e}`);
  }
};

// Get function by address
export const getFunctionByAddress: MethodHandler = ({ params }) => {
  const { address } = (params || {}) as { address?: string };

  if (!address) {
    throw new Error("address parameter is required");
  }

  try {
    const ptr = new NativePointer(address);
    const sym = DebugSymbol.fromAddress(ptr);
    const mod = Process.findModuleByAddress(ptr);

    return {
      address: ptr.toString(),
      name: sym.name,
      moduleName: mod?.name || sym.moduleName,
      moduleBase: mod?.base.toString() || null,
      offset: mod ? ptr.sub(mod.base).toInt32() : null,
    };
  } catch (e) {
    throw new Error(`Failed to get function info: ${e}`);
  }
};

// Store for NativeCallbacks
const nativeCallbacks: Map<string, NativeCallback<any, any>> = new Map();

// Create a NativeCallback
export const createNativeCallback: MethodHandler = async ({ params }) => {
  const { returnType, argTypes, abi } = (params || {}) as {
    returnType?: string;
    argTypes?: string[];
    abi?: string;
  };

  if (!returnType || !argTypes) {
    throw new Error("returnType and argTypes are required");
  }

  try {
    const id = `nc_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Import emitEvent for callback invocation notification
    const { emitEvent } = await import("../../rpc/reply");

    const callback = new NativeCallback(
      (...args: unknown[]) => {
        // Emit event when callback is invoked
        emitEvent("native_callback_invoked", {
          id,
          args: args.map((a) => (a instanceof NativePointer ? a.toString() : a)),
        });
        // Return 0 for now - in real usage, this would need to be configurable
        return 0;
      },
      returnType as NativeCallbackReturnType,
      argTypes as NativeCallbackArgumentType[],
      abi as NativeABI | undefined
    );

    nativeCallbacks.set(id, callback);

    return {
      id,
      address: callback.toString(),
      returnType,
      argTypes,
    };
  } catch (e) {
    throw new Error(`Failed to create NativeCallback: ${e}`);
  }
};

// Delete a NativeCallback
export const deleteNativeCallback: MethodHandler = ({ params }) => {
  const { id } = (params || {}) as { id?: string };

  if (!id) {
    throw new Error("id parameter is required");
  }

  if (!nativeCallbacks.has(id)) {
    throw new Error(`NativeCallback '${id}' not found`);
  }

  nativeCallbacks.delete(id);
  return { success: true, id };
};

// List all NativeCallbacks
export const listNativeCallbacks: MethodHandler = () => {
  return Array.from(nativeCallbacks.entries()).map(([id, cb]) => ({
    id,
    address: cb.toString(),
  }));
};

// Store for SystemFunctions
const systemFunctions: Map<string, SystemFunction<any, any>> = new Map();

// Create a SystemFunction
export const createSystemFunction: MethodHandler = ({ params }) => {
  const { address, returnType, argTypes, abi } = (params || {}) as {
    address?: string;
    returnType?: string;
    argTypes?: string[];
    abi?: string;
  };

  if (!address || !returnType || !argTypes) {
    throw new Error("address, returnType, and argTypes are required");
  }

  try {
    const ptr = new NativePointer(address);
    const id = `sf_${address}_${Date.now()}`;

    const fn = new SystemFunction(
      ptr,
      returnType as NativeFunctionReturnType,
      argTypes as NativeFunctionArgumentType[],
      abi as NativeABI | undefined
    );
    systemFunctions.set(id, fn);

    return { id, address: ptr.toString() };
  } catch (e) {
    throw new Error(`Failed to create SystemFunction: ${e}`);
  }
};

// Call a SystemFunction
export const callSystemFunction: MethodHandler = ({ params }) => {
  const { id, args = [] } = (params || {}) as { id?: string; args?: (string | number)[] };

  if (!id) {
    throw new Error("id parameter is required");
  }

  const fn = systemFunctions.get(id);
  if (!fn) {
    throw new Error(`SystemFunction '${id}' not found`);
  }

  try {
    const convertedArgs = args.map((arg) => {
      if (typeof arg === "string" && arg.startsWith("0x")) {
        return new NativePointer(arg);
      }
      return arg;
    });

    const result = fn(...convertedArgs) as { value: unknown; errno?: number; lastError?: number };

    return {
      value: result.value instanceof NativePointer ? result.value.toString() : result.value,
      errno: result.errno ?? null,
      lastError: result.lastError ?? null,
    };
  } catch (e) {
    throw new Error(`Failed to call SystemFunction: ${e}`);
  }
};

// Delete a SystemFunction
export const deleteSystemFunction: MethodHandler = ({ params }) => {
  const { id } = (params || {}) as { id?: string };

  if (!id) {
    throw new Error("id parameter is required");
  }

  if (!systemFunctions.has(id)) {
    throw new Error(`SystemFunction '${id}' not found`);
  }

  systemFunctions.delete(id);
  return { success: true, id };
};

// List all SystemFunctions
export const listSystemFunctions: MethodHandler = () => {
  return Array.from(systemFunctions.keys());
};

// ApiResolver - enumerate matching exports/imports
export const apiResolverEnumerate: MethodHandler = ({ params }) => {
  const { type, query, limit = 100 } = (params || {}) as {
    type?: string;
    query?: string;
    limit?: number;
  };

  if (!type || !query) {
    throw new Error("type and query parameters are required");
  }

  try {
    const resolver = new ApiResolver(type as ApiResolverType);
    const matches = resolver.enumerateMatches(query);

    return matches.slice(0, limit).map((m) => ({
      name: m.name,
      address: m.address.toString(),
    }));
  } catch (e) {
    throw new Error(`Failed to enumerate API: ${e}`);
  }
};

// Get available ABI options for current platform
export const getAbiOptions: MethodHandler = () => {
  const arch = Process.arch;
  const platform = Process.platform;

  // Common ABIs based on architecture
  const abiOptions: string[] = ["default"];

  if (arch === "x64" || arch === "ia32") {
    if (platform === "windows") {
      abiOptions.push("win64", "stdcall", "thiscall", "fastcall");
    } else {
      abiOptions.push("sysv", "unix64");
    }
  } else if (arch === "arm" || arch === "arm64") {
    abiOptions.push("aapcs");
  }

  return {
    arch,
    platform,
    abiOptions,
  };
};

// Get available native types
export const getNativeTypes: MethodHandler = () => {
  return {
    returnTypes: [
      "void",
      "pointer",
      "int",
      "uint",
      "long",
      "ulong",
      "char",
      "uchar",
      "float",
      "double",
      "int8",
      "uint8",
      "int16",
      "uint16",
      "int32",
      "uint32",
      "int64",
      "uint64",
      "bool",
    ],
    argTypes: [
      "pointer",
      "int",
      "uint",
      "long",
      "ulong",
      "char",
      "uchar",
      "float",
      "double",
      "int8",
      "uint8",
      "int16",
      "uint16",
      "int32",
      "uint32",
      "int64",
      "uint64",
      "bool",
    ],
  };
};
