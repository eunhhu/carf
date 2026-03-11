import { unwrap } from "solid-js/store";

export function snapshotStore<T>(value: T): T {
	return structuredClone(unwrap(value));
}

export function restoreStore<T>(value: T): T {
	return structuredClone(value);
}
