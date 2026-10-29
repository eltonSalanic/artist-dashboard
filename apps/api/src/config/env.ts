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
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    WEB_URL: z.url().optional(),
    API_URL: z.url().optional(),
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

  if (problems.length > 0) {
    throw new Error(`Invalid environment:\n  ${problems.join('\n  ')}`);
  }
  return raw;
}

/** Log levels at and above the given one, as Nest's logger wants them. */
export function logLevelsFrom(level: LogLevelSetting): LogLevelSetting[] {
  return LOG_LEVELS.slice(0, LOG_LEVELS.indexOf(level) + 1);
}
