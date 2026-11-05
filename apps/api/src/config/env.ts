import { z } from 'zod';
import { parseAppEnv } from '@artist/shared';

/**
 * Checked once at boot by ConfigModule. A deploy missing a variable used to
 * start fine and fail later and quietly: unsubscribe links pointing at
 * localhost, invite emails redirecting to a dev server. Now it refuses to
 * start and says which variable is missing.
 *
 * Only what the app can't run without is required everywhere; the public URLs
 * are required only outside development, where the localhost fallbacks would
 * be wrong. Everything else passes through untouched.
 */
const LOG_LEVELS = ['error', 'warn', 'log', 'debug', 'verbose'] as const;
export type LogLevelSetting = (typeof LOG_LEVELS)[number];

const base = z
  .object({
    APP_ENV: z.enum(['development', 'staging', 'production']).optional(),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
    DATABASE_URL: z.string().min(1),
    // Where attachments live (docs/storage.md). Supabase is the default and
    // what local dev runs on; r2 needs the four R2_* variables below.
    STORAGE_PROVIDER: z.enum(['supabase', 'r2']).optional(),
    SUPABASE_URL: z.url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_BUCKET: z.string().min(1).optional(),
    // Signs Better Auth's session tokens and codes. Rotating it signs everyone out.
    BETTER_AUTH_SECRET: z.string().min(32),
    WEB_URL: z.url().optional(),
    API_URL: z.url().optional(),
    // Subscriptions (docs/billing.md). Spelled out so a typo like `TRUE` or `1`
    // fails at boot instead of quietly leaving billing off.
    BILLING_ENFORCED: z.enum(['true', 'false']).optional(),
    REVENUECAT_WEBHOOK_AUTH: z.string().min(16).optional(),
    REVENUECAT_SECRET_API_KEY: z.string().min(1).optional(),
  })
  .loose();

export function validateEnv(raw: Record<string, unknown>) {
  // `LOG_LEVEL=` in a .env file means "unset", not "the empty level".
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== ''),
  );
  const result = base.safeParse(cleaned);
  const problems = result.success
    ? []
    : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);

  if (parseAppEnv(cleaned.APP_ENV as string | undefined) !== 'development') {
    for (const key of ['WEB_URL', 'API_URL'] as const) {
      if (!cleaned[key]) problems.push(`${key}: required when APP_ENV is set`);
    }
  }

  // Only the chosen storage provider's variables are required.
  const storageKeys =
    cleaned.STORAGE_PROVIDER === 'r2'
      ? ([
          'R2_ACCOUNT_ID',
          'R2_ACCESS_KEY_ID',
          'R2_SECRET_ACCESS_KEY',
          'R2_BUCKET',
        ] as const)
      : (['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const);
  for (const key of storageKeys) {
    if (!cleaned[key]) {
      problems.push(
        `${key}: required when STORAGE_PROVIDER is ${(cleaned.STORAGE_PROVIDER as string) ?? 'supabase'}`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid environment:\n  ${problems.join('\n  ')}`);
  }
  return raw;
}

/** Log levels at and above the given one, as Nest's logger wants them. */
export function logLevelsFrom(level: LogLevelSetting): LogLevelSetting[] {
  return LOG_LEVELS.slice(0, LOG_LEVELS.indexOf(level) + 1);
}
