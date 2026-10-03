import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  View,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useAllBoardsCalendar, type CalendarItemDto } from '@artist/api-client';
import {
  CALENDAR_CATEGORY_COPY,
  calendarCategory,
  groupCalendarByDay,
  type BoardSummaryDto,
  type CalendarCategory,
  type WidgetType,
} from '@artist/shared';
import { BoardFilter } from '@/components/board-filter';
import { Icon, type IconName } from '@/components/icon';
import { ListState } from '@/components/list-state';
import { Dot, Row } from '@/components/row';
import { ThemedText } from '@/components/themed-text';
import { useBoardScope } from '@/features/boards/use-board-scope';
import { dayHeading, timeOfDay } from '@/features/board/format';
import { useRefetchOnFocus } from '@/lib/refetch-on-focus';
import {
  boardAccent,
  radius,
  spacing,
  useScheme,
  useThemeColors,
} from '@/theme';

/**
 * An agenda, not a month grid.
 *
 * Web draws 42 cells with chips in them, which works at 1200px and not at 390:
 * a cell would be 50pt wide, and "Bowery Ballroom" does not fit in 50pt. The
 * same month of data read as a list of days loses nothing a phone could have
 * shown anyway. It stays *bounded to a month* rather than scrolling forever
 * both ways, because the request has to have an end — the API caps a range at
 * 370 days — and because "what is in March" is the question a month stepper
 * answers in one tap.
 *
 * Days with nothing in them are left out. A grid has to draw empty cells to
 * keep its shape; a list that printed 19 empty headings would bury the five
 * days that matter.
 */
export function CalendarScreen() {
  const colors = useThemeColors();
  const scope = useBoardScope('calendar');
  useRefetchOnFocus();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BoardFilter
        boards={scope.boards}
        boardId={scope.boardId}
        onSelect={scope.select}
      />
      <MonthStepper
        cursor={cursor}
        onChange={setCursor}
        onToday={() => {
          const now = new Date();
          setCursor({ year: now.getFullYear(), month: now.getMonth() });
        }}
      />
      {/* Mounted only once the stored filter has been read, so the first request
          is the one the person actually asked for rather than every band
          followed by a snap to one. */}
      {scope.ready && (
        <Agenda
          year={cursor.year}
          month={cursor.month}
          boardId={scope.boardId}
          boards={scope.boards}
        />
      )}

      <Stack.Screen options={{ title: 'Calendar' }} />
    </View>
  );
}

function Agenda({
  year,
  month,
  boardId,
  boards,
}: {
  year: number;
  month: number;
  boardId: string | undefined;
  boards: BoardSummaryDto[];
}) {
  const colors = useThemeColors();
  const scheme = useScheme();

  /**
   * A band's colour comes from the board list, not from the item.
   *
   * The calendar response already carries `boardId` and `boardName` because an
   * item merged across bands is otherwise unidentifiable and unlinkable. A
   * palette is not per item though — it is per board, and the list of bands is
   * already loaded and already says it. Putting it on every row would be the
   * same fact repeated a hundred times, and a second place for it to be stale.
   */
  const accents = useMemo(
    () =>
      new Map(
        boards.map((board) => [board.id, boardAccent(board.palette, scheme).bg]),
      ),
    [boards, scheme],
  );

  // In a single-band account the band carries no information, so no row names
  // it and the lead slot goes to the kind instead.
  const namesBoards = boards.length > 1;

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
  const sections = useMemo(
    () =>
      groupCalendarByDay(calendar.data ?? []).map((day) => ({
        key: day.key,
        title: dayHeading(new Date(day.parts.year, day.parts.month, day.parts.day)),
        data: day.items,
      })),
    [calendar.data],
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => `${item.kind}-${item.id}`}
      contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
      // Sticky headings are what makes a long agenda readable: scrolling past
      // the middle of a day, the date you are looking at stays on screen.
      stickySectionHeadersEnabled
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => void calendar.refetch()}
          tintColor={colors.mutedForeground}
        />
      }
      renderSectionHeader={({ section }) => (
        <View
          style={{
            backgroundColor: colors.background,
            paddingTop: spacing.md,
            paddingBottom: spacing.xs,
          }}
        >
          <ThemedText variant="footnote" tone="muted" style={{ fontWeight: '700' }}>
            {section.title.toUpperCase()}
          </ThemedText>
        </View>
      )}
      renderItem={({ item, index }) => (
        <CalendarRow
          item={item}
          first={index === 0}
          namesBoards={namesBoards}
          accent={accents.get(item.boardId)}
        />
      )}
      ListEmptyComponent={
        <ListState
          pending={calendar.isPending}
          error={calendar.error}
          onRetry={() => void calendar.refetch()}
          icon={{ sf: 'calendar', md: 'event' }}
          title={`Nothing in ${new Date(year, month, 1).toLocaleDateString(undefined, {
            month: 'long',
          })}`}
          body="Shows, rehearsals, meetings, due tasks, goals and reminders all land here."
        />
      }
    />
  );
}

