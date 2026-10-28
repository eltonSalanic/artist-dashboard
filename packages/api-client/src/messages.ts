import { ApiError, NetworkError } from './client';

/**
 * Turns any thrown value into one sentence a user can act on. Every hook's
 * `onError` and every inline error state goes through here, so wording is
 * decided once instead of per feature, and raw transport text ("Failed to
 * fetch", "Internal server error", "Validation failed") never reaches a user.
 */
export const MESSAGES = {
  offline: "Can't reach Band Wall. Check your connection and try again.",
  sessionExpired: 'Your session expired. Please sign in again.',
  forbidden: "You don't have permission to do that.",
  notFound: 'That item no longer exists. It may have been deleted.',
  rateLimited: 'Too many tries. Wait a moment and try again.',
  server: 'Something went wrong on our end. Try again in a moment.',
  generic: 'Something went wrong. Try again.',
} as const;

// Nest's built-in exception texts: technically user-safe but meaningless to a
// user, so they get the status-based copy instead.
const NEST_DEFAULTS = new Set([
  'Bad Request',
  'Unauthorized',
  'Forbidden',
  'Forbidden resource',
  'Not Found',
  'Conflict',
  'Internal server error',
  'Internal Server Error',
]);

function isNestDefault(message: string): boolean {
  return (
    NEST_DEFAULTS.has(message) ||
    /^Cannot (GET|POST|PATCH|PUT|DELETE) /.test(message) ||
    /^Request failed \(\d+\)$/.test(message)
  );
}

/** "items.0.amount" → "Amount". */
function fieldLabel(path: string): string {
  const last = path.split('.').filter((p) => !/^\d+$/.test(p)).pop() ?? '';
  const words = last.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function toUserMessage(
  error: unknown,
  fallback: string = MESSAGES.generic,
): string {
  if (error instanceof NetworkError) return MESSAGES.offline;
  if (!(error instanceof ApiError)) return fallback;

  const [issue] = error.issues;
  if (issue) {
    const label = fieldLabel(issue.path);
    return label ? `${label}: ${issue.message}` : issue.message;
  }
  if (error.status === 401) return MESSAGES.sessionExpired;
  if (error.status === 429) return MESSAGES.rateLimited;
  if (error.status >= 500) return MESSAGES.server;
  if (error.message && !isNestDefault(error.message)) return error.message;
  if (error.status === 403) return MESSAGES.forbidden;
  if (error.status === 404) return MESSAGES.notFound;
  return fallback;
}

/** True for a 404 — lets a detail view say "deleted" only when it was. */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * Errors worth sending to an error reporter: bugs and server faults, not a
 * user being offline or failing validation.
 */
export function isUnexpectedError(error: unknown): boolean {
  if (error instanceof NetworkError) return false;
  if (error instanceof ApiError) return error.status >= 500;
  return !(error instanceof Error && error.name === 'AbortError');
}
