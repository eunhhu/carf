import { registerHandler } from "../rpc/router";
import { emitHookEvent } from "../rpc/protocol";

// ── IL2CPP Module Discovery ─────────────────────────────────────────────────

const IL2CPP_LIBS = ["libil2cpp.so", "GameAssembly.dylib", "GameAssembly.dll"];

function findIl2cppModule(): Module | null {
  for (const name of IL2CPP_LIBS) {
    const mod = Process.findModuleByName(name);
    if (mod) return mod;
  }
  return null;
}

function resolveIl2cppExport(name: string): NativePointer | null {
  const mod = findIl2cppModule();
  if (!mod) return null;
  try {
    return mod.findExportByName(name);
  } catch {
    return null;
  }
}

// ── IL2CPP NativeFunction Cache ─────────────────────────────────────────────

let il2cpp_domain_get: NativeFunction<NativePointer, []> | null = null;
let il2cpp_domain_get_assemblies: NativeFunction<NativePointer, [NativePointer, NativePointer]> | null = null;
let il2cpp_assembly_get_image: NativeFunction<NativePointer, [NativePointer]> | null = null;
let il2cpp_image_get_class_count: NativeFunction<number, [NativePointer]> | null = null;
let il2cpp_image_get_class: NativeFunction<NativePointer, [NativePointer, number]> | null = null;
let il2cpp_class_get_name: NativeFunction<NativePointer, [NativePointer]> | null = null;
let il2cpp_class_get_namespace: NativeFunction<NativePointer, [NativePointer]> | null = null;
let il2cpp_class_get_methods: NativeFunction<NativePointer, [NativePointer, NativePointer]> | null = null;
let il2cpp_method_get_name: NativeFunction<NativePointer, [NativePointer]> | null = null;
let il2cpp_method_get_param_count: NativeFunction<number, [NativePointer]> | null = null;
let il2cpp_class_get_fields: NativeFunction<NativePointer, [NativePointer, NativePointer]> | null = null;
let il2cpp_field_get_name: NativeFunction<NativePointer, [NativePointer]> | null = null;
let il2cpp_field_get_offset: NativeFunction<number, [NativePointer]> | null = null;
let il2cpp_field_get_type: NativeFunction<NativePointer, [NativePointer]> | null = null;
let il2cpp_type_get_name: NativeFunction<NativePointer, [NativePointer]> | null = null;
let il2cpp_string_new: NativeFunction<NativePointer, [NativePointer]> | null = null;
let il2cpp_image_get_name: NativeFunction<NativePointer, [NativePointer]> | null = null;
let il2cpp_method_get_class: NativeFunction<NativePointer, [NativePointer]> | null = null;

function resolveOptional(name: string): NativePointer | null {
  return resolveIl2cppExport(name);
}

function resolveRequired(name: string): NativePointer {
  const addr = resolveIl2cppExport(name);
  if (!addr || addr.isNull()) {
    throw new Error(`IL2CPP export not found: ${name}`);
  }
  return addr;
}

