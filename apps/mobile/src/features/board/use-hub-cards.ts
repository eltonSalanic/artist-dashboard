import { useMemo } from 'react';
import {
  useActivityFeed,
  useCustomWidget,
  useEvents,
  useFocus,
  useGoals,
  useLayout,
  useMe,
  useReminders,
  useTasks,
} from '@artist/api-client';
import {
  FocusPeriods,
  WIDGET_META,
  resolveWidgetColor,
  type BoardTheme,
  type WidgetColor,
  type WidgetType,
} from '@artist/shared';
import type { IconName } from '@/components/icon';
import { count, isThisWeek, isToday, shortAgo, shortDate } from './format';
import { notePreview } from './note-preview';
import { WIDGET_ICONS } from './widget-icons';

/**
 * One widget, summarised.
 *
 * The anatomy is fixed so ten cards read as one system rather than ten
 * designs: icon + title, one primary value, one qualifier line, and an urgency
 * flag. A widget that cannot fill `primary` is empty, not broken — the card
 * says so instead of showing a zero.
 */
export interface HubCard {
  widgetType: WidgetType;
  /** Prose widgets get the full width; countable ones sit two-up. */
  kind: 'hero' | 'stat';
  title: string;
  slot: WidgetColor;
  icon: IconName;
  /** The one big thing. Null means "nothing here yet". */
  primary: string | null;
  /** One line under it, or null. */
  qualifier: string | null;
  /** Something wants attention today — the card picks up an accent. */
  urgent: boolean;
  loading: boolean;
}

/** Only these two are prose. The other eight are countable. */
const HERO_WIDGETS: readonly WidgetType[] = ['FOCUS', 'CUSTOM'];

export interface HubCards {
  cards: HubCard[];
  /** True until the layout is known; the cards themselves load individually. */
  loading: boolean;
  error: Error | null;
}

/**
 * Every widget on the hub, in the order the board's layout puts them.
 *
 * The layout comes back from the API already merged — `GET /boards/:id/layout`
 * applies the user's arrangement over the board default server-side — so this
 * reads `hidden` and order straight off it.
 *
 * Every query runs whether or not its widget is visible. Hiding is a P12
 * feature and the shipped default shows all ten, so gating each hook would add
 * an `enabled` parameter to nine shared hooks to save nothing today.
 */
