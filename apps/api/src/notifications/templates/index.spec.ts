import { templates } from './index';

const ctx = {
  boardName: 'Neon Harbor',
  webUrl: 'https://band.test',
  unsubscribeUrl: 'https://band.test/unsubscribe',
  timezone: 'America/Los_Angeles',
};

// What every real payload carries, so templates that format a time can render.
const at = '2026-11-01T04:00:00.000Z';
const minimal = { startsAt: at, previousStartsAt: at, remindAt: at };

const pushFor = (template: string, payload: Record<string, unknown>) =>
  templates[template](payload, ctx).push;

describe('push copy', () => {
  // Every trigger needs its own: the fallback repeats the subject on a phone.
  it('exists for every trigger template', () => {
    for (const name of Object.keys(templates).filter(
      (n) => n !== 'diagnostic',
    )) {
      expect(pushFor(name, minimal)).toBeDefined();
    }
  });

  // The first device build showed the same sentence twice and no comment.
  it('puts the comment itself in a mention, not the subject again', () => {
    const push = pushFor('comment-mention', {
      actorName: 'tes',
      taskTitle: 'Contact venues for fall dates',
      excerpt: 'can you check this?',
    });
    expect(push).toEqual({
      title: 'tes mentioned you',
      body: 'On "Contact venues for fall dates": can you check this?',
    });
  });

  it('never ends a mention on a dangling colon when there is no excerpt', () => {
    expect(
      pushFor('comment-mention', { actorName: 'tes', taskTitle: 'Bio' })?.body,
    ).toBe('On "Bio"');
  });

  it('says who assigned a task, and when it is due', () => {
    expect(
      pushFor('task-assigned', {
        actorName: 'tes',
        taskTitle: 'Design the poster',
        dueDate: '2026-10-20T00:00:00.000Z',
      }),
    ).toMatchObject({ title: 'New task: Design the poster' });
    expect(
      pushFor('task-assigned', {
        actorName: 'tes',
        taskTitle: 'Design the poster',
      })?.body,
    ).toBe('tes assigned it to you.');
  });

  it('gives a new show its time and place', () => {
    const push = pushFor('event-created', {
      type: 'SHOW',
      title: 'The Echo',
      location: 'Los Angeles',
      startsAt: '2026-11-01T04:00:00.000Z',
    });
    expect(push?.title).toBe('New show: The Echo');
    expect(push?.body).toMatch(/ · Los Angeles$/);
  });

  it('says where a moved event went and where it was', () => {
    const push = pushFor('event-moved', {
      type: 'REHEARSAL',
      title: 'Full run',
      startsAt: '2026-11-02T03:00:00.000Z',
      previousStartsAt: '2026-11-01T03:00:00.000Z',
    });
    expect(push?.title).toBe('Rehearsal moved: Full run');
    expect(push?.body).toMatch(/^Now .+ \(was .+\)$/);
  });

  // It fires at the time it names; the band says which band it came from.
  it('gives a reminder its note, or the band when it has none', () => {
    expect(
      pushFor('reminder-due', {
        title: 'Load in',
        description: 'Bring the DI',
        remindAt: at,
      }),
    ).toEqual({
      title: 'Reminder: Load in',
      body: 'Bring the DI',
    });
    expect(
      pushFor('reminder-due', { title: 'Load in', remindAt: at })?.body,
    ).toBe('Neon Harbor');
  });
});
