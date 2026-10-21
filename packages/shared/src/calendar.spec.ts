import {
  CALENDAR_CATEGORY_COPY,
  CalendarCategories,
  calendarCategory,
  calendarDayKey,
  daysFromToday,
  dueDateFromLocalDay,
  groupCalendarByDay,
  withCalendarDay,
  localDayFromDueDate,
  type CalendarItemLike,
} from './calendar';

const item = (over: Partial<CalendarItemLike> & { date: string }): CalendarItemLike => ({
  kind: 'EVENT',
  ...over,
});

/**
 * These tests run in `America/Los_Angeles`, pinned by the package's test script.
 *
 * The rule under test is that two kinds of date are read differently, and in
 * UTC the two readings agree — so a suite running in UTC would pass whether or
 * not the distinction exists. Switching zones inside the file does not work:
 * Jest hands tests a *copy* of `process.env`, so assigning `TZ` there never
 * reaches the `tzset` that `Date` reads, and the assertion silently checks the
 * host's zone instead of the named one.
 *
 * West of UTC specifically, because that is the direction the bug falls in: a
 * whole-day value stored as UTC midnight, read locally, lands a day early.
 */

describe('calendarDayKey', () => {
  // A task's due date and a goal's target are calendar days with no time in
  // them, stored as UTC midnight. Reading them locally moves them a day
  // backwards for everyone west of UTC — the bug this rule exists to prevent.
  it('keeps a whole-day item on its own date', () => {
    expect(calendarDayKey(item({ kind: 'TASK', date: '2026-03-14T00:00:00.000Z' }))).toBe(
      '2026-03-14',
    );
    expect(calendarDayKey(item({ kind: 'GOAL', date: '2026-03-14T00:00:00.000Z' }))).toBe(
      '2026-03-14',
    );
  });

  /**
   * An event or a reminder happens at an **instant**, so it belongs on the
   * local day that instant falls in: a load-in at 00:30 UTC is the evening
   * before in California.
   *
   * Both ends of the day, because a single sample only catches a UTC misreading
   * on one side of the meridian. Late-evening local catches it west of UTC,
   * early-morning local catches it east.
   */
  it('puts a timed item on the local day of its instant', () => {
    const lateEvening = new Date(2026, 2, 14, 22, 30).toISOString();
    const earlyMorning = new Date(2026, 2, 14, 1, 30).toISOString();

    expect(calendarDayKey(item({ date: lateEvening }))).toBe('2026-03-14');
    expect(calendarDayKey(item({ date: earlyMorning }))).toBe('2026-03-14');
    expect(calendarDayKey(item({ kind: 'REMINDER', date: lateEvening }))).toBe('2026-03-14');
  });

  it('pads so the key sorts as a date', () => {
    expect(calendarDayKey(item({ kind: 'TASK', date: '2026-01-02T00:00:00.000Z' }))).toBe(
      '2026-01-02',
    );
  });
});

describe('calendarCategory', () => {
  const at = '2026-07-10T18:00:00.000Z';

  it('splits events by their type', () => {
    expect(calendarCategory(item({ date: at, event: { type: 'SHOW' } }))).toBe('SHOW');
    expect(calendarCategory(item({ date: at, event: { type: 'REHEARSAL' } }))).toBe('REHEARSAL');
    expect(calendarCategory(item({ date: at, event: { type: 'MEETING' } }))).toBe('MEETING');
  });

  it('maps tasks, reminders and goals to their own buckets', () => {
    expect(calendarCategory(item({ kind: 'TASK', date: at }))).toBe('TASK');
    expect(calendarCategory(item({ kind: 'REMINDER', date: at }))).toBe('REMINDER');
    expect(calendarCategory(item({ kind: 'GOAL', date: at }))).toBe('GOAL');
  });

  // An EVENT with no `event` block should not vanish from a filtered view; it
  // reads as a show, which is what the field defaults to.
  it('falls back to SHOW for an event missing its type', () => {
    expect(calendarCategory(item({ date: at }))).toBe('SHOW');
  });

  it('names every category it can return', () => {
    for (const category of CalendarCategories) {
      expect(CALENDAR_CATEGORY_COPY[category].label).toBeTruthy();
      expect(CALENDAR_CATEGORY_COPY[category].one).toBeTruthy();
    }
  });
});

