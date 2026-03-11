import { Show, For, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import type { CallGraphData } from "~/lib/types";
import {
  ActionPopover,
  buildAddressActions,
  buildModuleActions,
} from "~/components/ActionPopover";
import { CopyButton } from "~/components/CopyButton";
import { InlineActions } from "~/components/InlineActions";
import {
  graphLayout,
  setGraphLayout,
  filteredGraphData,
  selectedGraphNode,
  selectGraphNode,
  clearGraph,
  setupCallGraphListener,
} from "./callgraph.store";
import type { GraphLayout } from "./callgraph.store";
import { activeSession } from "~/features/session/session.store";
import { cn } from "~/lib/cn";
import { navigateTo } from "~/lib/navigation";
import { formatAddress } from "~/lib/format";

const LAYOUTS: { id: GraphLayout; label: string }[] = [
  { id: "tree", label: "Tree" },
  { id: "force", label: "Force" },
  { id: "hierarchical", label: "Hierarchical" },
  { id: "flame", label: "Flame Graph" },
];

type ViewMode = "canvas" | "list";

// ─── Layout position types ───

interface NodePosition {
  x: number;
  y: number;
  radius: number;
}

// ─── Module color palette ───

const MODULE_COLORS = [
  "#60a5fa", // blue
  "#34d399", // emerald
  "#f472b6", // pink
  "#a78bfa", // violet
  "#fb923c", // orange
  "#facc15", // yellow
  "#2dd4bf", // teal
  "#e879f9", // fuchsia
  "#4ade80", // green
  "#f87171", // red
  "#38bdf8", // sky
  "#c084fc", // purple
];

function getModuleColor(module: string | null, moduleIndex: Map<string, number>): string {
  if (!module) return "#6b7280"; // gray for unknown
  if (!moduleIndex.has(module)) {
    moduleIndex.set(module, moduleIndex.size);
  }
  return MODULE_COLORS[moduleIndex.get(module)! % MODULE_COLORS.length];
}

function nodeRadius(callCount: number, maxCalls: number): number {
  const minR = 8;
  const maxR = 28;
  if (maxCalls <= 0) return minR;
  return minR + (maxR - minR) * Math.sqrt(callCount / maxCalls);
}

function edgeWidth(count: number, maxCount: number): number {
  const minW = 0.8;
  const maxW = 5;
  if (maxCount <= 0) return minW;
  return minW + (maxW - minW) * (count / maxCount);
}

// ─── Layout algorithms ───

function computeTreeLayout(
  data: CallGraphData,
  width: number,
  height: number,
  maxCalls: number,
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  const nodes = data.nodes;
  const edges = data.edges;
  if (nodes.length === 0) return positions;

  // Build adjacency: find parent->child via edges
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of edges) {
    if (!childrenOf.has(e.from)) childrenOf.set(e.from, []);
    childrenOf.get(e.from)!.push(e.to);
    hasParent.add(e.to);
  }

  // Roots: nodes with no incoming edges
  const roots = nodes.filter((n) => !hasParent.has(n.id));
  if (roots.length === 0) roots.push(nodes[0]);

  // BFS to assign depth levels
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const r of roots) {
    depth.set(r.id, 0);
    queue.push(r.id);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const d = depth.get(current)!;
    for (const child of childrenOf.get(current) ?? []) {
      if (!depth.has(child)) {
        depth.set(child, d + 1);
        queue.push(child);
      }
    }
  }

  // Assign remaining unvisited nodes
  for (const n of nodes) {
    if (!depth.has(n.id)) depth.set(n.id, 0);
  }

  // Group by depth
  const levels = new Map<number, string[]>();
  let maxDepth = 0;
  for (const [id, d] of depth) {
    if (!levels.has(d)) levels.set(d, []);
    levels.get(d)!.push(id);
    maxDepth = Math.max(maxDepth, d);
  }

  const paddingX = 60;
  const paddingY = 60;
  const usableW = width - paddingX * 2;
  const usableH = height - paddingY * 2;
  const levelSpacing = maxDepth > 0 ? usableH / maxDepth : 0;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (let d = 0; d <= maxDepth; d++) {
    const ids = levels.get(d) ?? [];
    const count = ids.length;
    const spacing = count > 1 ? usableW / (count - 1) : 0;
    ids.forEach((id, i) => {
      const node = nodeMap.get(id)!;
      const r = nodeRadius(node.callCount, maxCalls);
      positions.set(id, {
        x: paddingX + (count > 1 ? i * spacing : usableW / 2),
        y: paddingY + d * levelSpacing,
        radius: r,
      });
    });
  }

  return positions;
}

