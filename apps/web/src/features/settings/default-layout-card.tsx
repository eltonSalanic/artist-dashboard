"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_BOARD_LAYOUT,
  resolveWidgetColor,
  type BoardTheme,
  type LayoutItem,
  type WidgetType,
} from "@artist/shared";
import { apiFetch } from "@/lib/api";
import type { BoardDetailDto } from "@/features/auth/types";
import { DashboardGrid } from "@/features/dashboard/dashboard-grid";
import { useSaveDefaultLayout } from "@/features/dashboard/use-layout";
import { widgetRegistry } from "@/features/widgets/registry";
import { WidgetFrame } from "@/features/widgets/widget-frame";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export function DefaultLayoutCard({ boardId }: { boardId: string }) {
  const board = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => apiFetch<BoardDetailDto>(`/boards/${boardId}`),
  });

  if (board.isPending || !board.data) return <Skeleton className="h-64" />;

  return (
    <DefaultLayoutEditor
      boardId={boardId}
      initialLayout={board.data.defaultLayout}
      theme={board.data.theme}
    />
  );
}

function DefaultLayoutEditor({
  boardId,
  initialLayout,
  theme,
}: {
  boardId: string;
  initialLayout: LayoutItem[];
  theme: BoardTheme;
}) {
  const saveDefault = useSaveDefaultLayout(boardId);
  const [layout, setLayout] = useState<LayoutItem[]>(initialLayout);

  const knownItems = useMemo(
    () => layout.filter((item) => widgetRegistry[item.widgetType]),
    [layout],
  );

  const availableToAdd = useMemo(() => {
    const present = new Set(knownItems.map((item) => item.widgetType));
    return (Object.keys(widgetRegistry) as WidgetType[]).filter(
      (type) => !present.has(type),
    );
  }, [knownItems]);

  const toggleHidden = (widgetType: WidgetType) => {
    setLayout((prev) =>
      prev.map((item) =>
        item.widgetType === widgetType
          ? { ...item, hidden: !item.hidden }
          : item,
      ),
    );
  };

  const addWidget = (widgetType: WidgetType) => {
    const def = widgetRegistry[widgetType];
    if (!def) return;
    setLayout((prev) => {
      const maxY = Math.max(0, ...prev.map((item) => item.y + item.h));
      return [
        ...prev,
        { widgetType, x: 0, y: maxY, w: def.defaultSize.w, h: def.defaultSize.h },
      ];
    });
  };

  const resetToPreset = () => {
    setLayout(DEFAULT_BOARD_LAYOUT.map((item) => ({ ...item })));
    toast.message("Reset to the standard preset — save to apply for the board");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Default layout</CardTitle>
          <CardDescription>
            What new members see on their dashboard before they customize it.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {availableToAdd.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                <Plus data-icon="inline-start" />
                Add widget
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {availableToAdd.map((type) => (
                  <DropdownMenuItem key={type} onClick={() => addWidget(type)}>
                    {widgetRegistry[type]?.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="outline" size="sm" onClick={resetToPreset}>
            <RotateCcw data-icon="inline-start" />
            Reset
          </Button>
          <Button
            size="sm"
            disabled={saveDefault.isPending}
            onClick={() => saveDefault.mutate(layout)}
          >
            {saveDefault.isPending && <Spinner data-icon="inline-start" />}
            Save default layout
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {knownItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No widgets yet — add one above.
          </p>
        ) : (
          <div data-palette={theme.palette}>
            <DashboardGrid
              layout={knownItems}
              editable
              onLayoutChange={setLayout}
              renderItem={(item) => {
                const def = widgetRegistry[item.widgetType];
                if (!def) return null;
                const Collapsed = def.Collapsed;
                return (
                  <WidgetFrame
                    title={def.title}
                    icon={def.icon}
                    color={resolveWidgetColor(
                      theme,
                      item.widgetType,
                      def.defaultColor,
                    )}
                    editable
                    hidden={item.hidden}
                    onToggleHidden={() => toggleHidden(item.widgetType)}
                  >
                    <Collapsed boardId={boardId} />
                  </WidgetFrame>
                );
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
