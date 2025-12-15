import type { MethodHandler } from "../../rpc/types";

// Enumerate all loaded modules
export const enumerateModules: MethodHandler = () => {
  try {
    const modules = Process.enumerateModules();
    return modules.map((m) => ({
      name: m.name,
      base: m.base.toString(),
      size: m.size,
      path: m.path,
    }));
  } catch (e) {
    throw new Error(`Failed to enumerate modules: ${e}`);
  }
};

// Enumerate exports of a module
export const enumerateExports: MethodHandler = ({ params }) => {
  const { module: moduleName } = (params || {}) as { module?: string };

  if (!moduleName) {
    throw new Error("module parameter is required");
  }

  try {
    const mod = Process.findModuleByName(moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    const exports = mod.enumerateExports();
    return exports.map((exp) => ({
      name: exp.name,
      type: exp.type,
      address: exp.address.toString(),
    }));
  } catch (e) {
    throw new Error(`Failed to enumerate exports: ${e}`);
  }
};

// Enumerate imports of a module
export const enumerateImports: MethodHandler = ({ params }) => {
  const { module: moduleName } = (params || {}) as { module?: string };

  if (!moduleName) {
    throw new Error("module parameter is required");
  }

  try {
    const mod = Process.findModuleByName(moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    const imports = mod.enumerateImports();
    return imports.map((imp) => ({
      name: imp.name,
      type: imp.type,
      module: imp.module,
      address: imp.address?.toString() || null,
    }));
  } catch (e) {
    throw new Error(`Failed to enumerate imports: ${e}`);
  }
};

// Enumerate symbols of a module
export const enumerateSymbols: MethodHandler = ({ params }) => {
  const { module: moduleName } = (params || {}) as { module?: string };

  if (!moduleName) {
    throw new Error("module parameter is required");
  }

  try {
    const mod = Process.findModuleByName(moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    const symbols = mod.enumerateSymbols();
    return symbols.slice(0, 1000).map((sym) => ({
      name: sym.name,
      type: sym.type,
      address: sym.address.toString(),
      isGlobal: sym.isGlobal,
    }));
  } catch (e) {
    throw new Error(`Failed to enumerate symbols: ${e}`);
  }
};

// Find module by address
export const findModuleByAddress: MethodHandler = ({ params }) => {
  const { address } = (params || {}) as { address?: string };

  if (!address) {
    throw new Error("address parameter is required");
  }

  try {
    const ptr = new NativePointer(address);
    const mod = Process.findModuleByAddress(ptr);
    
    if (!mod) {
      return null;
    }

    return {
      name: mod.name,
      base: mod.base.toString(),
      size: mod.size,
      path: mod.path,
    };
  } catch (e) {
    throw new Error(`Failed to find module: ${e}`);
  }
};

// Enumerate sections of a module
export const enumerateSections: MethodHandler = ({ params }) => {
  const { module: moduleName } = (params || {}) as { module?: string };

  if (!moduleName) {
    throw new Error("module parameter is required");
  }

  try {
    const mod = Process.findModuleByName(moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    const sections = mod.enumerateSections();
    return sections.map((sec) => ({
      id: sec.id,
      name: sec.name,
      address: sec.address.toString(),
      size: sec.size,
    }));
  } catch (e) {
    throw new Error(`Failed to enumerate sections: ${e}`);
  }
};

// Enumerate dependencies of a module
export const enumerateDependencies: MethodHandler = ({ params }) => {
  const { module: moduleName } = (params || {}) as { module?: string };

  if (!moduleName) {
    throw new Error("module parameter is required");
  }

  try {
    const mod = Process.findModuleByName(moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    const deps = mod.enumerateDependencies();
    return deps.map((dep) => ({
      name: dep.name,
      type: dep.type,
    }));
  } catch (e) {
    throw new Error(`Failed to enumerate dependencies: ${e}`);
  }
};

// Enumerate ranges of a module
export const enumerateModuleRanges: MethodHandler = ({ params }) => {
  const { module: moduleName, protection } = (params || {}) as {
    module?: string;
    protection?: string;
  };

  if (!moduleName) {
    throw new Error("module parameter is required");
  }

  try {
    const mod = Process.findModuleByName(moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    const prot = protection || "r--";
    const ranges = mod.enumerateRanges(prot);
    return ranges.map((r) => ({
      base: r.base.toString(),
      size: r.size,
      protection: r.protection,
    }));
  } catch (e) {
    throw new Error(`Failed to enumerate module ranges: ${e}`);
  }
};

// Find symbol by name in a module
export const findSymbolByName: MethodHandler = ({ params }) => {
  const { module: moduleName, name } = (params || {}) as {
    module?: string;
    name?: string;
  };

  if (!moduleName) {
    throw new Error("module parameter is required");
  }
  if (!name) {
    throw new Error("name parameter is required");
  }

  try {
    const mod = Process.findModuleByName(moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    const addr = mod.findSymbolByName(name);
    return { address: addr ? addr.toString() : null };
  } catch (e) {
    throw new Error(`Failed to find symbol: ${e}`);
  }
};

// Load a module by path
export const loadModule: MethodHandler = ({ params }) => {
  const { path } = (params || {}) as { path?: string };

  if (!path) {
    throw new Error("path parameter is required");
  }

  try {
    const mod = Module.load(path);
    return {
      name: mod.name,
      base: mod.base.toString(),
      size: mod.size,
      path: mod.path,
    };
  } catch (e) {
    throw new Error(`Failed to load module: ${e}`);
  }
};

// Find global export by name
export const findGlobalExportByName: MethodHandler = ({ params }) => {
  const { name } = (params || {}) as { name?: string };

  if (!name) {
    throw new Error("name parameter is required");
  }

  try {
    const addr = Module.findGlobalExportByName(name);
    return { address: addr ? addr.toString() : null };
  } catch (e) {
    throw new Error(`Failed to find global export: ${e}`);
  }
};
