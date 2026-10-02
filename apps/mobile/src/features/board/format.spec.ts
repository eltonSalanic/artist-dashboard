import {
  count,
  daysFromToday,
  isThisWeek,
  isToday,
  shortAgo,
  shortDate,
} from './format';

/** A fixed local noon, so nothing here depends on when the suite runs. */
const now = new Date(2026, 2, 14, 12, 0, 0); // Sat 14 Mar 2026
const at = (days: number, hour = 12) =>
  new Date(2026, 2, 14 + days, hour, 0, 0).toISOString();

describe('daysFromToday', () => {
  it('counts whole local days, not elapsed hours', () => {
    // 23:00 tonight and 01:00 tomorrow are two hours apart but different days.
    expect(daysFromToday(at(0, 23), now)).toBe(0);
    expect(daysFromToday(at(1, 1), now)).toBe(1);
    expect(daysFromToday(at(-1, 23), now)).toBe(-1);
  });

  it('is unaffected by a daylight-saving change in between', () => {
    // US DST started 8 Mar 2026; a naive divide by 86,400,000 across it is off
    // by an hour and can round to the wrong day.
    const before = new Date(2026, 2, 1, 12, 0, 0);
    expect(daysFromToday(at(0, 12), before)).toBe(13);
  });
});

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