export function useHubCards(boardId: string, theme: BoardTheme): HubCards {
  const layout = useLayout(boardId);
  const me = useMe(true);

  // Recomputed per mount rather than per render: `from` is part of the query
  // key, and a fresh `new Date()` each render would refetch forever.
  const from = useMemo(() => new Date().toISOString(), []);

  const focus = useFocus(boardId);
  const note = useCustomWidget(boardId);
  const tasks = useTasks(boardId);
  const myTasks = useTasks(
    boardId,
    me.data ? { assigneeId: me.data.user.id, sort: 'dueDate' } : {},
  );
  const goals = useGoals(boardId);
  const shows = useEvents(boardId, { type: 'SHOW', from, limit: 20 });
  const rehearsals = useEvents(boardId, {
    type: 'REHEARSAL',
    from,
    limit: 20,
  });
  const meetings = useEvents(boardId, { type: 'MEETING', from, limit: 20 });
  const reminders = useReminders(boardId);
  const activity = useActivityFeed(boardId);

  const summaries: Record<WidgetType, Omit<HubCard, keyof CardChrome>> = {
    FOCUS: (() => {
      const pins = focus.data ?? [];
      // The nearest horizon that has been set: this week beats this year.
      const pin = FocusPeriods.map((period) =>
        pins.find((p) => p.period === period && p.text.trim() !== ''),
      ).find((p) => p !== undefined);
      return {
        primary: pin?.text ?? null,
        qualifier: pin ? `this ${pin.period.toLowerCase()}` : null,
        urgent: false,
        loading: focus.isPending,
      };
    })(),

    CUSTOM: {
      primary: notePreview(note.data?.content),
      qualifier: note.data?.updatedAt
        ? `edited ${shortAgo(note.data.updatedAt)}`
        : null,
      urgent: false,
      loading: note.isPending,
    },

    TODOS: (() => {
      // Subtasks belong to their parent, so the board's own count is roots only.
      const roots = (tasks.data ?? []).filter((t) => t.parentTaskId === null);
      const open = roots.filter((t) => !t.status.isDone);
      const dueToday = open.filter(
        (t) => t.dueDate !== null && isToday(t.dueDate),
      ).length;
      return {
        primary: open.length === 0 ? null : count(open.length),
        qualifier: dueToday > 0 ? `${dueToday} due today` : null,
        urgent: dueToday > 0,
        loading: tasks.isPending,
      };
    })(),

    MY_TASKS: (() => {
      const mine = (myTasks.data ?? []).filter(
        (t) => t.parentTaskId === null && !t.status.isDone,
      );
      const thisWeek = mine.filter(
        (t) => t.dueDate !== null && isThisWeek(t.dueDate),
      ).length;
      return {
        primary: mine.length === 0 ? null : count(mine.length),
        qualifier: thisWeek > 0 ? `${thisWeek} this week` : null,
        urgent: mine.some((t) => t.dueDate !== null && isToday(t.dueDate)),
        loading: myTasks.isPending || me.isPending,
      };
    })(),

    GOALS: (() => {
      const all = goals.data ?? [];
      const active = all.filter((g) => g.completedAt === null);
      const done = all.length - active.length;
      return {
        primary: active.length === 0 ? null : count(active.length),
        qualifier:
          all.length > 0
            ? `${Math.round((done / all.length) * 100)}% complete`
            : null,
        urgent: false,
        loading: goals.isPending,
      };
    })(),

    SHOWS: nextEventCard(shows, (event) => event.location),
    NEXT_REHEARSALS: nextEventCard(rehearsals),
    NEXT_MEETINGS: nextEventCard(meetings),

    REMINDERS: (() => {
      const open = (reminders.data ?? []).filter((r) => !r.done);
      const due = open.filter(
        (r) => r.remindAt !== null && new Date(r.remindAt) <= new Date(),
      );
      const next = open
        .filter((r) => r.remindAt !== null)
        .sort((a, b) => a.remindAt!.localeCompare(b.remindAt!))[0];
      return {
        primary: open.length === 0 ? null : count(open.length),
        qualifier: next?.remindAt ? shortDate(next.remindAt) : null,
        urgent: due.length > 0,
        loading: reminders.isPending,
      };
    })(),

    ACTIVITY_FEED: (() => {
      const items = activity.data?.pages.flatMap((page) => page.items) ?? [];
      // "N new since your last visit" is what the design asked for, and it
      // needs a per-device last-seen marker that nothing writes yet. Counting
      // the last day says something true with no hidden state; the unread
      // version belongs with the Inbox work in P9.
      const today = items.filter((item) => isToday(item.createdAt)).length;
      return {
        primary: today === 0 ? null : count(today),
        qualifier: items[0] ? shortAgo(items[0].createdAt) : null,
        urgent: false,
        loading: activity.isPending,
      };
    })(),

    // A page, not a card — never in the layout, but the record must be total.
    CALENDAR: {
      primary: null,
      qualifier: null,
      urgent: false,
      loading: false,
    },
  };

  const cards = (layout.data?.layout ?? [])
    .filter((item) => item.hidden !== true)
    .filter((item) => item.widgetType !== 'CALENDAR')
    .map<HubCard>((item) => ({
      widgetType: item.widgetType,
      title: WIDGET_META[item.widgetType].title,
      slot: resolveWidgetColor(
        theme,
        item.widgetType,
        WIDGET_META[item.widgetType].defaultColor ?? 'base',
      ),
      icon: WIDGET_ICONS[item.widgetType],
      kind: HERO_WIDGETS.includes(item.widgetType) ? 'hero' : 'stat',
      ...summaries[item.widgetType],
    }));

  return {
    cards,
    loading: layout.isPending,
    error: layout.error,
  };
}

/** The fields the layout supplies, which each summary does not. */
type CardChrome = Pick<
  HubCard,
  'widgetType' | 'title' | 'slot' | 'icon' | 'kind'
>;

/**
 * Shows, rehearsals and meetings are the same card over a different event
 * type: the next date, and either where it is or how many follow.
 */
function nextEventCard(
  query: ReturnType<typeof useEvents>,
  qualify?: (event: { location: string | null }) => string | null,
): Omit<HubCard, keyof CardChrome> {
  const events = query.data ?? [];
  const next = events[0];
  const fallback = events.length > 1 ? `${events.length - 1} more` : null;

  return {
    primary: next ? shortDate(next.startsAt) : null,
    qualifier: next ? (qualify?.(next) ?? null) || fallback : null,
    urgent: next !== undefined && isToday(next.startsAt),
    loading: query.isPending,
  };
}
