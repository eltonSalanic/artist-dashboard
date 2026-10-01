/** A push notification ready to leave the building, already addressed. */
export interface OutgoingPush {
  /** Every live Expo token for the recipient — one person can have several installs. */
  tokens: string[];
  title: string;
  body: string;
  /**
   * Payload the app reads on tap to deep-link straight to the thing this is
   * about, rather than dumping the user on the board root.
   */
  data?: Record<string, string>;
  /**
   * The delivery's `dedupeKey`, passed to Expo as `collapseId`.
   *
   * Named for what it is used for, not for a guarantee it provides: Expo's
   * message format has no idempotency key, so this does not prevent a repeat
   * send — it only makes the repeat replace the earlier notification on the
   * device instead of stacking beside it.
   */
  idempotencyKey: string;
}

/**
 * Tokens Expo told us are dead. The dispatcher deletes these rather than
 * retrying: unlike a bounced address, an unregistered device is permanent and
 * the row would only make every later send slower.
 */
export interface PushResult {
  invalidTokens: string[];
}

/**
 * The push counterpart to MailTransport. Kept as its own interface rather than
 * one generic Transport because the two have genuinely different shapes — mail
 * has a subject, HTML and an unsubscribe header; push has a token list and
 * reports back which tokens died.
 */
export interface PushTransport {
  send(push: OutgoingPush): Promise<PushResult>;
}

export const PUSH_TRANSPORT = Symbol('PUSH_TRANSPORT');
