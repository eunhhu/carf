import { createSignal } from "solid-js";
import { scheduleTransition } from "./scheduling";
import type { NavigateOptions, TabId } from "./types";

const [activeTab, setActiveTabSignal] = createSignal<TabId>("console");
const [pendingContext, setPendingContext] = createSignal<
	Record<string, unknown> | undefined
>();
const DEFAULT_TAB: TabId = "console";

/**
 * Navigate to a tab with optional context.
 * Used for cross-tab navigation (e.g., clicking an address jumps to Memory tab).
 */
export function navigateTo(options: NavigateOptions): void {
	scheduleTransition(() => {
		setPendingContext(options.context);
		setActiveTabSignal(options.tab);
	});
}

/**
 * Consume the pending navigation context.
 * Called by the target tab component on mount to apply context.
 */
export function consumeNavigationContext():
	| Record<string, unknown>
	| undefined {
	const ctx = pendingContext();
	setPendingContext(undefined);
	return ctx;
}

export function snapshotNavigationState(): {
	activeTab: TabId;
} {
	return {
		activeTab: activeTab(),
	};
}

export function restoreNavigationState(snapshot?: {
	activeTab: TabId;
}): void {
	scheduleTransition(() => {
		setActiveTabSignal(snapshot?.activeTab ?? DEFAULT_TAB);
		setPendingContext(undefined);
	});
}

function setActiveTab(tab: TabId): void {
	scheduleTransition(() => {
		setActiveTabSignal(tab);
	});
}

export { activeTab, setActiveTab };
