/**
 * Dates as a stat card can show them: short, and relative where that reads
 * better than a date.
 *
 * All comparisons are in the **device's** local day, not the board's timezone.
 * The board has one (`Board.timezone`, used for email send times), but a card
 * saying "Today" has to agree with the phone's own clock or it reads as a bug —
 * and someone on tour is in their own day, not the band's.
 */

import { localDayFromDueDate } from '@artist/shared';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function startOfLocalDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/** Whole local days from today: 0 today, 1 tomorrow, -1 yesterday. */
export function daysFromToday(iso: string, now = new Date()): number {
  const then = new Date(iso);
  return Math.round(
    (startOfLocalDay(then) - startOfLocalDay(now)) / DAY,
  );
}

export function isToday(iso: string, now = new Date()): boolean {
  return daysFromToday(iso, now) === 0;
}

/** Within the next seven local days, today included. */
export function isThisWeek(iso: string, now = new Date()): boolean {
  const days = daysFromToday(iso, now);
  return days >= 0 && days < 7;
}

/**
 * "Today", "Tomorrow", "Fri" inside a week, "14 Mar" beyond it, with the year
 * once it is a different one. Past dates get the same treatment — an overdue
 * reminder reads better as "Yesterday" than as a bare date.
 */
export function shortDate(iso: string, now = new Date()): string {
  const days = daysFromToday(iso, now);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';

  const then = new Date(iso);
  if (days > 1 && days < 7) {
    return then.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return then.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(then.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/**
 * A task's or goal's due date, made safe for the helpers above.
 *
 * Those read an instant in local time, which is right for a show and wrong for
 * a due date: that is a calendar day stored as UTC midnight, and in Los Angeles
 * UTC midnight is 5pm the day before — so every due date read raw lands a day
 * early. This hands back local midnight of the *same* day. Wrap every due date
 * in it before `shortDate`, `isToday` or `isThisWeek`.
 */
export function dueDay(iso: string): string {
  return localDayFromDueDate(iso).toISOString();
}

/** "just now", "12m", "3h", "2d" — compact enough for a qualifier line. */
export function shortAgo(iso: string, now = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime();
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  return `${Math.floor(elapsed / DAY)}d ago`;
}

/** `3` → `"3"`, `0` → `"0"`. Separate so a card never prints `undefined`. */
export function count(value: number | undefined): string {
  return String(value ?? 0);
}

/**
 * A clock time, in the device's own 12/24-hour convention.
 *
 * Only for a value that *has* a time. A task's due date is a calendar day
 * stored as UTC midnight, so running it through here would invent a 5pm
 * deadline nobody set — the caller checks the kind first.
 */
export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * A day as an agenda section heading: "Today · Sat 14 Mar".
 *
 * The relative word never replaces the date. Scanning a month, a heading that
 * says only "Tomorrow" forces you to count forwards from it to place everything
 * below; with both, the list stays readable wherever you entered it.
 */
export function dayHeading(date: Date, now = new Date()): string {
  const absolute = date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const days = daysFromToday(date.toISOString(), now);
  if (days === 0) return `Today · ${absolute}`;
  if (days === 1) return `Tomorrow · ${absolute}`;
  if (days === -1) return `Yesterday · ${absolute}`;
  return absolute;
}

/** "820 B", "34 KB", "4.2 MB" — the same steps web uses. */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
