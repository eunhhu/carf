import { type JSX, createSignal, onMount, onCleanup, createEffect } from "solid-js";

interface SplitPaneProps {
  id: string;
  left: JSX.Element;
  right: JSX.Element;
  minLeft?: number;
  maxLeft?: number;
  defaultLeft?: number;
}

export function SplitPane(props: SplitPaneProps) {
  const minL = () => props.minLeft ?? 200;
  const maxL = () => props.maxLeft ?? 400;
  const defL = () => props.defaultLeft ?? 280;

  const stored = localStorage.getItem(`carf:split:${props.id}`);
  const [leftWidth, setLeftWidth] = createSignal(
    stored ? Number(stored) : defL(),
  );
  const [dragging, setDragging] = createSignal(false);
  const [collapsed, setCollapsed] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  createEffect(() => {
    localStorage.setItem(`carf:split:${props.id}`, String(leftWidth()));
  });

  function onPointerDown(e: PointerEvent) {
    e.preventDefault();
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging() || !containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clamped = Math.max(minL(), Math.min(maxL(), x));
    setLeftWidth(clamped);
    if (collapsed()) setCollapsed(false);
  }

  function onPointerUp() {
    setDragging(false);
  }

  function onDoubleClick() {
    setCollapsed((v) => !v);
  }

  // Keyboard: Escape during drag cancels
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && dragging()) {
      setDragging(false);
      const stored = localStorage.getItem(`carf:split:${props.id}`);
      if (stored) setLeftWidth(Number(stored));
    }
  }

  onMount(() => {
    document.addEventListener("keydown", onKeyDown);
    onCleanup(() => document.removeEventListener("keydown", onKeyDown));
  });

  return (
    <div ref={containerRef} class="flex h-full overflow-hidden">
      <div
        class="shrink-0 overflow-auto"
        style={{
          width: collapsed() ? "0px" : `${leftWidth()}px`,
          "min-width": collapsed() ? "0px" : `${minL()}px`,
          transition: dragging() ? "none" : "width 200ms ease",
        }}
      >
        {props.left}
      </div>

      {/* Drag handle */}
      <div
        class="group relative z-10 flex w-1 shrink-0 cursor-col-resize items-center justify-center hover:bg-primary/20"
        classList={{ "bg-primary/30": dragging() }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDblClick={onDoubleClick}
        title="Drag to resize, double-click to toggle"
      >
        <div class="h-8 w-0.5 rounded-full bg-border transition-colors group-hover:bg-primary/50" />
      </div>

      <div class="min-w-0 flex-1 overflow-auto">{props.right}</div>
    </div>
  );
}
