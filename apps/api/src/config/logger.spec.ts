import { logFormatFrom } from './logger';

describe('logFormatFrom', () => {
  it('is readable locally, even pointed at staging', () => {
    expect(logFormatFrom({})).toBe('pretty');
    expect(logFormatFrom({ APP_ENV: 'staging' })).toBe('pretty');
  });

  it('is JSON on Railway', () => {
    expect(logFormatFrom({ RAILWAY_PROJECT_ID: 'p' })).toBe('json');
  });

  it('follows LOG_FORMAT when set', () => {
    expect(logFormatFrom({ LOG_FORMAT: 'json' })).toBe('json');
    expect(
      logFormatFrom({ RAILWAY_PROJECT_ID: 'p', LOG_FORMAT: 'pretty' }),
    ).toBe('pretty');
  });
});
