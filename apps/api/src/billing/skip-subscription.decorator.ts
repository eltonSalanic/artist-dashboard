import { SetMetadata } from '@nestjs/common';

export const SKIP_SUBSCRIPTION_KEY = 'skipSubscription';

/**
 * Leaves a board route open to a board without Band Pro. Only for what a band
 * needs to get to the point of paying: invites, and the subscription status
 * itself (docs/billing.md has the full list).
 */
export const SkipSubscription = () => SetMetadata(SKIP_SUBSCRIPTION_KEY, true);
