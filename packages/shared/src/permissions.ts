import type { BoardRole } from './enums';

export const Actions = [
  'task.view',
  'task.create',
  'task.editFields',
  'task.delete',
  'task.changeStatus',
  'task.createSubtask',
  'task.comment',
  'file.upload',
  'member.invite',
  'widget.manage',
  'board.appearance',
  'status.manage',
  'event.manage',
  'goal.manage',
  'reminder.manage',
  'focus.manage',
] as const;
export type Action = (typeof Actions)[number];

const USER_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  'task.view',
  'task.changeStatus',
  'task.createSubtask',
  'task.comment',
  'file.upload',
]);

export function can(role: BoardRole, action: Action): boolean {
  if (role === 'ADMIN') return true;
  return USER_ACTIONS.has(action);
}
