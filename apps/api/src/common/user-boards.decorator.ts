import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthedRequest } from './authed-request';

/**
 * Pulls the guard-resolved board ids off a request, or refuses.
 *
 * Exported as a plain function, not buried in the decorator, so it can be unit
 * tested directly — the alternative is reaching into Nest's internals for the
 * wrapped factory, which breaks on upgrade and tests nothing useful.
 *
 * **Throws when the guard did not run**, and that is the whole point. Prisma
 * treats `{ in: undefined }` as *no* filter rather than an empty one — verified
 * against the dev database, where it returned every board while `{ in: [] }`
 * returned none. So a handler given `undefined` here would quietly query every
 * band in the system. Failing closed turns a forgotten
 * `@UseGuards(UserBoardsGuard)` into a 500 on the first request instead of a
 * silent cross-tenant leak.
 *
 * An empty array is a different thing and is legitimate: someone mid-invite
 * belongs to no board, `{ in: [] }` matches nothing, and they see nothing.
 */
export function resolveUserBoards(request: AuthedRequest): string[] {
  if (!Array.isArray(request.userBoardIds)) {
    throw new Error(
      'UserBoards() used on a route without UserBoardsGuard — refusing to ' +
        'run an unscoped query',
    );
  }
  return request.userBoardIds;
}

/** The board ids the caller may see, as resolved by `UserBoardsGuard`. */
export const UserBoards = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string[] =>
    resolveUserBoards(context.switchToHttp().getRequest<AuthedRequest>()),
);
