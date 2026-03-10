function findLoadedModule(name: string): Module | null {
	const directMatch = Process.findModuleByName(name);
	if (directMatch) {
		return directMatch;
	}

	return (
		Process.enumerateModules().find(
			(module) =>
				module.name === name ||
				module.path === name ||
				module.path.endsWith(`/${name}`),
		) ?? null
	);
}

export function findExportByName(
	moduleName: string | null,
	symbolName: string,
): NativePointer | null {
	if (moduleName && moduleName.length > 0) {
		return findLoadedModule(moduleName)?.findExportByName(symbolName) ?? null;
	}

	return Module.findGlobalExportByName(symbolName);
}

export function readByteArray(
	address: NativePointerValue,
	length: number,
): ArrayBuffer | null {
	return ptr(address).readByteArray(length);
}

export function readUtf8String(
	address: NativePointerValue,
	length: number,
): string | null {
	return ptr(address).readUtf8String(length);
}

export function writeByteArray(
	address: NativePointerValue,
	value: ArrayBuffer | Uint8Array | number[],
): void {
	const encoded =
		value instanceof Uint8Array ? Array.from(value) : value;
	ptr(address).writeByteArray(encoded);
}
