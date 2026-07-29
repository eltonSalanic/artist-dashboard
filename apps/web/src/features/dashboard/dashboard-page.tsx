"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, RotateCcw } from "lucide-react";
import {
  resolveWidgetColor,
  type LayoutItem,
  type WidgetColor,
  type WidgetType,
} from "@artist/shared";
import { useMe } from "@/features/auth/use-me";
import { usePermissions } from "@/features/auth/permissions";
import {
  useBoardTheme,
  useSaveBoardTheme,
} from "@/features/appearance/use-board-theme";
import { WidgetColorMenu } from "@/features/appearance/widget-color-menu";
import { useEvents } from "@/features/planning/use-events";
import { widgetRegistry } from "@/features/widgets/registry";
import { WidgetFrame } from "@/features/widgets/widget-frame";
import { DashboardGrid } from "./dashboard-grid";
import { mergeHidden } from "./dashboard-grid-inner";
import { useLayout, useResetLayout, useSaveLayout } from "./use-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

const SAVE_DEBOUNCE_MS = 800;

export function DashboardPage({ boardId }: { boardId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const layoutQuery = useLayout(boardId);
  const saveLayout = useSaveLayout(boardId);
  const resetLayout = useResetLayout(boardId);
  const theme = useBoardTheme();
  const saveTheme = useSaveBoardTheme(boardId);
  const { can } = usePermissions();
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

  const resetToDefault = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    resetLayout.mutate();
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

  /** Recoloring is one discrete click, so it saves right away — no debounce. */
  const setWidgetColor = (widgetType: WidgetType, color: WidgetColor) => {
    saveTheme.mutate({
      ...theme,
      widgets: { ...theme.widgets, [widgetType]: color },
    });
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
    <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Greeting boardId={boardId} />
        <div className="flex flex-wrap items-center gap-2">
          {hiddenItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Hidden
              </span>
              {hiddenItems.map((item) => {
                const def = widgetRegistry[item.widgetType];
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
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={resetLayout.isPending}
            onClick={resetToDefault}
          >
            {resetLayout.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RotateCcw data-icon="inline-start" />
            )}
            Reset layout
          </Button>
        </div>
      </div>

      <div data-palette={theme.palette}>
        <DashboardGrid
          layout={visibleLayout}
          editable
          onLayoutChange={(next) => persist(mergeHidden(layout, next))}
          renderItem={(item) => {
            const def = widgetRegistry[item.widgetType];
            if (!def) return null;
            const Collapsed = def.Collapsed;
            const color = resolveWidgetColor(
              theme,
              item.widgetType,
              def.defaultColor,
            );
            return (
              <WidgetFrame
                title={def.title}
                icon={def.icon}
                color={color}
                editable
                hidden={item.hidden}
                onToggleHidden={() => toggleHidden(item.widgetType)}
                onExpand={() => openWidget(item.widgetType)}
                colorMenu={
                  can("board.appearance") && (
                    <WidgetColorMenu
                      palette={theme.palette}
                      value={color}
                      widgetTitle={def.title}
                      onSelect={(next) => setWidgetColor(item.widgetType, next)}
                    />
                  )
                }
              >
                <Collapsed boardId={boardId} />
              </WidgetFrame>
            );
          }}
        />
      </div>

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

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Big friendly greeting + a next-show glance line — the "read it in a second" header. */
function Greeting({ boardId }: { boardId: string }) {
  const me = useMe(true);
  const from = useMemo(() => new Date().toISOString(), []);
  const shows = useEvents(boardId, { type: "SHOW", from, limit: 1 });

  const firstName = me.data?.user.displayName.split(" ")[0] ?? "there";
  const nextShow = shows.data?.[0];

  let subtitle = "Everything your band's working on, at a glance.";
  if (nextShow) {
    const days = Math.ceil(
      (new Date(nextShow.startsAt).getTime() - Date.now()) / 86_400_000,
    );
    const when =
      days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
    subtitle = `${when} · ${nextShow.title}`;
  }

  return (
    <div className="flex flex-col gap-1">
      <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
        {timeGreeting()}, {firstName}
      </h1>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {nextShow && (
          <Badge variant="lime" className="rounded-full font-semibold">
            Next show
          </Badge>
        )}
        <span>{subtitle}</span>
      </div>
    </div>
  );
}

