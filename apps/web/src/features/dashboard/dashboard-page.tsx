"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import type { LayoutItem, WidgetType } from "@artist/shared";
import { widgetRegistry } from "@/features/widgets/registry";
import { WidgetFrame } from "@/features/widgets/widget-frame";
import { DashboardGrid } from "./dashboard-grid";
import { useLayout, useSaveLayout } from "./use-layout";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const SAVE_DEBOUNCE_MS = 800;

export function DashboardPage({ boardId }: { boardId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const layoutQuery = useLayout(boardId);
  const saveLayout = useSaveLayout(boardId);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const openWidgetType = searchParams.get("w") as WidgetType | null;
  const openDef = openWidgetType ? widgetRegistry[openWidgetType] : undefined;

  /** Applies a layout immediately (optimistic cache write) and debounces the save. */
  const persist = (next: LayoutItem[], immediate = false) => {
    queryClient.setQueryData(["layout", boardId], { layout: next });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (immediate) {
      saveLayout.mutate(next);
    } else {
      debounceRef.current = setTimeout(
        () => saveLayout.mutate(next),
        SAVE_DEBOUNCE_MS,
      );
    }
  };

  const toggleHidden = (widgetType: WidgetType) => {
    const layout = layoutQuery.data?.layout ?? [];
    persist(
      layout.map((item) =>
        item.widgetType === widgetType
          ? { ...item, hidden: !item.hidden }
          : item,
      ),
      true,
    );
  };

  const openWidget = (type: WidgetType) => {
    const params = new URLSearchParams(searchParams);
    params.set("w", type);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const closeWidget = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("w");
    router.push(params.size ? `?${params.toString()}` : "?", { scroll: false });
  };

  if (layoutQuery.isPending || !layoutQuery.data) {
    return <Skeleton className="m-4 h-64" />;
  }

  const layout = layoutQuery.data.layout;
  const knownItems = layout.filter((item) => widgetRegistry[item.widgetType]);
  const visibleLayout = knownItems.filter((item) => !item.hidden);
  const hiddenItems = knownItems.filter((item) => item.hidden);

  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      {hiddenItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Hidden:</span>
          {hiddenItems.map((item) => {
            const def = widgetRegistry[item.widgetType];
            if (!def) return null;
            return (
              <Badge key={item.widgetType} variant="secondary" className="gap-1.5">
                {def.title}
                <button
                  type="button"
                  aria-label={`Show ${def.title}`}
                  onClick={() => toggleHidden(item.widgetType)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Eye className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      <DashboardGrid
        layout={visibleLayout}
        editable
        onLayoutChange={(next) => persist(mergeHidden(layout, next))}
        renderItem={(item) => {
          const def = widgetRegistry[item.widgetType];
          if (!def) return null;
          const Collapsed = def.Collapsed;
          return (
            <WidgetFrame
              title={def.title}
              icon={def.icon}
              editable
              hidden={item.hidden}
              onToggleHidden={() => toggleHidden(item.widgetType)}
              onExpand={() => openWidget(item.widgetType)}
            >
              <Collapsed boardId={boardId} />
            </WidgetFrame>
          );
        }}
      />

      <Dialog open={!!openDef} onOpenChange={(open) => !open && closeWidget()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          {openDef && (
            <>
              <DialogHeader>
                <DialogTitle>{openDef.title}</DialogTitle>
              </DialogHeader>
              <openDef.Expanded boardId={boardId} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** DashboardGrid only reports visible items — carry hidden ones through untouched. */
function mergeHidden(full: LayoutItem[], visible: LayoutItem[]): LayoutItem[] {
  const byType = new Map(visible.map((item) => [item.widgetType, item]));
  return full.map((item) => byType.get(item.widgetType) ?? item);
}
