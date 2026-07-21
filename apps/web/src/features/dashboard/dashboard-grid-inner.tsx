"use client";

import { useMemo, type ReactNode } from "react";
import { Responsive, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { LayoutItem } from "@artist/shared";

export interface DashboardGridProps {
  layout: LayoutItem[];
  editable?: boolean;
  onLayoutChange: (layout: LayoutItem[]) => void;
  renderItem: (item: LayoutItem) => ReactNode;
}

export function DashboardGrid({
  layout,
  editable = false,
  onLayoutChange,
  renderItem,
}: DashboardGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();

  const rglLayout = useMemo(
    () =>
      layout.map((item) => ({
        i: item.widgetType,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      })),
    [layout],
  );

  const handleLayoutChange = (
    nextLayout: readonly { i: string; x: number; y: number; w: number; h: number }[],
  ) => {
    const byType = new Map(layout.map((item) => [item.widgetType, item]));
    onLayoutChange(
      nextLayout.map((pos) => {
        const original = byType.get(pos.i as LayoutItem["widgetType"]);
        return {
          widgetType: pos.i as LayoutItem["widgetType"],
          x: pos.x,
          y: pos.y,
          w: pos.w,
          h: pos.h,
          ...(original?.hidden ? { hidden: true as const } : {}),
        };
      }),
    );
  };

  return (
    <div ref={containerRef}>
      {mounted && width > 0 && (
        <Responsive
          layouts={{ lg: rglLayout }}
          breakpoints={{ lg: 0 }}
          cols={{ lg: 12 }}
          width={width}
          rowHeight={44}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          dragConfig={{ enabled: editable, handle: ".widget-drag-handle" }}
          resizeConfig={{ enabled: editable }}
          onLayoutChange={handleLayoutChange}
        >
          {layout.map((item) => (
            <div key={item.widgetType}>{renderItem(item)}</div>
          ))}
        </Responsive>
      )}
    </div>
  );
}