describe('groupCalendarByDay', () => {
  it('returns days in ascending order', () => {
    const days = groupCalendarByDay([
      item({ date: '2026-03-16T18:00:00.000Z' }),
      item({ date: '2026-03-14T18:00:00.000Z' }),
      item({ date: '2026-03-15T18:00:00.000Z' }),
    ]);

    expect(days.map((d) => d.key)).toEqual(['2026-03-14', '2026-03-15', '2026-03-16']);
  });

  // Within a day, a 7pm show below a 10am rehearsal is the only order that
  // reads as an agenda.
  it('orders a day by time', () => {
    const [day] = groupCalendarByDay([
      item({ date: '2026-03-14T19:00:00.000Z', event: { type: 'SHOW' } }),
      item({ date: '2026-03-14T17:00:00.000Z', event: { type: 'REHEARSAL' } }),
    ]);

    expect(day.items.map((i) => i.event?.type)).toEqual(['REHEARSAL', 'SHOW']);
  });

  // A due task carries no time, so sorting it by the midnight its storage
  // implies would place it by accident of timezone — ahead of everything west
  // of UTC, behind everything east. It leads the day deliberately instead.
  it('puts whole-day items before timed ones', () => {
    const [day] = groupCalendarByDay([
      item({ date: '2026-03-14T17:00:00.000Z', event: { type: 'SHOW' } }),
      item({ kind: 'TASK', date: '2026-03-14T00:00:00.000Z' }),
    ]);

    expect(day.items.map((i) => i.kind)).toEqual(['TASK', 'EVENT']);
  });

  it('carries the day parts a heading needs', () => {
    const [day] = groupCalendarByDay([
      item({ kind: 'TASK', date: '2026-03-14T00:00:00.000Z' }),
    ]);

    expect(day.parts).toEqual({ year: 2026, month: 2, day: 14 });
  });

  it('has no days at all for an empty list', () => {
    expect(groupCalendarByDay([])).toEqual([]);
  });
});

// These run in America/Los_Angeles (see the test script), where a local
// midnight is 07:00 or 08:00 UTC — the zone in which getting this wrong shows.
describe('dueDateFromLocalDay', () => {
  it('stores the picked day as UTC midnight of that day', () => {
    expect(dueDateFromLocalDay(new Date(2026, 9, 2))).toBe('2026-10-02T00:00:00.000Z');
  });

  // A picker can return the day with the current time still on it.
  it('ignores the time of day, late evening included', () => {
    expect(dueDateFromLocalDay(new Date(2026, 9, 2, 23, 30))).toBe(
      '2026-10-02T00:00:00.000Z',
    );
  });

  it('is not what toISOString would give west of UTC', () => {
    const evening = new Date(2026, 9, 2, 20, 0);
    expect(evening.toISOString().slice(0, 10)).toBe('2026-10-03');
    expect(dueDateFromLocalDay(evening).slice(0, 10)).toBe('2026-10-02');
  });
});

describe('localDayFromDueDate', () => {
  it('opens on the stored day, not the day before', () => {
    const day = localDayFromDueDate('2026-11-01T00:00:00.000Z');
    expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([2026, 10, 1]);
  });

  it('round-trips through dueDateFromLocalDay', () => {
    const iso = '2027-01-01T00:00:00.000Z';
    expect(dueDateFromLocalDay(localDayFromDueDate(iso))).toBe(iso);
  });
});

describe('daysFromToday', () => {
  /** A fixed local noon, so nothing here depends on when the suite runs. */
  const now = new Date(2026, 2, 14, 12, 0, 0); // Sat 14 Mar 2026
  const at = (days: number, hour = 12) =>
    new Date(2026, 2, 14 + days, hour, 0, 0).toISOString();

  it('counts whole local days, not elapsed hours', () => {
    // 23:00 tonight and 01:00 tomorrow are two hours apart but different days.
    expect(daysFromToday(at(0, 23), now)).toBe(0);
    expect(daysFromToday(at(1, 1), now)).toBe(1);
    expect(daysFromToday(at(-1, 23), now)).toBe(-1);
  });

  it('calls a show later today "today", however few hours away', () => {
    // The Trello ticket: 4pm seen at 11am read as "Tomorrow" on web.
    expect(daysFromToday(at(0, 16), new Date(2026, 2, 14, 11, 0, 0))).toBe(0);
  });

  it('is unaffected by a daylight-saving change in between', () => {
    // US DST started 8 Mar 2026; a naive divide by 86,400,000 across it is off
    // by an hour and can round to the wrong day.
    const before = new Date(2026, 2, 1, 12, 0, 0);
    expect(daysFromToday(at(0, 12), before)).toBe(13);
  });
});

describe('withCalendarDay', () => {
  const days = groupCalendarByDay([
    item({ date: '2026-03-12T18:00:00.000Z' }),
    item({ date: '2026-03-20T18:00:00.000Z' }),
  ]);

  it('adds an empty day in its place when nothing falls on it', () => {
    const next = withCalendarDay(days, new Date(2026, 2, 14, 9));
    expect(next.map((d) => d.key)).toEqual(['2026-03-12', '2026-03-14', '2026-03-20']);
    expect(next[1]).toEqual({
      key: '2026-03-14',
      parts: { year: 2026, month: 2, day: 14 },
      items: [],
    });
  });

  it('keeps a day that already has things on it as it is', () => {
    const next = withCalendarDay(days, new Date(2026, 2, 12, 23));
    expect(next).toEqual(days);
  });

  // Late evening west of UTC is already tomorrow in UTC; the day is the local one.
  it('reads the date in local time', () => {
    const next = withCalendarDay([], new Date('2026-03-15T05:30:00.000Z'));
    expect(next.map((d) => d.key)).toEqual(['2026-03-14']);
  });
});
