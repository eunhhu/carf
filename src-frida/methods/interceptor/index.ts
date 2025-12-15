import type { MethodHandler } from "../../rpc/types";

// Store for active interceptors
const activeInterceptors: Map<string, InvocationListener> = new Map();

type AttachParams = {
  target: string; // Address or symbol name
  onEnter?: boolean;
  onLeave?: boolean;
};

// Attach interceptor to a function
export const interceptorAttach: MethodHandler = ({ params }) => {
  const { target, onEnter = true, onLeave = true } = (params || {}) as AttachParams;

  if (!target) {
    throw new Error("target parameter is required");
  }

  try {
    const targetPtr = target.startsWith("0x") 
      ? new NativePointer(target)
      : Module.findGlobalExportByName(target);

    if (!targetPtr) {
      throw new Error(`Target '${target}' not found`);
    }

    const id = `interceptor_${target}_${Date.now()}`;
    
    const listener = Interceptor.attach(targetPtr, {
      onEnter: onEnter ? function(args) {
        send({
          type: "carf:event",
          event: "interceptor_enter",
          id,
          target,
          threadId: this.threadId,
          context: {
            pc: this.context.pc.toString(),
            sp: this.context.sp.toString(),
          },
          args: [
            args[0]?.toString() || null,
            args[1]?.toString() || null,
            args[2]?.toString() || null,
            args[3]?.toString() || null,
          ],
        });
      } : undefined,
      onLeave: onLeave ? function(retval) {
        send({
          type: "carf:event",
          event: "interceptor_leave",
          id,
          target,
          threadId: this.threadId,
          retval: retval.toString(),
        });
      } : undefined,
    });

    activeInterceptors.set(id, listener);

    return { id, target: targetPtr.toString() };
  } catch (e) {
    throw new Error(`Failed to attach interceptor: ${e}`);
  }
};

// Detach interceptor
export const interceptorDetach: MethodHandler = ({ params }) => {
  const { id } = (params || {}) as { id?: string };

  if (!id) {
    throw new Error("id parameter is required");
  }

  const listener = activeInterceptors.get(id);
  if (!listener) {
    throw new Error(`Interceptor '${id}' not found`);
  }

  try {
    listener.detach();
    activeInterceptors.delete(id);
    return { success: true, id };
  } catch (e) {
    throw new Error(`Failed to detach interceptor: ${e}`);
  }
};

// Detach all interceptors
export const interceptorDetachAll: MethodHandler = () => {
  try {
    Interceptor.detachAll();
    const count = activeInterceptors.size;
    activeInterceptors.clear();
    return { success: true, detached: count };
  } catch (e) {
    throw new Error(`Failed to detach all interceptors: ${e}`);
  }
};

// List active interceptors
export const interceptorList: MethodHandler = () => {
  return Array.from(activeInterceptors.keys());
};

type ReplaceParams = {
  target: string;
  replacement: string; // NativeCallback address or code
};

// Replace function implementation
export const interceptorReplace: MethodHandler = ({ params }) => {
  const { target, replacement } = (params || {}) as ReplaceParams;

  if (!target || !replacement) {
    throw new Error("target and replacement parameters are required");
  }

  try {
    const targetPtr = target.startsWith("0x")
      ? new NativePointer(target)
      : Module.findGlobalExportByName(target);

    if (!targetPtr) {
      throw new Error(`Target '${target}' not found`);
    }

    const replacementPtr = new NativePointer(replacement);
    Interceptor.replace(targetPtr, replacementPtr);

    return { success: true, target: targetPtr.toString() };
  } catch (e) {
    throw new Error(`Failed to replace function: ${e}`);
  }
};

// Revert replaced function
export const interceptorRevert: MethodHandler = ({ params }) => {
  const { target } = (params || {}) as { target?: string };

  if (!target) {
    throw new Error("target parameter is required");
  }

  try {
    const targetPtr = target.startsWith("0x")
      ? new NativePointer(target)
      : Module.findGlobalExportByName(target);

    if (!targetPtr) {
      throw new Error(`Target '${target}' not found`);
    }

    Interceptor.revert(targetPtr);
    return { success: true, target: targetPtr.toString() };
  } catch (e) {
    throw new Error(`Failed to revert function: ${e}`);
  }
};

// Flush pending interceptor changes
export const interceptorFlush: MethodHandler = () => {
  try {
    Interceptor.flush();
    return { success: true };
  } catch (e) {
    throw new Error(`Failed to flush interceptor: ${e}`);
  }
};
