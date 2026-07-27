"use client";

import { useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import { getCompactor, Responsive, useContainerWidth } from "react-grid-layout";
import type { Layout, LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  CalendarDays,
  CheckCircle2,
  EyeOff,
  Plus,
  RotateCcw,
  Target,
} from "lucide-react";
import { FauxRow, MiniWidget } from "@/features/landing/mini-widget";
import { Button } from "@/components/ui/button";
import { useGridResizeGuard } from "@/lib/use-grid-resize-guard";
import { cn } from "@/lib/utils";

type Box = { x: number; y: number; w: number; h: number };

const COLS = 4;
const MAX_ROWS = 4;

type WidgetMeta = {
  i: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  color: "c1" | "c2" | "c3";
  rows: ("full" | "long" | "mid" | "short")[];
};

// Three widgets, each 2×2, on a 4×4 board — one 2×2 cell left open, so there's
// always somewhere to drag to.
const WIDGETS: WidgetMeta[] = [
  {
    i: "tasks",
    title: "My Tasks",
    icon: CheckCircle2,
    color: "c1",
    rows: ["long", "mid", "full"],
  },
  {
    i: "shows",
    title: "Shows",
    icon: CalendarDays,
    color: "c2",
    rows: ["mid", "short"],
  },
  {
    i: "goals",
    title: "Goals",
    icon: Target,
    color: "c3",
    rows: ["long", "mid"],
  },
];

const INITIAL: Record<string, Box> = {
  tasks: { x: 0, y: 0, w: 2, h: 2 },
  shows: { x: 2, y: 0, w: 2, h: 2 },
  goals: { x: 0, y: 2, w: 2, h: 2 },
};

// No vertical gravity: widgets stay where they're dropped (they just can't
// overlap), so the 4×4 really behaves like a board you arrange freely.
const FREE_COMPACTOR = getCompactor(null, false, false);

const boxesSignature = (boxes: Record<string, Box>) =>
  Object.keys(boxes)
    .sort()
    .map((i) => `${i}:${boxes[i].x},${boxes[i].y},${boxes[i].w},${boxes[i].h}`)
    .join("|");

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// The open slot closest to where the widget already sits, so a bumped widget
// slides the shortest distance into free space instead of jumping across the
// board. Returns null when nothing fits inside the 4×4 bounds.
function nearestFreeSlot(
  box: Box,
  occupied: Box[],
): { x: number; y: number } | null {
  let best: { x: number; y: number; dist: number } | null = null;
  for (let y = 0; y <= MAX_ROWS - box.h; y++) {
    for (let x = 0; x <= COLS - box.w; x++) {
      const candidate = { ...box, x, y };
      if (occupied.some((o) => overlaps(candidate, o))) continue;
      const dist = Math.abs(x - box.x) + Math.abs(y - box.y);
      if (!best || dist < best.dist) best = { x, y, dist };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

// Dragging a widget pushes its neighbours aside, but resizing lets the grown
// widget sit *on top* of them (react-grid-layout only reflows on drag, and our
// free-form compactor never moves anything). So after a resize we do the
// pushing ourselves: keep the widget the user is dragging (`anchorId`) put and
// bump any widget it now covers into the nearest free slot. A widget that can't
// be relocated in bounds is left where it is rather than shoved off the board.
function resolveOverlaps(
  boxes: Record<string, Box>,
  anchorId: string | null,
): Record<string, Box> {
  const result = { ...boxes };
  const ids = Object.keys(result);
  for (let pass = 0; pass < ids.length; pass++) {
    let moved = false;
    for (const id of ids) {
      if (id === anchorId) continue;
      const others = ids.filter((o) => o !== id).map((o) => result[o]);
      if (!others.some((o) => overlaps(result[id], o))) continue;
      const slot = nearestFreeSlot(result[id], others);
      if (slot) {
        result[id] = { ...result[id], ...slot };
        moved = true;
      }
    }
    if (!moved) break;
  }
  return result;
}

// Slide widgets up to close any fully-empty row. With no vertical gravity, a
// drag can push a neighbour onto a fresh row and then strand that row empty
// once the dragged widget moves back up — the board keeps a phantom blank band.
// This pulls everything below a blank row up to close it. Only whole empty rows
// collapse; per-column horizontal gaps (the free-form arrangement) are kept.
function collapseEmptyRows(
  boxes: Record<string, Box>,
): Record<string, Box> {
  const items = Object.values(boxes);
  if (items.length === 0) return boxes;
  const maxBottom = Math.max(...items.map((b) => b.y + b.h));
  const emptyRows: number[] = [];
  for (let row = 0; row < maxBottom; row++) {
    if (!items.some((b) => b.y <= row && row < b.y + b.h)) emptyRows.push(row);
  }
  if (emptyRows.length === 0) return boxes;
  const result: Record<string, Box> = {};
  for (const [id, box] of Object.entries(boxes)) {
    const shift = emptyRows.filter((row) => row < box.y).length;
    result[id] = shift ? { ...box, y: box.y - shift } : box;
  }
  return result;
}

export function BoardDemoInner() {
  const { width, containerRef, mounted } = useContainerWidth();
  const { resizing, onResizeStart, onResizeStop } = useGridResizeGuard();
  // The widget currently under the resize handle — the one to hold still while
  // its neighbours flow around it. Set on resize start; a stale value between
  // gestures is harmless (drags never leave overlaps for the resolver to fix).
  const resizingIdRef = useRef<string | null>(null);
  const [boxes, setBoxes] = useState<Record<string, Box>>(INITIAL);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const visible = WIDGETS.filter((w) => !hidden[w.i]);
  const hiddenWidgets = WIDGETS.filter((w) => hidden[w.i]);

  const rglLayout = useMemo(
    () =>
      visible.map((w) => ({
        i: w.i,
        ...boxes[w.i],
        minW: 1,
        minH: 1,
        maxW: 4,
        maxH: 4,
      })),
    [visible, boxes],
  );

  const dirty =
    boxesSignature(boxes) !== boxesSignature(INITIAL) ||
    hiddenWidgets.length > 0;

  const handleResizeStart = (_layout: Layout, oldItem: LayoutItem | null) => {
    resizingIdRef.current = oldItem?.i ?? null;
    onResizeStart();
  };

  const handleChange = (next: Layout) => {
    const nextBoxes: Record<string, Box> = {};
    for (const { i, x, y, w, h } of next) nextBoxes[i] = { x, y, w, h };
    // Undo any overlap a resize just created, then close rows a drag left empty,
    // before committing the settled layout.
    const resolved = collapseEmptyRows(
      resolveOverlaps(nextBoxes, resizingIdRef.current),
    );
    setBoxes((prev) => ({ ...prev, ...resolved }));
  };

  const reset = () => {
    setBoxes(INITIAL);
    setHidden({});
  };

  return (
    <div className="rounded-[32px] border border-foreground/10 bg-card/40 p-3 shadow-[0_1px_2px_rgba(20,16,10,0.04)] sm:p-4">
      {/* Faux window chrome + reset. */}
      <div className="flex items-center gap-2 px-3 pt-1 pb-3">
        <span className="size-2.5 rounded-full bg-coral/70" />
        <span className="size-2.5 rounded-full bg-lilac/70" />
        <span className="size-2.5 rounded-full bg-lime/70" />
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          disabled={!dirty}
          className="ml-auto h-6 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <RotateCcw data-icon="inline-start" />
          Reset
        </Button>
      </div>

      <div
        ref={containerRef}
        data-palette="playful"
        className={cn(
          "landing-board resizable-grid [&_.react-grid-item.react-draggable-dragging]:cursor-grabbing",
          resizing && "select-none",
        )}
      >
        {mounted && width > 0 && (
          <Responsive
            layouts={{ lg: rglLayout }}
            breakpoints={{ lg: 0 }}
            cols={{ lg: COLS }}
            width={width}
            rowHeight={88}
            maxRows={MAX_ROWS}
            margin={[12, 12]}
            containerPadding={[0, 0]}
            compactor={FREE_COMPACTOR}
            dragConfig={{ enabled: true, bounded: true, cancel: ".no-drag" }}
            resizeConfig={{ enabled: true }}
            onResizeStart={handleResizeStart}
            onResizeStop={onResizeStop}
            onLayoutChange={handleChange}
          >
            {visible.map((widget) => (
              <div key={widget.i} className="group relative h-full cursor-grab">
                <MiniWidget
                  title={widget.title}
                  icon={widget.icon}
                  color={widget.color}
                >
                  {widget.rows.map((w, index) => (
                    <FauxRow
                      key={index}
                      width={w}
                      tone={index === 0 ? "solid" : "muted"}
                    />
                  ))}
                </MiniWidget>
                <button
                  type="button"
                  onClick={() =>
                    setHidden((prev) => ({ ...prev, [widget.i]: true }))
                  }
                  aria-label={`Hide ${widget.title}`}
                  className={cn(
                    "no-drag absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-full bg-background/70 text-foreground/70 opacity-0 backdrop-blur-sm transition hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
                  )}
                >
                  <EyeOff className="size-3.5" />
                </button>
              </div>
            ))}
          </Responsive>
        )}
      </div>

      {/* Tray for widgets you've hidden — click one to bring it back. */}
      {hiddenWidgets.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground">Hidden:</span>
          {hiddenWidgets.map((widget) => (
            <Button
              key={widget.i}
              variant="outline"
              size="sm"
              onClick={() =>
                setHidden((prev) => ({ ...prev, [widget.i]: false }))
              }
              className="h-7 rounded-full"
            >
              <widget.icon data-icon="inline-start" />
              {widget.title}
              <Plus data-icon="inline-end" />
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