function ensureIl2cppFunctions(): void {
  if (il2cpp_domain_get) return;

  il2cpp_domain_get = new NativeFunction(
    resolveRequired("il2cpp_domain_get"), "pointer", [],
  );

  il2cpp_domain_get_assemblies = new NativeFunction(
    resolveRequired("il2cpp_domain_get_assemblies"), "pointer", ["pointer", "pointer"],
  );

  il2cpp_assembly_get_image = new NativeFunction(
    resolveRequired("il2cpp_assembly_get_image"), "pointer", ["pointer"],
  );

  il2cpp_image_get_class_count = new NativeFunction(
    resolveRequired("il2cpp_image_get_class_count"), "int", ["pointer"],
  );

  il2cpp_image_get_class = new NativeFunction(
    resolveRequired("il2cpp_image_get_class"), "pointer", ["pointer", "int"],
  );

  il2cpp_class_get_name = new NativeFunction(
    resolveRequired("il2cpp_class_get_name"), "pointer", ["pointer"],
  );

  il2cpp_class_get_namespace = new NativeFunction(
    resolveRequired("il2cpp_class_get_namespace"), "pointer", ["pointer"],
  );

  il2cpp_class_get_methods = new NativeFunction(
    resolveRequired("il2cpp_class_get_methods"), "pointer", ["pointer", "pointer"],
  );

  il2cpp_method_get_name = new NativeFunction(
    resolveRequired("il2cpp_method_get_name"), "pointer", ["pointer"],
  );

  il2cpp_method_get_param_count = new NativeFunction(
    resolveRequired("il2cpp_method_get_param_count"), "int", ["pointer"],
  );

  il2cpp_class_get_fields = new NativeFunction(
    resolveRequired("il2cpp_class_get_fields"), "pointer", ["pointer", "pointer"],
  );

  il2cpp_field_get_name = new NativeFunction(
    resolveRequired("il2cpp_field_get_name"), "pointer", ["pointer"],
  );

  il2cpp_field_get_offset = new NativeFunction(
    resolveRequired("il2cpp_field_get_offset"), "int", ["pointer"],
  );

  // Optional — may not be present in all IL2CPP versions
  const fieldGetTypeAddr = resolveOptional("il2cpp_field_get_type");
  il2cpp_field_get_type = fieldGetTypeAddr
    ? new NativeFunction(fieldGetTypeAddr, "pointer", ["pointer"])
    : null;

  const typeGetNameAddr = resolveOptional("il2cpp_type_get_name");
  il2cpp_type_get_name = typeGetNameAddr
    ? new NativeFunction(typeGetNameAddr, "pointer", ["pointer"])
    : null;

  const stringNewAddr = resolveOptional("il2cpp_string_new");
  il2cpp_string_new = stringNewAddr
    ? new NativeFunction(stringNewAddr, "pointer", ["pointer"])
    : null;

  const imageGetNameAddr = resolveOptional("il2cpp_image_get_name");
  il2cpp_image_get_name = imageGetNameAddr
    ? new NativeFunction(imageGetNameAddr, "pointer", ["pointer"])
    : null;

  const methodGetClassAddr = resolveOptional("il2cpp_method_get_class");
  il2cpp_method_get_class = methodGetClassAddr
    ? new NativeFunction(methodGetClassAddr, "pointer", ["pointer"])
    : null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function readCString(addr: NativePointer): string {
  if (addr.isNull()) return "";
  try {
    return addr.readUtf8String() ?? "";
  } catch {
    return "";
  }
}

function getVersionString(): string | null {
  const mod = findIl2cppModule();
  if (!mod) return null;

  // Try to find il2cpp_get_version_string or similar export
  const versionExport = resolveOptional("il2cpp_get_version_string");
  if (versionExport) {
    try {
      const fn = new NativeFunction(versionExport, "pointer", []);
      const result = fn() as NativePointer;
      if (!result.isNull()) {
        return readCString(result);
      }
    } catch {
      // Version not available through API
    }
  }

  return null;
}

// ── Hook Management ─────────────────────────────────────────────────────────

interface Il2cppHookEntry {
  hookId: string;
  target: string;
  address: string;
  listener: InvocationListener;
  active: boolean;
  hits: number;
}

const il2cppHooks = new Map<string, Il2cppHookEntry>();
let hookCounter = 0;

function toHookInfo(hook: Il2cppHookEntry) {
  return {
    id: hook.hookId,
    target: hook.target,
    address: hook.address,
    type: "il2cpp",
    active: hook.active,
    hits: hook.hits,
  };
}

// ── RPC Handlers ────────────────────────────────────────────────────────────

registerHandler("isIl2cppAvailable", (_params: unknown) => {
  return findIl2cppModule() !== null;
});

registerHandler("getIl2cppInfo", (_params: unknown) => {
  const mod = findIl2cppModule();
  if (!mod) {
    throw new Error("IL2CPP library is not loaded");
  }

  return {
    name: mod.name,
    base: mod.base.toString(),
    size: mod.size,
    path: mod.path,
    version: getVersionString(),
  };
});

registerHandler("enumerateIl2cppDomains", (_params: unknown) => {
  const mod = findIl2cppModule();
  if (!mod) throw new Error("IL2CPP library is not loaded");

  ensureIl2cppFunctions();

  const domain = il2cpp_domain_get!() as NativePointer;
  if (domain.isNull()) {
    throw new Error("il2cpp_domain_get returned null");
  }

  // Get assemblies from the domain
  const sizePtr = Memory.alloc(Process.pointerSize);
  sizePtr.writePointer(ptr(0));

  const assembliesPtr = il2cpp_domain_get_assemblies!(domain, sizePtr) as NativePointer;
  const assemblyCount = sizePtr.readPointer().toUInt32();

  const assemblies: Array<{ name: string; imageName: string; imagePtr: string }> = [];

  for (let i = 0; i < assemblyCount; i++) {
    const assemblyPtr = assembliesPtr.add(i * Process.pointerSize).readPointer();
    if (assemblyPtr.isNull()) continue;

    const imagePtr = il2cpp_assembly_get_image!(assemblyPtr) as NativePointer;
    if (imagePtr.isNull()) continue;

    let imageName = `assembly_${i}`;
    if (il2cpp_image_get_name) {
      const namePtr = il2cpp_image_get_name(imagePtr) as NativePointer;
      if (!namePtr.isNull()) {
        imageName = readCString(namePtr);
      }
    }

    assemblies.push({
      name: imageName,
      imageName,
      imagePtr: imagePtr.toString(),
    });
  }

  return {
    domain: domain.toString(),
    assemblyCount,
    assemblies,
  };
});

registerHandler("enumerateIl2cppClasses", (params: unknown) => {
  const p = params as { imagePtr: string; filter?: string; maxCount?: number };
  const { imagePtr: imagePtrStr } = p;
  const filter = p.filter?.toLowerCase();
  const maxCount = p.maxCount ?? 500;

  if (!imagePtrStr) {
    throw new Error("imagePtr is required");
  }

  ensureIl2cppFunctions();

  const imagePtr = ptr(imagePtrStr);
  const classCount = il2cpp_image_get_class_count!(imagePtr) as number;

  const classes: Array<{ name: string; namespace: string; classPtr: string }> = [];

  for (let i = 0; i < classCount; i++) {
    if (classes.length >= maxCount) break;

    const classPtr = il2cpp_image_get_class!(imagePtr, i) as NativePointer;
    if (classPtr.isNull()) continue;

    const namePtr = il2cpp_class_get_name!(classPtr) as NativePointer;
    const nsPtr = il2cpp_class_get_namespace!(classPtr) as NativePointer;

    const name = readCString(namePtr);
    const namespace = readCString(nsPtr);

    if (filter) {
      const fullName = namespace ? `${namespace}.${name}` : name;
      if (!fullName.toLowerCase().includes(filter)) continue;
    }

    classes.push({
      name,
      namespace,
      classPtr: classPtr.toString(),
    });
  }

  return { totalCount: classCount, classes };
});

registerHandler("getIl2cppClassMethods", (params: unknown) => {
  const { classPtr: classPtrStr } = params as { classPtr: string };

  if (!classPtrStr) {
    throw new Error("classPtr is required");
  }

  ensureIl2cppFunctions();

  const classPtr = ptr(classPtrStr);
  const iterPtr = Memory.alloc(Process.pointerSize);
  iterPtr.writePointer(ptr(0));

  const methods: Array<{
    name: string;
    paramCount: number;
    address: string;
    methodPtr: string;
  }> = [];

  // Iterate methods using the iterator pattern
  // il2cpp_class_get_methods returns a method pointer and advances the iterator
  // Returns NULL when no more methods
  for (;;) {
    const methodPtr = il2cpp_class_get_methods!(classPtr, iterPtr) as NativePointer;
    if (methodPtr.isNull()) break;

    const namePtr = il2cpp_method_get_name!(methodPtr) as NativePointer;
    const name = readCString(namePtr);
    const paramCount = il2cpp_method_get_param_count!(methodPtr) as number;

    // The method's native code address is typically at offset 0 of the MethodInfo struct
    let address = "0x0";
    try {
      const codeAddr = methodPtr.readPointer();
      if (!codeAddr.isNull()) {
        address = codeAddr.toString();
      }
    } catch {
      // Method may not have a compiled address yet (generic, abstract, etc.)
    }

    methods.push({
      name,
      paramCount,
      address,
      methodPtr: methodPtr.toString(),
    });
  }

  return methods;
});

registerHandler("getIl2cppClassFields", (params: unknown) => {
  const { classPtr: classPtrStr } = params as { classPtr: string };

  if (!classPtrStr) {
    throw new Error("classPtr is required");
  }

  ensureIl2cppFunctions();

  const classPtr = ptr(classPtrStr);
  const iterPtr = Memory.alloc(Process.pointerSize);
  iterPtr.writePointer(ptr(0));

  const fields: Array<{
    name: string;
    offset: number;
    typeName: string | null;
    fieldPtr: string;
  }> = [];

  for (;;) {
    const fieldPtr = il2cpp_class_get_fields!(classPtr, iterPtr) as NativePointer;
    if (fieldPtr.isNull()) break;

    const namePtr = il2cpp_field_get_name!(fieldPtr) as NativePointer;
    const name = readCString(namePtr);
    const offset = il2cpp_field_get_offset!(fieldPtr) as number;

    let typeName: string | null = null;
    if (il2cpp_field_get_type && il2cpp_type_get_name) {
      try {
        const typePtr = il2cpp_field_get_type(fieldPtr) as NativePointer;
        if (!typePtr.isNull()) {
          const typeNamePtr = il2cpp_type_get_name(typePtr) as NativePointer;
          if (!typeNamePtr.isNull()) {
            typeName = readCString(typeNamePtr);
          }
        }
      } catch {
        // Type info not available
      }
    }

    fields.push({
      name,
      offset,
      typeName,
      fieldPtr: fieldPtr.toString(),
    });
  }

  return fields;
});

registerHandler("hookIl2cppMethod", (params: unknown) => {
  const {
    address,
    methodName,
    captureArgs = false,
    captureRetval = false,
    captureBacktrace = false,
  } = params as {
    address: string;
    methodName?: string;
    captureArgs?: boolean;
    captureRetval?: boolean;
    captureBacktrace?: boolean;
  };

  if (!address) {
    throw new Error("address is required");
  }

  const addr = ptr(address);
  if (addr.isNull()) {
    throw new Error("Invalid method address (null pointer)");
  }

  // Verify the address is within the IL2CPP module
  const mod = findIl2cppModule();
  if (!mod) throw new Error("IL2CPP library is not loaded");

  const target = methodName ?? `il2cpp_${address}`;
  const hookId = `il2cpp_hook_${++hookCounter}`;

  const listener = Interceptor.attach(addr, {
    onEnter(args) {
      const hook = il2cppHooks.get(hookId);
      if (!hook || !hook.active) return;

      hook.hits += 1;

      const details: Record<string, unknown> = {
        target,
        address: addr.toString(),
        threadId: Process.getCurrentThreadId(),
      };

      if (captureArgs) {
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
      const hook = il2cppHooks.get(hookId);
      if (!hook || !hook.active) return;

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

  const hookEntry: Il2cppHookEntry = {
    hookId,
    target,
    address: addr.toString(),
    listener,
    active: true,
    hits: 0,
  };

  il2cppHooks.set(hookId, hookEntry);
  return toHookInfo(hookEntry);
});

registerHandler("unhookIl2cppMethod", (params: unknown) => {
  const { hookId } = params as { hookId: string };
  const hook = il2cppHooks.get(hookId);
  if (!hook) throw new Error(`Hook not found: ${hookId}`);
  hook.listener.detach();
  il2cppHooks.delete(hookId);
  return { hookId, removed: true };
});

registerHandler("dumpIl2cppMetadata", (params: unknown) => {
  const p = (params as { imagePtr?: string; maxClasses?: number }) ?? {};
  const maxClasses = p.maxClasses ?? 200;

  const mod = findIl2cppModule();
  if (!mod) throw new Error("IL2CPP library is not loaded");

  ensureIl2cppFunctions();

  const domain = il2cpp_domain_get!() as NativePointer;
  if (domain.isNull()) {
    throw new Error("il2cpp_domain_get returned null");
  }

  // If a specific imagePtr is provided, dump only that image
  if (p.imagePtr) {
    return dumpImage(ptr(p.imagePtr), maxClasses);
  }

  // Otherwise dump all assemblies
  const sizePtr = Memory.alloc(Process.pointerSize);
  sizePtr.writePointer(ptr(0));

  const assembliesPtr = il2cpp_domain_get_assemblies!(domain, sizePtr) as NativePointer;
  const assemblyCount = sizePtr.readPointer().toUInt32();

  const dump: Array<{
    imageName: string;
    classes: Array<{
      name: string;
      namespace: string;
      methods: Array<{ name: string; paramCount: number; address: string }>;
      fields: Array<{ name: string; offset: number; typeName: string | null }>;
    }>;
  }> = [];

  let totalClassesDumped = 0;

  for (let i = 0; i < assemblyCount; i++) {
    if (totalClassesDumped >= maxClasses) break;

    const assemblyPtr = assembliesPtr.add(i * Process.pointerSize).readPointer();
    if (assemblyPtr.isNull()) continue;

    const imagePtr = il2cpp_assembly_get_image!(assemblyPtr) as NativePointer;
    if (imagePtr.isNull()) continue;

    const remaining = maxClasses - totalClassesDumped;
    const imageDump = dumpImage(imagePtr, remaining);
    totalClassesDumped += imageDump.classes.length;

    dump.push(imageDump);
  }

  return {
    moduleName: mod.name,
    moduleBase: mod.base.toString(),
    moduleSize: mod.size,
    totalAssemblies: assemblyCount,
    dump,
  };
});

function dumpImage(imagePtr: NativePointer, maxClasses: number) {
  let imageName = "unknown";
  if (il2cpp_image_get_name) {
    const namePtr = il2cpp_image_get_name(imagePtr) as NativePointer;
    if (!namePtr.isNull()) {
      imageName = readCString(namePtr);
    }
  }

  const classCount = il2cpp_image_get_class_count!(imagePtr) as number;
  const limit = Math.min(classCount, maxClasses);

  const classes: Array<{
    name: string;
    namespace: string;
    methods: Array<{ name: string; paramCount: number; address: string }>;
    fields: Array<{ name: string; offset: number; typeName: string | null }>;
  }> = [];

  for (let i = 0; i < limit; i++) {
    const classPtr = il2cpp_image_get_class!(imagePtr, i) as NativePointer;
    if (classPtr.isNull()) continue;

    const namePtr = il2cpp_class_get_name!(classPtr) as NativePointer;
    const nsPtr = il2cpp_class_get_namespace!(classPtr) as NativePointer;
    const name = readCString(namePtr);
    const namespace = readCString(nsPtr);

    // Enumerate methods
    const methods: Array<{ name: string; paramCount: number; address: string }> = [];
    const methodIterPtr = Memory.alloc(Process.pointerSize);
    methodIterPtr.writePointer(ptr(0));

    for (;;) {
      const methodPtr = il2cpp_class_get_methods!(classPtr, methodIterPtr) as NativePointer;
      if (methodPtr.isNull()) break;

      const mNamePtr = il2cpp_method_get_name!(methodPtr) as NativePointer;
      const mName = readCString(mNamePtr);
      const paramCount = il2cpp_method_get_param_count!(methodPtr) as number;

      let address = "0x0";
      try {
        const codeAddr = methodPtr.readPointer();
        if (!codeAddr.isNull()) {
          address = codeAddr.toString();
        }
      } catch {
        // No compiled address
      }

      methods.push({ name: mName, paramCount, address });
    }

    // Enumerate fields
    const fields: Array<{ name: string; offset: number; typeName: string | null }> = [];
    const fieldIterPtr = Memory.alloc(Process.pointerSize);
    fieldIterPtr.writePointer(ptr(0));

    for (;;) {
      const fieldPtr = il2cpp_class_get_fields!(classPtr, fieldIterPtr) as NativePointer;
      if (fieldPtr.isNull()) break;

      const fNamePtr = il2cpp_field_get_name!(fieldPtr) as NativePointer;
      const fName = readCString(fNamePtr);
      const offset = il2cpp_field_get_offset!(fieldPtr) as number;

      let typeName: string | null = null;
      if (il2cpp_field_get_type && il2cpp_type_get_name) {
        try {
          const typePtr = il2cpp_field_get_type(fieldPtr) as NativePointer;
          if (!typePtr.isNull()) {
            const typeNamePtr = il2cpp_type_get_name(typePtr) as NativePointer;
            if (!typeNamePtr.isNull()) {
              typeName = readCString(typeNamePtr);
            }
          }
        } catch {
          // Type info not available
        }
      }

      fields.push({ name: fName, offset, typeName });
    }

    classes.push({ name, namespace, methods, fields });
  }

  return { imageName, classes };
}

registerHandler("listIl2cppHooks", (_params: unknown) => {
  return Array.from(il2cppHooks.values()).map(toHookInfo);
});

registerHandler("setIl2cppHookActive", (params: unknown) => {
  const { hookId, active } = params as { hookId: string; active: boolean };
  const hook = il2cppHooks.get(hookId);
  if (!hook) throw new Error(`Hook not found: ${hookId}`);

  hook.active = active;
  return toHookInfo(hook);
});
