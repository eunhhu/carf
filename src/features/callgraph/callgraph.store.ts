import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import {
	extractEventSessionId,
	normalizeStalkerEventPayload,
} from "~/lib/event-normalizers";
import { restoreStore, snapshotStore } from "~/lib/store-snapshot";
import { listen } from "~/lib/tauri";
import type {
	CallGraphData,
	CallGraphEdge,
	CallGraphNode,
	StalkerEvent,
} from "~/lib/types";

export type GraphLayout = "tree" | "force" | "hierarchical" | "flame";

interface CallGraphState {
	data: CallGraphData;
	loading: boolean;
	selectedNodeId: string | null;
}

const DEFAULT_STATE: CallGraphState = {
	data: { nodes: [], edges: [] },
	loading: false,
	selectedNodeId: null,
};

const [state, setState] = createStore<CallGraphState>({
	...DEFAULT_STATE,
});

const [layout, setLayout] = createSignal<GraphLayout>("tree");
const [moduleFilter, setModuleFilter] = createSignal<string | null>(null);
const [maxDepth, setMaxDepth] = createSignal<number>(10);

function buildGraphFromEvents(events: StalkerEvent[]): void {
	const nodeMap = new Map<string, CallGraphNode>();
	const edgeMap = new Map<string, CallGraphEdge>();

	for (const event of events) {
		if (event.type !== "call") continue;
		const weight = event.count ?? 1;

		if (!nodeMap.has(event.to)) {
			nodeMap.set(event.to, {
				id: event.to,
				address: event.to,
				module: event.toModule,
				symbol: event.toSymbol,
				callCount: 0,
			});
		}
		const node = nodeMap.get(event.to);
		if (node) {
			node.callCount += weight;
		}

		const edgeKey = `${event.from}->${event.to}`;
		if (!edgeMap.has(edgeKey)) {
			edgeMap.set(edgeKey, { from: event.from, to: event.to, count: 0 });
		}
		const edge = edgeMap.get(edgeKey);
		if (edge) {
			edge.count += weight;
		}
	}

	setState("data", {
		nodes: Array.from(nodeMap.values()),
		edges: Array.from(edgeMap.values()),
	});
}

function appendGraphEvents(events: StalkerEvent[]): void {
	const { nodes: currentNodes, edges: currentEdges } = state.data;

	const nodeMap = new Map<string, CallGraphNode>(
		currentNodes.map((node) => [node.id, { ...node }]),
	);
	const edgeMap = new Map<string, CallGraphEdge>(
		currentEdges.map((edge) => [`${edge.from}->${edge.to}`, { ...edge }]),
	);

	for (const event of events) {
		if (event.type !== "call") continue;
		const weight = event.count ?? 1;

		if (!nodeMap.has(event.to)) {
			nodeMap.set(event.to, {
				id: event.to,
				address: event.to,
				module: event.toModule,
				symbol: event.toSymbol,
				callCount: 0,
			});
		}

		const node = nodeMap.get(event.to);
		if (node) {
			node.callCount += weight;
		}

		const edgeKey = `${event.from}->${event.to}`;
		if (!edgeMap.has(edgeKey)) {
			edgeMap.set(edgeKey, { from: event.from, to: event.to, count: 0 });
		}
		const edge = edgeMap.get(edgeKey);
		if (edge) {
			edge.count += weight;
		}
	}

	setState("data", {
		nodes: Array.from(nodeMap.values()),
		edges: Array.from(edgeMap.values()),
	});
}

function selectNode(nodeId: string | null): void {
	setState("selectedNodeId", nodeId);
}

function clearGraph(): void {
	setState(restoreStore(DEFAULT_STATE));
}

function setLoading(loading: boolean): void {
	setState("loading", loading);
}

function setupCallGraphListener(sessionId: string): () => void {
	const cleanup = listen<unknown>("carf://stalker/event", (payload) => {
		if (extractEventSessionId(payload) !== sessionId) {
			return;
		}
		appendGraphEvents(normalizeStalkerEventPayload(payload));
	});
	return cleanup;
}

const filteredData = (): CallGraphData => {
	const filter = moduleFilter();
	if (!filter) return state.data;
	return {
		nodes: state.data.nodes.filter((n) => n.module === filter),
		edges: state.data.edges.filter((e) => {
			const fromNode = state.data.nodes.find((n) => n.id === e.from);
			const toNode = state.data.nodes.find((n) => n.id === e.to);
			return fromNode?.module === filter || toNode?.module === filter;
		}),
	};
};

const selectedNode = () =>
	state.data.nodes.find((n) => n.id === state.selectedNodeId) ?? null;

function snapshotCallgraphState(): {
	state: CallGraphState;
	layout: GraphLayout;
	moduleFilter: string | null;
	maxDepth: number;
} {
	return {
		state: snapshotStore(state),
		layout: layout(),
		moduleFilter: moduleFilter(),
		maxDepth: maxDepth(),
	};
}

function restoreCallgraphState(snapshot?: {
	state: CallGraphState;
	layout: GraphLayout;
	moduleFilter: string | null;
	maxDepth: number;
}): void {
	if (!snapshot) {
		clearGraph();
		setLayout("tree");
		setModuleFilter(null);
		setMaxDepth(10);
		return;
	}

	setState(restoreStore(snapshot.state));
	setLayout(snapshot.layout);
	setModuleFilter(snapshot.moduleFilter);
	setMaxDepth(snapshot.maxDepth);
}

export {
	state as callgraphState,
	layout as graphLayout,
	setLayout as setGraphLayout,
	moduleFilter as graphModuleFilter,
	setModuleFilter as setGraphModuleFilter,
	maxDepth as graphMaxDepth,
	setMaxDepth as setGraphMaxDepth,
	buildGraphFromEvents,
	appendGraphEvents,
	selectNode as selectGraphNode,
	clearGraph,
	setLoading as setCallgraphLoading,
  filteredData as filteredGraphData,
  selectedNode as selectedGraphNode,
  setupCallGraphListener,
  snapshotCallgraphState,
  restoreCallgraphState,
};
