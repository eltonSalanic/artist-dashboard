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
  'link.add',
  'link.manage',
  'member.invite',
  'widget.manage',
  'board.appearance',
  'status.manage',
  'event.manage',
  'show.changeStatus',
  'goal.manage',
  'reminder.manage',
  'focus.manage',
  'archive.view',
  'item.archive',
  'finance.view',
  'finance.create',
  'finance.manage',
  'billing.view',
] as const;
export type Action = (typeof Actions)[number];

const USER_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  'task.view',
  'task.changeStatus',
  'task.createSubtask',
  'task.comment',
  // Whoever got the set time from the promoter can move the show along, the
  // way anyone can move a task. Renaming statuses and editing the show itself
  // stay with admins ('status.manage', 'event.manage').
  'show.changeStatus',
  'file.upload',
  'link.add',
  // Everyone can browse the archive; only admins can move things in and out
  // of it ('item.archive') or delete them for good.
  'archive.view',
  // Bands that split money want everyone to see the books, and whoever bought
  // the strings is the one holding the receipt. Members may still only change
  // or void entries they logged themselves; 'finance.manage' (splits, payouts,
  // settling a show, anyone's entry) stays with admins.
  'finance.view',
  'finance.create',
  // Everyone in the band can see whether it's open. Paying is the owner's
  // alone, which isn't a role: `isOwner` on the board says who that is.
  'billing.view',
]);

export function can(role: BoardRole, action: Action): boolean {
  if (role === 'ADMIN') return true;
  return USER_ACTIONS.has(action);
}
