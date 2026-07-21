"use client";

import { useState } from "react";
import { FocusPeriods, type FocusPeriod } from "@artist/shared";
import { usePermissions } from "@/features/auth/permissions";
import { useFocus, useSetFocus } from "@/features/planning/use-focus";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const periodLabel: Record<FocusPeriod, string> = {
  WEEK: "This week",
  MONTH: "This month",
  YEAR: "This year",
};

export function FocusWidget({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const focus = useFocus(boardId);

  if (focus.isPending) return <Skeleton className="h-full min-h-16" />;

  const byPeriod = new Map((focus.data ?? []).map((pin) => [pin.period, pin.text]));
  const canManage = can("focus.manage");

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {FocusPeriods.map((period) => (
        <div key={period} className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {periodLabel[period]}
          </span>
          {canManage ? (
            <FocusInput
              // Remount when the saved value changes so the input picks it up.
              key={byPeriod.get(period) ?? ""}
              boardId={boardId}
              period={period}
              initialText={byPeriod.get(period) ?? ""}
            />
          ) : (
            <p className="text-sm">
              {byPeriod.get(period) || (
                <span className="text-muted-foreground">Not set</span>
              )}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function FocusInput({
  boardId,
  period,
  initialText,
}: {
  boardId: string;
  period: FocusPeriod;
  initialText: string;
}) {
  const setFocus = useSetFocus(boardId);
  const [text, setText] = useState(initialText);

  const save = () => {
    const trimmed = text.trim();
    if (trimmed !== initialText) setFocus.mutate({ period, text: trimmed });
  };

  return (
    <Input
      aria-label={`${periodLabel[period]} focus`}
      placeholder="What matters most…"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

export function FocusWidgetExpanded({ boardId }: { boardId: string }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Pin one focus per period so the whole band sees the same priorities.
      </p>
      <FocusWidget boardId={boardId} />
    </div>
  );
}
