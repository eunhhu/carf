import type { MethodHandler } from "../../rpc/types";

// Check if Java runtime is available
export const javaAvailable: MethodHandler = () => {
  return { available: Java.available };
};

// Get Java VM info
export const javaGetVmInfo: MethodHandler = () => {
  if (!Java.available) {
    throw new Error("Java runtime not available");
  }

  return {
    available: Java.available,
    androidVersion: Java.androidVersion || null,
  };
};

// Enumerate loaded classes
export const javaEnumerateLoadedClasses: MethodHandler = ({ params }) => {
  if (!Java.available) {
    throw new Error("Java runtime not available");
  }

  const { pattern, limit = 100 } = (params || {}) as { pattern?: string; limit?: number };

  return new Promise((resolve, reject) => {
    try {
      Java.perform(() => {
        const classes: string[] = [];
        const regex = pattern ? new RegExp(pattern, "i") : null;

        Java.enumerateLoadedClasses({
          onMatch(className) {
            if (!regex || regex.test(className)) {
              classes.push(className);
              if (classes.length >= limit) {
                return "stop";
              }
            }
          },
          onComplete() {
            resolve(classes);
          },
        });
      });
    } catch (e) {
      reject(new Error(`Failed to enumerate classes: ${e}`));
    }
  });
};

// Get class methods
export const javaGetClassMethods: MethodHandler = ({ params }) => {
  if (!Java.available) {
    throw new Error("Java runtime not available");
  }

  const { className } = (params || {}) as { className?: string };

  if (!className) {
    throw new Error("className parameter is required");
  }

  return new Promise((resolve, reject) => {
    try {
      Java.perform(() => {
        const cls = Java.use(className);
        const methods: string[] = [];

        // Get declared methods
        const clsObj = cls.class;
        const declaredMethods = clsObj.getDeclaredMethods();

        for (let i = 0; i < declaredMethods.length; i++) {
          methods.push(declaredMethods[i].toString());
        }

        resolve({ className, methods: methods.slice(0, 100) });
      });
    } catch (e) {
      reject(new Error(`Failed to get class methods: ${e}`));
    }
  });
};

// Get class fields
export const javaGetClassFields: MethodHandler = ({ params }) => {
  if (!Java.available) {
    throw new Error("Java runtime not available");
  }

  const { className } = (params || {}) as { className?: string };

  if (!className) {
    throw new Error("className parameter is required");
  }

  return new Promise((resolve, reject) => {
    try {
      Java.perform(() => {
        const cls = Java.use(className);
        const fields: string[] = [];

        const clsObj = cls.class;
        const declaredFields = clsObj.getDeclaredFields();

        for (let i = 0; i < declaredFields.length; i++) {
          fields.push(declaredFields[i].toString());
        }

        resolve({ className, fields: fields.slice(0, 100) });
      });
    } catch (e) {
      reject(new Error(`Failed to get class fields: ${e}`));
    }
  });
};

// Choose instances of a class
export const javaChoose: MethodHandler = ({ params }) => {
  if (!Java.available) {
    throw new Error("Java runtime not available");
  }

  const { className, limit = 10 } = (params || {}) as { className?: string; limit?: number };

  if (!className) {
    throw new Error("className parameter is required");
  }

  return new Promise((resolve, reject) => {
    try {
      Java.perform(() => {
        const instances: string[] = [];

        Java.choose(className, {
          onMatch(instance) {
            instances.push(instance.toString());
            if (instances.length >= limit) {
              return "stop";
            }
          },
          onComplete() {
            resolve({ className, instances, count: instances.length });
          },
        });
      });
    } catch (e) {
      reject(new Error(`Failed to choose instances: ${e}`));
    }
  });
};

// Enumerate class loaders
export const javaEnumerateClassLoaders: MethodHandler = ({ params }) => {
  if (!Java.available) {
    throw new Error("Java runtime not available");
  }

  const { limit = 20 } = (params || {}) as { limit?: number };

  return new Promise((resolve, reject) => {
    try {
      Java.perform(() => {
        const loaders: string[] = [];

        Java.enumerateClassLoaders({
          onMatch(loader) {
            loaders.push(loader.toString());
            if (loaders.length >= limit) {
              return "stop";
            }
          },
          onComplete() {
            resolve(loaders);
          },
        });
      });
    } catch (e) {
      reject(new Error(`Failed to enumerate class loaders: ${e}`));
    }
  });
};

// Perform on Java thread
export const javaPerform: MethodHandler = () => {
  if (!Java.available) {
    throw new Error("Java runtime not available");
  }

  return new Promise((resolve) => {
    Java.perform(() => {
      resolve({ performed: true });
    });
  });
};

// Schedule on main thread (Android)
export const javaScheduleOnMainThread: MethodHandler = () => {
  if (!Java.available) {
    throw new Error("Java runtime not available");
  }

  return new Promise((resolve) => {
    Java.scheduleOnMainThread(() => {
      resolve({ scheduled: true });
    });
  });
};
