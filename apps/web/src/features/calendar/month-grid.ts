import {
  calendarCategory,
  calendarDayKey,
  CALENDAR_CATEGORY_COPY,
  CalendarCategories,
  type CalendarCategory,
} from "@artist/shared";
import type { CalendarItemDto } from "@artist/api-client";

export interface MonthCell {
  date: Date;
  /** False for the leading/trailing days borrowed from adjacent months. */
  inMonth: boolean;
  isToday: boolean;
  items: CalendarItemDto[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * The visible range for a month view: the Sunday on or before the 1st,
 * through the Sunday after the last cell. Returned as [from, to) so it
 * maps straight onto the calendar API's half-open range.
 */
export function monthRange(year: number, month: number): { from: Date; to: Date } {
  const first = new Date(year, month, 1);
  const from = new Date(first);
  from.setDate(first.getDate() - first.getDay());
  const to = new Date(from.getTime() + 42 * DAY_MS);
  return { from, to };
}

/**
 * Builds the 6×7 month grid and buckets items into their day.
 * Always 42 cells so the grid height doesn't jump between months.
 */
export function buildMonthGrid(
  year: number,
  month: number,
  items: CalendarItemDto[],
  today: Date = new Date(),
): MonthCell[] {
  const { from } = monthRange(year, month);

  const byDay = new Map<string, CalendarItemDto[]>();
  for (const item of items) {
    // `calendarDayKey` is the shared rule — see its comment for why a task's
    // due date and a show's start time cannot be read the same way.
    const key = calendarDayKey(item);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(item);
    else byDay.set(key, [item]);
  }

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + index);
    return {
      date,
      inMonth: date.getMonth() === month && date.getFullYear() === year,
      isToday: sameDay(date, today),
      items: byDay.get(dayKeyOf(date)) ?? [],
    };
  });
}

/** A grid cell's own day, in the same spelling `calendarDayKey` produces. */
function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The buckets, the labels and `calendarCategory` itself now live in
 * `@artist/shared` — a filter that put shows in a different bucket on a phone
 * than in a browser is the kind of divergence nobody would think to look for.
 * Re-exported from here so the call sites in this feature do not all have to
 * change, and because the accent table below is keyed by the same type.
 */
export { calendarCategory, type CalendarCategory };

export const CALENDAR_CATEGORIES: { key: CalendarCategory; label: string }[] =
  CalendarCategories.map((key) => ({
    key,
    label: CALENDAR_CATEGORY_COPY[key].label,
  }));

/**
 * One color per category, shared by the calendar grid and the archive list —
 * the day chips' left accent and every legend dot come from here, so they
 * can't drift apart. (Tailwind needs whole class names, hence the static
 * strings.)
 */
export const CATEGORY_ACCENT: Record<
  CalendarCategory,
  { border: string; dot: string }
> = {
  SHOW: { border: "border-l-violet-500", dot: "bg-violet-500" },
  MEETING: { border: "border-l-sky-500", dot: "bg-sky-500" },
  REHEARSAL: { border: "border-l-rose-500", dot: "bg-rose-500" },
  TASK: { border: "border-l-slate-500", dot: "bg-slate-500" },
  REMINDER: { border: "border-l-amber-500", dot: "bg-amber-500" },
  GOAL: { border: "border-l-emerald-500", dot: "bg-emerald-500" },
};
