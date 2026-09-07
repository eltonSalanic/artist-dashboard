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
  /** The human link in the footer — a web page that explains and confirms. */
  unsubscribeUrl: string;
  /**
   * The List-Unsubscribe header target, which Gmail surfaces as a UI button
   * and then POSTs to directly (RFC 8058). It has to be an endpoint that
   * accepts POST with no session, so it points at the API, not the web app.
   */
  unsubscribePostUrl: string;
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
