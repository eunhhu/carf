import { registerHandler } from "../rpc/router";
import { emitHookEvent } from "../rpc/protocol";
import { findExportByName } from "../runtime/frida-compat";

interface HookEntry {
  hookId: string;
  target: string;
  address: string;
  listener: InvocationListener;
  captureArgs: boolean;
  captureRetval: boolean;
  captureBacktrace: boolean;
  active: boolean;
  hits: number;
}

const hooks = new Map<string, HookEntry>();
let hookCounter = 0;

function toHookInfo(hook: HookEntry) {
  return {
    id: hook.hookId,
    target: hook.target,
    address: hook.address,
    type: "native",
    active: hook.active,
    hits: hook.hits,
  };
}

function resolveTarget(target: string): NativePointer {
  // If it starts with 0x or is a pure hex string, treat as address
  if (/^0x[0-9a-fA-F]+$/.test(target) || /^[0-9a-fA-F]{8,}$/.test(target)) {
    return ptr(target);
  }

  // module!symbol format
  const bangIndex = target.indexOf("!");
  if (bangIndex !== -1) {
    const moduleName = target.slice(0, bangIndex);
    const symbolName = target.slice(bangIndex + 1);
    const addr = findExportByName(moduleName, symbolName);
    if (!addr) throw new Error(`Export not found: ${target}`);
    return addr;
  }

  // Bare symbol name — search all modules
  const addr = findExportByName(null, target);
  if (!addr) throw new Error(`Symbol not found: ${target}`);
  return addr;
}

registerHandler("hookFunction", (params: unknown) => {
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

  const addr = resolveTarget(target);
  const hookId = `native_hook_${++hookCounter}`;

  const listener = Interceptor.attach(addr, {
    onEnter(args) {
      const hook = hooks.get(hookId);
      if (!hook || !hook.active) {
        return;
      }

      hook.hits += 1;

      const details: Record<string, unknown> = {
        target,
        address: addr.toString(),
        threadId: Process.getCurrentThreadId(),
      };

      if (captureArgs) {
        // Capture first 8 pointer-sized args as hex strings
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
      const hook = hooks.get(hookId);
      if (!hook || !hook.active) {
        return;
      }

      const details: Record<string, unknown> = {
        target,
        address: addr.toString(),
        threadId: Process.getCurrentThreadId(),
      };

      if (captureRetval) {
        details.retval = retval.toString();
      }

      emitHookEvent(hookId, "leave", details);
    },
  });

  hooks.set(hookId, {
    hookId,
    target,
    address: addr.toString(),
    listener,
    captureArgs,
    captureRetval,
    captureBacktrace,
    active: true,
    hits: 0,
  });

  return toHookInfo(hooks.get(hookId)!);
});

registerHandler("unhookFunction", (params: unknown) => {
  const { hookId } = params as { hookId: string };
  const hook = hooks.get(hookId);
  if (!hook) throw new Error(`Hook not found: ${hookId}`);
  hook.listener.detach();
  hooks.delete(hookId);
  return { hookId, removed: true };
});

registerHandler("callFunction", (params: unknown) => {
  const { address, retType, argTypes, args } = params as {
    address: string;
    retType: string;
    argTypes: string[];
    args: unknown[];
  };

  const fn = new NativeFunction(ptr(address), retType as NativeType, argTypes as NativeType[]);
  const result = fn(...args);
  return String(result);
});

registerHandler("setNativeHookActive", (params: unknown) => {
  const { hookId, active } = params as { hookId: string; active: boolean };
  const hook = hooks.get(hookId);
  if (!hook) throw new Error(`Hook not found: ${hookId}`);

  hook.active = active;
  return toHookInfo(hook);
});

registerHandler("listHooks", (_params: unknown) => {
  return Array.from(hooks.values()).map(toHookInfo);
});
