import {
	For,
	Show,
	type Accessor,
	type JSX,
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
} from "solid-js";

interface VirtualListProps<T> {
	items: readonly T[];
	itemHeight: number;
	overscan?: number;
	resetKey?: unknown;
	class?: string;
	contentClass?: string;
	empty?: JSX.Element;
	children: (item: T, index: Accessor<number>) => JSX.Element;
}

interface VirtualListEntry<T> {
	item: T;
	index: number;
}

export function VirtualList<T>(props: VirtualListProps<T>) {
	const overscan = () => props.overscan ?? 6;
	const [scrollTop, setScrollTop] = createSignal(0);
	const [viewportHeight, setViewportHeight] = createSignal(0);

	let containerRef: HTMLDivElement | undefined;

	const visibleRange = createMemo(() => {
		const itemHeight = props.itemHeight;
		const total = props.items.length;
		const start = Math.max(
			0,
			Math.floor(scrollTop() / itemHeight) - overscan(),
		);
		const end = Math.min(
			total,
			Math.ceil((scrollTop() + viewportHeight()) / itemHeight) + overscan(),
		);

		return { start, end };
	});

	const visibleEntries = createMemo<VirtualListEntry<T>[]>(() => {
		const { start, end } = visibleRange();
		return props.items.slice(start, end).map((item, offset) => ({
			item,
			index: start + offset,
		}));
	});

	const totalHeight = createMemo(() => props.items.length * props.itemHeight);
	const offsetY = createMemo(() => visibleRange().start * props.itemHeight);

	onMount(() => {
		if (!containerRef) {
			return;
		}

		setViewportHeight(containerRef.clientHeight);

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) {
				return;
			}

			setViewportHeight(entry.contentRect.height);
		});

		observer.observe(containerRef);
		onCleanup(() => observer.disconnect());
	});

	createEffect(() => {
		void props.resetKey;
		if (!containerRef) {
			return;
		}

		containerRef.scrollTop = 0;
		setScrollTop(0);
	});

	createEffect(() => {
		const maxScrollTop = Math.max(0, totalHeight() - viewportHeight());
		if (!containerRef || scrollTop() <= maxScrollTop) {
			return;
		}

		containerRef.scrollTop = maxScrollTop;
		setScrollTop(maxScrollTop);
	});

	return (
		<div
			ref={containerRef}
			class={props.class ?? "h-full overflow-auto"}
			onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
		>
			<Show when={props.items.length > 0} fallback={props.empty}>
				<div
					class={props.contentClass}
					style={{
						height: `${totalHeight()}px`,
						position: "relative",
					}}
				>
					<div
						style={{
							transform: `translateY(${offsetY()}px)`,
						}}
					>
						<For each={visibleEntries()}>
							{(entry) => props.children(entry.item, () => entry.index)}
						</For>
					</div>
				</div>
			</Show>
		</div>
	);
}
