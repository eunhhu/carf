import { registerHandler } from "../rpc/router";
import { emitHookEvent } from "../rpc/protocol";

interface HookEntry {
  hookId: string;
  target: string;
  address: string;
  listener: InvocationListener;
  captureArgs: boolean;
  captureRetval: boolean;
  captureBacktrace: boolean;
}

const hooks = new Map<string, HookEntry>();
let hookCounter = 0;

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
    const addr = Module.findExportByName(moduleName, symbolName);
    if (!addr) throw new Error(`Export not found: ${target}`);
    return addr;
  }

  // Bare symbol name — search all modules
  const addr = Module.findExportByName(null, target);
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
  });

  return { hookId, target, address: addr.toString() };
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
  return { result: String(result) };
});

registerHandler("listHooks", (_params: unknown) => {
  const result: {
    hookId: string;
    target: string;
    address: string;
    captureArgs: boolean;
    captureRetval: boolean;
    captureBacktrace: boolean;
  }[] = [];
  for (const hook of hooks.values()) {
    result.push({
      hookId: hook.hookId,
      target: hook.target,
      address: hook.address,
      captureArgs: hook.captureArgs,
      captureRetval: hook.captureRetval,
      captureBacktrace: hook.captureBacktrace,
    });
  }
  return result;
});
