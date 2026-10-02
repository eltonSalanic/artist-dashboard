/**
 * Dates as a stat card can show them: short, and relative where that reads
 * better than a date.
 *
 * All comparisons are in the **device's** local day, not the board's timezone.
 * The board has one (`Board.timezone`, used for email send times), but a card
 * saying "Today" has to agree with the phone's own clock or it reads as a bug —
 * and someone on tour is in their own day, not the band's.
 */

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
