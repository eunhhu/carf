import { registerHandler } from "../rpc/router";
import { emitHookEvent } from "../rpc/protocol";

// Track active Java hooks: hookId -> { className, methodName, implementation }
const javaHooks = new Map<string, { className: string; methodName: string }>();
let hookCounter = 0;

registerHandler("isJavaAvailable", (_params: unknown) => {
  return Java.available;
});

registerHandler("enumerateJavaClasses", (params: unknown) => {
  if (!Java.available) throw new Error("Java runtime is not available");

  const p = (params as { filter?: string }) ?? {};
  const filter = p.filter?.toLowerCase();

  return new Promise<string[]>((resolve, reject) => {
    Java.performNow(() => {
      try {
        const classes = Java.enumerateLoadedClassesSync();
        const filtered = filter
          ? classes.filter((c) => c.toLowerCase().includes(filter))
          : classes;
        resolve(filtered);
      } catch (e) {
        reject(e);
      }
    });
  });
});

registerHandler("getJavaMethods", (params: unknown) => {
  if (!Java.available) throw new Error("Java runtime is not available");

  const { className } = params as { className: string };

  return new Promise<unknown[]>((resolve, reject) => {
    Java.performNow(() => {
      try {
        const cls = Java.use(className);
        const methods: unknown[] = [];

        // getDeclaredMethods returns Java Method objects
        const declared = cls.class.getDeclaredMethods();
        for (let i = 0; i < declared.length; i++) {
          const m = declared[i];
          methods.push({
            name: m.getName(),
            returnType: m.getReturnType().getName(),
            parameterTypes: Array.from(
              m.getParameterTypes() as unknown as { getName(): string }[]
            ).map((t) => t.getName()),
            modifiers: m.getModifiers(),
          });
        }

        resolve(methods);
      } catch (e) {
        reject(e);
      }
    });
  });
});

registerHandler("getJavaFields", (params: unknown) => {
  if (!Java.available) throw new Error("Java runtime is not available");

  const { className } = params as { className: string };

  return new Promise<unknown[]>((resolve, reject) => {
    Java.performNow(() => {
      try {
        const cls = Java.use(className);
        const fields: unknown[] = [];

        const declared = cls.class.getDeclaredFields();
        for (let i = 0; i < declared.length; i++) {
          const f = declared[i];
          fields.push({
            name: f.getName(),
            type: f.getType().getName(),
            modifiers: f.getModifiers(),
          });
        }

        resolve(fields);
      } catch (e) {
        reject(e);
      }
    });
  });
});

registerHandler("hookJavaMethod", (params: unknown) => {
  if (!Java.available) throw new Error("Java runtime is not available");

  const { className, methodName, overloadIndex } = params as {
    className: string;
    methodName: string;
    overloadIndex?: number;
  };

  const hookId = `java_hook_${++hookCounter}`;

  return new Promise<unknown>((resolve, reject) => {
    Java.performNow(() => {
      try {
        const cls = Java.use(className);
        const methodGroup = cls[methodName];
        if (!methodGroup) {
          throw new Error(`Method not found: ${className}.${methodName}`);
        }

        const overloads = methodGroup.overloads;
        const targetOverload =
          overloadIndex !== undefined ? overloads[overloadIndex] : overloads[0];

        if (!targetOverload) {
          throw new Error(
            `Overload index ${overloadIndex ?? 0} not found for ${className}.${methodName}`
          );
        }

        targetOverload.implementation = function (this: unknown, ...args: unknown[]) {
          emitHookEvent(hookId, "enter", {
            className,
            methodName,
            args: args.map(String),
            threadId: Process.getCurrentThreadId(),
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const retval = (targetOverload as any).call(this, ...args);

          emitHookEvent(hookId, "leave", {
            className,
            methodName,
            retval: String(retval),
            threadId: Process.getCurrentThreadId(),
          });

          return retval;
        };

        javaHooks.set(hookId, { className, methodName });
        resolve({ hookId, className, methodName });
      } catch (e) {
        reject(e);
      }
    });
  });
});

registerHandler("unhookJavaMethod", (params: unknown) => {
  if (!Java.available) throw new Error("Java runtime is not available");

  const { hookId } = params as { hookId: string };
  const hook = javaHooks.get(hookId);
  if (!hook) throw new Error(`Hook not found: ${hookId}`);

  return new Promise<unknown>((resolve, reject) => {
    Java.performNow(() => {
      try {
        const cls = Java.use(hook.className);
        const methodGroup = cls[hook.methodName];
        if (methodGroup && methodGroup.overloads) {
          for (const overload of methodGroup.overloads) {
            overload.implementation = null;
          }
        }
        javaHooks.delete(hookId);
        resolve({ hookId, removed: true });
      } catch (e) {
        reject(e);
      }
    });
  });
});

registerHandler("chooseJavaInstances", (params: unknown) => {
  if (!Java.available) throw new Error("Java runtime is not available");

  const { className, maxCount } = params as {
    className: string;
    maxCount?: number;
  };
  const limit = maxCount ?? 10;

  return new Promise<unknown[]>((resolve, reject) => {
    Java.performNow(() => {
      try {
        const instances: unknown[] = [];
        Java.choose(className, {
          onMatch(instance) {
            instances.push({
              handle: instance.$handle?.toString() ?? "unknown",
              className: instance.$className,
            });
            if (instances.length >= limit) return "stop";
          },
          onComplete() {
            resolve(instances);
          },
        });
      } catch (e) {
        reject(e);
      }
    });
  });
});

registerHandler("listJavaHooks", (_params: unknown) => {
  const result: { hookId: string; className: string; methodName: string }[] = [];
  for (const [hookId, info] of javaHooks) {
    result.push({ hookId, ...info });
  }
  return result;
});
