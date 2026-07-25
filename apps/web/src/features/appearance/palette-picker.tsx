"use client";

import { Check } from "lucide-react";
import { BOARD_PALETTES, type BoardPalette } from "@artist/shared";
import { cn } from "@/lib/utils";

/**
 * Picks the board's palette. Each option scopes itself with `data-palette`, so
 * its four chips render in that palette's own colors — the swatches are the
 * palette, not a picture of it.
 */
export function PalettePicker({
  value,
  onSelect,
}: {
  value: BoardPalette;
  onSelect: (palette: BoardPalette) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Board palette"
      className="grid gap-3 sm:grid-cols-2"
    >
      {BOARD_PALETTES.map((palette) => {
        const selected = palette.id === value;
        return (
          <button
            key={palette.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(palette.id)}
            data-palette={palette.id}
            className={cn(
              "flex flex-col items-start gap-3 rounded-2xl border p-3 text-left transition-colors hover:bg-accent/50",
              selected ? "border-foreground/40 bg-accent/40" : "border-border",
            )}
          >
            <div className="flex w-full items-center gap-2">
              <span className="flex-1 text-sm font-semibold">
                {palette.label}
              </span>
              {selected && <Check className="size-4 shrink-0" />}
            </div>
            <div className="flex gap-1.5" aria-hidden>
              {palette.slots.map((slot) => (
                <span
                  key={slot.key}
                  title={slot.label}
                  className="size-7 rounded-full ring-1 ring-foreground/15"
                  style={{ background: `var(--wc-${slot.key.slice(1)})` }}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {palette.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
