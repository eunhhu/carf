import type { MethodHandler } from "../../rpc/types";

// Check if ObjC runtime is available
export const objcAvailable: MethodHandler = () => {
  return { available: ObjC.available };
};

// Get ObjC runtime info
export const objcGetRuntime: MethodHandler = () => {
  if (!ObjC.available) {
    throw new Error("ObjC runtime not available");
  }

  return {
    api: ObjC.api ? "available" : "unavailable",
    classes: Object.keys(ObjC.classes).length,
    protocols: Object.keys(ObjC.protocols).length,
    mainQueue: ObjC.mainQueue?.toString() || null,
  };
};

// Enumerate ObjC classes
export const objcEnumerateClasses: MethodHandler = ({ params }) => {
  if (!ObjC.available) {
    throw new Error("ObjC runtime not available");
  }

  const { pattern, limit = 100 } = (params || {}) as { pattern?: string; limit?: number };

  try {
    const allClasses = Object.keys(ObjC.classes);
    let filtered = allClasses;

    if (pattern) {
      const regex = new RegExp(pattern, "i");
      filtered = allClasses.filter((c) => regex.test(c));
    }

    return filtered.slice(0, limit);
  } catch (e) {
    throw new Error(`Failed to enumerate classes: ${e}`);
  }
};

// Get class methods
export const objcGetClassMethods: MethodHandler = ({ params }) => {
  if (!ObjC.available) {
    throw new Error("ObjC runtime not available");
  }

  const { className } = (params || {}) as { className?: string };

  if (!className) {
    throw new Error("className parameter is required");
  }

  try {
    const cls = ObjC.classes[className];
    if (!cls) {
      throw new Error(`Class '${className}' not found`);
    }

    const ownMethods = cls.$ownMethods || [];
    return ownMethods.map((m: string) => ({
      name: m,
      type: m.startsWith("+") ? "class" : "instance",
    }));
  } catch (e) {
    throw new Error(`Failed to get class methods: ${e}`);
  }
};

// Get class properties
export const objcGetClassProperties: MethodHandler = ({ params }) => {
  if (!ObjC.available) {
    throw new Error("ObjC runtime not available");
  }

  const { className } = (params || {}) as { className?: string };

  if (!className) {
    throw new Error("className parameter is required");
  }

  try {
    const cls = ObjC.classes[className];
    if (!cls) {
      throw new Error(`Class '${className}' not found`);
    }

    // Get ivars if available
    const ivars: string[] = [];
    if (cls.$ivars) {
      for (const ivar of Object.keys(cls.$ivars)) {
        ivars.push(ivar);
      }
    }

    return { className, ivars };
  } catch (e) {
    throw new Error(`Failed to get class properties: ${e}`);
  }
};

// Enumerate protocols
export const objcEnumerateProtocols: MethodHandler = ({ params }) => {
  if (!ObjC.available) {
    throw new Error("ObjC runtime not available");
  }

  const { limit = 100 } = (params || {}) as { limit?: number };

  try {
    return Object.keys(ObjC.protocols).slice(0, limit);
  } catch (e) {
    throw new Error(`Failed to enumerate protocols: ${e}`);
  }
};

// Choose instances of a class
export const objcChoose: MethodHandler = ({ params }) => {
  if (!ObjC.available) {
    throw new Error("ObjC runtime not available");
  }

  const { className, limit = 10 } = (params || {}) as { className?: string; limit?: number };

  if (!className) {
    throw new Error("className parameter is required");
  }

  try {
    const instances: string[] = [];

    ObjC.choose(ObjC.classes[className], {
      onMatch(instance) {
        instances.push(instance.handle.toString());
        if (instances.length >= limit) {
          return "stop";
        }
      },
      onComplete() {},
    });

    return { className, instances, count: instances.length };
  } catch (e) {
    throw new Error(`Failed to choose instances: ${e}`);
  }
};

// Schedule on main thread
export const objcScheduleOnMainThread: MethodHandler = ({ params }) => {
  if (!ObjC.available) {
    throw new Error("ObjC runtime not available");
  }

  const { code } = (params || {}) as { code?: string };

  if (!code) {
    throw new Error("code parameter is required");
  }

  try {
    ObjC.schedule(ObjC.mainQueue, () => {
      // Execute code on main thread
      // Note: In real implementation, this would need to evaluate the code
    });
    return { scheduled: true };
  } catch (e) {
    throw new Error(`Failed to schedule on main thread: ${e}`);
  }
};
