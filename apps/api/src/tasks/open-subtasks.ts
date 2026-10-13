/** A task as far as "is anything under it still open" needs it. */
export interface SubtaskNode {
  archivedAt?: Date | null;
  status: { isDone: boolean };
  subtasks?: SubtaskNode[];
}

/**
 * Open, live tasks in these subtrees, at any depth — what completing their
 * parent (or the goal they hang off) would finish.
 *
 * A done subtask is still descended into: subtasks nest two levels, and one
 * ticked off early can sit over a sub-subtask that is not. Archived ones are
 * skipped with everything under them; they are off the board and completing
 * never reaches them.
 */
export function countOpen(nodes: SubtaskNode[]): number {
  return nodes.reduce((open, node) => {
    if (node.archivedAt) return open;
    return open + (node.status.isDone ? 0 : 1) + countOpen(node.subtasks ?? []);
  }, 0);
}
