import { registerHandler } from "../rpc/router";
import { emitHookEvent } from "../rpc/protocol";

interface JavaHookEntry {
  hookId: string;
  className: string;
  methodName: string;
  overloadIndex: number;
  active: boolean;
  hits: number;
}

const javaHooks = new Map<string, JavaHookEntry>();
let hookCounter = 0;

function toHookInfo(hook: JavaHookEntry) {
  return {
    id: hook.hookId,
    target: `${hook.className}.${hook.methodName}`,
    address: null,
    type: "java",
    active: hook.active,
    hits: hook.hits,
  };
}

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
        const declared = cls.class.getDeclaredMethods();
        const overloadCounts = new Map<string, number>();
        const hookedMethods = new Set(
          Array.from(javaHooks.values())
            .filter((hook) => hook.className === className)
            .map((hook) => hook.methodName),
        );

        for (let i = 0; i < declared.length; i++) {
          const m = declared[i];
          const name = m.getName();
          overloadCounts.set(name, (overloadCounts.get(name) ?? 0) + 1);
        }

        for (let i = 0; i < declared.length; i++) {
          const m = declared[i];
          const name = m.getName();
          methods.push({
            name,
            returnType: m.getReturnType().getName(),
            argumentTypes: Array.from(
              m.getParameterTypes() as unknown as { getName(): string }[]
            ).map((t) => t.getName()),
            isOverloaded: (overloadCounts.get(name) ?? 0) > 1,
            hooked: hookedMethods.has(name),
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
        const selectedOverloadIndex = overloadIndex ?? 0;
        const targetOverload = overloads[selectedOverloadIndex];

        if (!targetOverload) {
          throw new Error(
            `Overload index ${selectedOverloadIndex} not found for ${className}.${methodName}`
          );
        }

        targetOverload.implementation = function (this: unknown, ...args: unknown[]) {
          const hook = javaHooks.get(hookId);

          if (hook?.active) {
            hook.hits += 1;
            emitHookEvent(hookId, "enter", {
              className,
              methodName,
              target: `${className}.${methodName}`,
              args: args.map(String),
              threadId: Process.getCurrentThreadId(),
              address: null,
              backtrace: [],
            });
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const retval = (targetOverload as any).call(this, ...args);

          if (hook?.active) {
            emitHookEvent(hookId, "leave", {
              className,
              methodName,
              target: `${className}.${methodName}`,
              retval: String(retval),
              threadId: Process.getCurrentThreadId(),
              address: null,
              backtrace: [],
            });
          }

          return retval;
        };

        const hookEntry: JavaHookEntry = {
          hookId,
          className,
          methodName,
          overloadIndex: selectedOverloadIndex,
          active: true,
          hits: 0,
        };

        javaHooks.set(hookId, hookEntry);
        resolve(toHookInfo(hookEntry));
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
        if (methodGroup?.overloads?.[hook.overloadIndex]) {
          methodGroup.overloads[hook.overloadIndex].implementation = null;
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
  return Array.from(javaHooks.values()).map(toHookInfo);
});

registerHandler("setJavaHookActive", (params: unknown) => {
  const { hookId, active } = params as { hookId: string; active: boolean };
  const hook = javaHooks.get(hookId);
  if (!hook) {
    throw new Error(`Hook not found: ${hookId}`);
  }

  hook.active = active;
  return toHookInfo(hook);
});
