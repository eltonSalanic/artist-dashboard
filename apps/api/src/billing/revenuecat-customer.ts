import { z } from 'zod';
import { BAND_WALL_PLAN } from '@artist/shared';

const date = z.string().nullish();

/**
 * The parts of RevenueCat's `GET /v1/subscribers/:id` we read. Everything else
 * passes through, and a subscription can be missing for a promotional grant.
 * https://www.revenuecat.com/docs/api-v1#tag/customers
 */
const subscriberSchema = z
  .object({
    subscriber: z
      .object({
        entitlements: z.record(
          z.string(),
          z
            .object({
              expires_date: date,
              grace_period_expires_date: date,
              product_identifier: z.string(),
            })
            .loose(),
        ),
        subscriptions: z.record(
          z.string(),
          z
            .object({
              // normal | trial | intro | prepaid
              period_type: z.string().nullish(),
              store: z.string().nullish(),
              unsubscribe_detected_at: date,
              billing_issues_detected_at: date,
            })
            .loose(),
        ),
      })
      .loose(),
  })
  .loose();

export interface ActiveEntitlement {
  productId: string;
  store: string | null;
  expiresAt: Date | null;
  isTrial: boolean;
  cancelled: boolean;
  billingIssue: boolean;
}

/**
 * The band_wall entitlement, if it's active right now. Null covers a person
 * RevenueCat has never seen and one whose entitlement has run out.
 */
export function activeEntitlement(
  body: unknown,
  now: Date,
): ActiveEntitlement | null {
  const { subscriber } = subscriberSchema.parse(body);
  const entitlement = subscriber.entitlements[BAND_WALL_PLAN.entitlement];
  if (!entitlement) return null;

  // Null is a lifetime purchase or a grant with no end.
  const end = entitlement.grace_period_expires_date ?? entitlement.expires_date;
  if (end && new Date(end) <= now) return null;

  const productId = entitlement.product_identifier;
  const subscription = subscriber.subscriptions[productId];
  return {
    productId,
    store: subscription?.store?.toUpperCase() ?? null,
    expiresAt: entitlement.expires_date
      ? new Date(entitlement.expires_date)
      : null,
    isTrial: subscription?.period_type === 'trial',
    cancelled: !!subscription?.unsubscribe_detected_at,
    billingIssue: !!subscription?.billing_issues_detected_at,
  };
}
