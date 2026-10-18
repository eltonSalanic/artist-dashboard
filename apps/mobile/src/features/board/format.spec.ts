import {
  count,
  dayHeading,
  daysAway,
  dueDay,
  fileSize,
  isThisWeek,
  isToday,
  shortAgo,
  shortDate,
  timeOfDay,
} from './format';

/** A fixed local noon, so nothing here depends on when the suite runs. */
const now = new Date(2026, 2, 14, 12, 0, 0); // Sat 14 Mar 2026
const at = (days: number, hour = 12) =>
  new Date(2026, 2, 14 + days, hour, 0, 0).toISOString();

describe('isToday / isThisWeek', () => {
  it('reads today and the six days after as this week', () => {
    expect(isToday(at(0), now)).toBe(true);
    expect(isToday(at(1), now)).toBe(false);
    expect(isThisWeek(at(0), now)).toBe(true);
    expect(isThisWeek(at(6), now)).toBe(true);
    expect(isThisWeek(at(7), now)).toBe(false);
  });

  it('does not count the past as this week', () => {
    expect(isThisWeek(at(-1), now)).toBe(false);
  });
});

describe('shortDate', () => {
  it('names the days either side of today', () => {
    expect(shortDate(at(0), now)).toBe('Today');
    expect(shortDate(at(1), now)).toBe('Tomorrow');
    expect(shortDate(at(-1), now)).toBe('Yesterday');
  });

  it('uses a weekday inside the coming week', () => {
    // Sat 14th + 3 = Tue.
    expect(shortDate(at(3), now)).toBe('Tue');
  });

  it('uses a date beyond the week', () => {
    expect(shortDate(at(20), now)).toMatch(/Apr/);
  });

  it('adds the year only when it differs', () => {
    expect(shortDate(at(20), now)).not.toMatch(/2026/);
    expect(shortDate(new Date(2027, 0, 5, 12).toISOString(), now)).toMatch(
      /2027/,
    );
  });
});

describe('shortAgo', () => {
  it('scales from seconds to days', () => {
    const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
    expect(shortAgo(ago(5_000), now)).toBe('just now');
    expect(shortAgo(ago(12 * 60_000), now)).toBe('12m ago');
    expect(shortAgo(ago(3 * 3_600_000), now)).toBe('3h ago');
    expect(shortAgo(ago(2 * 86_400_000), now)).toBe('2d ago');
  });
});

describe('count', () => {
  it('prints a zero rather than nothing', () => {
    expect(count(0)).toBe('0');
    expect(count(undefined)).toBe('0');
    expect(count(12)).toBe('12');
  });
});

describe('timeOfDay', () => {
  it('prints the local clock time of an instant', () => {
    // Formatted by the device's locale, so the assertion is on the parts rather
    // than the punctuation: 24-hour locales render the same instant as "20:30".
    const printed = timeOfDay(new Date(2026, 2, 14, 20, 30).toISOString());
    expect(printed).toMatch(/8:30|20:30/);
  });
});

describe('dayHeading', () => {
  const now = new Date(2026, 2, 14, 9, 0);

  // The relative word never replaces the date — scanning a month, "Tomorrow"
  // alone forces you to count forwards from it to place everything below.
  it('keeps the date alongside the relative word', () => {
    const heading = dayHeading(new Date(2026, 2, 14), now);
    expect(heading).toContain('Today · ');
    expect(heading).toContain('14');
    expect(heading).toContain('Sat');
  });

  it('names tomorrow and yesterday', () => {
    expect(dayHeading(new Date(2026, 2, 15), now)).toContain('Tomorrow · ');
    expect(dayHeading(new Date(2026, 2, 13), now)).toContain('Yesterday · ');
  });

  it('gives a plain date beyond that', () => {
    const heading = dayHeading(new Date(2026, 2, 20), now);
    expect(heading).not.toContain('·');
    expect(heading).toContain('20');
  });
});

describe('daysAway', () => {
  it('names the days either side of today', () => {
    expect(daysAway(at(0), now)).toBe('Today');
    expect(daysAway(at(1), now)).toBe('Tomorrow');
    expect(daysAway(at(-1), now)).toBe('Yesterday');
  });

  it('counts the days to anything further, in both directions', () => {
    expect(daysAway(at(4), now)).toBe('In 4 days');
    expect(daysAway(at(-4), now)).toBe('4 days ago');
  });

  it('goes by the local day, not by hours elapsed', () => {
    // 11pm tomorrow is 35 hours away, and still tomorrow.
    expect(daysAway(at(1, 23), now)).toBe('Tomorrow');
  });
});

describe('fileSize', () => {
  it('steps from bytes to KB to MB', () => {
    expect(fileSize(820)).toBe('820 B');
    expect(fileSize(1023)).toBe('1023 B');
    expect(fileSize(1024)).toBe('1 KB');
    expect(fileSize(34 * 1024 + 300)).toBe('34 KB');
    expect(fileSize(4.2 * 1024 * 1024)).toBe('4.2 MB');
  });
});

// Runs in America/Los_Angeles (the test script pins it): in UTC a due date
// read raw and read correctly agree, and this test would prove nothing.
describe('dueDay', () => {
  const noon = new Date(2026, 9, 2, 12, 0);
  const dueToday = '2026-10-02T00:00:00.000Z';

  it('reads a due date as the day it is due', () => {
    expect(shortDate(dueDay(dueToday), noon)).toBe('Today');
    expect(isToday(dueDay(dueToday), noon)).toBe(true);
  });

  it('is what stops it landing a day early', () => {
    expect(shortDate(dueToday, noon)).toBe('Yesterday');
  });

  it('keeps the 1st of the month on the 1st', () => {
    const day = new Date(dueDay('2026-11-01T00:00:00.000Z'));
    expect(day.getDate()).toBe(1);
    expect(day.getMonth()).toBe(10);
  });
});
