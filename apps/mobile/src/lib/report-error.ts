import { isUnexpectedError } from '@artist/api-client';

type Reporter = (error: unknown, context?: Record<string, unknown>) => void;

let reporter: Reporter | null = null;

/** Set once an error reporting service is configured. */
export function setErrorReporter(next: Reporter): void {
  reporter = next;
}

/**
 * Mobile's one exit for errors nobody expected: bugs and server faults, not a
 * phone dropping signal or a failed validation. Dev builds log the full error;
 * every build forwards to the reporter when one is set.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!isUnexpectedError(error)) return;
  if (__DEV__) console.warn('[report-error]', error, context ?? '');
  try {
    reporter?.(error, context);
  } catch {
    // A broken reporter must never turn one error into two.
  }
}
