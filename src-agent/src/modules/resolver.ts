import { registerHandler } from "../rpc/router";
import { findExportByName } from "../runtime/frida-compat";

interface ResolvedApi {
  name: string;
  address: string;
}

interface ResolvedSymbol {
  address: string;
  name: string | null;
  moduleName: string | null;
  fileName: string | null;
  lineNumber: number | null;
}

registerHandler("resolveApi", (params: unknown) => {
  const { query, type = "module" } = params as {
    query: string;
    type?: "module" | "objc" | "swift";
  };

  if (!query || query.length === 0) {
    throw new Error("Query string is required");
  }

  const resolver = new ApiResolver(type as ApiResolverType);
  const matches = resolver.enumerateMatches(query);

  const results: ResolvedApi[] = matches.map((m) => ({
    name: m.name,
    address: m.address.toString(),
  }));

  return results;
});

registerHandler("resolveSymbol", (params: unknown) => {
  const { address } = params as { address: string };

  if (!address) {
    throw new Error("Address is required");
  }

  const symbol = DebugSymbol.fromAddress(ptr(address));

  const result: ResolvedSymbol = {
    address: symbol.address.toString(),
    name: symbol.name,
    moduleName: symbol.moduleName,
    fileName: symbol.fileName,
    lineNumber: symbol.lineNumber,
  };

  return result;
});

registerHandler("findSymbolByName", (params: unknown) => {
  const { name } = params as { name: string };

  if (!name || name.length === 0) {
    throw new Error("Symbol name is required");
  }

  // If contains wildcard characters, use glob matching; otherwise exact lookup
  const addresses =
    name.includes("*") || name.includes("?")
      ? DebugSymbol.findFunctionsMatching(name)
      : DebugSymbol.findFunctionsNamed(name);

  return addresses.map((addr) => {
    const sym = DebugSymbol.fromAddress(addr);
    return {
      address: addr.toString(),
      name: sym.name,
      moduleName: sym.moduleName,
    };
  });
});

registerHandler("resolveModuleExport", (params: unknown) => {
  const { module: moduleName, name } = params as {
    module: string;
    name: string;
  };

  if (!moduleName || !name) {
    throw new Error("Module name and export name are required");
  }

  const addr = findExportByName(moduleName, name);
  if (!addr || addr.isNull()) {
    throw new Error(`Export '${name}' not found in module '${moduleName}'`);
  }

  const sym = DebugSymbol.fromAddress(addr);
  return {
    address: addr.toString(),
    name: sym.name ?? name,
    moduleName: sym.moduleName ?? moduleName,
  };
});

registerHandler("getGlobalExport", (params: unknown) => {
  const { name } = params as { name: string };

  if (!name || name.length === 0) {
    throw new Error("Export name is required");
  }

  const addr = Module.findGlobalExportByName(name);
  if (!addr || addr.isNull()) {
    throw new Error(`Global export not found: ${name}`);
  }

  const sym = DebugSymbol.fromAddress(addr);
  return {
    address: addr.toString(),
    name: sym.name ?? name,
    moduleName: sym.moduleName,
  };
});
