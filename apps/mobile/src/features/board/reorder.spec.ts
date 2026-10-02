import { planMove } from './reorder';

const ids = ['a', 'b', 'c', 'd'];

describe('planMove', () => {
  it('moving down names the task it now follows', () => {
    expect(planMove(ids, 0, 2)).toEqual({
      ids: ['b', 'c', 'a', 'd'],
      taskId: 'a',
      afterTaskId: 'c',
    });
  });

  it('moving up names the task it now follows', () => {
    expect(planMove(ids, 3, 1)).toEqual({
      ids: ['a', 'd', 'b', 'c'],
      taskId: 'd',
      afterTaskId: 'a',
    });
  });

  // "After nothing" is how the API spells "first".
  it('moving to the top sends a null anchor', () => {
    expect(planMove(ids, 2, 0)?.afterTaskId).toBeNull();
  });

  it('moving to the bottom anchors on the old last task', () => {
    expect(planMove(ids, 0, 3)?.afterTaskId).toBe('d');
  });

  it('a drop where it started is no move at all', () => {
    expect(planMove(ids, 1, 1)).toBeNull();
  });

  it('refuses indexes outside the list', () => {
    expect(planMove(ids, -1, 2)).toBeNull();
    expect(planMove(ids, 0, 4)).toBeNull();
  });

  it('leaves the input alone', () => {
    const input = [...ids];
    planMove(input, 0, 3);
    expect(input).toEqual(ids);
  });
});
