import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAllBoardsCalendar, useBoards, type CalendarItemDto } from '@artist/api-client';
import {
  CALENDAR_CATEGORY_COPY,
  CalendarCategories,
  calendarCategory,
  daysFromToday,
  groupCalendarByDay,
  resolveBoardTheme,
  withCalendarDay,
  type BoardSummaryDto,
  type BoardTheme,
  type CalendarCategory,
  type WidgetType,
} from '@artist/shared';
import { BoardFilter } from '@/components/board-filter';
import { ChoiceChips } from '@/components/choice-chips';
import { Icon, type IconName } from '@/components/icon';
import { ListState } from '@/components/list-state';
import { PosterText } from '@/components/poster-text';
import { useBoardScope } from '@/features/boards/use-board-scope';
import { timeOfDay } from '@/features/board/format';
import { useRefetchOnFocus } from '@/lib/refetch-on-focus';
import {
  posterRadius,
  useShadows,
  spacing,
  usePosterCanvas,
  usePosterSlot,
  useScheme,
  widgetInk,
  type PosterCanvas,
  type WidgetInk,
} from '@/theme';

/**
 * The calendar as a poster agenda (direction C, "Wrapped").
 *
 * Top to bottom: the band filter, the month set huge with its steppers, and
 * then the month's days, each a bold typographic section: a huge day number
 * in a gutter, and that day's things beside it.
 * Every item wears the colour of the widget it belongs to, in its own band:
 * a show is the colour of that band's Shows card, a rehearsal of its Next
 * Rehearsals card, a due task of its To-Do's card. Events are solid blocks;
 * tasks, goals and reminders are lighter rows with a badge in their widget's
 * colour, because they are things to tick, not places to be.
 *
 * An agenda, not a month grid. Web draws 42 cells with chips in them, which
 * works at 1200px and not at 390: a cell would be 50pt wide, and "Bowery
 * Ballroom" does not fit in 50pt. It stays *bounded to a month* rather than
 * scrolling forever both ways, because the request has to have an end — the
 * API caps a range at 370 days — and because "what is in March" is the
 * question a month stepper answers in one tap.
 *
 * Days with nothing in them are left out. A grid has to draw empty cells to
 * keep its shape; a list that printed 19 empty headings would bury the five
 * days that matter. Today is the exception: this month opens scrolled to it,
 * so it is there even on a day with nothing booked, and says so.
 *
 * The round filter button beside the steppers narrows it to some kinds of
 * thing, as web's legend chips do. The chips are the Archive's: additive, none
 * picked means everything, rather than web's all-on-and-tap-to-hide, so the
 * phone's two type filters work one way.
 */
export function CalendarScreen() {
  const canvas = usePosterCanvas();
  const scope = useBoardScope('calendar');
  useRefetchOnFocus();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [types, setTypes] = useState<CalendarCategory[]>([]);
  const [picking, setPicking] = useState(false);

  const toToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  };

  const top = (
    <>
      <View style={{ marginHorizontal: -spacing.md }}>
        <BoardFilter boards={scope.boards} boardId={scope.boardId} onSelect={scope.select} />
      </View>
      <MonthHeader
        cursor={cursor}
        onChange={setCursor}
        onToday={toToday}
        canvas={canvas}
        filter={{
          on: types.length > 0,
          open: picking,
          onPress: () => setPicking(!picking),
        }}
      />
      {picking && (
        <ChoiceChips
          label={types.length > 0 ? 'Showing only' : 'Show only'}
          multiple
          choices={CalendarCategories.map((c) => ({
            value: c,
            label: CALENDAR_CATEGORY_COPY[c].label,
          }))}
          value={types}
          onChange={setTypes}
        />
      )}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: canvas.background }}>
      {/* Mounted only once the stored filter has been read, so the first request
          is the one the person actually asked for rather than every band
          followed by a snap to one. */}
      {/* Pinned: the band filter and the month stay put while the days
          scroll under them, so which band and which month is always on
          screen. A plain view above the list rather than a sticky header,
          because the type chips under the month open and close, and a sticky
          list header that changes height jolts the scroll position. */}
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          gap: spacing.md,
          backgroundColor: canvas.background,
          zIndex: 1,
        }}
      >
        {top}
      </View>
      {scope.ready && (
        <Agenda
          year={cursor.year}
          month={cursor.month}
          boardId={scope.boardId}
          boards={scope.boards}
          types={types}
        />
      )}

      <Stack.Screen
        options={{ title: 'Calendar', headerStyle: { backgroundColor: canvas.background } }}
      />
    </View>
  );
}

