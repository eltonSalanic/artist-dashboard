/**
 * Log-safe stand-ins for personal data. Logs leave the database's access
 * controls (they go to the host's log viewer and any drain behind it), so an
 * address or device token is written in a form that still tells two apart but
 * can't be used.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

export function maskToken(token: string): string {
  return token.length <= 8 ? '***' : `${token.slice(0, 4)}…${token.slice(-4)}`;
}
