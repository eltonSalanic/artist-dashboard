import { resolveUserBoards } from './user-boards.decorator';
import type { AuthedRequest } from './authed-request';

const request = (partial: Partial<AuthedRequest>): AuthedRequest =>
  partial as AuthedRequest;

describe('resolveUserBoards', () => {
  it('returns the ids the guard attached', () => {
    expect(resolveUserBoards(request({ userBoardIds: ['b1', 'b2'] }))).toEqual([
      'b1',
      'b2',
    ]);
  });

  it('passes an empty list through — belonging to no board is legitimate', () => {
    expect(resolveUserBoards(request({ userBoardIds: [] }))).toEqual([]);
  });

  /**
   * The one that matters. Prisma treats `{ in: undefined }` as *no* filter —
   * verified against the dev database, where it returned every board while
   * `{ in: [] }` returned none. Handing back `undefined` would turn a forgotten
   * guard into a query across every band in the system.
   */
  it('throws rather than return undefined when the guard did not run', () => {
    expect(() => resolveUserBoards(request({}))).toThrow(/UserBoardsGuard/);
  });

  it('throws when the attached value is not an array', () => {
    expect(() =>
      resolveUserBoards(request({ userBoardIds: 'b1' as never })),
    ).toThrow(/UserBoardsGuard/);
  });
});
