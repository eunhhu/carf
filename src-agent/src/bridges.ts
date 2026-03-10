import JavaBridge from "frida-java-bridge";
import ObjCBridge from "frida-objc-bridge";

const globalScope = globalThis as {
	Java?: typeof Java;
	ObjC?: typeof ObjC;
};

if (typeof globalScope.Java === "undefined") {
	globalScope.Java = JavaBridge as typeof Java;
}

if (typeof globalScope.ObjC === "undefined") {
	globalScope.ObjC = ObjCBridge as typeof ObjC;
}

export const JavaRuntime = globalScope.Java ?? (JavaBridge as typeof Java);
export const ObjCRuntime = globalScope.ObjC ?? (ObjCBridge as typeof ObjC);

// Swift bridge — may not be available on all platforms (e.g. Android)
interface SwiftBridgeApi {
	available: boolean;
	api: Record<string, unknown>;
	modules: {
		enumerate(): SwiftModule[];
	};
	demangle(symbol: string): string;
	enumerateTypesSync(module: string): SwiftTypeDescriptor[];
}

interface SwiftModule {
	name: string;
	path: string;
}

interface SwiftTypeDescriptor {
	name: string;
	kind: string;
	metadataPointer: NativePointer;
}

let SwiftBridge: SwiftBridgeApi | null = null;
try {
	// frida-swift-bridge may not be available on all platforms
	const mod = require("frida-swift-bridge");
	SwiftBridge = (mod.Swift ?? null) as SwiftBridgeApi | null;
} catch {
	SwiftBridge = null;
}

export type { SwiftBridgeApi, SwiftModule, SwiftTypeDescriptor };
export const SwiftRuntime = SwiftBridge;
