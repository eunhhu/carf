import type { MethodHandler } from "../rpc/types";

// Enumerate all loaded modules in the process
export const enumerateModules: MethodHandler = () => {
  const modules = Process.enumerateModules();
  return modules.map((m) => ({
    name: m.name,
    base: m.base.toString(),
    size: m.size,
    path: m.path,
  }));
};
