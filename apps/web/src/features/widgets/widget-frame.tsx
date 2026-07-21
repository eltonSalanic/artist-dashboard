"use client";

import type { ComponentType, ReactNode } from "react";
import { Expand, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WidgetFrame({
  title,
  icon: Icon,
  onExpand,
  editable,
  hidden,
  onToggleHidden,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  onExpand?: () => void;
  editable?: boolean;
  hidden?: boolean;
  onToggleHidden?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-lg border bg-card ${hidden ? "opacity-50" : ""}`}
    >
      <div className="widget-drag-handle flex shrink-0 cursor-grab items-center justify-between gap-2 border-b px-3 py-2 active:cursor-grabbing">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {editable && onToggleHidden && (
            <Button
              variant="ghost"
              size="icon-sm"
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
              aria-label={`Expand ${title}`}
              onClick={onExpand}
            >
              <Expand />
            </Button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  );
}
