import { registerHandler } from "../rpc/router";

registerHandler("getModuleExports", (params: unknown) => {
  const { name } = params as { name: string };
  const mod = Process.findModuleByName(name);
  if (!mod) throw new Error(`Module not found: ${name}`);
  return mod.enumerateExports().map((exp) => ({
    type: exp.type,
    name: exp.name,
    address: exp.address.toString(),
  }));
});

registerHandler("getModuleImports", (params: unknown) => {
  const { name } = params as { name: string };
  const mod = Process.findModuleByName(name);
  if (!mod) throw new Error(`Module not found: ${name}`);
  return mod.enumerateImports().map((imp) => ({
    type: imp.type,
    name: imp.name,
    module: imp.module,
    address: imp.address ? imp.address.toString() : null,
  }));
});

registerHandler("getModuleSymbols", (params: unknown) => {
  const { name } = params as { name: string };
  const mod = Process.findModuleByName(name);
  if (!mod) throw new Error(`Module not found: ${name}`);
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
