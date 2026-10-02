/**
 * What a drag from `from` to `to` means to the API.
 *
 * The reorder endpoint takes "put this task after that one" rather than an
 * index, so a move made against a stale list still lands next to the task the
 * person dropped it beside. Null for a drop where it started — no request.
 */
export function planMove(
  ids: readonly string[],
  from: number,
  to: number,
): { ids: string[]; taskId: string; afterTaskId: string | null } | null {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) {
    return null;
  }
  const next = [...ids];
  const [taskId] = next.splice(from, 1);
  next.splice(to, 0, taskId);
  return { ids: next, taskId, afterTaskId: to === 0 ? null : next[to - 1] };
}
