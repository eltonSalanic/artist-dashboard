import { maskEmail, maskToken } from './redact';

describe('redact', () => {
  it('keeps only the first letter and domain of an email', () => {
    expect(maskEmail('elton@example.com')).toBe('e***@example.com');
    expect(maskEmail('not-an-email')).toBe('***');
  });

  it('keeps only the ends of a token', () => {
    expect(maskToken('ExponentPushToken[abcdefghijkl]')).toBe('Expo…jkl]');
    expect(maskToken('short')).toBe('***');
  });
});
