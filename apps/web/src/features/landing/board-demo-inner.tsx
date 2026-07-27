"use client";

import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import { getCompactor, Responsive, useContainerWidth } from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { CalendarDays, CheckCircle2, RotateCcw, Target } from "lucide-react";
import { FauxRow, MiniWidget } from "@/features/landing/mini-widget";
import { Button } from "@/components/ui/button";

type Box = { i: string; x: number; y: number; w: number; h: number };

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

const INITIAL: Box[] = [
  { i: "tasks", x: 0, y: 0, w: 2, h: 2 },
  { i: "shows", x: 2, y: 0, w: 2, h: 2 },
  { i: "goals", x: 0, y: 2, w: 2, h: 2 },
];

// No vertical gravity: widgets stay where they're dropped (they just can't
// overlap), so the 4×4 really behaves like a board you arrange freely.
const FREE_COMPACTOR = getCompactor(null, false, false);

const signature = (boxes: Box[]) =>
  [...boxes]
    .sort((a, b) => a.i.localeCompare(b.i))
    .map((b) => `${b.i}:${b.x},${b.y},${b.w},${b.h}`)
    .join("|");

export function BoardDemoInner() {
  const { width, containerRef, mounted } = useContainerWidth();
  const [layout, setLayout] = useState<Box[]>(INITIAL);

  const moved = useMemo(
    () => signature(layout) !== signature(INITIAL),
    [layout],
  );

  const handleChange = (next: Layout) => {
    setLayout(next.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })));
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
          onClick={() => setLayout(INITIAL)}
          disabled={!moved}
          className="ml-auto h-6 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <RotateCcw data-icon="inline-start" />
          Reset
        </Button>
      </div>

      <div
        ref={containerRef}
        data-palette="playful"
        className="landing-board [&_.react-grid-item]:cursor-grab [&_.react-grid-item.react-draggable-dragging]:cursor-grabbing"
      >
        {mounted && width > 0 && (
          <Responsive
            layouts={{ lg: layout }}
            breakpoints={{ lg: 0 }}
            cols={{ lg: 4 }}
            width={width}
            rowHeight={88}
            maxRows={4}
            margin={[12, 12]}
            containerPadding={[0, 0]}
            compactor={FREE_COMPACTOR}
            dragConfig={{ enabled: true, bounded: true }}
            resizeConfig={{ enabled: false }}
            onLayoutChange={handleChange}
          >
            {WIDGETS.map((widget) => (
              <div key={widget.i} className="h-full">
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
              </div>
            ))}
          </Responsive>
        )}
      </div>
    </div>
  );
}
