import { countOpen } from './open-subtasks';

describe('countOpen', () => {
  const open = { status: { isDone: false } };
  const done = { status: { isDone: true } };

  it('counts open tasks at every depth', () => {
    expect(
      countOpen([{ ...open, subtasks: [open, { ...open, subtasks: [open] }] }]),
    ).toBe(4);
  });

  it('looks under done tasks, which can hold open ones', () => {
    expect(
      countOpen([{ ...done, subtasks: [done, { ...done, subtasks: [open] }] }]),
    ).toBe(1);
  });

  it('skips archived tasks and everything under them', () => {
    expect(
      countOpen([
        { ...open, archivedAt: new Date(), subtasks: [open, open] },
        open,
      ]),
    ).toBe(1);
  });

  it('is zero for nothing', () => {
    expect(countOpen([])).toBe(0);
  });
});
