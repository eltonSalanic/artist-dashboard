import { DEFAULT_SHOW_STATUSES, defaultShowStatus, showPhase } from './statuses';

describe('showPhase', () => {
  const now = new Date('2026-10-27T20:00:00Z');

  it('keeps the category for a show still to come', () => {
    const show = { startsAt: '2026-11-01T03:00:00Z' };
    expect(showPhase(show, 'HOLD', now)).toBe('HOLD');
    expect(showPhase(show, 'BOOKED', now)).toBe('BOOKED');
  });

  it('reads a past held or booked show as played', () => {
    const show = { startsAt: '2026-10-20T03:00:00Z', endsAt: null };
    expect(showPhase(show, 'BOOKED', now)).toBe('PLAYED');
    expect(showPhase(show, 'HOLD', now)).toBe('PLAYED');
  });

  it('waits for the end of a show that is still running', () => {
    const show = {
      startsAt: '2026-10-27T19:00:00Z',
      endsAt: '2026-10-27T23:00:00Z',
    };
    expect(showPhase(show, 'BOOKED', now)).toBe('BOOKED');
  });

  it('never reads a cancelled show as played', () => {
    expect(showPhase({ startsAt: '2020-01-01T00:00:00Z' }, 'CANCELLED', now)).toBe(
      'CANCELLED',
    );
  });
});

describe('defaultShowStatus', () => {
  it('is Hold for the defaults', () => {
    expect(defaultShowStatus(DEFAULT_SHOW_STATUSES)?.name).toBe('Hold');
  });

  it('skips cancellations and goes by sort order, not array order', () => {
    expect(
      defaultShowStatus([
        { name: 'Booked', sortOrder: 2, category: 'BOOKED' as const },
        { name: 'Off', sortOrder: 0, category: 'CANCELLED' as const },
        { name: 'Pencil', sortOrder: 1, category: 'HOLD' as const },
      ])?.name,
    ).toBe('Pencil');
  });

  it('is null when only cancellations are left', () => {
    expect(
      defaultShowStatus([{ sortOrder: 0, category: 'CANCELLED' as const }]),
    ).toBeNull();
  });
});
