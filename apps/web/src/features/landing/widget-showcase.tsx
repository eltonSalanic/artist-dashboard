"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  CheckCircle2,
  MousePointer2,
  Target,
} from "lucide-react";
import { FauxRow, MiniWidget } from "@/features/landing/mini-widget";
import { SectionHeading } from "@/features/landing/section-heading";
import { cn } from "@/lib/utils";

/* ── The grid the demo animates on ─────────────────────────────────────────
   A 4×4 coordinate space. Each layout places every widget in whole cells with
   no gaps or overlaps, so the grid always reads as a full, tidy bento — the
   move between layouts is what sells the "drag to rearrange, pull to resize"
   story the section is about. Positions are emitted as CSS calc() so the whole
   thing scales to its container and the browser tweens left/top/width/height. */

const COLS = 4;
const ROWS = 4;
const GAP = "10px";

type Box = { x: number; y: number; w: number; h: number };

type WidgetDef = {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  color: "c1" | "c2" | "c3" | "c4";
  rows: ("full" | "long" | "mid" | "short")[];
};

const WIDGETS: WidgetDef[] = [
  {
    id: "tasks",
    title: "My Tasks",
    icon: CheckCircle2,
    color: "c1",
    rows: ["long", "mid", "full", "short"],
  },
  {
    id: "shows",
    title: "Shows",
    icon: CalendarDays,
    color: "c2",
    rows: ["mid", "short"],
  },
  {
    id: "goals",
    title: "Goals",
    icon: Target,
    color: "c3",
    rows: ["long", "mid"],
  },
  {
    id: "activity",
    title: "Activity",
    icon: Activity,
    color: "c4",
    rows: ["full", "long", "mid"],
  },
  {
    id: "reminders",
    title: "Reminders",
    icon: Bell,
    color: "c2",
    rows: ["mid", "short"],
  },
];

const LAYOUTS: Record<string, Box>[] = [
  {
    tasks: { x: 0, y: 0, w: 2, h: 2 },
    shows: { x: 2, y: 0, w: 2, h: 1 },
    goals: { x: 2, y: 1, w: 2, h: 1 },
    activity: { x: 0, y: 2, w: 2, h: 2 },
    reminders: { x: 2, y: 2, w: 2, h: 2 },
  },
  {
    tasks: { x: 0, y: 0, w: 2, h: 1 },
    goals: { x: 2, y: 0, w: 2, h: 2 },
    shows: { x: 0, y: 1, w: 2, h: 1 },
    activity: { x: 0, y: 2, w: 4, h: 1 },
    reminders: { x: 0, y: 3, w: 4, h: 1 },
  },
  {
    reminders: { x: 0, y: 0, w: 1, h: 2 },
    tasks: { x: 1, y: 0, w: 3, h: 2 },
    shows: { x: 0, y: 2, w: 2, h: 2 },
    goals: { x: 2, y: 2, w: 1, h: 2 },
    activity: { x: 3, y: 2, w: 1, h: 2 },
  },
];

/** Which widget the ghost cursor is "holding" in each layout. */
const HELD = ["reminders", "activity", "tasks"];

// Raw calc() sub-expressions for a track of `n` cells; composed into the four
// box edges and, for the cursor, the widget's bottom-right corner.
const offset = (n: number, i: number) =>
  `((100% - ${n - 1} * ${GAP}) / ${n}) * ${i} + ${GAP} * ${i}`;
const span = (n: number, s: number) =>
  `((100% - ${n - 1} * ${GAP}) / ${n}) * ${s} + ${GAP} * (${s} - 1)`;

function boxStyle(box: Box): React.CSSProperties {
  return {
    left: `calc(${offset(COLS, box.x)})`,
    top: `calc(${offset(ROWS, box.y)})`,
    width: `calc(${span(COLS, box.w)})`,
    height: `calc(${span(ROWS, box.h)})`,
  };
}

function cornerStyle(box: Box): React.CSSProperties {
  return {
    left: `calc(${offset(COLS, box.x)} + ${span(COLS, box.w)})`,
    top: `calc(${offset(ROWS, box.y)} + ${span(ROWS, box.h)})`,
  };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function WidgetShowcase() {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(
      () => setPhase((p) => (p + 1) % LAYOUTS.length),
      3200,
    );
    return () => clearInterval(id);
  }, [reduced]);

  const layout = LAYOUTS[phase];
  const heldId = HELD[phase];
  const heldBox = layout[heldId];

  return (
    <section id="demo" className="px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Make it yours"
          title="Your dashboard, arranged your way."
          lede="Drag a widget to move it, pull a corner to resize. Every member keeps their own layout — the same board, seen the way each person works."
          align="center"
          className="mx-auto"
        />

        <div className="mx-auto mt-12 max-w-4xl">
          <div className="rounded-[32px] border border-foreground/10 bg-card/40 p-3 shadow-[0_1px_2px_rgba(20,16,10,0.04)] sm:p-4">
            {/* Faux window chrome, so the grid reads as an app surface. */}
            <div className="flex items-center gap-2 px-3 pt-1 pb-3">
              <span className="size-2.5 rounded-full bg-coral/70" />
              <span className="size-2.5 rounded-full bg-lilac/70" />
              <span className="size-2.5 rounded-full bg-lime/70" />
              <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-0.5 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full bg-coral",
                    !reduced && "animate-pulse",
                  )}
                />
                {reduced ? "Editing layout" : "Arranging…"}
              </span>
            </div>

            <div
              data-palette="playful"
              className="relative h-[440px] w-full sm:h-[500px]"
            >
              {WIDGETS.map((widget) => {
                const box = layout[widget.id];
                const held = widget.id === heldId;
                return (
                  <div
                    key={widget.id}
                    style={boxStyle(box)}
                    className={cn(
                      "absolute transition-[left,top,width,height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[left,top,width,height]",
                      held ? "z-20" : "z-0",
                    )}
                  >
                    <div
                      className={cn(
                        "relative h-full transition-[transform,box-shadow] duration-500",
                        held &&
                          !reduced &&
                          "scale-[1.02] rounded-2xl shadow-[0_18px_40px_-12px_rgba(20,16,10,0.35)] outline-2 outline-offset-2 outline-primary/40",
                      )}
                    >
                      <MiniWidget
                        title={widget.title}
                        icon={widget.icon}
                        color={widget.color}
                      >
                        {widget.rows.map((w, i) => (
                          <FauxRow
                            key={i}
                            width={w}
                            tone={i === 0 ? "solid" : "muted"}
                          />
                        ))}
                      </MiniWidget>
                      {/* Resize grip, bottom-right, like the real grid. */}
                      <span
                        aria-hidden
                        className="absolute right-1.5 bottom-1.5 size-2.5 rounded-[3px] border-r-2 border-b-2 border-current/40"
                      />
                    </div>
                  </div>
                );
              })}

              {/* The ghost cursor, parked on the held widget's resize corner. */}
              {!reduced && heldBox && (
                <div
                  aria-hidden
                  style={cornerStyle(heldBox)}
                  className="absolute z-30 -translate-x-1 -translate-y-1 transition-[left,top] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                >
                  <MousePointer2 className="size-5 fill-primary text-primary drop-shadow-[0_2px_3px_rgba(20,16,10,0.35)]" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
