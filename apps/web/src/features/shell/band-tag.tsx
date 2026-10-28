"use client";

import { Music } from "lucide-react";
import { useBoard } from "@artist/api-client";

/**
 * The band an item belongs to, at the top of its detail dialog, so someone in
 * several bands always knows whose show, task or entry they are looking at.
 * Takes no room until the board has loaded (it almost always has already).
 */
export function BandTag({ boardId }: { boardId: string }) {
  const name = useBoard(boardId).data?.name;
  if (!name) return null;
  return (
    <span
      aria-label={`Band: ${name}`}
      className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground"
    >
      <Music aria-hidden className="size-3 shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  );
}