function computeForceLayout(
  data: CallGraphData,
  width: number,
  height: number,
  maxCalls: number,
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  const nodes = data.nodes;
  const edges = data.edges;
  if (nodes.length === 0) return positions;

  // Initialize positions in a circle
  const cx = width / 2;
  const cy = height / 2;
  const initRadius = Math.min(width, height) * 0.35;

  interface ForceNode {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
  }

  const fnodes: ForceNode[] = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    return {
      id: n.id,
      x: cx + initRadius * Math.cos(angle),
      y: cy + initRadius * Math.sin(angle),
      vx: 0,
      vy: 0,
      radius: nodeRadius(n.callCount, maxCalls),
    };
  });

  const nodeIdx = new Map(fnodes.map((n, i) => [n.id, i]));

  // Simple force simulation
  const iterations = 120;
  const repulsion = 3000;
  const attraction = 0.005;
  const damping = 0.85;
  const centerPull = 0.01;

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;

    // Repulsion between all pairs
    for (let i = 0; i < fnodes.length; i++) {
      for (let j = i + 1; j < fnodes.length; j++) {
        let dx = fnodes[j].x - fnodes[i].x;
        let dy = fnodes[j].y - fnodes[i].y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) dist = 1;
        const force = (repulsion * alpha) / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        fnodes[i].vx -= fx;
        fnodes[i].vy -= fy;
        fnodes[j].vx += fx;
        fnodes[j].vy += fy;
      }
    }

    // Attraction along edges
    for (const e of edges) {
      const si = nodeIdx.get(e.from);
      const ti = nodeIdx.get(e.to);
      if (si === undefined || ti === undefined) continue;
      const dx = fnodes[ti].x - fnodes[si].x;
      const dy = fnodes[ti].y - fnodes[si].y;
      const force = attraction * alpha;
      fnodes[si].vx += dx * force;
      fnodes[si].vy += dy * force;
      fnodes[ti].vx -= dx * force;
      fnodes[ti].vy -= dy * force;
    }

    // Center pull
    for (const n of fnodes) {
      n.vx += (cx - n.x) * centerPull * alpha;
      n.vy += (cy - n.y) * centerPull * alpha;
    }

    // Apply velocities
    for (const n of fnodes) {
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
      // Keep within bounds
      n.x = Math.max(n.radius + 10, Math.min(width - n.radius - 10, n.x));
      n.y = Math.max(n.radius + 10, Math.min(height - n.radius - 10, n.y));
    }
  }

  for (const fn of fnodes) {
    positions.set(fn.id, { x: fn.x, y: fn.y, radius: fn.radius });
  }

  return positions;
}

