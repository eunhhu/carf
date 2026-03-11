import { createDeferred, createMemo, createRoot, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { generateId } from "~/lib/format";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import type { PinItem, TabId } from "~/lib/types";

interface PinboardState {
	items: PinItem[];
}

const DEFAULT_STATE: PinboardState = {
	items: [],
};

const [state, setState] = createStore<PinboardState>({
	...DEFAULT_STATE,
});

const [typeFilter, setTypeFilter] = createSignal<PinItem["type"] | "all">(
	"all",
);
const { filteredItems } = createRoot(() => {
	const deferredTypeFilter = createDeferred(typeFilter);

	return {
		filteredItems: createMemo(() => {
			const filter = deferredTypeFilter();
			if (filter === "all") return state.items;
			return state.items.filter((item) => item.type === filter);
		}),
	};
});

function pinItem(
	type: PinItem["type"],
	name: string,
	source: TabId,
	address: string | null = null,
	metadata: Record<string, unknown> = {},
): PinItem {
	const existing = state.items.find(
		(item) =>
			item.type === type && item.name === name && item.source === source,
	);
	if (existing) return existing;

	const item: PinItem = {
		id: generateId(),
		type,
		name,
		address,
		source,
		tags: [],
		memo: "",
		metadata,
		pinnedAt: Date.now(),
	};
	setState("items", (prev) => [...prev, item]);
	return item;
}

function unpinItem(id: string): void {
	setState("items", (prev) => prev.filter((item) => item.id !== id));
}

function updatePinTags(id: string, tags: string[]): void {
	setState("items", (item) => item.id === id, "tags", tags);
}

function updatePinMemo(id: string, memo: string): void {
	setState("items", (item) => item.id === id, "memo", memo);
}

function isPinned(type: PinItem["type"], name: string): boolean {
	return state.items.some((item) => item.type === type && item.name === name);
}

function getPinnedByType(type: PinItem["type"]): PinItem[] {
	return state.items.filter((item) => item.type === type);
}

function exportPins(): string {
	return JSON.stringify(state.items, null, 2);
}

function importPins(json: string): number {
	const items: PinItem[] = JSON.parse(json);
	let count = 0;
	for (const item of items) {
		if (!state.items.some((existing) => existing.id === item.id)) {
			setState("items", (prev) => [...prev, item]);
			count++;
		}
	}
	return count;
}

function clearPins(): void {
	setState(restoreStore(DEFAULT_STATE));
}

function snapshotPinboardState(): {
	state: PinboardState;
	typeFilter: PinItem["type"] | "all";
} {
	return {
		state: snapshotStore(state),
		typeFilter: typeFilter(),
	};
}

function restorePinboardState(snapshot?: {
	state: PinboardState;
	typeFilter: PinItem["type"] | "all";
}): void {
	if (!snapshot) {
		clearPins();
		setTypeFilter("all");
		return;
	}

	setState(restoreStore(snapshot.state));
	setTypeFilter(snapshot.typeFilter);
}

export {
	state as pinboardState,
	filteredItems as filteredPins,
	typeFilter as pinTypeFilter,
	setTypeFilter as setPinTypeFilter,
	pinItem,
	unpinItem,
	updatePinTags,
	updatePinMemo,
	isPinned,
	getPinnedByType,
	exportPins,
	importPins,
	clearPins,
	snapshotPinboardState,
	restorePinboardState,
};
