"use client";

import { Suspense, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMe } from "@/features/auth/use-me";
import { useCalendar } from "@/features/planning/use-calendar";
import { useDetailParams } from "@/features/planning/use-detail-params";
import { formatTime } from "@/features/planning/planning-bits";
import { GoalDetailModal } from "@/features/planning/goal-detail-modal";
import { EventDetailModal } from "@/features/planning/event-detail-modal";
import { ReminderDetailModal } from "@/features/planning/reminder-detail-modal";
import { TaskDetailModal } from "@/features/tasks/task-detail-modal";
import type { CalendarItemDto } from "@/features/planning/types";
import {
  buildMonthGrid,
  monthRange,
  WEEKDAY_LABELS,
} from "./month-grid";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function CalendarPage() {
  const me = useMe(true);
  const boardId = me.data?.board?.id;

  if (!boardId) return <Skeleton className="m-6 h-96" />;

  return (
    <Suspense>
      <MonthView boardId={boardId} />
      <TaskDetailModal boardId={boardId} />
      <GoalDetailModal boardId={boardId} />
      <EventDetailModal boardId={boardId} />
      <ReminderDetailModal boardId={boardId} />
    </Suspense>
  );
}

function MonthView({ boardId }: { boardId: string }) {
  const today = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const { from, to } = monthRange(year, month);
  const calendar = useCalendar(boardId, from.toISOString(), to.toISOString());
  const cells = buildMonthGrid(year, month, calendar.data ?? [], today);

  const shiftMonth = (delta: number) =>
    setCursor(new Date(year, month + delta, 1));

  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">
          {cursor.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
            }
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="py-1">
            {label}
          </span>
        ))}
      </div>

      {calendar.isPending ? (
        <Skeleton className="min-h-96 flex-1" />
      ) : (
        <div className="grid flex-1 grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
          {cells.map((cell) => (
            <div
              key={cell.date.toISOString()}
              className={`flex min-h-24 flex-col gap-1 p-1.5 ${
                cell.inMonth ? "bg-card" : "bg-muted/40"
              }`}
            >
              <span
                className={`text-xs ${
                  cell.isToday
                    ? "flex size-5 items-center justify-center self-start rounded-full bg-primary font-semibold text-primary-foreground"
                    : cell.inMonth
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {cell.date.getDate()}
              </span>
              <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
                {cell.items.map((item) => (
                  <CalendarChip key={`${item.kind}-${item.id}`} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarChip({ item }: { item: CalendarItemDto }) {
  const { open } = useDetailParams();

  const target =
    item.kind === "EVENT"
      ? "event"
      : item.kind === "GOAL"
        ? "goal"
        : item.kind === "TASK"
          ? "task"
          : "reminder";

  const accent =
    item.kind === "EVENT"
      ? "border-l-primary"
      : item.kind === "GOAL"
        ? "border-l-emerald-500"
        : item.kind === "REMINDER"
          ? "border-l-amber-500"
          : "border-l-transparent";

  const label = (
    <span className="flex min-w-0 items-center gap-1">
      {item.kind === "TASK" && item.task && (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: item.task.statusColor }}
        />
      )}
      <span className="truncate">{item.title}</span>
    </span>
  );

  const className = `flex flex-col rounded-sm border-l-2 bg-accent/40 px-1 py-0.5 text-left text-[11px] leading-tight ${accent} ${
    item.kind === "EVENT" || item.kind === "REMINDER"
      ? ""
      : "text-muted-foreground"
  }`;

  return (
    <button
      type="button"
      className={`${className} hover:bg-accent`}
      title={item.title}
      onClick={() => open(target, item.id)}
    >
      {label}
      {item.kind === "EVENT" && (
        <span className="truncate text-[10px] text-muted-foreground">
          {formatTime(item.date)}
        </span>
      )}
    </button>
  );
}
