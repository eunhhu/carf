import { ObjCRuntime as ObjC } from "../bridges";
import { registerHandler } from "../rpc/router";
import { emitHookEvent } from "../rpc/protocol";

interface ObjcHookEntry {
  hookId: string;
  className: string;
  selector: string;
  address: string;
  listener: InvocationListener;
  active: boolean;
  hits: number;
}

const objcHooks = new Map<string, ObjcHookEntry>();
let hookCounter = 0;

function toHookInfo(hook: ObjcHookEntry) {
  return {
    id: hook.hookId,
    target: `${hook.className} ${hook.selector}`,
    address: hook.address,
    type: "objc",
    active: hook.active,
    hits: hook.hits,
  };
}

registerHandler("isObjcAvailable", (_params: unknown) => {
  return ObjC.available;
});

registerHandler("enumerateObjcClasses", (params: unknown) => {
  if (!ObjC.available) throw new Error("ObjC runtime is not available");

  const p = (params as { filter?: string; appOnly?: boolean }) ?? {};
  const filter = p.filter?.toLowerCase();
  const appOnly = p.appOnly ?? false;

  const systemPrefixes = ["NS", "UI", "CF", "CA", "CL", "MK", "AV", "SK", "WK", "GK", "MT"];

  const classes = ObjC.enumerateLoadedClassesSync();
  // classes is an object keyed by image path; flatten all class names
  const allClassNames: string[] = [];
  for (const image of Object.keys(classes)) {
    for (const cls of classes[image]) {
      allClassNames.push(cls);
    }
  }

  let result = allClassNames;

  if (appOnly) {
    result = result.filter((cls) => !systemPrefixes.some((prefix) => cls.startsWith(prefix)));
  }

  if (filter) {
    result = result.filter((cls) => cls.toLowerCase().includes(filter));
  }

  return result;
});

registerHandler("getObjcMethods", (params: unknown) => {
  if (!ObjC.available) throw new Error("ObjC runtime is not available");

  const { className } = params as { className: string };

  if (!(className in ObjC.classes)) {
    throw new Error(`ObjC class not found: ${className}`);
  }

  const cls = ObjC.classes[className];
  const hookedSelectors = new Set(
    Array.from(objcHooks.values())
      .filter((hook) => hook.className === className)
      .map((hook) => hook.selector),
  );

  return cls.$methods.map((selector) => ({
    selector,
    type: selector.startsWith("+") ? "class" : "instance",
    returnType: "unknown",
    argumentTypes: [],
    hooked: hookedSelectors.has(selector),
  }));
});

registerHandler("hookObjcMethod", (params: unknown) => {
  if (!ObjC.available) throw new Error("ObjC runtime is not available");

  const { className, selector } = params as { className: string; selector: string };

  if (!(className in ObjC.classes)) {
    throw new Error(`ObjC class not found: ${className}`);
  }

  const cls = ObjC.classes[className];

  // Normalize selector: allow passing with or without leading +/-
  let methodKey = selector;
  if (!methodKey.startsWith("+") && !methodKey.startsWith("-")) {
    methodKey = `- ${methodKey}`;
  }

  const method = cls[methodKey];
  if (!method) {
    throw new Error(`Method not found: ${className} ${selector}`);
  }

  const hookId = `objc_hook_${++hookCounter}`;
  const impl = method.implementation;

  const listener = Interceptor.attach(impl, {
    onEnter(args) {
      const hook = objcHooks.get(hookId);
      if (!hook || !hook.active) {
        return;
      }

      hook.hits += 1;
      emitHookEvent(hookId, "enter", {
        className,
        selector,
        target: `${className} ${selector}`,
        address: impl.toString(),
        self: args[0].toString(),
        threadId: Process.getCurrentThreadId(),
        backtrace: [],
      });
    },
    onLeave(retval) {
      const hook = objcHooks.get(hookId);
      if (!hook || !hook.active) {
        return;
      }

      emitHookEvent(hookId, "leave", {
        className,
        selector,
        target: `${className} ${selector}`,
        address: impl.toString(),
        retval: retval.toString(),
        threadId: Process.getCurrentThreadId(),
        backtrace: [],
      });
    },
  });

  const hookEntry: ObjcHookEntry = {
    hookId,
    className,
    selector,
    address: impl.toString(),
    listener,
    active: true,
    hits: 0,
  };

  objcHooks.set(hookId, hookEntry);
  return toHookInfo(hookEntry);
});

registerHandler("unhookObjcMethod", (params: unknown) => {
  const { hookId } = params as { hookId: string };
  const hook = objcHooks.get(hookId);
  if (!hook) throw new Error(`Hook not found: ${hookId}`);
  hook.listener.detach();
  objcHooks.delete(hookId);
  return { hookId, removed: true };
});

registerHandler("chooseObjcInstances", (params: unknown) => {
  if (!ObjC.available) throw new Error("ObjC runtime is not available");

  const { className, maxCount } = params as { className: string; maxCount?: number };
  const limit = maxCount ?? 10;

  if (!(className in ObjC.classes)) {
    throw new Error(`ObjC class not found: ${className}`);
  }

  const cls = ObjC.classes[className];
  const instances = ObjC.chooseSync(cls);

  return instances.slice(0, limit).map((inst) => ({
    handle: inst.handle.toString(),
    description: (() => {
      try {
        return inst.description().toString();
      } catch {
        return "(unavailable)";
      }
    })(),
  }));
});

registerHandler("listObjcHooks", (_params: unknown) => {
  return Array.from(objcHooks.values()).map(toHookInfo);
});

registerHandler("setObjcHookActive", (params: unknown) => {
  const { hookId, active } = params as { hookId: string; active: boolean };
  const hook = objcHooks.get(hookId);
  if (!hook) {
    throw new Error(`Hook not found: ${hookId}`);
  }

  hook.active = active;
  return toHookInfo(hook);
});
