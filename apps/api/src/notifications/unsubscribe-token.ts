import { createHmac, timingSafeEqual } from 'node:crypto';
import type { EmailCategory } from '../../generated/prisma/client';

export interface UnsubscribeClaims {
  userId: string;
  boardId: string;
  category: EmailCategory;
}

const encode = (claims: UnsubscribeClaims) =>
  Buffer.from(
    `${claims.userId}:${claims.boardId}:${claims.category}`,
    'utf8',
  ).toString('base64url');

/**
 * A one-click unsubscribe has to work from an email client with no session, so
 * the link carries its own proof. HMAC over the three claims: enough to turn
 * off exactly one category for one person on one board, and useless for
 * anything else.
 */
export function signUnsubscribeToken(
  claims: UnsubscribeClaims,
  secret: string,
): string {
  const body = encode(claims);
  const mac = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

/** Returns null for anything tampered with, truncated, or malformed. */
export function verifyUnsubscribeToken(
  token: string,
  secret: string,
): UnsubscribeClaims | null {
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;

  const expected = createHmac('sha256', secret)
    .update(body)
    .digest('base64url');
  const given = Buffer.from(mac);
  const want = Buffer.from(expected);
  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false.
  if (given.length !== want.length || !timingSafeEqual(given, want))
    return null;

  const [userId, boardId, category] = Buffer.from(body, 'base64url')
    .toString('utf8')
    .split(':');
  if (!userId || !boardId || !category) return null;
  return { userId, boardId, category: category as EmailCategory };
}
