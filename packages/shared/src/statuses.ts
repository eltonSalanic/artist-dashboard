import type { ShowStatusCategory } from './enums';

export interface DefaultStatus {
  name: string;
  color: string;
  sortOrder: number;
  isDone: boolean;
}

/** Statuses every new board starts with; admins can edit them later. */
export const DEFAULT_TASK_STATUSES: DefaultStatus[] = [
  { name: 'Not Started', color: '#8b8fa3', sortOrder: 0, isDone: false },
  { name: 'In Progress', color: '#4f7cff', sortOrder: 1, isDone: false },
  { name: 'Waiting', color: '#f5a623', sortOrder: 2, isDone: false },
  { name: 'Done', color: '#2fbf71', sortOrder: 3, isDone: true },
];

export interface DefaultShowStatus {
  name: string;
  color: string;
  sortOrder: number;
  category: ShowStatusCategory;
}

/**
 * Show statuses every new board starts with. The migration that introduced
 * them seeds the same four onto existing boards, so keep the two in step.
 */
export const DEFAULT_SHOW_STATUSES: DefaultShowStatus[] = [
  { name: 'Hold', color: '#8b8fa3', sortOrder: 0, category: 'HOLD' },
  { name: 'Details pending', color: '#f5a623', sortOrder: 1, category: 'BOOKED' },
  { name: 'Confirmed', color: '#2fbf71', sortOrder: 2, category: 'BOOKED' },
  { name: 'Cancelled', color: '#e5484d', sortOrder: 3, category: 'CANCELLED' },
];

/** How a show reads right now: its category, or PLAYED once its date is past. */
export type ShowPhase = ShowStatusCategory | 'PLAYED';

/**
 * A show is played once it has ended (or started, when it has no end) and it
 * was not cancelled. Derived rather than stored so nobody has to go back and
 * tick it.
 */
export function showPhase(
  show: { startsAt: string | Date; endsAt?: string | Date | null },
  category: ShowStatusCategory,
  now: Date = new Date(),
): ShowPhase {
  if (category === 'CANCELLED') return 'CANCELLED';
  const end = new Date(show.endsAt ?? show.startsAt);
  return end.getTime() < now.getTime() ? 'PLAYED' : category;
}

/**
 * The status a new show starts in: the first one in order that is not a
 * cancellation. Null only for a board with no usable status, which the API
 * refuses to create.
 */
export function defaultShowStatus<
  T extends { sortOrder: number; category: ShowStatusCategory },
>(statuses: readonly T[]): T | null {
  return (
    [...statuses]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .find((s) => s.category !== 'CANCELLED') ?? null
  );
}
