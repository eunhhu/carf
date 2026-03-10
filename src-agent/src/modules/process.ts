import { registerHandler } from "../rpc/router";

registerHandler("ping", (_params: unknown) => {
  return "pong";
});

registerHandler("getProcessInfo", (_params: unknown) => {
  return {
    pid: Process.id,
    arch: Process.arch,
    platform: Process.platform,
    pageSize: Process.pageSize,
    pointerSize: Process.pointerSize,
    codeSigningPolicy: Process.codeSigningPolicy,
    isDebuggerAttached: Process.isDebuggerAttached(),
    mainModule: Process.mainModule
      ? {
          name: Process.mainModule.name,
          base: Process.mainModule.base.toString(),
          size: Process.mainModule.size,
          path: Process.mainModule.path,
        }
      : null,
  };
});

registerHandler("enumerateModules", (_params: unknown) => {
  return Process.enumerateModules().map((mod) => ({
    name: mod.name,
    base: mod.base.toString(),
    size: mod.size,
    path: mod.path,
  }));
});

registerHandler("enumerateRanges", (params: unknown) => {
  const p = (params as { protection?: string }) ?? {};
  const protection = p.protection ?? "---";
  return Process.enumerateRanges(protection as PageProtection).map((range) => ({
    base: range.base.toString(),
    size: range.size,
    protection: range.protection,
    file: range.file
      ? { path: range.file.path, offset: range.file.offset, size: range.file.size }
      : undefined,
  }));
});
