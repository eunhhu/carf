import { startTransition } from "solid-js";

type IdleHandle = number;
type IdleCallback = () => void;

type IdleWindow = Window & {
	requestIdleCallback?: (
		callback: () => void,
		options?: { timeout?: number },
	) => IdleHandle;
	cancelIdleCallback?: (handle: IdleHandle) => void;
};

export function scheduleTransition(task: () => void): void {
	queueMicrotask(() => {
		void startTransition(task);
	});
}

export function scheduleIdle(task: IdleCallback, timeout = 250): () => void {
	if (typeof window === "undefined") {
		const handle = setTimeout(task, 0);
		return () => clearTimeout(handle);
	}

	const idleWindow = window as IdleWindow;
	if (
		typeof idleWindow.requestIdleCallback === "function" &&
		typeof idleWindow.cancelIdleCallback === "function"
	) {
		const handle = idleWindow.requestIdleCallback(task, { timeout });
		return () => idleWindow.cancelIdleCallback?.(handle);
	}

	const handle = window.setTimeout(task, 16);
	return () => window.clearTimeout(handle);
}