function computeHierarchicalLayout(
  data: CallGraphData,
  width: number,
  height: number,
  maxCalls: number,
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  const nodes = data.nodes;
  const edges = data.edges;
  if (nodes.length === 0) return positions;

  // Layered DAG: Assign layers using longest path from sources
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    if (!outgoing.has(e.from)) outgoing.set(e.from, []);
    outgoing.get(e.from)!.push(e.to);
    if (!incoming.has(e.to)) incoming.set(e.to, []);
    incoming.get(e.to)!.push(e.from);
  }

  // Longest path layering
  const layer = new Map<string, number>();
  const visited = new Set<string>();

  function dfs(id: string): number {
    if (layer.has(id)) return layer.get(id)!;
    if (visited.has(id)) return 0; // cycle guard
    visited.add(id);
    let maxParentLayer = -1;
    for (const parent of incoming.get(id) ?? []) {
      maxParentLayer = Math.max(maxParentLayer, dfs(parent));
    }
    const l = maxParentLayer + 1;
    layer.set(id, l);
    return l;
  }

  for (const n of nodes) dfs(n.id);

  // Group by layer
  const layers = new Map<number, string[]>();
  let maxLayer = 0;
  for (const [id, l] of layer) {
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l)!.push(id);
    maxLayer = Math.max(maxLayer, l);
  }

  const paddingX = 60;
  const paddingY = 60;
  const usableW = width - paddingX * 2;
  const usableH = height - paddingY * 2;
  const layerSpacing = maxLayer > 0 ? usableW / maxLayer : 0;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Horizontal layers (left to right), vertical position within layer
  for (let l = 0; l <= maxLayer; l++) {
    const ids = layers.get(l) ?? [];
    const count = ids.length;
    const spacing = count > 1 ? usableH / (count - 1) : 0;
    ids.forEach((id, i) => {
      const node = nodeMap.get(id)!;
      const r = nodeRadius(node.callCount, maxCalls);
      positions.set(id, {
        x: paddingX + l * layerSpacing,
        y: paddingY + (count > 1 ? i * spacing : usableH / 2),
        radius: r,
      });
    });
  }

  return positions;
}

function computeFlameLayout(
  data: CallGraphData,
  width: number,
  height: number,
  _maxCalls: number,
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  const nodes = data.nodes;
  const edges = data.edges;
  if (nodes.length === 0) return positions;

  // Flame graph: x = order of appearance, y = call depth
  // Build parent->children tree
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of edges) {
    if (!childrenOf.has(e.from)) childrenOf.set(e.from, []);
    childrenOf.get(e.from)!.push(e.to);
    hasParent.add(e.to);
  }

  const roots = nodes.filter((n) => !hasParent.has(n.id));
  if (roots.length === 0) roots.push(nodes[0]);

  const paddingX = 40;
  const paddingY = 40;
  const usableW = width - paddingX * 2;
  const usableH = height - paddingY * 2;

  // Flame: each node gets a horizontal span based on callCount weight
  // Depth goes downward (y increases with depth)
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const placed = new Set<string>();

  // Compute subtree weight for proportional widths
  function subtreeWeight(id: string, visited: Set<string>): number {
    if (visited.has(id)) return 0;
    visited.add(id);
    const node = nodeMap.get(id);
    let w = node ? Math.max(node.callCount, 1) : 1;
    for (const child of childrenOf.get(id) ?? []) {
      w += subtreeWeight(child, visited);
    }
    return w;
  }

  const totalWeight = roots.reduce((acc, r) => acc + subtreeWeight(r.id, new Set()), 0);
  const rowHeight = 28;

  function placeNode(id: string, depth: number, xStart: number, xEnd: number): void {
    if (placed.has(id)) return;
    placed.add(id);

    const r = Math.max(4, Math.min(14, (xEnd - xStart) / 3));
    positions.set(id, {
      x: (xStart + xEnd) / 2,
      y: paddingY + depth * rowHeight + rowHeight / 2,
      radius: r,
    });

    const children = childrenOf.get(id) ?? [];
    if (children.length === 0) return;

    // Distribute children proportionally
    const childWeights = children.map((c) => subtreeWeight(c, new Set()));
    const totalCW = childWeights.reduce((a, b) => a + b, 0);
    let cx = xStart;
    children.forEach((child, i) => {
      const share = totalCW > 0 ? childWeights[i] / totalCW : 1 / children.length;
      const cEnd = cx + (xEnd - xStart) * share;
      placeNode(child, depth + 1, cx, cEnd);
      cx = cEnd;
    });
  }

  let xCursor = paddingX;
  for (const root of roots) {
    const w = subtreeWeight(root.id, new Set());
    const share = totalWeight > 0 ? w / totalWeight : 1 / roots.length;
    const xEnd = xCursor + usableW * share;
    placeNode(root.id, 0, xCursor, xEnd);
    xCursor = xEnd;
  }

  // Place any orphan nodes not yet positioned
  let orphanIdx = 0;
  for (const n of nodes) {
    if (!positions.has(n.id)) {
      positions.set(n.id, {
        x: paddingX + (orphanIdx * 40) % usableW,
        y: usableH + paddingY - 20,
        radius: 6,
      });
      orphanIdx++;
    }
  }

  return positions;
}

