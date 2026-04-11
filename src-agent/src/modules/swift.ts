import { SwiftRuntime as Swift, ObjCRuntime as ObjC } from "../bridges";
import type { SwiftTypeDescriptor } from "../bridges";
import { registerHandler } from "../rpc/router";
import { emitHookEvent } from "../rpc/protocol";

interface SwiftHookEntry {
  hookId: string;
  target: string;
  address: string;
  listener: InvocationListener;
  active: boolean;
  hits: number;
}

const swiftHooks = new Map<string, SwiftHookEntry>();

function toHookInfo(hook: SwiftHookEntry) {
  return {
    id: hook.hookId,
    target: hook.target,
    address: hook.address,
    type: "swift",
    active: hook.active,
    hits: hook.hits,
  };
}

function checkSwiftAvailable(): boolean {
  // Swift apps run on Apple platforms which also have ObjC runtime
  return ObjC.available && Swift !== null;
}

function ensureSwiftAvailable(): void {
  if (!checkSwiftAvailable()) {
    throw new Error("Swift runtime is not available");
  }
}

// ── RPC Handlers ────────────────────────────────────────────────────────────

registerHandler("isSwiftAvailable", (_params: unknown) => {
  return checkSwiftAvailable();
});

registerHandler("enumerateSwiftModules", (params: unknown) => {
  ensureSwiftAvailable();

  const p = (params as { filter?: string }) ?? {};
  const filter = p.filter?.toLowerCase();

  // Strategy 1: Use Swift bridge's native module enumeration if available
  if (Swift!.modules && typeof Swift!.modules.enumerate === "function") {
    try {
      const modules = Swift!.modules.enumerate();
      const result = modules.map((m) => ({
        name: m.name,
        path: m.path,
      }));

      if (filter) {
        return result.filter((m) => m.name.toLowerCase().includes(filter));
      }
      return result;
    } catch {
      // Fall through to export scanning strategy
    }
  }

  // Strategy 2: Scan module exports for Swift symbols (prefixed with $s or _$s)
  const swiftModules: Array<{ name: string; path: string; swiftSymbolCount: number }> = [];

  for (const mod of Process.enumerateModules()) {
    try {
      const exports = mod.enumerateExports();
      let swiftSymbolCount = 0;

      for (const exp of exports) {
        if (exp.name.startsWith("$s") || exp.name.startsWith("_$s")) {
          swiftSymbolCount++;
          if (swiftSymbolCount >= 3) break; // Enough to confirm Swift presence
        }
      }

      if (swiftSymbolCount > 0) {
        swiftModules.push({
          name: mod.name,
          path: mod.path,
          swiftSymbolCount,
        });
      }
    } catch {
      // Some modules may not allow export enumeration
    }
  }

  if (filter) {
    return swiftModules.filter((m) => m.name.toLowerCase().includes(filter));
  }

  return swiftModules;
});

registerHandler("demangleSwiftSymbol", (params: unknown) => {
  ensureSwiftAvailable();

  const { symbol } = params as { symbol: string };

  if (!symbol || symbol.length === 0) {
    throw new Error("Symbol name is required");
  }

  // Strategy 1: Use Swift bridge's demangle if available
  if (Swift!.demangle && typeof Swift!.demangle === "function") {
    try {
      return { symbol, demangled: Swift!.demangle(symbol) };
    } catch {
      // Fall through to DebugSymbol strategy
    }
  }

  // Strategy 2: Use DebugSymbol as fallback — resolve the symbol address and read its name
  try {
    const resolver = new ApiResolver("objc");
    // Try to find the symbol by scanning exports of loaded modules
    for (const mod of Process.enumerateModules()) {
      try {
        const addr = mod.findExportByName(symbol);
        if (addr && !addr.isNull()) {
          const debugSym = DebugSymbol.fromAddress(addr);
          if (debugSym.name && debugSym.name.length > 0) {
            return { symbol, demangled: debugSym.name };
          }
        }
      } catch {
        continue;
      }
    }

    // If symbol looks like an address, try directly
    if (/^0x[0-9a-fA-F]+$/.test(symbol)) {
      const debugSym = DebugSymbol.fromAddress(ptr(symbol));
      if (debugSym.name && debugSym.name.length > 0) {
        return { symbol, demangled: debugSym.name };
      }
    }

    void resolver; // suppress unused warning
  } catch {
    // Demangling not available
  }

  return { symbol, demangled: symbol, note: "Could not demangle; returning original symbol" };
});

