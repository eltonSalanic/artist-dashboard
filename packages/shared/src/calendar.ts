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
export function groupCalendarByDay<T extends CalendarItemLike>(
  items: readonly T[],
): { key: string; parts: { year: number; month: number; day: number }; items: T[] }[] {
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

function timeWithinDay(a: CalendarItemLike, b: CalendarItemLike): number {
  const aWhole = a.kind === 'TASK' || a.kind === 'GOAL';
  const bWhole = b.kind === 'TASK' || b.kind === 'GOAL';
  if (aWhole !== bWhole) return aWhole ? -1 : 1;
  if (aWhole && bWhole) return 0;
  return new Date(a.date).getTime() - new Date(b.date).getTime();
}
