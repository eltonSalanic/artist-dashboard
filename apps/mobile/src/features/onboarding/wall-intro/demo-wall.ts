import {
  DEFAULT_BOARD_THEME,
  WIDGET_META,
  resolveWidgetColor,
  type CardWidgetType,
} from '@artist/shared';
import type { HubCard } from '@/features/board/use-hub-cards';
import { WIDGET_ICONS } from '@/features/board/widget-icons';
import type { DemoBand } from './bands';

/** Where a card sits on the preview's two-column grid, in cells. */
export interface DemoCell {
  type: CardWidgetType;
  row: number;
  col: 0 | 1;
  /** Both columns. */
  wide: boolean;
  /** When it lands, in ms after the wall starts building. */
  lands: number;
  /** Which edge it's thrown in from. */
  from: 'left' | 'right' | 'below';
  /** The headline it belongs to, if it gets picked out after landing. */
  section?: 'events' | 'tasks';
}

/**
 * The hub's default arrangement without Focus, since the preview goes straight
 * from the band's name to the cards that do the work. Shows and Rehearsals
 * land with "Every Event." and the name; the task cards land with "Who's Doing
 * What."; the rest land as the camera rides down to Finances.
 */
export const DEMO_LAYOUT: readonly DemoCell[] = [
  { type: 'SHOWS', row: 0, col: 0, wide: false, lands: 100, from: 'left', section: 'events' },
  {
    type: 'NEXT_REHEARSALS',
    row: 0,
    col: 1,
    wide: false,
    lands: 200,
    from: 'right',
    section: 'events',
  },
  { type: 'TODOS', row: 1, col: 0, wide: true, lands: 3800, from: 'below', section: 'tasks' },
  { type: 'MY_TASKS', row: 2, col: 0, wide: false, lands: 3870, from: 'left', section: 'tasks' },
  { type: 'GOALS', row: 2, col: 1, wide: false, lands: 3940, from: 'right', section: 'tasks' },
  { type: 'NEXT_MEETINGS', row: 3, col: 0, wide: false, lands: 7180, from: 'left' },
  { type: 'REMINDERS', row: 3, col: 1, wide: false, lands: 7300, from: 'right' },
  { type: 'ACTIVITY_FEED', row: 4, col: 0, wide: true, lands: 7460, from: 'below' },
  { type: 'CUSTOM', row: 5, col: 0, wide: true, lands: 7660, from: 'below' },
  { type: 'FINANCES', row: 6, col: 0, wide: false, lands: 8150, from: 'left' },
];

/**
 * The three headlines, each on its own palette slot, tilted a different way.
 * `at` counts from when the wall starts building; `top` is for an 844pt-tall
 * screen and scales with the real one.
 */
/**
 * Once a headline has gone, its cards are picked out for a moment while the
 * rest of the wall steps back, in ms after the wall starts building.
 */
export const SPOTLIGHTS = [
  { section: 'events', from: 1450, to: 3300 },
  { section: 'tasks', from: 5150, to: 6800 },
] as const;

export const HEADLINES = [
  { text: 'Every Event.', at: 100, top: 330, slot: 'c1', tilt: -6 },
  { text: "Who's Doing\nWhat.", at: 3800, top: 440, slot: 'c2', tilt: 5 },
  { text: 'Track\nExpenses.', at: 8600, top: 170, slot: 'c3', tilt: -5 },
] as const;

export const DEMO_ROWS = 7;

type Values = Pick<HubCard, 'primary' | 'qualifier' | 'urgent'> &
  Partial<Pick<HubCard, 'primaryTone'>>;

/** What each card says. The same numbers for every band, bar the show and the note. */
function values(type: CardWidgetType, band: DemoBand): Values {
  switch (type) {
    case 'SHOWS':
      return { primary: band.show.day, qualifier: band.show.venue, urgent: false };
    case 'CUSTOM':
      return { primary: band.note, qualifier: 'edited 2h ago', urgent: false };
    case 'NEXT_REHEARSALS':
      return { primary: 'Tue', qualifier: '3 more', urgent: false };
    case 'TODOS':
      return { primary: '12', qualifier: '2 due today', urgent: true };
    case 'MY_TASKS':
      return { primary: '5', qualifier: '3 this week', urgent: false };
    case 'GOALS':
      return { primary: '3', qualifier: '40% complete', urgent: false };
    case 'NEXT_MEETINGS':
      return { primary: '18 Nov', qualifier: '1 more', urgent: false };
    case 'REMINDERS':
      return { primary: '2', qualifier: 'Tomorrow', urgent: true };
    case 'ACTIVITY_FEED':
      return { primary: '6', qualifier: '5m ago', urgent: false };
    case 'FINANCES':
      return {
        primary: '+$1,240',
        primaryTone: 'positive',
        qualifier: '$120 owed to you',
        urgent: false,
      };
    case 'FOCUS':
      return { primary: null, qualifier: null, urgent: false };
  }
}

/**
 * A card exactly as the hub builds it (title, slot and icon from the same
 * registries), filled with the demo band's numbers instead of a board's.
 */
export function demoCard(type: CardWidgetType, band: DemoBand): HubCard {
  const meta = WIDGET_META[type];
  return {
    widgetType: type,
    kind: type === 'CUSTOM' || type === 'FOCUS' ? 'hero' : 'stat',
    title: meta.title,
    slot: resolveWidgetColor(DEFAULT_BOARD_THEME, type, meta.defaultColor ?? 'base'),
    icon: WIDGET_ICONS[type],
    loading: false,
    lines: [],
    ...values(type, band),
  };
}
