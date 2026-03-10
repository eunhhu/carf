import { createSignal } from "solid-js";
import type { NavigateOptions, TabId } from "./types";

const [activeTab, setActiveTab] = createSignal<TabId>("console");
const [pendingContext, setPendingContext] = createSignal<
  Record<string, unknown> | undefined
>();

/**
 * Navigate to a tab with optional context.
 * Used for cross-tab navigation (e.g., clicking an address jumps to Memory tab).
 */
export function navigateTo(options: NavigateOptions): void {
  setPendingContext(options.context);
  setActiveTab(options.tab);
}

/**
 * Consume the pending navigation context.
 * Called by the target tab component on mount to apply context.
 */
export function consumeNavigationContext(): Record<string, unknown> | undefined {
  const ctx = pendingContext();
  setPendingContext(undefined);
  return ctx;
}

export { activeTab, setActiveTab };
