"use client";

import type { ComponentType, CSSProperties, ReactNode } from "react";
import { Expand, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The "Playful Cards" bento palette. Colored cards don't restyle their inner
 * widgets one by one — instead each accent re-points the design tokens
 * (`--card`, `--foreground`, `--accent`, `--primary`, …) on the frame root, so
 * every shadcn utility rendered inside inherits legible colors for free.
 */
export type WidgetAccent = "cream" | "coral" | "lilac" | "lime" | "ink";

const accentVars: Record<WidgetAccent, CSSProperties> = {
  cream: {},
  coral: {
    "--card": "var(--coral)",
    "--card-foreground": "var(--coral-foreground)",
    "--foreground": "var(--coral-foreground)",
    "--muted-foreground": "color-mix(in oklab, var(--coral-foreground) 78%, transparent)",
    "--muted": "color-mix(in oklab, var(--coral-foreground) 16%, transparent)",
    "--accent": "color-mix(in oklab, var(--coral-foreground) 16%, transparent)",
    "--accent-foreground": "var(--coral-foreground)",
    "--border": "color-mix(in oklab, var(--coral-foreground) 24%, transparent)",
    "--input": "color-mix(in oklab, var(--coral-foreground) 40%, transparent)",
    "--primary": "var(--coral-foreground)",
    "--primary-foreground": "var(--coral)",
    "--secondary": "color-mix(in oklab, var(--coral-foreground) 20%, transparent)",
    "--secondary-foreground": "var(--coral-foreground)",
    "--ring": "color-mix(in oklab, var(--coral-foreground) 45%, transparent)",
  } as CSSProperties,
  ink: {
    "--card": "var(--ink)",
    "--card-foreground": "var(--ink-foreground)",
    "--foreground": "var(--ink-foreground)",
    "--muted-foreground": "color-mix(in oklab, var(--ink-foreground) 62%, transparent)",
    "--muted": "color-mix(in oklab, var(--ink-foreground) 12%, transparent)",
    "--accent": "color-mix(in oklab, var(--ink-foreground) 12%, transparent)",
    "--accent-foreground": "var(--ink-foreground)",
    "--border": "color-mix(in oklab, var(--ink-foreground) 16%, transparent)",
    "--input": "color-mix(in oklab, var(--ink-foreground) 24%, transparent)",
    "--primary": "var(--ink-foreground)",
    "--primary-foreground": "var(--ink)",
    "--secondary": "color-mix(in oklab, var(--ink-foreground) 12%, transparent)",
    "--secondary-foreground": "var(--ink-foreground)",
    "--ring": "color-mix(in oklab, var(--ink-foreground) 30%, transparent)",
  } as CSSProperties,
  lilac: {
    "--card": "var(--lilac)",
    "--card-foreground": "var(--lilac-foreground)",
    "--foreground": "var(--lilac-foreground)",
    "--muted-foreground": "color-mix(in oklab, var(--lilac-foreground) 66%, transparent)",
    "--muted": "color-mix(in oklab, var(--lilac-foreground) 12%, transparent)",
    "--accent": "color-mix(in oklab, var(--lilac-foreground) 12%, transparent)",
    "--accent-foreground": "var(--lilac-foreground)",
    "--border": "color-mix(in oklab, var(--lilac-foreground) 18%, transparent)",
    "--input": "color-mix(in oklab, var(--lilac-foreground) 28%, transparent)",
    "--primary": "var(--lilac-foreground)",
    "--primary-foreground": "var(--lilac)",
    "--secondary": "color-mix(in oklab, var(--lilac-foreground) 14%, transparent)",
    "--secondary-foreground": "var(--lilac-foreground)",
    "--ring": "color-mix(in oklab, var(--lilac-foreground) 35%, transparent)",
  } as CSSProperties,
  lime: {
    "--card": "var(--lime)",
    "--card-foreground": "var(--lime-foreground)",
    "--foreground": "var(--lime-foreground)",
    "--muted-foreground": "color-mix(in oklab, var(--lime-foreground) 66%, transparent)",
    "--muted": "color-mix(in oklab, var(--lime-foreground) 12%, transparent)",
    "--accent": "color-mix(in oklab, var(--lime-foreground) 12%, transparent)",
    "--accent-foreground": "var(--lime-foreground)",
    "--border": "color-mix(in oklab, var(--lime-foreground) 18%, transparent)",
    "--input": "color-mix(in oklab, var(--lime-foreground) 28%, transparent)",
    "--primary": "var(--lime-foreground)",
    "--primary-foreground": "var(--lime)",
    "--secondary": "color-mix(in oklab, var(--lime-foreground) 14%, transparent)",
    "--secondary-foreground": "var(--lime-foreground)",
    "--ring": "color-mix(in oklab, var(--lime-foreground) 35%, transparent)",
  } as CSSProperties,
};

export function WidgetFrame({
  title,
  icon: Icon,
  accent = "cream",
  onExpand,
  editable,
  hidden,
  onToggleHidden,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  accent?: WidgetAccent;
  onExpand?: () => void;
  editable?: boolean;
  hidden?: boolean;
  onToggleHidden?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      style={accentVars[accent]}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-[28px] bg-card text-card-foreground shadow-[0_1px_2px_rgba(20,16,10,0.04)] ring-1 ring-foreground/10",
        hidden && "opacity-50",
      )}
    >
      <div className="widget-drag-handle flex shrink-0 cursor-grab items-center justify-between gap-2 px-4 pt-4 pb-2 active:cursor-grabbing">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/8">
            <Icon className="size-4 shrink-0" />
          </span>
          <span className="truncate font-heading text-[15px] font-semibold tracking-tight">
            {title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {editable && onToggleHidden && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full text-current/70 hover:bg-foreground/10 hover:text-current"
              aria-label={hidden ? `Show ${title}` : `Hide ${title}`}
              onClick={onToggleHidden}
            >
              {hidden ? <EyeOff /> : <Eye />}
            </Button>
          )}
          {onExpand && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full text-current/70 hover:bg-foreground/10 hover:text-current"
              aria-label={`Expand ${title}`}
              onClick={onExpand}
            >
              <Expand />
            </Button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
    </div>
  );
}
