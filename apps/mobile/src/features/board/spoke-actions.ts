import type { Action, WidgetType } from '@artist/shared';

export interface SpokeAction {
  /** Spoken by a screen reader; the header shows a + or the word. */
  label: string;
  /** Where the header button goes. */
  href: string;
  /** Edit rather than add: the spoke has one thing, not a list of them. */
  edit?: boolean;
}

/**
 * The one header action each spoke offers, if the person may take it.
 *
 * Pure — the permission check is passed in — so which widget needs which
 * permission is tested, not just eyeballed. My Tasks offers nothing: a new
 * task there would need assigning to yourself, which is an admin's call, and
 * the To-Do spoke one swipe away already has the button.
 *
 * Finances is the one a member gets too: whoever bought the strings is the
 * one holding the receipt.
 */
export function spokeAction(
  type: WidgetType,
  boardId: string,
  can: (action: Action) => boolean,
): SpokeAction | null {
  const base = `/board/${boardId}/form`;
  switch (type) {
    case 'TODOS':
      return can('task.create') ? { label: 'New task', href: `${base}/task` } : null;
    case 'SHOWS':
      return can('event.manage') ? { label: 'New show', href: `${base}/event?type=SHOW` } : null;
    case 'NEXT_REHEARSALS':
      return can('event.manage')
        ? { label: 'New rehearsal', href: `${base}/event?type=REHEARSAL` }
        : null;
    case 'NEXT_MEETINGS':
      return can('event.manage')
        ? { label: 'New meeting', href: `${base}/event?type=MEETING` }
        : null;
    case 'REMINDERS':
      return can('reminder.manage') ? { label: 'New reminder', href: `${base}/reminder` } : null;
    case 'GOALS':
      return can('goal.manage') ? { label: 'New goal', href: `${base}/goal` } : null;
    case 'FOCUS':
      return can('focus.manage')
        ? { label: 'Edit focus', href: `${base}/focus`, edit: true }
        : null;
    case 'CUSTOM':
      return can('widget.manage')
        ? { label: 'Edit note', href: `${base}/note`, edit: true }
        : null;
    case 'FINANCES':
      return can('finance.create')
        ? { label: 'Log money', href: `${base}/finance` }
        : null;
    default:
      return null;
  }
}