/** Which widget a non-task item lives in, so a tap has somewhere to go. */
const CATEGORY_WIDGET: Record<Exclude<CalendarCategory, 'TASK'>, WidgetType> = {
  SHOW: 'SHOWS',
  REHEARSAL: 'NEXT_REHEARSALS',
  MEETING: 'NEXT_MEETINGS',
  REMINDER: 'REMINDERS',
  GOAL: 'GOALS',
};

const CATEGORY_ICON: Record<CalendarCategory, IconName> = {
  SHOW: { sf: 'music.mic', md: 'mic' },
  REHEARSAL: { sf: 'calendar', md: 'event' },
  MEETING: { sf: 'person.2.fill', md: 'groups' },
  TASK: { sf: 'checklist', md: 'checklist' },
  REMINDER: { sf: 'bell.fill', md: 'notifications' },
  GOAL: { sf: 'target', md: 'track-changes' },
};

/** A whole-day value has no clock time to print. */
const isWholeDay = (item: CalendarItemDto) =>
  item.kind === 'TASK' || item.kind === 'GOAL';

function CalendarRow({
  item,
  first,
  namesBoards,
  accent,
}: {
  item: CalendarItemDto;
  first: boolean;
  namesBoards: boolean;
  /** The band's colour; absent if the list of bands has not landed yet. */
  accent: string | undefined;
}) {
  const category = calendarCategory(item);

  // Every cross-board item names its band, because a colour dot alone is
  // unlearnable and "Load-in 5pm" is ambiguous without it. In a single-board
  // account the band carries no information at all, so the name is dropped
  // rather than repeated on every row.
  const meta = [
    namesBoards ? item.boardName : null,
    CALENDAR_CATEGORY_COPY[category].one,
    item.task?.statusName,
    item.event?.location,
  ]
    .filter((part): part is string => part != null && part !== '')
    .join(' · ');

  /**
   * The lead slot shows whichever of the two is doing work. With several bands
   * on screen the band is what you are telling apart, so it gets the dot; with
   * one band there is nothing to tell apart, so the slot goes to the kind. The
   * kind is named in the meta line either way, so nothing is carried by colour.
   */
  const lead = namesBoards && accent !== undefined ? (
    <Dot color={accent} />
  ) : (
    <Icon name={CATEGORY_ICON[category]} size={15} />
  );

  return (
    <Row
      first={first}
      title={item.title}
      meta={meta}
      dim={item.task?.isDone === true || item.goal?.completed === true}
      lead={lead}
      trailing={isWholeDay(item) ? undefined : timeOfDay(item.date)}
      onPress={() =>
        router.push(
          item.kind === 'TASK'
            ? `/board/${item.boardId}/task/${item.id}`
            : `/board/${item.boardId}/w/${CATEGORY_WIDGET[category as Exclude<CalendarCategory, 'TASK'>]}`,
        )
      }
    />
  );
}

/** ‹ March 2026 › — and the label itself jumps back to today. */
function MonthStepper({
  cursor,
  onChange,
  onToday,
}: {
  cursor: { year: number; month: number };
  onChange: (next: { year: number; month: number }) => void;
  onToday: () => void;
}) {
  const shift = (delta: number) => {
    const shifted = new Date(cursor.year, cursor.month + delta, 1);
    onChange({ year: shifted.getFullYear(), month: shifted.getMonth() });
  };

  const label = new Date(cursor.year, cursor.month, 1).toLocaleDateString(
    undefined,
    { month: 'long', year: 'numeric' },
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xs,
      }}
    >
      <StepperButton
        icon={{ sf: 'chevron.left', md: 'chevron-left' }}
        label="Previous month"
        onPress={() => shift(-1)}
      />
      {/* Tapping the month is the way back to now. A separate "Today" button
          would be a third control in a row that needs to stay scannable, and
          the month label is already the obvious thing to press. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. Go to this month`}
        onPress={onToday}
        style={({ pressed }) => ({
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.sm,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <ThemedText variant="headline">{label}</ThemedText>
      </Pressable>
      <StepperButton
        icon={{ sf: 'chevron.right', md: 'chevron-right' }}
        label="Next month"
        onPress={() => shift(1)}
      />
    </View>
  );
}

function StepperButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({
        padding: spacing.xs,
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <Icon name={icon} size={18} color={colors.primary} />
    </Pressable>
  );
}
