import { pushDestination } from './push-route';

const boardId = 'b-1';

describe('pushDestination', () => {
  it('opens the task a mention or assignment is about', () => {
    for (const template of ['comment-mention', 'task-assigned', 'task-unassigned']) {
      expect(pushDestination({ boardId, template, taskId: 't-1' })).toEqual({
        boardId,
        href: '/board/b-1/task/t-1',
      });
    }
  });

  it('opens the event a schedule change is about', () => {
    for (const template of ['event-created', 'event-moved']) {
      expect(pushDestination({ boardId, template, eventId: 'e-1' })).toEqual({
        boardId,
        href: '/board/b-1/event/e-1',
      });
    }
  });

  // Reminders carry no id and have no detail screen.
  it('opens the Reminders spoke for a due reminder', () => {
    expect(pushDestination({ boardId, template: 'reminder-due' })).toEqual({
      boardId,
      href: '/board/b-1/w/REMINDERS',
    });
  });

  // Keyed on ids, so a trigger added later still lands on its entity.
  it('follows the id for a template it has never heard of', () => {
    expect(pushDestination({ boardId, template: 'task-renamed', taskId: 't-9' })).toEqual({
      boardId,
      href: '/board/b-1/task/t-9',
    });
  });

  it('falls back to the band hub when there is nothing more specific', () => {
    expect(pushDestination({ boardId, template: 'something-new' })).toEqual({
      boardId,
      href: null,
    });
  });

  it('goes nowhere without a board', () => {
    expect(pushDestination({ template: 'comment-mention', taskId: 't-1' })).toBeNull();
    expect(pushDestination({ boardId: '', taskId: 't-1' })).toBeNull();
    expect(pushDestination({ boardId: 42 })).toBeNull();
    expect(pushDestination(null)).toBeNull();
    expect(pushDestination(undefined)).toBeNull();
    expect(pushDestination('b-1')).toBeNull();
  });

  // Ignores the wrong type rather than stringifying it into a path.
  it('ignores ids that are not strings', () => {
    expect(pushDestination({ boardId, taskId: 7, eventId: 'e-1' })).toEqual({
      boardId,
      href: '/board/b-1/event/e-1',
    });
  });

  it('encodes ids rather than splicing them into the path', () => {
    expect(pushDestination({ boardId: 'a/b', taskId: '../x' })).toEqual({
      boardId: 'a/b',
      href: '/board/a%2Fb/task/..%2Fx',
    });
  });
});