registerHandler("enumerateSwiftTypes", (params: unknown) => {
  ensureSwiftAvailable();

  const p = params as { moduleName: string; filter?: string };
  const { moduleName } = p;
  const filter = p.filter?.toLowerCase();

  if (!moduleName) {
    throw new Error("moduleName is required");
  }

  // Strategy 1: Use bridge's type enumeration if available
  if (Swift!.enumerateTypesSync && typeof Swift!.enumerateTypesSync === "function") {
    try {
      const types: SwiftTypeDescriptor[] = Swift!.enumerateTypesSync(moduleName);
      const result = types.map((t) => ({
        name: t.name,
        kind: t.kind,
        metadataPointer: t.metadataPointer.toString(),
      }));

      if (filter) {
        return result.filter((t) => t.name.toLowerCase().includes(filter));
      }
      return result;
    } catch {
      // Fall through to export scanning
    }
  }

  // Strategy 2: Scan module exports for Swift type metadata symbols
  const mod = Process.findModuleByName(moduleName);
  if (!mod) {
    throw new Error(`Module not found: ${moduleName}`);
  }

  const types: Array<{ name: string; kind: string; address: string }> = [];
  const exports = mod.enumerateExports();

  for (const exp of exports) {
    const name = exp.name;
    // Swift type metadata symbols contain specific patterns:
    // $s...CN  = class metadata
    // $s...VN  = struct metadata
    // $s...ON  = enum metadata
    // $s...Ma  = type metadata accessor
    const rawName = name.startsWith("_") ? name.slice(1) : name;

    if (!rawName.startsWith("$s")) continue;

    let kind = "unknown";
    if (rawName.endsWith("CN") || rawName.includes("CMa")) {
      kind = "class";
    } else if (rawName.endsWith("VN") || rawName.includes("VMa")) {
      kind = "struct";
    } else if (rawName.endsWith("ON") || rawName.includes("OMa")) {
      kind = "enum";
    } else if (rawName.endsWith("Mp") || rawName.endsWith("Mc")) {
      kind = "protocol";
    } else {
      continue; // Skip non-type symbols
    }

    // Try to get demangled name
    let demangled = name;
    if (exp.address && !exp.address.isNull()) {
      try {
        const debugSym = DebugSymbol.fromAddress(exp.address);
        if (debugSym.name && debugSym.name.length > 0) {
          demangled = debugSym.name;
        }
      } catch {
        // Keep mangled name
      }
    }

    types.push({
      name: demangled,
      kind,
      address: exp.address.toString(),
    });
  }

  if (filter) {
    return types.filter((t) => t.name.toLowerCase().includes(filter));
  }

  return types;
});