/** Events are blocks; everything else is a row. */
const EVENT_CATEGORIES: readonly CalendarCategory[] = ['SHOW', 'REHEARSAL', 'MEETING'];

/** The widget each kind of item belongs to: its colour, and where a tap goes. */
const CATEGORY_WIDGET: Record<CalendarCategory, WidgetType> = {
  SHOW: 'SHOWS',
  REHEARSAL: 'NEXT_REHEARSALS',
  MEETING: 'NEXT_MEETINGS',
  TASK: 'TODOS',
  REMINDER: 'REMINDERS',
  GOAL: 'GOALS',
};

function Agenda({
  year,
  month,
  boardId,
  boards,
  types,
}: {
  year: number;
  month: number;
  boardId: string | undefined;
  boards: BoardSummaryDto[];
  /** The kinds of thing to show; empty for all of them. */
  types: CalendarCategory[];
}) {
  const canvas = usePosterCanvas();
  const scheme = useScheme();

  /**
   * A band's colours come from the band, not from the item.
   *
   * The calendar response carries `boardId` because an item merged across
   * bands is otherwise unidentifiable. Which colour each widget is lives in
   * the band's theme, one per band rather than one per row. Until a band's
   * theme arrives its rows use the palette from the band list with the
   * widgets' default colours, which is what most bands have anyway.
   */
  const details = useBoards(boards.map((board) => board.id));
  // A few bands at most, so rebuilt each render rather than memoised on a
  // list of query results that is a new array every time.
  const themes = new Map<string, BoardTheme>(
    boards.map((board, index) => [
      board.id,
      resolveBoardTheme(details[index]?.data?.theme ?? { palette: board.palette }),
    ]),
  );
  const inkOf = (item: CalendarItemDto, category: CalendarCategory): WidgetInk =>
    widgetInk(
      themes.get(item.boardId) ?? resolveBoardTheme(undefined),
      CATEGORY_WIDGET[category],
      scheme,
    );

  // Rows name their band only when bands are mixed on screen: under "All" with
  // more than one. Filtered to a band, or in a one-band account, the band is
  // already said by the chip and would only repeat on every row.
  const namesBoards = boards.length > 1 && boardId === undefined;

  // The window is the local month: midnight on the 1st to midnight on the next
  // 1st, as instants. Memoised on the cursor because these strings are part of
  // the query key — rebuilding them every render would refetch forever.
  const { from, to } = useMemo(
    () => ({
      from: new Date(year, month, 1).toISOString(),
      to: new Date(year, month + 1, 1).toISOString(),
    }),
    [year, month],
  );
  const calendar = useAllBoardsCalendar(from, to, boardId);

  const monthName = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long' });

  const now = new Date();
  const thisMonth = year === now.getFullYear() && month === now.getMonth();
  // Filtered here, not in the request: the API has no type param, and a
  // month's items are a few dozen at most.
  const shown = useMemo(
    () =>
      types.length === 0
        ? calendar.data
        : calendar.data?.filter((item) => types.includes(calendarCategory(item))),
    [calendar.data, types],
  );
  const empty = shown !== undefined && shown.length === 0;
  const days = useMemo(() => {
    const grouped = groupCalendarByDay(shown ?? []);
    // Only once the month has loaded, so the spinner still shows until then.
    return thisMonth && calendar.data !== undefined
      ? withCalendarDay(grouped, new Date())
      : grouped;
  }, [shown, calendar.data, thisMonth]);

  // Opening this month lands on today rather than on the 1st, set in the
  // middle of what can be seen, so the days either side of it show too.
  // Near the end of a month there is not enough below today to centre it, so
  // it goes as far down as the list goes. Once per view, so a refetch on focus never yanks the list back
  // while someone is reading further down.
  const list = useRef<FlatList<(typeof days)[number]>>(null);
  const landed = useRef<string | null>(null);
  const todayIndex = thisMonth ? days.findIndex((day) => isTodayDay(day.parts)) : -1;

  // The list runs on under the tab bar. Inside the tab, the bottom safe-area
  // inset is the bar's height (it includes the home indicator), so that is
  // what is covered. The list is not the screen's first scroll view any
  // more, so iOS no longer insets it for the bar by itself: its end is padded
  // by the same amount instead, or the last day of a month sat under the bar.
  const insets = useSafeAreaInsets();
  const covered = insets.bottom;
  const contentHeight = useRef(0);
  const firstView = useRef<View>(null);
  const todayView = useRef<View>(null);

  // Each re-centre waits a frame, so it measures the layout that caused it
  // rather than the one before (a filter that drops days above today moved
  // it up after the measure, and it landed 90pt low).
  // A day measures its true height a frame or two after it renders (a day
  // with two items wraps taller than the first guess), and the list moves
  // down when the band chips above it arrive, which can be well after the
  // first frame. A jump made before either lands wrong. So until the person
  // first drags the list, every change in its size or its content's
  // re-centres today. Untouched, the list is still on today, so a re-centre
  // never moves anyone from what they were reading; once they drag, it stops.
  const settling = useRef(false);

  /**
   * Today's middle on the middle of what shows between the header and the
   * tab bar, measured rather than estimated: today's block and the first
   * day's are both measured in the scroll view, and today's distance below
   * the first day (the top of the content) is where it sits in the list
   * whatever the current scroll, which is the same for both and cancels out.
   * The offset is clamped to the list's real range. React Native's own clamp leaves out the room iOS adds under the
   * tab bar, so near the end of a month it stopped a bar's height short of
   * as-far-down-as-it-goes.
   */
  const centreToday = useCallback(() => {
    if (todayIndex <= 0) return;
    // measureLayout measures against an ancestor; the scroll view is one of
    // both days, where the first day is not one of today's.
    const scroller = list.current?.getNativeScrollRef() as View | null | undefined;
    const first = firstView.current;
    const day = todayView.current;
    if (!scroller || !first || !day) return;
    // The list's height is measured here, not kept from a render: it changes
    // as the screen settles (the band chips arrive after the first layout and
    // push the list down), and a centring done against the old height sat
    // today well above the middle.
    scroller.measure((_sx, _sy, _sw, listHeight) => {
      first.measureLayout(scroller, (_fx, firstY) => {
        day.measureLayout(scroller, (_dx, dayY, _w, dayHeight) => {
          const top = dayY - firstY;
          const visible = listHeight - covered;
          const furthest = Math.max(0, contentHeight.current - listHeight);
          const offset = Math.min(furthest, Math.max(0, top + dayHeight / 2 - visible / 2));
          list.current?.scrollToOffset({ offset, animated: false });
        });
      });
    });
  }, [todayIndex, covered]);
  // The latest centring, for the frame callback below: the effect that
  // schedules it does not cancel it when it re-runs, so it must not hold a
  // stale index.
  const centreLatest = useEffectEvent(() => centreToday());

  // Each new view (month, band or kinds picked) starts in a known place: this
  // month on today, any other month at its top. Without it the list kept the
  // last view's scroll, so a band with less in it opened scrolled past its
  // own content, today's block cut off under the header.
  const view = `${year}-${month}-${boardId ?? 'all'}-${types.join(',')}`;
  useEffect(() => {
    if (landed.current === view) return;
    if (!thisMonth) {
      landed.current = view;
      settling.current = false;
      list.current?.scrollToOffset({ offset: 0, animated: false });
      return;
    }
    // This month waits for its days.
    if (todayIndex < 0) return;
    landed.current = view;
    // The first day belongs at the top, where centring it would clamp to.
    if (todayIndex === 0) {
      settling.current = false;
      list.current?.scrollToOffset({ offset: 0, animated: false });
      return;
    }
    settling.current = true;
    // Cells are measured a frame after they render, so wait for that. Not
    // cancelled when the effect re-runs: it re-runs as the index settles and
    // returns early, and the centring must still happen.
    requestAnimationFrame(() => centreLatest());
  }, [view, thisMonth, todayIndex]);

  return (
    <FlatList
      ref={list}
      data={days}
      keyExtractor={(day) => day.key}
      // A month is a few dozen sections at most. Rendering them all up front
      // is what lets the list jump straight to today.
      initialNumToRender={days.length}
      onLayout={() => {
        if (settling.current) requestAnimationFrame(centreToday);
      }}
      onContentSizeChange={(_width, height) => {
        contentHeight.current = height;
        if (settling.current) requestAnimationFrame(centreToday);
      }}
      onScrollBeginDrag={() => {
        settling.current = false;
      }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xxl + covered,
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => void calendar.refetch()}
          tintColor={canvas.soft}
        />
      }
      renderItem={({ item: day, index }) => (
        // Today's block is measured from the first day's to centre it; the
        // wrappers are real native views so they can be.
        <View
          ref={index === todayIndex ? todayView : index === 0 ? firstView : undefined}
          collapsable={false}
        >
          <DaySection
            date={new Date(day.parts.year, day.parts.month, day.parts.day)}
            items={day.items}
            namesBoards={namesBoards}
            inkOf={inkOf}
            canvas={canvas}
          />
        </View>
      )}
      ListEmptyComponent={
        calendar.isPending || calendar.error ? (
          <View style={{ paddingTop: spacing.lg }}>
            <ListState
              pending={calendar.isPending}
              error={calendar.error}
              onRetry={() => void calendar.refetch()}
              icon={{ sf: 'calendar', md: 'event' }}
              title=""
            />
          </View>
        ) : (
          <EmptyMonth monthName={monthName} filtered={types.length > 0} canvas={canvas} />
        )
      }
      // This month is never an empty list, since today is always in it, so
      // an empty month still says so under today.
      ListFooterComponent={
        empty && thisMonth ? (
          <EmptyMonth monthName={monthName} filtered={types.length > 0} canvas={canvas} />
        ) : null
      }
    />
  );
}

