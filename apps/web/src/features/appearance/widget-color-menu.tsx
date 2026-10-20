"use client";

import { Check, Palette } from "lucide-react";
import {
  WidgetColors,
  slotLabel,
  type BoardPalette,
  type WidgetColor,
} from "@artist/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Lives in shared now, so the phone names a colour the same way.
export { slotLabel };

/**
 * Picks which palette slot a widget paints with. The swatches read their color
 * from the enclosing `data-palette` scope, so they always show the board's real
 * colors without naming any of them here.
 */
export function WidgetColorMenu({
  palette,
  value,
  widgetTitle,
  onSelect,
}: {
  palette: BoardPalette;
  value: WidgetColor;
  widgetTitle: string;
  onSelect: (color: WidgetColor) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full text-current/70 hover:bg-foreground/10 hover:text-current"
            aria-label={`Change ${widgetTitle} color`}
          />
        }
      >
        <Palette />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        data-palette={palette}
        className="flex w-auto min-w-0 flex-row gap-1 p-1.5"
      >
        {WidgetColors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onSelect(color)}
            aria-label={slotLabel(palette, color)}
            aria-pressed={color === value}
            className={cn(
              "flex size-7 items-center justify-center rounded-full ring-1 ring-foreground/15 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              color === value && "ring-2 ring-foreground/60",
            )}
            style={swatchStyle(color)}
          >
            {color === value && <Check className="size-3.5" />}
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A swatch paints itself in the slot it represents; `base` shows the plain card. */
export function swatchStyle(color: WidgetColor) {
  if (color === "base") {
    return { background: "var(--card)", color: "var(--card-foreground)" };
  }
  const slot = color.slice(1);
  return {
    background: `var(--wc-${slot})`,
    color: `var(--wc-${slot}-fg)`,
  };
}
