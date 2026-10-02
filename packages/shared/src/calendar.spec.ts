import {
  CALENDAR_CATEGORY_COPY,
  CalendarCategories,
  calendarCategory,
  calendarDayKey,
  groupCalendarByDay,
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
