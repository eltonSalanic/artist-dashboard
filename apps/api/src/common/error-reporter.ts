/**
 * Where unexpected server errors go besides the log. A no-op until an error
 * reporting service is configured, so callers never need to check whether
 * one is.
 */
export interface ErrorContext {
  requestId?: string;
  userId?: string;
  route?: string;
  [key: string]: unknown;
}

type Reporter = (error: unknown, context: ErrorContext) => void;

let reporter: Reporter = () => {};

export function setErrorReporter(next: Reporter): void {
  reporter = next;
}

export function reportError(error: unknown, context: ErrorContext = {}): void {
  try {
    reporter(error, context);
  } catch {
    // A broken reporter must never turn one error into two.
  }
}