const isTodayDay = (parts: { year: number; month: number; day: number }) => {
  const now = new Date();
  return (
    parts.year === now.getFullYear() && parts.month === now.getMonth() && parts.day === now.getDate()
  );
};

function EmptyMonth({
  monthName,
  filtered,
  canvas,
}: {
  monthName: string;
  filtered: boolean;
  canvas: PosterCanvas;
}) {
  return (
    <View style={{ paddingTop: spacing.xl, gap: spacing.sm }}>
      <PosterText variant="display" color={canvas.ink}>
        Nothing in {monthName}.
      </PosterText>
      <PosterText variant="body" color={canvas.soft}>
        {filtered
          ? 'Nothing of the kinds picked, anyway. Untick them to see everything.'
          : 'Shows, rehearsals, meetings, due tasks, goals and reminders all land here.'}
      </PosterText>
    </View>
  );
}

/**
 * The month as a poster headline, with its steppers. Tapping the month is the
 * way back to now; when you are elsewhere, the kicker says so.
 */
function MonthHeader({
  cursor,
  onChange,
  onToday,
  canvas,
  filter,
}: {
  cursor: { year: number; month: number };
  onChange: (next: { year: number; month: number }) => void;
  onToday: () => void;
  canvas: PosterCanvas;
  /** The type filter's button: `on` while it narrows the month. */
  filter: { on: boolean; open: boolean; onPress: () => void };
}) {
  const shift = (delta: number) => {
    const shifted = new Date(cursor.year, cursor.month + delta, 1);
    onChange({ year: shifted.getFullYear(), month: shifted.getMonth() });
  };
  const now = new Date();
  const away = cursor.year !== now.getFullYear() || cursor.month !== now.getMonth();
  const date = new Date(cursor.year, cursor.month, 1);
  const name = date.toLocaleDateString(undefined, { month: 'long' });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} ${cursor.year}. Go to this month`}
        onPress={onToday}
        style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.6 : 1 })}
      >
        <PosterText variant="label" color={canvas.soft}>
          {away ? `${cursor.year} · TAP FOR TODAY` : String(cursor.year)}
        </PosterText>
        <PosterText
          variant="figure"
          color={canvas.ink}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {name}
        </PosterText>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingBottom: 10 }}>
        <Stepper
          icon={{ sf: 'line.3.horizontal.decrease', md: 'filter-list' }}
          label={filter.on ? 'Filter by type, on' : 'Filter by type'}
          onPress={filter.onPress}
          canvas={canvas}
          filled={filter.on}
          expanded={filter.open}
        />
        <Stepper
          icon={{ sf: 'chevron.left', md: 'chevron-left' }}
          label="Previous month"
          onPress={() => shift(-1)}
          canvas={canvas}
        />
        <Stepper
          icon={{ sf: 'chevron.right', md: 'chevron-right' }}
          label="Next month"
          onPress={() => shift(1)}
          canvas={canvas}
        />
      </View>
    </View>
  );
}

function Stepper({
  icon,
  label,
  onPress,
  canvas,
  filled = false,
  expanded,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  canvas: PosterCanvas;
  /** Solid in ink, as a pressed stepper is: a filter that is narrowing. */
  filled?: boolean;
  expanded?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: canvas.ink,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed !== filled ? canvas.ink : 'transparent',
      })}
    >
      {({ pressed }) => (
        <Icon
          name={icon}
          size={16}
          color={pressed !== filled ? canvas.background : canvas.ink}
        />
      )}
    </Pressable>
  );
}

/**
 * One day: the date set huge in a gutter, the day's things beside it. Today's
 * gutter is a block of the band's lead colour — the one landmark to scroll
 * back to — and days already past go quiet.
 */
function DaySection({
  date,
  items,
  namesBoards,
  inkOf,
  canvas,
}: {
  date: Date;
  items: CalendarItemDto[];
  namesBoards: boolean;
  inkOf: (item: CalendarItemDto, category: CalendarCategory) => WidgetInk;
  canvas: PosterCanvas;
}) {
  const today = usePosterSlot('c1');
  const offset = daysFromToday(date.toISOString());
  const isToday = offset === 0;
  const past = offset < 0;
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  const relative = isToday ? 'TODAY' : offset === 1 ? 'TMRW' : weekday;

  const ink = isToday ? today.ink : past ? canvas.soft : canvas.ink;

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        paddingTop: spacing.lg,
      }}
    >
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={date.toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        style={{
          width: 72,
          alignSelf: 'flex-start',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          borderRadius: posterRadius.block,
          borderCurve: 'continuous',
          backgroundColor: isToday ? today.bg : 'transparent',
        }}
      >
        <PosterText variant="label" color={ink}>
          {relative}
        </PosterText>
        <PosterText
          variant="figure"
          color={ink}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={{ fontSize: 46, lineHeight: 52, letterSpacing: -1.8 }}
        >
          {date.getDate()}
        </PosterText>
      </View>

      <View style={{ flex: 1, gap: spacing.sm, paddingTop: spacing.xs }}>
        {items.length === 0 && (
          <View style={{ minHeight: 48, justifyContent: 'center', paddingTop: spacing.sm }}>
            <PosterText variant="caption" color={canvas.soft}>
              Nothing for today.
            </PosterText>
          </View>
        )}
        {items.map((item) => {
          const category = calendarCategory(item);
          const ink = inkOf(item, category);
          return EVENT_CATEGORIES.includes(category) ? (
            <EventBlock
              key={`${item.kind}-${item.id}`}
              item={item}
              category={category}
              color={ink}
              namesBoards={namesBoards}
            />
          ) : (
            <LightRow
              key={`${item.kind}-${item.id}`}
              item={item}
              category={category}
              namesBoards={namesBoards}
              badge={ink}
              canvas={canvas}
            />
          );
        })}
      </View>
    </View>
  );
}

const openItem = (item: CalendarItemDto, category: CalendarCategory) =>
  router.push(
    item.kind === 'TASK'
      ? `/board/${item.boardId}/task/${item.id}`
      : `/board/${item.boardId}/w/${CATEGORY_WIDGET[category]}`,
  );

/**
 * A show, rehearsal or meeting: a solid block in the colour of its widget.
 * The kind is also written on it, so nothing rests on colour alone — and
 * under "All", the band is named too. An uncoloured widget gives a plain
 * card, with the same faint shadow its card has on the widget page.
 */
function EventBlock({
  item,
  category,
  color,
  namesBoards,
}: {
  item: CalendarItemDto;
  category: CalendarCategory;
  color: WidgetInk;
  namesBoards: boolean;
}) {
  const time = timeOfDay(item.date);
  const shadows = useShadows();
  const ends = item.event?.endsAt ? timeOfDay(item.event.endsAt) : null;
  const meta = [item.event?.location, namesBoards ? item.boardName : null]
    .filter((part): part is string => part != null && part !== '')
    .join(' · ');
  const kind = CALENDAR_CATEGORY_COPY[category].one;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[kind, item.title, time, meta].filter(Boolean).join(', ')}
      onPress={() => openItem(item, category)}
      style={({ pressed }) => ({
        backgroundColor: color.bg,
        borderRadius: posterRadius.block,
        borderCurve: 'continuous',
        padding: spacing.md - 2,
        gap: 2,
        minHeight: 44,
        boxShadow: color.plain ? shadows.card : shadows.edge,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <PosterText variant="label" color={color.ink} style={{ flex: 1 }}>
          {kind.toUpperCase()}
        </PosterText>
        <PosterText variant="meta" color={color.ink}>
          {ends ? `${time}–${ends}` : time}
        </PosterText>
      </View>
      <PosterText variant="title" color={color.ink} numberOfLines={2}>
        {item.title}
      </PosterText>
      {meta !== '' && (
        <PosterText variant="meta" color={color.soft} numberOfLines={1}>
          {meta}
        </PosterText>
      )}
    </Pressable>
  );
}

const LIGHT_ICON: Partial<Record<CalendarCategory, IconName>> = {
  GOAL: { sf: 'target', md: 'track-changes' },
  REMINDER: { sf: 'bell.fill', md: 'notifications' },
};

/**
 * A due task, a goal or a reminder: lighter than an event — ink on the page,
 * no block — because it is something to tick off, not somewhere to be. Its
 * badge is a small tile in its widget's colour, so it still says which
 * widget it belongs to at a glance.
 */
function LightRow({
  item,
  category,
  namesBoards,
  badge,
  canvas,
}: {
  item: CalendarItemDto;
  category: CalendarCategory;
  namesBoards: boolean;
  badge: WidgetInk;
  canvas: PosterCanvas;
}) {
  const shadows = useShadows();
  const done = item.task?.isDone === true || item.goal?.completed === true;
  const mine = item.task?.assignedToMe === true;
  const meta = [
    category === 'TASK' ? 'Due' : CALENDAR_CATEGORY_COPY[category].one,
    category === 'REMINDER' ? timeOfDay(item.date) : null,
    item.task?.statusName,
    namesBoards ? item.boardName : null,
  ]
    .filter((part): part is string => part != null && part !== '')
    .join(' · ');
  const icon = LIGHT_ICON[category];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[item.title, meta, mine ? 'yours' : null, done ? 'done' : null]
        .filter(Boolean)
        .join(', ')}
      onPress={() => openItem(item, category)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md - 4,
        minHeight: 48,
        paddingVertical: spacing.xs,
        paddingHorizontal: 2,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          borderCurve: 'continuous',
          backgroundColor: badge.bg,
          boxShadow: badge.plain ? shadows.card : shadows.edge,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: done ? 0.55 : 1,
        }}
      >
        {icon ? (
          <Icon name={icon} size={16} color={badge.ink} />
        ) : (
          <View
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: badge.ink,
              backgroundColor: done ? badge.ink : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {done && <Icon name={{ sf: 'checkmark', md: 'check' }} size={9} color={badge.bg} />}
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <PosterText
          variant="caption"
          color={done ? canvas.soft : canvas.ink}
          numberOfLines={2}
          style={done ? { textDecorationLine: 'line-through' } : undefined}
        >
          {item.title}
        </PosterText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <PosterText
            variant="meta"
            color={canvas.soft}
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {meta}
          </PosterText>
        </View>
      </View>
      {mine && !done && (
        <View
          style={{
            borderRadius: posterRadius.chip,
            borderWidth: 2,
            borderColor: canvas.ink,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
          }}
        >
          <PosterText variant="label" color={canvas.ink}>
            YOURS
          </PosterText>
        </View>
      )}
    </Pressable>
  );
}
