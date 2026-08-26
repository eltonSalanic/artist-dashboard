/** A message ready to leave the building — already rendered, already addressed. */
export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  /** Always sent alongside the HTML. A mail with no text part looks like spam. */
  text: string;
  /**
   * The delivery's `dedupeKey`. Our unique index stops us queueing the same
   * mail twice; this stops the *provider* sending twice when we crash between
   * a successful send and recording it.
   */
  idempotencyKey: string;
  /** Feeds the List-Unsubscribe header, which Gmail surfaces as a UI button. */
  unsubscribeUrl: string;
}

/**
 * The seam between "we decided to send this" and "this went somewhere". Resend
 * is an HTTP API and Mailpit is an SMTP server, so these are genuinely
 * different protocols rather than one endpoint with two hostnames.
 */
export interface MailTransport {
  send(mail: OutgoingMail): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
