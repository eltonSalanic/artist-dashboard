import { isUnexpectedError } from "@artist/api-client";

type Reporter = (error: unknown, context?: Record<string, unknown>) => void;

let reporter: Reporter | null = null;

/** Set once an error reporting service is configured (see instrumentation). */
export function setErrorReporter(next: Reporter): void {
  reporter = next;
}

/**
 * The web app's one exit for errors nobody expected: bugs and server faults,
 * not offline users or validation. Dev gets the full error in the console;
 * every environment forwards to the reporter when one is set.
 */
export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!isUnexpectedError(error)) return;
  if (process.env.NODE_ENV !== "production") {
    console.error("[report-error]", error, context ?? "");
  }
  try {
    reporter?.(error, context);
  } catch {
    // A broken reporter must never turn one error into two.
  }
}
