"use client";

import type { ComponentType, CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Expand, Eye, EyeOff } from "lucide-react";
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
      <div className="widget-drag-handle relative mb-1 flex shrink-0 cursor-grab items-center justify-center gap-2 border-b-2 border-foreground/10 px-12 pt-4 pb-3 active:cursor-grabbing">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Icon className="size-4 shrink-0" />
          </span>
          <span className="truncate font-heading text-lg font-bold tracking-tight">
            {title}
          </span>
        </div>
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5">
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
      <ScrollFade>{children}</ScrollFade>
    </div>
  );
}

/**
 * Wraps the widget body's scroll area and paints a soft gradient at the top
 * and/or bottom edge whenever there is more content in that direction — a hint
 * that the list keeps going. Each fade fades in only when it applies, so a
 * short (non-scrolling) list shows none. The gradient uses `--card`, so it
 * inherits whatever accent the frame is currently painted in.
 */
function ScrollFade({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setAtTop(scrollTop <= 1);
    // 1px slack absorbs sub-pixel rounding at the very bottom.
    setAtBottom(scrollTop + clientHeight >= scrollHeight - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    // Content growing/shrinking (async data, expanding rows) also changes
    // whether the fades apply, so watch the size as well as scroll.
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [update]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={ref}
        onScroll={update}
        className="h-full overflow-y-auto px-4 pt-2 pb-4"
      >
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 flex h-9 items-start justify-center bg-linear-to-b from-card to-transparent transition-opacity duration-200",
          atTop && "opacity-0",
        )}
      >
        <ChevronUp className="mt-1 size-4 text-muted-foreground" />
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 flex h-9 items-end justify-center bg-linear-to-t from-card to-transparent transition-opacity duration-200",
          atBottom && "opacity-0",
        )}
      >
        <ChevronDown className="mb-1 size-4 animate-bounce text-muted-foreground" />
      </div>
    </div>
  );
}