registerHandler("hookSwiftFunction", (params: unknown) => {
  ensureSwiftAvailable();

  const {
    target,
    captureArgs = false,
    captureRetval = false,
    captureBacktrace = false,
  } = params as {
    target: string;
    captureArgs?: boolean;
    captureRetval?: boolean;
    captureBacktrace?: boolean;
  };

  if (!target || target.length === 0) {
    throw new Error("target is required (address, mangled symbol, or module!symbol)");
  }

  // Resolve the target address
  let addr: NativePointer | null = null;
  let resolvedName = target;

  // Direct address — require explicit 0x prefix to avoid misinterpreting
  // symbol names like "deadbeef" as raw pointers (SIGSEGV on dereference).
  if (/^0x[0-9a-fA-F]+$/.test(target)) {
    addr = ptr(target);
  }

  // module!symbol format
  if (!addr) {
    const bangIndex = target.indexOf("!");
    if (bangIndex !== -1) {
      const moduleName = target.slice(0, bangIndex);
      const symbolName = target.slice(bangIndex + 1);
      const mod = Process.findModuleByName(moduleName);
      if (mod) {
        try {
          addr = mod.findExportByName(symbolName);
        } catch {
          addr = null;
        }
      }
      if (!addr) {
        throw new Error(`Swift export not found: ${target}`);
      }
      resolvedName = symbolName;
    }
  }

  // Bare symbol name — search all modules
  if (!addr) {
    addr = Module.findExportByName(null, target);
    // Also try with underscore prefix (common on Apple platforms)
    if (!addr && !target.startsWith("_")) {
      addr = Module.findExportByName(null, `_${target}`);
    }
  }

  if (!addr || addr.isNull()) {
    throw new Error(`Could not resolve Swift function: ${target}`);
  }

  // Try to get demangled name for display
  try {
    const debugSym = DebugSymbol.fromAddress(addr);
    if (debugSym.name && debugSym.name.length > 0) {
      resolvedName = debugSym.name;
    }
  } catch {
    // Keep the original target name
  }

  const hookId = `swift_hook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const listener = Interceptor.attach(addr, {
    onEnter(args) {
      const hook = swiftHooks.get(hookId);
      if (!hook || !hook.active) return;

      hook.hits += 1;

      const details: Record<string, unknown> = {
        target: resolvedName,
        address: addr!.toString(),
        threadId: Process.getCurrentThreadId(),
      };

      if (captureArgs) {
        // Swift uses the same calling convention as C on Apple platforms
        // Capture first 8 pointer-sized args
        const captured: string[] = [];
        for (let i = 0; i < 8; i++) {
          try {
            captured.push(args[i].toString());
          } catch {
            break;
          }
        }
        details.args = captured;
      }

      if (captureBacktrace) {
        try {
          const frames = Thread.backtrace(this.context, Backtracer.FUZZY).slice(0, 16);
          details.backtrace = frames.map((f) => f.toString());
        } catch {
          details.backtrace = [];
        }
      }

      emitHookEvent(hookId, "enter", details);
    },
    onLeave(retval) {
      const hook = swiftHooks.get(hookId);
      if (!hook || !hook.active) return;

      const details: Record<string, unknown> = {
        target: resolvedName,
        address: addr!.toString(),
        threadId: Process.getCurrentThreadId(),
      };

      if (captureRetval) {
        details.retval = retval.toString();
      }

      emitHookEvent(hookId, "leave", details);
    },
  });

  const hookEntry: SwiftHookEntry = {
    hookId,
    target: resolvedName,
    address: addr.toString(),
    listener,
    active: true,
    hits: 0,
  };

  swiftHooks.set(hookId, hookEntry);
  return toHookInfo(hookEntry);
});

registerHandler("unhookSwiftFunction", (params: unknown) => {
  const { hookId } = params as { hookId: string };
  const hook = swiftHooks.get(hookId);
  if (!hook) throw new Error(`Hook not found: ${hookId}`);
  hook.listener.detach();
  swiftHooks.delete(hookId);
  return { hookId, removed: true };
});

registerHandler("listSwiftHooks", (_params: unknown) => {
  return Array.from(swiftHooks.values()).map(toHookInfo);
});

registerHandler("setSwiftHookActive", (params: unknown) => {
  const { hookId, active } = params as { hookId: string; active: boolean };
  const hook = swiftHooks.get(hookId);
  if (!hook) throw new Error(`Hook not found: ${hookId}`);

  hook.active = active;
  return toHookInfo(hook);
});
