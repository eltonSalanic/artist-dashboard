/**
 * Where a tapped notification should land.
 *
 * Pure, so the mapping is tested without a phone. The payload is the API's
 * `deepLinkData()` (dispatcher.service.ts): `boardId` and `template` always,
 * plus whichever of `taskId` / `eventId` the trigger was about.
 *
 * Decided by the ids present rather than by template name, so a trigger added
 * later still opens its entity without this file learning its name. The one
 * template that needs naming is the reminder, which carries no id — reminders
 * have no detail screen, so it opens the band's Reminders spoke.
 *
 * The payload arrives from outside the app, so nothing about it is trusted: a
 * missing or non-string board id means there is nowhere to go, and ids are
 * encoded into the path rather than spliced in raw.
 */
export interface PushDestination {
  /** The band the notification is about — selected before navigating. */
  boardId: string;
  /** Route to push, or `null` for the band's hub itself. */
  href: string | null;
}

function field(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function pushDestination(data: unknown): PushDestination | null {
  if (typeof data !== 'object' || data === null) return null;
  const payload = data as Record<string, unknown>;

  const boardId = field(payload, 'boardId');
  if (boardId === null) return null;
  const board = `/board/${encodeURIComponent(boardId)}`;

  const taskId = field(payload, 'taskId');
  if (taskId !== null) {
    return { boardId, href: `${board}/task/${encodeURIComponent(taskId)}` };
  }

  const eventId = field(payload, 'eventId');
  if (eventId !== null) {
    return { boardId, href: `${board}/event/${encodeURIComponent(eventId)}` };
  }

  if (field(payload, 'template') === 'reminder-due') {
    return { boardId, href: `${board}/w/REMINDERS` };
  }

  return { boardId, href: null };
}
