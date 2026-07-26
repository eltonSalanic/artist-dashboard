import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A shrunk-down bento widget used purely for show on the landing page — the same
 * silhouette as the real {@link WidgetFrame} (icon pill, ruled header, colored
 * slot) but static and content-free. Painted by pointing the parent at
 * `data-palette` and giving each card a `data-wc` slot, exactly like the app.
 */
export function MiniWidget({
  title,
  icon: Icon,
  color = "base",
  className,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  color?: "base" | "c1" | "c2" | "c3" | "c4";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      data-wc={color}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-[0_1px_2px_rgba(20,16,10,0.04)] ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b-2 border-foreground/10 px-3 py-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Icon className="size-3.5" />
        </span>
        <span className="truncate font-heading text-sm font-bold tracking-tight">
          {title}
        </span>
      </div>
      <div className="flex-1 overflow-hidden p-3">{children}</div>
    </div>
  );
}

/** A faux list row: a status dot and a bar standing in for a task title. */
export function FauxRow({
  width = "full",
  tone = "muted",
}: {
  width?: "full" | "long" | "mid" | "short";
  tone?: "muted" | "solid";
}) {
  const w = { full: "w-full", long: "w-4/5", mid: "w-3/5", short: "w-2/5" }[
    width
  ];
  return (
    <div className="flex items-center gap-2 py-1">
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === "solid" ? "bg-current" : "bg-current/40",
        )}
      />
      <span className={cn("h-2 rounded-full bg-current/15", w)} />
    </div>
  );
}
