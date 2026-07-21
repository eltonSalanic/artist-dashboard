import type { CalendarItemDto } from "@/features/planning/types";

export interface MonthCell {
  date: Date;
  /** False for the leading/trailing days borrowed from adjacent months. */
  inMonth: boolean;
  isToday: boolean;
  items: CalendarItemDto[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

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

function itemDayKey(item: CalendarItemDto): string {
  const date = new Date(item.date);
  // Tasks/goals store a calendar day as UTC midnight — bucket by UTC Y/M/D
  // so western timezones don't place them on the previous local day.
  if (item.kind === "TASK" || item.kind === "GOAL") {
    return new Date(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ).toDateString();
  }
  return startOfDay(date).toDateString();
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
    const key = itemDayKey(item);
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
      items: byDay.get(date.toDateString()) ?? [],
    };
  });
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
