import {
  DEFAULT_BOARD_LAYOUT,
  DEFAULT_SHOW_STATUSES,
  DEFAULT_TASK_STATUSES,
} from '@artist/shared';
import { Prisma } from '../../generated/prisma/client';

/**
 * A new band: the default layout and statuses, with its creator as the only
 * admin. Kept apart from the service so the demo seed and any future path
 * hand out the same shape of board as "Create a band".
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
    showStatuses: { create: DEFAULT_SHOW_STATUSES },
  };
}
