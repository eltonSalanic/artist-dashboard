import { z } from 'zod';

/**
 * The parts of a RevenueCat webhook body we read. RevenueCat adds fields
 * freely, so everything else passes through (`loose`), and the fields that
 * only some event types carry are optional.
 * https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
const eventSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    app_user_id: z.string().optional(),
    original_app_user_id: z.string().optional(),
    aliases: z.array(z.string()).nullish(),
    product_id: z.string().nullish(),
    new_product_id: z.string().nullish(),
    entitlement_ids: z.array(z.string()).nullish(),
    store: z.string().nullish(),
    // NORMAL | TRIAL | INTRO | PREPAID. TRIAL is a free trial.
    period_type: z.string().nullish(),
    environment: z.string().nullish(),
    expiration_at_ms: z.number().nullish(),
    event_timestamp_ms: z.number().nullish(),
    // TRANSFER only: the app user ids the purchase moved between.
    transferred_from: z.array(z.string()).nullish(),
    transferred_to: z.array(z.string()).nullish(),
  })
  .loose();

export const revenueCatWebhookSchema = z
  .object({ api_version: z.string().optional(), event: eventSchema })
  .loose();

export type RevenueCatEvent = z.infer<typeof eventSchema>;
