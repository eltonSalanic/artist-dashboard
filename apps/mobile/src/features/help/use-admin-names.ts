import { useBoard, useMe } from '@artist/api-client';

/**
 * The band's admins by name, without the person looking: who to ask when
 * something takes an admin. Empty while the band is still loading.
 */
export function useAdminNames(boardId: string | null | undefined): string[] {
  const board = useBoard(boardId);
  const me = useMe(true);
  const myId = me.data?.user.id;
  return (board.data?.members ?? [])
    .filter((member) => member.role === 'ADMIN' && member.userId !== myId)
    .map((member) => member.displayName);
}
