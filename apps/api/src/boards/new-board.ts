import {
  DEFAULT_BOARD_LAYOUT,
  DEFAULT_SHOW_STATUSES,
  DEFAULT_TASK_STATUSES,
} from '@artist/shared';
import { Prisma } from '../../generated/prisma/client';

/**
 * A new band: the default layout and statuses, with its creator as its owner
 * and only admin. Kept apart from the service so the demo seed and any future path
 * hand out the same shape of board as "Create a band".
 */
export function newBoardData(
  name: string,
  ownerId: string,
): Prisma.BoardCreateInput {
  return {
    name,
    defaultLayout: DEFAULT_BOARD_LAYOUT as unknown as Prisma.InputJsonValue,
    owner: { connect: { id: ownerId } },
    memberships: { create: { userId: ownerId, role: 'ADMIN' } },
    statuses: { create: DEFAULT_TASK_STATUSES },
    showStatuses: { create: DEFAULT_SHOW_STATUSES },
  };
}
