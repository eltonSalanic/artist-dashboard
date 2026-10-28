import type { ActivityType } from './enums';

/**
 * A feed row as a sentence.
 *
 * Built entirely from the row's denormalised `meta` — the feed never joins back
 * to live records, so an entry still reads correctly after its subject is
 * renamed or deleted. That is also why every field is read defensively: `meta`
 * is whatever the build that wrote it put there.
 *
 * Shared because two platforms describing the same event differently would be
 * a bug nobody would think to look for. Icons stay per-platform: web draws
 * lucide, native draws SF Symbols or Material.
 */
export interface ActivityRow {
  type: ActivityType | string;
  meta: Record<string, unknown>;
}

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value !== '' ? value : fallback;

/** The sentence **without the actor's name** — the caller prepends it. */
export function activityText(item: ActivityRow): string {
  const m = item.meta;
  switch (item.type) {
    case 'TASK_CREATED':
      return `created ${m.isSubtask ? 'subtask' : 'task'} “${str(m.taskTitle, 'a task')}”`;
    case 'TASK_COMPLETED':
      return `completed “${str(m.taskTitle, 'a task')}”`;
    case 'STATUS_CHANGED':
      return `moved “${str(m.taskTitle, 'a task')}” from ${str(m.fromStatus)} to ${str(m.toStatus)}`;
    case 'MEMBER_ASSIGNED':
      return m.joinedBoard
        ? 'joined the board'
        : `assigned ${str(m.memberName, 'someone')} to “${str(m.taskTitle, 'a task')}”`;
    case 'MEMBER_REMOVED':
      return m.removedFromBoard
        ? `removed ${str(m.memberName, 'someone')} from the board`
        : `removed ${str(m.memberName, 'someone')} from “${str(m.taskTitle, 'a task')}”`;
    case 'GOAL_COMPLETED':
      return `completed goal “${str(m.goalTitle, 'a goal')}”`;
    case 'FILE_UPLOADED':
      if (m.isReceipt) return 'added a receipt';
      return `attached ${str(m.fileName, 'a file')}${
        m.taskTitle
          ? ` to “${str(m.taskTitle)}”`
          : m.eventTitle
            ? ` to “${str(m.eventTitle)}”`
            : ''
      }`;
    case 'COMMENT_ADDED':
      return `commented on “${str(m.taskTitle, 'a task')}”`;
    case 'FINANCE_ENTRY_ADDED':
      return `logged ${m.kind === 'INCOME' ? 'income' : 'an expense'}${
        m.label ? ` “${str(m.label)}”` : ''
      }${m.amount ? ` of ${str(m.amount)}` : ''}`;
    case 'SHOW_SETTLED':
      return `settled the money for “${str(m.eventTitle, 'a show')}”`;
    case 'SHOW_STATUS_CHANGED':
      return `moved “${str(m.eventTitle, 'a show')}” from ${str(m.fromStatus)} to ${str(m.toStatus)}`;
    case 'PAYOUT_RECORDED':
      return `recorded a payment ${
        m.toBand ? 'from' : 'to'
      } ${str(m.memberName, 'a member')}${m.amount ? ` of ${str(m.amount)}` : ''}`;
    default:
      // A row written by a newer build than this one. Saying something vague is
      // better than an empty line or a crash.
      return 'did something';
  }
}

/** Task id an entry points at, if any — lets a row deep-link to the task. */
export function activityTaskId(item: ActivityRow): string | null {
  return typeof item.meta.taskId === 'string' ? item.meta.taskId : null;
}
