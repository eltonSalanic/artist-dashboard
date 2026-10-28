import { ActivityTypes } from './enums';
import { activityText, activityTaskId } from './activity-text';

const row = (type: string, meta: Record<string, unknown> = {}) => ({ type, meta });

describe('activityText', () => {
  it('says something for every activity type that exists', () => {
    // The fallback is for rows written by a newer build, not for types this
    // one already knows about — so none of them may fall through to it.
    for (const type of ActivityTypes) {
      expect({ type, text: activityText(row(type)) }).not.toEqual({
        type,
        text: 'did something',
      });
    }
  });

  it('reads the denormalised titles', () => {
    expect(activityText(row('TASK_COMPLETED', { taskTitle: 'Mix the EP' }))).toBe(
      'completed “Mix the EP”',
    );
    expect(
      activityText(row('STATUS_CHANGED', {
        taskTitle: 'Book the van',
        fromStatus: 'To Do',
        toStatus: 'Doing',
      })),
    ).toBe('moved “Book the van” from To Do to Doing');
    expect(
      activityText(row('SHOW_STATUS_CHANGED', {
        eventTitle: 'Bottom of the Hill',
        fromStatus: 'Hold',
        toStatus: 'Confirmed',
      })),
    ).toBe('moved “Bottom of the Hill” from Hold to Confirmed');
  });

  it('distinguishes a task from a subtask', () => {
    expect(activityText(row('TASK_CREATED', { taskTitle: 'A', isSubtask: true })))
      .toBe('created subtask “A”');
    expect(activityText(row('TASK_CREATED', { taskTitle: 'A' })))
      .toBe('created task “A”');
  });

  // Both member events mean two different things depending on one flag.
  it('separates joining the board from being assigned a task', () => {
    expect(activityText(row('MEMBER_ASSIGNED', { joinedBoard: true })))
      .toBe('joined the board');
    expect(activityText(row('MEMBER_ASSIGNED', { memberName: 'Dana', taskTitle: 'Setlist' })))
      .toBe('assigned Dana to “Setlist”');
    expect(activityText(row('MEMBER_REMOVED', { removedFromBoard: true, memberName: 'Sam' })))
      .toBe('removed Sam from the board');
    expect(activityText(row('MEMBER_REMOVED', { memberName: 'Sam', taskTitle: 'Setlist' })))
      .toBe('removed Sam from “Setlist”');
  });

  it('mentions the task on an upload only when there is one', () => {
    expect(activityText(row('FILE_UPLOADED', { fileName: 'rider.pdf' })))
      .toBe('attached rider.pdf');
    expect(activityText(row('FILE_UPLOADED', { fileName: 'rider.pdf', taskTitle: 'Advance' })))
      .toBe('attached rider.pdf to “Advance”');
    expect(activityText(row('FILE_UPLOADED', { fileName: 'rider.pdf', eventTitle: 'The Echo' })))
      .toBe('attached rider.pdf to “The Echo”');
  });

  // `meta` is whatever the build that wrote the row put there. A missing field
  // must read as vague, never as "undefined" or an empty quote.
  it('falls back rather than printing undefined', () => {
    expect(activityText(row('TASK_COMPLETED'))).toBe('completed “a task”');
    expect(activityText(row('GOAL_COMPLETED', { goalTitle: '' })))
      .toBe('completed goal “a goal”');
    expect(activityText(row('MEMBER_ASSIGNED', { taskTitle: 'X' })))
      .toBe('assigned someone to “X”');
    expect(activityText(row('TASK_COMPLETED', { taskTitle: 42 })))
      .toBe('completed “a task”');
  });

  it('is vague about a type it has never seen', () => {
    expect(activityText(row('SOMETHING_FROM_THE_FUTURE'))).toBe('did something');
  });
});

describe('activityTaskId', () => {
  it('returns the id only when it is a string', () => {
    expect(activityTaskId(row('COMMENT_ADDED', { taskId: 't1' }))).toBe('t1');
    expect(activityTaskId(row('COMMENT_ADDED'))).toBeNull();
    expect(activityTaskId(row('COMMENT_ADDED', { taskId: 7 }))).toBeNull();
  });
});
