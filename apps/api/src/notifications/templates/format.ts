/**
 * Email bodies are read outside the app, where there's no browser locale to
 * lean on — every timestamp is rendered in the board's own timezone and says
 * which one it is, so nobody has to work it out.
 */
const SAFE_ZONE = 'UTC';

const withZone = (timeZone: string, options: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone });
  } catch {
    // An unknown IANA name would otherwise throw mid-render and fail the send.
    return new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: SAFE_ZONE,
    });
  }
};

/** e.g. "Fri, Sep 4, 8:00 PM PDT" */
export function formatDateTime(value: Date | string, timeZone: string): string {
  return withZone(timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}

/** e.g. "Fri, Sep 4" — for dates where a time would be noise. */
export function formatDate(value: Date | string, timeZone: string): string {
  return withZone(timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}
