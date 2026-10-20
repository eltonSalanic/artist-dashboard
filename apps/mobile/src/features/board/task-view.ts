import type { Priority } from '@artist/shared';

/**
 * How a task list is sorted and narrowed (the To-Do and My Tasks screens).
 *
 * Plain values, so the screen keeps one object in state and the rules below
 * stay testable without a renderer. Sorting and every filter but "Open" go to
 * the API as query params; "Open" spans every status that is not done, which
 * the API has no param for, so it is applied to the rows that come back.
 */
export type TaskSort = 'order' | 'dueDate' | 'priority' | 'createdAt';

export interface TaskView {
  sort: TaskSort;
  /** `all`, `open` (any status not done), or one status's id. */
  status: string;
  priority: Priority | 'all';
  /** `all`, or one member's user id. */
  assignee: string;
}

export const SORT_LABELS: Record<TaskSort, string> = {
  order: 'Board order',
  dueDate: 'Due date',
  priority: 'Priority',
  createdAt: 'Newest',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export function defaultTaskView(sort: TaskSort): TaskView {
  return { sort, status: 'all', priority: 'all', assignee: 'all' };
}

/** The query params for a view. `assigneeId` a screen fixes (My Tasks) wins. */
export function taskQuery(
  view: TaskView,
  fixed: { assigneeId?: string } = {},
): {
  sort: TaskSort;
  statusId?: string;
  priority?: Priority;
  assigneeId?: string;
} {
  return {
    sort: view.sort,
    ...(view.status !== 'all' && view.status !== 'open' ? { statusId: view.status } : {}),
    ...(view.priority !== 'all' ? { priority: view.priority } : {}),
    ...(fixed.assigneeId
      ? { assigneeId: fixed.assigneeId }
      : view.assignee !== 'all'
        ? { assigneeId: view.assignee }
        : {}),
  };
}

/** The part of a view the API cannot apply, applied to what it returned. */
export function keepTask(view: TaskView, task: { status: { isDone: boolean } }): boolean {
  return view.status !== 'open' || !task.status.isDone;
}

/** How many filters are narrowing the list; the sort is not one. */
export function activeFilters(view: TaskView): number {
  return (
    Number(view.status !== 'all') +
    Number(view.priority !== 'all') +
    Number(view.assignee !== 'all')
  );
}

/**
 * Dragging rows sets the board's own order, so it is only offered when that
 * order is what is shown, all of it: with a filter on, a drop lands between
 * two visible tasks with hidden ones around them, somewhere nobody chose.
 */
export function canDragInView(view: TaskView): boolean {
  return view.sort === 'order' && activeFilters(view) === 0;
}
