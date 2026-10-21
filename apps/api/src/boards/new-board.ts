import { DEFAULT_BOARD_LAYOUT, DEFAULT_TASK_STATUSES } from '@artist/shared';
import { Prisma } from '../../generated/prisma/client';

/**
 * A new band: the default layout and statuses, with its creator as the only
 * admin. Shared by first sign-in (bootstrap) and "Create a band", so the two
 * can never hand out differently shaped boards.
 */
export function newBoardData(
  name: string,
  adminId: string,
): Prisma.BoardCreateInput {
  return {
    name,
    defaultLayout: DEFAULT_BOARD_LAYOUT as unknown as Prisma.InputJsonValue,
    memberships: { create: { userId: adminId, role: 'ADMIN' } },
    statuses: { create: DEFAULT_TASK_STATUSES },
  };
}
