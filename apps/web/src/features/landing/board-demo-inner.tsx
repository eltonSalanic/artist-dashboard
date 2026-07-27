"use client";

import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import { getCompactor, Responsive, useContainerWidth } from "react-grid-layout";
import type { Layout } from "react-grid-layout";
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

export function BoardDemoInner() {
  const { width, containerRef, mounted } = useContainerWidth();
  const { resizing, onResizeStart, onResizeStop } = useGridResizeGuard();
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

  const handleChange = (next: Layout) => {
    setBoxes((prev) => {
      const merged = { ...prev };
      for (const { i, x, y, w, h } of next) merged[i] = { x, y, w, h };
      return merged;
    });
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
            cols={{ lg: 4 }}
            width={width}
            rowHeight={88}
            maxRows={4}
            margin={[12, 12]}
            containerPadding={[0, 0]}
            compactor={FREE_COMPACTOR}
            dragConfig={{ enabled: true, bounded: true, cancel: ".no-drag" }}
            resizeConfig={{ enabled: true }}
            onResizeStart={onResizeStart}
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
