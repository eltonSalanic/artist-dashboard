import { Actions, can } from './permissions';
import {
  ADMIN_ABILITIES,
  HELP_ABILITY_ACTIONS,
  HELP_TOPICS,
  HelpTopicIds,
  MEMBER_ABILITIES,
  adminOnlyMessage,
  orList,
  roleIntro,
} from './help';

describe('help copy', () => {
  it('sorts each ability under members or admins by the permission map', () => {
    expect(MEMBER_ABILITIES.length + ADMIN_ABILITIES.length).toBe(HELP_ABILITY_ACTIONS.length);
    expect(MEMBER_ABILITIES).toHaveLength(
      HELP_ABILITY_ACTIONS.filter((action) => can('USER', action)).length,
    );
    // The lines the help leans on hardest.
    expect(MEMBER_ABILITIES.join()).toContain('Log income');
    expect(ADMIN_ABILITIES.join()).toContain('Pay members back');
    expect(ADMIN_ABILITIES.join()).toContain('Invite people');
  });

  it('only names actions that exist, each once', () => {
    for (const action of HELP_ABILITY_ACTIONS) expect(Actions).toContain(action);
    expect(new Set(HELP_ABILITY_ACTIONS).size).toBe(HELP_ABILITY_ACTIONS.length);
  });

  it('has a titled topic with something in it for every id', () => {
    for (const id of HelpTopicIds) {
      const topic = HELP_TOPICS[id];
      expect(topic.id).toBe(id);
      expect(topic.title).not.toBe('');
      expect(topic.sections.length).toBeGreaterThan(0);
      for (const section of topic.sections) {
        expect(section.body ?? section.points).toBeDefined();
      }
    }
  });

  it('introduces each role', () => {
    expect(roleIntro('USER', false).title).toBe('You’re a member');
    expect(roleIntro('ADMIN', false).title).toBe('You’re an admin');
    expect(roleIntro('ADMIN', true).title).toBe('You own this band');
  });

  it('names the admins to ask', () => {
    expect(orList([])).toBe('');
    expect(orList(['Riley'])).toBe('Riley');
    expect(orList(['Riley', 'Casey'])).toBe('Riley or Casey');
    expect(orList(['Riley', 'Casey', 'Jo'])).toBe('Riley, Casey or Jo');
    expect(adminOnlyMessage('edit shows', ['Riley', 'Casey'])).toBe(
      'Only admins can edit shows. Ask Riley or Casey.',
    );
    expect(adminOnlyMessage('edit shows')).toBe('Only admins can edit shows. Ask an admin.');
    expect(adminOnlyMessage('edit shows', ['A', 'B', 'C', 'D'])).toBe(
      'Only admins can edit shows. Ask A, B or C.',
    );
  });
});
