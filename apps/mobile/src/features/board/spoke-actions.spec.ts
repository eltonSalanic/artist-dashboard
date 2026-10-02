import { can, WidgetTypes, type BoardRole } from '@artist/shared';
import { spokeAction } from './spoke-actions';

const as = (role: BoardRole) => (action: Parameters<typeof can>[1]) => can(role, action);

describe('spokeAction', () => {
  // The shared map is the source of truth; this pins that the header reads it
  // and never offers a member a form the API would refuse.
  it('offers a member nothing anywhere', () => {
    for (const type of WidgetTypes) {
      expect(spokeAction(type, 'b1', as('USER'))).toBeNull();
    }
  });

  it('gives an admin the right form for each spoke', () => {
    const admin = as('ADMIN');
    expect(spokeAction('TODOS', 'b1', admin)?.href).toBe('/board/b1/form/task');
    expect(spokeAction('SHOWS', 'b1', admin)?.href).toBe('/board/b1/form/event?type=SHOW');
    expect(spokeAction('NEXT_REHEARSALS', 'b1', admin)?.href).toBe(
      '/board/b1/form/event?type=REHEARSAL',
    );
    expect(spokeAction('NEXT_MEETINGS', 'b1', admin)?.href).toBe(
      '/board/b1/form/event?type=MEETING',
    );
    expect(spokeAction('REMINDERS', 'b1', admin)?.href).toBe('/board/b1/form/reminder');
    expect(spokeAction('GOALS', 'b1', admin)?.href).toBe('/board/b1/form/goal');
    expect(spokeAction('FOCUS', 'b1', admin)).toMatchObject({
      href: '/board/b1/form/focus',
      edit: true,
    });
    expect(spokeAction('CUSTOM', 'b1', admin)).toMatchObject({
      href: '/board/b1/form/note',
      edit: true,
    });
  });

  it('offers nothing on spokes that have no form', () => {
    const admin = as('ADMIN');
    for (const type of ['MY_TASKS', 'ACTIVITY_FEED', 'CALENDAR'] as const) {
      expect(spokeAction(type, 'b1', admin)).toBeNull();
    }
  });
});
