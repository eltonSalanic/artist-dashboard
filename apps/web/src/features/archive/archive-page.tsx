"use client";

import { Suspense, useMemo, useState } from "react";
import { Archive } from "lucide-react";
import { useMe } from "@/features/auth/use-me";
import { useDetailParams } from "@/features/planning/use-detail-params";
import {
  formatDate,
  formatDateTime,
  goalPeriodLabel,
} from "@/features/planning/planning-bits";
import { relativeTime } from "@/features/comments/comment-bits";
import { GoalDetailModal } from "@/features/planning/goal-detail-modal";
import { EventDetailModal } from "@/features/planning/event-detail-modal";
import { ReminderDetailModal } from "@/features/planning/reminder-detail-modal";
import { TaskDetailModal } from "@/features/tasks/task-detail-modal";
import {
  CALENDAR_CATEGORIES,
  CATEGORY_ACCENT,
  type CalendarCategory,
} from "@/features/calendar/month-grid";
import { useArchive } from "./use-archive";
import type { ArchiveItemDto } from "./types";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

/** Sentinel for the "no year filter" option — Select can't hold an empty value. */
const ALL_YEARS = "__all__";

/** Same buckets as the calendar, so events split by type here too. */
function itemCategory(item: ArchiveItemDto): CalendarCategory {
  if (item.kind === "EVENT") return item.event?.type ?? "SHOW";
  if (item.kind === "TASK") return "TASK";
  if (item.kind === "REMINDER") return "REMINDER";
  return "GOAL";
}

/** The detail modal an archived row opens. */
function detailParam(kind: ArchiveItemDto["kind"]) {
  return kind === "EVENT"
    ? "event"
    : kind === "GOAL"
      ? "goal"
      : kind === "TASK"
        ? "task"
        : "reminder";
}

const CATEGORY_LABEL = new Map(
  CALENDAR_CATEGORIES.map(({ key, label }) => [
    key,
    // "Shows" → "Show": a row is one item, not a bucket.
    label.replace(/s$/, ""),
  ]),
);

export function ArchivePage() {
  const me = useMe(true);
  const boardId = me.data?.board?.id;

  if (!boardId) return <Skeleton className="m-6 h-96" />;

  return (
    <Suspense>
      <ArchiveList boardId={boardId} />
      <TaskDetailModal boardId={boardId} />
      <GoalDetailModal boardId={boardId} />
      <EventDetailModal boardId={boardId} />
      <ReminderDetailModal boardId={boardId} />
    </Suspense>
  );
}

function ArchiveList({ boardId }: { boardId: string }) {
  const archive = useArchive(boardId);
  const items = useMemo(() => archive.data ?? [], [archive.data]);

  // All categories visible by default; clicking a chip toggles its bucket.
  const [hidden, setHidden] = useState<Set<CalendarCategory>>(new Set());
  const [year, setYear] = useState(ALL_YEARS);
  const [day, setDay] = useState("");

  const toggle = (key: CalendarCategory) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Years come from the archive itself — no point offering one that's empty.
  const years = useMemo(() => {
    const seen = new Set(
      items.map((item) => new Date(item.archivedAt).getFullYear()),
    );
    return [...seen].sort((a, b) => b - a);
  }, [items]);

  const visible = items.filter((item) => {
    if (hidden.has(itemCategory(item))) return false;
    const archivedAt = new Date(item.archivedAt);
    if (year !== ALL_YEARS && archivedAt.getFullYear() !== Number(year)) {
      return false;
    }
    // The picker gives local wall time; compare on the local calendar day.
    if (day) {
      const [y, m, d] = day.split("-").map(Number);
      if (
        archivedAt.getFullYear() !== y ||
        archivedAt.getMonth() + 1 !== m ||
        archivedAt.getDate() !== d
      ) {
        return false;
      }
    }
    return true;
  });

  const filtered = hidden.size > 0 || year !== ALL_YEARS || day !== "";

  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-lg font-semibold tracking-tight">Archive</h1>
        <p className="text-xs text-muted-foreground">
          {visible.length} of {items.length}{" "}
          {items.length === 1 ? "item" : "items"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-sm">Filter By: </p>
        {CALENDAR_CATEGORIES.map(({ key, label }) => {
          const active = !hidden.has(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(key)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                active
                  ? "border-transparent bg-accent text-foreground"
                  : "border-border text-muted-foreground line-through opacity-60 hover:opacity-100"
              }`}
            >
              <span
                aria-hidden
                className={`size-2 rounded-full ${CATEGORY_ACCENT[key].dot}`}
              />
              {label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <Select
            value={year}
            onValueChange={(v) => v && setYear(v)}
            items={[
              { value: ALL_YEARS, label: "All years" },
              ...years.map((y) => ({ value: String(y), label: String(y) })),
            ]}
          >
            <SelectTrigger aria-label="Filter by year" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_YEARS}>All years</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <DateTimePicker
            aria-label="Filter by day archived"
            placeholder="Any day"
            className="w-40"
            clearable
            value={day}
            onChange={setDay}
          />
        </div>
      </div>

      {archive.isPending ? (
        <Skeleton className="min-h-96 flex-1" />
      ) : visible.length === 0 ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Archive />
            </EmptyMedia>
            <EmptyTitle>
              {items.length === 0 ? "Nothing archived yet" : "No matches"}
            </EmptyTitle>
            <EmptyDescription>
              {items.length === 0
                ? "Archive a task, goal, show or reminder to clear it off your dashboard without losing it."
                : "No archived items match these filters."}
            </EmptyDescription>
          </EmptyHeader>
          {filtered && items.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setHidden(new Set());
                setYear(ALL_YEARS);
                setDay("");
              }}
            >
              Clear filters
            </Button>
          )}
        </Empty>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {visible.map((item) => (
            <ArchiveRow key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ArchiveRow({ item }: { item: ArchiveItemDto }) {
  const { open } = useDetailParams();
  const category = itemCategory(item);

  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/50"
        onClick={() => open(detailParam(item.kind), item.id)}
      >
        <span
          aria-hidden
          className={`size-2 shrink-0 rounded-full ${CATEGORY_ACCENT[category].dot}`}
        />
        <span className="w-20 shrink-0 text-xs text-muted-foreground">
          {CATEGORY_LABEL.get(category)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
        <span className="hidden w-40 shrink-0 truncate text-right text-xs text-muted-foreground sm:block">
          {rowDetail(item)}
        </span>
        <span
          className="w-20 shrink-0 text-right text-xs text-muted-foreground"
          title={new Date(item.archivedAt).toLocaleString()}
        >
          {relativeTime(item.archivedAt)}
        </span>
      </button>
    </li>
  );
}

/**
 * The one line of context each kind carries into the list: when it was
 * originally pinned to, plus whatever else identifies it at a glance.
 */
function rowDetail(item: ArchiveItemDto): string {
  const parts: string[] = [];
  if (item.date) {
    // Task and goal due dates are date-only fields stored at UTC midnight;
    // events and reminders are real instants.
    parts.push(
      item.kind === "TASK" || item.kind === "GOAL"
        ? formatDate(item.date)
        : formatDateTime(item.date),
    );
  }
  if (item.kind === "TASK" && item.task) parts.push(item.task.statusName);
  if (item.kind === "GOAL" && item.goal) {
    parts.push(goalPeriodLabel[item.goal.period]);
  }
  if (item.kind === "EVENT" && item.event?.location) {
    parts.push(item.event.location);
  }
  return parts.join(" · ");
}
