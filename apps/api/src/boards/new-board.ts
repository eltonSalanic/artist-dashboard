import {
  DEFAULT_BOARD_LAYOUT,
  DEFAULT_SHOW_STATUSES,
  DEFAULT_TASK_STATUSES,
  type BoardPalette,
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
  palette?: BoardPalette,
): Prisma.BoardCreateInput {
  return {
    name,
    // The palette picked while naming the band, if any; otherwise the
    // default theme applies (an empty theme reads as `DEFAULT_BOARD_THEME`).
    ...(palette && { theme: { palette, widgets: {} } }),
    defaultLayout: DEFAULT_BOARD_LAYOUT as unknown as Prisma.InputJsonValue,
    owner: { connect: { id: ownerId } },
    memberships: { create: { userId: ownerId, role: 'ADMIN' } },
    statuses: { create: DEFAULT_TASK_STATUSES },
    showStatuses: { create: DEFAULT_SHOW_STATUSES },
  };
}
