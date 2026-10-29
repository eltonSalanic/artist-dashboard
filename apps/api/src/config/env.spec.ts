import { logLevelsFrom, validateEnv } from './env';

const minimal = {
  DATABASE_URL: 'postgres://x',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'key',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('accepts a local dev setup without public URLs', () => {
    expect(() => validateEnv(minimal)).not.toThrow();
  });

  it('names every missing required variable', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*SUPABASE_URL/);
  });

  it('requires public URLs on staging and production', () => {
    expect(() => validateEnv({ ...minimal, APP_ENV: 'staging' })).toThrow(
      /WEB_URL[\s\S]*API_URL/,
    );
    expect(() =>
      validateEnv({
        ...minimal,
        APP_ENV: 'production',
        WEB_URL: 'https://bandwall.app',
        API_URL: 'https://api.bandwall.app',
      }),
    ).not.toThrow();
  });

  it('treats an empty value as unset', () => {
    expect(() => validateEnv({ ...minimal, LOG_LEVEL: '' })).not.toThrow();
  });

  it('rejects an unknown log level', () => {
    expect(() => validateEnv({ ...minimal, LOG_LEVEL: 'loud' })).toThrow(
      /LOG_LEVEL/,
    );
  });
});

describe('logLevelsFrom', () => {
  it('includes the level and everything more severe', () => {
    expect(logLevelsFrom('warn')).toEqual(['error', 'warn']);
    expect(logLevelsFrom('debug')).toEqual(['error', 'warn', 'log', 'debug']);
  });
});
