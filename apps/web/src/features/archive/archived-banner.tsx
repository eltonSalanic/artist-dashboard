"use client";

import { Archive } from "lucide-react";

/** "Jul 26, 2026" — an archive is browsed across years, so the year earns its place. */
function archivedOn(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The state banner at the top of an archived item's detail view. Solid `ink`
 * — the deepest panel in the palette — so an archived item reads as set aside
 * the moment it opens, rather than looking like any other record.
 *
 * Renders nothing for a live item, so callers can drop it in unconditionally.
 */
export function ArchivedBanner({ archivedAt }: { archivedAt: string | null }) {
  if (!archivedAt) return null;

  return (
    <div
      // pr-10 keeps the text clear of the dialog's absolute close button. The
      // hairline keeps the bar's edge readable on the dark theme, where the
      // modal behind it is dark too.
      className="flex items-center gap-3 rounded-lg bg-ink px-3 py-2.5 pr-10 text-ink-foreground ring-1 ring-ink-foreground/20"
      role="status"
    >
      <Archive aria-hidden className="size-4 shrink-0" />
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span className="font-heading text-sm font-semibold">Archived</span>
        <span
          className="text-xs opacity-80"
          title={new Date(archivedAt).toLocaleString()}
        >
          {archivedOn(archivedAt)} · hidden from your dashboard
        </span>
      </div>
    </div>
  );
}
