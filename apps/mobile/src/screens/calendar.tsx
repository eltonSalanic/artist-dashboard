import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAllBoardsCalendar, useBoards, type CalendarItemDto } from '@artist/api-client';
import {
  CALENDAR_CATEGORY_COPY,
  calendarCategory,
  daysFromToday,
  groupCalendarByDay,
  resolveBoardTheme,
  type BoardSummaryDto,
  type BoardTheme,
  type CalendarCategory,
  type WidgetType,
} from '@artist/shared';
import { BoardFilter } from '@/components/board-filter';
import { Icon, type IconName } from '@/components/icon';
import { ListState } from '@/components/list-state';
import { PosterText } from '@/components/poster-text';
import { useBoardScope } from '@/features/boards/use-board-scope';
import { timeOfDay } from '@/features/board/format';
import { useRefetchOnFocus } from '@/lib/refetch-on-focus';
import {
  posterRadius,
  shadows,
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
 * days that matter.
 */
export function CalendarScreen() {
  const canvas = usePosterCanvas();
  const scope = useBoardScope('calendar');
  useRefetchOnFocus();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const toToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  };

  const top = (
    <>
      <View style={{ marginHorizontal: -spacing.md }}>
        <BoardFilter boards={scope.boards} boardId={scope.boardId} onSelect={scope.select} />
      </View>
      <MonthHeader cursor={cursor} onChange={setCursor} onToday={toToday} canvas={canvas} />
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: canvas.background }}>
      {/* Mounted only once the stored filter has been read, so the first request
          is the one the person actually asked for rather than every band
          followed by a snap to one. */}
      {scope.ready ? (
        <Agenda
          year={cursor.year}
          month={cursor.month}
          boardId={scope.boardId}
          boards={scope.boards}
          top={top}
        />
      ) : (
        <View style={{ paddingHorizontal: spacing.md }}>{top}</View>
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
  top,
}: {
  year: number;
  month: number;
  boardId: string | undefined;
  boards: BoardSummaryDto[];
  top: React.ReactNode;
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

  const days = useMemo(() => groupCalendarByDay(calendar.data ?? []), [calendar.data]);

  return (
    <FlatList
      data={days}
      keyExtractor={(day) => day.key}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xxl,
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => void calendar.refetch()}
          tintColor={canvas.soft}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>{top}</View>
      }
      renderItem={({ item: day }) => (
        <DaySection
          date={new Date(day.parts.year, day.parts.month, day.parts.day)}
          items={day.items}
          namesBoards={namesBoards}
          inkOf={inkOf}
          canvas={canvas}
        />
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
          <View style={{ paddingTop: spacing.xl, gap: spacing.sm }}>
            <PosterText variant="display" color={canvas.ink}>
              Nothing in {monthName}.
            </PosterText>
            <PosterText variant="body" color={canvas.soft}>
              Shows, rehearsals, meetings, due tasks, goals and reminders all land here.
            </PosterText>
          </View>
        )
      }
    />
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
}: {
  cursor: { year: number; month: number };
  onChange: (next: { year: number; month: number }) => void;
  onToday: () => void;
  canvas: PosterCanvas;
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
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  canvas: PosterCanvas;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: canvas.ink,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? canvas.ink : 'transparent',
      })}
    >
      {({ pressed }) => (
        <Icon name={icon} size={16} color={pressed ? canvas.background : canvas.ink} />
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
        boxShadow: color.plain ? shadows.card : undefined,
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
          boxShadow: badge.plain ? shadows.card : undefined,
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
