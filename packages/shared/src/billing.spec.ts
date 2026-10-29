import { isPro, webPurchaseUrl } from './billing';

const NOW = new Date('2026-10-29T12:00:00Z');
const LATER = '2026-11-29T12:00:00Z';
const EARLIER = '2026-09-29T12:00:00Z';

describe('isPro', () => {
  it('is false with no subscription', () => {
    expect(isPro(null, NOW)).toBe(false);
    expect(isPro(undefined, NOW)).toBe(false);
    expect(isPro({ status: null, currentPeriodEnd: null }, NOW)).toBe(false);
  });

  it('keeps access while active, in grace, or cancelled but paid up', () => {
    for (const status of ['ACTIVE', 'GRACE', 'CANCELLED'] as const) {
      expect(isPro({ status, currentPeriodEnd: LATER }, NOW)).toBe(true);
    }
  });

  it('drops access once expired, whatever the period says', () => {
    expect(isPro({ status: 'EXPIRED', currentPeriodEnd: LATER }, NOW)).toBe(
      false,
    );
  });

  it('drops access after the period ends even if EXPIRATION never arrived', () => {
    expect(isPro({ status: 'ACTIVE', currentPeriodEnd: EARLIER }, NOW)).toBe(
      false,
    );
  });

  it('treats a missing period end as a lifetime grant', () => {
    expect(isPro({ status: 'ACTIVE', currentPeriodEnd: null }, NOW)).toBe(true);
  });
});

describe('webPurchaseUrl', () => {
  it('appends the board id as the app user id', () => {
    expect(webPurchaseUrl('https://pay.rev.cat/abc/', 'board-1')).toBe(
      'https://pay.rev.cat/abc/board-1',
    );
  });

  it('is null when not configured', () => {
    expect(webPurchaseUrl(undefined, 'board-1')).toBeNull();
    expect(webPurchaseUrl('', 'board-1')).toBeNull();
  });
});
