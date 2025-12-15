import type { MethodHandler } from "../rpc/types";

type Params = {
  module: string;
};

// Enumerate exports of a specific module
export const enumerateExports: MethodHandler = ({ params }) => {
  const { module: moduleName } = params as Params;
  
  if (!moduleName) {
    throw new Error("module parameter is required");
  }

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
};
