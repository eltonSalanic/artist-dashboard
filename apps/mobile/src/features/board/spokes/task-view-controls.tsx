import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { useBoard, useMe } from '@artist/api-client';
import { Priorities } from '@artist/shared';
import { ChoiceChips, type Choice } from '@/components/choice-chips';
import { Icon, type IconName } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { posterInput, posterRadius, spacing, useTokens } from '@/theme';
import {
  PRIORITY_LABELS,
  SORT_LABELS,
  activeFilters,
  defaultTaskView,
  type TaskSort,
  type TaskView,
} from '../task-view';

type Panel = 'sort' | 'filter' | 'search' | null;

/** How long typing must pause before the search goes to the API. */
const SEARCH_PAUSE_MS = 250;

/**
 * A task list's view and which of its panels is open, kept by the spoke
 * rather than by the controls: To-Do swaps between a draggable list and a
 * plain one as the view changes, and the controls are remounted with it.
 */
export function useTaskView(sort: TaskSort) {
  const [view, setView] = useState<TaskView>(() => defaultTaskView(sort));
  const [panel, setPanel] = useState<Panel>(null);
  // What is typed, kept apart from the view so each keystroke is not a fetch;
  // it reaches `view.search` once typing pauses.
  const [search, setSearch] = useState('');
  useEffect(() => {
    const words = search.trim();
    const timer = setTimeout(
      () => setView((v) => (v.search === words ? v : { ...v, search: words })),
      SEARCH_PAUSE_MS,
    );
    return () => clearTimeout(timer);
  }, [search]);
  return { view, setView, panel, setPanel, search, setSearch, initial: sort };
}

export type TaskViewState = ReturnType<typeof useTaskView>;

const APPEAR = FadeIn.duration(150).reduceMotion(ReduceMotion.System);
const VANISH = FadeOut.duration(100).reduceMotion(ReduceMotion.System);

/**
 * Sort and Filter as two pills under the header, each opening its choices as
 * rows of chips right below: everything one tap away and visible at once, the
 * way the forms pick priority, rather than a picker over the list.
 *
 * `byAssignee` is off for My Tasks, which is already one person's.
 */
