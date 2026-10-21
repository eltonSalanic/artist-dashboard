import type { EventType } from './enums';

/**
 * How a calendar item is bucketed and which day it lands on.
 *
 * Both of these are rules two platforms must agree on, and both are the kind of
 * disagreement nobody would think to look for: a filter that puts shows in a
 * different bucket on a phone than in a browser, or — worse — a task that reads
 * as due on the 14th on one and the 13th on the other. So they live here rather
 * than once per app, the same reasoning that moved `activityText`.
 *
 * What stays per-platform is *appearance*: web paints categories with Tailwind
 * class names and native needs colour values, so neither can express the
 * other's. The keys and labels below are what they agree on.
 */

/** The shape this module needs of a calendar item; the full DTO is wider. */
export interface CalendarItemLike {
  kind: 'EVENT' | 'TASK' | 'GOAL' | 'REMINDER';
  date: string;
  event?: { type: EventType } | undefined;
}

/** The togglable buckets on the calendar — events split by their type. */
export const CalendarCategories = [
  'SHOW',
  'MEETING',
  'REHEARSAL',
  'TASK',
  'REMINDER',
  'GOAL',
] as const;
export type CalendarCategory = (typeof CalendarCategories)[number];

/**
 * Plural for a filter chip, singular for a row that names its own kind — an
 * agenda row reads "Neon Harbor · Show", not "· Shows".
 */
export const CALENDAR_CATEGORY_COPY: Record<
  CalendarCategory,
  { label: string; one: string }
> = {
  SHOW: { label: 'Shows', one: 'Show' },
  MEETING: { label: 'Meetings', one: 'Meeting' },
  REHEARSAL: { label: 'Rehearsals', one: 'Rehearsal' },
  TASK: { label: 'Tasks', one: 'Due' },
  REMINDER: { label: 'Reminders', one: 'Reminder' },
  GOAL: { label: 'Goals', one: 'Goal' },
};

/** Which bucket an item belongs to. */
export function calendarCategory(item: CalendarItemLike): CalendarCategory {
  if (item.kind === 'EVENT') return item.event?.type ?? 'SHOW';
  if (item.kind === 'TASK') return 'TASK';
  if (item.kind === 'REMINDER') return 'REMINDER';
  return 'GOAL';
}

/**
 * Which local day an item belongs on, as `{ year, month, day }`.
 *
 * Two kinds of date are mixed in one list. An event or a reminder happens at an
 * **instant**, so it belongs on whatever local day that instant falls in — a
 * load-in at 00:30 UTC is the evening before in Los Angeles, and showing it on
 * the following day would be wrong. A task's due date and a goal's target are
 * **calendar days**, stored as UTC midnight with no time in them; reading those
 * in local time moves them a day backwards for everyone west of UTC, which is
 * the bug this function exists to prevent.
 *
 * Returned as parts rather than a `Date` so the caller can key a map with it
 * and build its own heading, and so nothing downstream can re-apply a timezone
 * to a value that has already been resolved.
 */
export function calendarDayParts(item: CalendarItemLike): {
  year: number;
  month: number;
  day: number;
} {
  const date = new Date(item.date);
  const wholeDay = item.kind === 'TASK' || item.kind === 'GOAL';
  return wholeDay
    ? {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth(),
        day: date.getUTCDate(),
      }
    : {
        year: date.getFullYear(),
        month: date.getMonth(),
        day: date.getDate(),
      };
}

/** The same day as a string, for grouping. Sortable: `2026-03-14`. */
export function calendarDayKey(item: CalendarItemLike): string {
  const { year, month, day } = calendarDayParts(item);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Items grouped into days, each day's items in time order, days ascending.
 *
 * An agenda and a month grid both need exactly this, which is why the sort is
 * here and not in either of them: within a day, a 7pm show below a 10am
 * rehearsal is the only order that reads, and whole-day items (a task due, a
 * goal) have no time to sort by, so they come first rather than at an arbitrary
 * hour implied by their UTC midnight.
 */
export interface CalendarDay<T> {
  key: string;
  parts: { year: number; month: number; day: number };
  items: T[];
}

export function groupCalendarByDay<T extends CalendarItemLike>(
  items: readonly T[],
): CalendarDay<T>[] {
  const days = new Map<string, { parts: ReturnType<typeof calendarDayParts>; items: T[] }>();

  for (const item of items) {
    const key = calendarDayKey(item);
    const day = days.get(key);
    if (day) day.items.push(item);
    else days.set(key, { parts: calendarDayParts(item), items: [item] });
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, day]) => ({
      key,
      parts: day.parts,
      items: day.items.sort(timeWithinDay),
    }));
}

/**
 * The days with one local day forced in, empty when nothing falls on it, and
 * still in order. The phone's agenda leaves empty days out, but today is the
 * one it opens on, so today has to be there even on a day with nothing booked.
 */
export function withCalendarDay<T>(
  days: readonly CalendarDay<T>[],
  date: Date,
): CalendarDay<T>[] {
  const parts = {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
  };
  const key = `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  if (days.some((day) => day.key === key)) return [...days];
  return [...days, { key, parts, items: [] }].sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}

function timeWithinDay(a: CalendarItemLike, b: CalendarItemLike): number {
  const aWhole = a.kind === 'TASK' || a.kind === 'GOAL';
  const bWhole = b.kind === 'TASK' || b.kind === 'GOAL';
  if (aWhole !== bWhole) return aWhole ? -1 : 1;
  if (aWhole && bWhole) return 0;
  return new Date(a.date).getTime() - new Date(b.date).getTime();
}

/**
 * The write side of the rule above: a day picked on a local calendar, as the
 * UTC-midnight instant the API stores for a due date.
 *
 * A date picker hands back a local `Date` — midnight, or whatever time it was
 * when the picker opened. `toISOString()` on that converts the *instant*, so in
 * Los Angeles "October 2nd" becomes 07:00Z on the 2nd at best and the 1st at
 * worst, depending on the hour. Taking the local year/month/day and building
 * UTC midnight from them is what web gets for free from `new Date("2026-10-02")`.
 */
export function dueDateFromLocalDay(day: Date): string {
  return new Date(
    Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()),
  ).toISOString();
}

/**
 * The inverse, for seeding a date picker: a stored due date as local midnight
 * on the same calendar day, so the picker opens on the day the task is due
 * rather than the day before.
 */
export function localDayFromDueDate(iso: string): Date {
  const date = new Date(iso);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

const DAY_MS = 86_400_000;

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Whole local days from today: 0 today, 1 tomorrow, -1 yesterday.
 *
 * Calendar days, not elapsed time. A show at 4pm seen at 11am is five hours
 * away and still today; dividing the gap by 24 hours and rounding up called it
 * "Tomorrow" on web's greeting while the phone said "Today". Shared so that
 * cannot happen again. Rounded rather than floored, because a day across a
 * daylight-saving change is 23 or 25 hours long.
 */
export function daysFromToday(iso: string, now = new Date()): number {
  return Math.round(
    (startOfLocalDay(new Date(iso)) - startOfLocalDay(now)) / DAY_MS,
  );
}
