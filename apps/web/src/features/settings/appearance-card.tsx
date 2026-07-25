"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_BOARD_THEME,
  resolveWidgetColor,
  type BoardPalette,
  type BoardTheme,
  type WidgetColor,
  type WidgetType,
} from "@artist/shared";
import { apiFetch } from "@/lib/api";
import type { BoardDetailDto } from "@/features/auth/types";
import { useSaveBoardTheme } from "@/features/appearance/use-board-theme";
import {
  slotLabel,
  swatchStyle,
  WidgetColorMenu,
} from "@/features/appearance/widget-color-menu";
import { PalettePicker } from "@/features/appearance/palette-picker";
import { widgetRegistry } from "@/features/widgets/registry";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export function AppearanceCard({ boardId }: { boardId: string }) {
  const board = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => apiFetch<BoardDetailDto>(`/boards/${boardId}`),
  });

  if (board.isPending || !board.data) return <Skeleton className="h-64" />;

  return <AppearanceEditor boardId={boardId} initialTheme={board.data.theme} />;
}

function AppearanceEditor({
  boardId,
  initialTheme,
}: {
  boardId: string;
  initialTheme: BoardTheme;
}) {
  const saveTheme = useSaveBoardTheme(boardId);
  const [theme, setTheme] = useState<BoardTheme>(initialTheme);

  const setPalette = (palette: BoardPalette) =>
    setTheme((prev) => ({ ...prev, palette }));

  const setWidgetColor = (widgetType: WidgetType, color: WidgetColor) =>
    setTheme((prev) => ({
      ...prev,
      widgets: { ...prev.widgets, [widgetType]: color },
    }));

  const resetToDefault = () => {
    setTheme(DEFAULT_BOARD_THEME);
    toast.message("Back to the standard palette — save to apply for the board");
  };

  const widgetTypes = Object.keys(widgetRegistry) as WidgetType[];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            The palette and card colors everyone on this board sees.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefault}>
            <RotateCcw data-icon="inline-start" />
            Reset
          </Button>
          <Button
            size="sm"
            disabled={saveTheme.isPending}
            onClick={() =>
              saveTheme.mutate(theme, {
                onSuccess: () => toast.success("Appearance saved for the board"),
              })
            }
          >
            {saveTheme.isPending && <Spinner data-icon="inline-start" />}
            Save appearance
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <PalettePicker value={theme.palette} onSelect={setPalette} />

        <div data-palette={theme.palette} className="flex flex-col gap-1">
          <span className="mb-1 text-xs font-medium text-muted-foreground">
            Widget colors
          </span>
          {widgetTypes.map((widgetType) => {
            const def = widgetRegistry[widgetType];
            if (!def) return null;
            const color = resolveWidgetColor(
              theme,
              widgetType,
              def.defaultColor,
            );
            const Icon = def.icon;
            return (
              <div
                key={widgetType}
                className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-accent/40"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-foreground/15"
                  style={swatchStyle(color)}
                >
                  <Icon className="size-4 shrink-0" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {def.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {slotLabel(theme.palette, color)}
                </span>
                <WidgetColorMenu
                  palette={theme.palette}
                  value={color}
                  widgetTitle={def.title}
                  onSelect={(next) => setWidgetColor(widgetType, next)}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
