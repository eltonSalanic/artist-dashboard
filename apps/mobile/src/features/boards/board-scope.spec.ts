import { scopeFromStored } from './board-scope';

const boards = [{ id: 'b1' }, { id: 'b2' }];

describe('scopeFromStored', () => {
  it('keeps a filter the person is still a member of', () => {
    expect(scopeFromStored('b2', boards)).toBe('b2');
  });

  it('means "all bands" when nothing is stored', () => {
    expect(scopeFromStored(undefined, boards)).toBeUndefined();
  });

  /**
   * The case that cannot be reached by using the app: the stored id outlives the
   * membership. Trusting it would ask the server to filter by a board it
   * intersects down to nothing, leaving a permanently empty list with no way to
   * tell why.
   */
  it('falls back to all bands when the stored board is gone', () => {
    expect(scopeFromStored('b9', boards)).toBeUndefined();
  });

  // Signed in, bootstrap still running: no boards yet, so no filter can apply.
  it('falls back while the board list is empty', () => {
    expect(scopeFromStored('b1', [])).toBeUndefined();
  });
});
