import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import type { CallGraphData, CallGraphNode, CallGraphEdge, StalkerEvent } from "~/lib/types";
import { listen } from "~/lib/tauri";

export type GraphLayout = "tree" | "force" | "hierarchical" | "flame";

interface CallGraphState {
  data: CallGraphData;
  loading: boolean;
  selectedNodeId: string | null;
}

const [state, setState] = createStore<CallGraphState>({
  data: { nodes: [], edges: [] },
  loading: false,
  selectedNodeId: null,
});

const [layout, setLayout] = createSignal<GraphLayout>("tree");
const [moduleFilter, setModuleFilter] = createSignal<string | null>(null);
const [maxDepth, setMaxDepth] = createSignal<number>(10);

function buildGraphFromEvents(events: StalkerEvent[]): void {
  const nodeMap = new Map<string, CallGraphNode>();
  const edgeMap = new Map<string, CallGraphEdge>();

  for (const event of events) {
    if (event.type !== "call") continue;

    if (!nodeMap.has(event.to)) {
      nodeMap.set(event.to, {
        id: event.to,
        address: event.to,
        module: event.toModule,
        symbol: event.toSymbol,
        callCount: 0,
      });
    }
    const node = nodeMap.get(event.to)!;
    node.callCount++;

    const edgeKey = `${event.from}->${event.to}`;
    if (!edgeMap.has(edgeKey)) {
      edgeMap.set(edgeKey, { from: event.from, to: event.to, count: 0 });
    }
    edgeMap.get(edgeKey)!.count++;
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
  setState("data", { nodes: [], edges: [] });
  setState("selectedNodeId", null);
}

function setLoading(loading: boolean): void {
  setState("loading", loading);
}

function setupCallGraphListener(sessionId: string): () => void {
  const cleanup = listen<StalkerEvent>("carf://stalker/event", (event) => {
    if (!event) return;
    // Accumulate into existing data incrementally
    const { nodes: currentNodes, edges: currentEdges } = state.data;

    const nodeMap = new Map<string, CallGraphNode>(
      currentNodes.map((n) => [n.id, { ...n }]),
    );
    const edgeMap = new Map<string, CallGraphEdge>(
      currentEdges.map((e) => [`${e.from}->${e.to}`, { ...e }]),
    );

    if (event.type === "call") {
      if (!nodeMap.has(event.to)) {
        nodeMap.set(event.to, {
          id: event.to,
          address: event.to,
          module: event.toModule,
          symbol: event.toSymbol,
          callCount: 0,
        });
      }
      const node = nodeMap.get(event.to)!;
      node.callCount++;

      const edgeKey = `${event.from}->${event.to}`;
      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, { from: event.from, to: event.to, count: 0 });
      }
      edgeMap.get(edgeKey)!.count++;

      setState("data", {
        nodes: Array.from(nodeMap.values()),
        edges: Array.from(edgeMap.values()),
      });
    }
  });
  // sessionId reserved for future per-session filtering
  void sessionId;
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

export {
  state as callgraphState,
  layout as graphLayout,
  setLayout as setGraphLayout,
  moduleFilter as graphModuleFilter,
  setModuleFilter as setGraphModuleFilter,
  maxDepth as graphMaxDepth,
  setMaxDepth as setGraphMaxDepth,
  buildGraphFromEvents,
  selectNode as selectGraphNode,
  clearGraph,
  setLoading as setCallgraphLoading,
  filteredData as filteredGraphData,
  selectedNode as selectedGraphNode,
  setupCallGraphListener,
};
