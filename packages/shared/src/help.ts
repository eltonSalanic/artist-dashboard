import type { BoardRole, ShowStatusCategory } from './enums';
import { can, type Action } from './permissions';

/**
 * The words the apps use to explain Band Wall's rules: who can do what, how
 * finances work, what the less obvious words mean. Kept here, beside the
 * permission map, so an explanation can't say one thing while `can()` does
 * another: the role lists below are built from `can()`, not written twice.
 */

/** One thing a person can do, in the words the help uses, and the rule behind it. */
interface Ability {
  action: Action;
  label: string;
}

/**
 * Every ability the help mentions, in the order it lists them. Whether a line
 * lands under "everyone" or "admins only" is decided by `can('USER', action)`.
 */
const ABILITIES: readonly Ability[] = [
  { action: 'task.view', label: 'See everything on the wall: tasks, shows, goals and finances' },
  { action: 'task.changeStatus', label: 'Move a task along when it’s assigned to you' },
  { action: 'task.createSubtask', label: 'Add subtasks' },
  { action: 'task.comment', label: 'Comment and mention bandmates' },
  { action: 'file.upload', label: 'Add files and links' },
  { action: 'show.changeStatus', label: 'Move a show’s status along' },
  { action: 'finance.create', label: 'Log income, and expenses you or the band account paid' },
  { action: 'archive.view', label: 'Look through the archive' },
  { action: 'task.create', label: 'Add, edit and assign tasks' },
  { action: 'event.manage', label: 'Add and edit shows, rehearsals and meetings' },
  { action: 'goal.manage', label: 'Set goals, reminders and the focus' },
  { action: 'finance.manage', label: 'Pay members back, and change anyone’s entries' },
  { action: 'member.invite', label: 'Invite people, remove them and change their role' },
  { action: 'status.manage', label: 'Rename the task and show statuses' },
  { action: 'board.appearance', label: 'Change the band’s colours' },
  { action: 'item.archive', label: 'Archive things, restore them or delete them for good' },
];

/** What every member can do. */
export const MEMBER_ABILITIES: readonly string[] = ABILITIES.filter((a) =>
  can('USER', a.action),
).map((a) => a.label);

/** What takes an admin. */
export const ADMIN_ABILITIES: readonly string[] = ABILITIES.filter(
  (a) => !can('USER', a.action),
).map((a) => a.label);

/** The actions the help's role lists cover, for the test that keeps them honest. */
export const HELP_ABILITY_ACTIONS: readonly Action[] = ABILITIES.map((a) => a.action);

/** What only the band's owner can do. The owner isn't a role, so not from `can()`. */
export const OWNER_ABILITIES: readonly string[] = [
  'Pays for Band Wall. Their subscription covers everyone in the band',
  'Can hand the band to someone else, or delete it',
  'Can’t be removed, and is always an admin',
];

export const ROLE_LABELS: Record<BoardRole, string> = { ADMIN: 'Admin', USER: 'Member' };

/** One line on what a role is, for the invite form and the role picker. */
export const ROLE_ONE_LINERS: Record<BoardRole, string> = {
  USER: 'Sees everything, moves their own tasks along, comments, and logs what they spend.',
  ADMIN: 'Everything a member can, plus adding and editing anything, inviting people and paying members back.',
};

export interface RoleIntro {
  /** "You're a member." */
  title: string;
  body: string;
}

/** The first thing someone is told about their place in a band. */
export function roleIntro(role: BoardRole, isOwner: boolean): RoleIntro {
  if (isOwner) {
    return {
      title: 'You own this band',
      body: 'You’re an admin, and your subscription keeps the band open for everyone. Only you can hand it over or delete it.',
    };
  }
  if (role === 'ADMIN') {
    return {
      title: 'You’re an admin',
      body: 'You can add and edit anything, invite people, and pay members back for what they spent.',
    };
  }
  return {
    title: 'You’re a member',
    body: 'You can see everything, move your own tasks along, comment, add files, and log what you spend. Admins plan the shows and tasks and pay people back.',
  };
}

/** "Riley", "Riley or Casey", "Riley, Casey or Jo". Empty for no names. */
export function orList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/**
 * "Only admins can edit shows. Ask Riley or Casey." Naming the admins turns a
 * dead end into the next step. With none known (still loading) it just says
 * "Ask an admin."
 */
export function adminOnlyMessage(doing: string, adminNames: readonly string[] = []): string {
  const shown = adminNames.slice(0, 3);
  const who = shown.length > 0 ? orList(shown) : 'an admin';
  return `Only admins can ${doing}. Ask ${who}.`;
}

/**
 * One line under a show status's name in the status sheet. The four a band
 * starts with have their own; a status a band added falls back to its kind.
 */
const SHOW_STATUS_LINES: Record<string, string> = {
  hold: 'Possible upcoming date',
  'details pending': 'Confirmed, waiting for details',
  confirmed: 'All ready to go',
  cancelled: 'Show no longer goes on',
};

const SHOW_CATEGORY_LINES: Record<ShowStatusCategory, string> = {
  HOLD: 'Possible upcoming date',
  BOOKED: 'Confirmed',
  CANCELLED: 'Show no longer goes on',
};