function computeLayout(
  layout: GraphLayout,
  data: CallGraphData,
  width: number,
  height: number,
): Map<string, NodePosition> {
  const maxCalls = data.nodes.reduce((m, n) => Math.max(m, n.callCount), 0);
  switch (layout) {
    case "tree":
      return computeTreeLayout(data, width, height, maxCalls);
    case "force":
      return computeForceLayout(data, width, height, maxCalls);
    case "hierarchical":
      return computeHierarchicalLayout(data, width, height, maxCalls);
    case "flame":
      return computeFlameLayout(data, width, height, maxCalls);
  }
}

// ─── Canvas renderer ───

function drawGraph(
  ctx: CanvasRenderingContext2D,
  data: CallGraphData,
  positions: Map<string, NodePosition>,
  selectedId: string | null,
  moduleIndex: Map<string, number>,
  panX: number,
  panY: number,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  const maxCount = data.edges.reduce((m, e) => Math.max(m, e.count), 0);

  // Draw edges
  for (const edge of data.edges) {
    const fromPos = positions.get(edge.from);
    const toPos = positions.get(edge.to);
    if (!fromPos || !toPos) continue;

    const w = edgeWidth(edge.count, maxCount);
    ctx.beginPath();
    ctx.moveTo(fromPos.x, fromPos.y);
    ctx.lineTo(toPos.x, toPos.y);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    ctx.lineWidth = w;
    ctx.stroke();

    // Arrow head
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) continue;

    const ux = dx / dist;
    const uy = dy / dist;
    const arrowLen = Math.min(10, dist * 0.2);
    const arrowTipX = toPos.x - ux * toPos.radius;
    const arrowTipY = toPos.y - uy * toPos.radius;

    ctx.beginPath();
    ctx.moveTo(arrowTipX, arrowTipY);
    ctx.lineTo(
      arrowTipX - ux * arrowLen - uy * arrowLen * 0.35,
      arrowTipY - uy * arrowLen + ux * arrowLen * 0.35,
    );
    ctx.lineTo(
      arrowTipX - ux * arrowLen + uy * arrowLen * 0.35,
      arrowTipY - uy * arrowLen - ux * arrowLen * 0.35,
    );
    ctx.closePath();
    ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
    ctx.fill();
  }

  // Draw nodes
  const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
  for (const [id, pos] of positions) {
    const node = nodeMap.get(id);
    if (!node) continue;

    const isSelected = id === selectedId;
    const color = getModuleColor(node.module, moduleIndex);

    // Glow for selected
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pos.radius + 4, 0, Math.PI * 2);
      ctx.fillStyle = color + "40";
      ctx.fill();
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, pos.radius, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? color : color + "cc";
    ctx.fill();

    // Border
    ctx.strokeStyle = isSelected ? "#ffffff" : color;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();

    // Label
    const label = node.symbol
      ? node.symbol.length > 16
        ? node.symbol.slice(0, 14) + ".."
        : node.symbol
      : node.address.slice(-8);

    ctx.font = `${Math.max(9, Math.min(11, pos.radius * 0.8))}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
    ctx.fillText(label, pos.x, pos.y + pos.radius + 4);
  }

  ctx.restore();
}

// ─── Canvas component ───

function CallGraphCanvas(props: { data: CallGraphData; layout: GraphLayout }) {
  let canvasRef!: HTMLCanvasElement;
  let containerRef!: HTMLDivElement;

  const [panX, setPanX] = createSignal(0);
  const [panY, setPanY] = createSignal(0);
  const [zoom, setZoom] = createSignal(1);
  const [isDragging, setIsDragging] = createSignal(false);
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });
  const [panStart, setPanStart] = createSignal({ x: 0, y: 0 });

  const moduleIndex = new Map<string, number>();

  function getCanvasSize(): { width: number; height: number } {
    if (!containerRef) return { width: 800, height: 600 };
    return { width: containerRef.clientWidth, height: containerRef.clientHeight };
  }

  function redraw(): void {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    const { width, height } = getCanvasSize();
    const dpr = window.devicePixelRatio || 1;
    canvasRef.width = width * dpr;
    canvasRef.height = height * dpr;
    canvasRef.style.width = `${width}px`;
    canvasRef.style.height = `${height}px`;

    const positions = computeLayout(props.layout, props.data, width, height);
    const selected = selectedGraphNode();

    drawGraph(
      ctx,
      props.data,
      positions,
      selected?.id ?? null,
      moduleIndex,
      panX(),
      panY(),
      zoom(),
      width,
      height,
    );
  }

  // Handle click on node
  function handleCanvasClick(e: MouseEvent): void {
    if (!canvasRef) return;
    const rect = canvasRef.getBoundingClientRect();
    const mx = (e.clientX - rect.left - panX()) / zoom();
    const my = (e.clientY - rect.top - panY()) / zoom();

    const { width, height } = getCanvasSize();
    const positions = computeLayout(props.layout, props.data, width, height);

    let clickedId: string | null = null;
    for (const [id, pos] of positions) {
      const dx = mx - pos.x;
      const dy = my - pos.y;
      if (dx * dx + dy * dy <= (pos.radius + 4) * (pos.radius + 4)) {
        clickedId = id;
        break;
      }
    }

    const currentSelected = selectedGraphNode();
    if (clickedId) {
      selectGraphNode(currentSelected?.id === clickedId ? null : clickedId);
    } else {
      selectGraphNode(null);
    }
  }

  function handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setPanStart({ x: panX(), y: panY() });
  }

  function handleMouseMove(e: MouseEvent): void {
    if (!isDragging()) return;
    const dx = e.clientX - dragStart().x;
    const dy = e.clientY - dragStart().y;
    setPanX(panStart().x + dx);
    setPanY(panStart().y + dy);
  }

  function handleMouseUp(e: MouseEvent): void {
    if (isDragging()) {
      const dx = Math.abs(e.clientX - dragStart().x);
      const dy = Math.abs(e.clientY - dragStart().y);
      setIsDragging(false);
      // Only trigger click if it wasn't a drag
      if (dx < 4 && dy < 4) {
        handleCanvasClick(e);
      }
    }
  }

  function handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = canvasRef.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.1, Math.min(5, zoom() * factor));

    // Zoom toward mouse position
    const ratio = newZoom / zoom();
    setPanX(mx - ratio * (mx - panX()));
    setPanY(my - ratio * (my - panY()));
    setZoom(newZoom);
  }

  function resetView(): void {
    setPanX(0);
    setPanY(0);
    setZoom(1);
  }

  // Redraw on data/layout/selection/pan/zoom changes
  createEffect(() => {
    // Track reactive dependencies
    props.data;
    props.layout;
    selectedGraphNode();
    panX();
    panY();
    zoom();
    redraw();
  });

  // Resize observer
  onMount(() => {
    const observer = new ResizeObserver(() => redraw());
    observer.observe(containerRef);
    onCleanup(() => observer.disconnect());
  });

  // Reset pan/zoom when layout changes
  createEffect(() => {
    props.layout;
    resetView();
  });

  return (
    <div ref={containerRef!} class="relative h-full w-full">
      <canvas
        ref={canvasRef!}
        class="h-full w-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setIsDragging(false)}
        onWheel={handleWheel}
      />
      {/* Zoom controls overlay */}
      <div class="absolute bottom-3 right-3 flex items-center gap-1 rounded border bg-surface/80 px-1 py-0.5 text-xs backdrop-blur-sm">
        <button
          class="cursor-pointer rounded px-1.5 py-0.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          onClick={() => {
            const newZoom = Math.min(5, zoom() * 1.2);
            setZoom(newZoom);
          }}
        >
          +
        </button>
        <span class="w-10 text-center text-muted-foreground">{Math.round(zoom() * 100)}%</span>
        <button
          class="cursor-pointer rounded px-1.5 py-0.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          onClick={() => {
            const newZoom = Math.max(0.1, zoom() / 1.2);
            setZoom(newZoom);
          }}
        >
          -
        </button>
        <div class="mx-0.5 h-3 w-px bg-border" />
        <button
          class="cursor-pointer rounded px-1.5 py-0.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          onClick={resetView}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ─── Node list table view ───

function NodeListView(props: { data: CallGraphData }) {
  return (
    <div class="h-full overflow-auto">
      <div class="sticky top-0 flex items-center border-b bg-surface px-3 py-1 text-[10px] font-medium uppercase text-muted-foreground">
        <span class="w-32 shrink-0">Address</span>
        <span class="w-32 shrink-0">Module</span>
        <span class="min-w-0 flex-1">Symbol</span>
        <span class="w-16 shrink-0 text-right">Calls</span>
        <span class="w-20 shrink-0" />
      </div>
      <For each={props.data.nodes}>
        {(node) => {
          const isSelected = () => selectedGraphNode()?.id === node.id;
          return (
            <div
              class={cn(
                "group/row flex w-full items-center px-3 py-1 text-left text-xs transition-colors hover:bg-surface-hover",
                isSelected() && "bg-muted",
              )}
              onClick={() => selectGraphNode(isSelected() ? null : node.id)}
            >
              <span class="flex w-32 shrink-0 items-center gap-1 truncate font-mono text-muted-foreground">
                <ActionPopover
                  type="address"
                  value={formatAddress(node.address)}
                  actions={buildAddressActions(node.address, node.module ?? undefined)}
                >
                  {formatAddress(node.address)}
                </ActionPopover>
                <CopyButton value={node.address} />
              </span>
              <span class="w-32 shrink-0 truncate">
                <Show
                  when={node.module}
                  fallback={<span class="text-muted-foreground">{"\u2014"}</span>}
                >
                  <ActionPopover
                    type="module"
                    value={node.module!}
                    actions={buildModuleActions(node.module!)}
                  >
                    <span class="text-primary">{node.module}</span>
                  </ActionPopover>
                </Show>
              </span>
              <span class="min-w-0 flex-1 truncate font-mono">{node.symbol ?? "\u2014"}</span>
              <span class="w-16 shrink-0 text-right text-muted-foreground">{node.callCount}</span>
              <span class="w-20 shrink-0 flex justify-end">
              <InlineActions
                primary={[
                  {
                    label: "Hook",
                    variant: "primary",
                    onClick: (e) => {
                      e.stopPropagation();
                      navigateTo({ tab: "native", context: { address: node.address, action: "hook" } });
                    },
                  },
                ]}
                overflow={[
                  {
                    label: "Copy Address",
                    onClick: () => navigator.clipboard.writeText(node.address),
                  },
                  ...(node.symbol
                    ? [
                        {
                          label: "Copy Symbol",
                          onClick: () => navigator.clipboard.writeText(node.symbol!),
                        },
                      ]
                    : []),
                  {
                    label: "View in Memory",
                    separator: true,
                    onClick: () =>
                      navigateTo({ tab: "memory", context: { address: node.address, action: "hexview" } }),
                  },
                  ...(node.module
                    ? [
                        {
                          label: "View Module",
                          onClick: () =>
                            navigateTo({ tab: "modules", context: { moduleName: node.module } }),
                        },
                      ]
                    : []),
                ]}
              />
              </span>
            </div>
          );
        }}
      </For>
    </div>
  );
}

// ─── Main tab component ───

function CallGraphTab() {
  const data = filteredGraphData;
  const [viewMode, setViewMode] = createSignal<ViewMode>("canvas");

  createEffect(() => {
    const session = activeSession();
    if (!session) return;
    const cleanup = setupCallGraphListener(session.id);
    onCleanup(cleanup);
  });

  return (
    <div class="flex h-full flex-col">
      {/* Header */}
      <div class="flex items-center justify-between border-b px-4 py-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">Call Graph</span>
          <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {data().nodes.length} nodes / {data().edges.length} edges
          </span>
        </div>
        <div class="flex items-center gap-2">
          {/* View mode toggle */}
          <div class="flex items-center gap-1 border-r pr-2">
            <button
              class={cn(
                "cursor-pointer rounded px-2 py-0.5 text-xs transition-colors",
                viewMode() === "canvas"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setViewMode("canvas")}
            >
              Canvas
            </button>
            <button
              class={cn(
                "cursor-pointer rounded px-2 py-0.5 text-xs transition-colors",
                viewMode() === "list"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
          </div>
          {/* Layout selector (only visible in canvas mode) */}
          <Show when={viewMode() === "canvas"}>
            <div class="flex items-center gap-1">
              {LAYOUTS.map((l) => (
                <button
                  class={cn(
                    "cursor-pointer rounded px-2 py-0.5 text-xs transition-colors",
                    graphLayout() === l.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setGraphLayout(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </Show>
          <button
            class="cursor-pointer rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            onClick={clearGraph}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Content area */}
      <div class="flex-1 overflow-hidden">
        <Show
          when={data().nodes.length > 0}
          fallback={
            <div class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <div class="text-sm font-medium">No call graph data</div>
              <p class="max-w-xs text-center text-xs">
                Start Stalker tracing on a thread from the Native tab to capture call data. The
                graph will be built automatically from captured events.
              </p>
              <div class="mt-2 rounded border border-dashed px-4 py-2 text-xs">
                Native tab &rarr; Stalker &rarr; Select thread &rarr; Start
              </div>
            </div>
          }
        >
          <Show when={viewMode() === "canvas"} fallback={<NodeListView data={data()} />}>
            <CallGraphCanvas data={data()} layout={graphLayout()} />
          </Show>
        </Show>
      </div>

      {/* Selected node details */}
      <Show when={selectedGraphNode()}>
        {(node) => (
          <div class="border-t px-4 py-2 text-xs">
            <div class="flex items-center gap-4">
              <span class="flex items-center gap-1">
                <span class="text-muted-foreground">Module: </span>
                <Show
                  when={node().module}
                  fallback={<span>unknown</span>}
                >
                  <ActionPopover
                    type="module"
                    value={node().module!}
                    actions={buildModuleActions(node().module!)}
                  >
                    {node().module}
                  </ActionPopover>
                </Show>
              </span>
              <span class="flex items-center gap-1">
                <span class="text-muted-foreground">Symbol: </span>
                <ActionPopover
                  type="address"
                  value={formatAddress(node().address)}
                  actions={buildAddressActions(node().address, node().module ?? undefined)}
                >
                  <span class="font-mono">{node().symbol ?? formatAddress(node().address)}</span>
                </ActionPopover>
                <CopyButton value={node().address} />
              </span>
              <span>
                <span class="text-muted-foreground">Calls: </span>
                {node().callCount}
              </span>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}

export default CallGraphTab;
