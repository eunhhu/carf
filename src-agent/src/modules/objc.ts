import { registerHandler } from "../rpc/router";
import { emitHookEvent } from "../rpc/protocol";

// Track active ObjC hooks: hookId -> InvocationListener
const objcHooks = new Map<string, InvocationListener>();
let hookCounter = 0;

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
  return cls.$methods.map((selector) => ({
    selector,
    type: selector.startsWith("+") ? "class" : "instance",
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
      emitHookEvent(hookId, "enter", {
        className,
        selector,
        self: args[0].toString(),
        threadId: Process.getCurrentThreadId(),
      });
    },
    onLeave(retval) {
      emitHookEvent(hookId, "leave", {
        className,
        selector,
        retval: retval.toString(),
        threadId: Process.getCurrentThreadId(),
      });
    },
  });

  objcHooks.set(hookId, listener);
  return { hookId, className, selector };
});

registerHandler("unhookObjcMethod", (params: unknown) => {
  const { hookId } = params as { hookId: string };
  const listener = objcHooks.get(hookId);
  if (!listener) throw new Error(`Hook not found: ${hookId}`);
  listener.detach();
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
  return Array.from(objcHooks.keys()).map((hookId) => ({ hookId }));
});