export function showStatusLine(status: { name: string; category: ShowStatusCategory }): string {
  return SHOW_STATUS_LINES[status.name.trim().toLowerCase()] ?? SHOW_CATEGORY_LINES[status.category];
}

export const HelpTopicIds = ['roles', 'finances', 'shows', 'wall', 'bands'] as const;
export type HelpTopicId = (typeof HelpTopicIds)[number];

export interface HelpSection {
  heading?: string;
  /** A paragraph. */
  body?: string;
  /** A short list under the heading. */
  points?: readonly string[];
}

export interface HelpTopic {
  id: HelpTopicId;
  title: string;
  /** One line under the title. */
  summary: string;
  sections: readonly HelpSection[];
}

export const HELP_TOPICS: Record<HelpTopicId, HelpTopic> = {
  roles: {
    id: 'roles',
    title: 'Owner, admins and members',
    summary: 'Who can do what in a band.',
    sections: [
      { heading: 'Everyone in the band can', points: MEMBER_ABILITIES },
      { heading: 'Only admins can', points: ADMIN_ABILITIES },
      { heading: 'The owner', points: OWNER_ABILITIES },
      {
        heading: 'Changing roles',
        body: 'An admin can make someone an admin or a member at any time, in Settings under Members. A band can have as many admins as it likes.',
      },
      {
        heading: 'If the subscription lapses',
        body: 'The band locks for everyone until the owner subscribes again. Nothing is deleted.',
      },
    ],
  },
  finances: {
    id: 'finances',
    title: 'How finances work',
    summary: 'The band fund, who paid, and paying people back.',
    sections: [
      {
        heading: 'Band Wall keeps track. It doesn’t move money',
        body: 'Nothing here sends or charges anything. You pay each other however you already do, then log it here so everyone sees the same numbers.',
      },
      {
        heading: 'The band fund',
        body: 'The big number on Finances is the band’s own money: income in hand, minus what the band account paid for, minus what’s been paid back to members. It can go below zero.',
      },
      {
        heading: 'Who paid',
        body: 'Every expense says who paid. “Band account” means the band’s money covered it. A person’s name means they paid out of their own pocket, so the band owes it back to them.',
      },
      {
        heading: 'Owed back, then Paid back',
        body: 'An out-of-pocket expense is Owed back until an admin pays the person and taps Pay back. Then it’s Paid back and locks, so it can’t drift from what was paid. An admin can undo a payback to change it.',
      },
      {
        heading: 'Money you’re still waiting on',
        body: 'Log a promised fee as income marked Still owed. It doesn’t count in the band fund until you change it to In hand.',
      },
      {
        heading: 'Who can change what',
        body: 'Anyone can log income, and expenses they paid or the band account paid. You can edit or remove your own out-of-pocket expenses and band-account entries you logged. Admins can change any entry and are the only ones who pay people back.',
      },
      {
        heading: 'No splitting',
        body: 'Profit stays in the band fund. Members are only ever owed for what they paid out of pocket.',
      },
      {
        heading: 'The Owed tab',
        body: 'A red ring is someone the band owes. A tick means they’re square.',
      },
    ],
  },
  shows: {
    id: 'shows',
    title: 'Show statuses',
    summary: 'Hold, booked and cancelled.',
    sections: [
      {
        body: 'Every show has a status, and anyone in the band can move it along. Admins can rename the statuses or add their own in Settings.',
      },
      {
        points: [
          'Hold: possible upcoming date',
          'Details pending: confirmed, waiting for details',
          'Confirmed: all ready to go',
          'Cancelled: show no longer goes on',
        ],
      },
      { body: 'Once a booked show’s date has passed, it reads as Played on its own.' },
    ],
  },
  wall: {
    id: 'wall',
    title: 'What’s on the wall',
    summary: 'The cards, and what each one is for.',
    sections: [
      {
        points: [
          'Focus: one line each for what this week, this month and this year are about',
          'To-Do’s: every task in the band',
          'My Tasks: only the tasks assigned to you',
          'Goals: things to reach this year, this month or today, ticked off when done',
          'Reminders: dated nudges the whole band sees',
          'Shows, Rehearsals, Meetings: what’s coming up',
          'Finances: the band’s money in and out',
          'Activity: everything that’s changed lately',
          'Notes: one shared page for set lists and anything else',
        ],
      },
      {
        heading: 'Your layout is yours',
        body: 'Hold a card to move, resize or hide it. That only changes your own phone. Card colours are the band’s, so an admin changing one changes it for everyone.',
      },
      {
        heading: 'The archive',
        body: 'Archiving puts something away without deleting it. Everyone can look through the archive from the ⋯ menu; admins can restore things or delete them for good.',
      },
    ],
  },
  bands: {
    id: 'bands',
    title: 'More than one band',
    summary: 'One account, every band you’re in.',
    sections: [
      {
        body: 'Tap the band’s name at the top of the wall to switch bands. Your role is per band: you can be an admin in one and a member in another.',
      },
      {
        body: 'The Calendar and Inbox tabs show every band at once, each in its own colour. Joining a band is free; starting your own takes a subscription.',
      },
    ],
  },
};
