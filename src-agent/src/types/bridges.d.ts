declare module "frida-java-bridge" {
	const JavaBridge: typeof Java;
	export default JavaBridge;
}

declare module "frida-objc-bridge" {
	const ObjCBridge: typeof ObjC;
	export default ObjCBridge;
}
