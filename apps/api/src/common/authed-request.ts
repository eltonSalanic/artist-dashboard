import type { Request } from 'express';
import type { Membership } from '../../generated/prisma/client';
import type { AuthUser } from '../auth/current-user.decorator';

/**
 * The request as it looks *after* our guards have run. `getRequest()` is
 * untyped (`any`), so every consumer that reaches for `user`, `params` or
 * `membership` asks for this shape explicitly instead.
 *
 * Both fields are optional because the request passes through here before the
 * guards populate them — the guard itself is what turns "missing" into a 404.
 */
export interface AuthedRequest extends Request {
  user?: AuthUser;
  membership?: Membership;
  /**
   * Boards the caller belongs to, set by `UserBoardsGuard` on cross-board
   * routes. Optional for the same reason as the others — and read only through
   * `@UserBoards()`, which refuses to hand over `undefined`.
   */
  userBoardIds?: string[];
}
