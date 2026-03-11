import { registerHandler } from "../rpc/router";

registerHandler("getModuleExports", (params: unknown) => {
  const { name, moduleName } = params as { name?: string; moduleName?: string };
  const resolvedName = moduleName ?? name;
  if (!resolvedName) throw new Error("Module name is required");
  const mod = Process.findModuleByName(resolvedName);
  if (!mod) throw new Error(`Module not found: ${resolvedName}`);
  return mod.enumerateExports().map((exp) => ({
    type: exp.type,
    name: exp.name,
    address: exp.address.toString(),
  }));
});

registerHandler("getModuleImports", (params: unknown) => {
  const { name, moduleName } = params as { name?: string; moduleName?: string };
  const resolvedName = moduleName ?? name;
  if (!resolvedName) throw new Error("Module name is required");
  const mod = Process.findModuleByName(resolvedName);
  if (!mod) throw new Error(`Module not found: ${resolvedName}`);
  return mod.enumerateImports().map((imp) => ({
    type: imp.type,
    name: imp.name,
    module: imp.module,
    address: imp.address ? imp.address.toString() : null,
  }));
});

registerHandler("getModuleSymbols", (params: unknown) => {
  const { name, moduleName } = params as { name?: string; moduleName?: string };
  const resolvedName = moduleName ?? name;
  if (!resolvedName) throw new Error("Module name is required");
  const mod = Process.findModuleByName(resolvedName);
  if (!mod) throw new Error(`Module not found: ${resolvedName}`);
  return mod.enumerateSymbols().map((sym) => ({
    isGlobal: sym.isGlobal,
    type: sym.type,
    section: sym.section,
    name: sym.name,
    address: sym.address.toString(),
    size: sym.size,
  }));
});

registerHandler("findModuleByAddress", (params: unknown) => {
  const { address } = params as { address: string };
  const mod = Process.findModuleByAddress(ptr(address));
  if (!mod) return null;
  return {
    name: mod.name,
    base: mod.base.toString(),
    size: mod.size,
    path: mod.path,
  };
});

registerHandler("findModuleByName", (params: unknown) => {
  const { name } = params as { name: string };
  const mod = Process.findModuleByName(name);
  if (!mod) return null;
  return {
    name: mod.name,
    base: mod.base.toString(),
    size: mod.size,
    path: mod.path,
  };
});

// --- Module Observer (Frida 17+) ---

let moduleObserver: { detach(): void } | null = null;

registerHandler("startModuleObserver", (_params: unknown) => {
  if (moduleObserver) throw new Error("Module observer already active");

  moduleObserver = Process.attachModuleObserver({
    onAdded(module) {
      send({
        type: "carf://module/loaded",
        timestamp: Date.now(),
        data: {
          name: module.name,
          base: module.base.toString(),
          size: module.size,
          path: module.path,
        },
      });
    },
    onRemoved(module) {
      send({
        type: "carf://module/unloaded",
        timestamp: Date.now(),
        data: {
          name: module.name,
          base: module.base.toString(),
          size: module.size,
          path: module.path,
        },
      });
    },
  });

  return { started: true };
});

registerHandler("stopModuleObserver", (_params: unknown) => {
  if (!moduleObserver) throw new Error("No module observer is active");
  moduleObserver.detach();
  moduleObserver = null;
  return { stopped: true };
});

registerHandler("enumerateModuleSections", (params: unknown) => {
  const { moduleName } = params as { moduleName: string };
  const mod = Process.findModuleByName(moduleName);
  if (!mod) throw new Error(`Module not found: ${moduleName}`);

  try {
    const sections = mod.enumerateSections();

    return sections.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address.toString(),
      size: s.size,
    }));
  } catch (e) {
    throw new Error(
      `enumerateSections() not supported on this Frida version: ${e instanceof Error ? e.message : String(e)}`
    );
  }
});

registerHandler("getModuleVersion", (params: unknown) => {
  const { moduleName } = params as { moduleName: string };
  const mod = Process.findModuleByName(moduleName);
  if (!mod) throw new Error(`Module not found: ${moduleName}`);

  try {
    // getVersion() available since Frida 17.2.14
    const version = (mod as Module & { getVersion(): string | null }).getVersion();
    return version ?? null;
  } catch {
    return null;
  }
});

registerHandler("enumerateModuleDependencies", (params: unknown) => {
  const { moduleName } = params as { moduleName: string };
  const mod = Process.findModuleByName(moduleName);
  if (!mod) throw new Error(`Module not found: ${moduleName}`);

  try {
    const deps = mod.enumerateDependencies();
    return deps.map((d) => d.name);
  } catch (e) {
    throw new Error(
      `enumerateDependencies() not supported on this Frida version: ${e instanceof Error ? e.message : String(e)}`
    );
  }
});
