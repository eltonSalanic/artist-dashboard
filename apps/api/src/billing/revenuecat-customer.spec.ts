import { activeEntitlement } from './revenuecat-customer';

const NOW = new Date('2026-10-30T12:00:00Z');

const body = (entitlement?: object, subscription?: object) => ({
  subscriber: {
    entitlements: entitlement ? { band_wall: entitlement } : {},
    subscriptions: subscription ? { band_wall_yearly: subscription } : {},
  },
});
const entitlement = {
  expires_date: '2026-11-30T12:00:00Z',
  product_identifier: 'band_wall_yearly',
};

describe('activeEntitlement', () => {
  it('reads an active trial', () => {
    expect(
      activeEntitlement(
        body(entitlement, { period_type: 'trial', store: 'app_store' }),
        NOW,
      ),
    ).toEqual({
      productId: 'band_wall_yearly',
      store: 'APP_STORE',
      expiresAt: new Date('2026-11-30T12:00:00Z'),
      isTrial: true,
      cancelled: false,
      billingIssue: false,
    });
  });

  it('is null for someone RevenueCat has never sold to', () => {
    expect(activeEntitlement(body(), NOW)).toBeNull();
  });

  it('is null once the entitlement has run out', () => {
    expect(
      activeEntitlement(
        body({ ...entitlement, expires_date: '2026-10-01T00:00:00Z' }),
        NOW,
      ),
    ).toBeNull();
  });

  it('counts the billing grace period as active', () => {
    const active = activeEntitlement(
      body(
        {
          ...entitlement,
          expires_date: '2026-10-29T00:00:00Z',
          grace_period_expires_date: '2026-11-05T00:00:00Z',
        },
        { billing_issues_detected_at: '2026-10-29T00:00:00Z' },
      ),
      NOW,
    );
    expect(active?.billingIssue).toBe(true);
  });

  it('copes with a grant that has no subscription or end date', () => {
    expect(
      activeEntitlement(body({ ...entitlement, expires_date: null }), NOW),
    ).toMatchObject({ expiresAt: null, store: null, isTrial: false });
  });
});
