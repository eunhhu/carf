import { JavaRuntime as Java } from "../bridges";
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

function isJavaAvailable(): boolean {
  try {
    return Java.available;
  } catch {
    return false;
  }
}

function ensureJavaAvailable(): void {
  if (!isJavaAvailable()) {
    throw new Error("Java runtime is not available");
  }
}

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
  return isJavaAvailable();
});

registerHandler("getAndroidPackageName", (_params: unknown) => {
  ensureJavaAvailable();

  return new Promise<string | null>((resolve, reject) => {
    Java.performNow(() => {
      try {
        const ActivityThread = Java.use("android.app.ActivityThread");
        const application = ActivityThread.currentApplication();
        if (application === null) {
          resolve(null);
          return;
        }

        resolve(application.getPackageName().toString());
      } catch (e) {
        reject(e);
      }
    });
  });
});

registerHandler("enumerateJavaClasses", (params: unknown) => {
  ensureJavaAvailable();

  const p = (params as { filter?: string; limit?: number }) ?? {};
  const filter = p.filter?.toLowerCase();
  const limit = typeof p.limit === "number" && p.limit > 0 ? Math.floor(p.limit) : null;

  return new Promise<string[]>((resolve, reject) => {
    Java.performNow(() => {
      try {
        const classes = Java.enumerateLoadedClassesSync();
        const filtered = filter
          ? classes.filter((c) => c.toLowerCase().includes(filter))
          : classes;
        resolve(limit === null ? filtered : filtered.slice(0, limit));
      } catch (e) {
        reject(e);
      }
    });
  });
});

registerHandler("getJavaMethods", (params: unknown) => {
  ensureJavaAvailable();

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
  ensureJavaAvailable();

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
  ensureJavaAvailable();

  const { className, methodName, overloadIndex } = params as {
    className: string;
    methodName: string;
    overloadIndex?: number;
  };

  const hookId = `java_hook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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
  ensureJavaAvailable();

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
  ensureJavaAvailable();

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

// --- Advanced Java Features ---

registerHandler("enumerateJavaClassLoaders", (_params: unknown) => {
  ensureJavaAvailable();

  return new Promise<unknown[]>((resolve, reject) => {
    Java.performNow(() => {
      try {
        const loaders = Java.enumerateClassLoadersSync();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = loaders.map((loader: any, index: number) => {
          try {
            return {
              index,
              className: loader.$className ?? "unknown",
              toString: loader.toString(),
            };
          } catch {
            return {
              index,
              className: "unknown",
              toString: `ClassLoader#${index}`,
            };
          }
        });
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
  });
});

registerHandler("getJavaStackTrace", (_params: unknown) => {
  ensureJavaAvailable();

  return new Promise<string>((resolve, reject) => {
    Java.performNow(() => {
      try {
        const ThreadClass = Java.use("java.lang.Thread");
        const currentThread = ThreadClass.currentThread();
        const stackElements = currentThread.getStackTrace();
        const lines: string[] = [];

        for (let i = 0; i < stackElements.length; i++) {
          lines.push(stackElements[i].toString());
        }

        resolve(lines.join("\n"));
      } catch (e) {
        reject(e);
      }
    });
  });
});

registerHandler("searchJavaHeap", (params: unknown) => {
  ensureJavaAvailable();

  const { className, filter } = params as {
    className: string;
    filter?: string;
  };

  return new Promise<unknown[]>((resolve, reject) => {
    Java.performNow(() => {
      try {
        const cls = Java.use(className);
        const declaredFields = cls.class.getDeclaredFields();
        const fieldNames: string[] = [];

        for (let i = 0; i < declaredFields.length; i++) {
          declaredFields[i].setAccessible(true);
          fieldNames.push(declaredFields[i].getName());
        }

        const instances: unknown[] = [];
        Java.choose(className, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onMatch(instance: any) {
            const fields: Record<string, string> = {};
            for (const fieldName of fieldNames) {
              try {
                const field = cls.class.getDeclaredField(fieldName);
                field.setAccessible(true);
                const value = field.get(instance);
                fields[fieldName] = value !== null ? String(value) : "null";
              } catch {
                fields[fieldName] = "<error reading>";
              }
            }

            const entry = {
              handle: instance.$handle?.toString() ?? "unknown",
              className: instance.$className,
              fields,
            };

            if (filter) {
              const filterLower = filter.toLowerCase();
              const matches = Object.values(fields).some(
                (v) => v.toLowerCase().includes(filterLower),
              );
              if (!matches) return;
            }

            instances.push(entry);
            if (instances.length >= 50) return "stop";
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

registerHandler("callJavaMethod", (params: unknown) => {
  ensureJavaAvailable();

  const { className, methodName, args, isStatic } = params as {
    className: string;
    methodName: string;
    args: unknown[];
    isStatic: boolean;
  };

  return new Promise<unknown>((resolve, reject) => {
    Java.performNow(() => {
      try {
        const cls = Java.use(className);

        if (isStatic) {
          const method = cls[methodName];
          if (!method) {
            throw new Error(`Static method not found: ${className}.${methodName}`);
          }
          const result = method.call(cls, ...args);
          resolve({
            className,
            methodName,
            result: result !== undefined && result !== null ? String(result) : null,
          });
        } else {
          // For instance methods, find a live instance first
          let resolved = false;
          Java.choose(className, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onMatch(instance: any) {
              if (resolved) return "stop";
              try {
                const method = instance[methodName];
                if (!method) {
                  throw new Error(`Instance method not found: ${className}.${methodName}`);
                }
                const result = method.call(instance, ...args);
                resolved = true;
                resolve({
                  className,
                  methodName,
                  result: result !== undefined && result !== null ? String(result) : null,
                });
              } catch (e) {
                resolved = true;
                reject(e);
              }
              return "stop";
            },
            onComplete() {
              if (!resolved) {
                reject(new Error(`No live instance found for ${className}`));
              }
            },
          });
        }
      } catch (e) {
        reject(e);
      }
    });
  });
});
