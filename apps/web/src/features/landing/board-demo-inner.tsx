"use client";

import { useState, type ComponentType } from "react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { BellRing, Eye, Mic2, RotateCcw, Target, UserCheck } from "lucide-react";
import type { LayoutItem, WidgetColor, WidgetType } from "@artist/shared";
// The real grid, not a copy of it — dragging, resizing, vertical gravity and
// the drag-handle rules are whatever the dashboard does today. Imported from
// `-inner` because board-demo.tsx already mounts this file client-side only.
import {
  DashboardGrid,
  mergeHidden,
} from "@/features/dashboard/dashboard-grid-inner";
import { WidgetFrame } from "@/features/widgets/widget-frame";
import { FauxRow } from "@/features/landing/mini-widget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FauxWidth = "full" | "long" | "mid" | "short";

interface DemoWidget {
  title: string;
  icon: ComponentType<{ className?: string }>;
  color?: WidgetColor;
  rows: FauxWidth[];
}

/**
 * Titles, icons and palette slots mirror `widgetRegistry`, but they're restated
 * here on purpose: importing the real registry would drag every widget — and
 * TipTap behind them — into the marketing bundle, and not one of them can
 * render without a board to fetch from. The frame is real; only the contents
 * are scenery.
 */
const DEMO_WIDGETS: Partial<Record<WidgetType, DemoWidget>> = {
  MY_TASKS: {
    title: "My Tasks",
    icon: UserCheck,
    rows: ["long", "mid", "full", "short", "long", "mid", "full", "short", "mid"],
  },
  SHOWS: {
    title: "Shows",
    icon: Mic2,
    color: "c4",
    rows: ["mid", "short", "long", "mid", "short"],
  },
  GOALS: {
    title: "Goals",
    icon: Target,
    color: "c2",
    rows: ["long", "mid", "short", "mid"],
  },
  REMINDERS: {
    title: "Reminders",
    icon: BellRing,
    color: "c3",
    rows: ["mid", "long", "short", "full", "mid", "short", "long"],
  },
};

/**
 * Half the width of a real board, so each card takes six of the twelve columns
 * rather than the four it would on the dashboard. Same grid, same units.
 */
const DEMO_LAYOUT: LayoutItem[] = [
  { widgetType: "MY_TASKS", x: 0, y: 0, w: 6, h: 4 },
  { widgetType: "SHOWS", x: 6, y: 0, w: 6, h: 4 },
  { widgetType: "GOALS", x: 0, y: 4, w: 6, h: 4 },
  { widgetType: "REMINDERS", x: 6, y: 4, w: 6, h: 4 },
];

const signature = (layout: LayoutItem[]) =>
  layout
    .map((i) => `${i.widgetType}:${i.x},${i.y},${i.w},${i.h},${i.hidden ?? false}`)
    .join("|");

export function BoardDemoInner() {
  const [layout, setLayout] = useState<LayoutItem[]>(DEMO_LAYOUT);
  const [expanded, setExpanded] = useState<WidgetType | null>(null);

  const visible = layout.filter((item) => !item.hidden);
  const hiddenItems = layout.filter((item) => item.hidden);
  const dirty = signature(layout) !== signature(DEMO_LAYOUT);
  const expandedDef = expanded ? DEMO_WIDGETS[expanded] : undefined;

  const toggleHidden = (widgetType: WidgetType) =>
    setLayout((prev) =>
      prev.map((item) =>
        item.widgetType === widgetType
          ? { ...item, hidden: !item.hidden }
          : item,
      ),
    );

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
          onClick={() => setLayout(DEMO_LAYOUT)}
          disabled={!dirty}
          className="ml-auto h-6 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <RotateCcw data-icon="inline-start" />
          Reset layout
        </Button>
      </div>

      <div data-palette="playful" className="landing-board">
        <DashboardGrid
          layout={visible}
          editable
          onLayoutChange={(next) => setLayout(mergeHidden(layout, next))}
          renderItem={(item) => {
            const def = DEMO_WIDGETS[item.widgetType];
            if (!def) return null;
            return (
              <WidgetFrame
                title={def.title}
                icon={def.icon}
                color={def.color}
                editable
                hidden={item.hidden}
                onToggleHidden={() => toggleHidden(item.widgetType)}
                onExpand={() => setExpanded(item.widgetType)}
              >
                <FauxRows rows={def.rows} />
              </WidgetFrame>
            );
          }}
        />
      </div>

      {/* Hidden tray — same Badge + eye as the dashboard's own. */}
      {hiddenItems.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Hidden
          </span>
          {hiddenItems.map((item) => {
            const def = DEMO_WIDGETS[item.widgetType];
            if (!def) return null;
            return (
              <Badge
                key={item.widgetType}
                variant="secondary"
                className="gap-1.5 rounded-full py-1 pr-1"
              >
                {def.title}
                <button
                  type="button"
                  aria-label={`Show ${def.title}`}
                  onClick={() => toggleHidden(item.widgetType)}
                  className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                >
                  <Eye className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Expanding a widget opens a dialog on the real board too. */}
      <Dialog
        open={!!expandedDef}
        onOpenChange={(open) => !open && setExpanded(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          {expandedDef && (
            <>
              <DialogHeader>
                <DialogTitle>{expandedDef.title}</DialogTitle>
              </DialogHeader>
              <div data-palette="playful">
                <FauxRows rows={[...expandedDef.rows, ...expandedDef.rows]} />
              </div>
              <p className="text-sm text-muted-foreground">
                On your own board this is the full list — every row editable,
                filterable, and yours to reorder.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FauxRows({ rows }: { rows: FauxWidth[] }) {
  return (
    <>
      {rows.map((width, index) => (
        <FauxRow
          key={index}
          width={width}
          tone={index === 0 ? "solid" : "muted"}
        />
      ))}
    </>
  );
}
