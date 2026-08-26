import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from './unsubscribe-token';

describe('unsubscribe tokens', () => {
  const secret = 'test-secret-at-least-32-characters-long';
  const claims = {
    userId: 'u1',
    boardId: 'b1',
    category: 'MENTIONS' as const,
  };

  it('round-trips the claims it was signed with', () => {
    const token = signUnsubscribeToken(claims, secret);
    expect(verifyUnsubscribeToken(token, secret)).toEqual(claims);
  });

  it('rejects a token signed with a different secret', () => {
    const token = signUnsubscribeToken(claims, 'some-other-secret-entirely');
    expect(verifyUnsubscribeToken(token, secret)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = signUnsubscribeToken(claims, secret);
    const forged = signUnsubscribeToken(
      { ...claims, category: 'REMINDERS' },
      secret,
    );
    // Swap in another category's body while keeping the original signature.
    const tampered = `${forged.split('.')[0]}.${token.split('.')[1]}`;
    expect(verifyUnsubscribeToken(tampered, secret)).toBeNull();
  });

  it.each(['', 'no-dot', 'a.b', '.'])('rejects malformed input %p', (token) => {
    expect(verifyUnsubscribeToken(token, secret)).toBeNull();
  });
});
