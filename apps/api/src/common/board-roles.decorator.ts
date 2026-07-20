import { SetMetadata } from '@nestjs/common';
import type { BoardRole } from '@artist/shared';

export const BOARD_ROLE_KEY = 'boardRole';

/**
 * Minimum board role required for the route. 'USER' means any member of the
 * board; 'ADMIN' means an admin membership. The route must expose the board
 * id as the `:boardId` param (or `:id` on /boards routes).
 */
export const BoardRoles = (role: BoardRole) => SetMetadata(BOARD_ROLE_KEY, role);
