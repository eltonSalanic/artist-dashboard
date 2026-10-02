import { narrowToBoard } from './narrow-to-board';

describe('narrowToBoard', () => {
  const authorised = ['b1', 'b2'];

  it('passes the whole set through with no filter', () => {
    expect(narrowToBoard(authorised, undefined)).toEqual(['b1', 'b2']);
  });

  it('narrows to a board the caller belongs to', () => {
    expect(narrowToBoard(authorised, 'b2')).toEqual(['b2']);
  });

  /**
   * The reason this is a filter and not `query.boardId ?? boardIds`. That form
   * hands a client-supplied id straight into the `where` clause and makes the
   * tenancy boundary depend on a membership check nobody wrote. Here it
   * intersects to nothing.
   */
  it('yields nothing for a board the caller does not belong to', () => {
    expect(narrowToBoard(authorised, 'b9')).toEqual([]);
  });

  it('cannot widen an empty set', () => {
    expect(narrowToBoard([], 'b1')).toEqual([]);
  });
});