export function TaskViewControls({
  boardId,
  state,
  byAssignee,
}: {
  boardId: string;
  state: TaskViewState;
  byAssignee: boolean;
}) {
  const { view, setView, panel, setPanel, search, setSearch, initial } = state;
  const board = useBoard(boardId);
  const me = useMe(true);
  const filters = activeFilters(view);
  const toggle = (next: Panel) => setPanel(panel === next ? null : next);

  const sorts = (Object.keys(SORT_LABELS) as TaskSort[]).map((value) => ({
    value,
    label: SORT_LABELS[value],
  }));
  const statuses: Choice<string>[] = [
    { value: 'all', label: 'Any' },
    { value: 'open', label: 'Open' },
    ...[...(board.data?.statuses ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((status) => ({ value: status.id, label: status.name })),
  ];
  const priorities: Choice<string>[] = [
    { value: 'all', label: 'Any' },
    ...Priorities.map((value) => ({ value, label: PRIORITY_LABELS[value] })),
  ];
  const myId = me.data?.user.id;
  const assignees: Choice<string>[] = [
    { value: 'all', label: 'Anyone' },
    ...(board.data?.members ?? [])
      .map((member) => ({
        value: member.userId,
        label: member.userId === myId ? 'Me' : member.displayName,
      }))
      // Yourself first: the one most people are looking for.
      .sort((a, b) => Number(b.value === myId) - Number(a.value === myId)),
  ];

  return (
    <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        <PanelPill
          icon={{ sf: 'arrow.up.arrow.down', md: 'swap-vert' }}
          label={SORT_LABELS[view.sort]}
          accessibilityLabel={`Sort by ${SORT_LABELS[view.sort]}`}
          active={view.sort !== initial}
          open={panel === 'sort'}
          onPress={() => toggle('sort')}
        />
        <PanelPill
          icon={{ sf: 'line.3.horizontal.decrease', md: 'filter-list' }}
          label={filters > 0 ? `Filter · ${filters}` : 'Filter'}
          accessibilityLabel={filters > 0 ? `Filter, ${filters} on` : 'Filter'}
          active={filters > 0}
          open={panel === 'filter'}
          onPress={() => toggle('filter')}
        />
        <PanelPill
          icon={{ sf: 'magnifyingglass', md: 'search' }}
          label={view.search !== '' ? view.search : 'Search'}
          accessibilityLabel={view.search !== '' ? `Search, ${view.search}` : 'Search'}
          active={view.search !== ''}
          open={panel === 'search'}
          onPress={() => toggle('search')}
          shrink
        />
      </View>

      {panel === 'search' && (
        <Animated.View
          entering={APPEAR}
          exiting={VANISH}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <SearchField value={search} onChange={setSearch} />
        </Animated.View>
      )}

      {panel === 'sort' && (
        <Animated.View entering={APPEAR} exiting={VANISH}>
          <ChoiceChips
            label="Sort by"
            choices={sorts}
            value={view.sort}
            onChange={(sort) => setView({ ...view, sort })}
          />
        </Animated.View>
      )}

      {panel === 'filter' && (
        <Animated.View entering={APPEAR} exiting={VANISH} style={{ gap: spacing.md }}>
          <ChoiceChips
            label="Status"
            choices={statuses}
            value={view.status}
            onChange={(status) => setView({ ...view, status })}
          />
          <ChoiceChips
            label="Priority"
            choices={priorities}
            value={view.priority}
            onChange={(priority) =>
              setView({ ...view, priority: priority as TaskView['priority'] })
            }
          />
          {byAssignee && (
            <ChoiceChips
              label="Assigned to"
              choices={assignees}
              value={view.assignee}
              onChange={(assignee) => setView({ ...view, assignee })}
            />
          )}
          {filters > 0 && (
            <ClearLink
              onPress={() => setView({ ...defaultTaskView(view.sort), search: view.search })}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
}

/**
 * A pill that opens a panel: grey at rest, filled in ink once it is changing
 * the list, so a narrowed list never looks like the whole one.
 */
function PanelPill({
  icon,
  label,
  accessibilityLabel,
  active,
  open,
  onPress,
  shrink = false,
}: {
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  active: boolean;
  open: boolean;
  onPress: () => void;
  /** Gives way first when the row is full: a long search, not the sort. */
  shrink?: boolean;
}) {
  const tokens = useTokens();
  const fg = active ? tokens.background : tokens.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs + 2,
        minHeight: 36,
        paddingHorizontal: spacing.md - 2,
        borderRadius: posterRadius.chip,
        borderCurve: 'continuous',
        backgroundColor: active ? tokens.foreground : tokens.muted,
        opacity: pressed ? 0.7 : 1,
        flexShrink: shrink ? 1 : 0,
      })}
    >
      <Icon name={icon} size={14} color={fg} />
      <PosterText variant="chip" numberOfLines={1} color={fg} style={{ flexShrink: 1 }}>
        {label}
      </PosterText>
      <Icon
        name={
          open
            ? { sf: 'chevron.up', md: 'expand-less' }
            : { sf: 'chevron.down', md: 'expand-more' }
        }
        size={12}
        color={fg}
      />
    </Pressable>
  );
}

/**
 * The search box: a flat filled field like the forms', focused as it opens,
 * since opening it is asking to type. Web's search matches titles; so does this.
 */
function SearchField({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const tokens = useTokens();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: posterRadius.block,
        borderCurve: 'continuous',
        backgroundColor: tokens.muted,
      }}
    >
      <Icon
        name={{ sf: 'magnifyingglass', md: 'search' }}
        size={15}
        color={tokens.mutedForeground}
      />
      <TextInput
        accessibilityLabel="Search tasks"
        placeholder="Search tasks…"
        placeholderTextColor={tokens.mutedForeground}
        value={value}
        onChangeText={onChange}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={[
          posterInput,
          {
            flex: 1,
            color: tokens.foreground,
            paddingVertical: spacing.sm + 3,
          },
        ]}
      />
      {value !== '' && process.env.EXPO_OS === 'android' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={10}
          onPress={() => onChange('')}
        >
          <Icon
            name={{ sf: 'xmark.circle.fill', md: 'cancel' }}
            size={16}
            color={tokens.mutedForeground}
          />
        </Pressable>
      )}
    </View>
  );
}

function ClearLink({ onPress }: { onPress: () => void }) {
  const tokens = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}
    >
      <PosterText variant="chip" color={tokens.primary}>
        Clear filters
      </PosterText>
    </Pressable>
  );
}
