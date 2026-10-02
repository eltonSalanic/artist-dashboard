/**
 * `boxShadow` strings, not the legacy `shadowOffset`/`elevation` props — those
 * are two different APIs that need writing twice and still disagree.
 *
 * Three levels is enough. The canvas is a warm cream, so shadows stay soft:
 * a hard black drop on that background reads as a web page.
 */
export const shadows = {
  card: '0 1px 2px rgba(0, 0, 0, 0.05)',
  raised: '0 4px 12px rgba(0, 0, 0, 0.10)',
  overlay: '0 8px 24px rgba(0, 0, 0, 0.18)',
} as const;
