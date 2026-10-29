import { ApiError, NetworkError } from "./client";

/**
 * Turns any thrown value into one sentence a user can act on. Every hook's
 * `onError` and every inline error state goes through here, so wording is
 * decided once instead of per feature, and raw transport text ("Failed to
 * fetch", "Internal server error", "Validation failed") never reaches a user.
 */
export const MESSAGES = {
  offline: "Can't reach Band Wall. Check your connection and try again.",
  sessionExpired: "Your session expired. Please sign in again.",
  forbidden: "You don't have permission to do that.",
  notFound: "That item no longer exists. It may have been deleted.",
  rateLimited: "Too many tries. Wait a moment and try again.",
  server: "Something went wrong on our end. Try again in a moment.",
  generic: "Something went wrong. Try again.",
} as const;

// Nest's built-in exception texts: technically user-safe but meaningless to a
// user, so they get the status-based copy instead.
const NEST_DEFAULTS = new Set([
  "Bad Request",
  "Unauthorized",
  "Forbidden",
  "Forbidden resource",
  "Not Found",
  "Conflict",
  "Internal server error",
  "Internal Server Error",
]);

function isNestDefault(message: string): boolean {
  return (
    NEST_DEFAULTS.has(message) ||
    /^Cannot (GET|POST|PATCH|PUT|DELETE) /.test(message) ||
    /^Request failed \(\d+\)$/.test(message)
  );
}

function isZodDefault(message: string): boolean {
  return /^(Invalid input|Invalid option|Invalid string|Too small|Too big)\b/.test(
    message,
  );
}

/** "items.0.amount" → "Amount". */
function fieldLabel(path: string): string {
  const last =
    path
      .split(".")
      .filter((p) => !/^\d+$/.test(p))
      .pop() ?? "";
  const words = last.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
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
    // Zod's built-in wording ("Invalid input: expected string, received
    // undefined") is for developers; schemas with their own message keep it.
    const message = isZodDefault(issue.message)
      ? "is missing or not valid."
      : issue.message;
    if (!label) return isZodDefault(issue.message) ? MESSAGES.generic : message;
    return isZodDefault(issue.message)
      ? `${label} ${message}`
      : `${label}: ${message}`;
  }
  // A code the API chose itself carries a message written for users, even on
  // a 5xx (e.g. the invite email provider failing).
  if (error.code && error.code !== "INTERNAL" && error.message) {
    return error.message;
  }
  if (error.status === 401) return MESSAGES.sessionExpired;
  if (error.status === 429) return MESSAGES.rateLimited;
  if (error.status >= 500) return MESSAGES.server;
  if (error.message && !isNestDefault(error.message)) return error.message;
  if (error.status === 403) return MESSAGES.forbidden;
  if (error.status === 404) return MESSAGES.notFound;
  return fallback;
}

/**
 * Query `meta` for a screen that shows its own error state (a detail modal,
 * the dashboard, the app shell). Apps skip their global "couldn't load" toast
 * for these, so the user isn't told the same thing twice.
 */
export const INLINE_ERROR = { inlineError: true } as const;

export function showsInlineError(meta: unknown): boolean {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    (meta as { inlineError?: unknown }).inlineError === true
  );
}

/** True for a 404 — lets a detail view say "deleted" only when it was. */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * A 5xx the API already reported (with its stack, user and request id). The
 * apps skip these so one failure isn't counted twice against the quota; the
 * shared trace still links the browser or phone to the API's report.
 */
export function isReportedByServer(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 500;
}

/**
 * Errors worth sending to an error reporter: bugs and server faults, not a
 * user being offline or failing validation.
 */
export function isUnexpectedError(error: unknown): boolean {
  if (error instanceof NetworkError) return false;
  if (error instanceof ApiError) return error.status >= 500;
  return !(error instanceof Error && error.name === "AbortError");
}

/**
 * Auth failures, worded for people. Every `AuthClient` reports failures in
 * this shape; the codes below are Better Auth's, the provider in use.
 */
export interface AuthErrorLike {
  name?: string;
  code?: string;
  status?: number;
  message: string;
}

const ACCOUNT_EXISTS =
  "An account with that email already exists. Sign in instead.";
const CODE_FAILED =
  "That code doesn't work: check it against the email. Codes expire after an hour and work once; your band admin can invite you again.";

const AUTH_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "That email and password don't match. Try again.",
  INVALID_EMAIL: "Enter a valid email address.",
  EMAIL_NOT_VERIFIED:
    "Confirm your email first. Check your inbox for the link.",
  USER_ALREADY_EXISTS: ACCOUNT_EXISTS,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: ACCOUNT_EXISTS,
  PASSWORD_TOO_SHORT: "Choose a stronger password: at least 8 characters.",
  PASSWORD_TOO_LONG: "That password is too long. Use 128 characters or fewer.",
  INVALID_OTP: CODE_FAILED,
  OTP_EXPIRED: CODE_FAILED,
  TOO_MANY_ATTEMPTS: CODE_FAILED,
};

export function authErrorMessage(
  error: AuthErrorLike,
  fallback: string = MESSAGES.generic,
): string {
  if (error.code && AUTH_MESSAGES[error.code]) return AUTH_MESSAGES[error.code];
  // The API words its own refusals (e.g. a password that's already set).
  if (error.code === "AUTH_REJECTED") return error.message;
  // Every AuthClient reports an unreachable server as status 0.
  if (error.status === 0) return MESSAGES.offline;
  if (error.status === 429) return MESSAGES.rateLimited;
  return fallback;
}
